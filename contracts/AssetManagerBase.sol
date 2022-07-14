// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

//todo move to local dir
import "@tetu_io/tetu-contracts/contracts/openzeppelin/SafeERC20.sol";
import "./third_party/balancer/IBVault.sol";
import "./third_party/balancer/IRelayedBasePool8.sol";
import "./interface/IAssetManagerBase.sol";

/// @title TetuRewardsAssetManager
/// @dev TetuRewardsAssetManager is owned by a single pool such that any
///      rewards received by the Asset Manager may be distributed to LPs
///      Note: any behaviour to claim these rewards must be implemented in a derived contract
abstract contract AssetManagerBase is IAssetManagerBase {
  using SafeERC20 for IERC20;

  // ***************************************************
  //                CONSTANTS
  // ***************************************************

  uint256 private constant _CONFIG_PRECISION = 1e18;

  // ***************************************************
  //                VARIABLES
  // ***************************************************

  IBVault public immutable balancerVault;
  IERC20 public immutable underlying;

  /// @dev RewardsAssetManager manages a single Pool, to which it allocates all rewards that it receives.
  bytes32 public poolId;
  InvestmentConfig internal _config;

  // ***************************************************
  //                EVENTS
  // ***************************************************

  event InvestmentConfigSet(uint64 targetPercentage, uint64 lowerCriticalPercentage, uint64 upperCriticalPercentage);

  // ***************************************************
  //                CONSTRUCTOR/INITIALIZATION
  // ***************************************************

  constructor(IBVault balancerVault_, IERC20 underlying_) {
    require(address(underlying_) != address(0), "zero token");
    require(address(balancerVault_) != address(0), "zero balancer vault");

    underlying_.safeApprove(address(balancerVault_), type(uint256).max);

    balancerVault = balancerVault_;
    underlying = underlying_;
  }


  /// @dev Should be called in same transaction as deployment through a factory contract
  /// @param pId - the id of the pool
  //todo add factory
  function initialize(bytes32 pId) external override {
    require(poolId == bytes32(0), "Already initialised");
    require(pId != bytes32(0), "Pool id cannot be empty");
    poolId = pId;
  }

  // ***************************************************
  //                RESTRICTIONS/MODIFIERS
  // ***************************************************

  modifier onlyPoolContract() {
    require(msg.sender == getPoolAddress(), "Only callable by pool");
    _;
  }

  modifier onlyPoolRebalancer() {
    require(
      msg.sender == address(IRelayedBasePool(getPoolAddress()).getRelayer()),
      "Only callable by authorized rebalancer"
    );
    _;
  }

  modifier withCorrectPool(bytes32 pId) {
    require(pId == poolId, "AssetManager called with incorrect poolId");
    _;
  }

  // ***************************************************
  //                      VIEWS
  // ***************************************************

  function getToken() external view override returns (IERC20) {
    return underlying;
  }

  function getPoolAddress() public view returns (address addr) {
    uint256 shifted = uint256(poolId) / 2 ** (8 * 12);
    return address(uint160(shifted));
  }

  /// @dev Investment configuration todo extend comment
  function maxInvestableBalance(bytes32 pId) external view override withCorrectPool(pId) returns (int256) {
    uint256 aum = _getAUM();
    (uint256 poolCash, , ,) = balancerVault.getPoolTokenInfo(poolId, underlying);
    // Calculate the managed portion of funds locally as the Vault is unaware of returns
    return int256(((poolCash + aum) * _config.targetPercentage) / _CONFIG_PRECISION) - int256(aum);
  }

  function getInvestmentConfig(bytes32 pId) external view override withCorrectPool(pId) returns (InvestmentConfig memory) {
    return _config;
  }

  function getPoolBalances(bytes32 pId)
  external view override withCorrectPool(pId) returns (uint256 poolCash, uint256 poolManaged) {
    (poolCash, poolManaged) = _getPoolBalances(_getAUM());
  }

  function _getPoolBalances(uint256 aum) public view returns (uint256 poolCash, uint256 poolManaged) {
    (poolCash,,,) = balancerVault.getPoolTokenInfo(poolId, underlying);
    // Calculate the managed portion of funds locally as the Vault is unaware of returns
    poolManaged = aum;
  }

  /**
 * @notice Determines whether the pool should rebalance given the provided balances
   */
  function shouldRebalance(uint256 cash, uint256 managed) public view override returns (bool) {
    uint256 investedPercentage = (cash * _CONFIG_PRECISION) / (cash + managed);
    InvestmentConfig memory config = _config;
    return investedPercentage > config.upperCriticalPercentage || investedPercentage < config.lowerCriticalPercentage;
  }

  function getAUM(bytes32 pId) external view override withCorrectPool(pId) returns (uint256) {
    return _getAUM();
  }

  function _getAUM() internal view virtual returns (uint256);

  // ***************************************************
  //                 POOL ACTIONS
  // ***************************************************

  function setConfig(bytes32 pId, bytes memory rawConfig) external override withCorrectPool(pId) onlyPoolContract {
    InvestmentConfig memory config = abi.decode(rawConfig, (InvestmentConfig));

    require(
      config.upperCriticalPercentage <= _CONFIG_PRECISION,
      "Upper critical level must be less than or equal to 100%"
    );
    require(
      config.targetPercentage <= config.upperCriticalPercentage,
      "Target must be less than or equal to upper critical level"
    );
    require(
      config.lowerCriticalPercentage <= config.targetPercentage,
      "Lower critical level must be less than or equal to target"
    );

    _config = config;
    emit InvestmentConfigSet(config.targetPercentage, config.lowerCriticalPercentage, config.upperCriticalPercentage);
  }

  // ***************************************************
  //              POOL REBALANCER ACTIONS
  // ***************************************************

  /// @notice allows an authorized rebalancer to remove capital to facilitate large withdrawals
  /// @param pId - the poolId of the pool to withdraw funds back to
  /// @param amount - the amount of tokens to withdraw back to the pool
  function capitalOut(bytes32 pId, uint256 amount) external override withCorrectPool(pId) onlyPoolRebalancer {
    _capitalOut(amount);
  }

  // ***************************************************
  //              DEPOSIT / WITHDRAW / CLAIM
  // ***************************************************


  /// @dev Transfers capital into the asset manager, and then invests it
  /// @param amount - the amount of tokens being deposited
  function _capitalIn(uint256 amount) private {
    IBVault.PoolBalanceOp[] memory ops = new IBVault.PoolBalanceOp[](2);
    // Update the vault with new managed balance accounting for returns
    uint256 aum = _getAUM();
    ops[0] = IBVault.PoolBalanceOp(IBVault.PoolBalanceOpKind.UPDATE, poolId, underlying, aum);
    // Pull funds from the vault
    ops[1] = IBVault.PoolBalanceOp(IBVault.PoolBalanceOpKind.WITHDRAW, poolId, underlying, amount);
    balancerVault.managePoolBalance(ops);

    _invest(amount, aum);
  }

  /**
   * @notice Divests capital back to the asset manager and then sends it to the vault
   * @param amount - the amount of tokens to withdraw to the vault
   */
  function _capitalOut(uint256 amount) private {
    uint256 aum = _getAUM();
    uint256 tokensOut = _divest(amount, aum);
    IBVault.PoolBalanceOp[] memory ops = new IBVault.PoolBalanceOp[](2);
    // Update the vault with new managed balance accounting for returns
    ops[0] = IBVault.PoolBalanceOp(IBVault.PoolBalanceOpKind.UPDATE, poolId, underlying, aum);
    // Send funds back to the vault
    ops[1] = IBVault.PoolBalanceOp(IBVault.PoolBalanceOpKind.DEPOSIT, poolId, underlying, tokensOut);

    balancerVault.managePoolBalance(ops);
  }

  /**
   * @dev Invests capital inside the asset manager
   * @param amount - the amount of tokens being deposited
   * @param aum - the assets under management
   * @return the number of tokens that were deposited
   */
  function _invest(uint256 amount, uint256 aum) internal virtual returns (uint256);

  /**
   * @dev Divests capital back to the asset manager
   * @param amount - the amount of tokens being withdrawn
   * @return the number of tokens to return to the vault
   */
  function _divest(uint256 amount, uint256 aum) internal virtual returns (uint256);

  /// @dev Claim all rewards and send to rewardCollector
  function claimRewards() external override {
    _claim();
  }

  function _claim() internal virtual;

  // ***************************************************
  //                 UPDATE/REBALANCE
  //               without restrictions
  // ***************************************************

  /// @dev Reporting todo extend comment
  function updateBalanceOfPool(bytes32 pId) external override withCorrectPool(pId) {
    uint256 managedBalance = _getAUM();

    IBVault.PoolBalanceOp memory transfer = IBVault.PoolBalanceOp(
      IBVault.PoolBalanceOpKind.UPDATE,
      pId,
      underlying,
      managedBalance
    );
    IBVault.PoolBalanceOp[] memory ops = new IBVault.PoolBalanceOp[](1);
    ops[0] = (transfer);

    balancerVault.managePoolBalance(ops);
  }

  /**
   * @notice Rebalances funds between pool and asset manager to maintain target investment percentage.
   */
  function rebalance(bytes32 pId, bool force) external override withCorrectPool(pId) {
    if (force) {
      _rebalance();
    } else {
      (uint256 poolCash, uint256 poolManaged) = _getPoolBalances(_getAUM());
      if (shouldRebalance(poolCash, poolManaged)) {
        _rebalance();
      }
    }
  }

  function _rebalance() internal {
    uint256 aum = _getAUM();
    (uint256 poolCash, uint256 poolManaged) = _getPoolBalances(aum);
    InvestmentConfig memory config = _config;

    uint256 targetInvestment = ((poolCash + poolManaged) * config.targetPercentage) / _CONFIG_PRECISION;
    if (targetInvestment > poolManaged) {
      // Pool is under-invested so add more funds
      uint256 rebalanceAmount = targetInvestment - poolManaged;
      _capitalIn(rebalanceAmount);
    } else {
      // Pool is over-invested so remove some funds
      uint256 rebalanceAmount = poolManaged - targetInvestment;
      _capitalOut(rebalanceAmount);
    }

    emit Rebalance(poolId);
  }

}

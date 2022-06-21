// SPDX-License-Identifier: ISC
/**
 * By using this software, you understand, acknowledge and accept that Tetu
 * and/or the underlying software are provided “as is” and “as available”
 * basis and without warranties or representations of any kind either expressed
 * or implied. Any use of this open source software released under the ISC
 * Internet Systems Consortium license is done at your own risk to the fullest
 * extent permissible pursuant to applicable law any and all liability as well
 * as all warranties, including any fitness for a particular purpose with respect
 * to Tetu and/or the underlying software and the use thereof are disclaimed.
 */

pragma solidity 0.8.4;

import "@tetu_io/tetu-contracts/contracts/base/strategies/ProxyStrategyBase.sol";
import "@tetu_io/tetu-contracts/contracts/base/SlotsLib.sol";

/// @title Base contract for Mesh stake into vMesh pool
/// @author olegn
abstract contract BalancerIndexAMStrategyBase is ProxyStrategyBase {
  using SafeERC20 for IERC20;
  using SlotsLib for bytes32;

  // --------------------- CONSTANTS -------------------------------
  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "BalancerIndexAMStrategyBase";
  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "1.0.0";
  /// @dev 5% buybacks, 95% of vested Mesh should go to the targetRewardVault as rewards (not autocompound)
  uint256 private constant _BUY_BACK_RATIO = 5_00;

  //  uint256 private constant _MAX_LOCK_PERIOD = 1555200000;
  //  uint256 private constant _MESH_PRECISION = 1e18;
  //  IVotingMesh public constant VOTING_MESH = IVotingMesh(0x176b29289f66236c65C7ac5DB2400abB5955Df13);
  //  IPoolVoting public constant POOL_VOTING = IPoolVoting(0x705b40Af8CeCd59406cF630Ab7750055c9b137B9);
  //  IUniswapV2Router02 public constant MESH_ROUTER = IUniswapV2Router02(0x10f4A785F458Bc144e3706575924889954946639);
  //  address private constant _MESH_TETU_MESH_PAIR_ADDRESS = address(0xcf40352253de7a0155d700a937Dc797D681c9867);
  //  address private constant _USDC_ADDRESS = address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
  //  address private constant _TETU_MESH = address(0xDcB8F34a3ceb48782c9f3F98dF6C12119c8d168a);
  //  uint256 private constant _TARGET_PPFS = 1e18;

  // DO NOT ADD ANY VARIABLES MORE! ONLY CONSTANTS!
  /// @dev Deprecated, use slots instead
  //  mapping(bytes32 => uint) private strategyUintStorage;
  //  bytes32 internal constant _DUST_SLOT = bytes32(uint(keccak256("mesh.staking.dust")) - 1);
  //  bytes32 internal constant _TARGET_VAULT_SLOT = bytes32(uint(keccak256("mesh.staking.target.vault")) - 1);
  //  bytes32 internal constant _REWARDS_TOKENS_SPECIFIC_SLOT = bytes32(uint(keccak256("mesh.staking.rewards.tokens.specific")) - 1);
  // DO NOT ADD ANY VARIABLES MORE! ONLY CONSTANTS!

  /// @notice Initialize contract after setup it as proxy implementation
  function initializeStrategy(
    address _controller,
    address _vault,
    address _underlying,
    address[] memory __rewardTokens
  ) public initializer {
    ProxyStrategyBase.initializeStrategyBase(_controller, _underlying, _vault, __rewardTokens, _BUY_BACK_RATIO);
  }

  event VotingAdded(address exchange, uint256 amount);
  event VotingRemoved(address exchange, uint256 amount);
  event VotingRemovedAll();
  event TargetRewardVaultUpdated(address newTargetRewardVault);

  // ------------------ GOV actions --------------------------

  // --------------------------------------------

  /// @dev Returns MESH amount under control
  function _rewardPoolBalance() internal view override returns (uint256) {
    //    return VOTING_MESH.lockedMESH(address(this));
    return 42;
  }

  /// @dev In this version rewards are accumulated in this strategy
  function doHardWork() external override onlyNotPausedInvesting hardWorkers {
    // rewards claimed on lock action so we can not properly calculate exact reward amount
    // assume that hardWork action will ba called on each deposit and immediately liquidate rewards
    //    VOTING_MESH.claimReward();
    //    POOL_VOTING.claimRewardAll();
    //
  }

  /// @dev Stake Mesh to vMesh
  function depositToPool(uint256 amount) internal override {}

  /// @dev Withdraw underlying from meshSinglePool. Conversion of underlying to iToken is needed.
  /// @param amount Deposit amount
  function withdrawAndClaimFromPool(uint256 amount) internal override {
    //    uint256 exchangeRateStored = meshSinglePool().exchangeRateStored();
    //    uint256 iTokenBalance = meshSinglePool().balanceOf(address(this));
    //    uint iTokenToWithdraw = amount * _PRECISION / exchangeRateStored;
    //    meshSinglePool().withdrawTokenByAmount(Math.min(iTokenBalance, iTokenToWithdraw));
  }

  /// @dev the same as withdrawAndClaimFromPool because mesh pools have no such functionality
  function emergencyWithdrawFromPool() internal override {
    //    uint strategyBalance = meshSinglePool().balanceOf(address(this));
    //    meshSinglePool().withdrawToken(strategyBalance);
  }

  /// @dev Do something useful with farmed rewards
  function liquidateReward() internal override {
    //    _swapRTtoProxyRT();
    //    _autocompound();
    //    _liquidateRewardMesh(true);
  }

  /// @dev Not implemented
  function readyToClaim() external view override returns (uint256[] memory toClaim) {
    toClaim = new uint256[](_rewardTokens.length);
  }

  /// @dev Return full amount of staked tokens
  function poolTotalAmount() external view override returns (uint256) {
    //    return IERC20(_underlying()).balanceOf(address(VOTING_MESH));
    return 42;
  }

  /// @dev Platform name for statistical purposes
  /// @return Platform enum index
  function platform() external pure override returns (Platform) {
    return Platform.BALANCER;
  }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./third_party/balancer/IBVault.sol";
import "./interface/IGagueRewardingAssetManager.sol";
import "./interface/IGagueRewardingPoolRelayer.sol";

contract TetuGagueRewardingRebalancingRelayer is IGagueRewardingPoolRelayer {
  // We start at a non-zero value to make EIP2200 refunds lower, meaning there'll be a higher chance of them being
  // fully effective.
  bytes32 internal constant _EMPTY_CALLED_POOL =
    bytes32(0x0000000000000000000000000000000000000000000000000000000000000001);

  modifier rebalance(
    bytes32 poolId,
    IAsset[] memory assets,
    uint256[] memory minCashBalances
  ) {
    require(_calledPool == _EMPTY_CALLED_POOL, "Rebalancing relayer reentered");
    IERC20[] memory tokens = _translateToIERC20(assets);
    _ensureCashBalance(poolId, tokens, minCashBalances);
    _calledPool = poolId;
    _;
    _calledPool = _EMPTY_CALLED_POOL;
    _rebalance(poolId, tokens);
  }

  IBVault public immutable vault;
  bytes32 internal _calledPool;

  constructor(IBVault _vault) {
    vault = _vault;
    _calledPool = _EMPTY_CALLED_POOL;
  }

  function hasCalledPool(bytes32 poolId) external view override returns (bool) {
    return _calledPool == poolId;
  }

  //todo need to think if needs to be protected
  function claimGagueRewards(bytes32 poolId) external override {
    (IERC20[] memory tokens, , ) = vault.getPoolTokens(poolId);
    for (uint256 i = 0; i < tokens.length; i++) {
      (, , , address assetManager) = vault.getPoolTokenInfo(poolId, tokens[i]);

      if (assetManager != address(0)) {
        IGagueRewardingAssetManager(assetManager).claimRewards();
      }
    }
  }

  function joinPool(
    bytes32 poolId,
    address recipient,
    IBVault.JoinPoolRequest memory request
  ) external rebalance(poolId, request.assets, new uint256[](request.assets.length)) {
    vault.joinPool(poolId, msg.sender, recipient, request);
  }

  function exitPool(
    bytes32 poolId,
    address payable recipient,
    IBVault.ExitPoolRequest memory request,
    uint256[] memory minCashBalances
  ) external rebalance(poolId, request.assets, minCashBalances) {
    vault.exitPool(poolId, msg.sender, recipient, request);
  }

  function _ensureCashBalance(
    bytes32 poolId,
    IERC20[] memory tokens,
    uint256[] memory minCashBalances
  ) internal {
    for (uint256 i = 0; i < tokens.length; i++) {
      (uint256 cash, , , address assetManager) = vault.getPoolTokenInfo(poolId, tokens[i]);

      if (assetManager != address(0)) {
        uint256 cashNeeded = minCashBalances[i];
        if (cash < cashNeeded) {
          // Withdraw the managed balance back to the pool to ensure that the cash covers the withdrawal
          // This will automatically update the vault with the most recent managed balance
          IGagueRewardingAssetManager(assetManager).capitalOut(poolId, cashNeeded - cash);
        } else {
          // We want to ensure that the pool knows about all asset manager returns
          // to avoid a new LP getting a share of returns earned before they joined.
          // We then update the vault with the current managed balance manually.
          IGagueRewardingAssetManager(assetManager).updateBalanceOfPool(poolId);
        }
      }
    }
  }

  function _rebalance(bytes32 poolId, IERC20[] memory tokens) internal {
    for (uint256 i = 0; i < tokens.length; i++) {
      (, , , address assetManager) = vault.getPoolTokenInfo(poolId, tokens[i]);
      if (assetManager != address(0)) {
        // Note that malicious Asset Managers could perform reentrant calls at this stage and e.g. try to exit
        // the Pool before Managers for other tokens have rebalanced. This is considered a non-issue as a) no
        // exploits should be enabled by allowing for this, and b) Pools trust their Asset Managers.

        // Do a non-forced rebalance
        IGagueRewardingAssetManager(assetManager).rebalance(poolId, false);
      }
    }
  }

  function _translateToIERC20(IAsset[] memory assets) internal pure returns (IERC20[] memory) {
    IERC20[] memory tokens = new IERC20[](assets.length);
    for (uint256 i = 0; i < assets.length; ++i) {
      tokens[i] = IERC20(address(assets[i]));
    }
    return tokens;
  }
}

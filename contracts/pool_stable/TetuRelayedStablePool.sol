// SPDX-License-Identifier: MIT


import "./TetuStablePool.sol";
import "../third_party/balancer/IRelayedBasePool.sol";

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

/// @title TetuRelayedStablePool
/// @dev TetuRelayedStablePool is a extension of standard Balancer's stable pool with restricted joinPool and exitPool
///      Those methods should be called by the Relayer only to allow usage of Asset managers (rebalancing logic)
contract TetuRelayedStablePool is TetuStablePool, IRelayedBasePool {
  using TetuStablePoolUserDataHelpers for bytes;

  IBasePoolRelayer internal immutable _relayer;

  modifier ensureRelayerEnterCall(bytes32 poolId, bytes calldata userData) {
    TetuStablePool.JoinKind kind = userData.joinKind();
    if (kind != TetuStablePool.JoinKind.INIT) {
      require(_relayer.hasCalledPool(poolId), "Only relayer can join pool");
    }
    _;
  }

  modifier ensureRelayerExitCall(bytes32 poolId) {
    require(_relayer.hasCalledPool(poolId), "Only relayer can exit pool");
    _;
  }

  constructor(
    IVault vault,
    string memory name,
    string memory symbol,
    IERC20[] memory tokens,
    uint256 amplificationParameter,
    uint256 swapFeePercentage,
    uint256 pauseWindowDuration,
    uint256 bufferPeriodDuration,
    address owner,
    address relayer,
    address[] memory assetManagers
  )
  TetuStablePool(
    vault,
    name,
    symbol,
    tokens,
    amplificationParameter,
    swapFeePercentage,
    pauseWindowDuration,
    bufferPeriodDuration,
    owner,
    assetManagers
  )
  {
    _relayer = IBasePoolRelayer(relayer);
  }

  /// @dev returns relayer attached to this pool
  function getRelayer() public view override returns (IBasePoolRelayer) {
    return _relayer;
  }

  /// @dev hook to restrict direct joinPool requests. Only Relayer can join this pool
  function onJoinPool(
    bytes32 poolId,
    address sender,
    address recipient,
    uint256[] memory balances,
    uint256 lastChangeBlock,
    uint256 protocolSwapFeePercentage,
    bytes calldata userData
  ) public virtual override ensureRelayerEnterCall(poolId, userData) returns (uint256[] memory, uint256[] memory) {
    return super.onJoinPool(poolId, sender, recipient, balances, lastChangeBlock, protocolSwapFeePercentage, userData);
  }

  /// @dev hook to restrict direct exitPool requests. Only Relayer can exit from this pool
  function onExitPool(
    bytes32 poolId,
    address sender,
    address recipient,
    uint256[] memory balances,
    uint256 lastChangeBlock,
    uint256 protocolSwapFeePercentage,
    bytes calldata userData
  ) public virtual override ensureRelayerExitCall(poolId) returns (uint256[] memory, uint256[] memory) {
    return super.onExitPool(poolId, sender, recipient, balances, lastChangeBlock, protocolSwapFeePercentage, userData);
  }
}

// SPDX-License-Identifier: MIT


import "./TetuStablePool.sol";
import "../pool_utils/RelayedBasePool.sol";

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

/// @title TetuRelayedStablePool
/// @dev TetuRelayedStablePool is a extension of standard Balancer's stable pool with restricted joinPool and exitPool
///      Those methods should be called by the Relayer only to allow usage of Asset managers (rebalancing logic)
contract TetuRelayedStablePool is TetuStablePool, RelayedBasePool {
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
    IBasePoolRelayer relayer,
    address[] memory assetManagers
  )
  TetuStablePool(vault, name, symbol, tokens, amplificationParameter, swapFeePercentage, pauseWindowDuration, bufferPeriodDuration, owner, assetManagers)
  RelayedBasePool(relayer)
  {}

  function _isOwnerOnlyAction(bytes32 actionId) internal view virtual override(TetuStablePool, BasePool) returns (bool)  {
    return super._isOwnerOnlyAction(actionId);
  }
}

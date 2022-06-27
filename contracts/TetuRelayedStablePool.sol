// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import "@balancer-labs/v2-pool-stable/contracts/StablePool.sol";
import "./third_party/balancer/StablePoolUserData.sol";
import "./third_party/balancer/IRelayedBasePool.sol";

pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

contract TetuRelayedStablePool is StablePool, IRelayedBasePool {
  using StablePoolUserData for bytes;

  IBasePoolRelayer internal immutable _relayer;

  modifier ensureRelayerEnterCall(bytes32 poolId, bytes calldata userData) {
    StablePoolUserData.JoinKind kind = userData.joinKind();
    if (kind != StablePoolUserData.JoinKind.INIT) {
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
    address relayer
  )
    StablePool(
      vault,
      name,
      symbol,
      tokens,
      amplificationParameter,
      swapFeePercentage,
      pauseWindowDuration,
      bufferPeriodDuration,
      owner
    )
  {
    _relayer = IBasePoolRelayer(relayer);
  }

  function getRelayer() public view override returns (IBasePoolRelayer) {
    return _relayer;
  }

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

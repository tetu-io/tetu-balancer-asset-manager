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

import "@balancer-labs/v2-pool-weighted/contracts/WeightedPool.sol";
pragma solidity ^0.7.0;

pragma experimental ABIEncoderV2;

contract TetuWeightedPool is WeightedPool {
  address public immutable strategy;

  constructor(
    IVault vault,
    string memory name,
    string memory symbol,
    IERC20[] memory tokens,
    uint256[] memory normalizedWeights,
    address[] memory assetManagers,
    uint256 swapFeePercentage,
    uint256 pauseWindowDuration,
    uint256 bufferPeriodDuration,
    address owner,
    address _strategy
  )
    WeightedPool(
      vault,
      name,
      symbol,
      tokens,
      normalizedWeights,
      assetManagers,
      swapFeePercentage,
      pauseWindowDuration,
      bufferPeriodDuration,
      owner
    )
  {
    strategy = _strategy;
  }

  function onJoinPool(
    bytes32 poolId,
    address sender,
    address recipient,
    uint256[] memory balances,
    uint256 lastChangeBlock,
    uint256 protocolSwapFeePercentage,
    bytes memory userData
  ) public virtual override returns (uint256[] memory, uint256[] memory) {
    require(msg.sender == strategy, "Only strategy can join pool");
    return super.onJoinPool(poolId, sender, recipient, balances, lastChangeBlock, protocolSwapFeePercentage, userData);
  }

  function onExitPool(
    bytes32 poolId,
    address sender,
    address recipient,
    uint256[] memory balances,
    uint256 lastChangeBlock,
    uint256 protocolSwapFeePercentage,
    bytes memory userData
  ) public virtual override returns (uint256[] memory, uint256[] memory) {
    require(msg.sender == strategy, "Only strategy can exit pool");
    return super.onExitPool(poolId, sender, recipient, balances, lastChangeBlock, protocolSwapFeePercentage, userData);
  }
}

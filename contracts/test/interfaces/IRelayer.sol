// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../../third_party/balancer/IBVault.sol";

interface IRelayer {
  function joinPool(bytes32 poolId, address recipient, IBVault.JoinPoolRequest memory request) external;
}

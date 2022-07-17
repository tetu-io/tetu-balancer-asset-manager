// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../third_party/balancer/IBasePoolRelayer8.sol";

interface IRelayer is IBasePoolRelayer {

  function claimAssetManagerRewards(bytes32 poolId) external;

}

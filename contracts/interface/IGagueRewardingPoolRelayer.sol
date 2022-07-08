// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../third_party/balancer/IBasePoolRelayer8.sol";

interface IGagueRewardingPoolRelayer is IBasePoolRelayer {
  function claimGagueRewards(bytes32 poolId) external;
}

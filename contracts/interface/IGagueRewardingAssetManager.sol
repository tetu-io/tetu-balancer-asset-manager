// SPDX-License-Identifier: MIT

import "../third_party/balancer/IAssetManager.sol";
import "@tetu_io/tetu-contracts/contracts/openzeppelin/IERC20.sol";

pragma solidity 0.8.4;


interface IGagueRewardingAssetManager is IAssetManager {
  function claimRewards() external;
}

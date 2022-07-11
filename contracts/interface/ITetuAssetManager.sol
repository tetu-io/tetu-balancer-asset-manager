// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../third_party/balancer/IAssetManager.sol";


interface ITetuAssetManager is IAssetManager {
  struct InvestmentConfig {
    uint64 targetPercentage;
    uint64 upperCriticalPercentage;
    uint64 lowerCriticalPercentage;
  }

  function initialize(bytes32 poolId) external;

  function getInvestmentConfig(bytes32 pId) external view returns (InvestmentConfig memory);
}

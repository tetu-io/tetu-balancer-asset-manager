// SPDX-License-Identifier: MIT

import "@balancer-labs/v2-vault/contracts/Vault.sol";
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.0;


contract BalancerVault is Vault {
  constructor(
    IAuthorizer authorizer,
    IWETH weth,
    uint256 pauseWindowDuration,
    uint256 bufferPeriodDuration
  ) Vault(authorizer, weth, pauseWindowDuration, bufferPeriodDuration){}

}

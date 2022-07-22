// SPDX-License-Identifier: MIT

import "@balancer-labs/v2-vault/contracts/Authorizer.sol";
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.0;


contract BalancerAuthorizer is Authorizer {
  constructor(
    address admin
  ) Authorizer(admin){}

}

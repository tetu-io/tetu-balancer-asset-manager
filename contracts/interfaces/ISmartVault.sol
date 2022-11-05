// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface ISmartVault {

  function depositAndInvest(uint256 amount) external;

  function underlyingBalanceInVault() external view returns (uint256);

  function withdraw(uint256 numberOfShares) external;

}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface ISmartVault {

  function deposit(uint256 amount) external;

  function underlyingBalanceInVault() external view returns (uint256);

  function withdraw(uint256 numberOfShares) external;

  function underlyingBalanceWithInvestmentForHolder(address holder) external view returns (uint256);

  function underlyingUnit() external view returns (uint256);

  function getPricePerFullShare() external view returns (uint256);
}

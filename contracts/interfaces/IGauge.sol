// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IGauge {

  function getAllRewards(
    address stakingToken,
    address account
  ) external;

  function rewardTokensLength(address stakingToken) external view returns (uint);

  function rewardTokens(address stakingToken, uint tokenIndex) external view returns (address);
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../interfaces/IGauge.sol";
import "../openzeppelin/SafeERC20.sol";

contract MockGague is IGauge {
  using SafeERC20 for IERC20;

  address[] public _rewardTokens;
  uint[] public dummyRewardAmounts;
  address public stackingToken;

  mapping(address => uint) _rewardTokensLength;

  constructor(address[] memory rewardTokens_, uint[] memory _dummyRewardAmounts, address _stackingToken){
    require(_stackingToken != address(0), "zero stackingToken");
    _rewardTokens = rewardTokens_;
    dummyRewardAmounts = _dummyRewardAmounts;
    stackingToken = _stackingToken;
    _rewardTokensLength[stackingToken] = rewardTokens_.length;

  }

  function getAllRewards(
    address,
    address account
  ) external override {
    for (uint i = 0; i < _rewardTokens.length; i++) {
      IERC20(_rewardTokens[i]).safeTransfer(account, dummyRewardAmounts[i]);
    }

  }

  function rewardTokensLength(address _stakingToken) external view override returns (uint){
    return _rewardTokensLength[_stakingToken];
  }

  function rewardTokens(address, uint tokenIndex) external view override returns (address){
    return _rewardTokens[tokenIndex];
  }

}

// SPDX-License-Identifier: ISC
/**
* By using this software, you understand, acknowledge and accept that Tetu
* and/or the underlying software are provided “as is” and “as available”
* basis and without warranties or representations of any kind either expressed
* or implied. Any use of this open source software released under the ISC
* Internet Systems Consortium license is done at your own risk to the fullest
* extent permissible pursuant to applicable law any and all liability as well
* as all warranties, including any fitness for a particular purpose with respect
* to Tetu and/or the underlying software and the use thereof are disclaimed.
*/

pragma solidity 0.8.4;

import "@tetu_io/tetu-contracts/contracts/openzeppelin/SafeERC20.sol";
import "../interface/IGauge.sol";

contract MockGague is IGauge {
  using SafeERC20 for IERC20;

  address[] public _rewardTokens;
  uint[] public dummyRewardAmounts;
  address public stackingToken;

  mapping(address => uint) _rewardTokensLength;

  constructor(address[] memory rewardTokens_, uint[] memory _dummyRewardAmounts, address _stackingToken){
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

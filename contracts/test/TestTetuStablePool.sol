// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../pool_stable/TetuStablePool.sol";

contract TestTetuStablePool is TetuStablePool {

    uint256 private _dummyTotalTokens;

    constructor(
        IVault vault,
        string memory name,
        string memory symbol,
        IERC20[] memory tokens,
        uint256 amplificationParameter,
        uint256 swapFeePercentage,
        uint256 pauseWindowDuration,
        uint256 bufferPeriodDuration,
        address owner,
        address[] memory assetManagers
    )
    TetuStablePool(
        vault,
        name,
        symbol,
        tokens,
        amplificationParameter,
        swapFeePercentage,
        pauseWindowDuration,
        bufferPeriodDuration,
        owner,
        assetManagers
    ){
        _dummyTotalTokens = tokens.length;
    }

    function setTotalTokens(uint256 totalTokens) external {
        _dummyTotalTokens = totalTokens;
    }

    function _getTotalTokens() internal view virtual override returns (uint256) {
        return _dummyTotalTokens;
    }

    function scalingFactor(IERC20 token) external view returns (uint256){
        return _scalingFactor(token);
    }

    function scalingFactors() external view returns (uint256[] memory) {
        return _scalingFactors();
    }

}

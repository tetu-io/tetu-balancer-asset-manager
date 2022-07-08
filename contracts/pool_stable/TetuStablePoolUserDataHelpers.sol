// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "@balancer-labs/v2-solidity-utils/contracts/openzeppelin/IERC20.sol";

import "./TetuStablePool.sol";

library TetuStablePoolUserDataHelpers {
  function joinKind(bytes memory self) internal pure returns (TetuStablePool.JoinKind) {
    return abi.decode(self, (TetuStablePool.JoinKind));
  }

  function exitKind(bytes memory self) internal pure returns (TetuStablePool.ExitKind) {
    return abi.decode(self, (TetuStablePool.ExitKind));
  }

  // Joins

  function initialAmountsIn(bytes memory self) internal pure returns (uint256[] memory amountsIn) {
    (, amountsIn) = abi.decode(self, (TetuStablePool.JoinKind, uint256[]));
  }

  function exactTokensInForBptOut(bytes memory self)
  internal
  pure
  returns (uint256[] memory amountsIn, uint256 minBPTAmountOut)
  {
    (, amountsIn, minBPTAmountOut) = abi.decode(self, (TetuStablePool.JoinKind, uint256[], uint256));
  }

  function tokenInForExactBptOut(bytes memory self) internal pure returns (uint256 bptAmountOut, uint256 tokenIndex) {
    (, bptAmountOut, tokenIndex) = abi.decode(self, (TetuStablePool.JoinKind, uint256, uint256));
  }

  // Exits

  function exactBptInForTokenOut(bytes memory self) internal pure returns (uint256 bptAmountIn, uint256 tokenIndex) {
    (, bptAmountIn, tokenIndex) = abi.decode(self, (TetuStablePool.ExitKind, uint256, uint256));
  }

  function exactBptInForTokensOut(bytes memory self) internal pure returns (uint256 bptAmountIn) {
    (, bptAmountIn) = abi.decode(self, (TetuStablePool.ExitKind, uint256));
  }

  function bptInForExactTokensOut(bytes memory self)
  internal
  pure
  returns (uint256[] memory amountsOut, uint256 maxBPTAmountIn)
  {
    (, amountsOut, maxBPTAmountIn) = abi.decode(self, (TetuStablePool.ExitKind, uint256[], uint256));
  }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../interfaces/ISmartVault.sol";

contract MockTetuSmartVault is ISmartVault, ERC20 {
  using SafeERC20 for IERC20;

  IERC20 public asset;
  bool isReturnTokens;
  bool isReturnShares;

  constructor(
    address _asset,
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    bool _isReturnShares,
    bool _isReturnTokens
  )ERC20(_name, _symbol, _decimals)  {
    isReturnShares = _isReturnShares;
    isReturnTokens = _isReturnTokens;
    asset = IERC20(_asset);
  }

  function underlyingBalanceInVault() external override view returns (uint256){
    return asset.balanceOf(address(this));
  }

  function depositAndInvest(uint256 amount) external override {
    asset.safeTransferFrom(msg.sender, address(this), amount);
    if (isReturnShares) {
      _mint(msg.sender, amount);
    }
  }

  function withdraw(uint256 numberOfShares) external override {
    if (isReturnTokens) {
      asset.transfer(msg.sender, numberOfShares);
    }

  }
}

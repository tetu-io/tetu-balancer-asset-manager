// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@tetu_io/tetu-contracts/contracts/openzeppelin/SafeERC20.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "../interface/IERC4626.sol";
import "hardhat/console.sol";

contract MockTetuVaultV2 is IERC4626, ERC20 {
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

  function deposit(uint assets, address receiver) external override returns (uint shares){
    asset.safeTransferFrom(msg.sender, address(this), assets);
    if (isReturnShares) {
      _mint(receiver, assets);
    }
    return assets;
  }

  function mint(uint shares, address receiver) external override returns (uint assets){
    asset.safeTransferFrom(msg.sender, address(this), assets);
    if (isReturnShares) {
      _mint(receiver, assets);
    }
    return shares;
  }

  function withdraw(
    uint assets,
    address receiver,
    address owner
  ) external override returns (uint shares){
    _burn(owner, assets);
    if (isReturnTokens) {
      asset.safeTransfer(receiver, assets);
    }
    return assets;
  }

  function redeem(
    uint shares,
    address receiver,
    address owner
  ) external override returns (uint assets){
    _burn(owner, shares);
    if (isReturnTokens) {
      asset.safeTransfer(receiver, shares);
    }
    return shares;
  }

  function totalAssets() external view override returns (uint){
    return asset.balanceOf(address(this));
  }

  function convertToShares(uint assets) external pure override returns (uint){
    return assets;
  }

  function convertToAssets(uint shares) external pure override returns (uint){
    return shares;
  }

  function previewDeposit(uint assets) external pure override returns (uint){
    return assets;
  }

  function previewMint(uint shares) external pure override returns (uint){
    return shares;
  }

  function previewWithdraw(uint assets) external pure override returns (uint){
    return assets;
  }

  function previewRedeem(uint shares) external pure override returns (uint){
    return shares;
  }

  function maxDeposit(address) external pure override returns (uint){
    return 1e18;
  }

  function maxMint(address) external pure override returns (uint){
    return 1e18;
  }

  function maxWithdraw(address owner) external view override returns (uint){
    return balanceOf[owner];
  }

  function maxRedeem(address owner) external view override returns (uint){
    return balanceOf[owner];
  }


}

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
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "../interface/IERC4626.sol";

contract MockTetuVaultV2 is IERC4626, ERC20 {
  using SafeERC20 for IERC20;

  address public underlying;

  constructor(
    address _underlying,
    string memory _name,
    string memory _symbol,
    uint8 _decimals)ERC20(_name, _symbol, _decimals)  {
    underlying = _underlying;
  }

  function deposit(uint assets, address receiver) external override returns (uint shares){
    IERC20(underlying).safeTransferFrom(msg.sender, address(this), assets);
    _mint(receiver, assets);
    return assets;
  }

  function mint(uint shares, address receiver) external override returns (uint assets){
    IERC20(underlying).safeTransferFrom(msg.sender, address(this), assets);
    _mint(receiver, assets);
    return shares;
  }

  function withdraw(
    uint assets,
    address receiver,
    address owner
  ) external override returns (uint shares){
    return 42;
  }

  function redeem(
    uint shares,
    address receiver,
    address owner
  ) external override returns (uint assets){
    return 42;
  }

  function totalAssets() external view override returns (uint){
    return IERC20(underlying).balanceOf(address(this));
  }

  function convertToShares(uint assets) external view override returns (uint){
    return assets;
  }

  function convertToAssets(uint shares) external view override returns (uint){
    return shares;
  }

  function previewDeposit(uint assets) external view override returns (uint){
    return assets;
  }

  function previewMint(uint shares) external view override returns (uint){
    return shares;
  }

  function previewWithdraw(uint assets) external view override returns (uint){
    return assets;
  }

  function previewRedeem(uint shares) external view override returns (uint){
    return shares;
  }

  function maxDeposit(address) external view override returns (uint){
    return 1e18;
  }

  function maxMint(address) external view override returns (uint){
    return 1e18;
  }

  function maxWithdraw(address owner) external view override returns (uint){
    return balanceOf[owner];
  }

  function maxRedeem(address owner) external view override returns (uint){
    return balanceOf[owner];
  }


}

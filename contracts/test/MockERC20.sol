// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@rari-capital/solmate/src/tokens/ERC20.sol";

contract MockERC20 is ERC20 {
  constructor(
    string memory _name,
    string memory _symbol,
    uint8 _decimals
  ) ERC20(_name, _symbol, _decimals) {}

  function mint(address to, uint256 value) external virtual {
    _mint(to, value);
  }

  function burn(address from, uint256 value) external virtual {
    _burn(from, value);
  }
}

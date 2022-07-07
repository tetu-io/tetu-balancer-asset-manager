// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import "@tetu_io/tetu-contracts/contracts/openzeppelin/SafeERC20.sol";
import "@tetu_io/tetu-contracts/contracts/openzeppelin/Math.sol";
import "./interface/IERC4626.sol";
import "./third_party/balancer/IBVault.sol";
import "./RewardsAssetManager.sol";

import "./interface/IGauge.sol";

pragma solidity 0.8.4;

contract TetuVaultAssetManager is RewardsAssetManager {
  using SafeERC20 for IERC20;

  address public underlying;
  address public tetuVault;
  address public rewardCollector;
  IGauge public gague;

  constructor(
    IBVault balancerVault,
    address _tetuVault,
    address _underlying,
    address _rewardCollector,
    address _gague
  ) RewardsAssetManager(balancerVault, IERC20(_underlying)) {
    require(_underlying != address(0), "zero underlying");
    underlying = _underlying;
    tetuVault = _tetuVault;
    rewardCollector = _rewardCollector;
    gague = IGauge(_gague);
  }

  /**
   * @dev Should be called in same transaction as deployment through a factory contract
   * @param poolId - the id of the pool
   */
  function initialize(bytes32 poolId) public {
    _initialize(poolId);
  }

  /**
   * @dev Deposits capital into Tetu Vault
   * @param amount - the amount of tokens being deposited
   * @return the amount deposited
   */
  function _invest(uint256 amount, uint256) internal override returns (uint256) {
    uint256 balance = IERC20(underlying).balanceOf(address(this));
    if (amount < balance) {
      balance = amount;
    }
    IERC20(underlying).safeIncreaseAllowance(tetuVault, balance);

    // invest to tetuVault
    IERC4626(tetuVault).deposit(balance, address(this));
    return balance;
  }

  /**
   * @dev Withdraws capital out of TetuVault
   * @param amountUnderlying - the amount to withdraw
   * @return the number of tokens to return to the tetuVault
   */
  function _divest(uint256 amountUnderlying, uint256) internal override returns (uint256) {
    amountUnderlying = Math.min(amountUnderlying, _getAUM());
    if (amountUnderlying > 0) {
      IERC4626(tetuVault).withdraw(amountUnderlying, address(this), address(this));
    }
    return IERC20(underlying).balanceOf(address(this));
  }

  /**
   * @dev Checks balance of managed assets
   */
  function _getAUM() internal view override returns (uint256) {
    return IERC4626(tetuVault).maxWithdraw(address(this));
  }

  /// @dev Claim all rewards from given gague and send to rewardCollector
  function claimRewards() external onlyPoolRebalancer {
    _claim();
  }

  /// @dev Claim all rewards from given gague and send to rewardCollector
  function _claim() internal {
    if (address(gague) != address(0) && rewardCollector != address(0)) {
      gague.getAllRewards(address(tetuVault), address(this));
      for (uint256 i = 0; i < gague.rewardTokensLength(address(tetuVault)); i++) {
        IERC20 rt = IERC20(gague.rewardTokens(address(tetuVault), i));
        uint256 bal = IERC20(rt).balanceOf(address(this));
        if (bal > 0) {
          rt.safeTransfer(rewardCollector, bal);
        }
      }
    }
  }
}

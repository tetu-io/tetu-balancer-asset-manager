// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "../third_party/balancer/IAssetManager.sol";
import "../third_party/balancer/IBVault.sol";
import "../interfaces/IAssetManagerBase.sol";
import "./interfaces/IRelayer.sol";


contract MockReentrantAssetManager is IAssetManagerBase {
  address public underlying;
  InvestmentConfig private _config;

  constructor(
    address,
    address,
    address _underlying,
    address,
    address
  ){
    underlying = _underlying;
  }
  function initialize(bytes32) external override {}

  function setConfig(bytes32, bytes calldata) external override {}

  function getInvestmentConfig(bytes32) external view override returns (InvestmentConfig memory){
    return _config;
  }

  function getToken() external view override returns (IERC20){
    return IERC20(underlying);
  }


  function getAUM(bytes32) external pure override returns (uint256){
    return 42;
  }

  function getPoolBalances(bytes32) external pure override returns (uint256 poolCash, uint256 poolManaged){
    return (1, 2);
  }

  function maxInvestableBalance(bytes32) external pure override returns (int256){
    return 42;
  }

  function updateBalanceOfPool(bytes32) external override {

  }

  function shouldRebalance(uint256, uint256) external pure override returns (bool){
    return true;
  }

  function rebalance(bytes32 poolId, bool) external override {
    IAsset[] memory _assets = new IAsset[](2);
    _assets[0] = IAsset(underlying);
    uint256[] memory _amounts = new uint256[](2);
    // reentrancy call
    IBVault.JoinPoolRequest memory request = IBVault.JoinPoolRequest({
      assets : _assets,
      maxAmountsIn : _amounts,
      userData : "",
      fromInternalBalance : false
    });
    IRelayer(msg.sender).joinPool(poolId, address(0), request);
  }

  function capitalOut(bytes32, uint256) external override {}

  function claimRewards() external override {}
}

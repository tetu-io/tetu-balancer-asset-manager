pragma solidity 0.8.4;

interface IVaultAuthorizer {
  function grantPermissions(
    bytes32[] memory actionIds,
    address account,
    address[] memory where
  ) external;

  function grantRole(bytes32 role, address account) external;
}

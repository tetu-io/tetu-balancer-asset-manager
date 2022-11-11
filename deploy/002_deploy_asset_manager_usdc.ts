import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, balancerVault, tetuVaultUSDC, usdcToken} = await getNamedAccounts();

  await deploy('TetuVaultAM_ST_USDC', {
    contract: 'TetuVaultAssetManager',
    from: deployer,
    args: [balancerVault, tetuVaultUSDC, usdcToken],
    log: true,
  });
};
export default func;
func.tags = ['TetuVaultAM_ST_USDC'];

import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, balancerVault} = await getNamedAccounts();

  await deploy('Relayer', {
    from: deployer,
    args: [balancerVault],
    log: true,
  });
};
export default func;
func.tags = ['Relayer'];

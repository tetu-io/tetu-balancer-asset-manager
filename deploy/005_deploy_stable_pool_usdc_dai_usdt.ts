import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async function(hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer, balancerVault, usdcToken, daiToken, usdtToken } = await getNamedAccounts()

  const poolName = "TetuStablePoolAM_USDC_DAI_USDT"
  const poolSymbol = "TETUSTAM"
  const poolTokens = [usdcToken, daiToken, usdtToken]
  const ampParam = 500
  const swapFee = 3000000000000000 // 0.3%

  const pauseWindowDuration = 0
  const bufferPeriodDuration = 0
  const owner = deployer

  const relayer = (await deployments.get('Relayer')).address
  const usdcAM = (await deployments.get('TetuVaultAM_ST_USDC')).address
  const daiAM = (await deployments.get('TetuVaultAM_ST_DAI')).address
  const usdtAM = (await deployments.get('TetuVaultAM_ST_USDT')).address
  const assetManagers = [usdcAM, daiAM, usdtAM]

  await deploy("TetuStablePoolAM_USDC_DAI_USDT", {
    contract: "TetuRelayedStablePool",
    from: deployer,
    args: [
      balancerVault,
      poolName,
      poolSymbol,
      poolTokens,
      ampParam,
      swapFee,
      pauseWindowDuration,
      bufferPeriodDuration,
      owner,
      relayer,
      assetManagers
    ],
    log: true
  })
}
export default func
func.tags = ["TetuStablePoolAM_USDC_DAI_USDT"]

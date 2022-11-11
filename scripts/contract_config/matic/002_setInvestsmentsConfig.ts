import { ethers } from "hardhat"
import { Misc } from "../../../test/utils/Misc"
import { BigNumber } from "ethers"

async function main() {
  const hre = require("hardhat")
  const { deployments, getNamedAccounts } = hre
  const { usdcToken, daiToken, usdtToken } = await getNamedAccounts()


  const poolAddress = (await deployments.get("TetuStablePoolAM_USDC_DAI_USDT")).address
  const pool = await ethers.getContractAt("TetuRelayedStablePool", poolAddress)

  const poolTokens = [usdcToken, daiToken, usdtToken]

  const targetPercentage = BigNumber.from(6).mul(BigNumber.from(10).pow(17))
  const upperCriticalPercentage = BigNumber.from(7).mul(BigNumber.from(10).pow(17))
  const lowerCriticalPercentage = BigNumber.from(4).mul(BigNumber.from(10).pow(17))

  const config = {
    targetPercentage: targetPercentage,
    upperCriticalPercentage: upperCriticalPercentage,
    lowerCriticalPercentage: lowerCriticalPercentage
  }

  for (const poolToken of poolTokens) {
    await pool.setAssetManagerPoolConfig(poolToken, Misc.encodeInvestmentConfig(config))
    console.log(`Config for ${poolToken} is initialized`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

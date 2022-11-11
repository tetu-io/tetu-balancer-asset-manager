import { ethers } from 'hardhat';

async function main() {
  const hre = require("hardhat");
  const { deployments } = hre

  const usdcAM = (await deployments.get('TetuVaultAM_ST_USDC')).address
  const daiAM = (await deployments.get('TetuVaultAM_ST_DAI')).address
  const usdtAM = (await deployments.get('TetuVaultAM_ST_USDT')).address

  const poolAddress = (await deployments.get('TetuStablePoolAM_USDC_DAI_USDT')).address
  const pool = await ethers.getContractAt('TetuRelayedStablePool', poolAddress);
  const poolId = await pool.getPoolId()
  console.log(poolId)

  const assetManagers = [usdcAM, daiAM, usdtAM]
  for (const amAddress of assetManagers) {
    console.log(`AM: ${amAddress} initializing...`)
    let am = await ethers.getContractAt('TetuVaultAssetManager', amAddress);
    await am.initialize(poolId)
    console.log(`AM: ${am.address} is initialized`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

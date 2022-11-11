import { ethers } from "hardhat"

async function main() {
  const hre = require("hardhat")
  const { deployments, getNamedAccounts } = hre
  const { deployer, balancerVault } = await getNamedAccounts();
  const bVault = await ethers.getContractAt("IVault", balancerVault)
  const relayer = (await deployments.get('Relayer')).address
  await bVault.setRelayerApproval(deployer, relayer, true)
  console.log("done!")
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

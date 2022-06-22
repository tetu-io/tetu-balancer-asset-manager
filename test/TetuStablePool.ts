import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { IBVault, MockERC20, TetuStablePool } from "../typechain"
import { BigNumber } from "ethers"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuStablePool tests", function () {
  let deployer: SignerWithAddress
  let relayer: SignerWithAddress
  let stablePool: TetuStablePool
  let mockUsdc: MockERC20
  let mockDai: MockERC20
  let poolId: string
  let balancerVault: IBVault

  const balancerVaultAddress = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"

  const ampParam = 500
  const swapFee = "3000000000000000"

  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"
  const largeApproval = "100000000000000000000000000000000"

  beforeEach(async function () {
    ;[deployer, relayer] = await ethers.getSigners()
    const USDC = await ethers.getContractFactory("MockERC20")
    mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 6)
    await mockUsdc.mint(deployer.address, BigNumber.from(largeApproval))

    const DAI = await ethers.getContractFactory("MockERC20")
    mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)
    await mockDai.mint(deployer.address, BigNumber.from(largeApproval))

    const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
    stablePool = (await TetuStablePoolFact.deploy(
      balancerVaultAddress,
      poolName,
      poolSymbol,
      [mockUsdc.address, mockDai.address],
      ampParam,
      swapFee,
      "0",
      "0",
      deployer.address,
      relayer.address
    )) as TetuStablePool

    poolId = await stablePool.getPoolId()

    balancerVault = await ethers.getContractAt("IBVault", balancerVaultAddress)
  })

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await stablePool.name()).is.eq(poolName)
      expect(await stablePool.symbol()).is.eq(poolSymbol)
      expect(await stablePool.getSwapFeePercentage()).is.eq(swapFee)
    })

    it("Only relayer should be able to join", async function () {
      const tokens = [mockUsdc.address, mockDai.address]
      const initialBalances = [BigNumber.from(100), BigNumber.from(100)]
      await mockUsdc.approve(balancerVault.address, initialBalances[0])
      await mockDai.approve(balancerVault.address, initialBalances[1])
      const JOIN_KIND_INIT = 0
      const initUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [JOIN_KIND_INIT, initialBalances]
      )
      const joinPoolRequest = {
        assets: tokens,
        maxAmountsIn: initialBalances,
        userData: initUserData,
        fromInternalBalance: false
      }
      await expect(balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest)).is.rejectedWith(
        "Only relayer can join pool"
      )
    })
  })
})

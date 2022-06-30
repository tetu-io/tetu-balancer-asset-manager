import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { IBVault, IVaultAuthorizer, MockERC20, RebalancingRelayer, TetuRelayedStablePool } from "../typechain"
import { BigNumber } from "ethers"
import { Misc } from "./utils/Misc"

const hre = require("hardhat")

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuStablePool tests", function () {
  let deployer: SignerWithAddress
  let relayer: RebalancingRelayer
  let user: SignerWithAddress
  let stablePool: TetuRelayedStablePool
  let mockUsdc: MockERC20
  let mockDai: MockERC20
  let poolId: string
  let balancerVault: IBVault

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"

  before(async function () {
    ;[deployer, user] = await ethers.getSigners()
    const USDC = await ethers.getContractFactory("MockERC20")
    mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 6)
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))

    const DAI = await ethers.getContractFactory("MockERC20")
    mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)
    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))

    const RelayerFact = await ethers.getContractFactory("RebalancingRelayer")
    relayer = await RelayerFact.deploy(Misc.balancerVaultAddress)
  })

  beforeEach(async function () {
    const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
    stablePool = (await TetuStablePoolFact.deploy(
      Misc.balancerVaultAddress,
      poolName,
      poolSymbol,
      [mockUsdc.address, mockDai.address],
      ampParam,
      swapFee,
      "0",
      "0",
      deployer.address,
      relayer.address,
      [ethers.constants.AddressZero, ethers.constants.AddressZero]
    )) as TetuRelayedStablePool

    poolId = await stablePool.getPoolId()

    balancerVault = await ethers.getContractAt("IBVault", Misc.balancerVaultAddress)
    const authorizer = (await ethers.getContractAt(
      "IVaultAuthorizer",
      Misc.balancerVaultAuthorizerAddress
    )) as IVaultAuthorizer

    const actionJoin = await Misc.actionId(balancerVault, "joinPool")
    const actionExit = await Misc.actionId(balancerVault, "exitPool")

    await authorizer
      .connect(await Misc.impersonate(Misc.balancerVaultAdminAddress))
      .grantRole(actionJoin, relayer.address)
    await authorizer
      .connect(await Misc.impersonate(Misc.balancerVaultAdminAddress))
      .grantRole(actionExit, relayer.address)

    await balancerVault.connect(user).setRelayerApproval(user.address, relayer.address, true)
  })

  const initPool = async (tokens: MockERC20[]) => {
    const initialBalances = [BigNumber.from(100), BigNumber.from(100)]
    await tokens[0].approve(balancerVault.address, initialBalances[0])
    await tokens[1].approve(balancerVault.address, initialBalances[1])
    const JOIN_KIND_INIT = 0
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]"],
      [JOIN_KIND_INIT, initialBalances]
    )
    const joinPoolRequest = {
      assets: [tokens[0].address, tokens[1].address],
      maxAmountsIn: initialBalances,
      userData: initUserData,
      fromInternalBalance: false
    }
    await balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest)
  }

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await stablePool.name()).is.eq(poolName)
      expect(await stablePool.symbol()).is.eq(poolSymbol)
      expect(await stablePool.getSwapFeePercentage()).is.eq(swapFee)
    })

    it("Owner can initialize pool", async function () {
      await initPool([mockUsdc, mockDai])
      const tokenInfo = await balancerVault.getPoolTokenInfo(poolId, mockUsdc.address)
      expect(tokenInfo[0]).is.eq(100)
      expect(tokenInfo[1]).is.eq(0)
    })

    it("User should be able to join/exit via Relayer", async function () {
      await initPool([mockUsdc, mockDai])
      const tokens = [mockUsdc.address, mockDai.address]
      const initialBalances = [BigNumber.from(100), BigNumber.from(100)]

      await mockUsdc.connect(user).approve(balancerVault.address, initialBalances[0])
      await mockDai.connect(user).approve(balancerVault.address, initialBalances[1])

      const JOIN_KIND_INIT = 1
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
      await relayer.connect(user).joinPool(poolId, user.address, joinPoolRequest)
      const tokenInfo1 = await balancerVault.getPoolTokenInfo(poolId, mockUsdc.address)
      const expectedToken0Balance = 200
      expect(tokenInfo1[0]).is.eq(expectedToken0Balance)
      expect(tokenInfo1[1]).is.eq(0)

      const bptBalance = await stablePool.balanceOf(user.address)
      expect(bptBalance).is.gt(0)

      const exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [0, bptBalance.div(2), 0]
      )

      await relayer.connect(user).exitPool(
        poolId,
        user.address,
        {
          assets: tokens,
          minAmountsOut: Array(tokens.length).fill(0),
          userData: exitUserData,
          toInternalBalance: false
        },
        [0, 0]
      )
      const tokenInfo2 = await balancerVault.getPoolTokenInfo(poolId, mockUsdc.address)
      expect(tokenInfo2[0]).is.lt(expectedToken0Balance)
    })

    it("Only Relayer should be able to join", async function () {
      await initPool([mockUsdc, mockDai])
      const tokens = [mockUsdc.address, mockDai.address]
      const initialBalances = [BigNumber.from(100), BigNumber.from(100)]

      await mockUsdc.connect(user).approve(balancerVault.address, initialBalances[0])
      await mockDai.connect(user).approve(balancerVault.address, initialBalances[1])

      const JOIN_KIND_INIT = 1
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
      await expect(
        balancerVault.connect(user).joinPool(poolId, user.address, user.address, joinPoolRequest)
      ).is.rejectedWith("Only relayer can join pool")
    })

    it("Only Relayer should be able to exit", async function () {
      await initPool([mockUsdc, mockDai])
      const tokens = [mockUsdc.address, mockDai.address]
      const exitUserData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [0, 10, 0])

      await expect(
        balancerVault.connect(user).exitPool(poolId, user.address, user.address, {
          assets: tokens,
          minAmountsOut: Array(tokens.length).fill(0),
          userData: exitUserData,
          toInternalBalance: false
        })
      ).is.rejectedWith("Only relayer can exit pool")
    })

    it("Pool should return relayer address", async function () {
      expect(await stablePool.getRelayer()).is.eq(relayer.address)
    })
  })
})

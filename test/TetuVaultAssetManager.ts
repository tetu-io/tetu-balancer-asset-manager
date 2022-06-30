import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import {
  IBVault,
  IVaultAuthorizer,
  MockERC20,
  MockTetuVaultV2,
  RebalancingRelayer,
  TetuRelayedStablePool,
  TetuVaultAssetManager
} from "../typechain"
import { Misc } from "./utils/Misc"
import { BigNumber } from "ethers"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuVaultAssetManager tests", function () {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let relayer: RebalancingRelayer
  let rewardCollector: SignerWithAddress
  let assetManager: TetuVaultAssetManager
  let tetuVault: MockTetuVaultV2
  let stablePool: TetuRelayedStablePool
  let poolId: string
  let mockUsdc: MockERC20
  let mockDai: MockERC20
  let balancerVault: IBVault

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"

  // const underlyingAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

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

  before(async function () {
    ;[deployer, user, rewardCollector] = await ethers.getSigners()
    const VaultFactory = await ethers.getContractFactory("MockTetuVaultV2")
    const USDC = await ethers.getContractFactory("MockERC20")
    mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 6)
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))

    tetuVault = await VaultFactory.deploy(mockUsdc.address, "TetuUSDC", "TetuUSDC", 18)

    const DAI = await ethers.getContractFactory("MockERC20")
    mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)
    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))

    const RelayerFact = await ethers.getContractFactory("RebalancingRelayer")
    relayer = await RelayerFact.deploy(Misc.balancerVaultAddress)
  })

  beforeEach(async function () {
    const TetuVaultAssetManagerFact = await ethers.getContractFactory("TetuVaultAssetManager")
    assetManager = (await TetuVaultAssetManagerFact.deploy(
      Misc.balancerVaultAddress,
      tetuVault.address,
      mockUsdc.address,
      rewardCollector.address
    )) as TetuVaultAssetManager

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
      [assetManager.address, ethers.constants.AddressZero]
    )) as TetuRelayedStablePool

    poolId = await stablePool.getPoolId()

    await assetManager.initialize(poolId)

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

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await assetManager.underlying()).is.eq(mockUsdc.address)
      expect(await assetManager.tetuVault()).is.eq(tetuVault.address)
      expect(await assetManager.rewardCollector()).is.eq(rewardCollector.address)
    })
  })

  describe("Invest", function () {
    it("AM should be able to invest funds to the TetuVault", async function () {
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
      await assetManager.rebalance(poolId, false)
    })
  })
})

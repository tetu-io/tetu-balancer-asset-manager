import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import {
  Authorizer,
  MockERC20,
  MockTetuVaultV2,
  RebalancingRelayer,
  TetuRelayedStablePool,
  TetuVaultAssetManager,
  Vault
} from "../typechain"
import { Misc } from "./utils/Misc"
import { BigNumber } from "ethers"
import { BigNumberish } from "ethers/lib/ethers"

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
  let mockWeth: MockERC20
  let balancerVault: Vault

  const usdcInitialBalance = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
  const daiInitialBalance = BigNumber.from(100).mul(BigNumber.from(10).pow(18))

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"

  // const underlyingAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

  const initPool = async (tokens: MockERC20[]) => {
    const initialBalances = [usdcInitialBalance, daiInitialBalance]
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

  const deposit = async (depositor: SignerWithAddress, tokens: MockERC20[], depositAmounts: BigNumberish[]) => {
    let tokenAddresses = []
    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].connect(depositor).approve(balancerVault.address, depositAmounts[i])
      tokenAddresses.push(tokens[i].address)
    }

    const JOIN_KIND_DEPOSIT = 1
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]"],
      [JOIN_KIND_DEPOSIT, depositAmounts]
    )
    const joinPoolRequest = {
      assets: tokenAddresses,
      maxAmountsIn: depositAmounts,
      userData: initUserData,
      fromInternalBalance: false
    }
    await relayer.connect(depositor).joinPool(poolId, depositor.address, joinPoolRequest)
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

    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18)

    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))
  })

  beforeEach(async function () {
    const AuthFact = await ethers.getContractFactory("Authorizer")
    const authorizer = (await AuthFact.deploy(deployer.address)) as Authorizer
    const BalVaultFactory = await ethers.getContractFactory("Vault")
    balancerVault = (await BalVaultFactory.deploy(authorizer.address, mockWeth.address, 0, 0)) as Vault
    const RelayerFact = await ethers.getContractFactory("RebalancingRelayer")
    relayer = await RelayerFact.deploy(balancerVault.address)

    const TetuVaultAssetManagerFact = await ethers.getContractFactory("TetuVaultAssetManager")
    assetManager = (await TetuVaultAssetManagerFact.deploy(
      balancerVault.address,
      tetuVault.address,
      mockUsdc.address,
      rewardCollector.address
    )) as TetuVaultAssetManager

    const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
    stablePool = (await TetuStablePoolFact.deploy(
      balancerVault.address,
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

    const config = {
      targetPercentage: BigNumber.from(5).mul(BigNumber.from(10).pow(17)),
      upperCriticalPercentage: BigNumber.from(6).mul(BigNumber.from(10).pow(17)),
      lowerCriticalPercentage: BigNumber.from(4).mul(BigNumber.from(10).pow(17))
    }

    await stablePool.setAssetManagerPoolConfig(mockUsdc.address, Misc.encodeInvestmentConfig(config))
    const investmentConfig = await assetManager.getInvestmentConfig(poolId)
    expect(investmentConfig[0]).is.equal("500000000000000000")
    expect(investmentConfig[1]).is.equal("600000000000000000")
    expect(investmentConfig[2]).is.equal("400000000000000000")

    // todo: real vault vs deployed
    // balancerVault = await ethers.getContractAt("IBVault", Misc.balancerVaultAddress)

    // const authorizer = (await ethers.getContractAt(
    //   "IVaultAuthorizer",
    //   Misc.balancerVaultAuthorizerAddress
    // )) as IVaultAuthorizer

    // await authorizer
    //   .connect(await Misc.impersonate(Misc.balancerVaultAdminAddress))
    //   .grantRole(actionJoin, relayer.address)
    // await authorizer
    //   .connect(await Misc.impersonate(Misc.balancerVaultAdminAddress))
    //   .grantRole(actionExit, relayer.address)
    //

    const actionJoin = await Misc.actionId(balancerVault, "joinPool")
    const actionExit = await Misc.actionId(balancerVault, "exitPool")

    await authorizer.grantRole(actionJoin, relayer.address)
    await authorizer.grantRole(actionExit, relayer.address)

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
      const tokens = [mockUsdc, mockDai]
      await initPool(tokens)

      const usdcToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      const daiToDeposit = BigNumber.from(0)
      await deposit(user, tokens, [usdcToDeposit, daiToDeposit])

      expect(await stablePool.balanceOf(user.address)).is.not.equal(0)

      // deposited 101 USDC
      await assetManager.rebalance(poolId, false)
      const balances = await balancerVault.getPoolTokenInfo(poolId, mockUsdc.address)
      // AM should invest 50% 50.5 USDC
      expect(balances[0]).is.equal(usdcInitialBalance.add(usdcToDeposit).div(2))
      expect(balances[1]).is.equal(usdcInitialBalance.add(usdcToDeposit).div(2))

      // 50.5 USDC should be in tetuVault
      expect(await mockUsdc.balanceOf(tetuVault.address)).is.equal(usdcInitialBalance.add(usdcToDeposit).div(2))
    })
  })
})

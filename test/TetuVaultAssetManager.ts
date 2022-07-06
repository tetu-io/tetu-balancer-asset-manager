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
  let mockWeth: MockERC20
  let balancerVault: Vault
  const targetPercentage = BigNumber.from(8).mul(BigNumber.from(10).pow(17))
  const upperCriticalPercentage = BigNumber.from(9).mul(BigNumber.from(10).pow(17))
  const lowerCriticalPercentage = BigNumber.from(1).mul(BigNumber.from(10).pow(17))

  const t0InitialBalance = BigNumber.from(100).mul(BigNumber.from(10).pow(18))
  const daiInitialBalance = BigNumber.from(100).mul(BigNumber.from(10).pow(18))

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"
  let tokens: MockERC20[]
  // const underlyingAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

  const initPool = async (tokens: MockERC20[]) => {
    const initialBalances = [t0InitialBalance, daiInitialBalance]
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
    const USDC = await ethers.getContractFactory("MockERC20")
    const mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 6)
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))
    const DAI = await ethers.getContractFactory("MockERC20")
    const mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)

    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18)

    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))
    tokens = Misc.sortTokens([mockUsdc, mockDai])
  })

  beforeEach(async function () {
    const VaultFactory = await ethers.getContractFactory("MockTetuVaultV2")
    tetuVault = await VaultFactory.deploy(tokens[0].address, "TetuT0", "TetuT0", 18)

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
      tokens[0].address,
      rewardCollector.address
    )) as TetuVaultAssetManager

    const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
    stablePool = (await TetuStablePoolFact.deploy(
      balancerVault.address,
      poolName,
      poolSymbol,
      [tokens[0].address, tokens[1].address],
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
      targetPercentage: targetPercentage,
      upperCriticalPercentage: upperCriticalPercentage,
      lowerCriticalPercentage: lowerCriticalPercentage
    }

    await stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
    const investmentConfig = await assetManager.getInvestmentConfig(poolId)
    expect(investmentConfig[0]).is.equal(targetPercentage)
    expect(investmentConfig[1]).is.equal(upperCriticalPercentage)
    expect(investmentConfig[2]).is.equal(lowerCriticalPercentage)

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
      expect(await assetManager.underlying()).is.eq(tokens[0].address)
      expect(await assetManager.tetuVault()).is.eq(tetuVault.address)
      expect(await assetManager.rewardCollector()).is.eq(rewardCollector.address)
      expect(await assetManager.maxInvestableBalance(poolId)).is.eq(0)
    })

    it("Max investable balance tests", async function () {
      await initPool(tokens)
      const expectedToBeInvested = t0InitialBalance.mul(targetPercentage).div(BigNumber.from(10).pow(18))
      expect(await assetManager.maxInvestableBalance(poolId)).is.eq(expectedToBeInvested)
      await assetManager.rebalance(poolId, false)
      expect(await assetManager.maxInvestableBalance(poolId)).is.eq(0)
      const config = {
        targetPercentage: targetPercentage.div(2),
        upperCriticalPercentage: upperCriticalPercentage,
        lowerCriticalPercentage: lowerCriticalPercentage
      }
      await stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
      expect(await assetManager.maxInvestableBalance(poolId)).is.eq(expectedToBeInvested.div(2).mul(-1))
    })
  })

  describe("Invest", function () {
    it("AM should be able to invest funds to the TetuVault", async function () {
      await initPool(tokens)

      const t0ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      await deposit(user, tokens, [t0ToDeposit, t1ToDeposit])

      expect(await stablePool.balanceOf(user.address)).is.not.equal(0)

      await assetManager.rebalance(poolId, false)
      const balances = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
      const expectedToBeInVault = t0InitialBalance
        .add(t0ToDeposit)
        .mul(targetPercentage)
        .div(BigNumber.from(10).pow(18))

      const expectedToBeInvested = t0InitialBalance.add(t0ToDeposit).sub(expectedToBeInVault)
      expect(balances[0]).is.equal(expectedToBeInvested)
      expect(balances[1]).is.equal(expectedToBeInVault)
      expect(await tokens[0].balanceOf(tetuVault.address)).is.equal(expectedToBeInVault)
    })
  })

  describe("Withdraw", function () {
    it("AM should be able to handle exit from pool when funds in vault is not enough", async function () {
      await initPool(tokens)
      const userT0BalanceBefore = await tokens[0].balanceOf(user.address)
      const t0ToDeposit = BigNumber.from(5).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(5).mul(BigNumber.from(10).pow(18))
      await deposit(user, tokens, [t0ToDeposit, t1ToDeposit])

      expect(await stablePool.balanceOf(user.address)).is.not.equal(0)

      await assetManager.rebalance(poolId, false)

      const bptBalanceBefore = await stablePool.balanceOf(user.address)

      const EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0
      const exitTokenIndex = 0
      const exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptBalanceBefore, exitTokenIndex]
      )

      await relayer.connect(user).exitPool(
        poolId,
        user.address,
        {
          assets: [tokens[0].address, tokens[1].address],
          minAmountsOut: Array(tokens.length).fill(0),
          userData: exitUserData,
          toInternalBalance: false
        },
        [t0ToDeposit, 0]
      )
      const bptBalanceAfter = await stablePool.balanceOf(user.address)
      const userT0BalanceAfter = await tokens[0].balanceOf(user.address)
      expect(userT0BalanceAfter).is.gt(userT0BalanceBefore)
      expect(bptBalanceAfter).is.equal(0)
    })
  })
})

import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {ethers} from "hardhat"
import {
  Authorizer,
  ITetuAssetManager,
  MockERC20,
  MockGague,
  MockTetuVaultV2,
  Relayer,
  TetuRelayedStablePool,
  ERC4626AssetManager,
  Vault
} from "../typechain"
import {Misc} from "./utils/Misc"
import {BigNumber} from "ethers"
import {BigNumberish} from "ethers/lib/ethers"

const {expect} = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("ERC4626AssetManager tests", function () {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let relayer: Relayer
  let rewardCollector: SignerWithAddress
  let assetManager: ITetuAssetManager
  let tetuVault: MockTetuVaultV2
  let stablePool: TetuRelayedStablePool
  let poolId: string
  let mockWeth: MockERC20
  let mockRewardToken: MockERC20
  let balancerVault: Vault
  let gague: MockGague
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

  const setupTestCase = async (
    isReturnShares = true,
    isReturnTokens = true,
    isGage = true,
    gagueReturnAmount = BigNumber.from("100"),
    assetManagerImplementation = "ERC4626AssetManager"
  ) => {
    const VaultFactory = await ethers.getContractFactory("MockTetuVaultV2")
    tetuVault = await VaultFactory.deploy(tokens[0].address, "TetuT0", "TetuT0", 18, isReturnShares, isReturnTokens)

    const GagueFact = await ethers.getContractFactory("MockGague")
    gague = await GagueFact.deploy([mockRewardToken.address], [gagueReturnAmount], tetuVault.address)
    await mockRewardToken.mint(gague.address, BigNumber.from("150"))

    const AuthFact = await ethers.getContractFactory("Authorizer")
    const authorizer = (await AuthFact.deploy(deployer.address)) as Authorizer
    const BalVaultFactory = await ethers.getContractFactory("Vault")
    balancerVault = (await BalVaultFactory.deploy(authorizer.address, mockWeth.address, 0, 0)) as Vault
    const RelayerFact = await ethers.getContractFactory("Relayer")
    relayer = await RelayerFact.deploy(balancerVault.address)

    const ERC4626AssetManagerFact = await ethers.getContractFactory(assetManagerImplementation)
    assetManager = (await ERC4626AssetManagerFact.deploy(
      balancerVault.address,
      tetuVault.address,
      tokens[0].address,
      rewardCollector.address,
      isGage ? gague.address : ethers.constants.AddressZero
    )) as ITetuAssetManager

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

    const actionJoin = await Misc.actionId(balancerVault, "joinPool")
    const actionExit = await Misc.actionId(balancerVault, "exitPool")

    await authorizer.grantRole(actionJoin, relayer.address)
    await authorizer.grantRole(actionExit, relayer.address)

    await balancerVault.connect(user).setRelayerApproval(user.address, relayer.address, true)
  }

  before(async function () {
    ;[deployer, user, rewardCollector] = await ethers.getSigners()
    const USDC = await ethers.getContractFactory("MockERC20")
    const mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 18)
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))
    const DAI = await ethers.getContractFactory("MockERC20")
    const mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)

    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18)
    const RT = await ethers.getContractFactory("MockERC20")
    mockRewardToken = await RT.deploy("RT", "RT", 18)

    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))
    tokens = Misc.sortTokens([mockUsdc, mockDai])
  })

  beforeEach(async function () {
    await setupTestCase()
  })

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await assetManager.getToken()).is.eq(tokens[0].address)
      expect(await assetManager.maxInvestableBalance(poolId)).is.eq(0)
    })

    it("Investment config", async function () {
      const investmentConfig = await assetManager.getInvestmentConfig(poolId)
      expect(investmentConfig[0]).is.equal(targetPercentage)
      expect(investmentConfig[1]).is.equal(upperCriticalPercentage)
      expect(investmentConfig[2]).is.equal(lowerCriticalPercentage)
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

    it("Only rebalancer can call capitalOut from AM", async function () {
      await expect(assetManager.capitalOut(poolId, "100")).is.rejectedWith("Only callable by authorized rebalancer")
    })

    it("Only real poolID allowed for maxInvestableBalance", async function () {
      const nonExistingPoolId = "0xc11111111111111111175d088814bf32b1f5d7c9000200000000000000000000"
      await expect(assetManager.updateBalanceOfPool(nonExistingPoolId)).is.rejectedWith(
        "AssetManager called with incorrect poolId"
      )
    })

    it("Initialize can be call only once", async function () {
      await expect(assetManager.initialize(poolId)).is.rejectedWith("Already initialised")
    })

    it("poolID can't be empty during the initialization", async function () {
      const ERC4626AssetManagerFact = await ethers.getContractFactory("ERC4626AssetManager")
      const assetManager = (await ERC4626AssetManagerFact.deploy(
        balancerVault.address,
        tetuVault.address,
        tokens[0].address,
        rewardCollector.address,
        gague.address
      )) as ERC4626AssetManager
      const nonExistingPoolId = "0x0000000000000000000000000000000000000000000000000000000000000000"
      await expect(assetManager.initialize(nonExistingPoolId)).is.rejectedWith("Pool id cannot be empty")
    })

    it("underlying can't be empty during the initialization", async function () {
      const ERC4626AssetManagerFact = await ethers.getContractFactory("ERC4626AssetManager")
      await expect(
        ERC4626AssetManagerFact.deploy(
          balancerVault.address,
          tetuVault.address,
          ethers.constants.AddressZero,
          rewardCollector.address,
          gague.address
        )
      ).is.rejectedWith("zero token")
    })

    it("Balancer vault can't be empty during the initialization", async function () {
      const ERC4626AssetManagerFact = await ethers.getContractFactory("ERC4626AssetManager")
      await expect(
        ERC4626AssetManagerFact.deploy(
          ethers.constants.AddressZero,
          tetuVault.address,
          tokens[0].address,
          rewardCollector.address,
          gague.address
        )
      ).is.rejectedWith("zero balancer vault")
    })

    it("Tetu vault can't be empty during the initialization", async function () {
      const ERC4626AssetManagerFact = await ethers.getContractFactory("ERC4626AssetManager")
      await expect(
        ERC4626AssetManagerFact.deploy(
          balancerVault.address,
          ethers.constants.AddressZero,
          tokens[0].address,
          rewardCollector.address,
          gague.address
        )
      ).is.rejectedWith("zero ERC4626 vault")
    })

    it("rewardCollector can't be empty during the initialization", async function () {
      const ERC4626AssetManagerFact = await ethers.getContractFactory("ERC4626AssetManager")
      await expect(
        ERC4626AssetManagerFact.deploy(
          balancerVault.address,
          tetuVault.address,
          tokens[0].address,
          ethers.constants.AddressZero,
          gague.address
        )
      ).is.rejectedWith("zero rewardCollector")
    })

    it("AM should not invest in tetu vault if vault not returns receipt tokens", async function () {
      await setupTestCase(false, true)
      await initPool(tokens)
      await expect(assetManager.rebalance(poolId, false)).is.rejectedWith("AM should receive shares after the deposit")
    })
    it("AM should not withdraw from tetu vault if vault not returns tokens", async function () {
      await setupTestCase(true, false)
      await initPool(tokens)
      await assetManager.rebalance(poolId, false)

      const config = {
        targetPercentage: BigNumber.from(0),
        upperCriticalPercentage: BigNumber.from(0),
        lowerCriticalPercentage: BigNumber.from(0)
      }
      await stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
      await expect(assetManager.rebalance(poolId, false)).is.rejectedWith(
        "AM should receive requested tokens after the withdraw"
      )
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
      const expectedToBeInTetuVault = t0InitialBalance
        .add(t0ToDeposit)
        .mul(targetPercentage)
        .div(BigNumber.from(10).pow(18))

      const expectedToBeInBalVault = t0InitialBalance.add(t0ToDeposit).sub(expectedToBeInTetuVault)

      expect(await assetManager.getAUM(poolId)).is.eq(expectedToBeInTetuVault)

      let poolCash
      let poolManaged
      ;[poolCash, poolManaged] = await assetManager.getPoolBalances(poolId)
      expect(poolCash).is.eq(expectedToBeInBalVault)
      expect(poolManaged).is.eq(expectedToBeInTetuVault)

      expect(balances[0]).is.equal(expectedToBeInBalVault)
      expect(balances[1]).is.equal(expectedToBeInTetuVault)
      expect(await tokens[0].balanceOf(tetuVault.address)).is.equal(expectedToBeInTetuVault)
    })
  })

  describe("Rebalance", function () {
    it("AM should be able to force rebalance", async function () {
      await initPool(tokens)
      const expectedToBeControlledByAM = t0InitialBalance.mul(targetPercentage).div(BigNumber.from(10).pow(18))
      await assetManager.rebalance(poolId, false)
      expect(await assetManager.getAUM(poolId)).is.eq(expectedToBeControlledByAM)
      const t0ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      await deposit(user, tokens, [t0ToDeposit, t1ToDeposit])

      // this call should not change the AUM because deposit is in allowed range
      await assetManager.rebalance(poolId, false)
      expect(await assetManager.getAUM(poolId)).is.eq(expectedToBeControlledByAM)
      // but force should
      await assetManager.rebalance(poolId, true)

      const expectedToBeControlledByAMAfterDeposit = t0InitialBalance
        .add(t0ToDeposit)
        .mul(targetPercentage)
        .div(BigNumber.from(10).pow(18))
      expect(await assetManager.getAUM(poolId)).is.eq(expectedToBeControlledByAMAfterDeposit)
    })

    it("Force rebalance should work properly in no rebalance needed", async function () {
      await initPool(tokens)
      await assetManager.rebalance(poolId, false)
      let poolCash1
      let poolManaged1
      ;[poolCash1, poolManaged1] = await assetManager.getPoolBalances(poolId)

      await assetManager.rebalance(poolId, true)
      let poolCash2
      let poolManaged2
      ;[poolCash2, poolManaged2] = await assetManager.getPoolBalances(poolId)
      expect(poolCash1).is.eq(poolCash2)
      expect(poolManaged1).is.eq(poolManaged2)
    })

    it("AM should properly handle extra tokens", async function () {
      await initPool(tokens)
      const extraTokens = BigNumber.from(100)
      await tokens[0].transfer(assetManager.address, extraTokens)
      await assetManager.rebalance(poolId, false)
      expect(await tokens[0].balanceOf(assetManager.address)).is.eq(extraTokens)
    })

    it("Relayer should disallows reentrancy on join operation", async function () {
      await setupTestCase(true, true, true, BigNumber.from("100"), "MockReentrantAssetManager")
      await initPool(tokens)
      const t0ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(10).mul(BigNumber.from(10).pow(18))
      await expect(deposit(user, tokens, [t0ToDeposit, t1ToDeposit])).is.rejectedWith("Rebalancing relayer reentered")
    })
  })

  describe("Withdraw", function () {
    it("AM should be able to handle exit from pool when funds in vault is not enough", async function () {
      await initPool(tokens)
      const t0ToDeposit = BigNumber.from(30).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(30).mul(BigNumber.from(10).pow(18))
      await deposit(user, tokens, [t0ToDeposit, t1ToDeposit])

      expect(await stablePool.balanceOf(user.address)).is.not.equal(0)

      await assetManager.rebalance(poolId, false)

      let poolCash
      ;[poolCash] = await assetManager.getPoolBalances(poolId)

      const bptBalanceBefore = await stablePool.balanceOf(user.address)
      const token0BalBefore = await tokens[0].balanceOf(user.address)

      const token0ToWithdraw = poolCash.add(BigNumber.from(10))
      const BPT_IN_FOR_EXACT_TOKENS_OUT = 2
      const exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]", "uint256"],
        [BPT_IN_FOR_EXACT_TOKENS_OUT, [token0ToWithdraw, BigNumber.from(0)], bptBalanceBefore]
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
        [token0ToWithdraw, 0]
      )
      const token0BalAfter = await tokens[0].balanceOf(user.address)
      expect(token0BalAfter).is.eq(token0BalBefore.add(token0ToWithdraw))
    })

    it("Rebalancer should be able to return funds to the balancer vault onJoin", async function () {
      await initPool(tokens)
      await assetManager.rebalance(poolId, false)
      let poolManaged
      ;[, poolManaged] = await assetManager.getPoolBalances(poolId)
      expect(poolManaged).is.gt(0)

      const config = {
        targetPercentage: BigNumber.from(0),
        upperCriticalPercentage: BigNumber.from(0),
        lowerCriticalPercentage: BigNumber.from(0)
      }
      await stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))

      const t0ToDeposit = BigNumber.from(5).mul(BigNumber.from(10).pow(18))
      const t1ToDeposit = BigNumber.from(5).mul(BigNumber.from(10).pow(18))
      await deposit(user, tokens, [t0ToDeposit, t1ToDeposit])
      ;[, poolManaged] = await assetManager.getPoolBalances(poolId)
      expect(poolManaged).is.eq(0)
    })
  })

  describe("AM Config tests", function () {
    it("Only pool should be able to update config", async function () {
      const config = {
        targetPercentage: BigNumber.from(0),
        upperCriticalPercentage: BigNumber.from(0),
        lowerCriticalPercentage: BigNumber.from(0)
      }
      await expect(assetManager.setConfig(poolId, Misc.encodeInvestmentConfig(config))).is.rejectedWith(
        "Only callable by pool"
      )
    })

    it("upperCriticalPercentage could not be higher than 100%", async function () {
      const config = {
        targetPercentage: BigNumber.from(0),
        upperCriticalPercentage: BigNumber.from(10).pow(19),
        lowerCriticalPercentage: BigNumber.from(0)
      }
      await expect(
        stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
      ).is.rejectedWith("Upper critical level must be less than or equal to 100%")
    })

    it("targetPercentage could not be higher upperCriticalPercentage", async function () {
      const config = {
        targetPercentage: BigNumber.from(10).pow(17).add(1),
        upperCriticalPercentage: BigNumber.from(10).pow(17),
        lowerCriticalPercentage: BigNumber.from(0)
      }
      await expect(
        stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
      ).is.rejectedWith("Target must be less than or equal to upper critical level")
    })

    it("lowerCriticalPercentage could not be higher targetPercentage", async function () {
      const config = {
        targetPercentage: BigNumber.from(0),
        upperCriticalPercentage: BigNumber.from(10).pow(17),
        lowerCriticalPercentage: BigNumber.from(10).pow(17).add(1)
      }
      await expect(
        stablePool.setAssetManagerPoolConfig(tokens[0].address, Misc.encodeInvestmentConfig(config))
      ).is.rejectedWith("Lower critical level must be less than or equal to target")
    })
  })

  describe("Claim gague rewards", function () {
    it("Relayer should be able to claim rewards", async function () {
      const feeCollectorBalBefore = await mockRewardToken.balanceOf(rewardCollector.address)
      await relayer.claimAssetManagerRewards(poolId)
      const feeCollectorBalAfter = await mockRewardToken.balanceOf(rewardCollector.address)
      expect(feeCollectorBalAfter).is.gt(feeCollectorBalBefore)
      expect(feeCollectorBalAfter).is.eq(BigNumber.from(100))
    })

    it("Relayer should process claim transaction with empty gague", async function () {
      await setupTestCase(true, true, false)
      const feeCollectorBalBefore = await mockRewardToken.balanceOf(rewardCollector.address)
      await relayer.claimAssetManagerRewards(poolId)
      const feeCollectorBalAfter = await mockRewardToken.balanceOf(rewardCollector.address)
      expect(feeCollectorBalAfter).is.eq(feeCollectorBalBefore)
    })

    it("Relayer should process claim transaction when no gague rewards", async function () {
      await setupTestCase(true, true, true, BigNumber.from(0))
      const feeCollectorBalBefore = await mockRewardToken.balanceOf(rewardCollector.address)
      await relayer.claimAssetManagerRewards(poolId)
      const feeCollectorBalAfter = await mockRewardToken.balanceOf(rewardCollector.address)
      expect(feeCollectorBalAfter).is.eq(feeCollectorBalBefore)
    })
  })
})

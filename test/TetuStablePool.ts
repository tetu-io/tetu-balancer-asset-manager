import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers, network } from "hardhat"
import {
  Authorizer,
  MockERC20,
  ProtocolFeesCollector,
  TestTetuStablePool,
  Vault
} from "../typechain"
import { BigNumber } from "ethers"
import { bn, Misc, PoolSpecialization } from "./utils/Misc"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuStablePool tests", function () {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let stablePool: TestTetuStablePool
  let authorizer: Authorizer
  let poolId: string
  let balancerVault: Vault
  let tokens: MockERC20[]
  let mockWeth: MockERC20
  let defaultDepositAmounts = [
    BigNumber.from(30).mul(BigNumber.from(10).pow(18)),
    BigNumber.from(30).mul(BigNumber.from(10).pow(18))
  ]

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"
  const pauseWindowDuration = 90 * 24 * 3600
  const bufferPeriodDuration = 30 * 24 * 3600

  before(async function () {
    ;[deployer, user] = await ethers.getSigners()
    const USDC = await ethers.getContractFactory("MockERC20")
    const mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 18) as MockERC20
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))

    const DAI = await ethers.getContractFactory("MockERC20")
    const mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18) as MockERC20
    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))

    const T2 = await ethers.getContractFactory("MockERC20")
    const mockT2 = await T2.deploy("(PoS) T2 Stablecoin", "T2", 18) as MockERC20
    await mockT2.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockT2.mint(user.address, BigNumber.from(Misc.largeApproval))

    const T3 = await ethers.getContractFactory("MockERC20")
    const mockT3 = await T3.deploy("(PoS) T3 Stablecoin", "T3", 18) as MockERC20
    await mockT3.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockT3.mint(user.address, BigNumber.from(Misc.largeApproval))

    const T4 = await ethers.getContractFactory("MockERC20")
    const mockT4 = await T4.deploy("(PoS) T4 Stablecoin", "T4", 18) as MockERC20
    await mockT4.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockT4.mint(user.address, BigNumber.from(Misc.largeApproval))

    const T5 = await ethers.getContractFactory("MockERC20")
    const mockT5 = await T5.deploy("(PoS) T5 Stablecoin", "T5", 18) as MockERC20
    await mockT5.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockT5.mint(user.address, BigNumber.from(Misc.largeApproval))

    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18) as MockERC20
    tokens = Misc.sortTokens([mockUsdc, mockDai, mockT2, mockT3, mockT4, mockT5])
  })

  beforeEach(async function () {
    const AuthFact = await ethers.getContractFactory("Authorizer")
    authorizer = (await AuthFact.deploy(deployer.address)) as Authorizer

    const BalVaultFactory = await ethers.getContractFactory("Vault")
    balancerVault = (await BalVaultFactory.deploy(authorizer.address, mockWeth.address, 0, 0)) as Vault

    const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
    stablePool = (await TetuStablePoolFact.deploy(
      balancerVault.address,
      poolName,
      poolSymbol,
      [tokens[0].address, tokens[1].address],
      ampParam,
      swapFee,
      pauseWindowDuration,
      bufferPeriodDuration,
      deployer.address,
      [ethers.constants.AddressZero, ethers.constants.AddressZero]
    )) as TestTetuStablePool

    poolId = await stablePool.getPoolId()
  })

  const initPool = async (tokens: MockERC20[], tokenCount = 2, initialBalance = BigNumber.from(10).pow(18)) => {
    let initialBalances = []
    let tokenAddresses = []

    for (let i = 0; i < tokenCount; i++) {
      await tokens[i].approve(balancerVault.address, initialBalance)
      initialBalances.push(initialBalance)
      tokenAddresses.push(tokens[i].address)
    }

    const JOIN_KIND_INIT = 0
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256[]"],
      [JOIN_KIND_INIT, initialBalances]
    )
    const joinPoolRequest = {
      assets: tokenAddresses,
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
  })
  describe("creation", () => {
    context("when the creation succeeds", () => {
      it("sets the vault", async () => {
        expect(await stablePool.getVault()).to.equal(balancerVault.address)
      })

      it("uses general specialization", async () => {
        const [address, specialization] = await balancerVault.getPool(poolId)
        expect(address).to.equal(stablePool.address)
        expect(specialization).to.equal(PoolSpecialization.TwoTokenPool)
      })

      it("registers tokens in the vault", async () => {
        const { tokens, balances } = await balancerVault.getPoolTokens(poolId)
        expect(tokens).to.have.members(tokens)
        expect(balances[0]).is.eq(bn(0))
        expect(balances[1]).is.eq(bn(0))
      })

      it("starts with no BPT", async () => {
        expect(await stablePool.totalSupply()).to.be.equal(0)
      })

      it("sets the asset managers", async () => {
        const [, , , am0] = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
        const [, , , am1] = await balancerVault.getPoolTokenInfo(poolId, tokens[1].address)
        expect(am0).is.eq(ethers.constants.AddressZero)
        expect(am1).is.eq(ethers.constants.AddressZero)
      })

      it("sets amplification", async () => {
        const { value, isUpdating, precision } = await stablePool.getAmplificationParameter()
        expect(value).to.be.equal(BigNumber.from(ampParam).mul(precision))
        expect(isUpdating).to.be.false
      })

      it("sets swap fee", async () => {
        expect(await stablePool.getSwapFeePercentage()).to.equal(swapFee)
      })

      it("sets the name", async () => {
        expect(await stablePool.name()).to.equal(poolName)
      })

      it("sets the symbol", async () => {
        expect(await stablePool.symbol()).to.equal(poolSymbol)
      })

      it("sets the decimals", async () => {
        expect(await stablePool.decimals()).to.equal(18)
      })
    })

    context("when the creation fails", () => {
      it("reverts if the swap fee is too high", async () => {
        const badSwapFeePercentage = bn(10).pow(18).add(1)
        const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
        await expect(
          TetuStablePoolFact.deploy(
            balancerVault.address,
            poolName,
            poolSymbol,
            [tokens[0].address, tokens[1].address],
            ampParam,
            badSwapFeePercentage,
            "0",
            "0",
            deployer.address,
            [ethers.constants.AddressZero, ethers.constants.AddressZero]
          )
        ).is.revertedWith("BAL#202")
      })

      it("reverts if amplification coefficient is too high", async () => {
        const highAmp = bn(5001)

        const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
        await expect(
          TetuStablePoolFact.deploy(
            balancerVault.address,
            poolName,
            poolSymbol,
            [tokens[0].address, tokens[1].address],
            highAmp,
            swapFee,
            "0",
            "0",
            deployer.address,
            [ethers.constants.AddressZero, ethers.constants.AddressZero]
          )
        ).is.revertedWith("BAL#301")
      })

      it("reverts if amplification coefficient is too low", async () => {
        const lowAmp = bn(0)
        const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
        await expect(
          TetuStablePoolFact.deploy(
            balancerVault.address,
            poolName,
            poolSymbol,
            [tokens[0].address, tokens[1].address],
            lowAmp,
            swapFee,
            "0",
            "0",
            deployer.address,
            [ethers.constants.AddressZero, ethers.constants.AddressZero]
          )
        ).is.revertedWith("BAL#300")
      })

      it("initial last invariant", async () => {
        const result = await stablePool.getLastInvariant()
        expect(result[0]).is.eq(bn(0))
        expect(result[1]).is.eq(bn(0))
      })

      it("startAmplificationParameterUpdate", async () => {
        const timeTravel = 86400 * 2
        const newAMP = 600
        let date = new Date()
        date.setDate(date.getDate() + 1)

        await stablePool.startAmplificationParameterUpdate(newAMP, date.getTime())
        await stablePool.stopAmplificationParameterUpdate()
        await network.provider.send("evm_increaseTime", [timeTravel])
        await network.provider.send("evm_mine", [])
        const result = await stablePool.getAmplificationParameter()
        expect(result[0]).is.eq("500000")
        expect(result[1]).is.eq(false)
        expect(result[2]).is.eq("1000")
      })
    })
  })
  describe("onJoinPool", () => {
    it("fails if caller is not the vault", async () => {
      await expect(
        stablePool.connect(user).onJoinPool(poolId, user.address, user.address, [0], 0, 0, "0x")
      ).to.be.revertedWith("BAL#205")
    })

    it("fails if no user data", async () => {
      await initPool(tokens)
      await expect(
        balancerVault.joinPool(poolId, deployer.address, deployer.address, {
          assets: [tokens[0].address, tokens[1].address],
          maxAmountsIn: defaultDepositAmounts,
          userData: "0x",
          fromInternalBalance: false
        })
      ).to.be.revertedWith("")
    })

    it("fails if wrong user data", async () => {
      const wrongUserData = ethers.utils.defaultAbiCoder.encode(["address"], [user.address])
      await expect(
        balancerVault.joinPool(poolId, deployer.address, deployer.address, {
          assets: [tokens[0].address, tokens[1].address],
          maxAmountsIn: defaultDepositAmounts,
          userData: wrongUserData,
          fromInternalBalance: false
        })
      ).to.be.revertedWith("")
    })
  })
  describe("get rate", () => {
    it("rate equals one", async () => {
      await initPool(tokens)
      const result = await stablePool.getRate()
      expect(result).is.eq("1000000000000000000")
    })
  })

  describe("swaps", () => {
    context("given in", () => {
      it("standard given in swap t0 for t1", async () => {
        await initPool(tokens)
        const bal0Before = await tokens[0].balanceOf(deployer.address)
        const bal1Before = await tokens[1].balanceOf(deployer.address)
        const swapAmount = bn(10).pow(18)
        await tokens[0].approve(balancerVault.address, swapAmount)
        const singleSwap = {
          poolId: poolId,
          kind: 0,
          assetIn: tokens[0].address,
          assetOut: tokens[1].address,
          amount: swapAmount,
          userData: "0x"
        }
        const funds = {
          sender: deployer.address,
          fromInternalBalance: false,
          recipient: deployer.address,
          toInternalBalance: false
        }

        await balancerVault.swap(singleSwap, funds, 0, ethers.constants.MaxUint256)
        const bal0After = await tokens[0].balanceOf(deployer.address)
        const bal1After = await tokens[1].balanceOf(deployer.address)
        expect(bal0After).is.lt(bal0Before)
        expect(bal1After).is.gt(bal1Before)
      })

      it("standard given in swap t1 for t0", async () => {
        await initPool(tokens)
        const bal0Before = await tokens[0].balanceOf(deployer.address)
        const bal1Before = await tokens[1].balanceOf(deployer.address)
        const swapAmount = bn(10).pow(18)
        await tokens[1].approve(balancerVault.address, swapAmount)
        const singleSwap = {
          poolId: poolId,
          kind: 0,
          assetIn: tokens[1].address,
          assetOut: tokens[0].address,
          amount: swapAmount,
          userData: "0x"
        }
        const funds = {
          sender: deployer.address,
          fromInternalBalance: false,
          recipient: deployer.address,
          toInternalBalance: false
        }

        await balancerVault.swap(singleSwap, funds, 0, ethers.constants.MaxUint256)
        const bal0After = await tokens[0].balanceOf(deployer.address)
        const bal1After = await tokens[1].balanceOf(deployer.address)
        expect(bal0After).is.gt(bal0Before)
        expect(bal1After).is.lt(bal1Before)
      })
    })
    context("given out", () => {
      it("standard given out swap", async () => {
        await initPool(tokens)
        const bal0Before = await tokens[0].balanceOf(deployer.address)
        const bal1Before = await tokens[1].balanceOf(deployer.address)
        const swapAmount = bn(10).pow(15)
        await tokens[0].approve(balancerVault.address, swapAmount.mul(2))
        const singleSwap = {
          poolId: poolId,
          kind: 1,
          assetIn: tokens[0].address,
          assetOut: tokens[1].address,
          amount: swapAmount,
          userData: "0x"
        }
        const funds = {
          sender: deployer.address,
          fromInternalBalance: false,
          recipient: deployer.address,
          toInternalBalance: false
        }

        await balancerVault.swap(singleSwap, funds, ethers.constants.MaxUint256, ethers.constants.MaxUint256)
        const bal0After = await tokens[0].balanceOf(deployer.address)
        const bal1After = await tokens[1].balanceOf(deployer.address)
        expect(bal0After).is.lt(bal0Before)
        expect(bal1After).is.gt(bal1Before)
      })
    })
  })
  describe("join", () => {
    it("TOKEN_IN_FOR_EXACT_BPT_OUT join with fees", async () => {
      const tokensInPool = 2
      const feeCollectorAddress = await balancerVault.getProtocolFeesCollector()
      const feeCollector = await ethers.getContractAt("ProtocolFeesCollector", feeCollectorAddress)
      const actionSetSwapFeePercentage = await Misc.actionId(feeCollector, "setSwapFeePercentage(uint256)")
      await authorizer.grantRole(actionSetSwapFeePercentage, deployer.address)

      await feeCollector.setSwapFeePercentage(bn(10).pow(15))
      await initPool(tokens)

      const bptBefore = await stablePool.balanceOf(deployer.address)

      const depositAmount = bn(10).pow(15)
      let tokenAddresses = []
      for (let i = 0; i < tokensInPool; i++) {
        await tokens[i].connect(deployer).approve(balancerVault.address, depositAmount)
        tokenAddresses.push(tokens[i].address)
      }

      const JOIN_KIND = 2
      const initUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [JOIN_KIND, depositAmount.div(10), 0]
      )
      const joinPoolRequest = {
        assets: tokenAddresses,
        maxAmountsIn: [depositAmount, bn(0)],
        userData: initUserData,
        fromInternalBalance: false
      }
      await balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest)
      const bptAfter = await stablePool.balanceOf(deployer.address)
      expect(bptAfter).is.gt(bptBefore)
    })

    it("unbalanced join with fees", async () => {
      // fee configuration
      const feeCollectorAddress = await balancerVault.getProtocolFeesCollector()
      const feeCollector = await ethers.getContractAt("ProtocolFeesCollector", feeCollectorAddress)
      const actionSetSwapFeePercentage = await Misc.actionId(feeCollector, "setSwapFeePercentage(uint256)")
      await authorizer.grantRole(actionSetSwapFeePercentage, deployer.address)
      await feeCollector.setSwapFeePercentage(bn(10).pow(15))

      // init with different amount of tokens
      let initialBalances = [BigNumber.from(10).pow(18), BigNumber.from(10).pow(18).add(1)]
      let tokenAddresses1 = [tokens[0].address, tokens[1].address]
      await tokens[0].approve(balancerVault.address, initialBalances[0])
      await tokens[1].approve(balancerVault.address, initialBalances[1])
      const JOIN_KIND_INIT = 0
      const initUserData1 = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]"],
        [JOIN_KIND_INIT, initialBalances]
      )
      const joinPoolRequest1 = {
        assets: tokenAddresses1,
        maxAmountsIn: initialBalances,
        userData: initUserData1,
        fromInternalBalance: false
      }
      await balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest1)

      // regular join
      const bptBefore = await stablePool.balanceOf(deployer.address)
      const depositAmount = bn(10).pow(15)
      let tokenAddresses = []

      for (let i = 0; i < 2; i++) {
        await tokens[i].connect(deployer).approve(balancerVault.address, depositAmount)
        tokenAddresses.push(tokens[i].address)
      }
      const JOIN_KIND = 1
      const initUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256[]", "uint256"],
        [JOIN_KIND, [depositAmount.div(10), depositAmount.div(10).add(1000000)], 0]
      )
      const joinPoolRequest = {
        assets: tokenAddresses,
        maxAmountsIn: [depositAmount, depositAmount],
        userData: initUserData,
        fromInternalBalance: false
      }
      await balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest)
      const bptAfter = await stablePool.balanceOf(deployer.address)
      expect(bptAfter).is.gt(bptBefore)
    })

    it("Unknown join kind", async () => {
      const tokensInPool = 2
      await initPool(tokens)
      const depositAmount = bn(10).pow(15)
      let tokenAddresses = []
      for (let i = 0; i < tokensInPool; i++) {
        await tokens[i].connect(deployer).approve(balancerVault.address, depositAmount)
        tokenAddresses.push(tokens[i].address)
      }

      const BROKEN_JOIN_KIND = 0
      const initUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [BROKEN_JOIN_KIND, depositAmount.div(10), 0]
      )
      const joinPoolRequest = {
        assets: tokenAddresses,
        maxAmountsIn: [depositAmount, bn(0)],
        userData: initUserData,
        fromInternalBalance: false
      }
      await expect(balancerVault.joinPool(poolId, deployer.address, deployer.address, joinPoolRequest)).is.rejectedWith(
        "BAL#310"
      )
    })
  })

  describe("exit", () => {
    it("TOKEN_IN_FOR_EXACT_BPT_OUT exit", async () => {
      const tokensInPool = 2
      await initPool(tokens)
      const bptBefore = await stablePool.balanceOf(deployer.address)

      const BPT_IN_FOR_EXACT_TOKENS_OUT = 1
      const exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [BPT_IN_FOR_EXACT_TOKENS_OUT, bptBefore]
      )

      await balancerVault.exitPool(poolId, deployer.address, deployer.address, {
        assets: [tokens[0].address, tokens[1].address],
        minAmountsOut: Array(tokensInPool).fill(0),
        userData: exitUserData,
        toInternalBalance: false
      })
      const bptAfter = await stablePool.balanceOf(deployer.address)
      expect(bptAfter).is.eq(0)
    })

    it("TOKEN_IN_FOR_EXACT_BPT_OUT exit from paused pool", async () => {
      const tokensInPool = 2
      await initPool(tokens)
      const actionSetPaused = await Misc.actionId(stablePool, "setPaused(bool)")
      await authorizer.grantRole(actionSetPaused, deployer.address)
      await stablePool.setPaused(true)

      const bptBefore = await stablePool.balanceOf(deployer.address)

      const BPT_IN_FOR_EXACT_TOKENS_OUT = 1
      const exitUserData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256"],
        [BPT_IN_FOR_EXACT_TOKENS_OUT, bptBefore]
      )

      await balancerVault.exitPool(poolId, deployer.address, deployer.address, {
        assets: [tokens[0].address, tokens[1].address],
        minAmountsOut: Array(tokensInPool).fill(0),
        userData: exitUserData,
        toInternalBalance: false
      })
      const bptAfter = await stablePool.balanceOf(deployer.address)
      expect(bptAfter).is.eq(0)
    })
  })

  describe("scaling factors", () => {
    it("init 3 tokens pool", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
      stablePool = (await TetuStablePoolFact.deploy(
        balancerVault.address,
        poolName,
        poolSymbol,
        [tokens[0].address, tokens[1].address, tokens[2].address],
        ampParam,
        swapFee,
        pauseWindowDuration,
        bufferPeriodDuration,
        deployer.address,
        [ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero]
      )) as TestTetuStablePool

      poolId = await stablePool.getPoolId()

      const tokensInPool = 3
      await initPool(tokens, tokensInPool)
    })
    it("init 4 tokens pool", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
      stablePool = (await TetuStablePoolFact.deploy(
        balancerVault.address,
        poolName,
        poolSymbol,
        [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address],
        ampParam,
        swapFee,
        pauseWindowDuration,
        bufferPeriodDuration,
        deployer.address,
        [
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        ]
      )) as TestTetuStablePool

      poolId = await stablePool.getPoolId()

      const tokensInPool = 4
      await initPool(tokens, tokensInPool)
    })

    it("init 5 tokens pool", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
      stablePool = (await TetuStablePoolFact.deploy(
        balancerVault.address,
        poolName,
        poolSymbol,
        [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address, tokens[4].address],
        ampParam,
        swapFee,
        pauseWindowDuration,
        bufferPeriodDuration,
        deployer.address,
        [
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        ]
      )) as TestTetuStablePool

      poolId = await stablePool.getPoolId()

      const tokensInPool = 5
      await initPool(tokens, tokensInPool)
    })

    it("Default scaling factors for 5 tokens pool", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TestTetuStablePool")
      stablePool = (await TetuStablePoolFact.deploy(
        balancerVault.address,
        poolName,
        poolSymbol,
        [tokens[0].address, tokens[1].address, tokens[2].address, tokens[3].address, tokens[4].address],
        ampParam,
        swapFee,
        pauseWindowDuration,
        bufferPeriodDuration,
        deployer.address,
        [
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        ]
      )) as TestTetuStablePool

      poolId = await stablePool.getPoolId()

      const tokensInPool = 5
      await initPool(tokens, tokensInPool)

      expect(await stablePool.scalingFactor(tokens[2].address)).is.eq("1000000000000000000")
      expect(await stablePool.scalingFactor(tokens[3].address)).is.eq("1000000000000000000")
      expect(await stablePool.scalingFactor(tokens[4].address)).is.eq("1000000000000000000")
      await expect(stablePool.scalingFactor(tokens[5].address)).is.revertedWith("")
    })

    it("scaling factors for non existing 0 and 1 token pools", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TestTetuStablePool")
      stablePool = (await TetuStablePoolFact.deploy(
        balancerVault.address,
        poolName,
        poolSymbol,
        [tokens[0].address, tokens[1].address],
        ampParam,
        swapFee,
        pauseWindowDuration,
        bufferPeriodDuration,
        deployer.address,
        [ethers.constants.AddressZero, ethers.constants.AddressZero]
      )) as TestTetuStablePool

      poolId = await stablePool.getPoolId()

      await initPool(tokens)
      await stablePool.setTotalTokens(0)
      const sf1 = await stablePool.scalingFactors()
      expect(sf1.length).is.eq(0)

      await stablePool.setTotalTokens(1)
      const sf2 = await stablePool.scalingFactors()
      expect(sf2[0]).is.eq("1000000000000000000")

      const now = Math.round(new Date().getTime() / 1000)

      await stablePool.startAmplificationParameterUpdate("400", BigNumber.from(now).add(BigNumber.from(360000)))
      const result = await stablePool.getAmplificationParameter()
      expect(result.value).is.eq("500000")
    })
  })
})

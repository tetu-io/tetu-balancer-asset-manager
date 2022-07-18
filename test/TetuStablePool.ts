import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { Authorizer, MockERC20, Relayer, TetuRelayedStablePool, Vault } from "../typechain"
import { BigNumber } from "ethers"
import { bn, Misc, PoolSpecialization } from "./utils/Misc"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuStablePool tests", function () {
  let deployer: SignerWithAddress
  let relayer: Relayer
  let user: SignerWithAddress
  let stablePool: TetuRelayedStablePool
  let poolId: string
  let balancerVault: Vault
  let tokens: MockERC20[]
  let mockWeth: MockERC20

  const ampParam = 500
  const swapFee = "3000000000000000"
  const poolName = "Tetu stable pool"
  const poolSymbol = "TETU-USDC-DAI"

  before(async function () {
    ;[deployer, user] = await ethers.getSigners()
    const USDC = await ethers.getContractFactory("MockERC20")
    const mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 18)
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))

    const DAI = await ethers.getContractFactory("MockERC20")
    const mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18)
    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))
    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18)
    tokens = Misc.sortTokens([mockUsdc, mockDai])
  })

  beforeEach(async function () {
    const AuthFact = await ethers.getContractFactory("Authorizer")
    const authorizer = (await AuthFact.deploy(deployer.address)) as Authorizer

    const BalVaultFactory = await ethers.getContractFactory("Vault")
    balancerVault = (await BalVaultFactory.deploy(authorizer.address, mockWeth.address, 0, 0)) as Vault

    const RelayerFact = await ethers.getContractFactory("Relayer")
    relayer = await RelayerFact.deploy(balancerVault.address)

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
      [ethers.constants.AddressZero, ethers.constants.AddressZero]
    )) as TetuRelayedStablePool
    poolId = await stablePool.getPoolId()

    const actionJoin = await Misc.actionId(balancerVault, "joinPool")
    const actionExit = await Misc.actionId(balancerVault, "exitPool")

    await authorizer.grantRole(actionJoin, relayer.address)
    await authorizer.grantRole(actionExit, relayer.address)

    await balancerVault.connect(user).setRelayerApproval(user.address, relayer.address, true)
  })

  const initPool = async (tokens: MockERC20[]) => {
    const initialBalances = [BigNumber.from(10).pow(18), BigNumber.from(10).pow(18)]
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
      await initPool(tokens)
      const tokenInfo = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
      expect(tokenInfo[0]).is.eq(BigNumber.from(10).pow(18))
      expect(tokenInfo[1]).is.eq(0)
    })

    it("User should be able to join/exit via Relayer", async function () {
      await initPool(tokens)

      const initialBalances = [BigNumber.from(100), BigNumber.from(100)]

      await tokens[0].connect(user).approve(balancerVault.address, initialBalances[0])
      await tokens[1].connect(user).approve(balancerVault.address, initialBalances[1])

      const JOIN_KIND_INIT = 1
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
      await relayer.connect(user).joinPool(poolId, user.address, joinPoolRequest)
      const tokenInfo1 = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
      const expectedToken0Balance = bn("1000000000000000000").add(initialBalances[0])
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
          assets: [tokens[0].address, tokens[1].address],
          minAmountsOut: Array(tokens.length).fill(0),
          userData: exitUserData,
          toInternalBalance: false
        },
        [0, 0]
      )
      const tokenInfo2 = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
      expect(tokenInfo2[0]).is.lt(expectedToken0Balance)
    })

    it("Only Relayer should be able to join", async function () {
      await initPool(tokens)

      const initialBalances = [BigNumber.from(100), BigNumber.from(100)]

      await tokens[0].connect(user).approve(balancerVault.address, initialBalances[0])
      await tokens[1].connect(user).approve(balancerVault.address, initialBalances[1])

      const JOIN_KIND_INIT = 1
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
      await expect(
        balancerVault.connect(user).joinPool(poolId, user.address, user.address, joinPoolRequest)
      ).is.rejectedWith("Only relayer can join pool")
    })

    it("Only Relayer should be able to exit", async function () {
      await initPool(tokens)
      const exitUserData = ethers.utils.defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [0, 10, 0])

      await expect(
        balancerVault.connect(user).exitPool(poolId, user.address, user.address, {
          assets: [tokens[0].address, tokens[1].address],
          minAmountsOut: Array(tokens.length).fill(0),
          userData: exitUserData,
          toInternalBalance: false
        })
      ).is.rejectedWith("Only relayer can exit pool")
    })

    it("Pool should return relayer address", async function () {
      expect(await stablePool.getRelayer()).is.eq(relayer.address)
    })

    it("sets scaling factors", async () => {
      const poolScalingFactors = await stablePool.getScalingFactors()
      const tokenScalingFactors = [BigNumber.from(10).pow(18), BigNumber.from(10).pow(18)]
      expect(poolScalingFactors).to.deep.equal(tokenScalingFactors)
    })

    it("reverts if there is a single token", async () => {
      const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
      await expect(
        TetuStablePoolFact.deploy(
          balancerVault.address,
          poolName,
          poolSymbol,
          [tokens[0].address],
          ampParam,
          swapFee,
          "0",
          "0",
          deployer.address,
          relayer.address,
          [ethers.constants.AddressZero, ethers.constants.AddressZero]
        )
      ).is.revertedWith("BAL#200")
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
        // it('reverts if there are repeated tokens', async () => {
        //   const badTokens = new TokenList(Array(numberOfTokens).fill(tokens.first));
        //   await expect(deployPool({ tokens: badTokens, fromFactory: true })).to.be.revertedWith('UNSORTED_ARRAY');
        // });

        it("reverts if the swap fee is too high", async () => {
          const badSwapFeePercentage = bn(10).pow(18).add(1)
          const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
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
              relayer.address,
              [ethers.constants.AddressZero, ethers.constants.AddressZero]
            )
          ).is.revertedWith("BAL#202")
        })

        it("reverts if amplification coefficient is too high", async () => {
          const highAmp = bn(5001)

          const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
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
              relayer.address,
              [ethers.constants.AddressZero, ethers.constants.AddressZero]
            )
          ).is.revertedWith("BAL#301")
        })

        it("reverts if amplification coefficient is too low", async () => {
          const lowAmp = bn(0)
          const TetuStablePoolFact = await ethers.getContractFactory("TetuRelayedStablePool")
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
              relayer.address,
              [ethers.constants.AddressZero, ethers.constants.AddressZero]
            )
          ).is.revertedWith("BAL#300")
        })
      })
    })
  })
})

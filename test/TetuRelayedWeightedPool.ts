import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { Authorizer, MockERC20, RelayedWeightedPool, Relayer, TetuRelayedStablePool, Vault } from "../typechain"
import { BigNumber } from "ethers"
import { bn, Misc } from "./utils/Misc"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuRelayedWeightedPool tests", function () {
  let deployer: SignerWithAddress
  let relayer: Relayer
  let user: SignerWithAddress
  let weightedPool: RelayedWeightedPool
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
    const mockUsdc = await USDC.deploy("USD Coin (PoS)", "USDC", 18) as MockERC20
    await mockUsdc.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockUsdc.mint(user.address, BigNumber.from(Misc.largeApproval))

    const DAI = await ethers.getContractFactory("MockERC20")
    const mockDai = await DAI.deploy("(PoS) Dai Stablecoin", "DAI", 18) as MockERC20
    await mockDai.mint(deployer.address, BigNumber.from(Misc.largeApproval))
    await mockDai.mint(user.address, BigNumber.from(Misc.largeApproval))
    const WETH = await ethers.getContractFactory("MockERC20")
    mockWeth = await WETH.deploy("WETH", "WETH", 18) as MockERC20
    tokens = Misc.sortTokens([mockUsdc, mockDai])
  })

  beforeEach(async function () {
    const AuthFact = await ethers.getContractFactory("Authorizer")
    const authorizer = (await AuthFact.deploy(deployer.address)) as Authorizer

    const BalVaultFactory = await ethers.getContractFactory("Vault")
    balancerVault = (await BalVaultFactory.deploy(authorizer.address, mockWeth.address, 0, 0)) as Vault

    const RelayerFact = await ethers.getContractFactory("Relayer")
    relayer = await RelayerFact.deploy(balancerVault.address) as Relayer

    const RelayedWeightedPool = await ethers.getContractFactory("RelayedWeightedPool")
    weightedPool = (await RelayedWeightedPool.deploy(
      balancerVault.address,
      poolName,
      poolSymbol,
      [tokens[0].address, tokens[1].address],
      ["300000000000000000", "700000000000000000"],
      [ethers.constants.AddressZero, ethers.constants.AddressZero],
      swapFee,
      "0",
      "0",
      deployer.address,
      relayer.address,
    )) as RelayedWeightedPool
    poolId = await weightedPool.getPoolId()

    const actionJoin = await Misc.actionId(balancerVault, "joinPool")
    const actionExit = await Misc.actionId(balancerVault, "exitPool")

    await authorizer.grantRole(actionJoin, relayer.address)
    await authorizer.grantRole(actionExit, relayer.address)
    await balancerVault.setRelayerApproval(deployer.address, relayer.address, true)
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
    await relayer.joinPool(poolId, deployer.address, joinPoolRequest)
  }

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await weightedPool.name()).is.eq(poolName)
      expect(await weightedPool.symbol()).is.eq(poolSymbol)
      expect(await weightedPool.getSwapFeePercentage()).is.eq(swapFee)
    })

    it("Owner can initialize pool", async function () {
      await initPool(tokens)
      const tokenInfo = await balancerVault.getPoolTokenInfo(poolId, tokens[0].address)
      expect(tokenInfo[0]).is.eq(BigNumber.from(10).pow(18))
      expect(tokenInfo[1]).is.eq(0)
    })

    it("User should be able to join/exit via Relayer", async function () {
      await initPool(tokens)

      const initialBalances = [bn(10000000), bn(10000000)]

      await tokens[0].connect(user).approve(balancerVault.address, initialBalances[0])
      await tokens[1].connect(user).approve(balancerVault.address, initialBalances[1])

      const EXACT_TOKENS_IN_FOR_BPT_OUT = 1
      const initUserData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [EXACT_TOKENS_IN_FOR_BPT_OUT, initialBalances, 0]
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

      const bptBalance = await weightedPool.balanceOf(user.address)
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
      ).is.rejectedWith("BAL#324")
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
      ).is.rejectedWith("BAL#324")
    })

    it("Pool should return relayer address", async function () {
      expect(await weightedPool.getRelayer()).is.eq(relayer.address)
    })

    it("sets scaling factors", async () => {
      const poolScalingFactors = await weightedPool.getScalingFactors()
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
  })
})

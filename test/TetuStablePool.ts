import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import {solidity} from "ethereum-waffle"
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers"
import {ethers, network} from "hardhat"
import {Authorizer, MockERC20, Relayer, TetuRelayedStablePool, Vault} from "../typechain"
import {BigNumber, BigNumberish} from "ethers"
import {bn, Misc, PoolSpecialization} from "./utils/Misc"
import {BytesLike} from "@ethersproject/bytes";

const {expect} = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuStablePool tests", function () {
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let stablePool: TetuRelayedStablePool
  let poolId: string
  let balancerVault: Vault
  let tokens: MockERC20[]
  let mockWeth: MockERC20
  let defaultDepositAmounts = [BigNumber.from(30).mul(BigNumber.from(10).pow(18)), BigNumber.from(30).mul(BigNumber.from(10).pow(18))]

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

    const TetuStablePoolFact = await ethers.getContractFactory("TetuStablePool")
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
      [ethers.constants.AddressZero, ethers.constants.AddressZero]
    )) as TetuRelayedStablePool

    poolId = await stablePool.getPoolId()
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
        const {tokens, balances} = await balancerVault.getPoolTokens(poolId)
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
        const {value, isUpdating, precision} = await stablePool.getAmplificationParameter()
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

      it('initial last invariant', async () => {
        const result = await stablePool.getLastInvariant()
        expect(result[0]).is.eq(bn(0))
        expect(result[1]).is.eq(bn(0))
      })

      it('startAmplificationParameterUpdate', async () => {
        const timeTravel = 86400 * 2
        const newAMP = 600
        let date = new Date();
        date.setDate(date.getDate() + 1);

        await stablePool.startAmplificationParameterUpdate(newAMP, date.getTime())
        await stablePool.stopAmplificationParameterUpdate()
        await network.provider.send('evm_increaseTime', [timeTravel])
        await network.provider.send('evm_mine', [])
        const result = await stablePool.getAmplificationParameter()
        expect(result[0]).is.eq("500000")
        expect(result[1]).is.eq(false)
        expect(result[2]).is.eq("1000")
      })

    })
  })
  describe('onJoinPool', () => {
    it('fails if caller is not the vault', async () => {
      await expect(
        stablePool.connect(user).onJoinPool(poolId, user.address, user.address, [0], 0, 0, '0x')
      ).to.be.revertedWith('BAL#205')
    })

    it('fails if no user data', async () => {
      await initPool(tokens)
      await expect(balancerVault.joinPool(
        poolId,
        deployer.address,
        deployer.address,
        {
          assets: [tokens[0].address, tokens[1].address],
          maxAmountsIn: defaultDepositAmounts,
          userData: '0x',
          fromInternalBalance: false
        }
      )).to.be.revertedWith('')
    })

    it('fails if wrong user data', async () => {
      const wrongUserData = ethers.utils.defaultAbiCoder.encode(['address'], [user.address]);
      await expect(balancerVault.joinPool(
        poolId,
        deployer.address,
        deployer.address,
        {
          assets: [tokens[0].address, tokens[1].address],
          maxAmountsIn: defaultDepositAmounts,
          userData: wrongUserData,
          fromInternalBalance: false
        }
      )).to.be.revertedWith('')
    })
  })
  describe('get rate', () => {
    it('rate equals one', async () => {
      await initPool(tokens)
      const result = await stablePool.getRate()
      expect(result).is.eq("1000000000000000000")
    })
  })

  describe('swaps', () => {
    context('given in', () => {
      it('calculates amount out', async () => {
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
          userData: '0x'
        }
        const funds = {
          sender: deployer.address,
          fromInternalBalance: false,
          recipient: deployer.address,
          toInternalBalance: false
        }

        await balancerVault.swap(
          singleSwap,
          funds,
          0,
          ethers.constants.MaxUint256
        )
        const bal0After = await tokens[0].balanceOf(deployer.address)
        const bal1After = await tokens[1].balanceOf(deployer.address)
        expect(bal0After).is.lt(bal0Before)
        expect(bal1After).is.gt(bal1Before)
      })
    })
  })
})

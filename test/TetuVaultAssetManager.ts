import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"
import { TetuVaultAssetManager } from "../typechain"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuVaultAssetManager tests", function () {
  let deployer: SignerWithAddress
  let rewardCollector: SignerWithAddress
  let assetManager: TetuVaultAssetManager
  const balancerVaultAddress = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
  const tetuUSDCVaultAddress = "0xeE3B4Ce32A6229ae15903CDa0A5Da92E739685f7"
  const underlyingAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"

  beforeEach(async function () {
    ;[deployer, rewardCollector] = await ethers.getSigners()
    const TetuVaultAssetManagerFact = await ethers.getContractFactory("TetuVaultAssetManager")
    assetManager = (await TetuVaultAssetManagerFact.deploy(
      balancerVaultAddress,
      tetuUSDCVaultAddress,
      underlyingAddress,
      rewardCollector.address
    )) as TetuVaultAssetManager
  })

  describe("General tests", function () {
    it("Smoke test", async function () {
      expect(await assetManager.underlying()).is.eq(underlyingAddress)
      expect(await assetManager.tetuVault()).is.eq(tetuUSDCVaultAddress)
      expect(await assetManager.rewardCollector()).is.eq(rewardCollector.address)
    })
  })
  describe("Invest", function () {
    it("AM should be able to invest funds to the TetuVault", async function () {
      //todo
    })
  })
})

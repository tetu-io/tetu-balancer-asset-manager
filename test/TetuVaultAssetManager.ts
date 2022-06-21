import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import { solidity } from "ethereum-waffle"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { ethers } from "hardhat"

const { expect } = chai
chai.use(chaiAsPromised)
chai.use(solidity)

describe("TetuVaultAssetManager tests", function () {
  let deployer: SignerWithAddress

  beforeEach(async function () {
    ;[deployer] = await ethers.getSigners()
    const TetuVaultAssetManagerFact = ethers.getContractFactory("TetuVaultAssetManager")
  })

  describe("General tests", function () {
    it("Smoke test", async function () {
      console.log(`Hey!`)
    })
  })
})

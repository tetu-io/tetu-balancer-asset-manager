import hre, { ethers } from "hardhat"
import { BigNumberish, Contract } from "ethers"

export class Misc {
  public static readonly SECONDS_OF_DAY = 60 * 60 * 24
  public static readonly SECONDS_OF_YEAR = Misc.SECONDS_OF_DAY * 365
  public static readonly ANY_ADDRESS = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF"
  public static readonly largeApproval = "100000000000000000000000000000000"

  public static readonly balancerVaultAddress = "0xBA12222222228d8Ba445958a75a0704d566BF2C8"
  public static readonly balancerVaultAdminAddress = "0xd2bD536ADB0198f74D5f4f2Bd4Fe68Bae1e1Ba80"
  public static readonly balancerVaultAuthorizerAddress = "0xA331D84eC860Bf466b4CdCcFb4aC09a1B43F3aE6"

  // ************** ADDRESSES **********************

  public static async impersonate(address: string) {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address]
    })

    await hre.network.provider.request({
      method: "hardhat_setBalance",
      params: [address, "0x1431E0FAE6D7217CAA0000000"]
    })
    return ethers.getSigner(address)
  }

  public static encodeJoin = (joinAmounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string =>
    encodeJoinExitMockPool(joinAmounts, dueProtocolFeeAmounts)

  public static encodeExit = (exitAmounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string =>
    encodeJoinExitMockPool(exitAmounts, dueProtocolFeeAmounts)

  public static actionId = (instance: Contract, method: string): Promise<string> => {
    const selector = instance.interface.getSighash(method)
    return instance.getActionId(selector)
  }
}

function encodeJoinExitMockPool(amounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string {
  return ethers.utils.defaultAbiCoder.encode(["uint256[]", "uint256[]"], [amounts, dueProtocolFeeAmounts])
}

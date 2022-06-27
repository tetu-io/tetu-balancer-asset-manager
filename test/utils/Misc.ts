import hre, { ethers } from "hardhat"
import { BigNumberish } from "ethers"

export class Misc {
  public static readonly SECONDS_OF_DAY = 60 * 60 * 24
  public static readonly SECONDS_OF_YEAR = Misc.SECONDS_OF_DAY * 365

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
}

function encodeJoinExitMockPool(amounts: BigNumberish[], dueProtocolFeeAmounts: BigNumberish[]): string {
  return ethers.utils.defaultAbiCoder.encode(["uint256[]", "uint256[]"], [amounts, dueProtocolFeeAmounts])
}

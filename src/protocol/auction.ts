import type { ProviderInterface, TypedContractV2 } from "starknet";
import { makeTypedContract, type AbiSource, getEnvAddress } from "./contracts";
import { PulseAuctionAbi } from "@/abi/typed/PulseAuction.abi";
export type AuctionContract = TypedContractV2<typeof PulseAuctionAbi>;

const REQUIRED = ["get_config", "get_current_price", "curve_active"] as const;

export async function createAuctionContract(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
}) {
  const address = opts?.address ?? getEnvAddress("VITE_PULSE_AUCTION");
  return makeTypedContract({
    address,
    abiStatic: PulseAuctionAbi,
    provider: opts?.provider,
    abiSource: opts?.abiSource,
    requiredFns: REQUIRED,
  });
}

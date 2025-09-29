import type { ProviderInterface, TypedContractV2 } from "starknet";
import { makeTypedContract, type AbiSource, getEnvAddress } from "./contracts";

// Adjust filename to your artifact/codegen name
import AuctionAbiJson from "@/abi/PulseAuction.json";
export const AUCTION_ABI = AuctionAbiJson as const;
export type AuctionContract = TypedContractV2<typeof AUCTION_ABI>;

const REQUIRED = ["get_config", "get_current_price", "curve_active"] as const;

export async function createAuctionContract(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
}) {
  const address = opts?.address ?? getEnvAddress("VITE_PULSE_AUCTION");
  return makeTypedContract({
    address,
    abiStatic: AUCTION_ABI,
    provider: opts?.provider,
    abiSource: opts?.abiSource,
    requiredFns: REQUIRED,
  });
}

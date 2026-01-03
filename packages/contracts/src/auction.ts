import type { ProviderInterface, TypedContractV2 } from "starknet";
import { makeTypedContract } from "./contracts";
import { PulseAuctionAbi } from "./abi/typed/PulseAuction.abi";
import { resolveAddress } from "./addressBook";
import { type AbiSource } from "./types";

const REQUIRED = ["get_config", "get_current_price", "curve_active"] as const;

export type AuctionContract = TypedContractV2<typeof PulseAuctionAbi>;

/**
 * Concrete factory for creating an auction contract
 * Uses `makeTypedContract` with safety checks.
 */
export async function createAuctionContract(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
}) {
  const address = opts?.address ?? resolveAddress("pulse_auction");
  return makeTypedContract({
    address,
    abiStatic: PulseAuctionAbi,
    provider: opts?.provider,
    abiSource: opts?.abiSource,
    requiredFns: REQUIRED,
  });
}

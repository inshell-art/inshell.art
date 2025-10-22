import type { ProviderInterface } from "starknet";
import type { AbiSource } from "@/types/types";
import { createCoreService } from "./coreService";
import { createBidsService } from "./bidsService";

export function createAuctionServices(opts: {
  address: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
  core?: { refreshMs?: number };
  bids?: {
    fromBlock?: number;
    maxBids?: number;
    chunkSize?: number;
    reorgDepth?: number;
  };
}) {
  const core = createCoreService({
    address: opts.address,
    provider: opts.provider,
    abiSource: opts.abiSource,
  });

  const bids = createBidsService({
    address: opts.address,
    provider: opts.provider,
    fromBlock: opts.bids?.fromBlock,
    maxBids: opts.bids?.maxBids,
    chunkSize: opts.bids?.chunkSize,
    reorgDepth: opts.bids?.reorgDepth,
  });

  return { core, bids };
}

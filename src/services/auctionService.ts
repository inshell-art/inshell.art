import type { ProviderInterface } from "starknet";
import { createAuctionContract } from "@/protocol/auction";
import { DEFAULT_SAFE_TAG, StarkBlockId } from "@/protocol/blockId";
import { toU256Num, U256Num, readU256 } from "@/num";
import { AbiSource } from "@/types/types";

// ---- Contract view names
const VIEW = {
  GET_CURRENT_PRICE: "get_current_price",
  GET_CONFIG: "get_config",
  CURVE_ACTIVE: "curve_active",
} as const;

export type AuctionConfig = {
  openTimeSec: number;
  genesisPrice: U256Num;
  genesisFloor: U256Num;
  k: U256Num;
  pts: string; // felt252 serialized
};

export type CurrentPrice = U256Num;

export type AuctionSnapshot = {
  active: boolean;
  price: CurrentPrice;
  config: AuctionConfig;
};

export type AuctionService = ReturnType<typeof createAuctionService>;

/**
 * Domain service for interacting with a Pulse auction contract.
 * Wraps a contract instance and provides higher-level methods.
 * Also export a default singleton below for convenience.
 */
export function createAuctionService(
  params: {
    blockId?: StarkBlockId;
    provider?: ProviderInterface;
    address?: string;
    abiSource?: AbiSource;
  } = {}
) {
  // guard block id to safe value
  const blockIdentifier = params.blockId ?? DEFAULT_SAFE_TAG;

  // keep contract as a Promise (createAuctionContract is async)
  const contractP = createAuctionContract({
    provider: params.provider,
    address: params.address,
    abiSource: params.abiSource as AbiSource,
  });

  async function call0(name: string) {
    const c: any = await contractP;
    return c.call(name, [], { blockIdentifier });
  }

  async function getCurrentPrice(): Promise<CurrentPrice> {
    const out = await call0(VIEW.GET_CURRENT_PRICE);
    const raw = readU256(out.price ?? out[0] ?? out);
    return toU256Num(raw);
  }

  async function getCurveActive(): Promise<boolean> {
    const out = await call0(VIEW.CURVE_ACTIVE);
    return Boolean(out.active ?? out[0] ?? out);
  }

  async function getConfig(): Promise<AuctionConfig> {
    const r = await call0(VIEW.GET_CONFIG);
    const open = Number(r.open_time ?? r.openTime ?? r[0]);
    const gp = readU256(r.genesis_price ?? r[1]);
    const gf = readU256(r.genesis_floor ?? r[2]);
    const k = readU256(r.k ?? r[3]);
    const pts = String(r.pts ?? r[4]);
    return {
      openTimeSec: open,
      genesisPrice: toU256Num(gp),
      genesisFloor: toU256Num(gf),
      k: toU256Num(k),
      pts,
    };
  }

  async function snapshot(): Promise<AuctionSnapshot> {
    const [active, price, config] = await Promise.all([
      getCurveActive(),
      getCurrentPrice(),
      getConfig(),
    ]);
    return { active, price, config };
  }

  return {
    contractPromise: contractP,
    getCurrentPrice,
    getCurveActive,
    getConfig,
    snapshot,
  };
}

// Default singleton
export const auctionService = createAuctionService();

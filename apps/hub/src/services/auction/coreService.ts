/**
 * Domain service for interacting with a Pulse auction contract.
 * Core service, time-agnostic, one-shot methods only.
 * No interval here, the hook or caller is responsible for refresh.
 * Snapshots state, gets config, current price, curve active.
 * Also export a default singleton below for convenience.
 */

import type { ProviderInterface, TypedContractV2 } from "starknet";
import { createAuctionContract, type AbiSource, PulseAuctionAbi } from "@inshell/contracts";
import { DEFAULT_SAFE_TAG, type StarkBlockId } from "@inshell/starknet";
import { toU256Num, U256Num, readU256 } from "@inshell/utils";

// ---- Contract view names
const VIEW = {
  GET_CURRENT_PRICE: "get_current_price",
  GET_CONFIG: "get_config",
  CURVE_ACTIVE: "curve_active",
} as const;

// ---- Types ----
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

export type CoreService = ReturnType<typeof createCoreService>;

export function createCoreService(
  params: {
    blockId?: StarkBlockId;
    provider?: ProviderInterface;
    address?: string;
    abiSource?: AbiSource;
  } = {}
) {
  let cfg = {
    blockId: params.blockId ?? DEFAULT_SAFE_TAG,
    provider: params.provider,
    address: params.address,
    abiSource: (params.abiSource as AbiSource) ?? "auto",
  };

  // guard block id to safe value
  const blockIdentifier = params.blockId ?? DEFAULT_SAFE_TAG;

  // lazy contract instance
  let contractP: Promise<TypedContractV2<typeof PulseAuctionAbi>> | null = null;
  function getContract(): Promise<TypedContractV2<typeof PulseAuctionAbi>> {
    if (!contractP) {
      contractP = createAuctionContract({
        address: cfg.address,
        provider: cfg.provider,
        abiSource: cfg.abiSource,
      }).catch((err) => {
        contractP = null;
        throw err;
      });
    }
    return contractP;
  }

  async function call0(name: string) {
    const c: any = await getContract();
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

  function reset(next?: Partial<typeof cfg>) {
    if (next) cfg = { ...cfg, ...next }; // update effective config
    contractP = null; // reset contract without next
  }

  function configure(next: Partial<typeof cfg>) {
    reset(next);
  }

  return {
    // pure I/O
    getCurrentPrice,
    getCurveActive,
    getConfig,
    snapshot,
    // lifecycle helpers
    reset,
    configure,
    // expose promise if needed
    contractPromise: () => getContract(),
  };
}

// Default singleton
export const auctionService = createCoreService();

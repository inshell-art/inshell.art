/**
 * Domain service for interacting with a Pulse auction contract.
 * Core service, time-agnostic, one-shot methods only.
 * No interval here, the hook or caller is responsible for refresh.
 * Snapshots state, gets config, current price, curve active.
 * Also export a default singleton below for convenience.
 */

import {
  callContract,
  DEFAULT_BLOCK_TAG,
  getDefaultProvider,
  type EthereumBlockTag,
  type ProviderInterface,
} from "@inshell/ethereum";
import { toU256Num, U256Num, readU256 } from "@inshell/utils";

// ---- Contract view names
const VIEW = {
  GET_CURRENT_PRICE: "get_current_price",
  GET_CONFIG: "get_config",
  GET_STATE: "get_state",
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

export type AuctionRuntimeState = {
  epochIndex: number;
  startTimeSec: number;
  anchorTimeSec: number;
  floorPrice: U256Num;
  active: boolean;
};

export type AuctionSnapshot = {
  active: boolean;
  price: CurrentPrice;
  config: AuctionConfig;
  state: AuctionRuntimeState | null;
};

export type CoreService = ReturnType<typeof createCoreService>;

export function createCoreService(
  params: {
    blockId?: number | EthereumBlockTag;
    provider?: ProviderInterface;
    address?: string;
  } = {}
) {
  let cfg = {
    blockId: params.blockId ?? DEFAULT_BLOCK_TAG,
    provider: params.provider ?? getDefaultProvider(),
    address: params.address,
  };

  async function call0(name: string) {
    if (!cfg.provider) {
      throw new Error("Auction provider is missing.");
    }
    if (!cfg.address) {
      throw new Error("Auction contract address is missing.");
    }
    return callContract(cfg.provider, {
      contractAddress: cfg.address,
      entrypoint: name,
      calldata: [],
    }, cfg.blockId);
  }

  async function getCurrentPrice(): Promise<CurrentPrice> {
    const out = await call0(VIEW.GET_CURRENT_PRICE);
    const raw = readU256((out as any)?.price ?? (out as any)?.[0] ?? out);
    return toU256Num(raw);
  }

  async function getCurveActive(): Promise<boolean> {
    const out = await call0(VIEW.CURVE_ACTIVE);
    return Boolean((out as any)?.active ?? (out as any)?.[0] ?? out);
  }

  async function getConfig(): Promise<AuctionConfig> {
    const r = (await call0(VIEW.GET_CONFIG)) as any;
    const open = Number(r.open_time ?? r.openTime ?? r[0] ?? r.openTimeSec);
    const gp = readU256(r.genesis_price ?? r.genesisPrice ?? r[1]);
    const gf = readU256(r.genesis_floor ?? r.genesisFloor ?? r[2]);
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

  async function getState(): Promise<AuctionRuntimeState> {
    const r = (await call0(VIEW.GET_STATE)) as any;
    const epochIndex = Number(r.epoch_index ?? r.epochIndex ?? r[0]);
    const startTimeSec = Number(r.start_time ?? r.startTime ?? r.startTimeSec ?? r[1]);
    const anchorTimeSec = Number(r.anchor_time ?? r.anchorTime ?? r.anchorTimeSec ?? r[2]);
    const floorPrice = readU256(r.floor_price ?? r.floorPrice ?? r[3]);
    const active = Boolean(r.active ?? r[4]);
    return {
      epochIndex,
      startTimeSec,
      anchorTimeSec,
      floorPrice: toU256Num(floorPrice),
      active,
    };
  }

  async function snapshot(): Promise<AuctionSnapshot> {
    const [price, config, state] = await Promise.all([
      getCurrentPrice(),
      getConfig(),
      getState().catch(() => null),
    ]);
    const active =
      state?.active ?? (await getCurveActive().catch(() => false));
    return { active, price, config, state };
  }

  function reset(next?: Partial<typeof cfg>) {
    if (next) cfg = { ...cfg, ...next }; // update effective config
  }

  function configure(next: Partial<typeof cfg>) {
    reset(next);
  }

  return {
    // pure I/O
    getCurrentPrice,
    getCurveActive,
    getConfig,
    getState,
    snapshot,
    // lifecycle helpers
    reset,
    configure,
  };
}

// Default singleton
export const auctionService = createCoreService();

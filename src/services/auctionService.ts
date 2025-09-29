// src/services/auctionService.ts
import type { ProviderInterface, Abi } from "starknet";
import { Contract } from "starknet";
import { createAuctionContract } from "@/contracts/auction";

// ---- Contract view names (change here if your names differ)
const VIEW = {
  GET_CURRENT_PRICE: "get_current_price",
  GET_CONFIG: "get_config",
  CURVE_ACTIVE: "curve_active",
} as const;

// ---- helpers
type U256 = { low: string | number | bigint; high: string | number | bigint };

function toBig(x: string | number | bigint): bigint {
  if (typeof x === "bigint") return x;
  const s = String(x);
  return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
}
function readU256(v: any): U256 {
  // support {low,high} or [low,high]
  if (v && typeof v === "object" && "low" in v && "high" in v) {
    return { low: v.low, high: v.high };
  }
  if (Array.isArray(v) && v.length >= 2) {
    return { low: v[0], high: v[1] };
  }
  throw new Error("Unexpected u256 shape");
}
function u256ToBigint(u: U256): bigint {
  const low = toBig(u.low);
  const high = toBig(u.high);
  return (high << 128n) + low;
}

export type BigNum = {
  raw: { low: string; high: string };
  asBigInt: bigint;
  asDec: string;
};

function normalizeU256(u: U256): BigNum {
  const big = u256ToBigint(u);
  return {
    raw: { low: String(u.low), high: String(u.high) },
    asBigInt: big,
    asDec: big.toString(10),
  };
}

export type AuctionConfig = {
  openTimeSec: number;
  genesisPrice: BigNum;
  genesisFloor: BigNum;
  k: BigNum;
  pts: string; // felt252 serialized
};

export type CurrentPrice = BigNum;

export type AuctionSnapshot = {
  address: string;
  active: boolean;
  price: CurrentPrice;
  config: AuctionConfig;
};

export type CreateAuctionServiceDeps = {
  provider?: ProviderInterface;
  address?: string;
  contract?: Contract; // if you already built one elsewhere
};

export type AuctionService = ReturnType<typeof createAuctionService>;

/**
 * Factory: lets you inject provider/address/contract (devnet, testnet, tests).
 * Also export a default singleton below for convenience.
 */
export function createAuctionService(deps: CreateAuctionServiceDeps = {}) {
  const contract =
    deps.contract ?? createAuctionContract(deps.provider, deps.address);

  async function getCurrentPrice(): Promise<CurrentPrice> {
    // get_current_price() -> u256
    const out = await (contract as any)[VIEW.GET_CURRENT_PRICE]();
    const raw = readU256(out.price ?? out[0] ?? out); // handle different shapes
    return normalizeU256(raw);
  }

  async function getCurveActive(): Promise<boolean> {
    const out = await (contract as any)[VIEW.CURVE_ACTIVE]();
    // starknet.js usually returns { active: true/false }; also support tuple/bool
    return Boolean(out.active ?? out[0] ?? out);
  }

  async function getConfig(): Promise<AuctionConfig> {
    const r = await (contract as any)[VIEW.GET_CONFIG]();

    // Accept either named fields or tuple positions
    const open = Number(r.open_time ?? r.openTime ?? r[0]);
    const gp = readU256(r.genesis_price ?? r[1]);
    const gf = readU256(r.genesis_floor ?? r[2]);
    const k = readU256(r.k ?? r[3]);
    const pts = String(r.pts ?? r[4]);

    return {
      openTimeSec: open,
      genesisPrice: normalizeU256(gp),
      genesisFloor: normalizeU256(gf),
      k: normalizeU256(k),
      pts,
    };
  }

  async function snapshot(): Promise<AuctionSnapshot> {
    const [active, price, config] = await Promise.all([
      getCurveActive(),
      getCurrentPrice(),
      getConfig(),
    ]);
    return { address: contract.address, active, price, config };
  }

  return {
    contract,
    getCurrentPrice,
    getCurveActive,
    getConfig,
    snapshot,
  };
}

// Default singleton (uses whatever your contracts/auction.ts uses by default)
export const auctionService = createAuctionService();

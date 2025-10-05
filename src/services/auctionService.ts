import type { BlockTag, ProviderInterface } from "starknet";
import { Contract } from "starknet";
import { createAuctionContract } from "@/protocol/auction";
import { getDefaultBlockTag } from "@/protocol/contracts";

// ---- Contract view names (change here if your names differ)
const VIEW = {
  GET_CURRENT_PRICE: "get_current_price",
  GET_CONFIG: "get_config",
  CURVE_ACTIVE: "curve_active",
} as const;

// ---- helpers

type U256 = { low: string | number | bigint; high: string | number | bigint };

const MASK128 = (1n << 128n) - 1n;

function toBig(x: string | number | bigint): bigint {
  if (typeof x === "bigint") return x;
  const s = String(x).trim();
  return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
}

function dumpShape(v: unknown): string {
  try {
    return JSON.stringify(
      v,
      (_, val) => (typeof val === "bigint" ? `0x${val.toString(16)}` : val),
      2
    );
  } catch {
    return String(v);
  }
}

/** Accept {low,high} | [low,high] | BigNumberish | nested {price|value|0,1} */
function readU256(v: any): U256 {
  if (v == null) throw new Error("Unexpected u256: null/undefined");

  // direct BigNumberish
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    const b = toBig(v);
    return { low: b & MASK128, high: b >> 128n };
  }

  // array [low,high]
  if (Array.isArray(v) && v.length >= 2) return { low: v[0], high: v[1] };

  if (typeof v === "object") {
    // { low, high }
    if ("low" in v && "high" in v)
      return { low: (v as any).low, high: (v as any).high };
    // tuple-ish object {0:…,1:…}
    if (0 in (v as any) && 1 in (v as any))
      return { low: (v as any)[0], high: (v as any)[1] };
    // nested common fields
    if ("price" in v) return readU256((v as any).price);
    if ("value" in v) return readU256((v as any).value);
  }

  throw new Error(`Unexpected u256 shape:\n${dumpShape(v)}`);
}

function u256ToBigint(u: U256): bigint {
  return (toBig(u.high) << 128n) + toBig(u.low);
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
  active: boolean;
  price: CurrentPrice;
  config: AuctionConfig;
};

export type CreateAuctionServiceDeps = {
  provider?: ProviderInterface;
  address?: string;
  contract?: Contract; // if already built one elsewhere
};

export type AuctionService = ReturnType<typeof createAuctionService>;

/**
 * Factory: lets you inject provider/address/contract (devnet, testnet, tests).
 * Also export a default singleton below for convenience.
 */
export function createAuctionService(
  deps: {
    blockTag?: BlockTag;
    provider?: ProviderInterface;
    address?: string;
  } = {}
) {
  const blockIdentifier = deps.blockTag ?? getDefaultBlockTag();

  // keep contract as a Promise (createAuctionContract is async)
  const contractP = createAuctionContract({
    provider: deps.provider,
    address: deps.address,
  });

  // helper: call a 0-arg view with a blockIdentifier
  async function call0(name: string) {
    const c: any = await contractP;

    // 1) Prefer low-level Contract.call: (entrypoint, args, { blockIdentifier })
    try {
      return await c.call(name, [], { blockIdentifier });
    } catch (e1) {
      // 2) Try typed wrappers: options as first or second arg (different starknet.js versions)
      try {
        return await c[name]({ blockIdentifier });
      } catch (e2) {}
      try {
        return await c[name]({}, { blockIdentifier });
      } catch (e3) {}
      // 3) Last resort (will use provider default)
      return await c[name]();
    }
  }

  async function getCurrentPrice(): Promise<CurrentPrice> {
    const out = await call0(VIEW.GET_CURRENT_PRICE);
    const raw = readU256(out.price ?? out[0] ?? out);
    return normalizeU256(raw);
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

// Default singleton (uses whatever your contracts/auction.ts uses by default)
export const auctionService = createAuctionService();

import { Abi, Contract, RpcProvider } from "starknet";

// Minimal ABI slice for the views we need (Cairo 1 ABI style)
const PULSE_AUCTION_ABI = [
  {
    type: "function",
    name: "get_current_price",
    inputs: [],
    outputs: [{ name: "price", type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "curve_active",
    inputs: [],
    outputs: [{ name: "active", type: "core::bool" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_config",
    inputs: [],
    outputs: [
      { name: "open_time", type: "core::integer::u64" },
      { name: "genesis_price", type: "core::integer::u256" },
      { name: "genesis_floor", type: "core::integer::u256" },
      { name: "k", type: "core::integer::u256" },
      { name: "pts", type: "core::felt252" },
    ],
    state_mutability: "view",
  },
] as const satisfies Abi;

// ---------- helpers ----------
function toBigIntFromHexOrDec(x: string | bigint): bigint {
  if (typeof x === "bigint") return x;
  const s = x.toString().trim();
  return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
}
export function u256ToBigInt(u256: {
  low: string | bigint;
  high: string | bigint;
}): bigint {
  const low = toBigIntFromHexOrDec(u256.low);
  const high = toBigIntFromHexOrDec(u256.high);
  return (high << 128n) + low;
}
export function bigintToDecimalString(n: bigint): string {
  return n.toString(10);
}

// ---------- types ----------
export type AuctionConfig = {
  openTimeSec: number; // u64 as JS number (safe for near-future timestamps)
  genesisPrice: {
    raw: { low: string; high: string };
    asBigInt: bigint;
    asDec: string;
  };
  genesisFloor: {
    raw: { low: string; high: string };
    asBigInt: bigint;
    asDec: string;
  };
  k: { raw: { low: string; high: string }; asBigInt: bigint; asDec: string };
  pts: string; // felt252 -> string
};

export type CurrentPrice = {
  raw: { low: string; high: string };
  asBigInt: bigint;
  asDec: string;
};

export type AuctionSnapshot = {
  address: string;
  active: boolean;
  price: CurrentPrice;
  config: AuctionConfig;
};

// ---------- service factory ----------
export type AuctionServiceDeps = {
  provider?: RpcProvider;
  rpcUrl?: string; // used if provider not supplied
  auctionAddress?: string; // defaults to env
};

export class AuctionService {
  private provider: RpcProvider;
  private contract: Contract;
  public readonly address: string;

  constructor(deps: AuctionServiceDeps = {}) {
    // Prefer injected provider (from your existing pulseService), else build local RpcProvider
    const rpcUrl = deps.rpcUrl ?? import.meta.env.VITE_STARKNET_RPC;
    if (!deps.provider && !rpcUrl) {
      throw new Error("Missing RpcProvider or VITE_STARKNET_RPC");
    }
    this.provider = deps.provider ?? new RpcProvider({ nodeUrl: rpcUrl! });

    const addr = deps.auctionAddress ?? import.meta.env.VITE_PULSE_AUCTION;
    if (!addr) {
      throw new Error("Missing auction address (VITE_PULSE_AUCTION)");
    }
    this.address = addr;

    this.contract = new Contract(
      PULSE_AUCTION_ABI as unknown as Abi,
      this.address,
      this.provider
    );
  }

  async getCurrentPrice(): Promise<CurrentPrice> {
    // get_current_price() -> u256
    const res = await this.contract.get_current_price();
    // starknet.js returns structs with .low/.high (hex strings or decimals)
    const low = String(res.price.low);
    const high = String(res.price.high);
    const asBig = u256ToBigInt({ low, high });
    return {
      raw: { low, high },
      asBigInt: asBig,
      asDec: bigintToDecimalString(asBig),
    };
  }

  async getCurveActive(): Promise<boolean> {
    const r = await this.contract.curve_active();
    // r.active is boolean in starknet.js for Cairo bool
    return Boolean(r.active);
  }

  async getConfig(): Promise<AuctionConfig> {
    const r = await this.contract.get_config();
    const gpLow = String(r.genesis_price.low);
    const gpHigh = String(r.genesis_price.high);
    const gfLow = String(r.genesis_floor.low);
    const gfHigh = String(r.genesis_floor.high);
    const kLow = String(r.k.low);
    const kHigh = String(r.k.high);

    const gpBig = u256ToBigInt({ low: gpLow, high: gpHigh });
    const gfBig = u256ToBigInt({ low: gfLow, high: gfHigh });
    const kBig = u256ToBigInt({ low: kLow, high: kHigh });

    return {
      openTimeSec: Number(r.open_time),
      genesisPrice: {
        raw: { low: gpLow, high: gpHigh },
        asBigInt: gpBig,
        asDec: gpBig.toString(10),
      },
      genesisFloor: {
        raw: { low: gfLow, high: gfHigh },
        asBigInt: gfBig,
        asDec: gfBig.toString(10),
      },
      k: {
        raw: { low: kLow, high: kHigh },
        asBigInt: kBig,
        asDec: kBig.toString(10),
      },
      pts: String(r.pts),
    };
  }

  async snapshot(): Promise<AuctionSnapshot> {
    const [active, price, config] = await Promise.all([
      this.getCurveActive(),
      this.getCurrentPrice(),
      this.getConfig(),
    ]);
    return { address: this.address, active, price, config };
  }
}

// Optional: a default singleton that will read Vite envs
export const auctionService = new AuctionService();

// Tip: If you already expose a provider/addresses in `pulseServices.ts`,
// you can inject them: `new AuctionService({ provider: pulseProvider, auctionAddress })`.

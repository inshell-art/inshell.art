import type { Sale } from "@/types/types"; // { buyer, token_id, price, timestamp }

/* ---------- tiny deterministic RNG so mocks are reproducible ---------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- configuration type ---------- */
export interface PulseSalesConfig {
  /** total number of sale events to produce */
  count: number;
  /** unix‑seconds timestamp of the first sale */
  startTimestamp: number;
  /** total duration (seconds) across which sales are spread  */
  durationSec: number;
  /** first L2 block number */
  startBlock: number;
  /** auction economics */
  k: bigint;
  floor0: bigint;
  genesisPrice: bigint;
  pts: bigint;
  /** contract address that emits events */
  contract: string;
  /** poseidon hash of "Sale" (key[0]) */
  saleSelector: string;
  /** optional pool of buyers; will be cycled if shorter than `count` */
  buyerPool?: string[];
  /** optional RNG seed for reproducible mocks */
  seed?: number;
}

/* ---------- main generator ---------- */
export function generatePulseSales(cfg: PulseSalesConfig): Sale[] {
  const {
    count,
    startTimestamp,
    durationSec,
    startBlock,
    k,
    floor0,
    genesisPrice,
    pts,
    buyerPool = [
      "0x1111111111111111111111111111111111111111111111111111111111111111",
    ],
    seed = 42,
  } = cfg;

  const rand = mulberry32(seed);

  /* --- helper to compute the dynamically‑falling price floor --- */
  const floorAt = (dtSec: bigint) => floor0 + pts * dtSec;

  const sales: Sale[] = [];
  let timestamp = BigInt(startTimestamp);
  let block = startBlock;
  let tokenId = 0n;

  for (let i = 0; i < count; i++) {
    const buyer = buyerPool[i % buyerPool.length];

    /* Spread timestamps randomly but monotonically across duration */
    const jump = BigInt(Math.round(rand() * (durationSec / count)));
    timestamp += jump;

    /* price = max(floor(t), k / tokenId) – simplified example */
    const demandPrice = tokenId === 0n ? genesisPrice : k / tokenId; // Dutch curve
    const floorPrice = floorAt(timestamp - BigInt(startTimestamp));
    const price = demandPrice > floorPrice ? demandPrice : floorPrice;

    /* assemble the event object */
    sales.push({
      buyer,
      token_id: tokenId,
      price,
      timestamp,
    });

    /* advance state */
    tokenId++;
    block++;
  }

  /* Sort by timestamp just in case RNG produced ties */
  return sales.sort((a, b) => Number(a.timestamp - b.timestamp));
}

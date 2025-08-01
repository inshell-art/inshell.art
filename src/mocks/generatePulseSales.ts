export type PulseMockOpts = {
  sales: number | [number, number]; // count or range
  startTimestamp: number; // seconds
  duration?: [number, number]; // optional total span
  interval?: number | [number, number]; // or per‑sale span
  startBlock: number;
  k: bigint;
  floor0: bigint;
  genesisPrice: bigint;
  pts: bigint;
  contract: `0x${string}`; // hard‑coded once
  saleSelector: string; // event selector
  buyer?: `0x${string}`; // optional fixed buyer
};

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

/** 64‑byte hex string deterministically derived from an index */
const idxHash = (i: number) =>
  `0x${(i + 1).toString(16).padStart(64, "0")}` as const;

/** Default pseudo‑random buyer (constant) */
const DEFAULT_BUYER =
  "0xBEEF000000000000000000000000000000000000000000000000000000000000" as const;

/** Generate an array of Sale‑wrapper objects identical to starknet_getEvents */
export function generatePulseSales(opts: PulseMockOpts) {
  // ---------- resolve counts ----------
  const n =
    typeof opts.sales === "number"
      ? opts.sales
      : rand(opts.sales[0], opts.sales[1]);

  // ---------- build interval schedule ----------
  let intervals: number[] = [];
  if (opts.duration) {
    const total = rand(opts.duration[0], opts.duration[1]);
    // naive equal split then random jitter
    const base = Math.floor(total / (n - 1));
    intervals = Array.from({ length: n - 1 }, () => base);
    let leftover = total - base * (n - 1);
    let i = 0;
    while (leftover-- > 0) intervals[i++ % intervals.length] += 1;
  } else {
    const pick =
      typeof opts.interval === "number"
        ? () => opts.interval as number
        : () =>
            rand(
              (opts.interval as [number, number])[0],
              (opts.interval as [number, number])[1]
            );
    intervals = Array.from({ length: n - 1 }, () => pick());
  }

  // ---------- economic constants ----------
  const {
    startTimestamp,
    startBlock,
    k,
    floor0,
    genesisPrice,
    pts,
    contract,
    saleSelector,
    buyer = DEFAULT_BUYER,
  } = opts;

  let events = [];

  // state variables across rounds
  let t = startTimestamp;
  let blk = startBlock;
  let floor = floor0;
  let tokenId = 0;

  // helper to wrap event with RPC metadata
  const toU256 = (x: bigint) => {
    const low = x & ((1n << 128n) - 1n);
    const high = x >> 128n;
    return [`0x${low.toString(16)}`, `0x${high.toString(16)}`] as const;
  };

  const wrap = (price: bigint, ts: number, idx: number) => ({
    block_number: blk,
    block_hash: idxHash(idx),
    transaction_hash: idxHash(idx + 10_000),
    from_address: contract,
    keys: [
      saleSelector,
      buyer, // hard‑coded buyer
      `0x${tokenId.toString(16)}`, // token_id key
    ],
    data: [
      ...toU256(price), // price.low, price.high
      `0x${ts.toString(16)}`, // timestamp
    ],
  });

  // ---------- genesis sale ----------
  events.push(wrap(genesisPrice, t, 0));

  // derive anchor for first curve
  let a = t - Number(k / (genesisPrice - floor));

  // ---------- regular sales ----------
  intervals.forEach((Δ, idx) => {
    t += Δ;
    blk += 1;
    tokenId += 1;

    const price = k / (BigInt(t) - BigInt(a)) + floor; // y = k/(t‑a)+b
    events.push(wrap(price, t, idx + 1));

    // reset curve
    const premium = pts * BigInt(Δ);
    const ask0 = price + premium;
    floor = price;
    a = t - Number(k / (ask0 - floor));
  });

  return events;
}

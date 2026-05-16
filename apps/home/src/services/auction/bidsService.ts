import {
  decodeSaleLog,
  getBidEventSelectors,
  getBlock,
  getBlockNumber,
  getDefaultProvider,
  getLogs,
  type EthereumLog,
  type ProviderInterface,
} from "@inshell/ethereum";
import { toU256Num, type U256Num } from "@inshell/utils";

export type NormalizedBid = {
  key: string; // unique, stable
  atMs: number; // from block.timestamp when available
  bidder?: string;
  amount: U256Num; // compatible with your num helpers
  floorB?: U256Num; // Sale.floor_b when present
  anchorASec?: number; // Sale.anchor_a when present
  txHash?: string;
  id?: number;
  blockNumber?: number;
  epochIndex?: number;
  tokenId?: number;
};

const DEFAULT_LOG_CHUNK_SIZE = 40_000;
const MAX_LOG_FETCH_CONCURRENCY = 3;

function chunkRanges(
  startBlock: number,
  endBlock: number,
  chunkSize: number
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const size = Math.max(1, Math.trunc(chunkSize));
  for (let chunkStart = startBlock; chunkStart <= endBlock; chunkStart += size) {
    ranges.push([chunkStart, Math.min(endBlock, chunkStart + size - 1)]);
  }
  return ranges;
}

function inferProviderLogRangeLimit(error: unknown, currentSize: number): number | null {
  const msg = String((error as any)?.message ?? error ?? "");
  const explicitLimit = /up to a\s+(\d+)\s+block range/i.exec(msg);
  if (explicitLimit) {
    const parsed = Number(explicitLimit[1]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  const suggestedRange = /\[\s*(0x[0-9a-f]+|\d+)\s*,\s*(0x[0-9a-f]+|\d+)\s*\]/i.exec(msg);
  if (suggestedRange) {
    const from = Number(BigInt(suggestedRange[1]));
    const to = Number(BigInt(suggestedRange[2]));
    const span = to - from + 1;
    if (Number.isFinite(span) && span > 0) return Math.trunc(span);
  }

  if (
    /block range|range should work|too many blocks|exceed|empty response|invalid JSON/i.test(
      msg
    )
  ) {
    return Math.max(1, Math.floor(currentSize / 2));
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        out[index] = await worker(items[index]);
      }
    })
  );
  return out;
}

export function createBidsService(opts: {
  address: string;
  provider?: ProviderInterface; // explicit > env > fallback
  fromBlock?: number; // seed at deploy block in prod; 0 on devnet is fine
  maxBids?: number; // default 200
  chunkSize?: number; // default 40_000 blocks
  reorgDepth?: number; // default 2 blocks
}) {
  const address = opts.address;
  const provider: ProviderInterface = opts.provider ?? getDefaultProvider();
  const maxBids = opts.maxBids ?? 200;
  const initialChunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE);
  const reorgDepth = opts.reorgDepth ?? 2;
  const selectors = new Set(
    [...getBidEventSelectors()].map((s) => s.toLowerCase())
  );

  let lastBlock = opts.fromBlock;
  let effectiveChunkSize = initialChunkSize;
  let inFlight: Promise<NormalizedBid[]> | null = null;
  const seen = new Set<string>();
  let bids: NormalizedBid[] = [];
  const listeners = new Set<
    (snapshot: NormalizedBid[], appended: NormalizedBid[]) => void
  >();

  function emit(appended: NormalizedBid[]) {
    for (const fn of listeners) fn(bids, appended);
  }

  function onBids(
    fn: (snapshot: NormalizedBid[], appended: NormalizedBid[]) => void
  ) {
    listeners.add(fn);
    fn(bids, []);
    return () => listeners.delete(fn);
  }

  function getBids() {
    return bids.slice();
  }

  async function decode(ev: EthereumLog): Promise<NormalizedBid | null> {
    const decoded = decodeSaleLog(ev);
    if (!decoded?.lastPrice) return null;

    let atMs =
      typeof decoded.nowTs === "number" && Number.isFinite(decoded.nowTs)
        ? decoded.nowTs * 1000
        : undefined;
    if (!atMs) {
      try {
        const blockNumber = ev.blockNumber
          ? Number.parseInt(ev.blockNumber, 16)
          : NaN;
        const blk = await getBlock(
          provider,
          Number.isFinite(blockNumber) ? blockNumber : "latest"
        );
        if (blk?.timestamp) atMs = Number(blk.timestamp) * 1000;
      } catch {
        /* ignore */
      }
    }
    if (!atMs) atMs = Date.now();

    const amount = toU256Num({
      low: decoded.lastPrice.toString(10),
      high: "0",
    });
    const floorB =
      decoded.floorPrice != null
        ? toU256Num({ low: decoded.floorPrice.toString(10), high: "0" })
        : undefined;
    const txHash = ev.transactionHash;
    const key = txHash
      ? `tx:${txHash.toLowerCase()}`
      : `log:${ev.blockNumber ?? "na"}:${ev.logIndex ?? "na"}`;

    return {
      key,
      atMs,
      bidder: decoded.buyer,
      amount,
      floorB,
      anchorASec: decoded.anchorTime,
      txHash,
      id: ev.logIndex ? Number.parseInt(ev.logIndex, 16) : undefined,
      blockNumber: ev.blockNumber ? Number.parseInt(ev.blockNumber, 16) : undefined,
      epochIndex: decoded.epochIndex,
    };
  }

  async function fetchLogsAdaptive(
    startBlock: number,
    latestBlock: number
  ): Promise<EthereumLog[]> {
    let size = effectiveChunkSize;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const ranges = chunkRanges(startBlock, latestBlock, size);
      try {
        const batches = await mapWithConcurrency(
          ranges,
          MAX_LOG_FETCH_CONCURRENCY,
          ([fromBlock, toBlock]) =>
            getLogs(provider, {
              address,
              fromBlock,
              toBlock,
              topics: [...selectors],
            })
        );
        effectiveChunkSize = size;
        return batches.flat();
      } catch (err) {
        lastError = err;
        const nextSize = inferProviderLogRangeLimit(err, size);
        if (!nextSize || nextSize >= size) throw err;
        size = Math.max(1, nextSize);
      }
    }

    throw lastError ?? new Error("Unable to fetch auction logs.");
  }

  async function pullOnceInternal(): Promise<NormalizedBid[]> {
    const fresh: NormalizedBid[] = [];

    async function resolveFromBlock(): Promise<number> {
      if (typeof lastBlock === "number" && Number.isFinite(lastBlock)) {
        return Math.max(0, lastBlock - reorgDepth);
      }
      try {
        const latest = await getBlockNumber(provider);
        lastBlock = latest;
        return Math.max(0, latest - reorgDepth);
      } catch {
        lastBlock = 0;
        return 0;
      }
    }

    const startBlock = await resolveFromBlock();
    const latestBlock = await getBlockNumber(provider);
    if (startBlock > latestBlock) return fresh;

    const events = await fetchLogsAdaptive(startBlock, latestBlock);

    for (const ev of events) {
      const sel = (ev.topics?.[0] ?? "").toLowerCase();
      if (!selectors.has(sel)) continue;
      const row = await decode(ev);
      if (!row || seen.has(row.key)) continue;
      seen.add(row.key);
      fresh.push(row);
      if (typeof row.blockNumber === "number") {
        lastBlock = Math.max(lastBlock ?? 0, row.blockNumber + 1);
      }
    }

    lastBlock = Math.max(lastBlock ?? 0, latestBlock + 1);

    if (fresh.length) {
      bids = [...bids, ...fresh].sort((a, b) => a.atMs - b.atMs);
      if (bids.length > maxBids) bids = bids.slice(-maxBids);
      emit(fresh);
    }

    return fresh;
  }

  async function pullOnce(): Promise<NormalizedBid[]> {
    if (inFlight) return inFlight;
    inFlight = pullOnceInternal().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return { address, provider, onBids, getBids, pullOnce };
}

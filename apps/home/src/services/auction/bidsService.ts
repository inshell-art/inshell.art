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

const DEFAULT_LOG_CHUNK_SIZE = 5_000;
const MAX_LOG_FETCH_CONCURRENCY = 1;
const TIGHT_LOG_RANGE_THRESHOLD = 100;
const MAX_TIGHT_LOG_PULL_CHUNKS = 4;
const LOG_RATE_LIMIT_BACKOFF_MS = 45_000;
const BID_CACHE_VERSION = 5;
const BID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PULSE_AUCTION_API_URL = "/api/pulse-auction";

type SerializedBid = Omit<NormalizedBid, "amount" | "floorB"> & {
  amount: { raw?: { low: string; high: string }; dec?: string };
  floorB?: { raw?: { low: string; high: string }; dec?: string };
};

type CachedBidSnapshot = {
  version: typeof BID_CACHE_VERSION;
  savedAt: number;
  lastBlock?: number;
  complete?: boolean;
  bids: SerializedBid[];
};

type PulseAuctionApiPayload = {
  lastScannedBlock?: number;
  bids?: SerializedBid[];
};

type LogsFetchResult = {
  logs: EthereumLog[];
  scannedToBlock: number;
  complete: boolean;
};

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
    /block range|range is too large|range should work|too many blocks|exceed|empty response|invalid JSON/i.test(
      msg
    )
  ) {
    return Math.max(1, Math.floor(currentSize / 2));
  }
  return null;
}

function isRateLimitError(error: unknown): boolean {
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 429 || status === "429") return true;
  const msg = String((error as any)?.message ?? error ?? "");
  return /429|too many requests|rate limit/i.test(msg);
}

function bidCacheStorage(): typeof globalThis.localStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function bidCacheKey(address: string, fromBlock: number | undefined): string {
  return `inshell:pulse:bids:${address.toLowerCase()}:${fromBlock ?? "auto"}`;
}

function readPulseAuctionApiUrl() {
  const env = (globalThis as any).__VITE_ENV__ as Record<string, unknown> | undefined;
  const buildEnv = (globalThis as any).__INSHELL_VITE_ENV__ as Record<string, unknown> | undefined;
  const procEnv = (globalThis as any)?.process?.env as Record<string, unknown> | undefined;
  const value =
    env?.VITE_PULSE_AUCTION_API_URL ??
    buildEnv?.VITE_PULSE_AUCTION_API_URL ??
    procEnv?.VITE_PULSE_AUCTION_API_URL;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_PULSE_AUCTION_API_URL;
}

async function readBidsFromApi(): Promise<{
  bids: NormalizedBid[];
  lastScannedBlock?: number;
} | null> {
  if (typeof globalThis.fetch !== "function") return null;
  const response = await fetch(
    new globalThis.URL(readPulseAuctionApiUrl(), globalThis.location?.origin ?? "https://inshell.art").toString(),
    {
      headers: { accept: "application/json" },
      cache: "default",
    }
  );
  if (!response.ok) {
    throw new Error(`Pulse auction API unavailable: ${response.status}`);
  }
  const payload = (await response.json()) as PulseAuctionApiPayload;
  if (!Array.isArray(payload.bids)) {
    throw new Error("Pulse auction API returned invalid payload.");
  }
  return {
    bids: payload.bids
      .map((bid) => reviveBid(bid))
      .filter((bid): bid is NormalizedBid => Boolean(bid)),
    lastScannedBlock:
      typeof payload.lastScannedBlock === "number" && Number.isFinite(payload.lastScannedBlock)
        ? payload.lastScannedBlock
        : undefined,
  };
}

function serializeU256(value: U256Num | undefined) {
  if (!value) return undefined;
  return {
    raw: { low: String(value.raw.low), high: String(value.raw.high) },
    dec: value.dec,
  };
}

function reviveU256(value: SerializedBid["amount"] | undefined): U256Num | null {
  if (!value || typeof value !== "object") return null;
  if (
    value.raw &&
    typeof value.raw.low === "string" &&
    typeof value.raw.high === "string"
  ) {
    return toU256Num({ low: value.raw.low, high: value.raw.high });
  }
  if (typeof value.dec === "string") {
    return toU256Num({ low: value.dec, high: "0" });
  }
  return null;
}

function serializeBid(bid: NormalizedBid): SerializedBid {
  const out: SerializedBid = {
    key: bid.key,
    atMs: bid.atMs,
    bidder: bid.bidder,
    amount: serializeU256(bid.amount) ?? {
      raw: { low: "0", high: "0" },
      dec: "0",
    },
    floorB: serializeU256(bid.floorB),
    anchorASec: bid.anchorASec,
    txHash: bid.txHash,
    id: bid.id,
    blockNumber: bid.blockNumber,
    epochIndex: bid.epochIndex,
    tokenId: bid.tokenId,
  };
  return out;
}

function reviveBid(bid: SerializedBid): NormalizedBid | null {
  if (!bid || typeof bid !== "object") return null;
  if (typeof bid.key !== "string") return null;
  if (typeof bid.atMs !== "number" || !Number.isFinite(bid.atMs)) return null;
  const amount = reviveU256(bid.amount);
  if (!amount) return null;
  const floorB = reviveU256(bid.floorB);
  return {
    key: bid.key,
    atMs: bid.atMs,
    bidder: typeof bid.bidder === "string" ? bid.bidder : undefined,
    amount,
    floorB: floorB ?? undefined,
    anchorASec: typeof bid.anchorASec === "number" ? bid.anchorASec : undefined,
    txHash: typeof bid.txHash === "string" ? bid.txHash : undefined,
    id: typeof bid.id === "number" ? bid.id : undefined,
    blockNumber: typeof bid.blockNumber === "number" ? bid.blockNumber : undefined,
    epochIndex: typeof bid.epochIndex === "number" ? bid.epochIndex : undefined,
    tokenId: typeof bid.tokenId === "number" ? bid.tokenId : undefined,
  };
}

function readBidCache(
  address: string,
  fromBlock: number | undefined
): { bids: NormalizedBid[]; lastBlock?: number; complete: boolean } | null {
  const storage = bidCacheStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(bidCacheKey(address, fromBlock));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBidSnapshot;
    if (parsed.version !== BID_CACHE_VERSION) {
      storage.removeItem(bidCacheKey(address, fromBlock));
      return null;
    }
    if (
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > BID_CACHE_TTL_MS
    ) {
      storage.removeItem(bidCacheKey(address, fromBlock));
      return null;
    }
    if (!Array.isArray(parsed.bids)) return null;
    const cachedBids = parsed.bids
      .map((bid) => reviveBid(bid))
      .filter((bid): bid is NormalizedBid => Boolean(bid))
      .sort((a, b) => a.atMs - b.atMs);
    return {
      bids: cachedBids,
      lastBlock:
        typeof parsed.lastBlock === "number" && Number.isFinite(parsed.lastBlock)
          ? parsed.lastBlock
          : undefined,
      complete: parsed.complete === true,
    };
  } catch {
    return null;
  }
}

function writeBidCache(
  address: string,
  fromBlock: number | undefined,
  snapshot: NormalizedBid[],
  lastBlock: number | undefined,
  complete: boolean
) {
  const storage = bidCacheStorage();
  if (!storage) return;
  try {
    const payload: CachedBidSnapshot = {
      version: BID_CACHE_VERSION,
      savedAt: Date.now(),
      lastBlock:
        typeof lastBlock === "number" && Number.isFinite(lastBlock)
          ? lastBlock
          : undefined,
      complete,
      bids: snapshot.map((bid) => serializeBid(bid)),
    };
    storage.setItem(bidCacheKey(address, fromBlock), JSON.stringify(payload));
  } catch {
    /* localStorage can be full or blocked; the live RPC path still works. */
  }
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
  chunkSize?: number; // default 5_000 blocks
  reorgDepth?: number; // default 2 blocks
}) {
  const address = opts.address;
  const provider: ProviderInterface = opts.provider ?? getDefaultProvider();
  const useCacheApi = !opts.provider;
  const maxBids = opts.maxBids ?? 200;
  const initialChunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE);
  const reorgDepth = opts.reorgDepth ?? 2;
  const selectors = new Set(
    [...getBidEventSelectors()].map((s) => s.toLowerCase())
  );

  let lastBlock = opts.fromBlock;
  let effectiveChunkSize = initialChunkSize;
  let nextLogAttemptAt = 0;
  let inFlight: Promise<NormalizedBid[]> | null = null;
  const seen = new Set<string>();
  let bids: NormalizedBid[] = [];
  const cached = readBidCache(address, opts.fromBlock);
  if (cached) {
    bids = cached.bids.slice(-maxBids);
    for (const bid of bids) seen.add(bid.key);
    if (cached.complete && typeof cached.lastBlock === "number") {
      lastBlock = cached.lastBlock;
    }
  }
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
  ): Promise<LogsFetchResult> {
    if (Date.now() < nextLogAttemptAt) {
      return { logs: [], scannedToBlock: startBlock - 1, complete: false };
    }

    let size = effectiveChunkSize;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const allRanges = chunkRanges(startBlock, latestBlock, size);
      const limited =
        size <= TIGHT_LOG_RANGE_THRESHOLD &&
        allRanges.length > MAX_TIGHT_LOG_PULL_CHUNKS;
      const ranges = limited
        ? allRanges.slice(0, MAX_TIGHT_LOG_PULL_CHUNKS)
        : allRanges;
      const scannedToBlock =
        ranges.length > 0 ? ranges[ranges.length - 1][1] : startBlock - 1;
      try {
        const batches = await mapWithConcurrency(
          ranges,
          size <= TIGHT_LOG_RANGE_THRESHOLD ? 1 : MAX_LOG_FETCH_CONCURRENCY,
          ([fromBlock, toBlock]) =>
            getLogs(provider, {
              address,
              fromBlock,
              toBlock,
              topics: [...selectors],
            })
        );
        effectiveChunkSize = size;
        return {
          logs: batches.flat(),
          scannedToBlock,
          complete: scannedToBlock >= latestBlock,
        };
      } catch (err) {
        lastError = err;
        if (isRateLimitError(err)) {
          nextLogAttemptAt = Date.now() + LOG_RATE_LIMIT_BACKOFF_MS;
          return { logs: [], scannedToBlock: startBlock - 1, complete: false };
        }
        const nextSize = inferProviderLogRangeLimit(err, size);
        if (!nextSize || nextSize >= size) throw err;
        size = Math.max(1, nextSize);
      }
    }

    throw lastError ?? new Error("Unable to fetch auction logs.");
  }

  async function pullOnceInternal(): Promise<NormalizedBid[]> {
    const fresh: NormalizedBid[] = [];

    if (useCacheApi) {
      try {
        const apiSnapshot = await readBidsFromApi();
        if (apiSnapshot) {
          for (const bid of apiSnapshot.bids) {
            if (seen.has(bid.key)) continue;
            seen.add(bid.key);
            fresh.push(bid);
          }
          if (typeof apiSnapshot.lastScannedBlock === "number") {
            lastBlock = Math.max(lastBlock ?? 0, apiSnapshot.lastScannedBlock + 1);
          }
          if (fresh.length) {
            bids = [...bids, ...fresh].sort((a, b) => a.atMs - b.atMs);
            if (bids.length > maxBids) bids = bids.slice(-maxBids);
            writeBidCache(address, opts.fromBlock, bids, lastBlock, true);
            emit(fresh);
          } else {
            writeBidCache(address, opts.fromBlock, bids, lastBlock, true);
          }
          return fresh;
        }
      } catch {
        // Fall back to direct sale log reads when the cached API is unavailable.
      }
    }

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
    let latestBlock: number;
    try {
      latestBlock = await getBlockNumber(provider);
    } catch (err) {
      if (isRateLimitError(err)) {
        nextLogAttemptAt = Date.now() + LOG_RATE_LIMIT_BACKOFF_MS;
        return fresh;
      }
      throw err;
    }
    if (startBlock > latestBlock) return fresh;

    const result = await fetchLogsAdaptive(startBlock, latestBlock);
    const events = result.logs;

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

    const scannedToBlock = result.complete ? latestBlock : result.scannedToBlock;
    lastBlock = Math.max(lastBlock ?? 0, scannedToBlock + 1);

    if (fresh.length) {
      bids = [...bids, ...fresh].sort((a, b) => a.atMs - b.atMs);
      if (bids.length > maxBids) bids = bids.slice(-maxBids);
      writeBidCache(address, opts.fromBlock, bids, lastBlock, result.complete);
      emit(fresh);
    } else if (result.complete) {
      writeBidCache(address, opts.fromBlock, bids, lastBlock, true);
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

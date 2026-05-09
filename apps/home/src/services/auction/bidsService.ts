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
  const chunkSize = Math.max(1, opts.chunkSize ?? 40_000);
  const reorgDepth = opts.reorgDepth ?? 2;
  const selectors = new Set(
    [...getBidEventSelectors()].map((s) => s.toLowerCase())
  );

  let lastBlock = opts.fromBlock;
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

  async function pullOnce(): Promise<NormalizedBid[]> {
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

    for (
      let chunkStart = startBlock;
      chunkStart <= latestBlock;
      chunkStart += chunkSize
    ) {
      const chunkEnd = Math.min(latestBlock, chunkStart + chunkSize - 1);
      const events = await getLogs(provider, {
        address,
        fromBlock: chunkStart,
        toBlock: chunkEnd,
        topics: [...selectors],
      });

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
    }

    lastBlock = Math.max(lastBlock ?? 0, latestBlock + 1);

    if (fresh.length) {
      bids = [...bids, ...fresh].sort((a, b) => a.atMs - b.atMs);
      if (bids.length > maxBids) bids = bids.slice(-maxBids);
      emit(fresh);
    }

    return fresh;
  }

  return { address, provider, onBids, getBids, pullOnce };
}

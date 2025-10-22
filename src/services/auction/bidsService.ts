import { RpcProvider, type ProviderInterface } from "starknet";
import { getDefaultProvider } from "@/protocol/contracts";
import { toU256Num, type U256Num } from "@/num";
import { getBidEventSelectors } from "@/protocol/events";
import { PulseAuctionAbi } from "@/abi/typed/PulseAuction.abi";

export type NormalizedBid = {
  key: string; // unique, stable
  atMs: number; // from block.timestamp when available
  bidder?: string;
  amount: U256Num; // compatible with your num helpers
  txHash?: string;
  id?: number;
  blockNumber?: number;
};

export function createBidsService(opts: {
  address: string;
  provider?: ProviderInterface; // explicit > env > fallback
  fromBlock?: number; // seed at deploy block in prod; 0 on devnet is fine
  maxBids?: number; // default 200
  chunkSize?: number; // default 200
  reorgDepth?: number; // default 2 blocks
}) {
  const address = opts.address;
  const provider: ProviderInterface = opts.provider ?? getDefaultProvider();
  const maxBids = opts.maxBids ?? 200;
  const chunkSize = opts.chunkSize ?? 200;
  const reorgDepth = opts.reorgDepth ?? 2;
  const selectors = new Set(
    [...getBidEventSelectors(PulseAuctionAbi)].map((s) => s.toLowerCase())
  ); // Normalize selectors to lowercase

  let lastBlock = opts.fromBlock ?? 0;
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

  async function decode(ev: any): Promise<NormalizedBid | null> {
    const dataArr: string[] = ev.data ?? [];
    const keysArr: string[] = ev.keys ?? [];

    if (dataArr.length < 2) return null;

    // Prefer ABI-aware decode for PulseAuction::Sale:
    // data = [price.low, price.high, timestamp]
    // keys = [selector, buyer, (token_id.low?), (token_id.high?)]
    let amount = toU256Num({ low: dataArr[0], high: dataArr[1] });
    let atMs: number | undefined;

    // Timestamp felt when present
    if (dataArr.length >= 3) {
      const tsFelt = dataArr[2];
      const tsNum = Number(tsFelt);
      if (Number.isFinite(tsNum) && tsNum > 0) atMs = tsNum * 1000;
    }

    // Fallbacks if layout differs
    if (!atMs) {
      try {
        const blk = await provider.getBlock(ev.block_hash ?? ev.block_number);
        if (blk?.timestamp) atMs = Number(blk.timestamp) * 1000;
      } catch {
        /* ignore */
      }
    }
    if (!atMs) atMs = Date.now();

    const bidder = keysArr[1]?.startsWith("0x")
      ? keysArr[1]
      : dataArr[0]?.startsWith("0x")
      ? dataArr[0]
      : undefined;

    const txHash: string | undefined = ev.transaction_hash ?? ev.tx_hash;
    const sel = (ev.keys?.[0] ?? "").toLowerCase();
    const key = txHash
      ? `tx:${txHash.toLowerCase()}`
      : `mix:${sel}|${amount.raw.low}|${amount.raw.high}|${atMs}`;

    return {
      key,
      atMs,
      bidder,
      amount,
      txHash,
      id: ev.event_id ?? ev.index,
      blockNumber:
        typeof ev.block_number === "number" ? ev.block_number : undefined,
    };
  }

  async function pullOnce(): Promise<NormalizedBid[]> {
    const fresh: NormalizedBid[] = [];
    let token: string | undefined;
    const from_block = { block_number: Math.max(0, lastBlock - reorgDepth) };

    type EventsChunk = Awaited<ReturnType<RpcProvider["getEvents"]>>;

    do {
      const res: EventsChunk = await (provider as RpcProvider).getEvents({
        address,
        from_block,
        to_block: "latest",
        keys: [], // filter locally for robustness across ABIs
        chunk_size: chunkSize,
        continuation_token: token,
      });

      for (const ev of res.events ?? []) {
        const sel = (ev.keys?.[0] ?? "").toLowerCase();
        const looksLikeBid = selectors.has(sel);

        if (!looksLikeBid) continue;

        const row = await decode(ev);
        if (!row) continue;

        if (!seen.has(row.key)) {
          seen.add(row.key);
          fresh.push(row);
        }

        if (typeof ev.block_number === "number") {
          lastBlock = Math.max(lastBlock, ev.block_number + 1);
        }
      }

      token = res.continuation_token;
    } while (token);

    if (fresh.length) {
      bids = [...bids, ...fresh].sort((a, b) => a.atMs - b.atMs);
      if (bids.length > maxBids) bids = bids.slice(-maxBids);
      emit(fresh);
    }

    return fresh;
  }

  return { address, provider, onBids, getBids, pullOnce };
}

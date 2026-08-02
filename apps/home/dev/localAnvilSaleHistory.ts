import fs from "node:fs/promises";

const PULSE_SALE_TOPIC =
  "0xa789468a0212cbe853fbdd6011d2ee7d85144ebc1d67c7dd82f087a970d9593d";

type AnvilRawLog = {
  topics?: unknown;
  data?: unknown;
};

type AnvilTrace = {
  trace?: { address?: unknown };
  logs?: Array<{
    raw_log?: AnvilRawLog;
    index?: unknown;
  }>;
};

type AnvilTransaction = {
  block_number?: unknown;
  info?: {
    transaction_hash?: unknown;
    traces?: AnvilTrace[];
  };
};

type AnvilState = {
  best_block_number?: unknown;
  transactions?: AnvilTransaction[] | Record<string, AnvilTransaction>;
};

export type LocalAnvilSaleBid = {
  key: string;
  atMs: number;
  bidder?: string;
  amount: { dec: string };
  floorB: { dec: string };
  anchorASec: number;
  txHash: string;
  id?: number;
  blockNumber?: number;
  epochIndex: number;
  tokenId: number;
};

export type LocalAnvilSaleHistory = {
  lastScannedBlock?: number;
  bids: LocalAnvilSaleBid[];
};

function parseSafeNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseHexWord(word: string): bigint | null {
  if (!/^[0-9a-f]{64}$/i.test(word)) return null;
  try {
    return BigInt(`0x${word}`);
  } catch {
    return null;
  }
}

function parseSafeHexNumber(word: string): number | null {
  const value = parseHexWord(word);
  if (value === null || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]{40}$/i.test(value)) {
    return null;
  }
  return value.toLowerCase();
}

export function extractLocalAnvilSaleHistory(
  state: AnvilState,
  auctionAddress: string
): LocalAnvilSaleHistory {
  const expectedAddress = normalizeAddress(auctionAddress);
  if (!expectedAddress) {
    throw new Error(`Invalid local PulseAuction address: ${auctionAddress}`);
  }

  const transactions = Array.isArray(state.transactions)
    ? state.transactions
    : state.transactions && typeof state.transactions === "object"
      ? Object.values(state.transactions)
      : [];
  const byKey = new Map<string, LocalAnvilSaleBid>();

  for (const transaction of transactions) {
    const txHash =
      typeof transaction.info?.transaction_hash === "string"
        ? transaction.info.transaction_hash.toLowerCase()
        : null;
    if (!txHash || !/^0x[0-9a-f]{64}$/.test(txHash)) continue;

    for (const trace of transaction.info?.traces ?? []) {
      if (normalizeAddress(trace.trace?.address) !== expectedAddress) continue;

      for (const entry of trace.logs ?? []) {
        const rawLog = entry.raw_log;
        const topics = Array.isArray(rawLog?.topics)
          ? rawLog.topics.filter((topic): topic is string => typeof topic === "string")
          : [];
        if (topics[0]?.toLowerCase() !== PULSE_SALE_TOPIC) continue;
        if (typeof rawLog?.data !== "string" || !/^0x[0-9a-f]+$/i.test(rawLog.data)) {
          continue;
        }

        const words = rawLog.data.slice(2).match(/.{64}/g) ?? [];
        const [priceWord, timestampWord, anchorTimeWord, floorPriceWord] = words;
        const epochTopic = topics[2];
        if (
          !priceWord ||
          !timestampWord ||
          !anchorTimeWord ||
          !floorPriceWord ||
          !epochTopic
        ) {
          continue;
        }
        const epochIndex = parseSafeHexNumber(epochTopic.slice(2));
        const price = parseHexWord(priceWord);
        const timestamp = parseSafeHexNumber(timestampWord);
        const anchorTime = parseSafeHexNumber(anchorTimeWord);
        const floorPrice = parseHexWord(floorPriceWord);
        if (
          epochIndex === null ||
          price === null ||
          timestamp === null ||
          anchorTime === null ||
          floorPrice === null
        ) {
          continue;
        }

        const rawIndex = parseSafeNumber(entry.index);
        const key = `tx:${txHash}`;
        byKey.set(key, {
          key,
          atMs: timestamp * 1000,
          bidder:
            topics[1] && /^0x[0-9a-f]{64}$/i.test(topics[1])
              ? `0x${topics[1].slice(-40).toLowerCase()}`
              : undefined,
          amount: { dec: price.toString(10) },
          floorB: { dec: floorPrice.toString(10) },
          anchorASec: anchorTime,
          txHash,
          id: rawIndex,
          blockNumber: parseSafeNumber(transaction.block_number),
          epochIndex,
          tokenId: epochIndex,
        });
      }
    }
  }

  return {
    lastScannedBlock: parseSafeNumber(state.best_block_number),
    bids: [...byKey.values()].sort(
      (left, right) =>
        left.atMs - right.atMs || left.epochIndex - right.epochIndex
    ),
  };
}

export async function readLocalAnvilSaleHistory(
  stateFile: string,
  auctionAddress: string
): Promise<LocalAnvilSaleHistory> {
  const state = JSON.parse(await fs.readFile(stateFile, "utf8")) as AnvilState;
  return extractLocalAnvilSaleHistory(state, auctionAddress);
}

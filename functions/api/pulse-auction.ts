import {
  PULSE_AUCTION_ADDRESS,
  PULSE_AUCTION_DEPLOY_BLOCK,
  PULSE_SALE_TOPIC,
  createChainCacheDiagnostics,
  createStats,
  emitUsage,
  getBlockNumber,
  getLogsChunked,
  getTransactionReceipt,
  hexToNumber,
  isTxHash,
  json,
  onOptions,
  pruneReorgWindow,
  readModelEnabled,
  readSnapshot,
  readResponseCache,
  refreshFromBlock,
  safeNumber,
  sortByBlockLog,
  topicToAddress,
  topicToBigInt,
  u256,
  withChainCacheDiagnostics,
  writeResponseCache,
  writeSnapshot,
  type ChainCacheDiagnostics,
  type ChainCacheEnv,
  type ChainLog,
  type IndexedSnapshot,
  type PagesContextLike,
  type PulseBidApiItem,
} from "./chain-cache";

const SNAPSHOT_KEY = "pulse-auction:v1:sepolia";
const RESPONSE_CACHE_SECONDS = 20;
const EDGE_SNAPSHOT_SECONDS = 5 * 60;

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const diagnostics = createChainCacheDiagnostics(SNAPSHOT_KEY);
  const cached = await readResponseCache(ctx, SNAPSHOT_KEY);
  if (cached) {
    diagnostics.source = "edge";
    return withChainCacheDiagnostics(ctx, cached, diagnostics);
  }

  const previous = await readSnapshot<PulseBidApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (previous && readModelEnabled(ctx.env)) {
    const response = responseFromSnapshot(previous);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, previous.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, undefined, previous);
  }

  const stats = createStats("path", "pulse-auction", ctx.env);
  try {
    const snapshot = await loadPulseAuction(ctx.env, ctx, stats, diagnostics, previous);
    emitUsage(ctx, stats);
    const response = responseFromSnapshot(snapshot);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, snapshot.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, stats, snapshot);
  } catch {
    emitUsage(ctx, stats);
    return json(500, {
      error: "pulse auction unavailable",
    });
  }
}

async function loadPulseAuction(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  previousOverride?: IndexedSnapshot<PulseBidApiItem> | null,
  force = false,
): Promise<IndexedSnapshot<PulseBidApiItem>> {
  const previous =
    previousOverride === undefined
      ? await readSnapshot<PulseBidApiItem>(env, SNAPSHOT_KEY, diagnostics)
      : previousOverride;
  if (!force && previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
    return previous;
  }

  const latestBlock = await getBlockNumber(env, "path", stats);
  const refreshStart = refreshFromBlock(previous, PULSE_AUCTION_DEPLOY_BLOCK, latestBlock);
  const logs = await getLogsChunked(env, "path", stats, {
    address: PULSE_AUCTION_ADDRESS,
    fromBlock: refreshStart,
    toBlock: latestBlock,
    topics: [PULSE_SALE_TOPIC],
  });

  const snapshot = mergePulseSnapshot(previous, logs, refreshStart, latestBlock);
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS, diagnostics, previous);
  return snapshot;
}

export async function refreshPulseAuction(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
) {
  const snapshot = await loadPulseAuction(ctx.env, ctx, stats, diagnostics, undefined, true);
  writeResponseCache(
    ctx,
    SNAPSHOT_KEY,
    responseFromSnapshot(snapshot),
    RESPONSE_CACHE_SECONDS,
    snapshot.lastScannedBlock,
  );
  return snapshot;
}

export async function refreshPulseAuctionForTx(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  txHash: string,
) {
  if (!isTxHash(txHash)) throw new Error("invalid transaction hash");
  const normalizedTxHash = txHash.toLowerCase();
  const previous = await readSnapshot<PulseBidApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (previous?.items.some((item) => item.txHash?.toLowerCase() === normalizedTxHash)) {
    return previous;
  }

  const receipt = await getTransactionReceipt(ctx.env, "path", stats, txHash);
  if ((receipt?.to ?? "").toLowerCase() !== PULSE_AUCTION_ADDRESS.toLowerCase()) {
    throw new Error("transaction is not a pulse auction transaction");
  }
  if (receipt.status && receipt.status !== "0x1") {
    throw new Error("transaction did not succeed");
  }
  const txBlock = hexToNumber(receipt?.blockNumber);
  if (!Number.isFinite(txBlock) || txBlock <= 0) {
    throw new Error("transaction receipt unavailable");
  }

  const latestBlock = await getBlockNumber(ctx.env, "path", stats);
  const refreshStart = Math.max(PULSE_AUCTION_DEPLOY_BLOCK, txBlock - 3);
  const refreshEnd = Math.min(latestBlock, txBlock + 3);
  const logs = await getLogsChunked(ctx.env, "path", stats, {
    address: PULSE_AUCTION_ADDRESS,
    fromBlock: refreshStart,
    toBlock: refreshEnd,
    topics: [PULSE_SALE_TOPIC],
  });

  const previousLastScanned = previous?.lastScannedBlock ?? refreshEnd;
  const continuousRefresh =
    !previous || refreshStart <= previous.lastScannedBlock + 1;
  const nextLastScanned = continuousRefresh
    ? Math.max(previousLastScanned, refreshEnd)
    : previousLastScanned;
  const snapshot = mergePulseSnapshot(previous, logs, refreshStart, nextLastScanned);
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS, diagnostics, previous);
  writeResponseCache(
    ctx,
    SNAPSHOT_KEY,
    responseFromSnapshot(snapshot),
    RESPONSE_CACHE_SECONDS,
    snapshot.lastScannedBlock,
  );
  return snapshot;
}

function mergePulseSnapshot(
  previous: IndexedSnapshot<PulseBidApiItem> | null | undefined,
  logs: ChainLog[],
  refreshStart: number,
  lastScannedBlock: number,
) {
  const bids = new Map<string, PulseBidApiItem>();
  for (const item of pruneReorgWindow(previous?.items ?? [], refreshStart)) {
    bids.set(item.key, item);
  }
  for (const log of logs.sort(sortByBlockLog)) {
    if (log.removed) continue;
    const bid = decodeSaleLog(log);
    if (bid) bids.set(bid.key, bid);
  }

  const snapshot: IndexedSnapshot<PulseBidApiItem> = {
    version: 1,
    cachedAt: Date.now(),
    chainId: 11155111,
    contract: PULSE_AUCTION_ADDRESS,
    fromBlock: PULSE_AUCTION_DEPLOY_BLOCK,
    lastScannedBlock,
    items: [...bids.values()].sort((left, right) => left.atMs - right.atMs),
  };
  return snapshot;
}

function responseFromSnapshot(snapshot: IndexedSnapshot<PulseBidApiItem>) {
  return json(
    200,
    {
      cachedAt: snapshot.cachedAt,
      chainId: snapshot.chainId,
      contract: snapshot.contract,
      fromBlock: snapshot.fromBlock,
      lastScannedBlock: snapshot.lastScannedBlock,
      bids: snapshot.items,
    },
    RESPONSE_CACHE_SECONDS,
  );
}

function decodeSaleLog(log: ChainLog): PulseBidApiItem | null {
  if ((log.topics[0] ?? "").toLowerCase() !== PULSE_SALE_TOPIC) return null;
  const words = (log.data.startsWith("0x") ? log.data.slice(2) : log.data).match(/.{1,64}/g) ?? [];
  if (words.length < 4) return null;
  const price = BigInt(`0x${words[0]}`);
  const nowTs = Number(BigInt(`0x${words[1]}`));
  const anchor = Number(BigInt(`0x${words[2]}`));
  const floor = BigInt(`0x${words[3]}`);
  const txHash = log.transactionHash;
  const blockNumber = hexToNumber(log.blockNumber);
  const logIndex = hexToNumber(log.logIndex);
  const epochIndex = safeNumber(topicToBigInt(log.topics[2])) ?? undefined;
  return {
    key: txHash ? `tx:${txHash.toLowerCase()}` : `log:${log.blockNumber ?? "na"}:${log.logIndex ?? "na"}`,
    atMs: Number.isFinite(nowTs) && nowTs > 0 ? nowTs * 1000 : Date.now(),
    bidder: topicToAddress(log.topics[1]),
    amount: u256(price),
    floorB: u256(floor),
    anchorASec: Number.isFinite(anchor) ? anchor : undefined,
    txHash,
    id: Number.isFinite(logIndex) ? logIndex : undefined,
    blockNumber: Number.isFinite(blockNumber) ? blockNumber : undefined,
    epochIndex,
  };
}

import {
  PULSE_AUCTION_ADDRESS,
  PULSE_AUCTION_DEPLOY_BLOCK,
  PULSE_SALE_TOPIC,
  createChainCacheDiagnostics,
  createStats,
  emitUsage,
  getBlockNumber,
  getLogsChunked,
  hexToNumber,
  json,
  onOptions,
  pruneReorgWindow,
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

  const stats = createStats("path", "pulse-auction", ctx.env);
  try {
    const snapshot = await loadPulseAuction(ctx.env, ctx, stats, diagnostics);
    emitUsage(ctx, stats);
    const response = json(
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
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, snapshot.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, stats, snapshot);
  } catch (error) {
    emitUsage(ctx, stats);
    return json(500, {
      error: "pulse auction unavailable",
      message: String((error as Error)?.message ?? error),
    });
  }
}

async function loadPulseAuction(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
): Promise<IndexedSnapshot<PulseBidApiItem>> {
  const previous = await readSnapshot<PulseBidApiItem>(env, SNAPSHOT_KEY, diagnostics);
  if (previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
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
    lastScannedBlock: latestBlock,
    items: [...bids.values()].sort((left, right) => left.atMs - right.atMs),
  };
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS, diagnostics, previous);
  return snapshot;
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

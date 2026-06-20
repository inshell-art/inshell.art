import {
  PATH_METADATA_UPDATE_TOPIC,
  PATH_MOVEMENT_CONSUMED_TOPIC,
  PATH_NFT_ADDRESS,
  PATH_NFT_DEPLOY_BLOCK,
  PATH_THOUGHT_CONSUMED_TOPIC,
  THOUGHT_NFT_ADDRESS,
  TRANSFER_TOPIC,
  chainFailure,
  createChainCacheDiagnostics,
  createStats,
  decodeAddressResult,
  decodeStringResult,
  emitUsage,
  ethCall,
  getBlockNumber,
  getLogsChunked,
  hexToNumber,
  json,
  metadataString,
  onOptions,
  ownerOfData,
  parseMetadata,
  pruneReorgWindow,
  readModelEnabled,
  readSnapshot,
  readResponseCache,
  refreshFromBlock,
  sortByBlockLog,
  sortByTokenId,
  tokenUriData,
  topicToAddress,
  topicToBigInt,
  withChainCacheDiagnostics,
  writeResponseCache,
  writeSnapshot,
  type ChainCacheDiagnostics,
  type ChainCacheEnv,
  type ChainLog,
  type IndexedSnapshot,
  type PagesContextLike,
  type PathTokenApiItem,
} from "./chain-cache";

const SNAPSHOT_KEY = "path-tokens:v1:sepolia";
const RESPONSE_CACHE_SECONDS = 60;
const EDGE_SNAPSHOT_SECONDS = 10 * 60;
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

type TargetedPathTokenEvent = {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  contractAddress: string;
  topic0: string;
};

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const diagnostics = createChainCacheDiagnostics(SNAPSHOT_KEY);
  const cached = await readResponseCache(ctx, SNAPSHOT_KEY);
  if (cached) {
    diagnostics.source = "edge";
    return withChainCacheDiagnostics(ctx, cached, diagnostics);
  }

  const previous = await readSnapshot<PathTokenApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (previous && readModelEnabled(ctx.env)) {
    const response = responseFromSnapshot(previous);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, previous.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, undefined, previous);
  }

  const stats = createStats("path", "path-tokens", ctx.env);
  try {
    const snapshot = await loadPathTokens(ctx.env, ctx, stats, diagnostics, previous);
    emitUsage(ctx, stats);
    const response = responseFromSnapshot(snapshot);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, snapshot.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, stats, snapshot);
  } catch {
    emitUsage(ctx, stats);
    return json(500, {
      error: "PATH tokens unavailable",
    });
  }
}

async function loadPathTokens(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  previousOverride?: IndexedSnapshot<PathTokenApiItem> | null,
  force = false,
): Promise<IndexedSnapshot<PathTokenApiItem>> {
  const previous =
    previousOverride === undefined
      ? await readSnapshot<PathTokenApiItem>(env, SNAPSHOT_KEY, diagnostics)
      : previousOverride;
  if (!force && previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
    return previous;
  }

  const latestBlock = await getBlockNumber(env, "path", stats);
  const refreshStart = refreshFromBlock(previous, PATH_NFT_DEPLOY_BLOCK, latestBlock);
  const logs = await getLogsChunked(env, "path", stats, {
    address: PATH_NFT_ADDRESS,
    fromBlock: refreshStart,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC],
  });

  const tokens = new Map<string, PathTokenApiItem>();
  for (const item of pruneReorgWindow(previous?.items ?? [], refreshStart)) {
    tokens.set(item.tokenId, item);
  }

  for (const log of logs.sort(sortByBlockLog)) {
    if (log.removed) continue;
    const tokenId = topicToBigInt(log.topics[3]);
    if (tokenId == null) continue;
    const tokenIdLabel = tokenId.toString();
    const to = lowerTopicAddress(log.topics[2]);
    if (to === ZERO_TOPIC) {
      tokens.delete(tokenIdLabel);
      continue;
    }
    const existing = tokens.get(tokenIdLabel);
    tokens.set(tokenIdLabel, {
      tokenId: tokenIdLabel,
      tokenIdLabel,
      owner: topicToAddress(log.topics[2]),
      tokenUri: existing?.tokenUri ?? "",
      metadata: existing?.metadata ?? {},
      blockNumber: hexToNumber(log.blockNumber),
      txHash: log.transactionHash,
    });
  }

  for (const item of tokens.values()) {
    try {
      item.owner = normalizeAddressResult(
        await ethCall(env, "path", stats, PATH_NFT_ADDRESS, ownerOfData(item.tokenId)),
      );
    } catch {
      // Keep the last Transfer owner if ownerOf is temporarily unavailable.
    }
    if (!item.tokenUri) {
      try {
        item.tokenUri = decodeStringResult(
          await ethCall(env, "path", stats, PATH_NFT_ADDRESS, tokenUriData(item.tokenId)),
        );
        item.metadata = parseMetadata(item.tokenUri);
      } catch {
        item.tokenUri = "";
        item.metadata = {};
      }
    }
    if (!metadataString(item.metadata.name)) {
      item.metadata = parseMetadata(item.tokenUri);
    }
  }

  const snapshot: IndexedSnapshot<PathTokenApiItem> = {
    version: 1,
    cachedAt: Date.now(),
    chainId: 11155111,
    contract: PATH_NFT_ADDRESS,
    fromBlock: PATH_NFT_DEPLOY_BLOCK,
    lastScannedBlock: latestBlock,
    items: sortByTokenId([...tokens.values()]),
  };
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS, diagnostics, previous);
  return snapshot;
}

export async function refreshPathTokens(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
) {
  const snapshot = await loadPathTokens(ctx.env, ctx, stats, diagnostics, undefined, true);
  writeResponseCache(
    ctx,
    SNAPSHOT_KEY,
    responseFromSnapshot(snapshot),
    RESPONSE_CACHE_SECONDS,
    snapshot.lastScannedBlock,
  );
  return snapshot;
}

export async function refreshPathTokensForEvent(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  event: TargetedPathTokenEvent,
) {
  const previous = await readSnapshot<PathTokenApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (
    event.topic0 === TRANSFER_TOPIC &&
    event.contractAddress === PATH_NFT_ADDRESS.toLowerCase() &&
    previous?.items.some((item) => item.txHash?.toLowerCase() === event.txHash.toLowerCase())
  ) {
    return previous;
  }

  const log = await readPathTokenEventLog(ctx.env, stats, event);
  const tokenId = tokenIdFromPathEvent(event, log);
  if (!tokenId) {
    throw chainFailure("path token event did not identify a PATH token", {
      target: "path-tokens",
      stage: "decodeLog",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: event.blockNumber, toBlock: event.blockNumber },
    });
  }

  const tokens = new Map<string, PathTokenApiItem>();
  for (const item of previous?.items ?? []) {
    tokens.set(item.tokenId, item);
  }

  if (isPathTransferBurn(log)) {
    tokens.delete(tokenId);
  } else {
    const existing = tokens.get(tokenId);
    const item = await readPathTokenItem(ctx.env, stats, tokenId, log, existing);
    tokens.set(tokenId, item);
  }

  const lastScannedBlock = nextLastScannedBlock(previous, event.blockNumber);
  const snapshot: IndexedSnapshot<PathTokenApiItem> = {
    version: 1,
    cachedAt: Date.now(),
    chainId: 11155111,
    contract: PATH_NFT_ADDRESS,
    fromBlock: PATH_NFT_DEPLOY_BLOCK,
    lastScannedBlock,
    items: sortByTokenId([...tokens.values()]),
  };
  if (!isPathTransferBurn(log) && !snapshot.items.some((item) => item.tokenId === tokenId)) {
    throw chainFailure("path token event was not represented in snapshot", {
      target: "path-tokens",
      stage: "mergeSnapshot",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: event.blockNumber, toBlock: event.blockNumber },
    });
  }
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

function responseFromSnapshot(snapshot: IndexedSnapshot<PathTokenApiItem>) {
  return json(
    200,
    {
      cachedAt: snapshot.cachedAt,
      chainId: snapshot.chainId,
      contract: snapshot.contract,
      fromBlock: snapshot.fromBlock,
      lastScannedBlock: snapshot.lastScannedBlock,
      items: snapshot.items,
    },
    RESPONSE_CACHE_SECONDS,
  );
}

function normalizeAddressResult(result: string) {
  return decodeAddressResult(result);
}

function lowerTopicAddress(topic: string | undefined) {
  if (!topic) return "";
  return topic.toLowerCase();
}

async function readPathTokenEventLog(
  env: ChainCacheEnv,
  stats: ReturnType<typeof createStats>,
  event: TargetedPathTokenEvent,
) {
  const address = event.contractAddress;
  const topic0 = event.topic0 === TRANSFER_TOPIC && address === THOUGHT_NFT_ADDRESS.toLowerCase()
    ? PATH_THOUGHT_CONSUMED_TOPIC
    : event.topic0;
  try {
    const logs = await getLogsChunked(env, "path", stats, {
      address,
      fromBlock: event.blockNumber,
      toBlock: event.blockNumber,
      topics: [topic0],
      chunkSize: 1,
    });
    const log = logs.find((candidate) =>
      candidate.transactionHash?.toLowerCase() === event.txHash.toLowerCase() &&
      (event.topic0 === TRANSFER_TOPIC && address === THOUGHT_NFT_ADDRESS.toLowerCase()
        ? true
        : hexToNumber(candidate.logIndex) === event.logIndex)
    );
    if (!log) {
      throw new Error("event log not found in event block");
    }
    return log;
  } catch (error) {
    throw chainFailure("path token event getLogs failed", {
      target: "path-tokens",
      stage: "getLogs",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: event.blockNumber, toBlock: event.blockNumber },
    }, error);
  }
}

function tokenIdFromPathEvent(event: TargetedPathTokenEvent, log: ChainLog) {
  if (event.contractAddress === PATH_NFT_ADDRESS.toLowerCase()) {
    if (event.topic0 === TRANSFER_TOPIC) return topicToBigInt(log.topics[3])?.toString() ?? "";
    if (event.topic0 === PATH_METADATA_UPDATE_TOPIC) return tokenIdFromEventData(log.data);
    if (event.topic0 === PATH_MOVEMENT_CONSUMED_TOPIC) return topicToBigInt(log.topics[1])?.toString() ?? "";
  }
  if (event.contractAddress === THOUGHT_NFT_ADDRESS.toLowerCase()) {
    if (event.topic0 === PATH_THOUGHT_CONSUMED_TOPIC) return topicToBigInt(log.topics[1])?.toString() ?? "";
    if (event.topic0 === TRANSFER_TOPIC) return topicToBigInt(log.topics[1])?.toString() ?? "";
  }
  return "";
}

function tokenIdFromEventData(data: string) {
  const clean = data.startsWith("0x") ? data.slice(2) : data;
  const word = clean.slice(0, 64);
  if (!word || /[^a-fA-F0-9]/.test(word)) return "";
  return BigInt(`0x${word}`).toString();
}

function isPathTransferBurn(log: ChainLog) {
  return (log.topics[0] ?? "").toLowerCase() === TRANSFER_TOPIC &&
    lowerTopicAddress(log.topics[2]) === ZERO_TOPIC;
}

async function readPathTokenItem(
  env: ChainCacheEnv,
  stats: ReturnType<typeof createStats>,
  tokenId: string,
  log: ChainLog,
  existing: PathTokenApiItem | undefined,
) {
  const transferOwner = (log.topics[0] ?? "").toLowerCase() === TRANSFER_TOPIC
    ? topicToAddress(log.topics[2])
    : "";
  let owner = existing?.owner ?? transferOwner;
  try {
    owner = normalizeAddressResult(
      await ethCall(env, "path", stats, PATH_NFT_ADDRESS, ownerOfData(tokenId)),
    );
  } catch {
    // Keep the event or previous owner when ownerOf is temporarily unavailable.
  }

  let tokenUri = existing?.tokenUri ?? "";
  let metadata = existing?.metadata ?? {};
  try {
    tokenUri = decodeStringResult(
      await ethCall(env, "path", stats, PATH_NFT_ADDRESS, tokenUriData(tokenId)),
    );
    metadata = parseMetadata(tokenUri);
  } catch {
    if (!tokenUri) metadata = {};
  }
  if (!metadataString(metadata.name)) {
    metadata = parseMetadata(tokenUri);
  }

  return {
    tokenId,
    tokenIdLabel: tokenId,
    owner,
    tokenUri,
    metadata,
    blockNumber: hexToNumber(log.blockNumber),
    txHash: log.transactionHash,
  };
}

function nextLastScannedBlock(
  previous: IndexedSnapshot<unknown> | null | undefined,
  eventBlock: number,
) {
  const previousLastScanned = previous?.lastScannedBlock ?? eventBlock;
  return eventBlock <= previousLastScanned + 1
    ? Math.max(previousLastScanned, eventBlock)
    : previousLastScanned;
}

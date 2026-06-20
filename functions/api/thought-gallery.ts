import {
  THOUGHT_MINTED_TOPIC,
  THOUGHT_NFT_ADDRESS,
  THOUGHT_NFT_DEPLOY_BLOCK,
  boundedRefreshRange,
  chainFailure,
  createChainCacheDiagnostics,
  createStats,
  decodeStringResult,
  emitUsage,
  ethCall,
  fullRefreshRange,
  getBlockNumber,
  getLogsChunked,
  hexToNumber,
  json,
  logKey,
  metadataNumber,
  metadataString,
  onOptions,
  parseMetadata,
  parseProvenanceMaterial,
  provenanceData,
  pruneReorgWindow,
  rawTextData,
  readModelEnabled,
  readSnapshot,
  readResponseCache,
  sortByTokenId,
  tokenImage,
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
  type RefreshOutcome,
  type ThoughtGalleryApiItem,
} from "./chain-cache";

const SNAPSHOT_KEY = "thought-gallery:v1:sepolia";
const RESPONSE_CACHE_SECONDS = 60;
const EDGE_SNAPSHOT_SECONDS = 10 * 60;

type TargetedThoughtGalleryEvent = {
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

  const previous = await readSnapshot<ThoughtGalleryApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (previous && readModelEnabled(ctx.env)) {
    const response = responseFromSnapshot(previous);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, previous.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, undefined, previous);
  }

  const stats = createStats("thought", "thought-gallery", ctx.env);
  try {
    const { snapshot } = await loadThoughtGallery(ctx.env, ctx, stats, diagnostics, previous);
    emitUsage(ctx, stats);
    const response = responseFromSnapshot(snapshot);
    writeResponseCache(ctx, SNAPSHOT_KEY, response, RESPONSE_CACHE_SECONDS, snapshot.lastScannedBlock);
    return withChainCacheDiagnostics(ctx, response, diagnostics, stats, snapshot);
  } catch {
    emitUsage(ctx, stats);
    return json(500, {
      error: "thought gallery unavailable",
    });
  }
}

async function loadThoughtGallery(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  previousOverride?: IndexedSnapshot<ThoughtGalleryApiItem> | null,
  options: { force?: boolean; bounded?: boolean; maxLogChunks?: number } = {},
): Promise<RefreshOutcome<ThoughtGalleryApiItem>> {
  const previous =
    previousOverride === undefined
      ? await readSnapshot<ThoughtGalleryApiItem>(env, SNAPSHOT_KEY, diagnostics)
      : previousOverride;
  if (!options.force && previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
    return {
      snapshot: previous,
      progress: fullRefreshRange(previous, THOUGHT_NFT_DEPLOY_BLOCK, previous.lastScannedBlock),
    };
  }

  const latestBlock = await getBlockNumber(env, "thought", stats);
  const progress = options.bounded
    ? boundedRefreshRange(env, previous, THOUGHT_NFT_DEPLOY_BLOCK, latestBlock, {
      maxLogChunks: options.maxLogChunks,
    })
    : fullRefreshRange(previous, THOUGHT_NFT_DEPLOY_BLOCK, latestBlock);
  let logs: ChainLog[];
  try {
    logs = await getLogsChunked(env, "thought", stats, {
      address: THOUGHT_NFT_ADDRESS,
      fromBlock: progress.fromBlock,
      toBlock: progress.toBlock,
      topics: [THOUGHT_MINTED_TOPIC],
      chunkSize: progress.chunkSize,
    });
  } catch (error) {
    throw chainFailure("thought gallery refresh getLogs failed", {
      target: "thought-gallery",
      stage: "getLogs",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: progress.fromBlock, toBlock: progress.toBlock },
    }, error);
  }

  const existing = new Map<string, ThoughtGalleryApiItem>();
  for (const item of pruneReorgWindow(previous?.items ?? [], progress.fromBlock)) {
    existing.set(item.tokenId.toString(), item);
  }

  for (const log of logs.sort(sortByBlockLogSafe)) {
    if (log.removed) continue;
    const item = await readThoughtFromLog(env, stats, log);
    if (item) existing.set(item.tokenId.toString(), item);
  }

  const snapshot: IndexedSnapshot<ThoughtGalleryApiItem> = {
    version: 1,
    cachedAt: Date.now(),
    chainId: 11155111,
    contract: THOUGHT_NFT_ADDRESS,
    fromBlock: THOUGHT_NFT_DEPLOY_BLOCK,
    lastScannedBlock: progress.toBlock,
    items: sortByTokenId([...existing.values()]),
  };
  try {
    await writeSnapshot(
      ctx,
      SNAPSHOT_KEY,
      snapshot,
      EDGE_SNAPSHOT_SECONDS,
      diagnostics,
      previous,
      options.bounded ? { strictD1: true, waitForPersistence: true } : undefined,
    );
  } catch (error) {
    throw chainFailure("thought gallery refresh snapshot write failed", {
      target: "thought-gallery",
      stage: "writeSnapshot",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: progress.fromBlock, toBlock: progress.toBlock },
    }, error);
  }
  return { snapshot, progress };
}

export async function refreshThoughtGallery(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
) {
  const { snapshot } = await loadThoughtGallery(ctx.env, ctx, stats, diagnostics, undefined, {
    force: true,
  });
  writeResponseCache(
    ctx,
    SNAPSHOT_KEY,
    responseFromSnapshot(snapshot),
    RESPONSE_CACHE_SECONDS,
    snapshot.lastScannedBlock,
  );
  return snapshot;
}

export async function refreshThoughtGalleryBounded(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  options: { maxLogChunks?: number } = {},
) {
  const outcome = await loadThoughtGallery(ctx.env, ctx, stats, diagnostics, undefined, {
    force: true,
    bounded: true,
    maxLogChunks: options.maxLogChunks,
  });
  writeResponseCache(
    ctx,
    SNAPSHOT_KEY,
    responseFromSnapshot(outcome.snapshot),
    RESPONSE_CACHE_SECONDS,
    outcome.snapshot.lastScannedBlock,
  );
  return outcome;
}

export async function refreshThoughtGalleryForEvent(
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
  diagnostics: ChainCacheDiagnostics,
  event: TargetedThoughtGalleryEvent,
) {
  const previous = await readSnapshot<ThoughtGalleryApiItem>(ctx.env, SNAPSHOT_KEY, diagnostics);
  if (previous?.items.some((item) => item.txHash?.toLowerCase() === event.txHash.toLowerCase())) {
    return previous;
  }

  const log = await readThoughtGalleryEventLog(ctx.env, stats, event);
  const item = await readThoughtFromLog(ctx.env, stats, log);
  if (!item) {
    throw chainFailure("thought gallery event did not decode to a thought", {
      target: "thought-gallery",
      stage: "decodeLog",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: event.blockNumber, toBlock: event.blockNumber },
    });
  }

  const existing = new Map<string, ThoughtGalleryApiItem>();
  for (const thought of previous?.items ?? []) {
    existing.set(thought.tokenId.toString(), thought);
  }
  existing.set(item.tokenId.toString(), item);

  const snapshot: IndexedSnapshot<ThoughtGalleryApiItem> = {
    version: 1,
    cachedAt: Date.now(),
    chainId: 11155111,
    contract: THOUGHT_NFT_ADDRESS,
    fromBlock: THOUGHT_NFT_DEPLOY_BLOCK,
    lastScannedBlock: nextLastScannedBlock(previous, event.blockNumber),
    items: sortByTokenId([...existing.values()]),
  };
  if (!snapshot.items.some((thought) => thought.tokenId === item.tokenId)) {
    throw chainFailure("thought gallery event was not represented in snapshot", {
      target: "thought-gallery",
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

function responseFromSnapshot(snapshot: IndexedSnapshot<ThoughtGalleryApiItem>) {
  return json(
    200,
    {
      cachedAt: snapshot.cachedAt,
      chainId: snapshot.chainId,
      contract: snapshot.contract,
      fromBlock: snapshot.fromBlock,
      lastScannedBlock: snapshot.lastScannedBlock,
      thoughts: snapshot.items,
    },
    RESPONSE_CACHE_SECONDS,
  );
}

async function readThoughtFromLog(
  env: ChainCacheEnv,
  stats: ReturnType<typeof createStats>,
  log: ChainLog,
): Promise<ThoughtGalleryApiItem | null> {
  const tokenIdRaw = topicToBigInt(log.topics[1]);
  const tokenId = tokenIdRaw != null && tokenIdRaw <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(tokenIdRaw)
    : null;
  if (!tokenId) return null;

  const pathId = topicToBigInt(log.topics[3])?.toString() ?? "";
  const minter = topicToAddress(log.topics[2]);
  const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  const words = data.match(/.{1,64}/g) ?? [];
  const textHash = `0x${words[0] ?? ""}`;
  const provenanceHash = `0x${words[1] ?? ""}`;
  const thoughtSpecId = `0x${words[2] ?? ""}`;
  const thoughtSpecHash = `0x${words[3] ?? ""}`;
  const mintedAt = words[4] ? Number(BigInt(`0x${words[4]}`)) : null;

  let tokenUri = "";
  let metadata: Record<string, unknown> = {};
  let image = "";
  try {
    tokenUri = decodeStringResult(
      await ethCall(env, "thought", stats, THOUGHT_NFT_ADDRESS, tokenUriData(tokenId)),
    );
    metadata = parseMetadata(tokenUri);
    image = tokenImage(tokenUri, metadata);
  } catch {
    tokenUri = "";
  }

  const properties =
    metadata.properties && typeof metadata.properties === "object"
      ? (metadata.properties as Record<string, unknown>)
      : {};
  const envelope =
    metadata.thought && typeof metadata.thought === "object"
      ? (metadata.thought as Record<string, unknown>)
      : {};

  let rawText =
    metadataString(properties.rawText) ||
    metadataString(envelope.text);
  if (!rawText) {
    try {
      rawText = decodeStringResult(
        await ethCall(env, "thought", stats, THOUGHT_NFT_ADDRESS, rawTextData(tokenId)),
      );
    } catch {
      rawText = "";
    }
  }

  let provenanceJson =
    metadataString(properties.provenanceJson) ||
    metadataString(envelope.provenance);
  if (!provenanceJson) {
    try {
      provenanceJson = decodeStringResult(
        await ethCall(env, "thought", stats, THOUGHT_NFT_ADDRESS, provenanceData(tokenId)),
      );
    } catch {
      provenanceJson = "";
    }
  }

  const provenance = parseProvenanceMaterial(provenanceJson);
  return {
    tokenId,
    pathId: metadataString(properties.pathId) || pathId,
    minter: metadataString(properties.minter) || minter,
    textHash: metadataString(properties.textHash) || textHash,
    promptHash: metadataString(properties.promptHash) || provenance.promptHash,
    provenanceHash: metadataString(properties.provenanceHash) || provenanceHash,
    thoughtSpecId: metadataString(properties.thoughtSpecId) || thoughtSpecId,
    thoughtSpecHash: metadataString(properties.thoughtSpecHash) || thoughtSpecHash,
    mintedAt: metadataNumber(properties.mintedAt) ?? mintedAt,
    rawText,
    prompt: provenance.prompt,
    mode: provenance.mode,
    provider: provenance.provider,
    model: provenance.model,
    returnedText: provenance.returnedText,
    returnedTextHash: provenance.returnedTextHash,
    provenanceJson,
    image,
    tokenUri,
    txHash: log.transactionHash ?? logKey(log),
    blockNumber: hexToNumber(log.blockNumber),
  };
}

function sortByBlockLogSafe(left: ChainLog, right: ChainLog) {
  const leftBlock = hexToNumber(left.blockNumber);
  const rightBlock = hexToNumber(right.blockNumber);
  if (leftBlock !== rightBlock) return leftBlock - rightBlock;
  return hexToNumber(left.logIndex) - hexToNumber(right.logIndex);
}

async function readThoughtGalleryEventLog(
  env: ChainCacheEnv,
  stats: ReturnType<typeof createStats>,
  event: TargetedThoughtGalleryEvent,
) {
  try {
    const logs = await getLogsChunked(env, "thought", stats, {
      address: event.contractAddress,
      fromBlock: event.blockNumber,
      toBlock: event.blockNumber,
      topics: [event.topic0],
      chunkSize: 1,
    });
    const log = logs.find((candidate) =>
      candidate.transactionHash?.toLowerCase() === event.txHash.toLowerCase() &&
      hexToNumber(candidate.logIndex) === event.logIndex
    );
    if (!log) {
      throw new Error("event log not found in event block");
    }
    return log;
  } catch (error) {
    throw chainFailure("thought gallery event getLogs failed", {
      target: "thought-gallery",
      stage: "getLogs",
      upstreamLabel: stats.upstreamLabel,
      blockRange: { fromBlock: event.blockNumber, toBlock: event.blockNumber },
    }, error);
  }
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

import {
  THOUGHT_MINTED_TOPIC,
  THOUGHT_NFT_ADDRESS,
  THOUGHT_NFT_DEPLOY_BLOCK,
  createStats,
  decodeStringResult,
  emitUsage,
  ethCall,
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
  readSnapshot,
  refreshFromBlock,
  sortByTokenId,
  tokenImage,
  tokenUriData,
  topicToAddress,
  topicToBigInt,
  writeSnapshot,
  type ChainCacheEnv,
  type ChainLog,
  type IndexedSnapshot,
  type PagesContextLike,
  type ThoughtGalleryApiItem,
} from "./chain-cache";

const SNAPSHOT_KEY = "thought-gallery:v1:sepolia";
const RESPONSE_CACHE_SECONDS = 60;
const EDGE_SNAPSHOT_SECONDS = 10 * 60;

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const stats = createStats("thought", "thought-gallery", ctx.env);
  try {
    const snapshot = await loadThoughtGallery(ctx.env, ctx, stats);
    emitUsage(ctx, stats);
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
  } catch (error) {
    emitUsage(ctx, stats);
    return json(500, {
      error: "thought gallery unavailable",
      message: String((error as Error)?.message ?? error),
    });
  }
}

async function loadThoughtGallery(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
): Promise<IndexedSnapshot<ThoughtGalleryApiItem>> {
  const previous = await readSnapshot<ThoughtGalleryApiItem>(env, SNAPSHOT_KEY);
  if (previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
    return previous;
  }

  const latestBlock = await getBlockNumber(env, "thought", stats);
  const refreshStart = refreshFromBlock(previous, THOUGHT_NFT_DEPLOY_BLOCK, latestBlock);
  const logs = await getLogsChunked(env, "thought", stats, {
    address: THOUGHT_NFT_ADDRESS,
    fromBlock: refreshStart,
    toBlock: latestBlock,
    topics: [THOUGHT_MINTED_TOPIC],
  });

  const existing = new Map<string, ThoughtGalleryApiItem>();
  for (const item of pruneReorgWindow(previous?.items ?? [], refreshStart)) {
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
    lastScannedBlock: latestBlock,
    items: sortByTokenId([...existing.values()]),
  };
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS);
  return snapshot;
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

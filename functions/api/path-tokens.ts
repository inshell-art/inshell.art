import {
  PATH_NFT_ADDRESS,
  PATH_NFT_DEPLOY_BLOCK,
  TRANSFER_TOPIC,
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
  readSnapshot,
  refreshFromBlock,
  sortByBlockLog,
  sortByTokenId,
  tokenUriData,
  topicToAddress,
  topicToBigInt,
  writeSnapshot,
  type ChainCacheEnv,
  type IndexedSnapshot,
  type PagesContextLike,
  type PathTokenApiItem,
} from "./chain-cache";

const SNAPSHOT_KEY = "path-tokens:v1:sepolia";
const RESPONSE_CACHE_SECONDS = 60;
const EDGE_SNAPSHOT_SECONDS = 10 * 60;
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const stats = createStats("path", "path-tokens", ctx.env);
  try {
    const snapshot = await loadPathTokens(ctx.env, ctx, stats);
    emitUsage(ctx, stats);
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
  } catch (error) {
    emitUsage(ctx, stats);
    return json(500, {
      error: "PATH tokens unavailable",
      message: String((error as Error)?.message ?? error),
    });
  }
}

async function loadPathTokens(
  env: ChainCacheEnv,
  ctx: PagesContextLike,
  stats: ReturnType<typeof createStats>,
): Promise<IndexedSnapshot<PathTokenApiItem>> {
  const previous = await readSnapshot<PathTokenApiItem>(env, SNAPSHOT_KEY);
  if (previous && Date.now() - previous.cachedAt < RESPONSE_CACHE_SECONDS * 1000) {
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
  await writeSnapshot(ctx, SNAPSHOT_KEY, snapshot, EDGE_SNAPSHOT_SECONDS);
  return snapshot;
}

function normalizeAddressResult(result: string) {
  return decodeAddressResult(result);
}

function lowerTopicAddress(topic: string | undefined) {
  if (!topic) return "";
  return topic.toLowerCase();
}

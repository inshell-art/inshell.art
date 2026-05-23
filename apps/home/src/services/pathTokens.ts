import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  parseAbi,
  toEventSelector,
  type Address,
  type Hex,
} from "viem";
import {
  getBlockNumber,
  getDefaultProvider,
  supportsRpcRequest,
  type EthereumBlockTag,
  type EthereumLog,
  type ProviderInterface,
} from "@inshell/ethereum";

const pathNftAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const DEFAULT_MAX_SEQUENTIAL_TOKEN_ID = 10_000;
const PATH_TOKEN_CACHE_TTL_MS = 60_000;

export type PathTokenAttribute = {
  trait_type?: string;
  value?: string | number | boolean;
  [key: string]: unknown;
};

export type PathTokenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  image_data?: string;
  attributes?: PathTokenAttribute[];
  [key: string]: unknown;
};

export type PathTokenInventoryItem = {
  tokenId: bigint;
  tokenIdLabel: string;
  owner?: Address;
  tokenUri: string;
  metadata: PathTokenMetadata;
};

type PathTokenCacheMode = "default" | "bypass";

type SerializedPathTokenInventoryItem = Omit<PathTokenInventoryItem, "tokenId"> & {
  tokenId: string;
};

type PathTokenCachePayload = {
  cachedAt: number;
  items: SerializedPathTokenInventoryItem[];
};

type BrowserStorage = {
  length: number;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  key: (index: number) => string | null;
};

type RawLogsArgs = {
  address: string;
  fromBlock: number;
  toBlock: number | EthereumBlockTag;
  topics: Array<string | null>;
};

const pathTokenMemoryCache = new Map<string, PathTokenCachePayload>();

function pathTokenCacheStorage(): BrowserStorage | null {
  try {
    const storage = globalThis.sessionStorage;
    storage?.getItem("__path_token_cache_probe__");
    return storage ?? null;
  } catch {
    return null;
  }
}

function pathTokenCacheKey(parts: Array<string | number | undefined>) {
  return `inshell:path-token-cache:v1:${parts
    .map((part) => String(part ?? "none").toLowerCase())
    .join(":")}`;
}

function shouldUsePathTokenCache(args: {
  provider?: ProviderInterface;
  cacheMode?: PathTokenCacheMode;
}) {
  return !args.provider && args.cacheMode !== "bypass";
}

function serializePathToken(item: PathTokenInventoryItem): SerializedPathTokenInventoryItem {
  return {
    ...item,
    tokenId: item.tokenId.toString(),
  };
}

function revivePathToken(item: SerializedPathTokenInventoryItem): PathTokenInventoryItem | null {
  if (!item || typeof item !== "object") return null;
  if (typeof item.tokenId !== "string" || !/^\d+$/.test(item.tokenId)) return null;
  if (typeof item.tokenIdLabel !== "string") return null;
  if (typeof item.tokenUri !== "string") return null;
  if (!item.metadata || typeof item.metadata !== "object") return null;
  return {
    ...item,
    tokenId: BigInt(item.tokenId),
  };
}

function readPathTokenCache(key: string): PathTokenInventoryItem[] | null {
  const fromMemory = pathTokenMemoryCache.get(key);
  const now = Date.now();
  if (fromMemory && now - fromMemory.cachedAt <= PATH_TOKEN_CACHE_TTL_MS) {
    return fromMemory.items
      .map(revivePathToken)
      .filter((item): item is PathTokenInventoryItem => Boolean(item));
  }

  const storage = pathTokenCacheStorage();
  const raw = storage?.getItem(key) ?? null;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PathTokenCachePayload;
    if (
      !parsed ||
      !Number.isFinite(parsed.cachedAt) ||
      now - parsed.cachedAt > PATH_TOKEN_CACHE_TTL_MS ||
      !Array.isArray(parsed.items)
    ) {
      storage?.removeItem(key);
      pathTokenMemoryCache.delete(key);
      return null;
    }
    pathTokenMemoryCache.set(key, parsed);
    return parsed.items
      .map(revivePathToken)
      .filter((item): item is PathTokenInventoryItem => Boolean(item));
  } catch {
    storage?.removeItem(key);
    pathTokenMemoryCache.delete(key);
    return null;
  }
}

function writePathTokenCache(key: string, items: PathTokenInventoryItem[]) {
  const payload: PathTokenCachePayload = {
    cachedAt: Date.now(),
    items: items.map(serializePathToken),
  };
  pathTokenMemoryCache.set(key, payload);
  try {
    pathTokenCacheStorage()?.setItem(key, JSON.stringify(payload));
  } catch {
    // Token inventory cache is best-effort; live chain reads remain authoritative.
  }
}

export function clearPathTokenInventoryCache() {
  pathTokenMemoryCache.clear();
  const storage = pathTokenCacheStorage();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith("inshell:path-token-cache:v1:")) {
        storage.removeItem(key);
      }
    }
  } catch {
    // Ignore blocked browser storage.
  }
}

export function readCachedAllPathTokens(args: {
  pathNftAddress: string;
  fromBlock?: number;
  chunkSize?: number;
  maxSequentialTokenId?: number;
}): PathTokenInventoryItem[] | null {
  return readPathTokenCache(
    pathTokenCacheKey([
      "all",
      args.pathNftAddress,
      args.fromBlock,
      args.chunkSize,
      args.maxSequentialTokenId,
    ])
  );
}

function normalizeProvider(provider?: ProviderInterface): ProviderInterface {
  if (provider && supportsRpcRequest(provider)) return provider;
  return getDefaultProvider();
}

function toBlockTag(value: number | EthereumBlockTag): string {
  if (typeof value === "number") {
    return `0x${Math.max(0, Math.trunc(value)).toString(16)}`;
  }
  return value;
}

function addressTopic(address: string): string {
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}`;
}

function topicToAddress(topic: string | undefined): Address | null {
  if (!topic || topic === ZERO_TOPIC) return null;
  return getAddress(`0x${topic.slice(-40)}`);
}

function topicToTokenId(topic: string | undefined): bigint | null {
  if (!topic) return null;
  try {
    return BigInt(topic);
  } catch {
    return null;
  }
}

function logOrdinal(log: EthereumLog): number {
  const block = log.blockNumber ? Number.parseInt(log.blockNumber, 16) : 0;
  const index = log.logIndex ? Number.parseInt(log.logIndex, 16) : 0;
  return block * 1_000_000 + index;
}

function logKey(log: EthereumLog): string {
  return `${log.transactionHash ?? "tx"}:${log.logIndex ?? "idx"}:${log.blockNumber ?? "block"}`;
}

function isMissingTokenError(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes("nonexistent") ||
    message.includes("invalid token") ||
    message.includes("erc721") ||
    message.includes("execution reverted")
  );
}

async function ethCall<T>(
  provider: ProviderInterface,
  address: string,
  functionName: "balanceOf" | "ownerOf" | "tokenURI",
  args: readonly unknown[]
): Promise<T> {
  if (!supportsRpcRequest(provider)) {
    throw new Error("Auction provider is missing JSON-RPC support.");
  }
  const data = encodeFunctionData({
    abi: pathNftAbi,
    functionName,
    args,
  } as any);
  const result = (await provider.request?.({
    method: "eth_call",
    params: [{ to: getAddress(address), data }, "latest"],
  })) as Hex;
  if (!result || result === "0x") {
    throw new Error(`No PATH token data returned from ${functionName}.`);
  }
  return decodeFunctionResult({
    abi: pathNftAbi,
    functionName,
    data: result,
  }) as T;
}

async function getRawLogs(
  provider: ProviderInterface,
  args: RawLogsArgs
): Promise<EthereumLog[]> {
  if (!supportsRpcRequest(provider)) {
    throw new Error("Auction provider is missing JSON-RPC support.");
  }
  const result = (await provider.request?.({
    method: "eth_getLogs",
    params: [
      {
        address: getAddress(args.address),
        fromBlock: toBlockTag(args.fromBlock),
        toBlock: toBlockTag(args.toBlock),
        topics: args.topics,
      },
    ],
  })) as EthereumLog[];
  return Array.isArray(result) ? result : [];
}

async function getTransferLogs(
  provider: ProviderInterface,
  args: {
    pathNftAddress: string;
    walletAddress: string;
    fromBlock: number;
    toBlock: number;
    chunkSize: number;
  }
): Promise<EthereumLog[]> {
  const ownerTopic = addressTopic(args.walletAddress);
  const logsByKey = new Map<string, EthereumLog>();
  for (let from = args.fromBlock; from <= args.toBlock; from += args.chunkSize) {
    const to = Math.min(args.toBlock, from + args.chunkSize - 1);
    const [incoming, outgoing] = await Promise.all([
      getRawLogs(provider, {
        address: args.pathNftAddress,
        fromBlock: from,
        toBlock: to,
        topics: [TRANSFER_TOPIC, null, ownerTopic],
      }),
      getRawLogs(provider, {
        address: args.pathNftAddress,
        fromBlock: from,
        toBlock: to,
        topics: [TRANSFER_TOPIC, ownerTopic, null],
      }),
    ]);
    for (const log of [...incoming, ...outgoing]) {
      logsByKey.set(logKey(log), log);
    }
  }
  return [...logsByKey.values()].sort((a, b) => logOrdinal(a) - logOrdinal(b));
}

async function getMintLogs(
  provider: ProviderInterface,
  args: {
    pathNftAddress: string;
    fromBlock: number;
    toBlock: number;
    chunkSize: number;
  }
): Promise<EthereumLog[]> {
  const logsByKey = new Map<string, EthereumLog>();
  for (let from = args.fromBlock; from <= args.toBlock; from += args.chunkSize) {
    const to = Math.min(args.toBlock, from + args.chunkSize - 1);
    const logs = await getRawLogs(provider, {
      address: args.pathNftAddress,
      fromBlock: from,
      toBlock: to,
      topics: [TRANSFER_TOPIC, ZERO_TOPIC, null],
    });
    for (const log of logs) {
      logsByKey.set(logKey(log), log);
    }
  }
  return [...logsByKey.values()].sort((a, b) => logOrdinal(a) - logOrdinal(b));
}

export async function readPathTokenOwner(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  tokenId: bigint;
}): Promise<Address> {
  const provider = normalizeProvider(args.provider);
  return ethCall<Address>(provider, args.pathNftAddress, "ownerOf", [args.tokenId]);
}

export async function readPathTokenUri(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  tokenId: bigint;
}): Promise<string> {
  const provider = normalizeProvider(args.provider);
  return ethCall<string>(provider, args.pathNftAddress, "tokenURI", [args.tokenId]);
}

export async function loadAllPathTokenIds(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  fromBlock?: number;
  chunkSize?: number;
  maxSequentialTokenId?: number;
}): Promise<bigint[]> {
  const provider = normalizeProvider(args.provider);
  const pathNftAddress = getAddress(args.pathNftAddress);
  const maxSequentialTokenId =
    args.maxSequentialTokenId ?? DEFAULT_MAX_SEQUENTIAL_TOKEN_ID;
  const tokenIds: bigint[] = [];
  for (let tokenId = 1n; tokenId <= BigInt(maxSequentialTokenId); tokenId += 1n) {
    try {
      await ethCall<Address>(provider, pathNftAddress, "ownerOf", [tokenId]);
      tokenIds.push(tokenId);
    } catch (error) {
      if (isMissingTokenError(error)) break;
      throw error;
    }
  }
  if (tokenIds.length > 0 || args.fromBlock == null) {
    return tokenIds;
  }

  const latestBlock = await getBlockNumber(provider);
  const mintLogs = await getMintLogs(provider, {
    pathNftAddress,
    fromBlock: args.fromBlock,
    toBlock: latestBlock,
    chunkSize: args.chunkSize ?? 5_000,
  });
  const mintTokenIds = new Set<bigint>();
  for (const log of mintLogs) {
    if (log.removed) continue;
    const tokenId = topicToTokenId(log.topics[3]);
    if (tokenId != null) mintTokenIds.add(tokenId);
  }
  return [...mintTokenIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function loadWalletPathTokenIds(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  walletAddress: string;
  fromBlock?: number;
  chunkSize?: number;
}): Promise<bigint[]> {
  if (args.fromBlock == null) {
    throw new Error("PATH deploy block is missing; cannot backfill wallet tokens.");
  }
  const provider = normalizeProvider(args.provider);
  const pathNftAddress = getAddress(args.pathNftAddress);
  const walletAddress = getAddress(args.walletAddress);
  const balance = await ethCall<bigint>(provider, pathNftAddress, "balanceOf", [
    walletAddress,
  ]);
  if (balance === 0n) return [];

  const latestBlock = await getBlockNumber(provider);
  const transferLogs = await getTransferLogs(provider, {
    pathNftAddress,
    walletAddress,
    fromBlock: args.fromBlock,
    toBlock: latestBlock,
    chunkSize: args.chunkSize ?? 5_000,
  });
  const owned = new Set<bigint>();
  for (const log of transferLogs) {
    if (log.removed) continue;
    const from = topicToAddress(log.topics[1]);
    const to = topicToAddress(log.topics[2]);
    const tokenId = topicToTokenId(log.topics[3]);
    if (tokenId == null) continue;
    if (to?.toLowerCase() === walletAddress.toLowerCase()) {
      owned.add(tokenId);
    }
    if (from?.toLowerCase() === walletAddress.toLowerCase()) {
      owned.delete(tokenId);
    }
  }

  const verified: bigint[] = [];
  for (const tokenId of owned) {
    try {
      const owner = await ethCall<Address>(provider, pathNftAddress, "ownerOf", [tokenId]);
      if (owner.toLowerCase() === walletAddress.toLowerCase()) {
        verified.push(tokenId);
      }
    } catch {
      // Burned or unavailable token ids are ignored.
    }
  }
  return verified.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function decodeBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseTokenMetadata(tokenUri: string): PathTokenMetadata {
  const base64Prefix = "data:application/json;base64,";
  const utf8Prefix = "data:application/json;utf8,";
  try {
    if (tokenUri.startsWith(base64Prefix)) {
      return JSON.parse(decodeBase64Utf8(tokenUri.slice(base64Prefix.length)));
    }
    if (tokenUri.startsWith(utf8Prefix)) {
      return JSON.parse(decodeURIComponent(tokenUri.slice(utf8Prefix.length)));
    }
    if (tokenUri.trim().startsWith("{")) {
      return JSON.parse(tokenUri);
    }
  } catch {
    return {};
  }
  return {};
}

export async function loadWalletPathTokens(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  walletAddress: string;
  fromBlock?: number;
  chunkSize?: number;
  cacheMode?: PathTokenCacheMode;
}): Promise<PathTokenInventoryItem[]> {
  const cacheKey = pathTokenCacheKey([
    "wallet",
    args.pathNftAddress,
    args.walletAddress,
    args.fromBlock,
    args.chunkSize,
  ]);
  if (shouldUsePathTokenCache(args)) {
    const cached = readPathTokenCache(cacheKey);
    if (cached) return cached;
  }

  const provider = normalizeProvider(args.provider);
  const tokenIds = await loadWalletPathTokenIds({ ...args, provider });
  const items = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const tokenUri = await readPathTokenUri({
        provider,
        pathNftAddress: args.pathNftAddress,
        tokenId,
      });
      return {
        tokenId,
        tokenIdLabel: tokenId.toString(),
        owner: getAddress(args.walletAddress),
        tokenUri,
        metadata: parseTokenMetadata(tokenUri),
      };
    })
  );
  if (shouldUsePathTokenCache(args)) {
    writePathTokenCache(cacheKey, items);
  }
  return items;
}

export async function loadAllPathTokens(args: {
  provider?: ProviderInterface;
  pathNftAddress: string;
  fromBlock?: number;
  chunkSize?: number;
  maxSequentialTokenId?: number;
  cacheMode?: PathTokenCacheMode;
}): Promise<PathTokenInventoryItem[]> {
  const cacheKey = pathTokenCacheKey([
    "all",
    args.pathNftAddress,
    args.fromBlock,
    args.chunkSize,
    args.maxSequentialTokenId,
  ]);
  if (shouldUsePathTokenCache(args)) {
    const cached = readPathTokenCache(cacheKey);
    if (cached) return cached;
  }

  const provider = normalizeProvider(args.provider);
  const tokenIds = await loadAllPathTokenIds({ ...args, provider });
  const items: Array<PathTokenInventoryItem | null> = await Promise.all(
    tokenIds.map(async (tokenId) => {
      try {
        const [owner, tokenUri] = await Promise.all([
          readPathTokenOwner({
            provider,
            pathNftAddress: args.pathNftAddress,
            tokenId,
          }),
          readPathTokenUri({
            provider,
            pathNftAddress: args.pathNftAddress,
            tokenId,
          }),
        ]);
        return {
          tokenId,
          tokenIdLabel: tokenId.toString(),
          owner,
          tokenUri,
          metadata: parseTokenMetadata(tokenUri),
        } satisfies PathTokenInventoryItem;
      } catch {
        return null;
      }
    })
  );
  const loadedItems = items.filter((item): item is PathTokenInventoryItem => Boolean(item));
  if (shouldUsePathTokenCache(args)) {
    writePathTokenCache(cacheKey, loadedItems);
  }
  return loadedItems;
}

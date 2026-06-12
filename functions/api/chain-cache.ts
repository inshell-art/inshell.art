type KVNamespaceLike = {
  get: (key: string, type?: "json" | "text") => Promise<any>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
};

export type ChainCacheEnv = {
  PRIVATE_FALLBACK_RPC_UPSTREAM?: string;
  PUBLIC_FALLBACK_RPC_UPSTREAM?: string;
  RPC_UPSTREAM_FALLBACK?: string;
  PATH_PRIMARY_RPC_UPSTREAM?: string;
  THOUGHT_PRIMARY_RPC_UPSTREAM?: string;
  ETH_RPC_UPSTREAM?: string;
  PATH_RPC_UPSTREAM?: string;
  THOUGHT_RPC_UPSTREAM?: string;
  PRIVATE_FALLBACK_RPC_LABEL?: string;
  PUBLIC_FALLBACK_RPC_LABEL?: string;
  RPC_UPSTREAM_FALLBACK_LABEL?: string;
  PATH_PRIMARY_RPC_LABEL?: string;
  THOUGHT_PRIMARY_RPC_LABEL?: string;
  ETH_RPC_LABEL?: string;
  PATH_RPC_LABEL?: string;
  THOUGHT_RPC_LABEL?: string;
  RPC_USAGE_ENDPOINT?: string;
  RPC_USAGE_TOKEN?: string;
  MSG_HUB_RPC_USAGE_ENDPOINT?: string;
  MSG_HUB_RPC_USAGE_TOKEN?: string;
  INSHELL_CHAIN_DATA_KV?: KVNamespaceLike;
  CHAIN_CACHE_DIAGNOSTICS?: string;
};

export type PagesContextLike = {
  request: Request;
  env: ChainCacheEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type RpcStats = {
  service: "path" | "thought";
  route: string;
  upstreamLabel: string;
  calls: number;
  methods: Record<string, number>;
  estimatedCu: number;
};

type RpcResponse = {
  result?: unknown;
  error?: { message?: string } | unknown;
};

type RpcRoleSpec = {
  role: string;
  upstreamKeys: Array<keyof ChainCacheEnv>;
  labelKeys: Array<keyof ChainCacheEnv>;
};

type RpcUpstreamCandidate = {
  role: string;
  label: string;
  url: string;
};

type EdgeCachedValue<T> = {
  cachedAt: number;
  value: T;
};

type ChainCacheSource = "memory" | "edge" | "kv" | "live";

export type ChainCacheDiagnostics = {
  source: ChainCacheSource;
  key: string;
  kvRead: 0 | 1;
  kvWrite: 0 | 1;
  liveRpcCalls: number;
  snapshotBlock?: number;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const RPC_TIMEOUT_MS = 12_000;
const REORG_DEPTH = 3;
const DEFAULT_LOG_CHUNK_SIZE = 5_000;
const EDGE_CACHE_PREFIX = "https://inshell.local/chain-cache/";
const RESPONSE_CACHE_PREFIX = "https://inshell.local/chain-response/";
const KV_SNAPSHOT_TTL_SECONDS = 30 * 24 * 60 * 60;
const KV_WRITE_MIN_INTERVAL_SECONDS = 10 * 60;

export const SEPOLIA_CHAIN_ID = 11155111;
export const PATH_NFT_ADDRESS = "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D";
export const PULSE_AUCTION_ADDRESS = "0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39";
export const THOUGHT_NFT_ADDRESS = "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a";
export const PATH_NFT_DEPLOY_BLOCK = 10854121;
export const PULSE_AUCTION_DEPLOY_BLOCK = 10854123;
export const THOUGHT_NFT_DEPLOY_BLOCK = 10872879;
export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const THOUGHT_MINTED_TOPIC =
  "0xf83a962c31fcc481a4796d3bd1f81a4b58d1b05ec5cb34e434b2d40962596860";
export const PULSE_SALE_TOPIC =
  "0xa789468a0212cbe853fbdd6011d2ee7d85144ebc1d67c7dd82f087a970d9593d";

const OWNER_OF_SELECTOR = "0x6352211e";
const TOKEN_URI_SELECTOR = "0xc87b56dd";
const RAW_TEXT_OF_SELECTOR = "0x0f83b426";
const PROVENANCE_OF_SELECTOR = "0xc0fe387b";

const PRIVATE_FALLBACK_ROLE: RpcRoleSpec = {
  role: "PRIVATE_FALLBACK_RPC_UPSTREAM",
  upstreamKeys: ["PRIVATE_FALLBACK_RPC_UPSTREAM", "ETH_RPC_UPSTREAM"],
  labelKeys: ["PRIVATE_FALLBACK_RPC_LABEL", "ETH_RPC_LABEL"],
};

const PUBLIC_FALLBACK_ROLE: RpcRoleSpec = {
  role: "PUBLIC_FALLBACK_RPC_UPSTREAM",
  upstreamKeys: ["PUBLIC_FALLBACK_RPC_UPSTREAM", "RPC_UPSTREAM_FALLBACK"],
  labelKeys: ["PUBLIC_FALLBACK_RPC_LABEL", "RPC_UPSTREAM_FALLBACK_LABEL"],
};

const PATH_PRIMARY_ROLE: RpcRoleSpec = {
  role: "PATH_PRIMARY_RPC_UPSTREAM",
  upstreamKeys: ["PATH_PRIMARY_RPC_UPSTREAM", "PATH_RPC_UPSTREAM"],
  labelKeys: ["PATH_PRIMARY_RPC_LABEL", "PATH_RPC_LABEL"],
};

const THOUGHT_PRIMARY_ROLE: RpcRoleSpec = {
  role: "THOUGHT_PRIMARY_RPC_UPSTREAM",
  upstreamKeys: ["THOUGHT_PRIMARY_RPC_UPSTREAM", "THOUGHT_RPC_UPSTREAM"],
  labelKeys: ["THOUGHT_PRIMARY_RPC_LABEL", "THOUGHT_RPC_LABEL"],
};

export type ChainLog = {
  address?: string;
  blockHash?: string;
  blockNumber?: string;
  data: string;
  logIndex?: string;
  removed?: boolean;
  topics: string[];
  transactionHash?: string;
};

export type PathTokenApiItem = {
  tokenId: string;
  tokenIdLabel: string;
  owner?: string;
  tokenUri: string;
  metadata: Record<string, unknown>;
  blockNumber?: number;
  txHash?: string;
};

export type PulseBidApiItem = {
  key: string;
  atMs: number;
  bidder?: string;
  amount: { raw: { low: string; high: string }; dec: string };
  floorB?: { raw: { low: string; high: string }; dec: string };
  anchorASec?: number;
  txHash?: string;
  id?: number;
  blockNumber?: number;
  epochIndex?: number;
};

export type ThoughtGalleryApiItem = {
  tokenId: number;
  pathId: string;
  minter: string;
  textHash: string;
  promptHash: string;
  provenanceHash: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
  mintedAt: number | null;
  rawText: string;
  prompt: string;
  mode: string;
  provider: string;
  model: string;
  returnedText: string;
  returnedTextHash: string;
  provenanceJson: string;
  image: string;
  tokenUri: string;
  txHash: string;
  blockNumber: number;
};

export type IndexedSnapshot<T> = {
  version: number;
  cachedAt: number;
  chainId: number;
  contract: string;
  fromBlock: number;
  lastScannedBlock: number;
  items: T[];
};

type JsonSafe =
  | null
  | boolean
  | number
  | string
  | JsonSafe[]
  | { [key: string]: JsonSafe };

function safeJsonBody(body: unknown, seen = new WeakSet<object>()): JsonSafe {
  if (
    body === null ||
    typeof body === "string" ||
    typeof body === "number" ||
    typeof body === "boolean"
  ) {
    return body as JsonSafe;
  }
  if (typeof body === "bigint") return body.toString();
  if (typeof body !== "object") return null;
  if (body instanceof Error) return { error: "internal error" };
  if (seen.has(body)) return "[circular]";
  seen.add(body);
  if (Array.isArray(body)) return body.map((item) => safeJsonBody(item, seen));

  const out: { [key: string]: JsonSafe } = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (/^(stack|stackTrace|stack_trace)$/i.test(key)) continue;
    out[key] = safeJsonBody(value, seen);
  }
  return out;
}

export function json(status: number, body: unknown, cacheSeconds = 0): Response {
  const headers = new Headers(JSON_HEADERS);
  headers.set(
    "cache-control",
    cacheSeconds > 0
      ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${Math.max(60, cacheSeconds * 4)}`
      : "no-store",
  );
  return new Response(JSON.stringify(safeJsonBody(body)), { status, headers });
}

export function onOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}

export function createStats(
  service: "path" | "thought",
  route: string,
  env: ChainCacheEnv,
): RpcStats {
  const upstreamLabel =
    service === "path"
      ? firstEnvValue(env, PATH_PRIMARY_ROLE.labelKeys) || PATH_PRIMARY_ROLE.role
      : firstEnvValue(env, THOUGHT_PRIMARY_ROLE.labelKeys) || THOUGHT_PRIMARY_ROLE.role;
  return {
    service,
    route,
    upstreamLabel,
    calls: 0,
    methods: {},
    estimatedCu: 0,
  };
}

export function emitUsage(ctx: PagesContextLike, stats: RpcStats) {
  if (!stats.calls) return;
  const endpoint = ctx.env.MSG_HUB_RPC_USAGE_ENDPOINT || ctx.env.RPC_USAGE_ENDPOINT;
  if (!endpoint) return;

  const token = ctx.env.MSG_HUB_RPC_USAGE_TOKEN || ctx.env.RPC_USAGE_TOKEN;
  const payload = {
    source: "inshell-chain-cache",
    service: stats.service,
    route: stats.route,
    upstreamLabel: stats.upstreamLabel,
    calls: stats.calls,
    methods: stats.methods,
    estimatedCu: stats.estimatedCu,
    at: new Date().toISOString(),
  };

  const task = fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
    .then(() => undefined)
    .catch(() => undefined);

  if (ctx.waitUntil) ctx.waitUntil(task);
  else void task;
}

function firstEnvValue(env: ChainCacheEnv, keys: Array<keyof ChainCacheEnv>) {
  for (const key of keys) {
    const raw = env[key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) return value;
  }
  return "";
}

function candidateFor(env: ChainCacheEnv, spec: RpcRoleSpec): RpcUpstreamCandidate | null {
  const url = firstEnvValue(env, spec.upstreamKeys);
  if (!url) return null;
  return {
    role: spec.role,
    label: firstEnvValue(env, spec.labelKeys) || spec.role,
    url,
  };
}

function rpcCandidates(env: ChainCacheEnv, service: "path" | "thought") {
  const specs = service === "path"
    ? [PATH_PRIMARY_ROLE, PRIVATE_FALLBACK_ROLE, PUBLIC_FALLBACK_ROLE]
    : [THOUGHT_PRIMARY_ROLE, PRIVATE_FALLBACK_ROLE, PUBLIC_FALLBACK_ROLE];
  const candidates: RpcUpstreamCandidate[] = [];
  const seenUrls = new Set<string>();
  for (const spec of specs) {
    const candidate = candidateFor(env, spec);
    if (!candidate || seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);
    candidates.push(candidate);
  }
  return candidates;
}

function estimateCu(method: string) {
  if (method === "eth_getLogs") return 75;
  if (method === "eth_call") return 26;
  if (method === "eth_blockNumber") return 10;
  return 10;
}

function shouldTryNextRpcUpstream(method: string, status: number, message: string) {
  if (status === 429 || status >= 500) return true;
  if (method !== "eth_getLogs" || status !== 400) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes("block range") ||
    normalized.includes("free tier") ||
    normalized.includes("range should work") ||
    normalized.includes("too many blocks")
  );
}

export async function rpcCall<T>(
  env: ChainCacheEnv,
  service: "path" | "thought",
  stats: RpcStats,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const upstreams = rpcCandidates(env, service);
  if (!upstreams.length) {
    throw new Error(`${service} RPC upstream is not configured.`);
  }

  let lastError: unknown = null;
  for (const upstream of upstreams) {
    stats.calls += 1;
    stats.methods[method] = (stats.methods[method] ?? 0) + 1;
    stats.estimatedCu += estimateCu(method);
    stats.upstreamLabel = upstream.label;

    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    try {
      const response = await fetch(upstream.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: stats.calls,
          method,
          params,
        }),
        signal: controller.signal,
      });
      const parsed = (await response.json().catch(() => null)) as RpcResponse | null;
      if (response.ok && parsed && !parsed.error) {
        return parsed.result as T;
      }
      const message =
        typeof (parsed?.error as any)?.message === "string"
          ? (parsed?.error as any).message
          : `RPC request failed with ${response.status}`;
      lastError = new Error(message);
      if (!(shouldTryNextRpcUpstream(method, response.status, message) || !parsed)) {
        break;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${service} RPC request failed.`);
}

export async function getBlockNumber(
  env: ChainCacheEnv,
  service: "path" | "thought",
  stats: RpcStats,
) {
  const raw = await rpcCall<string>(env, service, stats, "eth_blockNumber");
  return Number(BigInt(raw));
}

export async function getLogsChunked(
  env: ChainCacheEnv,
  service: "path" | "thought",
  stats: RpcStats,
  args: {
    address: string;
    fromBlock: number;
    toBlock: number;
    topics: Array<string | null>;
    chunkSize?: number;
  },
) {
  const out: ChainLog[] = [];
  const chunkSize = Math.max(1, args.chunkSize ?? DEFAULT_LOG_CHUNK_SIZE);
  for (let from = args.fromBlock; from <= args.toBlock; from += chunkSize) {
    const to = Math.min(args.toBlock, from + chunkSize - 1);
    const logs = await rpcCall<ChainLog[]>(env, service, stats, "eth_getLogs", [
      {
        address: args.address,
        fromBlock: toHexQuantity(from),
        toBlock: toHexQuantity(to),
        topics: args.topics,
      },
    ]);
    if (Array.isArray(logs)) out.push(...logs);
  }
  return out;
}

export async function readSnapshot<T>(
  env: ChainCacheEnv,
  key: string,
  diagnostics?: ChainCacheDiagnostics,
): Promise<IndexedSnapshot<T> | null> {
  const memory = memoryCache.get(key);
  if (memory) {
    if (diagnostics) {
      diagnostics.source = "memory";
      diagnostics.snapshotBlock = snapshotBlock(memory.value);
    }
    return memory.value as IndexedSnapshot<T>;
  }

  const edge = await readEdgeCache<IndexedSnapshot<T>>(key);
  if (edge) {
    memoryCache.set(key, { cachedAt: Date.now(), value: edge });
    if (diagnostics) {
      diagnostics.source = "edge";
      diagnostics.snapshotBlock = snapshotBlock(edge);
    }
    return edge;
  }

  try {
    if (diagnostics) diagnostics.kvRead = 1;
    const fromKv = await env.INSHELL_CHAIN_DATA_KV?.get(key, "json");
    if (fromKv && typeof fromKv === "object") {
      memoryCache.set(key, { cachedAt: Date.now(), value: fromKv });
      if (diagnostics) {
        diagnostics.source = "kv";
        diagnostics.snapshotBlock = snapshotBlock(fromKv);
      }
      return fromKv as IndexedSnapshot<T>;
    }
  } catch {
    return null;
  }
  return null;
}

export async function writeSnapshot<T>(
  ctx: PagesContextLike,
  key: string,
  snapshot: IndexedSnapshot<T>,
  edgeTtlSeconds: number,
  diagnostics?: ChainCacheDiagnostics,
  previous?: IndexedSnapshot<T> | null,
) {
  memoryCache.set(key, { cachedAt: Date.now(), value: snapshot });
  if (diagnostics) diagnostics.snapshotBlock = snapshot.lastScannedBlock;

  const tasks: Array<Promise<unknown>> = [writeEdgeCache(key, snapshot, edgeTtlSeconds)];
  const shouldPersist = shouldWriteKvSnapshot(previous ?? null, snapshot);
  if (shouldPersist && ctx.env.INSHELL_CHAIN_DATA_KV) {
    if (diagnostics) diagnostics.kvWrite = 1;
    tasks.push(
      ctx.env.INSHELL_CHAIN_DATA_KV.put(key, JSON.stringify(snapshot), {
        expirationTtl: KV_SNAPSHOT_TTL_SECONDS,
      }),
    );
  }
  const joined = Promise.all(tasks).then(() => undefined).catch(() => undefined);
  if (ctx.waitUntil) ctx.waitUntil(joined);
  else await joined;
}

export function createChainCacheDiagnostics(key: string): ChainCacheDiagnostics {
  return {
    source: "live",
    key,
    kvRead: 0,
    kvWrite: 0,
    liveRpcCalls: 0,
  };
}

export async function readResponseCache(
  ctx: PagesContextLike,
  key: string,
): Promise<Response | null> {
  const cache = (globalThis as any).caches?.default;
  if (!cache) return null;
  try {
    const response = await cache.match(responseCacheRequest(key));
    return response ? response.clone() : null;
  } catch {
    return null;
  }
}

export function writeResponseCache(
  ctx: PagesContextLike,
  key: string,
  response: Response,
  ttlSeconds: number,
  snapshotBlock?: number,
) {
  const cache = (globalThis as any).caches?.default;
  if (!cache || ttlSeconds <= 0 || response.status < 200 || response.status >= 300) return;
  const cached = new Response(response.clone().body, response);
  cached.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
  if (typeof snapshotBlock === "number") {
    cached.headers.set("x-cache-snapshot-block", String(snapshotBlock));
  }
  const task = cache.put(responseCacheRequest(key), cached).catch(() => undefined);
  if (ctx.waitUntil) ctx.waitUntil(task);
}

export function withChainCacheDiagnostics(
  ctx: PagesContextLike,
  response: Response,
  diagnostics: ChainCacheDiagnostics,
  stats?: RpcStats,
  snapshot?: IndexedSnapshot<unknown>,
) {
  if (!diagnosticsEnabled(ctx)) return response;
  const out = new Response(response.body, response);
  const liveRpcCalls = stats?.calls ?? diagnostics.liveRpcCalls;
  const source = liveRpcCalls > 0 ? "live" : diagnostics.source;
  const block = snapshot?.lastScannedBlock ?? diagnostics.snapshotBlock;
  out.headers.set("x-chain-cache-source", source);
  out.headers.set("x-chain-cache-key", diagnostics.key);
  out.headers.set("x-kv-read", String(diagnostics.kvRead));
  out.headers.set("x-kv-write", String(diagnostics.kvWrite));
  out.headers.set("x-live-rpc-calls", String(liveRpcCalls));
  if (typeof block === "number") {
    out.headers.set("x-cache-snapshot-block", String(block));
  }
  return out;
}

export function refreshFromBlock(snapshot: IndexedSnapshot<unknown> | null, deployBlock: number, latestBlock: number) {
  const start =
    snapshot && Number.isFinite(snapshot.lastScannedBlock)
      ? Math.max(deployBlock, snapshot.lastScannedBlock - REORG_DEPTH + 1)
      : deployBlock;
  return Math.min(Math.max(0, start), latestBlock);
}

export function pruneReorgWindow<T extends { blockNumber?: number }>(
  items: T[],
  refreshStartBlock: number,
) {
  return items.filter(
    (item) => typeof item.blockNumber !== "number" || item.blockNumber < refreshStartBlock,
  );
}

export function toHexQuantity(value: number | bigint) {
  const bigintValue = typeof value === "bigint" ? value : BigInt(Math.max(0, Math.trunc(value)));
  return `0x${bigintValue.toString(16)}`;
}

export function wordHex(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

export function callDataUint256(selector: string, value: bigint | number | string) {
  return `${selector}${wordHex(BigInt(value))}`;
}

export function ownerOfData(tokenId: bigint | number | string) {
  return callDataUint256(OWNER_OF_SELECTOR, tokenId);
}

export function tokenUriData(tokenId: bigint | number | string) {
  return callDataUint256(TOKEN_URI_SELECTOR, tokenId);
}

export function rawTextData(tokenId: bigint | number | string) {
  return callDataUint256(RAW_TEXT_OF_SELECTOR, tokenId);
}

export function provenanceData(tokenId: bigint | number | string) {
  return callDataUint256(PROVENANCE_OF_SELECTOR, tokenId);
}

export async function ethCall(
  env: ChainCacheEnv,
  service: "path" | "thought",
  stats: RpcStats,
  to: string,
  data: string,
) {
  return rpcCall<string>(env, service, stats, "eth_call", [
    { to, data },
    "latest",
  ]);
}

export function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

export function readWord(cleanHex: string, wordIndex: number) {
  const start = wordIndex * 64;
  const word = cleanHex.slice(start, start + 64);
  if (word.length !== 64 || /[^a-fA-F0-9]/.test(word)) {
    throw new Error("invalid ABI word");
  }
  return BigInt(`0x${word}`);
}

export function decodeAddressResult(result: string) {
  const clean = strip0x(result);
  if (clean.length < 64) throw new Error("short address result");
  return `0x${clean.slice(24, 64)}`;
}

export function decodeStringResult(result: string) {
  const clean = strip0x(result);
  if (!clean || clean === "0") return "";
  const offset = Number(readWord(clean, 0));
  const length = Number(readWord(clean, offset / 32));
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || length < 0) {
    throw new Error("invalid ABI string");
  }
  const dataStart = (offset + 32) * 2;
  const hex = clean.slice(dataStart, dataStart + length * 2);
  if (hex.length !== length * 2) throw new Error("short ABI string data");
  return new TextDecoder().decode(hexToBytes(hex));
}

export function topicToAddress(topic: string | undefined) {
  if (!topic || topic.length < 42) return "";
  return `0x${topic.slice(-40)}`;
}

export function topicToBigInt(topic: string | undefined) {
  if (!topic) return null;
  try {
    return BigInt(topic);
  } catch {
    return null;
  }
}

export function hexToNumber(value: string | undefined) {
  if (!value) return 0;
  return Number(BigInt(value));
}

export function lower(value: string | undefined) {
  return (value ?? "").toLowerCase();
}

export function logKey(log: ChainLog) {
  return `${log.transactionHash ?? "tx"}:${log.logIndex ?? "idx"}:${log.blockNumber ?? "block"}`;
}

export function sortByTokenId<T extends { tokenId: string | number }>(items: T[]) {
  return items.sort((left, right) => Number(left.tokenId) - Number(right.tokenId));
}

export function sortByBlockLog(left: ChainLog, right: ChainLog) {
  const leftBlock = hexToNumber(left.blockNumber);
  const rightBlock = hexToNumber(right.blockNumber);
  if (leftBlock !== rightBlock) return leftBlock - rightBlock;
  return hexToNumber(left.logIndex) - hexToNumber(right.logIndex);
}

export function parseMetadata(tokenUri: string): Record<string, unknown> {
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

export function tokenImage(tokenUri: string, metadata: Record<string, unknown>) {
  const trimmed = tokenUri.trim();
  if (/^<svg[\s>]/i.test(trimmed)) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)}`;
  }
  if (trimmed.startsWith("data:image/svg+xml")) return trimmed;
  return typeof metadata.image === "string" ? metadata.image : "";
}

export function metadataString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") return value.toString();
  return "";
}

export function metadataNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function parseProvenanceMaterial(provenanceJson: string) {
  if (!provenanceJson) {
    return {
      prompt: "",
      promptHash: "",
      returnedText: "",
      returnedTextHash: "",
      mode: "",
      provider: "",
      model: "",
    };
  }
  try {
    const parsed = JSON.parse(provenanceJson) as {
      prompt?: unknown;
      route?: unknown;
      provider?: unknown;
      model?: unknown;
      output?: { returnedText?: unknown };
      hashes?: { promptHash?: unknown; returnedTextHash?: unknown };
    };
    return {
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      promptHash: typeof parsed.hashes?.promptHash === "string" ? parsed.hashes.promptHash : "",
      returnedText: typeof parsed.output?.returnedText === "string" ? parsed.output.returnedText : "",
      returnedTextHash:
        typeof parsed.hashes?.returnedTextHash === "string"
          ? parsed.hashes.returnedTextHash
          : "",
      mode: typeof parsed.route === "string" ? parsed.route : "",
      provider: typeof parsed.provider === "string" ? parsed.provider : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return {
      prompt: "",
      promptHash: "",
      returnedText: "",
      returnedTextHash: "",
      mode: "",
      provider: "",
      model: "",
    };
  }
}

export function u256(value: bigint) {
  return {
    raw: { low: value.toString(10), high: "0" },
    dec: value.toString(10),
  };
}

export function safeNumber(value: bigint | null) {
  if (value == null || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function decodeBase64Utf8(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function hexToBytes(hex: string) {
  const clean = strip0x(hex);
  if (clean.length % 2 !== 0 || /[^a-fA-F0-9]/.test(clean)) {
    throw new Error("invalid hex");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

const memoryCache = new Map<string, EdgeCachedValue<unknown>>();

async function readEdgeCache<T>(key: string): Promise<T | null> {
  const cache = (globalThis as any).caches?.default;
  if (!cache) return null;
  try {
    const response = await cache.match(edgeCacheRequest(key));
    if (!response) return null;
    const parsed = (await response.json()) as EdgeCachedValue<T>;
    return parsed.value;
  } catch {
    return null;
  }
}

async function writeEdgeCache<T>(key: string, value: T, ttlSeconds: number) {
  const cache = (globalThis as any).caches?.default;
  if (!cache || ttlSeconds <= 0) return;
  try {
    await cache.put(
      edgeCacheRequest(key),
      new Response(JSON.stringify({ cachedAt: Date.now(), value }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${ttlSeconds}`,
        },
      }),
    );
  } catch {
    // Edge cache is best-effort; KV or live reads still serve the route.
  }
}

function edgeCacheRequest(key: string) {
  return new Request(`${EDGE_CACHE_PREFIX}${encodeURIComponent(key)}`);
}

function responseCacheRequest(key: string) {
  return new Request(`${RESPONSE_CACHE_PREFIX}${encodeURIComponent(key)}`);
}

function snapshotBlock(value: unknown) {
  const block = (value as { lastScannedBlock?: unknown } | null)?.lastScannedBlock;
  return typeof block === "number" && Number.isFinite(block) ? block : undefined;
}

function shouldWriteKvSnapshot<T>(
  previous: IndexedSnapshot<T> | null,
  snapshot: IndexedSnapshot<T>,
) {
  if (!previous) return true;
  if (snapshotContent(previous) !== snapshotContent(snapshot)) return true;
  return Date.now() - previous.cachedAt >= KV_WRITE_MIN_INTERVAL_SECONDS * 1000;
}

function snapshotContent<T>(snapshot: IndexedSnapshot<T>) {
  // Persist KV only when the public payload changes; edge/memory can carry scan-block drift.
  return JSON.stringify({
    version: snapshot.version,
    chainId: snapshot.chainId,
    contract: snapshot.contract,
    fromBlock: snapshot.fromBlock,
    items: snapshot.items,
  });
}

function diagnosticsEnabled(ctx: PagesContextLike) {
  if (ctx.env.CHAIN_CACHE_DIAGNOSTICS === "1") return true;
  const rawUrl = (ctx.request as { url?: string } | undefined)?.url;
  if (!rawUrl) return false;
  try {
    const { hostname } = new globalThis.URL(rawUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".pages.dev") ||
      hostname.includes("preview.inshell.art")
    );
  } catch {
    return false;
  }
}

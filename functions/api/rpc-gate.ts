type RpcPayload = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

type RpcEnv = {
  ETH_RPC_UPSTREAM?: string;
  PATH_RPC_UPSTREAM?: string;
  THOUGHT_RPC_UPSTREAM?: string;
  ETH_RPC_LABEL?: string;
  PATH_RPC_LABEL?: string;
  THOUGHT_RPC_LABEL?: string;
  MSG_HUB_RPC_USAGE_ENDPOINT?: string;
  MSG_HUB_RPC_USAGE_TOKEN?: string;
  RPC_USAGE_ENDPOINT?: string;
  RPC_USAGE_TOKEN?: string;
  RPC_MONTHLY_CU_LIMIT?: string;
};

type PagesContext = {
  request: Request;
  env: RpcEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
};

type EdgeCache = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};

type RpcGateConfig = {
  service: "fallback" | "path" | "thought";
  upstreamEnv: keyof RpcEnv;
  fallbackEnv?: keyof RpcEnv;
  labelEnv: keyof RpcEnv;
  allowedMethods: Set<string>;
  allowedCallAddresses: Set<string>;
  allowedLogRules: Array<{
    address: string;
    topics: Set<string>;
  }>;
  maxLogRange: number;
  upstreamLogChunkSize: number;
  minuteCuLimit: number;
  hourCuLimit: number;
};

type CachePolicy = {
  ttlMs: number;
  staleMs: number;
};

type CachedRpcResult = {
  result: unknown;
  expiresAt: number;
  staleUntil: number;
};

type UpstreamResult = {
  status: number;
  body: string;
  retryable: boolean;
  estimatedCu: number;
  upstreamCalls: number;
};

type PreparedRequest = {
  body: string;
  method: string;
  estimatedCu: number;
};

type PreparedPayload = {
  requests: PreparedRequest[];
  originalCall?: RpcPayload;
  combineResults?: (results: unknown[]) => unknown;
};

const MAX_BODY_BYTES = 256 * 1024;
const MAX_BATCH_SIZE = 25;
const MAX_CACHE_ENTRIES = 400;
const MAX_CACHEABLE_RESPONSE_BYTES = 128 * 1024;
const UPSTREAM_RETRY_DELAYS_MS = [150, 450];
const WARNING_THRESHOLDS = [0.5, 0.7, 0.85, 0.95] as const;
const DEFAULT_MONTHLY_CU_LIMIT = 30_000_000;

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PULSE_SALE_TOPIC = "0xa789468a0212cbe853fbdd6011d2ee7d85144ebc1d67c7dd82f087a970d9593d";
const EPOCH_MINTED_TOPIC = "0x8bf745a0b3e9240df3d0f0bd6f50999edc8a3b2552a370f9fef31a798d170a61";
const THOUGHT_MINTED_TOPIC = "0xf83a962c31fcc481a4796d3bd1f81a4b58d1b05ec5cb34e434b2d40962596860";

const PATH_NFT_ADDRESS = "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D";
const PATH_PULSE_ADAPTER_ADDRESS = "0x8Cd52b431F4e932c5fDd8E49073c2c5bc1bfabF2";
const PULSE_AUCTION_ADDRESS = "0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39";
const THOUGHT_NFT_ADDRESS = "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a";
const THOUGHT_SPEC_REGISTRY_ADDRESS = "0xBB8FD738b01b4a14F5E9bCFE408239a05d84621D";
const COLOR_FONT_ADDRESS = "0xC223507ab7801Fdf234766fa1A87F09eae3494af";
const THOUGHT_PREVIEWER_ADDRESS = "0x0A0100Ef4c25a50A8E16bED818E6Bda82d3b923F";

const READ_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);

const READ_WITH_LOGS_METHODS = new Set([...READ_METHODS, "eth_getLogs"]);

const ALCHEMY_CU_COSTS: Record<string, number> = {
  eth_chainId: 0,
  net_version: 0,
  eth_blockNumber: 10,
  eth_feeHistory: 10,
  eth_maxPriorityFeePerGas: 10,
  eth_getTransactionByHash: 15,
  eth_getTransactionReceipt: 15,
  eth_getBlockByNumber: 16,
  eth_getBalance: 19,
  eth_getCode: 19,
  eth_gasPrice: 19,
  eth_call: 26,
  eth_getTransactionCount: 26,
  eth_getLogs: 60,
};

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  ...CORS_HEADERS,
};

const responseCache = new Map<string, CachedRpcResult>();
const inFlightCache = new Map<string, Promise<UpstreamResult>>();
const rateLimitEvents = new Map<string, Array<{ at: number; cu: number }>>();
const usageCounters = new Map<string, number>();
const warnedThresholds = new Set<string>();

function lower(value: string) {
  return value.toLowerCase();
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? lower(value) : null;
}

function normalizeTopic(value: unknown) {
  if (Array.isArray(value) && value.length === 1) {
    return normalizeTopic(value[0]);
  }
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value) ? lower(value) : null;
}

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  });
}

function isRpcPayload(value: unknown): value is RpcPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}

function cachePolicyFor(call: RpcPayload): CachePolicy | null {
  switch (call.method) {
    case "eth_chainId":
    case "net_version":
      return { ttlMs: 60_000, staleMs: 600_000 };
    case "eth_blockNumber":
      return { ttlMs: 2_000, staleMs: 60_000 };
    case "eth_getCode":
      return { ttlMs: 60_000, staleMs: 300_000 };
    case "eth_call":
      return { ttlMs: 2_000, staleMs: 60_000 };
    case "eth_getBlockByNumber": {
      const params = Array.isArray(call.params) ? call.params : [];
      const blockRef = typeof params[0] === "string" ? params[0] : "";
      if (blockRef === "latest" || blockRef === "pending") {
        return { ttlMs: 2_000, staleMs: 30_000 };
      }
      return { ttlMs: 600_000, staleMs: 1_800_000 };
    }
    case "eth_getLogs":
      return { ttlMs: 600_000, staleMs: 3_600_000 };
    default:
      return null;
  }
}

function cacheKeyFor(service: string, payload: unknown): { key: string; call: RpcPayload; policy: CachePolicy } | null {
  if (Array.isArray(payload) || !isRpcPayload(payload) || payload.id === undefined) {
    return null;
  }
  const policy = cachePolicyFor(payload);
  if (!policy) return null;
  return {
    call: payload,
    key: `${service}:${payload.method}:${stableStringify(payload.params ?? [])}`,
    policy,
  };
}

function readMemoryCache(key: string, allowStale: boolean): CachedRpcResult | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  const now = Date.now();
  if (cached.expiresAt >= now || (allowStale && cached.staleUntil >= now)) {
    return cached;
  }
  if (cached.staleUntil < now) responseCache.delete(key);
  return null;
}

function writeMemoryCache(key: string, policy: CachePolicy, result: unknown) {
  const now = Date.now();
  responseCache.set(key, {
    result,
    expiresAt: now + policy.ttlMs,
    staleUntil: now + policy.ttlMs + policy.staleMs,
  });
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey === undefined) break;
    responseCache.delete(oldestKey);
  }
}

async function sha256Hex(value: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function edgeCacheKey(key: string) {
  return new Request(`https://rpc-cache.inshell.local/${await sha256Hex(key)}`);
}

async function readEdgeCache(key: string): Promise<CachedRpcResult | null> {
  const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
  if (!cache) return null;
  try {
    const response = await cache.match(await edgeCacheKey(key));
    if (!response) return null;
    const parsed = (await response.json()) as { result?: unknown };
    if (!("result" in parsed)) return null;
    return {
      result: parsed.result,
      expiresAt: Date.now() + 1,
      staleUntil: Date.now() + 1,
    };
  } catch {
    return null;
  }
}

async function writeEdgeCache(key: string, policy: CachePolicy, result: unknown) {
  const cache = (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
  if (!cache) return;
  try {
    await cache.put(
      await edgeCacheKey(key),
      new Response(JSON.stringify({ result }), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${Math.max(1, Math.floor(policy.ttlMs / 1000))}`,
        },
      })
    );
  } catch {
    /* Edge cache is best-effort. */
  }
}

function responseFromCache(call: RpcPayload, cached: CachedRpcResult, cacheStatus: "hit" | "stale"): Response {
  return json(
    200,
    {
      jsonrpc: "2.0",
      id: call.id,
      result: cached.result,
    },
    {
      "x-inshell-rpc-cache": cacheStatus,
      "x-inshell-rpc-estimated-cu": "0",
    }
  );
}

function blockNumberFromRpc(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value !== "string") return null;
  if (value === "earliest") return 0;
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = Number.parseInt(value.slice(2), 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toRpcBlock(value: number) {
  return `0x${value.toString(16)}`;
}

function logFilter(call: RpcPayload): Record<string, unknown> | null {
  const params = Array.isArray(call.params) ? call.params : [];
  const filter = params[0];
  return filter && typeof filter === "object" && !Array.isArray(filter) ? filter as Record<string, unknown> : null;
}

function validateEthCall(call: RpcPayload, config: RpcGateConfig): string | null {
  const params = Array.isArray(call.params) ? call.params : [];
  const tx = params[0];
  if (!tx || typeof tx !== "object" || Array.isArray(tx)) return "eth_call transaction is required.";
  const to = normalizeAddress((tx as Record<string, unknown>).to);
  if (!to || !config.allowedCallAddresses.has(to)) {
    return `${config.service} RPC does not allow eth_call to that address.`;
  }
  return null;
}

function validateGetLogs(call: RpcPayload, config: RpcGateConfig): string | null {
  const filter = logFilter(call);
  if (!filter) return "eth_getLogs filter is required.";
  const address = normalizeAddress(filter.address);
  if (!address) return "eth_getLogs address must be a single allowed address.";
  const topics = Array.isArray(filter.topics) ? filter.topics : [];
  const topic0 = normalizeTopic(topics[0]);
  if (!topic0) return "eth_getLogs topic0 is required.";
  const rule = config.allowedLogRules.find((candidate) => candidate.address === address);
  if (!rule || !rule.topics.has(topic0)) {
    return `${config.service} RPC does not allow that eth_getLogs address/topic.`;
  }
  const fromBlock = blockNumberFromRpc(filter.fromBlock);
  const toBlock = blockNumberFromRpc(filter.toBlock);
  if (fromBlock === null || toBlock === null) {
    return "eth_getLogs requires numeric fromBlock and toBlock.";
  }
  if (toBlock < fromBlock) return "eth_getLogs block range is invalid.";
  if (toBlock - fromBlock + 1 > config.maxLogRange) {
    return `eth_getLogs range is too large for ${config.service} RPC.`;
  }
  return null;
}

function validatePayload(payload: unknown, config: RpcGateConfig): string | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0) return "Empty RPC batch.";
  if (calls.length > MAX_BATCH_SIZE) return "RPC batch is too large.";

  for (const call of calls) {
    if (!isRpcPayload(call)) return "Invalid RPC request.";
    if (typeof call.method !== "string") return "RPC method is required.";
    if (!config.allowedMethods.has(call.method)) {
      return `RPC method is not allowed: ${call.method}`;
    }
    if (call.method === "eth_call") {
      const invalid = validateEthCall(call, config);
      if (invalid) return invalid;
    }
    if (call.method === "eth_getLogs") {
      if (Array.isArray(payload)) return "eth_getLogs batches are not allowed.";
      const invalid = validateGetLogs(call, config);
      if (invalid) return invalid;
    }
  }

  return null;
}

function methodCu(method: string) {
  return ALCHEMY_CU_COSTS[method] ?? 100;
}

function preparePayload(payload: unknown, config: RpcGateConfig): PreparedPayload {
  if (isRpcPayload(payload) && payload.method === "eth_getLogs") {
    const filter = logFilter(payload);
    const fromBlock = blockNumberFromRpc(filter?.fromBlock);
    const toBlock = blockNumberFromRpc(filter?.toBlock);
    if (!filter || fromBlock === null || toBlock === null) {
      throw new Error("Invalid eth_getLogs block range.");
    }
    const requests: PreparedRequest[] = [];
    for (let from = fromBlock; from <= toBlock; from += config.upstreamLogChunkSize) {
      const to = Math.min(toBlock, from + config.upstreamLogChunkSize - 1);
      requests.push({
        method: "eth_getLogs",
        estimatedCu: methodCu("eth_getLogs"),
        body: JSON.stringify({
          ...payload,
          params: [
            {
              ...filter,
              fromBlock: toRpcBlock(from),
              toBlock: toRpcBlock(to),
            },
          ],
        }),
      });
    }
    return {
      requests,
      originalCall: payload,
      combineResults: (results) => {
        const logs: unknown[] = [];
        for (const item of results) {
          if (Array.isArray(item)) logs.push(...item);
        }
        return logs;
      },
    };
  }

  const calls = Array.isArray(payload) ? payload : [payload];
  return {
    requests: [
      {
        method: calls.map((call) => isRpcPayload(call) ? String(call.method) : "unknown").join(","),
        estimatedCu: calls.reduce(
          (total, call) => total + (isRpcPayload(call) && typeof call.method === "string" ? methodCu(call.method) : 100),
          0
        ),
        body: JSON.stringify(payload),
      },
    ],
  };
}

function shouldRetryUpstream(status: number, body: string): boolean {
  if (!body.trim()) return true;
  return status === 429 || (status >= 500 && status < 600);
}

function shouldRetryAttempt(status: number, body: string): boolean {
  if (!body.trim()) return true;
  return status === 429 || (status >= 500 && status < 600);
}

async function fetchSingleUpstream(upstream: string, request: PreparedRequest): Promise<UpstreamResult> {
  for (let attempt = 0; attempt <= UPSTREAM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const upstreamResponse = await fetch(upstream, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: request.body,
      });
      const responseText = await upstreamResponse.text();
      if (
        attempt < UPSTREAM_RETRY_DELAYS_MS.length &&
        shouldRetryAttempt(upstreamResponse.status, responseText)
      ) {
        await sleep(UPSTREAM_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (!responseText.trim()) {
        return {
          status: 502,
          retryable: true,
          body: JSON.stringify({
            error: "RPC upstream returned an empty response.",
          }),
          estimatedCu: request.estimatedCu,
          upstreamCalls: 1,
        };
      }
      return {
        status: upstreamResponse.status,
        body: responseText,
        retryable: shouldRetryUpstream(upstreamResponse.status, responseText),
        estimatedCu: request.estimatedCu,
        upstreamCalls: 1,
      };
    } catch {
      if (attempt < UPSTREAM_RETRY_DELAYS_MS.length) {
        await sleep(UPSTREAM_RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }
  return {
    status: 502,
    retryable: true,
    body: JSON.stringify({
      error: "RPC upstream request failed.",
    }),
    estimatedCu: request.estimatedCu,
    upstreamCalls: 1,
  };
}

async function fetchPreparedUpstream(upstream: string, prepared: PreparedPayload): Promise<UpstreamResult> {
  if (!prepared.combineResults && prepared.requests.length === 1) {
    return fetchSingleUpstream(upstream, prepared.requests[0]);
  }

  const results: unknown[] = [];
  let estimatedCu = 0;
  let upstreamCalls = 0;

  for (const request of prepared.requests) {
    const response = await fetchSingleUpstream(upstream, request);
    estimatedCu += response.estimatedCu;
    upstreamCalls += response.upstreamCalls;
    if (response.status < 200 || response.status >= 300) {
      return {
        ...response,
        estimatedCu,
        upstreamCalls,
      };
    }
    try {
      const parsed = JSON.parse(response.body);
      if (!isRpcPayload(parsed) || parsed.error || !("result" in parsed)) {
        return {
          ...response,
          estimatedCu,
          upstreamCalls,
        };
      }
      results.push(parsed.result);
    } catch {
      return {
        ...response,
        estimatedCu,
        upstreamCalls,
      };
    }
  }

  if (prepared.combineResults && prepared.originalCall) {
    return {
      status: 200,
      retryable: false,
      estimatedCu,
      upstreamCalls,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: prepared.originalCall.id,
        result: prepared.combineResults(results),
      }),
    };
  }

  return {
    status: 200,
    retryable: false,
    estimatedCu,
    upstreamCalls,
    body: JSON.stringify(results),
  };
}

function fetchCacheableUpstream(
  key: string,
  upstream: string,
  prepared: PreparedPayload
): Promise<UpstreamResult> {
  const existing = inFlightCache.get(key);
  if (existing) return existing;

  const request = fetchPreparedUpstream(upstream, prepared).finally(() => {
    if (inFlightCache.get(key) === request) {
      inFlightCache.delete(key);
    }
  });
  inFlightCache.set(key, request);
  return request;
}

function clientRateLimitKey(request: Request, service: string) {
  const headers = request.headers;
  const cfIp = headers?.get("cf-connecting-ip")?.trim();
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${service}:${cfIp || forwarded || "unknown"}`;
}

function reserveCuSlot(key: string, cu: number, config: RpcGateConfig) {
  const now = Date.now();
  const events = (rateLimitEvents.get(key) ?? []).filter((event) => now - event.at <= 60 * 60 * 1000);
  const minuteCu = events.filter((event) => now - event.at <= 60 * 1000).reduce((total, event) => total + event.cu, 0);
  const hourCu = events.reduce((total, event) => total + event.cu, 0);
  if (minuteCu + cu > config.minuteCuLimit || hourCu + cu > config.hourCuLimit) {
    rateLimitEvents.set(key, events);
    return false;
  }
  events.push({ at: now, cu });
  rateLimitEvents.set(key, events);
  return true;
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function errorKind(status: number, body: string) {
  if (status === 429 || /rate limit|too many requests/i.test(body)) return "rate_limit";
  if (/capacity|limit|quota|compute unit/i.test(body)) return "capacity";
  if (status >= 500) return "upstream_5xx";
  if (status >= 400) return "bad_request";
  return undefined;
}

async function sendUsageEvent(context: PagesContext, event: Record<string, unknown>) {
  const endpoint = context.env.MSG_HUB_RPC_USAGE_ENDPOINT || context.env.RPC_USAGE_ENDPOINT;
  if (!endpoint) return;
  const token = context.env.MSG_HUB_RPC_USAGE_TOKEN || context.env.RPC_USAGE_TOKEN;
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(event),
  }).catch(() => undefined);
}

function emitUsage(context: PagesContext, event: Record<string, unknown>) {
  const send = sendUsageEvent(context, event);
  if (context.waitUntil) {
    context.waitUntil(send);
  } else {
    void send;
  }
}

function recordUsage(context: PagesContext, config: RpcGateConfig, args: {
  upstreamLabel: string;
  method: string;
  estimatedCu: number;
  status: number;
  cacheStatus: "hit" | "miss" | "stale" | "bypass";
  durationMs: number;
  body: string;
  upstreamCalls: number;
}) {
  if (args.estimatedCu <= 0) return;
  const month = monthKey();
  const counterKey = `${config.service}:${args.upstreamLabel}:${month}`;
  const total = (usageCounters.get(counterKey) ?? 0) + args.estimatedCu;
  usageCounters.set(counterKey, total);

  const event = {
    type: "rpc.usage",
    ts: new Date().toISOString(),
    env: "sepolia",
    service: config.service,
    upstreamLabel: args.upstreamLabel,
    method: args.method,
    estimatedCu: args.estimatedCu,
    estimatedMonthlyCuInIsolate: total,
    status: args.status,
    ok: args.status >= 200 && args.status < 300,
    cacheStatus: args.cacheStatus,
    durationMs: args.durationMs,
    upstreamCalls: args.upstreamCalls,
    errorKind: errorKind(args.status, args.body),
  };
  emitUsage(context, event);

  const monthlyLimit = Number(context.env.RPC_MONTHLY_CU_LIMIT || DEFAULT_MONTHLY_CU_LIMIT);
  if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) return;
  for (const threshold of WARNING_THRESHOLDS) {
    if (total < monthlyLimit * threshold) continue;
    const warningKey = `${counterKey}:${threshold}`;
    if (warnedThresholds.has(warningKey)) continue;
    warnedThresholds.add(warningKey);
    emitUsage(context, {
      ...event,
      type: "rpc.usage.warning",
      threshold,
      monthlyLimit,
    });
  }
}

function upstreamFor(context: PagesContext, config: RpcGateConfig) {
  const primary = context.env[config.upstreamEnv]?.trim();
  const fallback = config.fallbackEnv ? context.env[config.fallbackEnv]?.trim() : "";
  return primary || fallback || "";
}

function upstreamLabelFor(context: PagesContext, config: RpcGateConfig) {
  return context.env[config.labelEnv]?.trim() || config.service;
}

async function readBody(request: Request): Promise<string | Response> {
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return json(413, {
      error: "RPC request body is too large.",
    });
  }
  return body;
}

function parsedMethodLabel(prepared: PreparedPayload) {
  const methods = new Set(prepared.requests.map((request) => request.method));
  return [...methods].join(",");
}

export function __clearRpcGateCachesForTests() {
  responseCache.clear();
  inFlightCache.clear();
  rateLimitEvents.clear();
  usageCounters.clear();
  warnedThresholds.clear();
}

export function createRpcGate(config: RpcGateConfig) {
  async function onRequestOptions(): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        "cache-control": "no-store",
        ...CORS_HEADERS,
      },
    });
  }

  async function onRequestGet(): Promise<Response> {
    return json(405, {
      error: "Use POST for Ethereum JSON-RPC.",
    });
  }

  async function onRequestPost(context: PagesContext): Promise<Response> {
    const upstream = upstreamFor(context, config);
    if (!upstream) {
      return json(500, {
        error: `${config.service} RPC upstream is not configured.`,
      });
    }

    const body = await readBody(context.request);
    if (body instanceof Response) return body;

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return json(400, {
        error: "Invalid JSON-RPC payload.",
      });
    }

    const invalid = validatePayload(payload, config);
    if (invalid) {
      return json(400, {
        error: invalid,
      });
    }

    const prepared = preparePayload(payload, config);
    const estimatedCu = prepared.requests.reduce((total, request) => total + request.estimatedCu, 0);
    const cacheRequest = cacheKeyFor(config.service, payload);
    if (cacheRequest) {
      const cached = readMemoryCache(cacheRequest.key, false) ?? await readEdgeCache(cacheRequest.key);
      if (cached) return responseFromCache(cacheRequest.call, cached, "hit");
    }

    if (!reserveCuSlot(clientRateLimitKey(context.request, config.service), estimatedCu, config)) {
      return json(429, {
        error: `${config.service} RPC rate limit reached.`,
      });
    }

    const startedAt = Date.now();
    const upstreamResponse = cacheRequest
      ? await fetchCacheableUpstream(cacheRequest.key, upstream, prepared)
      : await fetchPreparedUpstream(upstream, prepared);
    const durationMs = Date.now() - startedAt;

    if (cacheRequest && upstreamResponse.retryable) {
      const stale = readMemoryCache(cacheRequest.key, true);
      if (stale) return responseFromCache(cacheRequest.call, stale, "stale");
    }

    recordUsage(context, config, {
      upstreamLabel: upstreamLabelFor(context, config),
      method: parsedMethodLabel(prepared),
      estimatedCu: upstreamResponse.estimatedCu,
      status: upstreamResponse.status,
      cacheStatus: cacheRequest ? "miss" : "bypass",
      durationMs,
      body: upstreamResponse.body,
      upstreamCalls: upstreamResponse.upstreamCalls,
    });

    if (
      cacheRequest &&
      upstreamResponse.status >= 200 &&
      upstreamResponse.status < 300
    ) {
      try {
        const parsed = JSON.parse(upstreamResponse.body);
        if (isRpcPayload(parsed) && "result" in parsed && !("error" in parsed)) {
          if (
            new TextEncoder().encode(upstreamResponse.body).byteLength <=
            MAX_CACHEABLE_RESPONSE_BYTES
          ) {
            writeMemoryCache(cacheRequest.key, cacheRequest.policy, parsed.result);
            if (cacheRequest.call.method === "eth_getLogs") {
              await writeEdgeCache(cacheRequest.key, cacheRequest.policy, parsed.result);
            }
          }
          return json(
            200,
            {
              jsonrpc: "2.0",
              id: cacheRequest.call.id,
              result: parsed.result,
            },
            {
              "x-inshell-rpc-cache": "miss",
              "x-inshell-rpc-estimated-cu": String(upstreamResponse.estimatedCu),
              "x-inshell-rpc-upstream-calls": String(upstreamResponse.upstreamCalls),
            }
          );
        }
      } catch {
        /* Non-JSON success bodies are passed through uncached. */
      }
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: {
        ...JSON_HEADERS,
        "x-inshell-rpc-cache": cacheRequest ? "miss" : "bypass",
        "x-inshell-rpc-estimated-cu": String(upstreamResponse.estimatedCu),
        "x-inshell-rpc-upstream-calls": String(upstreamResponse.upstreamCalls),
      },
    });
  }

  return {
    onRequestOptions,
    onRequestGet,
    onRequestPost,
  };
}

const pathAddresses = new Set([
  lower(PATH_NFT_ADDRESS),
  lower(PATH_PULSE_ADAPTER_ADDRESS),
  lower(PULSE_AUCTION_ADDRESS),
  lower(COLOR_FONT_ADDRESS),
]);

const thoughtAddresses = new Set([
  lower(PATH_NFT_ADDRESS),
  lower(THOUGHT_NFT_ADDRESS),
  lower(THOUGHT_SPEC_REGISTRY_ADDRESS),
  lower(COLOR_FONT_ADDRESS),
  lower(THOUGHT_PREVIEWER_ADDRESS),
]);

export const fallbackRpcGate = createRpcGate({
  service: "fallback",
  upstreamEnv: "ETH_RPC_UPSTREAM",
  labelEnv: "ETH_RPC_LABEL",
  allowedMethods: READ_METHODS,
  allowedCallAddresses: new Set([...pathAddresses, ...thoughtAddresses]),
  allowedLogRules: [],
  maxLogRange: 0,
  upstreamLogChunkSize: 10,
  minuteCuLimit: 60_000,
  hourCuLimit: 500_000,
});

export const pathRpcGate = createRpcGate({
  service: "path",
  upstreamEnv: "PATH_RPC_UPSTREAM",
  fallbackEnv: "ETH_RPC_UPSTREAM",
  labelEnv: "PATH_RPC_LABEL",
  allowedMethods: READ_WITH_LOGS_METHODS,
  allowedCallAddresses: pathAddresses,
  allowedLogRules: [
    {
      address: lower(PATH_NFT_ADDRESS),
      topics: new Set([TRANSFER_TOPIC]),
    },
    {
      address: lower(PULSE_AUCTION_ADDRESS),
      topics: new Set([PULSE_SALE_TOPIC]),
    },
    {
      address: lower(PATH_PULSE_ADAPTER_ADDRESS),
      topics: new Set([EPOCH_MINTED_TOPIC]),
    },
  ],
  maxLogRange: 5_000,
  upstreamLogChunkSize: 5_000,
  minuteCuLimit: 180_000,
  hourCuLimit: 1_000_000,
});

export const thoughtRpcGate = createRpcGate({
  service: "thought",
  upstreamEnv: "THOUGHT_RPC_UPSTREAM",
  fallbackEnv: "ETH_RPC_UPSTREAM",
  labelEnv: "THOUGHT_RPC_LABEL",
  allowedMethods: READ_WITH_LOGS_METHODS,
  allowedCallAddresses: thoughtAddresses,
  allowedLogRules: [
    {
      address: lower(PATH_NFT_ADDRESS),
      topics: new Set([TRANSFER_TOPIC]),
    },
    {
      address: lower(THOUGHT_NFT_ADDRESS),
      topics: new Set([THOUGHT_MINTED_TOPIC]),
    },
  ],
  maxLogRange: 5_000,
  upstreamLogChunkSize: 5_000,
  minuteCuLimit: 180_000,
  hourCuLimit: 1_000_000,
});

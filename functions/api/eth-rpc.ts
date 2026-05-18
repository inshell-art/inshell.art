type RpcPayload = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

type PagesContext = {
  request: Request;
  env: {
    ETH_RPC_UPSTREAM?: string;
  };
};

const MAX_BODY_BYTES = 256 * 1024;
const MAX_BATCH_SIZE = 25;
const MAX_CACHE_ENTRIES = 400;
const MAX_CACHEABLE_RESPONSE_BYTES = 128 * 1024;
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const UPSTREAM_RETRY_DELAYS_MS = [150, 450];

type CachePolicy = {
  ttlMs: number;
  staleMs: number;
};

type CachedRpcResult = {
  result: unknown;
  expiresAt: number;
  staleUntil: number;
};

const responseCache = new Map<string, CachedRpcResult>();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function isRpcPayload(value: unknown): value is RpcPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePayload(payload: unknown): string | null {
  const calls = Array.isArray(payload) ? payload : [payload];
  if (calls.length === 0) return "Empty RPC batch.";
  if (calls.length > MAX_BATCH_SIZE) return "RPC batch is too large.";

  for (const call of calls) {
    if (!isRpcPayload(call)) return "Invalid RPC request.";
    if (typeof call.method !== "string") return "RPC method is required.";
    if (!ALLOWED_METHODS.has(call.method)) {
      return `RPC method is not allowed: ${call.method}`;
    }
  }

  return null;
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
      return { ttlMs: 1_000, staleMs: 30_000 };
    case "eth_getCode":
      return { ttlMs: 60_000, staleMs: 300_000 };
    case "eth_call":
      return { ttlMs: 750, staleMs: 15_000 };
    case "eth_getLogs":
      return { ttlMs: 120_000, staleMs: 600_000 };
    default:
      return null;
  }
}

function cacheKeyFor(payload: unknown): { key: string; call: RpcPayload; policy: CachePolicy } | null {
  if (Array.isArray(payload) || !isRpcPayload(payload) || payload.id === undefined) {
    return null;
  }
  const policy = cachePolicyFor(payload);
  if (!policy) return null;
  return {
    call: payload,
    key: `${payload.method}:${stableStringify(payload.params ?? [])}`,
    policy,
  };
}

function readCache(key: string, allowStale: boolean): CachedRpcResult | null {
  const cached = responseCache.get(key);
  if (!cached) return null;
  const now = Date.now();
  if (cached.expiresAt >= now || (allowStale && cached.staleUntil >= now)) {
    return cached;
  }
  if (cached.staleUntil < now) responseCache.delete(key);
  return null;
}

function writeCache(key: string, policy: CachePolicy, result: unknown) {
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

function responseFromCache(call: RpcPayload, cached: CachedRpcResult): Response {
  return json(200, {
    jsonrpc: "2.0",
    id: call.id,
    result: cached.result,
  });
}

function shouldRetryUpstream(status: number, body: string): boolean {
  if (!body.trim()) return true;
  return status === 429 || (status >= 500 && status < 600);
}

async function fetchUpstream(
  upstream: string,
  body: string
): Promise<{ status: number; body: string; retryable: boolean }> {
  for (let attempt = 0; attempt <= UPSTREAM_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const upstreamResponse = await fetch(upstream, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
      });
      const responseText = await upstreamResponse.text();
      if (
        attempt < UPSTREAM_RETRY_DELAYS_MS.length &&
        shouldRetryUpstream(upstreamResponse.status, responseText)
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
        };
      }
      return {
        status: upstreamResponse.status,
        body: responseText,
        retryable: shouldRetryUpstream(upstreamResponse.status, responseText),
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
  };
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

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet(): Promise<Response> {
  return json(405, {
    error: "Use POST for Ethereum JSON-RPC.",
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const upstream = context.env.ETH_RPC_UPSTREAM?.trim();
  if (!upstream) {
    return json(500, {
      error: "Ethereum RPC upstream is not configured.",
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

  const invalid = validatePayload(payload);
  if (invalid) {
    return json(400, {
      error: invalid,
    });
  }

  const cacheRequest = cacheKeyFor(payload);
  if (cacheRequest) {
    const cached = readCache(cacheRequest.key, false);
    if (cached) return responseFromCache(cacheRequest.call, cached);
  }

  const upstreamResponse = await fetchUpstream(upstream, body);

  if (cacheRequest && upstreamResponse.retryable) {
    const stale = readCache(cacheRequest.key, true);
    if (stale) return responseFromCache(cacheRequest.call, stale);
  }

  if (
    cacheRequest &&
    upstreamResponse.status >= 200 &&
    upstreamResponse.status < 300 &&
    new TextEncoder().encode(upstreamResponse.body).byteLength <= MAX_CACHEABLE_RESPONSE_BYTES
  ) {
    try {
      const parsed = JSON.parse(upstreamResponse.body);
      if (isRpcPayload(parsed) && "result" in parsed && !("error" in parsed)) {
        writeCache(cacheRequest.key, cacheRequest.policy, parsed.result);
      }
    } catch {
      /* Non-JSON success bodies are passed through uncached. */
    }
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: JSON_HEADERS,
  });
}

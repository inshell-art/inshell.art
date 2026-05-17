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

function shouldRetryUpstream(status: number, body: string): boolean {
  if (!body.trim()) return true;
  return status === 429 || (status >= 500 && status < 600);
}

async function fetchUpstream(
  upstream: string,
  body: string
): Promise<{ status: number; body: string } | Response> {
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
        return json(502, {
          error: "RPC upstream returned an empty response.",
        });
      }
      return {
        status: upstreamResponse.status,
        body: responseText,
      };
    } catch {
      if (attempt < UPSTREAM_RETRY_DELAYS_MS.length) {
        await sleep(UPSTREAM_RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }
  return json(502, {
    error: "RPC upstream request failed.",
  });
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

  const upstreamResponse = await fetchUpstream(upstream, body);
  if (upstreamResponse instanceof Response) return upstreamResponse;

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: JSON_HEADERS,
  });
}

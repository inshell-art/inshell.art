type PreviewRequest = {
  rawReturn?: unknown;
};

type PagesContext = {
  request: Request;
  env: {
    PRIVATE_FALLBACK_RPC_UPSTREAM?: string;
    PUBLIC_FALLBACK_RPC_UPSTREAM?: string;
    RPC_UPSTREAM_FALLBACK?: string;
    THOUGHT_PRIMARY_RPC_UPSTREAM?: string;
    ETH_RPC_UPSTREAM?: string;
    THOUGHT_RPC_UPSTREAM?: string;
    THOUGHT_PREVIEW_RPC_UPSTREAM?: string;
    THOUGHT_PREVIEW_NFT_ADDRESS?: string;
    THOUGHT_PREVIEW_CHAIN_ID?: string;
  };
};

type RpcResponse = {
  result?: unknown;
  error?: unknown;
};

type ContractPreview = {
  ok: boolean;
  text: string;
  svg: string;
  reasonCode: number;
};

type RpcRoleSpec = {
  role: string;
  upstreamKeys: Array<keyof PagesContext["env"]>;
};

type RpcUpstreamCandidate = {
  role: string;
  url: string;
};

const DEFAULT_THOUGHT_PREVIEW_CHAIN_ID = 11155111;
const DEFAULT_THOUGHT_NFT_ADDRESS = "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a";
// ThoughtNFT.previewWork(string)
const PREVIEW_WORK_SELECTOR = "0xc159a6d9";
const MAX_BODY_BYTES = 4 * 1024;
const MAX_RAW_RETURN_BYTES = 512;
const MAX_TEXT_BYTES = 128;
const MAX_CACHE_ENTRIES = 400;
const PREVIEW_TIMEOUT_MS = 8_000;
const PREVIEW_RATE_LIMIT = {
  minute: 20,
  hour: 300,
} as const;

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

const previewCache = new Map<string, { preview: ContractPreview; expiresAt: number }>();
const inFlightPreviewCache = new Map<string, Promise<ContractPreview>>();
const rateLimitEvents = new Map<string, number[]>();
let cachedChainCheck: { upstream: string; chainId: number; expiresAt: number } | null = null;

const THOUGHT_PREVIEW_ROLE: RpcRoleSpec = {
  role: "THOUGHT_PREVIEW_RPC_UPSTREAM",
  upstreamKeys: ["THOUGHT_PREVIEW_RPC_UPSTREAM"],
};

const THOUGHT_PRIMARY_ROLE: RpcRoleSpec = {
  role: "THOUGHT_PRIMARY_RPC_UPSTREAM",
  upstreamKeys: ["THOUGHT_PRIMARY_RPC_UPSTREAM", "THOUGHT_RPC_UPSTREAM"],
};

const PRIVATE_FALLBACK_ROLE: RpcRoleSpec = {
  role: "PRIVATE_FALLBACK_RPC_UPSTREAM",
  upstreamKeys: ["PRIVATE_FALLBACK_RPC_UPSTREAM", "ETH_RPC_UPSTREAM"],
};

const PUBLIC_FALLBACK_ROLE: RpcRoleSpec = {
  role: "PUBLIC_FALLBACK_RPC_UPSTREAM",
  upstreamKeys: ["PUBLIC_FALLBACK_RPC_UPSTREAM", "RPC_UPSTREAM_FALLBACK"],
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function firstEnvValue(env: PagesContext["env"], keys: Array<keyof PagesContext["env"]>) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function candidateFor(env: PagesContext["env"], spec: RpcRoleSpec): RpcUpstreamCandidate | null {
  const url = firstEnvValue(env, spec.upstreamKeys);
  return url ? { role: spec.role, url } : null;
}

function rpcCandidates(env: PagesContext["env"]) {
  const candidates: RpcUpstreamCandidate[] = [];
  const seenUrls = new Set<string>();
  for (const spec of [
    THOUGHT_PREVIEW_ROLE,
    THOUGHT_PRIMARY_ROLE,
    PRIVATE_FALLBACK_ROLE,
    PUBLIC_FALLBACK_ROLE,
  ]) {
    const candidate = candidateFor(env, spec);
    if (!candidate || seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);
    candidates.push(candidate);
  }
  return candidates;
}

function strip0x(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function wordHex(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function canonicalThoughtCandidate(value: string) {
  return value.replace(/[^A-Za-z]+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
}

function validateRawReturn(rawReturn: string) {
  const normalized = rawReturn.replace(/\r\n?/g, "\n").trim();
  const canonical = canonicalThoughtCandidate(normalized);
  if (!normalized) return { ok: false, reasonCode: 1, error: "empty after normalization" };
  if (byteLength(rawReturn) > MAX_RAW_RETURN_BYTES) {
    return { ok: false, reasonCode: 2, error: "raw return too large" };
  }
  if (normalized.includes("\n")) return { ok: false, reasonCode: 6, error: "multi-line output" };
  if (/[^A-Za-z ]/.test(normalized)) {
    return { ok: false, reasonCode: 4, error: "unsupported characters" };
  }
  if (byteLength(canonical) > MAX_TEXT_BYTES) {
    return { ok: false, reasonCode: 3, error: "text too long" };
  }
  return { ok: true, reasonCode: 0, error: "" };
}

function encodePreviewWorkCall(rawReturn: string) {
  const bytes = new TextEncoder().encode(rawReturn);
  const data = bytesToHex(bytes);
  const paddedData = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
  return `${PREVIEW_WORK_SELECTOR}${wordHex(32n)}${wordHex(BigInt(bytes.length))}${paddedData}`;
}

function readWord(cleanHex: string, byteOffset: number) {
  const start = byteOffset * 2;
  const word = cleanHex.slice(start, start + 64);
  if (word.length !== 64) {
    throw new Error("short ABI response");
  }
  return BigInt(`0x${word}`);
}

function decodeAbiString(cleanHex: string, byteOffset: number) {
  const length = Number(readWord(cleanHex, byteOffset));
  if (!Number.isSafeInteger(length) || length < 0 || length > 1_000_000) {
    throw new Error("invalid ABI string length");
  }
  const dataStart = (byteOffset + 32) * 2;
  const dataHex = cleanHex.slice(dataStart, dataStart + length * 2);
  if (dataHex.length !== length * 2) {
    throw new Error("short ABI string");
  }
  return new TextDecoder().decode(hexToBytes(dataHex));
}

function decodePreviewWorkResult(result: string): ContractPreview {
  const clean = strip0x(result);
  if (clean.length < 64 * 4 || /[^a-fA-F0-9]/.test(clean)) {
    throw new Error("invalid preview result");
  }
  const ok = readWord(clean, 0) !== 0n;
  const textOffset = Number(readWord(clean, 32));
  const svgOffset = Number(readWord(clean, 64));
  const reasonCode = Number(readWord(clean, 96));
  if (!Number.isSafeInteger(textOffset) || !Number.isSafeInteger(svgOffset)) {
    throw new Error("invalid preview offsets");
  }
  return {
    ok,
    text: decodeAbiString(clean, textOffset),
    svg: decodeAbiString(clean, svgOffset),
    reasonCode,
  };
}

async function sha256Hex(value: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function clientRateLimitKey(request: Request) {
  const headers = request.headers;
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

function reserveRateLimitSlot(key: string) {
  const now = Date.now();
  const events = (rateLimitEvents.get(key) ?? []).filter((eventAt) => now - eventAt <= 60 * 60 * 1000);
  const lastMinute = events.filter((eventAt) => now - eventAt <= 60 * 1000).length;
  if (lastMinute >= PREVIEW_RATE_LIMIT.minute || events.length >= PREVIEW_RATE_LIMIT.hour) {
    rateLimitEvents.set(key, events);
    return false;
  }
  events.push(now);
  rateLimitEvents.set(key, events);
  return true;
}

async function fetchRpc(upstream: string, payload: unknown) {
  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), PREVIEW_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const parsed = await response.json().catch(() => null) as RpcResponse | null;
    if (!response.ok || !parsed || parsed.error) {
      throw new Error("RPC upstream failed.");
    }
    return parsed.result;
  } finally {
    clearTimeout(timeout);
  }
}

async function assertChain(upstream: string, expectedChainId: number) {
  const now = Date.now();
  if (cachedChainCheck?.upstream === upstream && cachedChainCheck.expiresAt > now) {
    if (cachedChainCheck.chainId === expectedChainId) return;
    throw new Error("preview RPC chain mismatch.");
  }

  const result = await fetchRpc(upstream, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_chainId",
    params: [],
  });
  const chainId = typeof result === "string" ? Number(BigInt(result)) : NaN;
  cachedChainCheck = {
    upstream,
    chainId,
    expiresAt: now + 60_000,
  };
  if (chainId !== expectedChainId) {
    throw new Error("preview RPC chain mismatch.");
  }
}

async function previewViaRpc(upstream: string, thoughtNftAddress: string, rawReturn: string) {
  const result = await fetchRpc(upstream, {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to: thoughtNftAddress,
        data: encodePreviewWorkCall(rawReturn),
      },
      "latest",
    ],
  });
  if (typeof result !== "string") {
    throw new Error("preview RPC returned no result.");
  }
  return decodePreviewWorkResult(result);
}

async function previewWithCache(upstream: string, chainId: number, thoughtNftAddress: string, rawReturn: string) {
  const hash = await sha256Hex(rawReturn);
  const cacheKey = `${chainId}:${thoughtNftAddress.toLowerCase()}:${hash}`;
  const now = Date.now();
  const cached = previewCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.preview;

  const existing = inFlightPreviewCache.get(cacheKey);
  if (existing) return existing;

  const request = previewViaRpc(upstream, thoughtNftAddress, rawReturn).then((preview) => {
    previewCache.set(cacheKey, {
      preview,
      expiresAt: Date.now() + 10 * 60_000,
    });
    while (previewCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = previewCache.keys().next().value;
      if (oldestKey === undefined) break;
      previewCache.delete(oldestKey);
    }
    return preview;
  }).finally(() => {
    if (inFlightPreviewCache.get(cacheKey) === request) {
      inFlightPreviewCache.delete(cacheKey);
    }
  });
  inFlightPreviewCache.set(cacheKey, request);
  return request;
}

async function readBody(request: Request): Promise<string | Response> {
  const body = await request.text();
  if (byteLength(body) > MAX_BODY_BYTES) {
    return json(413, {
      error: "Preview request body is too large.",
    });
  }
  return body;
}

export function __clearThoughtPreviewCachesForTests() {
  previewCache.clear();
  inFlightPreviewCache.clear();
  rateLimitEvents.clear();
  cachedChainCheck = null;
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

export async function onRequestGet(): Promise<Response> {
  return json(405, {
    error: "Use POST for THOUGHT preview.",
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const upstreams = rpcCandidates(context.env);
  if (!upstreams.length) {
    return json(500, {
      error: "THOUGHT preview RPC upstream is not configured.",
    });
  }

  const thoughtNftAddress = (context.env.THOUGHT_PREVIEW_NFT_ADDRESS || DEFAULT_THOUGHT_NFT_ADDRESS).trim();
  if (!isAddress(thoughtNftAddress)) {
    return json(500, {
      error: "THOUGHT preview contract is not configured.",
    });
  }

  const expectedChainId = Number(context.env.THOUGHT_PREVIEW_CHAIN_ID || DEFAULT_THOUGHT_PREVIEW_CHAIN_ID);
  if (!Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) {
    return json(500, {
      error: "THOUGHT preview chain is not configured.",
    });
  }

  const body = await readBody(context.request);
  if (body instanceof Response) return body;

  let payload: PreviewRequest;
  try {
    payload = JSON.parse(body) as PreviewRequest;
  } catch {
    return json(400, {
      error: "Invalid THOUGHT preview payload.",
    });
  }

  const rawReturn = typeof payload.rawReturn === "string" ? payload.rawReturn : "";
  const validation = validateRawReturn(rawReturn);
  if (!validation.ok) {
    return json(200, {
      ok: false,
      text: "",
      svg: "",
      reasonCode: validation.reasonCode,
    });
  }

  if (!reserveRateLimitSlot(clientRateLimitKey(context.request))) {
    return json(429, {
      error: "THOUGHT preview rate limit reached.",
    });
  }

  for (const upstream of upstreams) {
    try {
      await assertChain(upstream.url, expectedChainId);
      return json(200, await previewWithCache(upstream.url, expectedChainId, thoughtNftAddress, rawReturn));
    } catch {
      if (upstream === upstreams[upstreams.length - 1]) break;
    }
  }

  return json(502, {
    error: "THOUGHT preview unavailable.",
  });
}

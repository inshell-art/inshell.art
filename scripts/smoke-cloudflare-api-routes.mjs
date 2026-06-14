#!/usr/bin/env node

const DEFAULT_HOME_BASE = "https://inshell.art";
const DEFAULT_THOUGHT_BASE = "https://thought.inshell.art";
const STAGING_HOME_BASE = "https://staging.inshell-art.pages.dev";
const STAGING_THOUGHT_BASE = "https://staging.thought-inshell-art.pages.dev";
const SEPOLIA_CHAIN_ID = "0xaa36a7";
const ATTEMPT_DELAYS_MS = [0, 1_000, 3_000, 6_000];
const REQUEST_TIMEOUT_MS = 12_000;

function parseArgs(argv) {
  const args = {
    scope: "all",
    homeBase: DEFAULT_HOME_BASE,
    thoughtBase: DEFAULT_THOUGHT_BASE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    if (arg === "--scope" && next) {
      args.scope = next;
      index += 1;
      continue;
    }
    if (arg === "--home-base" && next) {
      args.homeBase = next;
      index += 1;
      continue;
    }
    if (arg === "--thought-base" && next) {
      args.thoughtBase = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  if (!["all", "home", "thought"].includes(args.scope)) {
    throw new Error(`Invalid --scope ${args.scope}; expected all, home, or thought.`);
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${url} returned non-JSON response with status ${response.status}`);
    }
    if (!response.ok) {
      throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 240)}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function retry(label, fn) {
  let lastError;
  for (const delay of ATTEMPT_DELAYS_MS) {
    if (delay > 0) {
      await sleep(delay);
    }
    try {
      const result = await fn();
      console.log(`[smoke] ok ${label}`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[smoke] retry ${label}: ${error.message}`);
    }
  }
  throw new Error(`${label} failed after ${ATTEMPT_DELAYS_MS.length} attempts: ${lastError?.message ?? "unknown error"}`);
}

function urlFor(base, path) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

async function checkRpcChainId(base, path, label) {
  await retry(label, async () => {
    const payload = await fetchJsonWithTimeout(urlFor(base, path), {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });
    if (payload?.result !== SEPOLIA_CHAIN_ID) {
      throw new Error(`expected Sepolia chain id ${SEPOLIA_CHAIN_ID}, got ${JSON.stringify(payload)}`);
    }
  });
}

async function checkGetArrayField(base, path, field, label) {
  await retry(label, async () => {
    const payload = await fetchJsonWithTimeout(urlFor(base, path), { method: "GET" });
    if (!Array.isArray(payload?.[field])) {
      throw new Error(`expected JSON array field "${field}"`);
    }
  });
}

async function checkThoughtPreview(base) {
  await retry("thought /api/thought-preview", async () => {
    const payload = await fetchJsonWithTimeout(urlFor(base, "/api/thought-preview"), {
      method: "POST",
      body: JSON.stringify({ rawReturn: "HELLO" }),
    });
    if (!payload || typeof payload.ok !== "boolean") {
      throw new Error("expected preview payload with boolean ok");
    }
  });
}

async function checkHome(base) {
  await checkRpcChainId(base, "/api/path-rpc", "home /api/path-rpc");
  await checkGetArrayField(base, "/api/pulse-auction", "bids", "home /api/pulse-auction");
  await checkGetArrayField(base, "/api/path-tokens", "items", "home /api/path-tokens");
}

async function checkThought(base) {
  await checkRpcChainId(base, "/api/path-rpc", "thought /api/path-rpc");
  await checkRpcChainId(base, "/api/thought-rpc", "thought /api/thought-rpc");
  await checkThoughtPreview(base);
  await checkGetArrayField(base, "/api/thought-gallery", "thoughts", "thought /api/thought-gallery");
  await checkGetArrayField(base, "/api/path-tokens", "items", "thought /api/path-tokens");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.scope === "home" || args.scope === "all") {
    await checkHome(args.homeBase);
  }
  if (args.scope === "thought" || args.scope === "all") {
    await checkThought(args.thoughtBase);
  }
}

main().catch((error) => {
  console.error(`[smoke] failed: ${error.message}`);
  process.exitCode = 1;
});

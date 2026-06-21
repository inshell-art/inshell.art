#!/usr/bin/env node

const DEFAULT_HOME_BASE = "https://inshell.art";
const DEFAULT_THOUGHT_BASE = "https://thought.inshell.art";
const STAGING_HOME_BASE = "https://staging.inshell-art.pages.dev";
const STAGING_THOUGHT_BASE = "https://staging.thought-inshell-art.pages.dev";
const SEPOLIA_CHAIN_ID = "0xaa36a7";
const ATTEMPT_DELAYS_MS = [0, 1_000, 3_000, 6_000];
const REQUEST_TIMEOUT_MS = 12_000;
const PUB_BOUNDARY_SMOKE_PATHS = [
  "/llms.txt",
  "/pub.manifest.json",
  "/pub/contract/pub-path-boundary.json",
];

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

async function fetchTextWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*;q=0.1",
        ...(init?.headers ?? {}),
      },
    });
    return {
      response,
      text: await response.text(),
    };
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

async function checkOpsStatus(base, label) {
  await retry(label, async () => {
    const payload = await fetchJsonWithTimeout(urlFor(base, "/api/ops/status"), { method: "GET" });
    if (payload?.ok !== true) {
      throw new Error("expected ok=true");
    }
    if (payload?.contract?.name !== "inshell-dev-ops-chain-read-model") {
      throw new Error("expected DEV/OPS chain read-model contract name");
    }
    if (payload?.network?.chainId !== 11155111) {
      throw new Error(`expected Sepolia chain id 11155111, got ${JSON.stringify(payload?.network)}`);
    }
    if (!payload?.routes?.refresh?.route || !Array.isArray(payload?.routes?.readModel)) {
      throw new Error("expected route contract for refresh and read model");
    }
    if (
      payload?.routes?.analytics?.eventRoute !== "/api/analytics/event" ||
      payload?.routes?.analytics?.visitorRoute !== "/api/analytics/visitors" ||
      payload?.anonymousAnalytics?.identity !== "anonymous-browser-session" ||
      payload?.anonymousAnalytics?.rawIpStored !== false ||
      payload?.anonymousAnalytics?.rawUserAgentStored !== false ||
      payload?.anonymousAnalytics?.rawWalletAddressStored !== false ||
      payload?.anonymousAnalytics?.metadataAllowlist !== true
    ) {
      throw new Error("expected anonymous analytics route contract and privacy flags");
    }
    if (JSON.stringify(payload).includes("http")) {
      throw new Error("ops status must not expose raw endpoint URLs");
    }
  });
}

function isDevAppShellResponse(response, text) {
  const contentType = response.headers.get("content-type") ?? "";
  return (
    contentType.includes("text/html") &&
    (
      text.includes('<div id="root"></div>') ||
      text.includes("Inshell / PATH") ||
      text.includes("THOUGHT creation, minting, and gallery for Inshell.") ||
      /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(text)
    )
  );
}

async function checkPubBoundarySmoke(base) {
  for (const path of PUB_BOUNDARY_SMOKE_PATHS) {
    await retry(`home PUB boundary ${path}`, async () => {
      const { response, text } = await fetchTextWithTimeout(urlFor(base, path), {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
      }
      if (isDevAppShellResponse(response, text)) {
        throw new Error(`${path} is being served by the DEV app shell`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (path === "/llms.txt" && !contentType.includes("text/plain")) {
        throw new Error(`${path} returned unexpected content-type ${contentType || "(missing)"}`);
      }
      if ((path === "/pub.manifest.json" || path === "/pub/contract/pub-path-boundary.json") && response.ok) {
        let payload;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error(`${path} returned HTTP ${response.status} but not JSON`);
        }
        if (path === "/pub/contract/pub-path-boundary.json") {
          if (
            payload?.schemaVersion !== 1 ||
            payload?.origin !== "https://inshell.art" ||
            payload?.owner !== "PUB" ||
            !Array.isArray(payload?.paths?.exact) ||
            !Array.isArray(payload?.paths?.prefixes)
          ) {
            throw new Error(`${path} returned an invalid PUB boundary contract`);
          }
        } else if (payload?.schemaVersion !== 1 || !Array.isArray(payload?.files)) {
          throw new Error(`${path} returned an invalid PUB manifest`);
        }
      }
    });
  }
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
  await checkOpsStatus(base, "home /api/ops/status");
  await checkPubBoundarySmoke(base);
  await checkRpcChainId(base, "/api/path-rpc", "home /api/path-rpc");
  await checkGetArrayField(base, "/api/pulse-auction", "bids", "home /api/pulse-auction");
  await checkGetArrayField(base, "/api/path-tokens", "items", "home /api/path-tokens");
}

async function checkThought(base) {
  await checkOpsStatus(base, "thought /api/ops/status");
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

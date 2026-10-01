#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export function parseArgs(argv) {
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
      redirect: "error",
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
      redirect: "error",
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

// PATH's generic 500 is NOT evidence of an inactive deployment. Its historical
// read model can fail for RPC/storage reasons. When inventory is applicable,
// it must remain a blocking check; otherwise skip explicitly without accepting
// an HTTP error as success. PathPage exits before inventory in before_deploy.
export function validateContractArrayResponse(path, field, status, payload, closed) {
  if (closed && path === "/api/thought-gallery") {
    if (status !== 503 || payload?.code !== "THOUGHT_GALLERY_DEPLOYMENT_INACTIVE" ||
        payload?.status !== "not-deployed" || payload?.error !== "Current THOUGHT collection is not deployed." ||
        Object.keys(payload).sort().join() !== "code,error,status") {
      throw new Error("expected exact inactive THOUGHT gallery response under verified closed deployment lock");
    }
    return;
  }
  if (status !== 200 || !Array.isArray(payload?.[field])) {
    throw new Error(`${path}: expected HTTP 200 with JSON array field "${field}"`);
  }
}

async function checkContractArrayField(base, path, field, label, closed) {
  if (closed && path === "/api/path-tokens") {
    console.log(`[smoke] SKIP ${label}: no approved deployment; historical-only inventory is not used by this phase. Legacy service health is unassessed, not passed.`);
    return;
  }
  await retry(label, async () => {
    const { response, text } = await fetchTextWithTimeout(urlFor(base, path), { method: "GET" });
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${urlFor(base, path)} returned non-JSON response with status ${response.status}`);
    }
    validateContractArrayResponse(path, field, response.status, payload, closed);
  });
}

export function validateOpsStatus(payload, expectedLock = JSON.parse(readFileSync(new URL("../apps/thought/production/deployment-lock.json", import.meta.url), "utf8"))) {
    if (payload?.ok !== true) {
      throw new Error("expected ok=true");
    }
    if (payload?.contract?.name !== "inshell-dev-ops-chain-read-model") {
      throw new Error("expected DEV/OPS chain read-model contract name");
    }
    const lock = payload?.deploymentLock;
    if (payload?.contract?.version !== 2 || lock?.enforcement !== "always" ||
        lock?.integrity !== "valid" || !Number.isSafeInteger(lock?.revision) ||
        !Array.isArray(lock?.differences) || lock.differences.length) {
      throw new Error("expected valid, always-enforced deployment reference without drift");
    }
    if (lock.schema !== expectedLock.schema || lock.revision !== expectedLock.revision || lock.state !== expectedLock.state ||
        lock.requiredRelease?.artifactId !== expectedLock.requiredRelease.artifactId ||
        lock.requiredRelease?.manifestSha256 !== expectedLock.requiredRelease.manifestSha256) {
      throw new Error("deployed lock differs from the checked-out release reference");
    }
    if (lock.state === "no-approved-deployment") {
      if (expectedLock.deployment !== null || payload.network !== null ||
          ["pathNft", "pulseAuction", "thoughtNft"].some(name => !payload.contracts?.[name]) ||
          Object.values(payload.contracts ?? {}).some((item) => item?.address !== null || item?.deployBlock !== null) ||
          payload.contracts.thoughtNft.artifactId !== null || payload.contracts.thoughtNft.manifestSha256 !== null ||
          payload.contracts.thoughtNft.status !== "not-deployed" ||
          payload.historicalReadModel?.status !== "historical-only" ||
          payload.historicalReadModel?.notApprovedForCurrentDeployment !== true ||
          payload.activationPolicy?.deploymentRevision !== lock.revision ||
          ["frontendActivationApproved", "signerActivationApproved", "mintActivationApproved"].some(key => payload.activationPolicy?.[key] !== false)) {
        throw new Error("unapproved deployment material advertised as current");
      }
    } else if (lock.state !== "approved-deployment" || !payload?.network?.chainId) {
      throw new Error("expected one exact approved deployment or explicit absence");
    }
    if (!payload?.routes?.refresh?.route || !Array.isArray(payload?.routes?.readModel)) {
      throw new Error("expected route contract for refresh and read model");
    }
    if (lock.state === "no-approved-deployment") {
      const gallery = payload.routes.readModel.filter(item => item.route === "/api/thought-gallery");
      if (gallery.length !== 1 || gallery[0].status !== "not-deployed" || gallery[0].snapshotKey !== null) {
        throw new Error("expected inactive gallery route consistent with the closed lock");
      }
    }
    if (
      payload?.routes?.analytics?.eventRoute !== "/api/analytics/event" ||
      payload?.routes?.analytics?.visitorRoute !== "/api/analytics/visitors" ||
      payload?.anonymousAnalytics?.identity !== "anonymous-browser-session" ||
      payload?.anonymousAnalytics?.rawIpStored !== false ||
      payload?.anonymousAnalytics?.rawUserAgentStored !== false ||
      payload?.anonymousAnalytics?.rawVisitIdStored !== false ||
      payload?.anonymousAnalytics?.rawWalletAddressStored !== false ||
      payload?.anonymousAnalytics?.metadataAllowlist !== true ||
      payload?.anonymousAnalytics?.visitTimeoutMinutes !== 30
    ) {
      throw new Error("expected anonymous analytics route contract and privacy flags");
    }
    if (JSON.stringify(payload).includes("http")) {
      throw new Error("ops status must not expose raw endpoint URLs");
    }
    return lock.state === "no-approved-deployment";
}

async function checkOpsStatus(base, label) {
  return retry(label, async () => {
    const payload = await fetchJsonWithTimeout(urlFor(base, "/api/ops/status"), { method: "GET" });
    return validateOpsStatus(payload);
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

export function validatePlainCapabilities(status, payload, origin, enabled) {
  if (!enabled) {
    if (status !== 404 || payload?.code !== "NOT_FOUND" || Object.keys(payload).join() !== "code") {
      throw new Error("standalone compatibility must keep plain creation disabled");
    }
    return;
  }
  if (status !== 200 || payload?.schema !== "inshell.thought.plain-capabilities.v1" ||
      payload.enabled !== true || payload.origin !== origin || payload.mintEligible !== false ||
      payload.writeTtlMs !== 30 * 60_000 || payload.readTtlMs !== 24 * 60 * 60_000) {
    throw new Error("expected enabled same-origin plain capabilities with configured store and no mint eligibility");
  }
}

async function checkPlainCapabilities(base, enabled) {
  const origin = new URL(base).origin;
  if (origin !== base || ![DEFAULT_HOME_BASE, "https://preview.inshell.art", DEFAULT_THOUGHT_BASE, STAGING_THOUGHT_BASE, STAGING_HOME_BASE].includes(origin)) {
    throw new Error("expected an exact supported product or compatibility origin");
  }
  await retry("plain capabilities", async () => {
    const { response, text } = await fetchTextWithTimeout(urlFor(origin, "/api/thought-plain/v1/capabilities"), { method: "GET" });
    validatePlainCapabilities(response.status, JSON.parse(text), origin, enabled);
  });
}

export function validatePreviewAliasRejection(status, payload) {
  if (status !== 403 || payload?.code !== "ORIGIN_NOT_ALLOWED" || Object.keys(payload).join() !== "code") {
    throw new Error("expected exact preview alias origin rejection, not disabled or misconfigured plain service");
  }
}

export async function checkHome(base) {
  const closed = await checkOpsStatus(base, "home /api/ops/status");
  await checkPubBoundarySmoke(base);
  await checkRpcChainId(base, "/api/path-rpc", "home /api/path-rpc");
  await checkGetArrayField(base, "/api/pulse-auction", "bids", "home /api/pulse-auction");
  await checkContractArrayField(
    base,
    "/api/path-tokens",
    "items",
    "home /api/path-tokens",
    closed,
  );
  // Home owns the canonical same-origin THOUGHT app too.
  await checkContractArrayField(base, "/api/thought-gallery", "thoughts", "home /api/thought-gallery", closed);
  if (base === STAGING_HOME_BASE) {
    // Access protects the canonical preview; the plain handler rejects alias
    // requests by design. Do not substitute an alias or weaken origin checks.
    await retry("preview plain alias origin boundary (not canonical availability)", async () => {
      const { response, text } = await fetchTextWithTimeout(urlFor(base, "/api/thought-plain/v1/capabilities"), { method: "GET" });
      validatePreviewAliasRejection(response.status, JSON.parse(text));
    });
    console.log("[smoke] NOT CHECKED preview canonical plain capabilities/store availability: OPS authenticated verification at https://preview.inshell.art is still required; alias 403 proves only the origin boundary.");
  } else {
    await checkPlainCapabilities(base, true);
  }
}

export async function checkThought(base) {
  const closed = await checkOpsStatus(base, "thought /api/ops/status");
  await checkRpcChainId(base, "/api/path-rpc", "thought /api/path-rpc");
  await checkRpcChainId(base, "/api/thought-rpc", "thought /api/thought-rpc");
  await checkThoughtPreview(base);
  await checkContractArrayField(
    base,
    "/api/thought-gallery",
    "thoughts",
    "thought /api/thought-gallery",
    closed,
  );
  await checkContractArrayField(
    base,
    "/api/path-tokens",
    "items",
    "thought /api/path-tokens",
    closed,
  );
  await checkPlainCapabilities(base, false);
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(`[smoke] failed: ${error.message}`);
  process.exitCode = 1;
});

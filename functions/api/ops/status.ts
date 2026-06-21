import {
  PATH_NFT_ADDRESS,
  PATH_NFT_DEPLOY_BLOCK,
  PULSE_AUCTION_ADDRESS,
  PULSE_AUCTION_DEPLOY_BLOCK,
  SEPOLIA_CHAIN_ID,
  THOUGHT_NFT_ADDRESS,
  THOUGHT_NFT_DEPLOY_BLOCK,
  json,
  onOptions,
  readModelEnabled,
  type ChainCacheEnv,
  type PagesContextLike,
} from "../chain-cache";
import { analyticsHostScopeForHostname, readAnalyticsStatus } from "../analytics/store";
import { readIndexerEventStatus } from "../indexer/event-status";

type EnvKey = keyof ChainCacheEnv;

const CONTRACT_VERSION = 1;
const CHAIN = "sepolia";
const NETWORK = "Sepolia rehearsal";
const CURRENCY = "testnet ETH";

const ROUTES = {
  rpc: [
    { route: "/api/path-rpc", service: "path", upstreamRole: "PATH_PRIMARY_RPC_UPSTREAM" },
    { route: "/api/thought-rpc", service: "thought", upstreamRole: "THOUGHT_PRIMARY_RPC_UPSTREAM" },
    { route: "/api/eth-rpc", service: "fallback", upstreamRole: "PRIVATE_FALLBACK_RPC_UPSTREAM" },
  ],
  readModel: [
    { route: "/api/pulse-auction", snapshotKey: "pulse-auction:v1:sepolia", owner: "home" },
    { route: "/api/path-tokens", snapshotKey: "path-tokens:v1:sepolia", owner: "home" },
    { route: "/api/thought-gallery", snapshotKey: "thought-gallery:v1:sepolia", owner: "thought" },
  ],
  refresh: {
    route: "/api/indexer/refresh",
    method: "POST",
    auth: {
      requiredFor: ["path-tokens", "thought-gallery", "all"],
      publicTargets: ["pulse-auction with tx hash"],
      headerNames: ["authorization: Bearer <token>", "x-inshell-indexer-token"],
    },
    targets: ["pulse-auction", "path-tokens", "thought-gallery", "all"],
  },
  event: {
    route: "/api/indexer/event",
    method: "POST",
    auth: "bearer-token-required",
    targets: ["pulse-auction", "path-tokens", "thought-gallery"],
  },
  analytics: {
    eventRoute: "/api/analytics/event",
    summaryRoute: "/api/analytics/summary",
    summaryAuth: "bearer-token-required",
    identity: "anonymous-browser-session",
  },
  publicFeed: [
    "/rss.xml",
    "/feed.xml",
    "/rss.sepolia.xml",
    "/events.json",
    "/source/**",
    "/source-assets/**",
  ],
};

const DIAGNOSTIC_HEADERS = [
  "x-chain-cache-source",
  "x-chain-cache-key",
  "x-kv-read",
  "x-kv-write",
  "x-db-read",
  "x-db-write",
  "x-live-rpc-calls",
  "x-cache-snapshot-block",
];

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  const eventStatus = await readIndexerEventStatus(ctx.env);
  const analyticsStatus = await readAnalyticsStatus(
    ctx.env,
    analyticsHostScopeForHostname(url.hostname),
  );
  const payload = {
    ok: true,
    contract: {
      name: "inshell-dev-ops-chain-read-model",
      version: CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
    },
    host: {
      hostname: url.hostname,
      app: appForHost(url.hostname),
      branch: publicEnv(ctx.env, "CF_PAGES_BRANCH"),
      deploymentId: publicEnv(ctx.env, "CF_PAGES_DEPLOYMENT_ID"),
      commitSha: publicEnv(ctx.env, "CF_PAGES_COMMIT_SHA"),
    },
    network: {
      network: NETWORK,
      chain: CHAIN,
      chainId: SEPOLIA_CHAIN_ID,
      currency: CURRENCY,
    },
    contracts: {
      pathNft: {
        address: PATH_NFT_ADDRESS,
        deployBlock: PATH_NFT_DEPLOY_BLOCK,
      },
      pulseAuction: {
        address: PULSE_AUCTION_ADDRESS,
        deployBlock: PULSE_AUCTION_DEPLOY_BLOCK,
      },
      thoughtNft: {
        address: THOUGHT_NFT_ADDRESS,
        deployBlock: THOUGHT_NFT_DEPLOY_BLOCK,
      },
    },
    routes: ROUTES,
    indexerEventIngest: {
      enabled: true,
      route: "/api/indexer/event",
      targets: ["pulse-auction", "path-tokens", "thought-gallery"],
      auth: "bearer-token-required",
      statusSource: eventStatus.source,
      statusError: eventStatus.error,
      lastAcceptedAt: eventStatus.status?.lastAcceptedAt ?? null,
      lastAppliedAt: eventStatus.status?.lastAppliedAt ?? null,
      lastAppliedTarget: eventStatus.status?.lastAppliedTarget ?? null,
      lastTxHash: eventStatus.status?.lastTxHash ?? null,
      lastBlockNumber: eventStatus.status?.lastBlockNumber ?? null,
      lastLogIndex: eventStatus.status?.lastLogIndex ?? null,
      lastResultApplied: eventStatus.status?.lastResultApplied ?? null,
      lastResultSource: eventStatus.status?.lastResultSource ?? null,
      cachedAt: eventStatus.status?.cachedAt ?? null,
      lastScannedBlock: eventStatus.status?.lastScannedBlock ?? null,
      acceptedCount: eventStatus.status?.acceptedCount ?? 0,
      appliedCount: eventStatus.status?.appliedCount ?? 0,
    },
    anonymousAnalytics: analyticsStatus,
    cache: {
      readModelEnabled: readModelEnabled(ctx.env),
      d1Bound: Boolean(ctx.env.INSHELL_CHAIN_DATA_DB),
      kvBound: Boolean(ctx.env.INSHELL_CHAIN_DATA_KV),
      responseCache: "Cloudflare Cache API, route-level public response cache",
      diagnosticsEnabled: diagnosticsEnabled(ctx.env),
      diagnosticsHeaders: DIAGNOSTIC_HEADERS,
    },
    rpcUpstreams: {
      pathPrimary: upstreamStatus(ctx.env, "PATH_PRIMARY_RPC_UPSTREAM", [
        "PATH_PRIMARY_RPC_UPSTREAM",
        "PATH_RPC_UPSTREAM",
      ], [
        "PATH_PRIMARY_RPC_LABEL",
        "PATH_RPC_LABEL",
      ]),
      thoughtPrimary: upstreamStatus(ctx.env, "THOUGHT_PRIMARY_RPC_UPSTREAM", [
        "THOUGHT_PRIMARY_RPC_UPSTREAM",
        "THOUGHT_RPC_UPSTREAM",
      ], [
        "THOUGHT_PRIMARY_RPC_LABEL",
        "THOUGHT_RPC_LABEL",
      ]),
      privateFallback: upstreamStatus(ctx.env, "PRIVATE_FALLBACK_RPC_UPSTREAM", [
        "PRIVATE_FALLBACK_RPC_UPSTREAM",
        "ETH_RPC_UPSTREAM",
      ], [
        "PRIVATE_FALLBACK_RPC_LABEL",
        "ETH_RPC_LABEL",
      ]),
      publicFallback: upstreamStatus(ctx.env, "PUBLIC_FALLBACK_RPC_UPSTREAM", [
        "PUBLIC_FALLBACK_RPC_UPSTREAM",
        "RPC_UPSTREAM_FALLBACK",
      ], [
        "PUBLIC_FALLBACK_RPC_LABEL",
        "RPC_UPSTREAM_FALLBACK_LABEL",
      ]),
    },
    opsBoundary: {
      devOwns: [
        "Pages API route behavior",
        "chain_snapshots table schema and read/write code",
        "anonymous analytics event and summary route behavior",
        "RPC route selection contract",
        "frontend read behavior and diagnostics headers",
      ],
      opsOwns: [
        "D1/KV resources and bindings",
        "anonymous analytics endpoint health and D1 quota monitoring",
        "scheduled indexer refresh worker",
        "RPC provider quota monitoring",
        "status freshness and alerting",
      ],
      operatorOwns: [
        "production merge approval",
        "secrets and account-level Cloudflare/GitHub settings",
      ],
    },
  };

  return json(200, payload);
}

function appForHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower.includes("thought") || lower.includes("gallery")) return "thought";
  return "home";
}

function diagnosticsEnabled(env: ChainCacheEnv) {
  return env.CHAIN_CACHE_DIAGNOSTICS === "1" || env.CHAIN_CACHE_DIAGNOSTICS === "true";
}

function upstreamStatus(
  env: ChainCacheEnv,
  role: string,
  upstreamKeys: EnvKey[],
  labelKeys: EnvKey[],
) {
  const configuredKey = upstreamKeys.find((key) => Boolean(readEnv(env, key)));
  const label = labelKeys.map((key) => readEnv(env, key)).find(Boolean) || role;
  return {
    role,
    configured: Boolean(configuredKey),
    configuredKey: configuredKey ?? null,
    label,
  };
}

function publicEnv(env: ChainCacheEnv, key: string) {
  const value = (env as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readEnv(env: ChainCacheEnv, key: EnvKey) {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

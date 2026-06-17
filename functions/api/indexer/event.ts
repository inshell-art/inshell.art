import {
  PATH_NFT_ADDRESS,
  PULSE_AUCTION_ADDRESS,
  PULSE_SALE_TOPIC,
  THOUGHT_MINTED_TOPIC,
  THOUGHT_NFT_ADDRESS,
  TRANSFER_TOPIC,
  createChainCacheDiagnostics,
  createStats,
  emitUsage,
  isTxHash,
  json,
  onOptions,
  withChainCacheDiagnostics,
  type ChainCacheDiagnostics,
  type IndexedSnapshot,
  type PagesContextLike,
} from "../chain-cache";
import { refreshPathTokens } from "../path-tokens";
import { refreshPulseAuction, refreshPulseAuctionForTx } from "../pulse-auction";
import { refreshThoughtGallery } from "../thought-gallery";
import { isIndexerAuthorized } from "./auth";
import { writeIndexerEventStatus } from "./event-status";

type EventTarget = "pulse-auction" | "path-tokens" | "thought-gallery";

type IndexerEventEnvelope = {
  version?: unknown;
  source?: unknown;
  network?: unknown;
  target?: unknown;
  txHash?: unknown;
  blockNumber?: unknown;
  logIndex?: unknown;
  contractAddress?: unknown;
  topic0?: unknown;
};

type ValidEvent = {
  target: EventTarget;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  contractAddress: string;
  topic0: string;
};

const EVENT_SOURCE = "ops-chain-event-ingress";

const PULSE_LAUNCH_CONFIGURED_TOPIC =
  "0xb50a0ea9bb6d2c2a03f4e905919179629acdfa89f0d32153740080caf002ddea";
const PATH_METADATA_UPDATE_TOPIC =
  "0xf8e1a15aba9398e019f0b49df1a4fde98ee17ae345cb5f6b5e2c27f5033e8ce7";
const PATH_MOVEMENT_CONSUMED_TOPIC =
  "0x419d6a4af86af053d21c8b6823e44940b6593b32919e0c4763c6af0a461428c8";
const PATH_THOUGHT_CONSUMED_TOPIC =
  "0xe0e6a445ac8ff8a030e836836e44e3bac120e57cbd845e01ee33f2ba46a1f68f";

const EVENT_TARGETS: Record<
  EventTarget,
  {
    snapshotKey: string;
    service: "path" | "thought";
    statsRoute: string;
    contractAddresses: string[];
    topic0s: Set<string>;
    refresh: (
      ctx: PagesContextLike,
      stats: ReturnType<typeof createStats>,
      diagnostics: ChainCacheDiagnostics,
      event: ValidEvent,
    ) => Promise<IndexedSnapshot<unknown>>;
  }
> = {
  "pulse-auction": {
    snapshotKey: "pulse-auction:v1:sepolia",
    service: "path",
    statsRoute: "indexer-event:pulse-auction",
    contractAddresses: [PULSE_AUCTION_ADDRESS.toLowerCase()],
    topic0s: new Set([PULSE_SALE_TOPIC, PULSE_LAUNCH_CONFIGURED_TOPIC]),
    refresh: async (ctx, stats, diagnostics, event) => {
      if (event.topic0 === PULSE_LAUNCH_CONFIGURED_TOPIC) {
        return await refreshPulseAuction(ctx, stats, diagnostics);
      }
      return await refreshPulseAuctionForTx(ctx, stats, diagnostics, event.txHash);
    },
  },
  "path-tokens": {
    snapshotKey: "path-tokens:v1:sepolia",
    service: "path",
    statsRoute: "indexer-event:path-tokens",
    contractAddresses: [PATH_NFT_ADDRESS.toLowerCase(), THOUGHT_NFT_ADDRESS.toLowerCase()],
    topic0s: new Set([
      TRANSFER_TOPIC,
      PATH_METADATA_UPDATE_TOPIC,
      PATH_MOVEMENT_CONSUMED_TOPIC,
      PATH_THOUGHT_CONSUMED_TOPIC,
    ]),
    refresh: async (ctx, stats, diagnostics) => refreshPathTokens(ctx, stats, diagnostics),
  },
  "thought-gallery": {
    snapshotKey: "thought-gallery:v1:sepolia",
    service: "thought",
    statsRoute: "indexer-event:thought-gallery",
    contractAddresses: [THOUGHT_NFT_ADDRESS.toLowerCase()],
    topic0s: new Set([THOUGHT_MINTED_TOPIC]),
    refresh: async (ctx, stats, diagnostics) => refreshThoughtGallery(ctx, stats, diagnostics),
  },
};

export const onRequestOptions = onOptions;

export async function onRequestPost(ctx: PagesContextLike): Promise<Response> {
  if (!isIndexerAuthorized(ctx)) {
    return json(401, { error: "indexer event token required" });
  }

  const body = await readJsonBody(ctx.request);
  const parsed = validateEvent(body);
  if (!parsed.ok) return json(400, { error: parsed.error });

  const event = parsed.event;
  const config = EVENT_TARGETS[event.target];
  const diagnostics = createChainCacheDiagnostics(config.snapshotKey);
  const stats = createStats(config.service, config.statsRoute, ctx.env);
  try {
    const snapshot = await config.refresh(ctx, stats, diagnostics, event);
    emitUsage(ctx, stats);

    const applied = event.target === "pulse-auction" && event.topic0 !== PULSE_LAUNCH_CONFIGURED_TOPIC
      ? snapshot.items.some((item: { txHash?: string }) =>
        item.txHash?.toLowerCase() === event.txHash.toLowerCase()
      )
      : true;
    const source = diagnostics.dbWrite ? "d1" : diagnostics.source;
    const statusWrite = await writeIndexerEventStatus(ctx.env, {
      target: event.target,
      txHash: event.txHash,
      blockNumber: event.blockNumber,
      logIndex: event.logIndex,
      applied,
      cachedAt: snapshot.cachedAt,
      lastScannedBlock: snapshot.lastScannedBlock,
      source,
    });

    const response = json(200, {
      ok: true,
      target: event.target,
      applied,
      cachedAt: snapshot.cachedAt,
      lastScannedBlock: snapshot.lastScannedBlock,
      source,
      txHash: event.txHash,
      eventStatus: {
        persisted: statusWrite.persisted,
        statusSource: statusWrite.source,
        lastAcceptedAt: statusWrite.status?.lastAcceptedAt ?? null,
        lastAppliedTarget: statusWrite.status?.lastAppliedTarget ?? null,
        acceptedCount: statusWrite.status?.acceptedCount ?? null,
        appliedCount: statusWrite.status?.appliedCount ?? null,
        error: statusWrite.error,
      },
    });
    response.headers.set("x-indexer-event-status-write", statusWrite.persisted ? "1" : "0");
    response.headers.set("x-indexer-event-status-source", statusWrite.source);
    return withChainCacheDiagnostics(ctx, response, diagnostics, stats, snapshot);
  } catch {
    emitUsage(ctx, stats);
    return json(500, { error: "indexer event failed" });
  }
}

function validateEvent(body: IndexerEventEnvelope):
  | { ok: true; event: ValidEvent }
  | { ok: false; error: string } {
  if (body.version !== 1) return { ok: false, error: "invalid event version" };
  if (body.source !== EVENT_SOURCE) return { ok: false, error: "invalid event source" };
  if (body.network !== "sepolia") return { ok: false, error: "invalid event network" };

  const target = readString(body.target);
  if (target !== "pulse-auction" && target !== "path-tokens" && target !== "thought-gallery") {
    return { ok: false, error: "invalid event target" };
  }

  const txHash = readString(body.txHash);
  if (!isTxHash(txHash)) return { ok: false, error: "invalid transaction hash" };

  const contractAddress = readString(body.contractAddress).toLowerCase();
  const topic0 = readString(body.topic0).toLowerCase();
  const config = EVENT_TARGETS[target];
  if (!config.contractAddresses.includes(contractAddress)) {
    return { ok: false, error: "invalid event contract" };
  }
  if (!config.topic0s.has(topic0)) {
    return { ok: false, error: "invalid event topic" };
  }

  if (!isNonNegativeInteger(body.logIndex)) return { ok: false, error: "invalid log index" };
  if (!isPositiveInteger(body.blockNumber)) return { ok: false, error: "invalid block number" };

  return {
    ok: true,
    event: {
      target,
      txHash,
      blockNumber: body.blockNumber,
      logIndex: body.logIndex,
      contractAddress,
      topic0,
    },
  };
}

async function readJsonBody(request: Request): Promise<IndexerEventEnvelope> {
  if (!request.headers.get("content-type")?.includes("application/json")) return {};
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as IndexerEventEnvelope)
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPositiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0;
}

import {
  PULSE_AUCTION_ADDRESS,
  PULSE_SALE_TOPIC,
  createChainCacheDiagnostics,
  createStats,
  emitUsage,
  isTxHash,
  json,
  onOptions,
  withChainCacheDiagnostics,
  type PagesContextLike,
  type PulseBidApiItem,
} from "../chain-cache";
import { refreshPulseAuctionForTx } from "../pulse-auction";
import { isIndexerAuthorized } from "./auth";
import { writeIndexerEventStatus } from "./event-status";

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

const SNAPSHOT_KEY = "pulse-auction:v1:sepolia";
const EVENT_SOURCE = "ops-chain-event-ingress";

export const onRequestOptions = onOptions;

export async function onRequestPost(ctx: PagesContextLike): Promise<Response> {
  if (!isIndexerAuthorized(ctx)) {
    return json(401, { error: "indexer event token required" });
  }

  const body = await readJsonBody(ctx.request);
  const event = validateEvent(body);
  if (!event.ok) return json(400, { error: event.error });

  const diagnostics = createChainCacheDiagnostics(SNAPSHOT_KEY);
  const stats = createStats("path", "indexer-event:pulse-auction", ctx.env);
  try {
    const snapshot = await refreshPulseAuctionForTx(
      ctx,
      stats,
      diagnostics,
      event.txHash,
    );
    emitUsage(ctx, stats);
    const normalizedTxHash = event.txHash.toLowerCase();
    const applied = snapshot.items.some(
      (item: PulseBidApiItem) => item.txHash?.toLowerCase() === normalizedTxHash,
    );
    const source = diagnostics.dbWrite ? "d1" : diagnostics.source;
    const statusWrite = await writeIndexerEventStatus(ctx.env, {
      target: "pulse-auction",
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
      target: "pulse-auction",
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
  | { ok: true; txHash: string; blockNumber: number; logIndex: number }
  | { ok: false; error: string } {
  if (body.version !== 1) return { ok: false, error: "invalid event version" };
  if (body.source !== EVENT_SOURCE) return { ok: false, error: "invalid event source" };
  if (body.network !== "sepolia") return { ok: false, error: "invalid event network" };
  if (body.target !== "pulse-auction") return { ok: false, error: "invalid event target" };
  const txHash = readString(body.txHash);
  if (!isTxHash(txHash)) return { ok: false, error: "invalid transaction hash" };
  const contractAddress = readString(body.contractAddress).toLowerCase();
  if (contractAddress !== PULSE_AUCTION_ADDRESS.toLowerCase()) {
    return { ok: false, error: "invalid event contract" };
  }
  const topic0 = readString(body.topic0).toLowerCase();
  if (topic0 !== PULSE_SALE_TOPIC.toLowerCase()) {
    return { ok: false, error: "invalid event topic" };
  }
  if (!isNonNegativeInteger(body.logIndex)) return { ok: false, error: "invalid log index" };
  if (!isPositiveInteger(body.blockNumber)) return { ok: false, error: "invalid block number" };
  return { ok: true, txHash, blockNumber: body.blockNumber, logIndex: body.logIndex };
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

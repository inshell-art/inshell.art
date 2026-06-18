import type { ChainCacheEnv } from "../chain-cache";

const STATUS_KEY = "indexer-event-ingest-status:v1:sepolia";
const D1_SNAPSHOT_TABLE = "chain_snapshots";
const STATUS_VERSION = 1;
const MAX_RECENT_EVENT_IDS = 100;

type IndexerEventStatus = {
  version: 1;
  updatedAt: string;
  lastAcceptedAt: string;
  lastAppliedAt: string | null;
  lastAppliedTarget: "pulse-auction" | "path-tokens" | "thought-gallery" | null;
  lastTxHash: string;
  lastBlockNumber: number;
  lastLogIndex: number;
  lastResultApplied: boolean;
  lastResultSource: string;
  cachedAt: number;
  lastScannedBlock: number;
  acceptedCount: number;
  appliedCount: number;
  recentEventIds?: string[];
};

type WriteIndexerEventStatusInput = {
  target: "pulse-auction" | "path-tokens" | "thought-gallery";
  txHash: string;
  blockNumber: number;
  logIndex: number;
  applied: boolean;
  cachedAt: number;
  lastScannedBlock: number;
  source: string;
};

export type IndexerEventStatusRead =
  | { source: "d1"; status: IndexerEventStatus; error: null }
  | { source: "empty"; status: null; error: null }
  | { source: "unavailable"; status: null; error: string }
  | { source: "error"; status: null; error: string };

export type IndexerEventStatusWrite =
  | { persisted: true; source: "d1"; status: IndexerEventStatus; duplicate: boolean; error: null }
  | { persisted: false; source: "unavailable" | "error"; status: null; duplicate: false; error: string };

const ensuredStatusTables = new WeakSet<object>();

export async function readIndexerEventStatus(
  env: ChainCacheEnv,
): Promise<IndexerEventStatusRead> {
  const db = env.INSHELL_CHAIN_DATA_DB;
  if (!db) {
    return { source: "unavailable", status: null, error: "INSHELL_CHAIN_DATA_DB is not bound" };
  }
  try {
    await ensureStatusTable(db);
    const row = await db
      .prepare(`SELECT snapshot_json FROM ${D1_SNAPSHOT_TABLE} WHERE key = ?1`)
      .bind(STATUS_KEY)
      .first<{ snapshot_json?: string }>();
    const raw = row?.snapshot_json;
    if (!raw) return { source: "empty", status: null, error: null };
    const parsed = JSON.parse(raw);
    if (isIndexerEventStatus(parsed)) {
      return { source: "d1", status: parsed, error: null };
    }
    return { source: "error", status: null, error: "invalid indexer event status payload" };
  } catch (error) {
    return { source: "error", status: null, error: readableError(error) };
  }
}

export async function writeIndexerEventStatus(
  env: ChainCacheEnv,
  input: WriteIndexerEventStatusInput,
): Promise<IndexerEventStatusWrite> {
  const db = env.INSHELL_CHAIN_DATA_DB;
  if (!db) {
    return {
      persisted: false,
      source: "unavailable",
      status: null,
      duplicate: false,
      error: "INSHELL_CHAIN_DATA_DB is not bound",
    };
  }
  try {
    await ensureStatusTable(db);
    const previousResult = await readIndexerEventStatus(env);
    if (previousResult.source === "error") {
      return {
        persisted: false,
        source: "error",
        status: null,
        duplicate: false,
        error: previousResult.error,
      };
    }
    const previous = previousResult.status;
    const now = new Date().toISOString();
    const eventId = eventStatusId(input);
    const previousEventIds = normalizeRecentEventIds(previous?.recentEventIds);
    const duplicate = previousEventIds.includes(eventId);
    const recentEventIds = duplicate
      ? previousEventIds
      : [eventId, ...previousEventIds].slice(0, MAX_RECENT_EVENT_IDS);
    const status: IndexerEventStatus = {
      version: STATUS_VERSION,
      updatedAt: now,
      lastAcceptedAt: now,
      lastAppliedAt: input.applied ? now : previous?.lastAppliedAt ?? null,
      lastAppliedTarget: input.applied ? input.target : previous?.lastAppliedTarget ?? null,
      lastTxHash: input.txHash,
      lastBlockNumber: input.blockNumber,
      lastLogIndex: input.logIndex,
      lastResultApplied: input.applied,
      lastResultSource: input.source,
      cachedAt: input.cachedAt,
      lastScannedBlock: input.lastScannedBlock,
      acceptedCount: (previous?.acceptedCount ?? 0) + (duplicate ? 0 : 1),
      appliedCount: (previous?.appliedCount ?? 0) + (!duplicate && input.applied ? 1 : 0),
      recentEventIds,
    };
    await db
      .prepare(`
        INSERT INTO ${D1_SNAPSHOT_TABLE}
          (key, snapshot_json, cached_at, last_scanned_block, content_hash, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(key) DO UPDATE SET
          snapshot_json = excluded.snapshot_json,
          cached_at = excluded.cached_at,
          last_scanned_block = excluded.last_scanned_block,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at
      `)
      .bind(
        STATUS_KEY,
        JSON.stringify(status),
        input.cachedAt,
        input.lastScannedBlock,
        JSON.stringify({
          txHash: input.txHash,
          blockNumber: input.blockNumber,
          logIndex: input.logIndex,
          applied: input.applied,
          eventId,
          duplicate,
        }),
        Date.now(),
      )
      .run();
    return { persisted: true, source: "d1", status, duplicate, error: null };
  } catch (error) {
    return {
      persisted: false,
      source: "error",
      status: null,
      duplicate: false,
      error: readableError(error),
    };
  }
}

async function ensureStatusTable(db: NonNullable<ChainCacheEnv["INSHELL_CHAIN_DATA_DB"]>) {
  if (ensuredStatusTables.has(db as object)) return;
  const query =
    `CREATE TABLE IF NOT EXISTS ${D1_SNAPSHOT_TABLE} (` +
    "key TEXT PRIMARY KEY, " +
    "snapshot_json TEXT NOT NULL, " +
    "cached_at INTEGER NOT NULL, " +
    "last_scanned_block INTEGER NOT NULL, " +
    "content_hash TEXT NOT NULL, " +
    "updated_at INTEGER NOT NULL" +
    ")";
  if (db.exec) await db.exec(query);
  else await db.prepare(query).run();
  ensuredStatusTables.add(db as object);
}

function isIndexerEventStatus(value: unknown): value is IndexerEventStatus {
  const status = value as Partial<IndexerEventStatus> | null;
  return (
    Boolean(status) &&
    status?.version === STATUS_VERSION &&
    typeof status.lastAcceptedAt === "string" &&
    (status.lastAppliedTarget === "pulse-auction" ||
      status.lastAppliedTarget === "path-tokens" ||
      status.lastAppliedTarget === "thought-gallery" ||
      status.lastAppliedTarget === null) &&
    typeof status.lastTxHash === "string" &&
    typeof status.lastBlockNumber === "number" &&
    typeof status.lastLogIndex === "number" &&
    typeof status.lastResultApplied === "boolean" &&
    typeof status.cachedAt === "number" &&
    typeof status.lastScannedBlock === "number" &&
    (status.recentEventIds === undefined ||
      (Array.isArray(status.recentEventIds) &&
        status.recentEventIds.every((eventId) => typeof eventId === "string")))
  );
}

function eventStatusId(input: WriteIndexerEventStatusInput) {
  return [
    input.target,
    input.blockNumber,
    input.logIndex,
    input.txHash.toLowerCase(),
  ].join(":");
}

function normalizeRecentEventIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((eventId): eventId is string => typeof eventId === "string" && eventId.length > 0)
    .slice(0, MAX_RECENT_EVENT_IDS);
}

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(token=)[A-Za-z0-9._~+/=-]+/gi, "$1<redacted>")
    .slice(0, 300);
}

import type { ChainCacheEnv } from "../chain-cache";

const STATUS_KEY = "indexer-event-ingest-status:v1:sepolia";
const D1_SNAPSHOT_TABLE = "chain_snapshots";
const STATUS_VERSION = 1;

type IndexerEventStatus = {
  version: 1;
  updatedAt: string;
  lastAcceptedAt: string;
  lastAppliedAt: string | null;
  lastAppliedTarget: "pulse-auction" | null;
  lastTxHash: string;
  lastBlockNumber: number;
  lastLogIndex: number;
  lastResultApplied: boolean;
  lastResultSource: string;
  cachedAt: number;
  lastScannedBlock: number;
  acceptedCount: number;
  appliedCount: number;
};

type WriteIndexerEventStatusInput = {
  target: "pulse-auction";
  txHash: string;
  blockNumber: number;
  logIndex: number;
  applied: boolean;
  cachedAt: number;
  lastScannedBlock: number;
  source: string;
};

const ensuredStatusTables = new WeakSet<object>();

export async function readIndexerEventStatus(
  env: ChainCacheEnv,
): Promise<IndexerEventStatus | null> {
  const db = env.INSHELL_CHAIN_DATA_DB;
  if (!db) return null;
  try {
    await ensureStatusTable(env);
    const row = await db
      .prepare(`SELECT snapshot_json FROM ${D1_SNAPSHOT_TABLE} WHERE key = ?1`)
      .bind(STATUS_KEY)
      .first<{ snapshot_json?: string }>();
    const raw = row?.snapshot_json;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isIndexerEventStatus(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export async function writeIndexerEventStatus(
  env: ChainCacheEnv,
  input: WriteIndexerEventStatusInput,
) {
  const db = env.INSHELL_CHAIN_DATA_DB;
  if (!db) return;
  try {
    await ensureStatusTable(env);
    const previous = await readIndexerEventStatus(env);
    const now = new Date().toISOString();
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
      acceptedCount: (previous?.acceptedCount ?? 0) + 1,
      appliedCount: (previous?.appliedCount ?? 0) + (input.applied ? 1 : 0),
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
        }),
        Date.now(),
      )
      .run();
  } catch {
    // Event ingest should not fail only because the monitoring marker failed.
  }
}

async function ensureStatusTable(env: ChainCacheEnv) {
  const db = env.INSHELL_CHAIN_DATA_DB;
  if (!db?.exec || ensuredStatusTables.has(db as object)) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${D1_SNAPSHOT_TABLE} (
      key TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      last_scanned_block INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  ensuredStatusTables.add(db as object);
}

function isIndexerEventStatus(value: unknown): value is IndexerEventStatus {
  const status = value as Partial<IndexerEventStatus> | null;
  return (
    Boolean(status) &&
    status?.version === STATUS_VERSION &&
    typeof status.lastAcceptedAt === "string" &&
    (status.lastAppliedTarget === "pulse-auction" || status.lastAppliedTarget === null) &&
    typeof status.lastTxHash === "string" &&
    typeof status.lastBlockNumber === "number" &&
    typeof status.lastLogIndex === "number" &&
    typeof status.lastResultApplied === "boolean" &&
    typeof status.cachedAt === "number" &&
    typeof status.lastScannedBlock === "number"
  );
}

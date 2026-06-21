import type { ChainCacheEnv } from "../chain-cache";

type D1DatabaseLike = NonNullable<ChainCacheEnv["INSHELL_CHAIN_DATA_DB"]>;

type AnalyticsEventPayload = {
  version?: unknown;
  eventId?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  eventType?: unknown;
  path?: unknown;
  title?: unknown;
  referrer?: unknown;
  occurredAt?: unknown;
  deviceClass?: unknown;
  viewportWidth?: unknown;
  viewportHeight?: unknown;
  timezoneOffset?: unknown;
  language?: unknown;
  automation?: unknown;
};

export type AnalyticsStatus = {
  enabled: boolean;
  route: string;
  summaryRoute: string;
  identity: "anonymous-browser-session";
  hostScope: AnalyticsHostScope["name"];
  countedHosts: string[];
  dbBound: boolean;
  dbBinding: "INSHELL_ANALYTICS_DB" | "INSHELL_CHAIN_DATA_DB" | null;
  rawIpStored: false;
  rawUserAgentStored: false;
  statusSource: "d1" | "empty" | "unavailable" | "error";
  statusError: string | null;
  lastEventAt: string | null;
  eventCount24h: number;
  uniqueVisitors24h: number;
  sessions24h: number;
};

export type AnalyticsSummary = {
  ok: true;
  generatedAt: string;
  hostScope: {
    name: AnalyticsHostScope["name"];
    hostnames: string[];
  };
  window: {
    days: number;
    since: string;
  };
  totals: {
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
    returningVisitors: number;
    automationEvents: number;
  };
  paths: Array<{
    path: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  surfaces: Array<{
    surface: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
  hosts: Array<{
    hostname: string;
    pageViews: number;
    uniqueVisitors: number;
  }>;
};

export type AnalyticsHostScope = {
  name: "production" | "preview" | "staging" | "host";
  hostnames: string[];
};

const EVENT_TABLE = "inshell_anon_analytics_events";
const VISITOR_TABLE = "inshell_anon_analytics_visitors";
const SESSION_TABLE = "inshell_anon_analytics_sessions";
const MAX_BODY_BYTES = 4096;
const MAX_PATH_LENGTH = 256;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_REFERRER_HOST_LENGTH = 120;
const MAX_REFERRER_PATH_LENGTH = 256;
const HASH_PREFIX = "inshell-anon-analytics:v1:";

const PRODUCTION_HOSTS = ["inshell.art", "thought.inshell.art", "gallery.inshell.art"];
const PREVIEW_HOSTS = ["preview.inshell.art", "thought.preview.inshell.art", "gallery.preview.inshell.art"];
const STAGING_HOSTS = ["staging.inshell-art.pages.dev", "staging.thought-inshell-art.pages.dev"];

const ALLOWED_HOSTS = new Set([
  ...PRODUCTION_HOSTS,
  ...PREVIEW_HOSTS,
  ...STAGING_HOSTS,
  "inshell-art.pages.dev",
  "thought-inshell-art.pages.dev",
]);

const ensuredTables = new WeakSet<object>();

export function analyticsJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-inshell-analytics-token",
      "access-control-max-age": "86400",
      "x-content-type-options": "nosniff",
    },
  });
}

export function analyticsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-inshell-analytics-token",
      "access-control-max-age": "86400",
    },
  });
}

export function resolveAnalyticsDb(env: ChainCacheEnv): {
  db: D1DatabaseLike | null;
  binding: AnalyticsStatus["dbBinding"];
} {
  if (env.INSHELL_ANALYTICS_DB) return { db: env.INSHELL_ANALYTICS_DB, binding: "INSHELL_ANALYTICS_DB" };
  if (env.INSHELL_CHAIN_DATA_DB) return { db: env.INSHELL_CHAIN_DATA_DB, binding: "INSHELL_CHAIN_DATA_DB" };
  return { db: null, binding: null };
}

export function isAnalyticsEnabled(env: ChainCacheEnv) {
  const raw = env.INSHELL_ANALYTICS_ENABLED?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function isAnalyticsReadAuthorized(request: Request, env: ChainCacheEnv) {
  const expected = env.INSHELL_ANALYTICS_READ_TOKEN?.trim() || env.INSHELL_INDEXER_REFRESH_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const header = request.headers.get("x-inshell-analytics-token")?.trim();
  return bearer === expected || header === expected;
}

export function analyticsHostScopeForHostname(hostname: string): AnalyticsHostScope {
  const normalized = normalizeHostname(hostname);
  if (PRODUCTION_HOSTS.includes(normalized)) {
    return { name: "production", hostnames: PRODUCTION_HOSTS };
  }
  if (PREVIEW_HOSTS.includes(normalized)) {
    return { name: "preview", hostnames: PREVIEW_HOSTS };
  }
  if (
    STAGING_HOSTS.includes(normalized) ||
    normalized.startsWith("staging.") ||
    normalized.includes("-staging.")
  ) {
    return { name: "staging", hostnames: STAGING_HOSTS };
  }
  return { name: "host", hostnames: [normalized] };
}

export async function readAnalyticsRequest(request: Request): Promise<AnalyticsEventPayload> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new AnalyticsInputError("request body too large", 413);
  }
  try {
    return JSON.parse(text) as AnalyticsEventPayload;
  } catch {
    throw new AnalyticsInputError("request body must be JSON", 400);
  }
}

export class AnalyticsInputError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AnalyticsInputError";
    this.status = status;
  }
}

export async function recordAnalyticsEvent(
  env: ChainCacheEnv,
  request: Request,
  payload: AnalyticsEventPayload,
) {
  if (!isAnalyticsEnabled(env)) {
    return { ok: true, stored: false, duplicate: false, disabled: true };
  }

  const { db } = resolveAnalyticsDb(env);
  if (!db) {
    throw new Error("analytics D1 binding is not configured");
  }

  const url = new globalThis.URL(request.url);
  const hostname = normalizeHostname(url.hostname);
  if (!isAllowedHost(hostname)) {
    throw new AnalyticsInputError("analytics host is not allowed", 403);
  }

  const normalized = normalizeAnalyticsEvent(payload, hostname);
  await ensureAnalyticsTables(db);

  const existing = await db
    .prepare(`SELECT event_id FROM ${EVENT_TABLE} WHERE event_id = ?1`)
    .bind(normalized.eventId)
    .first<{ event_id: string }>();
  if (existing) {
    return {
      ok: true,
      stored: false,
      duplicate: true,
      eventId: normalized.eventId,
    };
  }

  const visitorHash = await hashIdentifier(normalized.visitorId);
  const sessionHash = await hashIdentifier(normalized.sessionId);
  const receivedAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO ${EVENT_TABLE} (` +
        "event_id,event_type,visitor_hash,session_hash,surface,hostname,path,referrer_host,referrer_path," +
        "occurred_at,received_at,device_class,viewport_width,viewport_height,timezone_offset,language,automation" +
        ") VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
    )
    .bind(
      normalized.eventId,
      normalized.eventType,
      visitorHash,
      sessionHash,
      normalized.surface,
      hostname,
      normalized.path,
      normalized.referrerHost,
      normalized.referrerPath,
      normalized.occurredAt,
      receivedAt,
      normalized.deviceClass,
      normalized.viewportWidth,
      normalized.viewportHeight,
      normalized.timezoneOffset,
      normalized.language,
      normalized.automation ? 1 : 0,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO ${VISITOR_TABLE} (visitor_hash,first_seen_at,last_seen_at,event_count) ` +
        "VALUES (?1,?2,?3,1) " +
        "ON CONFLICT(visitor_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at,event_count=event_count+1",
    )
    .bind(visitorHash, receivedAt, receivedAt)
    .run();

  await db
    .prepare(
      `INSERT INTO ${SESSION_TABLE} (session_hash,visitor_hash,started_at,last_seen_at,pageview_count) ` +
        "VALUES (?1,?2,?3,?4,1) " +
        "ON CONFLICT(session_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at,pageview_count=pageview_count+1",
    )
    .bind(sessionHash, visitorHash, receivedAt, receivedAt)
    .run();

  return {
    ok: true,
    stored: true,
    duplicate: false,
    eventId: normalized.eventId,
  };
}

export async function readAnalyticsStatus(
  env: ChainCacheEnv,
  hostScope: AnalyticsHostScope = {
    name: "production",
    hostnames: PRODUCTION_HOSTS,
  },
): Promise<AnalyticsStatus> {
  const { db, binding } = resolveAnalyticsDb(env);
  const base: AnalyticsStatus = {
    enabled: isAnalyticsEnabled(env),
    route: "/api/analytics/event",
    summaryRoute: "/api/analytics/summary",
    identity: "anonymous-browser-session",
    hostScope: hostScope.name,
    countedHosts: hostScope.hostnames,
    dbBound: Boolean(db),
    dbBinding: binding,
    rawIpStored: false,
    rawUserAgentStored: false,
    statusSource: db ? "empty" : "unavailable",
    statusError: null,
    lastEventAt: null,
    eventCount24h: 0,
    uniqueVisitors24h: 0,
    sessions24h: 0,
  };
  if (!db) return base;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const filter = hostFilter(hostScope, 1);
  try {
    const last = await db
      .prepare(`SELECT MAX(received_at) AS lastEventAt FROM ${EVENT_TABLE} WHERE ${filter.sql}`)
      .bind(...filter.values)
      .first<{ lastEventAt: string | null }>();
    const totals = await db
      .prepare(
        `SELECT COUNT(*) AS eventCount, COUNT(DISTINCT visitor_hash) AS uniqueVisitors, ` +
          `COUNT(DISTINCT session_hash) AS sessions FROM ${EVENT_TABLE} WHERE received_at >= ?1 ` +
          `AND ${hostFilter(hostScope, 2).sql}`,
      )
      .bind(since, ...hostScope.hostnames)
      .first<{ eventCount: number; uniqueVisitors: number; sessions: number }>();
    return {
      ...base,
      statusSource: last?.lastEventAt ? "d1" : "empty",
      lastEventAt: last?.lastEventAt ?? null,
      eventCount24h: Number(totals?.eventCount ?? 0),
      uniqueVisitors24h: Number(totals?.uniqueVisitors ?? 0),
      sessions24h: Number(totals?.sessions ?? 0),
    };
  } catch (error) {
    if (isMissingAnalyticsTableError(error)) return base;
    return {
      ...base,
      statusSource: "error",
      statusError: "analytics status query failed",
    };
  }
}

export async function readAnalyticsSummary(
  env: ChainCacheEnv,
  days: number,
  hostScope: AnalyticsHostScope = {
    name: "production",
    hostnames: PRODUCTION_HOSTS,
  },
): Promise<AnalyticsSummary> {
  const { db } = resolveAnalyticsDb(env);
  if (!db) throw new Error("analytics D1 binding is not configured");
  const safeDays = Math.min(90, Math.max(1, Math.trunc(days || 7)));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  const totals = await db
    .prepare(
      `SELECT COUNT(*) AS pageViews, COUNT(DISTINCT visitor_hash) AS uniqueVisitors, ` +
        `COUNT(DISTINCT session_hash) AS sessions, SUM(automation) AS automationEvents ` +
        `FROM ${EVENT_TABLE} WHERE event_type = 'pageview' AND received_at >= ?1 ` +
        `AND ${hostFilter(hostScope, 2).sql}`,
    )
    .bind(since, ...hostScope.hostnames)
    .first<{
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      automationEvents: number | null;
    }>();
  const returning = await db
    .prepare(
      `SELECT COUNT(*) AS returningVisitors FROM (` +
        `SELECT visitor_hash FROM ${EVENT_TABLE} WHERE event_type = 'pageview' AND received_at >= ?1 ` +
        `AND ${hostFilter(hostScope, 2).sql} ` +
        `GROUP BY visitor_hash HAVING COUNT(DISTINCT session_hash) > 1` +
        `)`,
    )
    .bind(since, ...hostScope.hostnames)
    .first<{ returningVisitors: number }>();

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    hostScope: {
      name: hostScope.name,
      hostnames: hostScope.hostnames,
    },
    window: {
      days: safeDays,
      since,
    },
    totals: {
      pageViews: Number(totals?.pageViews ?? 0),
      uniqueVisitors: Number(totals?.uniqueVisitors ?? 0),
      sessions: Number(totals?.sessions ?? 0),
      returningVisitors: Number(returning?.returningVisitors ?? 0),
      automationEvents: Number(totals?.automationEvents ?? 0),
    },
    paths: await readPathRows(db, since, hostScope),
    surfaces: await readSurfaceRows(db, since, hostScope),
    hosts: await readHostRows(db, since, hostScope),
  };
}

async function readPathRows(
  db: D1DatabaseLike,
  since: string,
  hostScope: AnalyticsHostScope,
): Promise<AnalyticsSummary["paths"]> {
  const rows = await readGroupedRows(db, since, hostScope, "path");
  return rows.map((row) => ({
    path: row.value,
    pageViews: row.pageViews,
    uniqueVisitors: row.uniqueVisitors,
  }));
}

async function readSurfaceRows(
  db: D1DatabaseLike,
  since: string,
  hostScope: AnalyticsHostScope,
): Promise<AnalyticsSummary["surfaces"]> {
  const rows = await readGroupedRows(db, since, hostScope, "surface");
  return rows.map((row) => ({
    surface: row.value,
    pageViews: row.pageViews,
    uniqueVisitors: row.uniqueVisitors,
  }));
}

async function readHostRows(
  db: D1DatabaseLike,
  since: string,
  hostScope: AnalyticsHostScope,
): Promise<AnalyticsSummary["hosts"]> {
  const rows = await readGroupedRows(db, since, hostScope, "hostname");
  return rows.map((row) => ({
    hostname: row.value,
    pageViews: row.pageViews,
    uniqueVisitors: row.uniqueVisitors,
  }));
}

async function readGroupedRows(
  db: D1DatabaseLike,
  since: string,
  hostScope: AnalyticsHostScope,
  field: "path" | "surface" | "hostname",
): Promise<Array<{ value: string; pageViews: number; uniqueVisitors: number }>> {
  const result = await db
    .prepare(
      `SELECT ${field} AS value, COUNT(*) AS pageViews, COUNT(DISTINCT visitor_hash) AS uniqueVisitors ` +
        `FROM ${EVENT_TABLE} WHERE event_type = 'pageview' AND received_at >= ?1 ` +
        `AND ${hostFilter(hostScope, 2).sql} ` +
        `GROUP BY ${field} ORDER BY pageViews DESC, value ASC LIMIT 20`,
    )
    .bind(since, ...hostScope.hostnames)
    .all?.<{ value: string; pageViews: number; uniqueVisitors: number }>();
  return (result?.results ?? []).map((row) => ({
    value: row.value,
    pageViews: Number(row.pageViews ?? 0),
    uniqueVisitors: Number(row.uniqueVisitors ?? 0),
  }));
}

async function ensureAnalyticsTables(db: D1DatabaseLike) {
  if (ensuredTables.has(db as object)) return;
  for (const query of [
    `CREATE TABLE IF NOT EXISTS ${EVENT_TABLE} (` +
      "event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,visitor_hash TEXT NOT NULL,session_hash TEXT NOT NULL," +
      "surface TEXT NOT NULL,hostname TEXT NOT NULL,path TEXT NOT NULL,referrer_host TEXT,referrer_path TEXT," +
      "occurred_at TEXT NOT NULL,received_at TEXT NOT NULL,device_class TEXT,viewport_width INTEGER,viewport_height INTEGER," +
      "timezone_offset INTEGER,language TEXT,automation INTEGER NOT NULL DEFAULT 0)",
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_received ON ${EVENT_TABLE} (received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_visitor ON ${EVENT_TABLE} (visitor_hash, received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_session ON ${EVENT_TABLE} (session_hash, received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_path ON ${EVENT_TABLE} (path, received_at)`,
    `CREATE TABLE IF NOT EXISTS ${VISITOR_TABLE} (` +
      "visitor_hash TEXT PRIMARY KEY,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,event_count INTEGER NOT NULL DEFAULT 0)",
    `CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (` +
      "session_hash TEXT PRIMARY KEY,visitor_hash TEXT NOT NULL,started_at TEXT NOT NULL,last_seen_at TEXT NOT NULL," +
      "pageview_count INTEGER NOT NULL DEFAULT 0)",
  ]) {
    await db.prepare(query).run();
  }
  ensuredTables.add(db as object);
}

function normalizeAnalyticsEvent(payload: AnalyticsEventPayload, hostname: string) {
  if (payload.version !== 1) throw new AnalyticsInputError("version must be 1");
  const eventId = normalizedId(payload.eventId, "eventId");
  const visitorId = normalizedId(payload.visitorId, "visitorId");
  const sessionId = normalizedId(payload.sessionId, "sessionId");
  const eventType = payload.eventType === "pageview" ? "pageview" : "";
  if (!eventType) throw new AnalyticsInputError("eventType must be pageview");
  return {
    eventId,
    visitorId,
    sessionId,
    eventType,
    surface: surfaceForHost(hostname),
    hostname,
    path: normalizePath(payload.path),
    ...normalizeReferrer(payload.referrer),
    occurredAt: normalizeOccurredAt(payload.occurredAt),
    deviceClass: normalizeDeviceClass(payload.deviceClass),
    viewportWidth: normalizeInteger(payload.viewportWidth, 1, 10000),
    viewportHeight: normalizeInteger(payload.viewportHeight, 1, 10000),
    timezoneOffset: normalizeInteger(payload.timezoneOffset, -1440, 1440),
    language: normalizeLanguage(payload.language),
    automation: payload.automation === true,
  };
}

function normalizedId(value: unknown, label: string) {
  if (typeof value !== "string") throw new AnalyticsInputError(`${label} is required`);
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_-]{7,95}$/.test(trimmed)) {
    throw new AnalyticsInputError(`${label} is invalid`);
  }
  return trimmed;
}

function normalizePath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw || raw.length > MAX_PATH_LENGTH) return "/";
  try {
    const parsed = new globalThis.URL(raw, "https://inshell.art");
    return parsed.pathname.replace(/\/{2,}/g, "/").slice(0, MAX_PATH_LENGTH) || "/";
  } catch {
    return "/";
  }
}

function normalizeReferrer(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { referrerHost: null, referrerPath: null };
  }
  try {
    const parsed = new globalThis.URL(value);
    const host = normalizeHostname(parsed.hostname).slice(0, MAX_REFERRER_HOST_LENGTH);
    const path = isAllowedHost(host)
      ? parsed.pathname.replace(/\/{2,}/g, "/").slice(0, MAX_REFERRER_PATH_LENGTH)
      : null;
    return { referrerHost: host || null, referrerPath: path };
  } catch {
    return { referrerHost: null, referrerPath: null };
  }
}

function normalizeOccurredAt(value: unknown) {
  const fallback = new Date().toISOString();
  if (typeof value !== "string") return fallback;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return fallback;
  const now = Date.now();
  if (Math.abs(now - timestamp) > 24 * 60 * 60 * 1000) return fallback;
  return new Date(timestamp).toISOString();
}

function normalizeDeviceClass(value: unknown) {
  return value === "mobile" || value === "tablet" || value === "desktop" ? value : "unknown";
}

function normalizeInteger(value: unknown, min: number, max: number) {
  const numeric = typeof value === "number" ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeLanguage(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_LANGUAGE_LENGTH);
  return /^[A-Za-z0-9-]+$/.test(trimmed) ? trimmed : null;
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function isAllowedHost(hostname: string) {
  return (
    ALLOWED_HOSTS.has(hostname) ||
    hostname.endsWith(".inshell-art.pages.dev") ||
    hostname.endsWith(".thought-inshell-art.pages.dev")
  );
}

function surfaceForHost(hostname: string) {
  if (hostname.includes("gallery")) return "gallery";
  if (hostname.includes("thought")) return "thought";
  return "home";
}

function hostFilter(hostScope: AnalyticsHostScope, firstParamIndex: number) {
  return {
    sql: `hostname IN (${hostScope.hostnames.map((_, index) => `?${firstParamIndex + index}`).join(",")})`,
    values: hostScope.hostnames,
  };
}

async function hashIdentifier(value: string) {
  const bytes = new TextEncoder().encode(`${HASH_PREFIX}${value}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isMissingAnalyticsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("no such table");
}

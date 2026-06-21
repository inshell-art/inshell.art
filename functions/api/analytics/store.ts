import type { ChainCacheEnv } from "../chain-cache";

type D1DatabaseLike = NonNullable<ChainCacheEnv["INSHELL_CHAIN_DATA_DB"]>;

type AnalyticsEventPayload = {
  version?: unknown;
  eventId?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  visitId?: unknown;
  eventType?: unknown;
  path?: unknown;
  contentType?: unknown;
  contentId?: unknown;
  title?: unknown;
  referrer?: unknown;
  occurredAt?: unknown;
  deviceClass?: unknown;
  viewportWidth?: unknown;
  viewportHeight?: unknown;
  timezoneOffset?: unknown;
  language?: unknown;
  automation?: unknown;
  metadata?: unknown;
};

const ANALYTICS_EVENT_TYPES = [
  "pageview",
  "page_visible_duration",
  "scroll_depth",
  "cta_click",
  "wallet_connect_started",
  "wallet_connect_succeeded",
  "wallet_connect_failed",
  "mint_started",
  "mint_succeeded",
  "mint_failed",
  "api_error",
  "frontend_error",
  "external_link_click",
] as const;

type AnalyticsEventType = typeof ANALYTICS_EVENT_TYPES[number];

const ANALYTICS_CONTENT_TYPES = [
  "home",
  "path",
  "thought",
  "gallery",
  "pulse",
  "verify",
  "unknown",
] as const;

type AnalyticsContentType = typeof ANALYTICS_CONTENT_TYPES[number];
type AnalyticsMetadata = Record<string, string | number | boolean | null>;

type AnalyticsVisitorTimelineEvent = {
  eventType: AnalyticsEventType;
  occurredAt: string;
  receivedAt: string;
  sessionRank: number;
  visitRank: number;
  surface: string;
  hostname: string;
  path: string;
  contentType: AnalyticsContentType;
  contentId: string | null;
  referrerHost: string | null;
  referrerPath: string | null;
  deviceClass: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  timezoneOffset: number | null;
  language: string | null;
  automation: boolean;
  metadata: AnalyticsMetadata;
};

type AnalyticsVisitorSource = {
  referrerHost: string | null;
  referrerPath: string | null;
  firstPath: string | null;
  firstContentType: AnalyticsContentType | null;
  firstContentId: string | null;
};

type AnalyticsVisitorVisit = {
  visitRank: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  eventCount: number;
  pageViews: number;
  source: AnalyticsVisitorSource;
  timeline: AnalyticsVisitorTimelineEvent[];
};

export type AnalyticsStatus = {
  enabled: boolean;
  route: string;
  summaryRoute: string;
  visitorRoute: string;
  identity: "anonymous-browser-session";
  hostScope: AnalyticsHostScope["name"];
  countedHosts: string[];
  dbBound: boolean;
  dbBinding: "INSHELL_ANALYTICS_DB" | "INSHELL_CHAIN_DATA_DB" | null;
  rawIpStored: false;
  rawUserAgentStored: false;
  rawVisitIdStored: false;
  rawWalletAddressStored: false;
  rawMetadataStored: false;
  metadataAllowlist: true;
  visitTimeoutMinutes: 30;
  supportedEventTypes: AnalyticsEventType[];
  statusSource: "d1" | "empty" | "unavailable" | "error";
  statusError: string | null;
  lastEventAt: string | null;
  eventCount24h: number;
  uniqueVisitors24h: number;
  sessions24h: number;
  visits24h: number;
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
    visits: number;
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

export type AnalyticsVisitors = {
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
  visitors: Array<{
    visitorRank: number;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    eventCount: number;
    pageViews: number;
    sessions: number;
    visitCount: number;
    returning: boolean;
    automationEvents: number;
    source: AnalyticsVisitorSource;
    visits: AnalyticsVisitorVisit[];
    timeline: AnalyticsVisitorTimelineEvent[];
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
const MAX_CONTENT_ID_LENGTH = 64;
const MAX_LANGUAGE_LENGTH = 32;
const MAX_REFERRER_HOST_LENGTH = 120;
const MAX_REFERRER_PATH_LENGTH = 256;
const MAX_METADATA_JSON_LENGTH = 1024;
const HASH_PREFIX = "inshell-anon-analytics:v1:";
const VISIT_TIMEOUT_MINUTES = 30;
const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES);
const CONTENT_TYPE_SET = new Set<string>(ANALYTICS_CONTENT_TYPES);
const DURATION_BUCKETS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000];

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
  const visitHash = await hashIdentifier(normalized.visitId);
  const receivedAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO ${EVENT_TABLE} (` +
        "event_id,event_type,visitor_hash,session_hash,visit_hash,surface,hostname,path,content_type,content_id,referrer_host,referrer_path," +
        "occurred_at,received_at,device_class,viewport_width,viewport_height,timezone_offset,language,automation" +
        ",metadata_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)",
    )
    .bind(
      normalized.eventId,
      normalized.eventType,
      visitorHash,
      sessionHash,
      visitHash,
      normalized.surface,
      hostname,
      normalized.path,
      normalized.contentType,
      normalized.contentId,
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
      normalized.metadataJson,
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
        "VALUES (?1,?2,?3,?4,?5) " +
        "ON CONFLICT(session_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at," +
        "pageview_count=pageview_count+excluded.pageview_count",
    )
    .bind(sessionHash, visitorHash, receivedAt, receivedAt, normalized.eventType === "pageview" ? 1 : 0)
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
    visitorRoute: "/api/analytics/visitors",
    identity: "anonymous-browser-session",
    hostScope: hostScope.name,
    countedHosts: hostScope.hostnames,
    dbBound: Boolean(db),
    dbBinding: binding,
    rawIpStored: false,
    rawUserAgentStored: false,
    rawVisitIdStored: false,
    rawWalletAddressStored: false,
    rawMetadataStored: false,
    metadataAllowlist: true,
    visitTimeoutMinutes: VISIT_TIMEOUT_MINUTES,
    supportedEventTypes: [...ANALYTICS_EVENT_TYPES],
    statusSource: db ? "empty" : "unavailable",
    statusError: null,
    lastEventAt: null,
    eventCount24h: 0,
    uniqueVisitors24h: 0,
    sessions24h: 0,
    visits24h: 0,
  };
  if (!db) return base;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const filter = hostFilter(hostScope, 1);
  try {
    const visitHashSql = await visitHashExpression(db);
    const last = await db
      .prepare(`SELECT MAX(received_at) AS lastEventAt FROM ${EVENT_TABLE} WHERE ${filter.sql}`)
      .bind(...filter.values)
      .first<{ lastEventAt: string | null }>();
    const totals = await db
      .prepare(
        `SELECT COUNT(*) AS eventCount, COUNT(DISTINCT visitor_hash) AS uniqueVisitors, ` +
          `COUNT(DISTINCT session_hash) AS sessions, COUNT(DISTINCT ${visitHashSql}) AS visits ` +
          `FROM ${EVENT_TABLE} WHERE received_at >= ?1 ` +
          `AND ${hostFilter(hostScope, 2).sql}`,
      )
      .bind(since, ...hostScope.hostnames)
      .first<{ eventCount: number; uniqueVisitors: number; sessions: number; visits: number }>();
    return {
      ...base,
      statusSource: last?.lastEventAt ? "d1" : "empty",
      lastEventAt: last?.lastEventAt ?? null,
      eventCount24h: Number(totals?.eventCount ?? 0),
      uniqueVisitors24h: Number(totals?.uniqueVisitors ?? 0),
      sessions24h: Number(totals?.sessions ?? 0),
      visits24h: Number(totals?.visits ?? 0),
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
  const visitHashSql = await visitHashExpression(db);

  const totals = await db
    .prepare(
      `SELECT COUNT(*) AS pageViews, COUNT(DISTINCT visitor_hash) AS uniqueVisitors, ` +
        `COUNT(DISTINCT session_hash) AS sessions, COUNT(DISTINCT ${visitHashSql}) AS visits, ` +
        `SUM(automation) AS automationEvents ` +
        `FROM ${EVENT_TABLE} WHERE event_type = 'pageview' AND received_at >= ?1 ` +
        `AND ${hostFilter(hostScope, 2).sql}`,
    )
    .bind(since, ...hostScope.hostnames)
    .first<{
      pageViews: number;
      uniqueVisitors: number;
      sessions: number;
      visits: number;
      automationEvents: number | null;
    }>();
  const returning = await db
    .prepare(
      `SELECT COUNT(*) AS returningVisitors FROM (` +
        `SELECT visitor_hash FROM ${EVENT_TABLE} WHERE event_type = 'pageview' AND received_at >= ?1 ` +
        `AND ${hostFilter(hostScope, 2).sql} ` +
        `GROUP BY visitor_hash HAVING COUNT(DISTINCT ${visitHashSql}) > 1` +
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
      visits: Number(totals?.visits ?? 0),
      returningVisitors: Number(returning?.returningVisitors ?? 0),
      automationEvents: Number(totals?.automationEvents ?? 0),
    },
    paths: await readPathRows(db, since, hostScope),
    surfaces: await readSurfaceRows(db, since, hostScope),
    hosts: await readHostRows(db, since, hostScope),
  };
}

export async function readAnalyticsVisitors(
  env: ChainCacheEnv,
  days: number,
  hostScope: AnalyticsHostScope = {
    name: "production",
    hostnames: PRODUCTION_HOSTS,
  },
  visitorRank?: number,
): Promise<AnalyticsVisitors> {
  const { db } = resolveAnalyticsDb(env);
  if (!db) throw new Error("analytics D1 binding is not configured");
  const safeDays = Math.min(30, Math.max(1, Math.trunc(days || 1)));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const rank = Number.isFinite(visitorRank) && visitorRank != null
    ? Math.min(50, Math.max(1, Math.trunc(visitorRank)))
    : null;
  const visitorLimit = rank ?? 10;
  const filter = hostFilter(hostScope, 2);
  const limitParam = 2 + filter.values.length;
  const visitHashSql = await visitHashExpression(db);
  const visitorResult = await db
    .prepare(
      `SELECT visitor_hash AS visitorHash,COUNT(*) AS eventCount,` +
        `SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS pageViews,` +
        `COUNT(DISTINCT session_hash) AS sessions,COUNT(DISTINCT ${visitHashSql}) AS visits,` +
        `MIN(received_at) AS firstSeenAt,` +
        `MAX(received_at) AS lastSeenAt,SUM(automation) AS automationEvents ` +
        `FROM ${EVENT_TABLE} WHERE received_at >= ?1 AND ${filter.sql} ` +
        `GROUP BY visitor_hash ORDER BY eventCount DESC,lastSeenAt DESC LIMIT ?${limitParam}`,
    )
    .bind(since, ...filter.values, visitorLimit)
    .all?.<{
      visitorHash: string;
      eventCount: number;
      pageViews: number | null;
      sessions: number;
      visits: number;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
      automationEvents: number | null;
    }>();
  const rankedVisitors = (visitorResult?.results ?? []).map((row, index) => ({ ...row, rank: index + 1 }));
  const selectedVisitors = rank
    ? rankedVisitors.filter((row) => row.rank === rank)
    : rankedVisitors;

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
    visitors: await Promise.all(
      selectedVisitors.map(async (visitor) => {
        const timeline = await readVisitorTimeline(db, visitor.visitorHash, since, hostScope, visitHashSql);
        const visitCount = Number(visitor.visits ?? 0);
        return {
          visitorRank: visitor.rank,
          firstSeenAt: visitor.firstSeenAt ?? null,
          lastSeenAt: visitor.lastSeenAt ?? null,
          eventCount: Number(visitor.eventCount ?? 0),
          pageViews: Number(visitor.pageViews ?? 0),
          sessions: Number(visitor.sessions ?? 0),
          visitCount,
          returning: visitCount > 1,
          automationEvents: Number(visitor.automationEvents ?? 0),
          source: sourceForTimeline(timeline),
          visits: groupTimelineByVisit(timeline),
          timeline,
        };
      }),
    ),
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

async function readVisitorTimeline(
  db: D1DatabaseLike,
  visitorHash: string,
  since: string,
  hostScope: AnalyticsHostScope,
  visitHashSql: string,
): Promise<AnalyticsVisitors["visitors"][number]["timeline"]> {
  const filter = hostFilter(hostScope, 3);
  const limitParam = 3 + filter.values.length;
  const result = await db
    .prepare(
      `SELECT event_type AS eventType,session_hash AS sessionHash,${visitHashSql} AS visitHash,surface,hostname,path,` +
        `content_type AS contentType,content_id AS contentId,referrer_host AS referrerHost,` +
        `referrer_path AS referrerPath,occurred_at AS occurredAt,received_at AS receivedAt,` +
        `device_class AS deviceClass,viewport_width AS viewportWidth,viewport_height AS viewportHeight,` +
        `timezone_offset AS timezoneOffset,language,automation,metadata_json AS metadataJson ` +
        `FROM ${EVENT_TABLE} WHERE visitor_hash = ?1 AND received_at >= ?2 AND ${filter.sql} ` +
        `ORDER BY received_at ASC LIMIT ?${limitParam}`,
    )
    .bind(visitorHash, since, ...filter.values, 200)
    .all?.<{
      eventType: AnalyticsEventType;
      sessionHash: string;
      visitHash: string;
      surface: string;
      hostname: string;
      path: string;
      contentType: AnalyticsContentType | null;
      contentId: string | null;
      referrerHost: string | null;
      referrerPath: string | null;
      occurredAt: string;
      receivedAt: string;
      deviceClass: string | null;
      viewportWidth: number | null;
      viewportHeight: number | null;
      timezoneOffset: number | null;
      language: string | null;
      automation: number | null;
      metadataJson: string | null;
    }>();
  const sessionRanks = new Map<string, number>();
  const visitRanks = new Map<string, number>();
  return (result?.results ?? []).map((row) => {
    const sessionHashValue = String(row.sessionHash ?? "");
    if (!sessionRanks.has(sessionHashValue)) {
      sessionRanks.set(sessionHashValue, sessionRanks.size + 1);
    }
    const visitHashValue = String(row.visitHash ?? sessionHashValue);
    if (!visitRanks.has(visitHashValue)) {
      visitRanks.set(visitHashValue, visitRanks.size + 1);
    }
    return {
      eventType: EVENT_TYPE_SET.has(row.eventType) ? row.eventType : "pageview",
      occurredAt: row.occurredAt,
      receivedAt: row.receivedAt,
      sessionRank: sessionRanks.get(sessionHashValue) ?? 1,
      visitRank: visitRanks.get(visitHashValue) ?? 1,
      surface: row.surface,
      hostname: row.hostname,
      path: row.path,
      contentType: CONTENT_TYPE_SET.has(String(row.contentType)) ? (row.contentType as AnalyticsContentType) : "unknown",
      contentId: row.contentId ?? null,
      referrerHost: row.referrerHost ?? null,
      referrerPath: row.referrerPath ?? null,
      deviceClass: row.deviceClass ?? null,
      viewportWidth: numberOrNull(row.viewportWidth),
      viewportHeight: numberOrNull(row.viewportHeight),
      timezoneOffset: numberOrNull(row.timezoneOffset),
      language: row.language ?? null,
      automation: Number(row.automation ?? 0) === 1,
      metadata: parseMetadata(row.metadataJson),
    };
  });
}

function sourceForTimeline(timeline: AnalyticsVisitorTimelineEvent[]): AnalyticsVisitorSource {
  const firstContent = timeline.find((event) => event.eventType === "pageview") ?? timeline[0] ?? null;
  return {
    referrerHost: firstContent?.referrerHost ?? null,
    referrerPath: firstContent?.referrerPath ?? null,
    firstPath: firstContent?.path ?? null,
    firstContentType: firstContent?.contentType ?? null,
    firstContentId: firstContent?.contentId ?? null,
  };
}

function groupTimelineByVisit(timeline: AnalyticsVisitorTimelineEvent[]): AnalyticsVisitorVisit[] {
  const grouped = new Map<number, AnalyticsVisitorTimelineEvent[]>();
  for (const event of timeline) {
    grouped.set(event.visitRank, [...(grouped.get(event.visitRank) ?? []), event]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([visitRank, events]) => {
      const pageViews = events.filter((event) => event.eventType === "pageview").length;
      return {
        visitRank,
        firstSeenAt: events[0]?.receivedAt ?? null,
        lastSeenAt: events.at(-1)?.receivedAt ?? null,
        eventCount: events.length,
        pageViews,
        source: sourceForTimeline(events),
        timeline: events,
      };
    });
}

async function ensureAnalyticsTables(db: D1DatabaseLike) {
  if (ensuredTables.has(db as object)) return;
  for (const query of [
    `CREATE TABLE IF NOT EXISTS ${EVENT_TABLE} (` +
      "event_id TEXT PRIMARY KEY,event_type TEXT NOT NULL,visitor_hash TEXT NOT NULL,session_hash TEXT NOT NULL,visit_hash TEXT," +
      "surface TEXT NOT NULL,hostname TEXT NOT NULL,path TEXT NOT NULL,content_type TEXT,content_id TEXT," +
      "referrer_host TEXT,referrer_path TEXT," +
      "occurred_at TEXT NOT NULL,received_at TEXT NOT NULL,device_class TEXT,viewport_width INTEGER,viewport_height INTEGER," +
      "timezone_offset INTEGER,language TEXT,automation INTEGER NOT NULL DEFAULT 0,metadata_json TEXT)",
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_received ON ${EVENT_TABLE} (received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_visitor ON ${EVENT_TABLE} (visitor_hash, received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_session ON ${EVENT_TABLE} (session_hash, received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_path ON ${EVENT_TABLE} (path, received_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_event_type ON ${EVENT_TABLE} (event_type, received_at)`,
    `CREATE TABLE IF NOT EXISTS ${VISITOR_TABLE} (` +
      "visitor_hash TEXT PRIMARY KEY,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,event_count INTEGER NOT NULL DEFAULT 0)",
    `CREATE TABLE IF NOT EXISTS ${SESSION_TABLE} (` +
      "session_hash TEXT PRIMARY KEY,visitor_hash TEXT NOT NULL,started_at TEXT NOT NULL,last_seen_at TEXT NOT NULL," +
      "pageview_count INTEGER NOT NULL DEFAULT 0)",
  ]) {
    await db.prepare(query).run();
  }
  for (const query of [
    `ALTER TABLE ${EVENT_TABLE} ADD COLUMN content_type TEXT`,
    `ALTER TABLE ${EVENT_TABLE} ADD COLUMN content_id TEXT`,
    `ALTER TABLE ${EVENT_TABLE} ADD COLUMN metadata_json TEXT`,
    `ALTER TABLE ${EVENT_TABLE} ADD COLUMN visit_hash TEXT`,
  ]) {
    try {
      await db.prepare(query).run();
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_content ON ${EVENT_TABLE} (content_type, content_id, received_at)`)
    .run();
  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_${EVENT_TABLE}_visit ON ${EVENT_TABLE} (visitor_hash, visit_hash, received_at)`)
    .run();
  ensuredTables.add(db as object);
}

function normalizeAnalyticsEvent(payload: AnalyticsEventPayload, hostname: string) {
  if (payload.version !== 1) throw new AnalyticsInputError("version must be 1");
  const eventId = normalizedId(payload.eventId, "eventId");
  const visitorId = normalizedId(payload.visitorId, "visitorId");
  const sessionId = normalizedId(payload.sessionId, "sessionId");
  const visitId = normalizedOptionalId(payload.visitId, "visitId") ?? sessionId;
  const eventType = normalizeEventType(payload.eventType);
  const path = normalizePath(payload.path);
  const contentType = normalizeContentType(payload.contentType, path);
  const contentId = normalizeContentId(payload.contentId, path, contentType);
  const metadata = normalizeEventMetadata(eventType, payload.metadata);
  return {
    eventId,
    visitorId,
    sessionId,
    visitId,
    eventType,
    surface: surfaceForHost(hostname),
    hostname,
    path,
    contentType,
    contentId,
    ...normalizeReferrer(payload.referrer),
    occurredAt: normalizeOccurredAt(payload.occurredAt),
    deviceClass: normalizeDeviceClass(payload.deviceClass),
    viewportWidth: normalizeInteger(payload.viewportWidth, 1, 10000),
    viewportHeight: normalizeInteger(payload.viewportHeight, 1, 10000),
    timezoneOffset: normalizeInteger(payload.timezoneOffset, -1440, 1440),
    language: normalizeLanguage(payload.language),
    automation: payload.automation === true,
    metadataJson: metadataToJson(metadata),
  };
}

function normalizeEventType(value: unknown): AnalyticsEventType {
  if (typeof value !== "string" || !EVENT_TYPE_SET.has(value)) {
    throw new AnalyticsInputError("eventType is not supported");
  }
  return value as AnalyticsEventType;
}

function normalizedId(value: unknown, label: string) {
  if (typeof value !== "string") throw new AnalyticsInputError(`${label} is required`);
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_-]{7,95}$/.test(trimmed)) {
    throw new AnalyticsInputError(`${label} is invalid`);
  }
  return trimmed;
}

function normalizedOptionalId(value: unknown, label: string) {
  if (value == null) return null;
  return normalizedId(value, label);
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

function normalizeContentType(value: unknown, path: string): AnalyticsContentType {
  if (typeof value === "string" && CONTENT_TYPE_SET.has(value)) {
    return value as AnalyticsContentType;
  }
  return contentTypeForPath(path);
}

function normalizeContentId(
  value: unknown,
  path: string,
  contentType: AnalyticsContentType,
) {
  if (typeof value === "string" || typeof value === "number") {
    const normalized = normalizeToken(String(value), MAX_CONTENT_ID_LENGTH);
    return normalized || null;
  }
  return contentIdForPath(path, contentType);
}

function contentTypeForPath(path: string): AnalyticsContentType {
  if (path === "/" || path === "/home") return "home";
  if (path === "/verify" || path.startsWith("/verify/")) return "verify";
  if (path === "/gallery" || path.startsWith("/gallery/")) return "gallery";
  if (path === "/thought" || path.startsWith("/thought/")) return "thought";
  if (path === "/pulse" || path.startsWith("/pulse/")) return "pulse";
  if (path === "/path" || path.startsWith("/path/")) return "path";
  return "unknown";
}

function contentIdForPath(path: string, contentType: AnalyticsContentType) {
  if (contentType !== "path" && contentType !== "thought" && contentType !== "gallery") return null;
  const match = path.match(/\/(?:path|thought|gallery)\/([A-Za-z0-9_-]{1,64})(?:\/|$)/i);
  return match ? normalizeToken(match[1], MAX_CONTENT_ID_LENGTH) : null;
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

function normalizeEventMetadata(eventType: AnalyticsEventType, value: unknown): AnalyticsMetadata {
  const input = isRecord(value) ? value : {};
  const output: AnalyticsMetadata = {};
  const addToken = (key: string, maxLength = 80) => {
    const normalized = normalizeToken(input[key], maxLength);
    if (normalized) output[key] = normalized;
  };
  const addErrorFields = () => {
    const category = normalizeErrorCategory(input.errorCategory);
    if (category) output.errorCategory = category;
    const code = normalizeToken(input.errorCode, 48);
    if (code) output.errorCode = code;
  };

  switch (eventType) {
    case "page_visible_duration": {
      const duration = normalizeDurationBucket(input.durationMs);
      if (duration != null) output.durationMs = duration;
      break;
    }
    case "scroll_depth": {
      const scrollPercent = normalizeScrollBucket(input.scrollPercent);
      if (scrollPercent != null) output.scrollPercent = scrollPercent;
      break;
    }
    case "cta_click":
      addToken("ctaId");
      break;
    case "external_link_click":
      addToken("hrefHost", MAX_REFERRER_HOST_LENGTH);
      output.hrefHost = typeof output.hrefHost === "string"
        ? normalizeHostname(output.hrefHost).slice(0, MAX_REFERRER_HOST_LENGTH)
        : output.hrefHost;
      output.hrefPath = normalizePath(input.hrefPath);
      addToken("ctaId");
      break;
    case "api_error": {
      output.endpoint = normalizePath(input.endpoint);
      const status = normalizeInteger(input.status, 100, 599);
      if (status != null) output.status = status;
      addErrorFields();
      break;
    }
    case "frontend_error":
      addErrorFields();
      break;
    case "wallet_connect_started":
    case "wallet_connect_succeeded":
    case "wallet_connect_failed":
      addToken("walletKind", 32);
      addToken("walletStage", 32);
      if (eventType === "wallet_connect_failed") addErrorFields();
      break;
    case "mint_started":
    case "mint_succeeded":
    case "mint_failed":
      addToken("mintStage", 32);
      if (eventType === "mint_failed") addErrorFields();
      break;
    case "pageview":
      break;
  }

  return output;
}

function normalizeDurationBucket(value: unknown) {
  const numeric = typeof value === "number" ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return DURATION_BUCKETS_MS.find((bucket) => numeric <= bucket) ?? 600_000;
}

function normalizeScrollBucket(value: unknown) {
  const numeric = typeof value === "number" ? Math.trunc(value) : Number.NaN;
  return [25, 50, 75, 100].includes(numeric) ? numeric : null;
}

function normalizeErrorCategory(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = normalizeToken(value, 32);
  return [
    "http",
    "network",
    "timeout",
    "rpc",
    "wallet_rejected",
    "wallet_busy",
    "wallet_missing",
    "runtime",
    "promise",
    "unknown",
  ].includes(normalized) ? normalized : "unknown";
}

function metadataToJson(metadata: AnalyticsMetadata) {
  const json = JSON.stringify(metadata);
  return json.length <= MAX_METADATA_JSON_LENGTH ? json : "{}";
}

function parseMetadata(value: unknown): AnalyticsMetadata {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) return {};
    const output: AnalyticsMetadata = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
        output[key] = item;
      }
    }
    return output;
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeToken(value: unknown, maxLength: number) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().replace(/[^A-Za-z0-9_.:/#-]+/g, "_").slice(0, maxLength);
}

function numberOrNull(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

async function visitHashExpression(db: D1DatabaseLike) {
  return await analyticsEventColumnExists(db, "visit_hash")
    ? "COALESCE(visit_hash, session_hash)"
    : "session_hash";
}

async function analyticsEventColumnExists(db: D1DatabaseLike, columnName: string) {
  try {
    const result = await db
      .prepare(`PRAGMA table_info(${EVENT_TABLE})`)
      .all?.<{ name: string }>();
    return (result?.results ?? []).some((row) => row.name === columnName);
  } catch {
    return false;
  }
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

function isDuplicateColumnError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("duplicate column");
}

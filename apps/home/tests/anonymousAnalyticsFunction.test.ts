import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { onRequestPost as onAnalyticsEventPost } from "../../../functions/api/analytics/event";
import { onRequestGet as onAnalyticsSummaryGet } from "../../../functions/api/analytics/summary";
import { onRequestGet as onAnalyticsVisitorsGet } from "../../../functions/api/analytics/visitors";
import {
  analyticsHostScopeForHostname,
  readAnalyticsStatus,
} from "../../../functions/api/analytics/store";

const originalCrypto = globalThis.crypto;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;

class TestHeaders {
  private readonly values = new Map<string, string[]>();

  constructor(init?: Record<string, string> | Iterable<[string, string]> | { forEach: (callback: (value: string, key: string) => void) => void }) {
    if (!init) return;
    if (typeof (init as { forEach?: unknown }).forEach === "function") {
      (init as { forEach: (callback: (value: string, key: string) => void) => void }).forEach((value, key) => {
        this.append(key, value);
      });
      return;
    }
    if (Symbol.iterator in Object(init)) {
      for (const [key, value] of init as Iterable<[string, string]>) {
        this.append(key, value);
      }
      return;
    }
    for (const [key, value] of Object.entries(init)) {
      this.set(key, value);
    }
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), [value]);
  }

  append(key: string, value: string) {
    const normalized = key.toLowerCase();
    this.values.set(normalized, [...(this.values.get(normalized) ?? []), value]);
  }

  get(key: string) {
    return this.values.get(key.toLowerCase())?.join("\n") ?? null;
  }

  forEach(callback: (value: string, key: string) => void) {
    for (const [key, values] of this.values.entries()) {
      callback(values.join("\n"), key);
    }
  }
}

class TestResponse {
  readonly status: number;
  readonly headers: TestHeaders;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: ConstructorParameters<typeof TestHeaders>[0] }) {
    this.status = init?.status ?? 200;
    this.headers = new TestHeaders(init?.headers);
    this.bodyText = typeof body === "string" ? body : "";
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

type AnalyticsRow = {
  event_id: string;
  event_type: string;
  visitor_hash: string;
  session_hash: string;
  visit_hash: string | null;
  surface: string;
  hostname: string;
  path: string;
  content_type: string | null;
  content_id: string | null;
  referrer_host: string | null;
  referrer_path: string | null;
  occurred_at: string;
  received_at: string;
  device_class: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
  timezone_offset: number | null;
  language: string | null;
  automation: number;
  metadata_json: string | null;
};

function createAnalyticsD1Mock() {
  const events = new Map<string, AnalyticsRow>();
  const visitors = new Map<string, { event_count: number }>();
  const sessions = new Map<string, { pageview_count: number }>();
  const prepare = jest.fn((query: string) => {
    let bound: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: jest.fn(async () => {
        if (/select\s+event_id/i.test(query)) {
          const event = events.get(String(bound[0] ?? ""));
          return event ? { event_id: event.event_id } : null;
        }
        if (/max\(received_at\)/i.test(query)) {
          const last = rowsForHostnames(bound.map(String)).map((event) => event.received_at).sort().at(-1) ?? null;
          return { lastEventAt: last };
        }
        if (/count\(\*\)\s+as\s+eventCount/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""));
          return {
            eventCount: rows.length,
            uniqueVisitors: new Set(rows.map((row) => row.visitor_hash)).size,
            sessions: new Set(rows.map((row) => row.session_hash)).size,
            visits: new Set(rows.map((row) => row.visit_hash ?? row.session_hash)).size,
          };
        }
        if (/count\(\*\)\s+as\s+pageViews/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""), true);
          return {
            pageViews: rows.length,
            uniqueVisitors: new Set(rows.map((row) => row.visitor_hash)).size,
            sessions: new Set(rows.map((row) => row.session_hash)).size,
            visits: new Set(rows.map((row) => row.visit_hash ?? row.session_hash)).size,
            automationEvents: rows.reduce((total, row) => total + row.automation, 0),
          };
        }
        if (/returningVisitors/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""), true);
          const byVisitor = new Map<string, Set<string>>();
          for (const row of rows) {
            if (!byVisitor.has(row.visitor_hash)) byVisitor.set(row.visitor_hash, new Set());
            byVisitor.get(row.visitor_hash)?.add(row.visit_hash ?? row.session_hash);
          }
          return {
            returningVisitors: [...byVisitor.values()].filter((visitSet) => visitSet.size > 1).length,
          };
        }
        return null;
      }),
      all: jest.fn(async () => {
        if (/pragma\s+table_info/i.test(query)) {
          return {
            results: [
              "event_id",
              "event_type",
              "visitor_hash",
              "session_hash",
              "visit_hash",
              "surface",
              "hostname",
              "path",
              "content_type",
              "content_id",
              "referrer_host",
              "referrer_path",
              "occurred_at",
              "received_at",
              "device_class",
              "viewport_width",
              "viewport_height",
              "timezone_offset",
              "language",
              "automation",
              "metadata_json",
            ].map((name) => ({ name })),
          };
        }
        if (/where\s+visitor_hash\s*=\s*\?1/i.test(query)) {
          const visitorHash = String(bound[0] ?? "");
          const since = String(bound[1] ?? "");
          const hostnames = bound.slice(2, -1).map(String);
          return {
            results: rowsForHostnames(hostnames)
              .filter((event) => event.visitor_hash === visitorHash && event.received_at >= since)
              .sort((a, b) => a.received_at.localeCompare(b.received_at))
              .map((event) => ({
                eventType: event.event_type,
                sessionHash: event.session_hash,
                visitHash: event.visit_hash ?? event.session_hash,
                surface: event.surface,
                hostname: event.hostname,
                path: event.path,
                contentType: event.content_type,
                contentId: event.content_id,
                referrerHost: event.referrer_host,
                referrerPath: event.referrer_path,
                occurredAt: event.occurred_at,
                receivedAt: event.received_at,
                deviceClass: event.device_class,
                viewportWidth: event.viewport_width,
                viewportHeight: event.viewport_height,
                timezoneOffset: event.timezone_offset,
                language: event.language,
                automation: event.automation,
                metadataJson: event.metadata_json,
              })),
          };
        }
        if (/group\s+by\s+visitor_hash/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""), false);
          const grouped = new Map<string, AnalyticsRow[]>();
          for (const row of rows) {
            grouped.set(row.visitor_hash, [...(grouped.get(row.visitor_hash) ?? []), row]);
          }
          return {
            results: [...grouped.entries()]
              .map(([visitorHash, visitorRows]) => ({
                visitorHash,
                eventCount: visitorRows.length,
                pageViews: visitorRows.filter((row) => row.event_type === "pageview").length,
                sessions: new Set(visitorRows.map((row) => row.session_hash)).size,
                visits: new Set(visitorRows.map((row) => row.visit_hash ?? row.session_hash)).size,
                firstSeenAt: visitorRows.map((row) => row.received_at).sort()[0] ?? null,
                lastSeenAt: visitorRows.map((row) => row.received_at).sort().at(-1) ?? null,
                automationEvents: visitorRows.reduce((total, row) => total + row.automation, 0),
              }))
              .sort((a, b) => b.eventCount - a.eventCount || String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))),
          };
        }
        const rows = rowsSince(bound, String(bound[0] ?? ""), /event_type\s*=\s*'pageview'/i.test(query));
        const field = /group\s+by\s+surface/i.test(query)
          ? "surface"
          : /group\s+by\s+hostname/i.test(query)
            ? "hostname"
            : "path";
        const grouped = new Map<string, { pageViews: number; visitors: Set<string> }>();
        for (const row of rows) {
          const value = String(row[field as keyof AnalyticsRow]);
          const current = grouped.get(value) ?? { pageViews: 0, visitors: new Set<string>() };
          current.pageViews += 1;
          current.visitors.add(row.visitor_hash);
          grouped.set(value, current);
        }
        return {
          results: [...grouped.entries()].map(([value, data]) => ({
            value,
            pageViews: data.pageViews,
            uniqueVisitors: data.visitors.size,
          })),
        };
      }),
      run: jest.fn(async () => {
        if (/insert\s+into\s+inshell_anon_analytics_events/i.test(query)) {
          events.set(String(bound[0]), {
            event_id: String(bound[0]),
            event_type: String(bound[1]),
            visitor_hash: String(bound[2]),
            session_hash: String(bound[3]),
            visit_hash: bound[4] == null ? null : String(bound[4]),
            surface: String(bound[5]),
            hostname: String(bound[6]),
            path: String(bound[7]),
            content_type: bound[8] == null ? null : String(bound[8]),
            content_id: bound[9] == null ? null : String(bound[9]),
            referrer_host: bound[10] == null ? null : String(bound[10]),
            referrer_path: bound[11] == null ? null : String(bound[11]),
            occurred_at: String(bound[12]),
            received_at: String(bound[13]),
            device_class: bound[14] == null ? null : String(bound[14]),
            viewport_width: bound[15] == null ? null : Number(bound[15]),
            viewport_height: bound[16] == null ? null : Number(bound[16]),
            timezone_offset: bound[17] == null ? null : Number(bound[17]),
            language: bound[18] == null ? null : String(bound[18]),
            automation: Number(bound[19] ?? 0),
            metadata_json: bound[20] == null ? null : String(bound[20]),
          });
        }
        if (/insert\s+into\s+inshell_anon_analytics_visitors/i.test(query)) {
          const key = String(bound[0]);
          visitors.set(key, { event_count: (visitors.get(key)?.event_count ?? 0) + 1 });
        }
        if (/insert\s+into\s+inshell_anon_analytics_sessions/i.test(query)) {
          const key = String(bound[0]);
          sessions.set(key, { pageview_count: (sessions.get(key)?.pageview_count ?? 0) + 1 });
        }
        return {};
      }),
    };
    return statement;
  });

  function rowsSince(boundValues: unknown[], since: string, pageviewsOnly = false) {
    const hostnames = boundValues.slice(1).map(String);
    return rowsForHostnames(hostnames).filter((event) => {
      if (event.received_at < since) return false;
      if (pageviewsOnly && event.event_type !== "pageview") return false;
      return true;
    });
  }

  function rowsForHostnames(hostnames: string[]) {
    return [...events.values()].filter((event) => (
      hostnames.length === 0 || hostnames.includes(event.hostname)
    ));
  }

  return {
    events,
    visitors,
    sessions,
    db: { prepare },
  };
}

function analyticsRequest(
  url: string,
  payload?: unknown,
  token?: string,
  headersInit: Record<string, string> = {},
): Request {
  const headers = new Headers(headersInit);
  if (token) headers.set("authorization", `Bearer ${token}`);
  return {
    url,
    headers,
    text: async () => JSON.stringify(payload ?? {}),
  } as Request;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    eventId: "event_12345678",
    visitorId: "visitor_12345678",
    sessionId: "session_12345678",
    visitId: "visit_12345678",
    eventType: "pageview",
    path: "/path/25?discard=yes",
    occurredAt: new Date().toISOString(),
    deviceClass: "desktop",
    viewportWidth: 1200,
    viewportHeight: 800,
    language: "en-US",
    automation: false,
    ...overrides,
  };
}

function sharedCookieHeader(
  visitor = "shared_visitor_12345678",
  session = "shared_session_12345678",
  visit = "shared_visit_12345678",
) {
  return `${[
    `inshell_anon_visitor=${visitor}`,
    `inshell_anon_session=${session}`,
    `inshell_anon_visit=${visit}`,
  ].join("; ")}`;
}

describe("anonymous analytics Pages functions", () => {
  beforeEach(() => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: async (_algorithm: string, data: ArrayBuffer | ArrayBufferView) => {
            const input = data instanceof ArrayBuffer
              ? new Uint8Array(data)
              : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            const out = new Uint8Array(32);
            for (let index = 0; index < input.length; index += 1) {
              out[index % out.length] = (out[index % out.length] + input[index] + index) % 256;
            }
            return out.buffer;
          },
        },
      },
    });
  });

  afterEach(() => {
    globalThis.Response = originalResponse;
    globalThis.Headers = originalHeaders;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    jest.restoreAllMocks();
  });

  test("records shared-cookie pageviews without storing raw visitor or session ids", async () => {
    const d1 = createAnalyticsD1Mock();
    const response = await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({ visitorId: undefined, sessionId: undefined, visitId: undefined }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    const body = await response.json() as any;
    expect(body).toMatchObject({
      ok: true,
      stored: true,
      duplicate: false,
    });
    expect(body.setCookies).toBeUndefined();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("inshell_anon_visitor=");
    expect(setCookie).toContain("Max-Age=31536000");
    expect(setCookie).toContain("inshell_anon_session=");
    expect(setCookie).toContain("inshell_anon_visit=");
    expect(setCookie).toContain("Max-Age=1800");
    expect(setCookie).toContain("Domain=.inshell.art");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const event = [...d1.events.values()][0];
    expect(event.path).toBe("/path/25");
    expect(event.content_type).toBe("path");
    expect(event.content_id).toBe("25");
    expect(event.surface).toBe("home");
    expect(event.visitor_hash).not.toBe("visitor_12345678");
    expect(event.session_hash).not.toBe("session_12345678");
    expect(event.visit_hash).not.toBe("visit_12345678");
    expect(event.visit_hash).toBeTruthy();
  });

  test("falls back to a hashed session id for legacy clients without visitId", async () => {
    const d1 = createAnalyticsD1Mock();
    const response = await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://staging.inshell-art.pages.dev/api/analytics/event",
        payload({ eventId: "event_legacy_12345678", visitId: undefined }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stored: true,
    });
    const event = d1.events.get("event_legacy_12345678");
    expect(event?.visit_hash).toBe(event?.session_hash);
    expect(event?.visit_hash).not.toBe("session_12345678");
  });

  test("filters typed event metadata through a privacy allowlist", async () => {
    const d1 = createAnalyticsD1Mock();
    const response = await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({
          eventId: "event_cta_12345678",
          eventType: "cta_click",
          path: "/",
          contentType: "home",
          metadata: {
            ctaId: "mint-primary",
            walletAddress: "0x1234567890123456789012345678901234567890",
            prompt: "private prompt text",
            scrollPercent: 100,
          },
        }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stored: true,
    });
    const event = d1.events.get("event_cta_12345678");
    expect(event?.metadata_json).toBe(JSON.stringify({ ctaId: "mint-primary" }));
    expect(event?.metadata_json).not.toContain("walletAddress");
    expect(event?.metadata_json).not.toContain("private prompt");
  });

  test("treats duplicate event ids as idempotent", async () => {
    const d1 = createAnalyticsD1Mock();
    const request = analyticsRequest("https://thought.inshell.art/api/analytics/event", payload());
    await onAnalyticsEventPost({ request, env: { INSHELL_CHAIN_DATA_DB: d1.db } });

    const duplicate = await onAnalyticsEventPost({
      request: analyticsRequest("https://thought.inshell.art/api/analytics/event", payload()),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    await expect(duplicate.json()).resolves.toMatchObject({
      ok: true,
      stored: false,
      duplicate: true,
    });
    expect(d1.events.size).toBe(1);
  });

  test("returns aggregate summary behind bearer auth", async () => {
    const d1 = createAnalyticsD1Mock();
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://staging.inshell-art.pages.dev/api/analytics/event",
        payload({
          eventId: "event_staging_12345678",
          path: "/preview-only",
        }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://gallery.inshell.art/api/analytics/event",
        payload({ eventId: "event_legacy_gallery_12345678", path: "/legacy-gallery" }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({ eventId: "event_canonical_gallery_12345678", path: "/gallery" }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    expect(d1.events.get("event_legacy_gallery_12345678")?.hostname).toBe("gallery.inshell.art");

    const unauthorized = await onAnalyticsSummaryGet({
      request: analyticsRequest("https://gallery.inshell.art/api/analytics/summary?days=1"),
      env: { INSHELL_CHAIN_DATA_DB: d1.db, INSHELL_INDEXER_REFRESH_TOKEN: "secret" },
    });
    expect(unauthorized.status).toBe(401);

    const response = await onAnalyticsSummaryGet({
      request: analyticsRequest("https://gallery.inshell.art/api/analytics/summary?days=1", undefined, "secret"),
      env: { INSHELL_CHAIN_DATA_DB: d1.db, INSHELL_INDEXER_REFRESH_TOKEN: "secret" },
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      totals: {
        pageViews: 1,
        uniqueVisitors: 1,
        sessions: 1,
        visits: 1,
      },
      hostScope: {
        name: "production",
      },
      paths: [{ path: "/gallery", pageViews: 1, uniqueVisitors: 1 }],
    });
  });

  test("returns privacy-safe visitor timelines behind bearer auth", async () => {
    const d1 = createAnalyticsD1Mock();
    const firstVisitCookie = sharedCookieHeader(
      "journey_visitor_12345678",
      "journey_session_12345678",
      "journey_visit_one_12345678",
    );
    const secondVisitCookie = sharedCookieHeader(
      "journey_visitor_12345678",
      "journey_session_12345678",
      "journey_visit_two_12345678",
    );
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({
          eventId: "event_path_page_12345678",
          path: "/path/25",
          referrer: "https://example.com/source",
        }),
        undefined,
        { cookie: firstVisitCookie },
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({
          eventId: "event_scroll_12345678",
          eventType: "scroll_depth",
          path: "/path/25",
          metadata: {
            scrollPercent: 75,
            walletAddress: "0x1234567890123456789012345678901234567890",
          },
        }),
        undefined,
        { cookie: firstVisitCookie },
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://thought.inshell.art/api/analytics/event",
        payload({
          eventId: "event_wallet_fail_12345678",
          eventType: "wallet_connect_failed",
          path: "/thought/17",
          metadata: {
            walletKind: "injected",
            walletStage: "request_accounts",
            errorCategory: "wallet_rejected",
            prompt: "private prompt",
          },
        }),
        undefined,
        { cookie: firstVisitCookie },
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://inshell.art/api/analytics/event",
        payload({
          eventId: "event_return_12345678",
          path: "/gallery",
        }),
        undefined,
        { cookie: secondVisitCookie },
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    await onAnalyticsEventPost({
      request: analyticsRequest(
        "https://staging.inshell-art.pages.dev/api/analytics/event",
        payload({
          eventId: "event_staging_only_12345678",
          path: "/staging-only",
        }),
      ),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    const unauthorized = await onAnalyticsVisitorsGet({
      request: analyticsRequest("https://inshell.art/api/analytics/visitors?days=1"),
      env: { INSHELL_CHAIN_DATA_DB: d1.db, INSHELL_INDEXER_REFRESH_TOKEN: "secret" },
    });
    expect(unauthorized.status).toBe(401);

    const response = await onAnalyticsVisitorsGet({
      request: analyticsRequest("https://inshell.art/api/analytics/visitors?days=1", undefined, "secret"),
      env: { INSHELL_CHAIN_DATA_DB: d1.db, INSHELL_INDEXER_REFRESH_TOKEN: "secret" },
    });
    const body = await response.json() as any;

    expect(body).toMatchObject({
      ok: true,
      hostScope: { name: "production" },
      visitors: [
        {
          visitorRank: 1,
          visitorKey: expect.stringMatching(/^v_[a-f0-9]{12}$/),
          eventCount: 4,
          pageViews: 2,
          sessions: 1,
          visitCount: 2,
          returning: true,
          source: {
            referrerHost: "example.com",
            referrerPath: null,
            firstPath: "/path/25",
            firstContentType: "path",
            firstContentId: "25",
          },
        },
      ],
    });
    expect(body.visitors[0].timeline.map((event: any) => event.eventType)).toEqual([
      "pageview",
      "scroll_depth",
      "wallet_connect_failed",
      "pageview",
    ]);
    expect(body.visitors[0].timeline.map((event: any) => event.hostname)).toEqual([
      "inshell.art",
      "inshell.art",
      "thought.inshell.art",
      "inshell.art",
    ]);
    expect(body.visitors[0].timeline.map((event: any) => event.visitRank)).toEqual([1, 1, 1, 2]);
    expect(body.visitors[0].visits).toHaveLength(2);
    expect(body.visitors[0].visits.map((visit: any) => visit.visitRank)).toEqual([1, 2]);
    expect(body.visitors[0].visits.map((visit: any) => visit.eventCount)).toEqual([3, 1]);
    expect(body.visitors[0].visits[1].source.firstPath).toBe("/gallery");
    expect(body.visitors[0].timeline[1].metadata).toEqual({ scrollPercent: 75 });
    expect(body.visitors[0].timeline[2].metadata).toEqual({
      walletKind: "injected",
      walletStage: "request_accounts",
      errorCategory: "wallet_rejected",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("visitor_12345678");
    expect(serialized).not.toContain("session_12345678");
    expect(serialized).not.toContain("visit_12345678");
    expect(serialized).not.toContain("journey_visitor_12345678");
    expect(serialized).not.toContain("journey_session_12345678");
    expect(serialized).not.toContain("journey_visit_one_12345678");
    expect(serialized).not.toContain("journey_visit_two_12345678");
    expect(serialized).not.toContain("walletAddress");
    expect(serialized).not.toContain("private prompt");
    expect(serialized).not.toContain("staging-only");
  });

  test("reports OPS-safe status without exposing identifiers", async () => {
    const d1 = createAnalyticsD1Mock();
    await onAnalyticsEventPost({
      request: analyticsRequest("https://inshell.art/api/analytics/event", payload()),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    await expect(
      readAnalyticsStatus(
        { INSHELL_CHAIN_DATA_DB: d1.db },
        analyticsHostScopeForHostname("inshell.art"),
      ),
    ).resolves.toMatchObject({
      enabled: true,
      identityMode: "shared_cookie",
      sharedCookieDomain: ".inshell.art",
      hostScope: "production",
      dbBound: true,
      dbBinding: "INSHELL_CHAIN_DATA_DB",
      rawIpStored: false,
      rawUserAgentStored: false,
      rawVisitorIdStored: false,
      rawSessionIdStored: false,
      rawVisitIdStored: false,
      rawWalletAddressStored: false,
      metadataAllowlist: true,
      visitTimeoutMinutes: 30,
      statusSource: "d1",
      eventCount24h: 1,
      uniqueVisitors24h: 1,
      sessions24h: 1,
      visits24h: 1,
    });
  });
});

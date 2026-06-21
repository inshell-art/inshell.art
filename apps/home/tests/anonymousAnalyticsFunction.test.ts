import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { onRequestPost as onAnalyticsEventPost } from "../../../functions/api/analytics/event";
import { onRequestGet as onAnalyticsSummaryGet } from "../../../functions/api/analytics/summary";
import {
  analyticsHostScopeForHostname,
  readAnalyticsStatus,
} from "../../../functions/api/analytics/store";

const originalCrypto = globalThis.crypto;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;

class TestHeaders {
  private readonly values = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    for (const [key, value] of Object.entries(init ?? {})) {
      this.set(key, value);
    }
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }
}

class TestResponse {
  readonly status: number;
  readonly headers: TestHeaders;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
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
  surface: string;
  hostname: string;
  path: string;
  received_at: string;
  automation: number;
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
          };
        }
        if (/count\(\*\)\s+as\s+pageViews/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""));
          return {
            pageViews: rows.length,
            uniqueVisitors: new Set(rows.map((row) => row.visitor_hash)).size,
            sessions: new Set(rows.map((row) => row.session_hash)).size,
            automationEvents: rows.reduce((total, row) => total + row.automation, 0),
          };
        }
        if (/returningVisitors/i.test(query)) {
          const rows = rowsSince(bound, String(bound[0] ?? ""));
          const byVisitor = new Map<string, Set<string>>();
          for (const row of rows) {
            if (!byVisitor.has(row.visitor_hash)) byVisitor.set(row.visitor_hash, new Set());
            byVisitor.get(row.visitor_hash)?.add(row.session_hash);
          }
          return {
            returningVisitors: [...byVisitor.values()].filter((sessionSet) => sessionSet.size > 1).length,
          };
        }
        return null;
      }),
      all: jest.fn(async () => {
        const rows = rowsSince(bound, String(bound[0] ?? ""));
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
            surface: String(bound[4]),
            hostname: String(bound[5]),
            path: String(bound[6]),
            received_at: String(bound[10]),
            automation: Number(bound[16] ?? 0),
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

  function rowsSince(boundValues: unknown[], since: string) {
    const hostnames = boundValues.slice(1).map(String);
    return rowsForHostnames(hostnames).filter((event) => {
      if (event.received_at < since) return false;
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

function analyticsRequest(url: string, payload?: unknown, token?: string): Request {
  return {
    url,
    headers: new Headers(token ? { authorization: `Bearer ${token}` } : undefined),
    text: async () => JSON.stringify(payload ?? {}),
  } as Request;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    eventId: "event_12345678",
    visitorId: "visitor_12345678",
    sessionId: "session_12345678",
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
            for (let index = 0; index < out.length; index += 1) {
              out[index] = input[index % input.length] ^ index;
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

  test("records pageviews without storing raw visitor or session ids", async () => {
    const d1 = createAnalyticsD1Mock();
    const response = await onAnalyticsEventPost({
      request: analyticsRequest("https://inshell.art/api/analytics/event", payload()),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stored: true,
      duplicate: false,
    });
    const event = [...d1.events.values()][0];
    expect(event.path).toBe("/path/25");
    expect(event.surface).toBe("home");
    expect(event.visitor_hash).not.toBe("visitor_12345678");
    expect(event.session_hash).not.toBe("session_12345678");
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
      request: analyticsRequest("https://gallery.inshell.art/api/analytics/event", payload({ path: "/gallery" })),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });

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
      },
      hostScope: {
        name: "production",
      },
      paths: [{ path: "/gallery", pageViews: 1, uniqueVisitors: 1 }],
    });
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
      hostScope: "production",
      dbBound: true,
      dbBinding: "INSHELL_CHAIN_DATA_DB",
      rawIpStored: false,
      rawUserAgentStored: false,
      statusSource: "d1",
      eventCount24h: 1,
      uniqueVisitors24h: 1,
      sessions24h: 1,
    });
  });
});

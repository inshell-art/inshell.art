import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { installInshellAnonymousAnalytics, trackInshellAnonymousAnalytics } from "@inshell/shared";

const originalFetch = globalThis.fetch;
const originalCrypto = globalThis.crypto;
const testNavigator = {
  language: "en-US",
  maxTouchPoints: 0,
  webdriver: false,
} as globalThis.Navigator;

describe("Inshell anonymous analytics client", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.title = "$PATH";
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        randomUUID: jest.fn(() => "12345678-1234-4234-9234-123456789abc"),
        getRandomValues: originalCrypto?.getRandomValues?.bind(originalCrypto),
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    delete (window as any).__INSHELL_ANON_ANALYTICS_INSTALLED__;
    delete (window as any).__INSHELL_ANON_ANALYTICS_FETCH_PATCHED__;
    delete (window as any).inshellAnalytics;
    jest.restoreAllMocks();
  });

  test("installs on Inshell hosts and sends a minimal pageview", async () => {
    const fetchMock = jest.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(
      installInshellAnonymousAnalytics({
        hostname: "inshell.art",
        window,
        document,
        navigator: testNavigator,
        location: {
          href: "https://inshell.art/path/25?debug=1#frag",
          hostname: "inshell.art",
          pathname: "/path/25",
          search: "?debug=1",
          hash: "#frag",
          origin: "https://inshell.art",
        },
      }),
    ).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, globalThis.RequestInit];
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe("same-origin");
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      version: 1,
      eventType: "pageview",
      path: "/path/25",
      contentType: "path",
      contentId: "25",
      title: "$PATH",
      automation: false,
    });
    expect(payload.visitorId).toBeUndefined();
    expect(payload.sessionId).toBeUndefined();
    expect(payload.visitId).toBeUndefined();
  });

  test("exposes a manual tracker for typed action events", async () => {
    const fetchMock = jest.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(
      installInshellAnonymousAnalytics({
        hostname: "thought.inshell.art",
        window,
        document,
        navigator: testNavigator,
        location: {
          href: "https://thought.inshell.art/thought/17",
          hostname: "thought.inshell.art",
          pathname: "/thought/17",
          search: "",
          hash: "",
          origin: "https://thought.inshell.art",
        },
      }),
    ).toBe(true);

    fetchMock.mockClear();
    expect(
      trackInshellAnonymousAnalytics({
        eventType: "wallet_connect_failed",
        contentType: "thought",
        metadata: {
          walletKind: "injected",
          walletStage: "request_accounts",
          errorCategory: "wallet_rejected",
        },
      }),
    ).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, globalThis.RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      eventType: "wallet_connect_failed",
      path: "/thought/17",
      contentType: "thought",
      contentId: "17",
      metadata: {
        walletKind: "injected",
        walletStage: "request_accounts",
        errorCategory: "wallet_rejected",
      },
    });
  });

  test("splits same-tab activity into visits after 30 minutes of inactivity", async () => {
    const ids = [
      "visitor_11111111",
      "session_11111111",
      "visit_morning_11111111",
      "event_page_11111111",
      "event_scroll_11111111",
      "visit_night_11111111",
      "event_cta_11111111",
    ];
    const dateNow = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    (globalThis.crypto.randomUUID as jest.Mock).mockImplementation(() => ids.shift() ?? "extra_11111111");
    const fetchMock = jest.fn(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(
      installInshellAnonymousAnalytics({
        hostname: "staging.inshell-art.pages.dev",
        window,
        document,
        navigator: testNavigator,
        location: {
          href: "https://staging.inshell-art.pages.dev/path/25",
          hostname: "staging.inshell-art.pages.dev",
          pathname: "/path/25",
          search: "",
          hash: "",
          origin: "https://staging.inshell-art.pages.dev",
        },
      }),
    ).toBe(true);
    await Promise.resolve();

    dateNow.mockReturnValue(1_000_000 + 29 * 60 * 1000);
    expect(trackInshellAnonymousAnalytics({
      eventType: "scroll_depth",
      metadata: { scrollPercent: 50 },
    })).toBe(true);
    await Promise.resolve();

    dateNow.mockReturnValue(1_000_000 + 60 * 60 * 1000 + 1_000);
    expect(trackInshellAnonymousAnalytics({
      eventType: "cta_click",
      metadata: { ctaId: "mint-primary" },
    })).toBe(true);
    await Promise.resolve();

    const payloads = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as globalThis.RequestInit).body)));
    expect(payloads).toHaveLength(3);
    expect(payloads.map((item) => item.visitorId)).toEqual([
      "visitor_11111111",
      "visitor_11111111",
      "visitor_11111111",
    ]);
    expect(payloads.map((item) => item.sessionId)).toEqual([
      "session_11111111",
      "session_11111111",
      "session_11111111",
    ]);
    expect(payloads.map((item) => item.visitId)).toEqual([
      "visit_morning_11111111",
      "visit_morning_11111111",
      "visit_night_11111111",
    ]);
  });

  test("does not install on local hosts or when explicitly disabled", () => {
    expect(
      installInshellAnonymousAnalytics({
        hostname: "127.0.0.1",
        window,
        document,
        navigator: testNavigator,
      }),
    ).toBe(false);
    expect(
      installInshellAnonymousAnalytics({
        env: { VITE_INSHELL_ANON_ANALYTICS: "off" },
        hostname: "inshell.art",
        window,
        document,
        navigator: testNavigator,
      }),
    ).toBe(false);
  });
});

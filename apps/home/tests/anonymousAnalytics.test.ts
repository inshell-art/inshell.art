import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { installInshellAnonymousAnalytics } from "@inshell/shared";

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
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      version: 1,
      eventType: "pageview",
      path: "/path/25",
      title: "$PATH",
      automation: false,
    });
    expect(payload.visitorId).toBe("12345678-1234-4234-9234-123456789abc");
    expect(payload.sessionId).toBe("12345678-1234-4234-9234-123456789abc");
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

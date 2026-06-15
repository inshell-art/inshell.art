import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { onRequest } from "../../../functions/_middleware";

const originalRequest = globalThis.Request;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;
const originalFetch = globalThis.fetch;
const publicFeedSourceBaseUrl = "https://d807d286.inshell-public-feed.pages.dev";

class TestHeaders {
  private readonly values = new Map<string, string>();

  constructor(init?: unknown) {
    if (init instanceof TestHeaders) {
      for (const [key, value] of init.values) {
        this.set(key, value);
      }
      return;
    }
    if (Array.isArray(init)) {
      for (const [key, value] of init) {
        this.set(String(key), String(value));
      }
      return;
    }
    if (init && typeof init === "object") {
      for (const [key, value] of Object.entries(init)) {
        this.set(key, String(value));
      }
    }
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }

  delete(key: string) {
    this.values.delete(key.toLowerCase());
  }
}

class TestRequest {
  readonly url: string;
  readonly method: string;

  constructor(input: string | { url: string; method?: string }) {
    this.url = typeof input === "string" ? input : input.url;
    this.method = typeof input === "string" ? "GET" : (input.method ?? "GET");
  }
}

class TestResponse {
  readonly body: unknown;
  readonly headers: TestHeaders;
  readonly status: number;
  readonly statusText: string;

  constructor(body?: unknown, init?: { status?: number; statusText?: string; headers?: unknown }) {
    this.body = body ?? null;
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? "";
    this.headers = new TestHeaders(init?.headers);
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  static redirect(url: string, status = 302) {
    return new TestResponse(null, {
      status,
      headers: {
        location: url,
      },
    });
  }
}

function middlewareContext(url: string) {
  const next = jest.fn(async () => new Response("next", { status: 200 }));
  const assetsFetch = jest.fn(async () => new Response("asset", { status: 200 }));
  return {
    request: new Request(url),
    env: {
      ASSETS: {
        fetch: assetsFetch,
      },
    },
    next,
    assetsFetch,
  };
}

describe("Pages middleware canonical routes", () => {
  beforeEach(() => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
  });

  afterEach(() => {
    globalThis.Request = originalRequest;
    globalThis.Response = originalResponse;
    globalThis.Headers = originalHeaders;
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("redirects legacy THOUGHT query detail URLs to the root work route", async () => {
    const ctx = middlewareContext("https://thought.inshell.art/?thought=9");
    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://inshell.art/thought/9");
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("temporarily redirects Sepolia public-post links to the current root host", async () => {
    const ctx = middlewareContext("https://sepolia.inshell.art/thought/12");
    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://inshell.art/thought/12");
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("preserves Sepolia redirect path and query while the archive host is bridged", async () => {
    const ctx = middlewareContext("https://sepolia.inshell.art/path/15?source=x");
    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://inshell.art/path/15?source=x");
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("proxies the explicit Sepolia rehearsal RSS feed", async () => {
    const fetchMock = jest.fn(async () => new Response("<rss />", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = middlewareContext("https://inshell.art/rss.sepolia.xml");
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://inshell-public-feed.pages.dev/rss.sepolia.xml",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("proxies Public Feed events JSON before the app shell fallback", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response("[]", {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = middlewareContext("https://inshell.art/events.json");
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(fetchMock).toHaveBeenCalledWith(
      `${publicFeedSourceBaseUrl}/events.json`,
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/json, */*;q=0.1",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("proxies Public Feed source pages before the app shell fallback", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response("<!doctype html><title>source</title>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = middlewareContext("https://inshell.art/source/thought-9.html?via=rss");
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(fetchMock).toHaveBeenCalledWith(
      `${publicFeedSourceBaseUrl}/source/thought-9.html?via=rss`,
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("preserves encoded Public Feed cloud source ids", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response("<!doctype html><title>cloud source</title>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const cloudId =
      "sepolia%3Acloud%3Amovement.minted%3A0x88632290a357c40d8af1cb6c9edee44a02b7ce828b605613510e9a98a0a06847";
    const ctx = middlewareContext(`https://inshell.art/source/sepolia/cloud/${cloudId}`);
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `${publicFeedSourceBaseUrl}/source/sepolia/cloud/${cloudId}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("proxies Public Feed source assets before the app shell fallback", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response("body{}", {
          status: 200,
          headers: {
            "content-type": "text/css; charset=utf-8",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const ctx = middlewareContext("https://inshell.art/source-assets/feed.css");
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(fetchMock).toHaveBeenCalledWith(
      `${publicFeedSourceBaseUrl}/source-assets/feed.css`,
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "*/*",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("preserves encoded Public Feed cloud media ids", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response("<svg></svg>", {
          status: 200,
          headers: {
            "content-type": "image/svg+xml",
          },
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const cloudId =
      "sepolia%3Acloud%3Amovement.minted%3A0x88632290a357c40d8af1cb6c9edee44a02b7ce828b605613510e9a98a0a06847";
    const ctx = middlewareContext(
      `https://inshell.art/source-assets/sepolia/cloud/${cloudId}/thought.svg`,
    );
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `${publicFeedSourceBaseUrl}/source-assets/sepolia/cloud/${cloudId}/thought.svg`,
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "*/*",
        }),
      }),
    );
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("redirects preview THOUGHT path detail URLs to the preview root work route", async () => {
    const ctx = middlewareContext("https://thought.preview.inshell.art/thought/9");
    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://preview.inshell.art/thought/9");
    expect(ctx.next).not.toHaveBeenCalled();
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });

  test("serves canonical root THOUGHT routes through the root app shell", async () => {
    const ctx = middlewareContext("https://inshell.art/thought/9");
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, stale-while-revalidate=300");
    expect(response.headers.get("clear-site-data")).toBeNull();
    expect(ctx.assetsFetch).toHaveBeenCalledTimes(1);
    expect(ctx.next).not.toHaveBeenCalled();
  });

  test("does not serve oversized numeric THOUGHT paths through the app shell", async () => {
    const ctx = middlewareContext(
      "https://inshell.art/thought/54364138588649095656199127666862160886190085583430894705241839978667380631264",
    );
    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(ctx.next).toHaveBeenCalledTimes(1);
    expect(ctx.assetsFetch).not.toHaveBeenCalled();
  });
});

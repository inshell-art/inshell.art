import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { onRequest } from "../../../functions/_middleware";

const originalRequest = globalThis.Request;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;

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
}

class TestRequest {
  readonly url: string;

  constructor(input: string | { url: string }) {
    this.url = typeof input === "string" ? input : input.url;
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
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(ctx.assetsFetch).toHaveBeenCalledTimes(1);
    expect(ctx.next).not.toHaveBeenCalled();
  });
});

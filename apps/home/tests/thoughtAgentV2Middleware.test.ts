import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { onRequest } from "../../../functions/api/thought-agent/v2/_middleware";

const originalResponse = globalThis.Response;
const api = "/api/thought-agent/v2";
const run = `${api}/runs/tar_middleware_fixture`;

class TestResponse {
  readonly status: number;
  readonly headers: { get: (name: string) => string | null };

  constructor(
    private readonly body: string | null,
    init: { status?: number; headers?: Record<string, string> },
  ) {
    this.status = init.status ?? 200;
    const values = new Map(Object.entries(init.headers ?? {}));
    this.headers = { get: (name) => values.get(name.toLowerCase()) ?? null };
  }

  async text() {
    return this.body ?? "";
  }

  async json() {
    return JSON.parse(await this.text());
  }
}

function context(pathname: string, method: string) {
  const handlerResponse = new Response("handler response", { status: 401 });
  const next = jest.fn(async () => handlerResponse);
  const assetsFetch = jest.fn(async () => new Response("private app shell", { status: 200 }));
  const request = {
    url: `https://preview.inshell.art${pathname}`,
    method,
    headers: new Map([["authorization", "Bearer test-run-credential"]]),
    text: async () => '{"test":"unchanged"}',
  } as unknown as Request;
  return { request, next, env: { ASSETS: { fetch: assetsFetch } }, assetsFetch, handlerResponse };
}

// Includes the browser-only routes: this guard must preserve their handlers,
// while Cloudflare Access continues to control who may reach them.
const knownRoutes: ReadonlyArray<readonly [string, string]> = [
  [`${api}/connectivity`, "GET"],
  [`${api}/client`, "GET"],
  [`${api}/runs`, "POST"],
  [run, "GET"],
  [`${run}/claim`, "POST"],
  [`${run}/ready`, "POST"],
  [`${run}/start`, "POST"],
  [`${run}/result`, "PUT"],
  [`${run}/fail`, "POST"],
  [`${run}/cancel`, "POST"],
  [`${run}/claim-authorization`, "POST"],
];

describe("THOUGHT Agent V2 API fallback boundary", () => {
  beforeEach(() => {
    globalThis.Response = TestResponse as unknown as typeof Response;
  });

  afterEach(() => {
    globalThis.Response = originalResponse;
  });

  for (const [path, allowedMethod] of knownRoutes) {
    test(`preserves ${allowedMethod} and OPTIONS handlers for ${path}`, async () => {
      for (const suffix of ["", "/", "?via=agent", "/?via=agent"]) {
        for (const method of [allowedMethod, "OPTIONS"]) {
          const ctx = context(`${path}${suffix}`, method);
          const request = ctx.request;
          expect(await onRequest(ctx)).toBe(ctx.handlerResponse);
          expect(ctx.next).toHaveBeenCalledTimes(1);
          expect(ctx.next).toHaveBeenCalledWith();
          expect(ctx.request).toBe(request);
          expect(ctx.request.headers.get("authorization")).toBe("Bearer test-run-credential");
          expect(await ctx.request.text()).toBe('{"test":"unchanged"}');
          expect(ctx.assetsFetch).not.toHaveBeenCalled();
        }
      }
    });

    test(`rejects unsupported methods before asset fallback for ${path}`, async () => {
      for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]) {
        if (method === allowedMethod) continue;
        for (const suffix of ["", "/"]) {
          const ctx = context(`${path}${suffix}`, method);
          const response = await onRequest(ctx);
          expect(response.status).toBe(405);
          expect(response.headers.get("allow")).toBe(`${allowedMethod}, OPTIONS`);
          expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(response.headers.get("x-content-type-options")).toBe("nosniff");
          if (method === "HEAD") {
            expect(await response.text()).toBe("");
          } else {
            expect(await response.json()).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED" } });
          }
          expect(ctx.next).not.toHaveBeenCalled();
          expect(ctx.assetsFetch).not.toHaveBeenCalled();
        }
      }
    });
  }

  const unknownPaths = [
    api,
    `${api}/`,
    `${api}/not-a-route`,
    `${api}/connectivity/extra`,
    `${api}/connectivity-extra`,
    `${api}/connectivity//`,
    `${api}/runs//`,
    `${api}/runs/not-a-run`,
    `${api}/runs/tar_short/claim`,
    `${run}/unknown`,
    `${run}/claim-extra`,
    `${run}/claim/extra`,
    `${run}/nested/claim`,
    `${run}//claim`,
    `${run}/claim//`,
    `${run}/%63laim`,
    `${run}%2Fclaim`,
    `${api}/runs/tar_middleware%2Ffixture/claim`,
    `${api}/runs/tar_middleware%252Ffixture/claim`,
    `${api}/runs/tar_middleware%5Cfixture/claim`,
    `${api}/runs%2Ftar_middleware_fixture/claim`,
    `${api}/runs/tar_middleware_fixture;extra/claim`,
    `${run}/claim%3Fextra`,
    `${run}/claim%23extra`,
    `${run}/CLAIM`,
  ];

  test.each(unknownPaths)("rejects unknown or noncanonical API path %s", async (path) => {
    for (const method of ["GET", "HEAD", "POST", "PUT", "OPTIONS"]) {
      const ctx = context(path, method);
      const response = await onRequest(ctx);
      expect(response.status).toBe(404);
      expect(response.headers.get("allow")).toBeNull();
      expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
      if (method === "HEAD") {
        expect(await response.text()).toBe("");
      } else {
        expect(await response.json()).toMatchObject({ error: { code: "ROUTE_NOT_FOUND" } });
      }
      expect(ctx.next).not.toHaveBeenCalled();
      expect(ctx.assetsFetch).not.toHaveBeenCalled();
    }
  });
});

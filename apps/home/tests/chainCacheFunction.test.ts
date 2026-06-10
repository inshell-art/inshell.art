import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  createChainCacheDiagnostics,
  json,
  readResponseCache,
  readSnapshot,
  withChainCacheDiagnostics,
  writeResponseCache,
  writeSnapshot,
  type IndexedSnapshot,
} from "../../../functions/api/chain-cache";
import { onRequestGet as onPathTokensGet } from "../../../functions/api/path-tokens";
import { onRequestGet as onThoughtImageGet } from "../../../functions/api/thought-image";
import { onRequestGet as onThoughtProvenanceGet } from "../../../functions/api/thought-provenance";
import { onRequestGet as onThoughtSpecGet } from "../../../functions/api/thought-spec";

const originalFetch = globalThis.fetch;
const originalRequest = globalThis.Request;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;
const originalCaches = (globalThis as any).caches;
const OWNER = "0x1111222233334444555566667777888899990000";
const PATH_NFT = "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function word(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function addressWord(address: string) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function tokenTopic(tokenId: bigint) {
  return `0x${word(tokenId)}`;
}

function addressTopic(address: string) {
  return `0x${addressWord(address)}`;
}

function encodeStringResult(value: string) {
  const data = Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const padded = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
  return `0x${word(32n)}${word(BigInt(value.length))}${padded}`;
}

function encodeAddressResult(address: string) {
  return `0x${addressWord(address)}`;
}

function rpcResponse(result: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

class TestHeaders {
  values = new Map<string, string>();

  constructor(init?: Record<string, string> | TestHeaders) {
    const entries = init instanceof TestHeaders
      ? [...init.values.entries()]
      : Object.entries(init ?? {});
    for (const [key, value] of entries) {
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
  status: number;
  headers: TestHeaders;
  body: string;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers instanceof TestHeaders
      ? new TestHeaders(init.headers)
      : new TestHeaders(init?.headers as Record<string, string> | undefined);
    this.bodyText = typeof body === "string" ? body : "";
    this.body = this.bodyText;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }

  clone() {
    return new TestResponse(this.bodyText, {
      status: this.status,
      headers: this.headers,
    });
  }
}

class TestRequest {
  url: string;

  constructor(url: string) {
    this.url = String(url);
  }
}

describe("chain cache Pages functions", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Request = originalRequest;
    globalThis.Response = originalResponse;
    globalThis.Headers = originalHeaders;
    (globalThis as any).caches = originalCaches;
    jest.restoreAllMocks();
  });

  test("indexes PATH transfer logs behind the same-origin JSON API", async () => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: any[];
      };
      if (body.method === "eth_blockNumber") {
        return rpcResponse("0xa5a7ec");
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([
          {
            address: PATH_NFT,
            blockNumber: "0xa5a7ec",
            data: "0x",
            logIndex: "0x0",
            topics: [TRANSFER_TOPIC, ZERO_TOPIC, addressTopic(OWNER), tokenTopic(1n)],
            transactionHash: `0x${"1".padStart(64, "0")}`,
          },
        ]);
      }
      if (body.method === "eth_call") {
        const data = String(body.params?.[0]?.data ?? "");
        if (data.startsWith("0x6352211e")) {
          return rpcResponse(encodeAddressResult(OWNER));
        }
        if (data.startsWith("0xc87b56dd")) {
          return rpcResponse(
            encodeStringResult(
              `data:application/json;utf8,${encodeURIComponent(
                JSON.stringify({ name: "PATH #1" })
              )}`
            )
          );
        }
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onPathTokensGet({
      request: {} as Request,
      env: {
        PATH_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
      },
    });
    const payload = (await response.json()) as { items?: Array<{ tokenIdLabel: string; metadata: any }> };

    expect(response.status).toBe(200);
    expect(payload.items?.map((item) => item.tokenIdLabel)).toEqual(["1"]);
    expect(payload.items?.[0]?.metadata.name).toBe("PATH #1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://path-rpc.example/sepolia",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("does not fail open when KV is quota limited", async () => {
    const diagnostics = createChainCacheDiagnostics("quota-test");
    const snapshot = await readSnapshot(
      {
        INSHELL_CHAIN_DATA_KV: {
          get: jest.fn(async () => {
            throw new Error("429");
          }),
          put: jest.fn(),
        },
      },
      "quota-test",
      diagnostics,
    );

    expect(snapshot).toBeNull();
    expect(diagnostics.kvRead).toBe(1);
    expect(diagnostics.source).toBe("live");
  });

  test("skips KV writes when snapshot content is unchanged and recent", async () => {
    const put = jest.fn(async () => undefined);
    const waited: Promise<unknown>[] = [];
    const previous: IndexedSnapshot<{ id: string }> = {
      version: 1,
      cachedAt: Date.now(),
      chainId: 11155111,
      contract: PATH_NFT,
      fromBlock: 1,
      lastScannedBlock: 10,
      items: [{ id: "1" }],
    };
    const next: IndexedSnapshot<{ id: string }> = {
      ...previous,
      cachedAt: Date.now() + 1000,
      lastScannedBlock: 20,
    };
    const diagnostics = createChainCacheDiagnostics("unchanged-test");

    await writeSnapshot(
      {
        request: { url: "https://preview.inshell.art/api/path-tokens" } as Request,
        env: {
          INSHELL_CHAIN_DATA_KV: {
            get: jest.fn(),
            put,
          },
        },
        waitUntil: (promise) => {
          waited.push(promise);
        },
      },
      "unchanged-test",
      next,
      0,
      diagnostics,
      previous,
    );
    await Promise.all(waited);

    expect(put).not.toHaveBeenCalled();
    expect(diagnostics.kvWrite).toBe(0);
  });

  test("writes KV when snapshot content changes", async () => {
    const put = jest.fn(async () => undefined);
    const waited: Promise<unknown>[] = [];
    const previous: IndexedSnapshot<{ id: string }> = {
      version: 1,
      cachedAt: Date.now(),
      chainId: 11155111,
      contract: PATH_NFT,
      fromBlock: 1,
      lastScannedBlock: 10,
      items: [{ id: "1" }],
    };
    const next: IndexedSnapshot<{ id: string }> = {
      ...previous,
      cachedAt: Date.now() + 1000,
      lastScannedBlock: 20,
      items: [{ id: "1" }, { id: "2" }],
    };
    const diagnostics = createChainCacheDiagnostics("changed-test");

    await writeSnapshot(
      {
        request: { url: "https://preview.inshell.art/api/path-tokens" } as Request,
        env: {
          INSHELL_CHAIN_DATA_KV: {
            get: jest.fn(),
            put,
          },
        },
        waitUntil: (promise) => {
          waited.push(promise);
        },
      },
      "changed-test",
      next,
      0,
      diagnostics,
      previous,
    );
    await Promise.all(waited);

    expect(put).toHaveBeenCalledTimes(1);
    expect(diagnostics.kvWrite).toBe(1);
  });

  test("serves response cache diagnostics without touching KV", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const store = new Map<string, Response>();
    (globalThis as any).caches = {
      default: {
        match: jest.fn(async (request: Request) => store.get(request.url)?.clone() ?? null),
        put: jest.fn(async (request: Request, response: Response) => {
          store.set(request.url, response.clone());
        }),
      },
    };
    const waited: Promise<unknown>[] = [];
    const ctx = {
      request: new Request("https://preview.inshell.art/api/path-tokens"),
      env: { CHAIN_CACHE_DIAGNOSTICS: "1" },
      waitUntil: (promise: Promise<unknown>) => {
        waited.push(promise);
      },
    };
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
    writeResponseCache(ctx, "response-test", response, 60, 123);
    await Promise.all(waited);

    const cached = await readResponseCache(ctx, "response-test");
    const diagnostics = createChainCacheDiagnostics("response-test");
    diagnostics.source = "edge";
    const withDiagnostics = withChainCacheDiagnostics(ctx, cached as Response, diagnostics);

    expect(await withDiagnostics.json()).toEqual({ ok: true });
    expect(withDiagnostics.headers.get("x-chain-cache-source")).toBe("edge");
    expect(withDiagnostics.headers.get("x-kv-read")).toBe("0");
    expect(withDiagnostics.headers.get("x-kv-write")).toBe("0");
    expect(withDiagnostics.headers.get("x-live-rpc-calls")).toBe("0");
    expect(withDiagnostics.headers.get("x-cache-snapshot-block")).toBe("123");
  });

  test("does not expose raw Error details from JSON responses", async () => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const error = new Error("upstream rpc key leaked in message");
    error.stack = "Error: upstream rpc key leaked in message\n    at secret-stack";

    const response = json(500, {
      error: "chain data unavailable",
      cause: error,
      stack: error.stack,
    });
    const payload = (await response.json()) as Record<string, unknown>;

    expect(payload).toEqual({
      error: "chain data unavailable",
      cause: { error: "internal error" },
    });
    expect(response.body).not.toContain("upstream rpc key leaked");
    expect(response.body).not.toContain("secret-stack");
  });

  test("serves THOUGHT detail JSON and image through same-origin APIs", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const snapshot: IndexedSnapshot<{
      tokenId: number;
      thoughtSpecId: string;
      thoughtSpecHash: string;
      provenanceJson: string;
      image: string;
    }> = {
      version: 1,
      cachedAt: Date.now(),
      chainId: 11155111,
      contract: "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a",
      fromBlock: 10872879,
      lastScannedBlock: 123,
      items: [
        {
          tokenId: 9,
          thoughtSpecId: "0xspec",
          thoughtSpecHash: "0xhash",
          provenanceJson: JSON.stringify({
            schema: "thought.provenance.v1",
            prompt: "test prompt",
          }),
          image:
            "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E",
        },
      ],
    } as IndexedSnapshot<any>;
    const kvGet = jest.fn(async () => snapshot);
    const env = {
      INSHELL_CHAIN_DATA_KV: {
        get: kvGet,
        put: jest.fn(),
      },
    };

    const provenance = await onThoughtProvenanceGet({
      request: new Request("https://preview.inshell.art/api/thought-provenance?id=9"),
      env,
    });
    const spec = await onThoughtSpecGet({
      request: new Request("https://preview.inshell.art/api/thought-spec?id=9"),
      env,
    });
    const image = await onThoughtImageGet({
      request: new Request("https://preview.inshell.art/api/thought-image?id=9"),
      env,
    });

    expect(provenance.status).toBe(200);
    expect(await provenance.json()).toEqual({
      schema: "thought.provenance.v1",
      prompt: "test prompt",
    });
    expect(spec.status).toBe(200);
    expect(await spec.json()).toEqual({
      ref: "THOUGHT.v1.md",
      specId: "0xspec",
      specHash: "0xhash",
    });
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(image.headers.get("content-disposition")).toBe('inline; filename="thought-9.svg"');
    expect(image.body).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(kvGet).toHaveBeenCalledWith("thought-gallery:v1:sepolia", "json");
  });
});

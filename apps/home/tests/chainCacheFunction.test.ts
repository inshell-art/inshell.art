import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  clearChainCacheForTest,
  createStats,
  createChainCacheDiagnostics,
  getLogsChunked,
  json,
  readResponseCache,
  readSnapshot,
  withChainCacheDiagnostics,
  writeResponseCache,
  writeSnapshot,
  type IndexedSnapshot,
} from "../../../functions/api/chain-cache";
import { onRequestPost as onIndexerEventPost } from "../../../functions/api/indexer/event";
import { onRequestPost as onIndexerRefreshPost } from "../../../functions/api/indexer/refresh";
import { onRequestGet as onOpsStatusGet } from "../../../functions/api/ops/status";
import { onRequestGet as onPathTokensGet } from "../../../functions/api/path-tokens";
import { onRequestGet as onPulseAuctionGet } from "../../../functions/api/pulse-auction";
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
const PULSE_SALE_TOPIC =
  "0xa789468a0212cbe853fbdd6011d2ee7d85144ebc1d67c7dd82f087a970d9593d";
const PULSE_AUCTION = "0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39";
const THOUGHT_NFT = "0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a";
const THOUGHT_MINTED_TOPIC =
  "0xf83a962c31fcc481a4796d3bd1f81a4b58d1b05ec5cb34e434b2d40962596860";
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
    status: 200,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

function rpcError(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ jsonrpc: "2.0", id: 1, error: { message } }),
  };
}

function createD1Mock(
  seed: Record<string, unknown> = {},
  options: { failWritesForKeys?: string[]; failReadsForKeys?: string[] } = {},
) {
  const rows = new Map<string, string>(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  const exec = jest.fn(async (query: string) => {
    if (/create\s+table/i.test(query) && /\n/.test(query)) {
      throw new Error("mock D1 exec rejects multiline CREATE TABLE statements");
    }
  });
  const prepare = jest.fn((query: string) => {
    let bound: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: jest.fn(async () => {
        if (/select\s+snapshot_json/i.test(query)) {
          const key = String(bound[0] ?? "");
          if (options.failReadsForKeys?.includes(key)) {
            throw new Error(`forced D1 read failure for ${key}`);
          }
          const snapshot_json = rows.get(key);
          return snapshot_json ? { snapshot_json } : null;
        }
        return null;
      }),
      run: jest.fn(async () => {
        if (/insert\s+into\s+chain_snapshots/i.test(query)) {
          const key = String(bound[0] ?? "");
          if (options.failWritesForKeys?.includes(key)) {
            throw new Error(`forced D1 write failure for ${key}`);
          }
          rows.set(key, String(bound[1] ?? ""));
        }
        return {};
      }),
    };
    return statement;
  });
  return {
    rows,
    db: {
      exec,
      prepare,
    },
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
  headers: TestHeaders;
  private readonly bodyText: string;

  constructor(url: string, init?: { headers?: Record<string, string>; body?: string }) {
    this.url = String(url);
    this.headers = new TestHeaders(init?.headers);
    this.bodyText = init?.body ?? "";
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

describe("chain cache Pages functions", () => {
  afterEach(() => {
    clearChainCacheForTest();
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
        PATH_PRIMARY_RPC_UPSTREAM: "https://target-path-rpc.example/sepolia",
        PATH_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
      },
    });
    const payload = (await response.json()) as { items?: Array<{ tokenIdLabel: string; metadata: any }> };

    expect(response.status).toBe(200);
    expect(payload.items?.map((item) => item.tokenIdLabel)).toEqual(["1"]);
    expect(payload.items?.[0]?.metadata.name).toBe("PATH #1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://target-path-rpc.example/sepolia",
      expect.objectContaining({ method: "POST" })
    );
  });

  test("falls back when primary PATH RPC rejects eth_getLogs block ranges", async () => {
    const fetchMock = jest.fn(async (url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: Array<{ fromBlock?: string; toBlock?: string }>;
      };
      if (body.method !== "eth_getLogs") throw new Error(`unexpected RPC method ${body.method}`);
      if (url === "https://target-path-rpc.example/sepolia") {
        return rpcError(
          400,
          "Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range.",
        );
      }
      if (url === "https://public-fallback-rpc.example/sepolia") {
        const filter = body.params?.[0] ?? {};
        if (filter.fromBlock !== "0x64") return rpcResponse([]);
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
      throw new Error(`unexpected RPC upstream ${String(url)}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const env = {
      PATH_PRIMARY_RPC_UPSTREAM: "https://target-path-rpc.example/sepolia",
      PUBLIC_FALLBACK_RPC_UPSTREAM: "https://public-fallback-rpc.example/sepolia",
    };
    const stats = createStats("path", "pulse-auction", env);

    const logs = await getLogsChunked(env, "path", stats, {
      address: PATH_NFT,
      fromBlock: 100,
      toBlock: 119,
      topics: [TRANSFER_TOPIC],
    });

    expect(logs).toHaveLength(1);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://target-path-rpc.example/sepolia",
      "https://public-fallback-rpc.example/sepolia",
      "https://target-path-rpc.example/sepolia",
      "https://public-fallback-rpc.example/sepolia",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => {
      const body = JSON.parse(String((init as any)?.body ?? "{}"));
      return body.params?.[0]
        ? [body.params[0].fromBlock, body.params[0].toBlock]
        : [];
    })).toEqual([
      ["0x64", "0x6d"],
      ["0x64", "0x6d"],
      ["0x6e", "0x77"],
      ["0x6e", "0x77"],
    ]);
    expect(stats.calls).toBe(4);
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

  test("reads D1 snapshots before KV snapshots", async () => {
    const d1Snapshot: IndexedSnapshot<{ id: string }> = {
      version: 1,
      cachedAt: Date.now() - 120_000,
      chainId: 11155111,
      contract: PATH_NFT,
      fromBlock: 1,
      lastScannedBlock: 99,
      items: [{ id: "d1" }],
    };
    const d1 = createD1Mock({ "d1-test": d1Snapshot });
    const kvGet = jest.fn(async () => {
      throw new Error("KV should not be read when D1 has the snapshot");
    });
    const diagnostics = createChainCacheDiagnostics("d1-test");

    const snapshot = await readSnapshot<{ id: string }>(
      {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_CHAIN_DATA_KV: {
          get: kvGet,
          put: jest.fn(),
        },
      },
      "d1-test",
      diagnostics,
    );

    expect(snapshot?.items).toEqual([{ id: "d1" }]);
    expect(kvGet).not.toHaveBeenCalled();
    expect(diagnostics.source).toBe("d1");
    expect(diagnostics.dbRead).toBe(1);
    expect(diagnostics.kvRead).toBe(0);
  });

  test("serves pulse auction D1 read model without live RPC", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const d1Snapshot: IndexedSnapshot<{
      key: string;
      atMs: number;
      amount: { raw: { low: string; high: string }; dec: string };
    }> = {
      version: 1,
      cachedAt: Date.now() - 120_000,
      chainId: 11155111,
      contract: PULSE_AUCTION,
      fromBlock: 10854123,
      lastScannedBlock: 10870000,
      items: [
        {
          key: "tx:cached",
          atMs: 1_780_000_000_000,
          amount: { raw: { low: "1", high: "0" }, dec: "1" },
        },
      ],
    };
    const d1 = createD1Mock({ "pulse-auction:v1:sepolia": d1Snapshot });
    const fetchMock = jest.fn(async () => {
      throw new Error("live RPC should not be called for a D1 read model hit");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onPulseAuctionGet({
      request: new Request("https://preview.inshell.art/api/pulse-auction"),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as { bids?: Array<{ key: string }> };

    expect(response.status).toBe(200);
    expect(payload.bids?.map((bid) => bid.key)).toEqual(["tx:cached"]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-chain-cache-source")).toBe("d1");
    expect(response.headers.get("x-db-read")).toBe("1");
    expect(response.headers.get("x-live-rpc-calls")).toBe("0");
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

  test("writes changed snapshots to D1 read model", async () => {
    const d1 = createD1Mock();
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
    const diagnostics = createChainCacheDiagnostics("d1-write-test");

    await writeSnapshot(
      {
        request: { url: "https://preview.inshell.art/api/path-tokens" } as Request,
        env: { INSHELL_CHAIN_DATA_DB: d1.db },
        waitUntil: (promise) => {
          waited.push(promise);
        },
      },
      "d1-write-test",
      next,
      0,
      diagnostics,
      previous,
    );
    await Promise.all(waited);
    const stored = JSON.parse(d1.rows.get("d1-write-test") ?? "{}") as IndexedSnapshot<{ id: string }>;

    expect(stored.lastScannedBlock).toBe(20);
    expect(diagnostics.dbWrite).toBe(1);
  });

  test("public tx refresh updates the pulse auction read model", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const txHash = `0x${"abc".padStart(64, "0")}`;
    const d1 = createD1Mock({
      "pulse-auction:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PULSE_AUCTION,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
      };
      if (body.method === "eth_getTransactionReceipt") {
        return rpcResponse({
          transactionHash: txHash,
          to: PULSE_AUCTION,
          blockNumber: "0xa5a7ec",
          status: "0x1",
        });
      }
      if (body.method === "eth_blockNumber") {
        return rpcResponse("0xa5a7ef");
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([
          {
            address: PULSE_AUCTION,
            blockNumber: "0xa5a7ec",
            data: `0x${word(12n)}${word(1_780_000_000n)}${word(1_779_000_000n)}${word(3n)}`,
            logIndex: "0x2",
            topics: [PULSE_SALE_TOPIC, addressTopic(OWNER), tokenTopic(1n)],
            transactionHash: txHash,
          },
        ]);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerRefreshPost({
      request: new Request("https://preview.inshell.art/api/indexer/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: "pulse-auction", tx: txHash }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as { ok?: boolean; results?: Array<{ items: number }> };
    const stored = JSON.parse(d1.rows.get("pulse-auction:v1:sepolia") ?? "{}") as {
      items?: Array<{ txHash?: string; amount?: { dec?: string } }>;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results?.[0]?.items).toBe(1);
    expect(stored.items?.[0]?.txHash).toBe(txHash);
    expect(stored.items?.[0]?.amount?.dec).toBe("12");
    expect(response.headers.get("x-live-rpc-calls")).toBe("3");
  });

  test("authenticated pulse auction refresh advances a bounded partial window", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const latestBlock = 10860050;
    const d1 = createD1Mock({
      "pulse-auction:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PULSE_AUCTION,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: any[];
      };
      if (body.method === "eth_blockNumber") {
        return rpcResponse(`0x${latestBlock.toString(16)}`);
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([]);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerRefreshPost({
      request: new Request("https://preview.inshell.art/api/indexer/refresh?target=pulse-auction", {
        method: "POST",
        headers: { authorization: "Bearer secret-token" },
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        INDEXER_REFRESH_MAX_LOG_CHUNKS: "2",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      results?: Array<{
        complete?: boolean;
        partial?: boolean;
        scannedFromBlock?: number;
        scannedToBlock?: number;
        latestBlock?: number;
        remainingBlocks?: number;
        maxBlocks?: number;
      }>;
    };
    const stored = JSON.parse(d1.rows.get("pulse-auction:v1:sepolia") ?? "{}") as {
      lastScannedBlock?: number;
    };
    const ranges = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String((init as any)?.body ?? "{}")))
      .filter((body) => body.method === "eth_getLogs")
      .map((body) => [body.params?.[0]?.fromBlock, body.params?.[0]?.toBlock]);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results?.[0]).toMatchObject({
      complete: false,
      partial: true,
      scannedFromBlock: 10859998,
      scannedToBlock: 10860017,
      latestBlock,
      remainingBlocks: 33,
      maxBlocks: 20,
    });
    expect(stored.lastScannedBlock).toBe(10860017);
    expect(ranges).toEqual([
      ["0xa5b5de", "0xa5b5e7"],
      ["0xa5b5e8", "0xa5b5f1"],
    ]);
    expect(response.headers.get("x-live-rpc-calls")).toBe("3");
  });

  test("authenticated path token refresh preserves untouched items without historical eth_call fanout", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const latestBlock = 10860050;
    const existingItems = Array.from({ length: 25 }, (_, index) => ({
      tokenId: String(index + 1),
      tokenIdLabel: String(index + 1),
      owner: OWNER,
      tokenUri: index === 0 ? "" : `data:application/json,${encodeURIComponent("{}")}`,
      metadata: {},
      blockNumber: 10859000 + index,
      txHash: `0x${String(index + 1).padStart(64, "0")}`,
    }));
    const d1 = createD1Mock({
      "path-tokens:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PATH_NFT,
        fromBlock: 10854121,
        lastScannedBlock: 10860000,
        items: existingItems,
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_blockNumber") {
        return rpcResponse(`0x${latestBlock.toString(16)}`);
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([]);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerRefreshPost({
      request: new Request("https://preview.inshell.art/api/indexer/refresh?target=path-tokens", {
        method: "POST",
        headers: { authorization: "Bearer secret-token" },
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        INDEXER_REFRESH_MAX_LOG_CHUNKS: "2",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      results?: Array<{ partial?: boolean; scannedToBlock?: number; items?: number }>;
    };
    const stored = JSON.parse(d1.rows.get("path-tokens:v1:sepolia") ?? "{}") as {
      lastScannedBlock?: number;
      items?: Array<{ tokenId?: string; tokenUri?: string }>;
    };
    const methods = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as any)?.body ?? "{}")).method
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results?.[0]).toMatchObject({
      partial: true,
      scannedToBlock: 10860017,
      items: 25,
    });
    expect(stored.lastScannedBlock).toBe(10860017);
    expect(stored.items?.map((item) => item.tokenId)).toHaveLength(25);
    expect(stored.items?.[0]?.tokenUri).toBe("");
    expect(methods).toEqual(["eth_blockNumber", "eth_getLogs", "eth_getLogs"]);
  });

  test("authenticated refresh reports safe diagnostics for bounded getLogs failures", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const d1 = createD1Mock({
      "path-tokens:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PATH_NFT,
        fromBlock: 10854121,
        lastScannedBlock: 10860000,
        items: [],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_blockNumber") {
        return rpcResponse("0xa5b612");
      }
      if (body.method === "eth_getLogs") {
        return rpcError(400, "block range too large; token=upstream-secret");
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerRefreshPost({
      request: new Request("https://preview.inshell.art/api/indexer/refresh?target=path-tokens", {
        method: "POST",
        headers: { authorization: "Bearer secret-token" },
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        PATH_PRIMARY_RPC_LABEL: "path-primary-test",
        INDEXER_REFRESH_MAX_LOG_CHUNKS: "2",
      },
    });
    const payload = (await response.json()) as {
      error?: string;
      diagnostics?: {
        target?: string;
        stage?: string;
        upstreamLabel?: string;
        blockRange?: { fromBlock?: number; toBlock?: number };
        providerError?: { kind?: string; message?: string };
      };
    };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("indexer refresh failed");
    expect(payload.diagnostics).toMatchObject({
      target: "path-tokens",
      stage: "getLogs",
      upstreamLabel: "path-primary-test",
      blockRange: { fromBlock: 10859998, toBlock: 10860017 },
      providerError: { kind: "block-range" },
    });
    expect(payload.diagnostics?.providerError?.message).toContain("token=<redacted>");
    expect(response.body).not.toContain("upstream-secret");
  });

  test("authenticated thought gallery refresh advances a bounded partial window", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const latestBlock = 10874050;
    const d1 = createD1Mock({
      "thought-gallery:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: THOUGHT_NFT,
        fromBlock: 10872879,
        lastScannedBlock: 10874000,
        items: [
          {
            tokenId: 1,
            pathId: "24",
            minter: OWNER,
            textHash: "0xold",
            promptHash: "",
            provenanceHash: "0xold",
            thoughtSpecId: "0xold",
            thoughtSpecHash: "0xold",
            mintedAt: 1,
            rawText: "old thought",
            prompt: "",
            mode: "",
            provider: "",
            model: "",
            returnedText: "",
            returnedTextHash: "",
            provenanceJson: "",
            image: "",
            tokenUri: "",
            txHash: `0x${"1".padStart(64, "0")}`,
            blockNumber: 10873000,
          },
        ],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_blockNumber") {
        return rpcResponse(`0x${latestBlock.toString(16)}`);
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([]);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerRefreshPost({
      request: new Request("https://preview.inshell.art/api/indexer/refresh?target=thought-gallery", {
        method: "POST",
        headers: { authorization: "Bearer secret-token" },
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        THOUGHT_PRIMARY_RPC_UPSTREAM: "https://thought-rpc.example/sepolia",
        INDEXER_REFRESH_MAX_LOG_CHUNKS: "2",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      results?: Array<{ partial?: boolean; scannedToBlock?: number; items?: number }>;
    };
    const stored = JSON.parse(d1.rows.get("thought-gallery:v1:sepolia") ?? "{}") as {
      lastScannedBlock?: number;
      items?: Array<{ tokenId?: number; rawText?: string }>;
    };
    const methods = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as any)?.body ?? "{}")).method
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.results?.[0]).toMatchObject({
      partial: true,
      scannedToBlock: 10874017,
      items: 1,
    });
    expect(stored.lastScannedBlock).toBe(10874017);
    expect(stored.items).toEqual([
      expect.objectContaining({ tokenId: 1, rawText: "old thought" }),
    ]);
    expect(methods).toEqual(["eth_blockNumber", "eth_getLogs", "eth_getLogs"]);
  });

  test("protected indexer event updates the pulse auction read model", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const txHash = `0x${"def".padStart(64, "0")}`;
    const d1 = createD1Mock({
      "pulse-auction:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PULSE_AUCTION,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
      };
      if (body.method === "eth_getTransactionReceipt") {
        return rpcResponse({
          transactionHash: txHash,
          to: PULSE_AUCTION,
          blockNumber: "0xa5a7ec",
          status: "0x1",
        });
      }
      if (body.method === "eth_blockNumber") {
        return rpcResponse("0xa5a7ef");
      }
      if (body.method === "eth_getLogs") {
        return rpcResponse([
          {
            address: PULSE_AUCTION,
            blockNumber: "0xa5a7ec",
            data: `0x${word(12n)}${word(1_780_000_000n)}${word(1_779_000_000n)}${word(3n)}`,
            logIndex: "0x2",
            topics: [PULSE_SALE_TOPIC, addressTopic(OWNER), tokenTopic(1n)],
            transactionHash: txHash,
          },
        ]);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "pulse-auction",
          txHash,
          blockNumber: 10856428,
          logIndex: 2,
          contractAddress: PULSE_AUCTION,
          topic0: PULSE_SALE_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      applied?: boolean;
      eventStatus?: {
        persisted?: boolean;
        statusSource?: string;
        lastAcceptedAt?: string | null;
        error?: string | null;
      };
    };
    const stored = JSON.parse(d1.rows.get("pulse-auction:v1:sepolia") ?? "{}") as {
      items?: Array<{ txHash?: string; amount?: { dec?: string } }>;
    };
    const status = JSON.parse(
      d1.rows.get("indexer-event-ingest-status:v1:sepolia") ?? "{}",
    ) as {
      lastAcceptedAt?: string;
      lastAppliedTarget?: string;
      lastTxHash?: string;
      lastBlockNumber?: number;
      lastLogIndex?: number;
      lastResultApplied?: boolean;
      lastResultSource?: string;
      acceptedCount?: number;
      appliedCount?: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.applied).toBe(true);
    expect(stored.items?.[0]?.txHash).toBe(txHash);
    expect(stored.items?.[0]?.amount?.dec).toBe("12");
    expect(status.lastAcceptedAt).toEqual(expect.any(String));
    expect(status.lastAppliedTarget).toBe("pulse-auction");
    expect(status.lastTxHash).toBe(txHash);
    expect(status.lastBlockNumber).toBe(10856428);
    expect(status.lastLogIndex).toBe(2);
    expect(status.lastResultApplied).toBe(true);
    expect(status.lastResultSource).toBe("d1");
    expect(status.acceptedCount).toBe(1);
    expect(status.appliedCount).toBe(1);
    expect(payload.eventStatus?.persisted).toBe(true);
    expect(payload.eventStatus?.statusSource).toBe("d1");
    expect(payload.eventStatus?.lastAcceptedAt).toEqual(expect.any(String));
    expect(payload.eventStatus?.error).toBeNull();
    expect(response.headers.get("x-indexer-event-status-write")).toBe("1");
    expect(response.headers.get("x-indexer-event-status-source")).toBe("d1");
    expect(response.headers.get("x-live-rpc-calls")).toBe("3");
    expect(response.headers.get("x-db-write")).toBe("1");
  });

  test("protected indexer event updates path tokens read model", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const txHash = `0x${"abcde".padStart(64, "0")}`;
    const eventBlock = 10870000;
    const d1 = createD1Mock({
      "path-tokens:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PATH_NFT,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [
          {
            tokenId: "24",
            tokenIdLabel: "24",
            owner: OWNER,
            tokenUri: "",
            metadata: {},
            blockNumber: 10860000,
            txHash: `0x${"24".padStart(64, "0")}`,
          },
        ],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: any[];
      };
      if (body.method === "eth_getLogs") {
        const filter = body.params?.[0] ?? {};
        expect(filter.fromBlock).toBe(`0x${eventBlock.toString(16)}`);
        expect(filter.toBlock).toBe(`0x${eventBlock.toString(16)}`);
        return rpcResponse([
          {
            address: PATH_NFT,
            blockNumber: `0x${eventBlock.toString(16)}`,
            data: "0x",
            logIndex: "0x2",
            topics: [TRANSFER_TOPIC, ZERO_TOPIC, addressTopic(OWNER), tokenTopic(25n)],
            transactionHash: txHash,
          },
        ]);
      }
      if (body.method === "eth_call") {
        return rpcResponse(`0x${"00".repeat(32)}`);
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "path-tokens",
          txHash,
          blockNumber: eventBlock,
          logIndex: 2,
          contractAddress: PATH_NFT,
          topic0: TRANSFER_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      target?: string;
      applied?: boolean;
      eventStatus?: { persisted?: boolean; statusSource?: string };
    };
    const pathStored = JSON.parse(d1.rows.get("path-tokens:v1:sepolia") ?? "{}") as {
      lastScannedBlock?: number;
      items?: Array<{ tokenId?: string; txHash?: string }>;
    };
    const methods = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as any)?.body ?? "{}")).method
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.target).toBe("path-tokens");
    expect(payload.applied).toBe(true);
    expect(pathStored.items?.map((item) => item.tokenId)).toEqual(["24", "25"]);
    expect(pathStored.items?.find((item) => item.tokenId === "25")?.txHash).toBe(txHash);
    expect(pathStored.lastScannedBlock).toBe(10860000);
    expect(methods).not.toContain("eth_blockNumber");
    expect(response.headers.get("x-indexer-event-status-write")).toBe("1");
    expect(response.headers.get("x-indexer-event-status-source")).toBe("d1");
    expect(response.headers.get("x-db-write")).toBe("1");
  });

  test("protected indexer event updates thought gallery read model", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const txHash = `0x${"def".padStart(64, "0")}`;
    const eventBlock = 10873000;
    const provenanceJson = JSON.stringify({
      prompt: "test prompt",
      route: "direct",
      provider: "test",
      model: "test-model",
      output: { returnedText: "returned" },
      hashes: { promptHash: "0xprompt", returnedTextHash: "0xreturned" },
    });
    const tokenUri = JSON.stringify({
      image: "data:image/svg+xml,<svg />",
      properties: {
        rawText: "minted thought",
        provenanceJson,
      },
    });
    const d1 = createD1Mock({
      "thought-gallery:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: THOUGHT_NFT,
        fromBlock: 10872879,
        lastScannedBlock: 10873000,
        items: [
          {
            tokenId: 1,
            pathId: "24",
            minter: OWNER,
            textHash: "0xold",
            promptHash: "",
            provenanceHash: "0xold",
            thoughtSpecId: "0xold",
            thoughtSpecHash: "0xold",
            mintedAt: 1,
            rawText: "old thought",
            prompt: "",
            mode: "",
            provider: "",
            model: "",
            returnedText: "",
            returnedTextHash: "",
            provenanceJson: "",
            image: "",
            tokenUri: "",
            txHash: `0x${"1".padStart(64, "0")}`,
            blockNumber: 10873000,
          },
        ],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: any[];
      };
      if (body.method === "eth_getLogs") {
        const filter = body.params?.[0] ?? {};
        expect(filter.fromBlock).toBe(`0x${eventBlock.toString(16)}`);
        expect(filter.toBlock).toBe(`0x${eventBlock.toString(16)}`);
        return rpcResponse([
          {
            address: THOUGHT_NFT,
            blockNumber: `0x${eventBlock.toString(16)}`,
            data: `0x${[
              "aa".repeat(32),
              "bb".repeat(32),
              "cc".repeat(32),
              "dd".repeat(32),
              word(1_780_000_000n),
            ].join("")}`,
            logIndex: "0x2",
            topics: [THOUGHT_MINTED_TOPIC, tokenTopic(2n), addressTopic(OWNER), tokenTopic(25n)],
            transactionHash: txHash,
          },
        ]);
      }
      if (body.method === "eth_call") {
        return rpcResponse(encodeStringResult(tokenUri));
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "thought-gallery",
          txHash,
          blockNumber: eventBlock,
          logIndex: 2,
          contractAddress: THOUGHT_NFT,
          topic0: THOUGHT_MINTED_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        THOUGHT_PRIMARY_RPC_UPSTREAM: "https://thought-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      target?: string;
      applied?: boolean;
      eventStatus?: { persisted?: boolean; statusSource?: string; acceptedCount?: number };
    };
    const thoughtStored = JSON.parse(d1.rows.get("thought-gallery:v1:sepolia") ?? "{}") as {
      contract?: string;
      lastScannedBlock?: number;
      items?: Array<{ tokenId?: number; pathId?: string; rawText?: string; txHash?: string }>;
    };
    const methods = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as any)?.body ?? "{}")).method
    );

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.target).toBe("thought-gallery");
    expect(payload.applied).toBe(true);
    expect(payload.eventStatus?.persisted).toBe(true);
    expect(payload.eventStatus?.statusSource).toBe("d1");
    expect(payload.eventStatus?.acceptedCount).toBe(1);
    expect(thoughtStored.contract).toBe(THOUGHT_NFT);
    expect(thoughtStored.lastScannedBlock).toBe(10873000);
    expect(thoughtStored.items?.map((item) => item.tokenId)).toEqual([1, 2]);
    expect(thoughtStored.items?.find((item) => item.tokenId === 2)).toMatchObject({
      pathId: "25",
      rawText: "minted thought",
      txHash,
    });
    expect(methods).not.toContain("eth_blockNumber");
    expect(response.headers.get("x-indexer-event-status-write")).toBe("1");
    expect(response.headers.get("x-indexer-event-status-source")).toBe("d1");
    expect(response.headers.get("x-db-write")).toBe("1");
  });

  test("indexer event requires refresh token", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const fetchMock = jest.fn(async () => {
      throw new Error("live RPC should not be called without indexer auth");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "pulse-auction",
          txHash: `0x${"123".padStart(64, "0")}`,
          blockNumber: 10856428,
          logIndex: 2,
          contractAddress: PULSE_AUCTION,
          topic0: PULSE_SALE_TOPIC,
        }),
      }),
      env: {
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
      },
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("indexer event token required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("indexer event reports safe diagnostics for targeted getLogs failures", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const txHash = `0x${"bad".padStart(64, "0")}`;
    const d1 = createD1Mock({
      "path-tokens:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PATH_NFT,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async (_url: unknown, init?: any) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "eth_getLogs") {
        return rpcError(400, "block range too large; token=upstream-secret");
      }
      throw new Error(`unexpected RPC method ${body.method}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "path-tokens",
          txHash,
          blockNumber: 10870000,
          logIndex: 2,
          contractAddress: PATH_NFT,
          topic0: TRANSFER_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        PATH_PRIMARY_RPC_LABEL: "path-primary-test",
      },
    });
    const payload = (await response.json()) as {
      error?: string;
      diagnostics?: {
        target?: string;
        stage?: string;
        upstreamLabel?: string;
        blockRange?: { fromBlock?: number; toBlock?: number };
        providerError?: { kind?: string; message?: string };
      };
    };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("indexer event failed");
    expect(payload.diagnostics).toMatchObject({
      target: "path-tokens",
      stage: "getLogs",
      upstreamLabel: "path-primary-test",
      blockRange: { fromBlock: 10870000, toBlock: 10870000 },
      providerError: { kind: "block-range" },
    });
    expect(payload.diagnostics?.providerError?.message).toContain("token=<redacted>");
    expect(response.body).not.toContain("upstream-secret");
  });

  test("indexer event dedupes already indexed transactions and status counters without RPC", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const txHash = `0x${"fed".padStart(64, "0")}`;
    const d1 = createD1Mock({
      "pulse-auction:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PULSE_AUCTION,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [
          {
            key: `sale:${txHash}:2`,
            txHash,
            atMs: 1_780_000_000_000,
            amount: { raw: { low: "12", high: "0" }, dec: "12" },
          },
        ],
      } satisfies IndexedSnapshot<unknown>,
    });
    const fetchMock = jest.fn(async () => {
      throw new Error("live RPC should not be called for an already indexed tx");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const postEvent = () =>
      onIndexerEventPost({
        request: new Request("https://preview.inshell.art/api/indexer/event", {
          method: "POST",
          headers: {
            authorization: "Bearer secret-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            version: 1,
            source: "ops-chain-event-ingress",
            network: "sepolia",
            target: "pulse-auction",
            txHash,
            blockNumber: 10856428,
            logIndex: 2,
            contractAddress: PULSE_AUCTION,
            topic0: PULSE_SALE_TOPIC,
          }),
        }),
        env: {
          INSHELL_CHAIN_DATA_DB: d1.db,
          INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
          PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
          CHAIN_CACHE_DIAGNOSTICS: "1",
        },
      });

    const firstResponse = await postEvent();
    const firstPayload = (await firstResponse.json()) as {
      ok?: boolean;
      applied?: boolean;
      eventStatus?: {
        duplicate?: boolean;
        lastAcceptedAt?: string | null;
        acceptedCount?: number;
        appliedCount?: number;
      };
    };
    const response = await postEvent();
    const payload = (await response.json()) as {
      ok?: boolean;
      applied?: boolean;
      eventStatus?: {
        duplicate?: boolean;
        lastAcceptedAt?: string | null;
        acceptedCount?: number;
        appliedCount?: number;
      };
    };
    const status = JSON.parse(
      d1.rows.get("indexer-event-ingest-status:v1:sepolia") ?? "{}",
    ) as {
      acceptedCount?: number;
      appliedCount?: number;
      recentEventIds?: string[];
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPayload.ok).toBe(true);
    expect(firstPayload.applied).toBe(true);
    expect(firstPayload.eventStatus?.duplicate).toBe(false);
    expect(firstPayload.eventStatus?.acceptedCount).toBe(1);
    expect(firstPayload.eventStatus?.appliedCount).toBe(1);
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.applied).toBe(true);
    expect(payload.eventStatus?.duplicate).toBe(true);
    expect(payload.eventStatus?.lastAcceptedAt).toBe(firstPayload.eventStatus?.lastAcceptedAt);
    expect(payload.eventStatus?.acceptedCount).toBe(1);
    expect(payload.eventStatus?.appliedCount).toBe(1);
    expect(status.acceptedCount).toBe(1);
    expect(status.appliedCount).toBe(1);
    expect(status.recentEventIds).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(firstResponse.headers.get("x-chain-cache-source")).toBe("d1");
    expect(response.headers.get("x-chain-cache-source")).toBe("memory");
    expect(response.headers.get("x-live-rpc-calls")).toBe("0");
  });

  test("indexer event dedupes legacy status rows without recent event ids", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const txHash = `0x${"fed".padStart(64, "0")}`;
    const lastAcceptedAt = "2026-06-18T10:32:05.275Z";
    const d1 = createD1Mock({
      "pulse-auction:v1:sepolia": {
        version: 1,
        cachedAt: Date.now() - 120_000,
        chainId: 11155111,
        contract: PULSE_AUCTION,
        fromBlock: 10854123,
        lastScannedBlock: 10860000,
        items: [
          {
            key: `sale:${txHash}:2`,
            txHash,
            atMs: 1_780_000_000_000,
            amount: { raw: { low: "12", high: "0" }, dec: "12" },
          },
        ],
      } satisfies IndexedSnapshot<unknown>,
      "indexer-event-ingest-status:v1:sepolia": {
        version: 1,
        updatedAt: lastAcceptedAt,
        lastAcceptedAt,
        lastAppliedAt: lastAcceptedAt,
        lastAppliedTarget: "pulse-auction",
        lastTxHash: txHash,
        lastBlockNumber: 10856428,
        lastLogIndex: 2,
        lastResultApplied: true,
        lastResultSource: "d1",
        cachedAt: 1_780_000_000_000,
        lastScannedBlock: 10860000,
        acceptedCount: 9,
        appliedCount: 9,
      },
    });
    const fetchMock = jest.fn(async () => {
      throw new Error("live RPC should not be called for an already indexed tx");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "pulse-auction",
          txHash,
          blockNumber: 10856428,
          logIndex: 2,
          contractAddress: PULSE_AUCTION,
          topic0: PULSE_SALE_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      applied?: boolean;
      eventStatus?: {
        duplicate?: boolean;
        lastAcceptedAt?: string | null;
        acceptedCount?: number;
        appliedCount?: number;
      };
    };
    const status = JSON.parse(
      d1.rows.get("indexer-event-ingest-status:v1:sepolia") ?? "{}",
    ) as {
      lastAcceptedAt?: string;
      acceptedCount?: number;
      appliedCount?: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.applied).toBe(true);
    expect(payload.eventStatus?.duplicate).toBe(true);
    expect(payload.eventStatus?.lastAcceptedAt).toBe(lastAcceptedAt);
    expect(payload.eventStatus?.acceptedCount).toBe(9);
    expect(payload.eventStatus?.appliedCount).toBe(9);
    expect(status.lastAcceptedAt).toBe(lastAcceptedAt);
    expect(status.acceptedCount).toBe(9);
    expect(status.appliedCount).toBe(9);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("indexer event reports marker persistence failure without hiding ingest success", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    (globalThis as any).caches = undefined;
    const txHash = `0x${"abc".padStart(64, "0")}`;
    const d1 = createD1Mock(
      {
        "pulse-auction:v1:sepolia": {
          version: 1,
          cachedAt: Date.now() - 120_000,
          chainId: 11155111,
          contract: PULSE_AUCTION,
          fromBlock: 10854123,
          lastScannedBlock: 10860000,
          items: [
            {
              key: `sale:${txHash}:2`,
              txHash,
              atMs: 1_780_000_000_000,
              amount: { raw: { low: "12", high: "0" }, dec: "12" },
            },
          ],
        } satisfies IndexedSnapshot<unknown>,
      },
      { failWritesForKeys: ["indexer-event-ingest-status:v1:sepolia"] },
    );
    const fetchMock = jest.fn(async () => {
      throw new Error("live RPC should not be called for an already indexed tx");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await onIndexerEventPost({
      request: new Request("https://preview.inshell.art/api/indexer/event", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          version: 1,
          source: "ops-chain-event-ingress",
          network: "sepolia",
          target: "pulse-auction",
          txHash,
          blockNumber: 10856428,
          logIndex: 2,
          contractAddress: PULSE_AUCTION,
          topic0: PULSE_SALE_TOPIC,
        }),
      }),
      env: {
        INSHELL_CHAIN_DATA_DB: d1.db,
        INSHELL_INDEXER_REFRESH_TOKEN: "secret-token",
        PATH_PRIMARY_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
        CHAIN_CACHE_DIAGNOSTICS: "1",
      },
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      applied?: boolean;
      eventStatus?: { persisted?: boolean; statusSource?: string; error?: string | null };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.applied).toBe(true);
    expect(payload.eventStatus?.persisted).toBe(false);
    expect(payload.eventStatus?.statusSource).toBe("error");
    expect(payload.eventStatus?.error).toContain("forced D1 write failure");
    expect(response.headers.get("x-indexer-event-status-write")).toBe("0");
    expect(response.headers.get("x-indexer-event-status-source")).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("ops status advertises event-driven indexer ingest state", async () => {
    globalThis.Request = TestRequest as unknown as typeof Request;
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    const d1 = createD1Mock({
      "indexer-event-ingest-status:v1:sepolia": {
        version: 1,
        updatedAt: "2026-06-16T11:00:00.000Z",
        lastAcceptedAt: "2026-06-16T11:00:00.000Z",
        lastAppliedAt: "2026-06-16T11:00:00.000Z",
        lastAppliedTarget: "pulse-auction",
        lastTxHash: `0x${"456".padStart(64, "0")}`,
        lastBlockNumber: 10856428,
        lastLogIndex: 2,
        lastResultApplied: true,
        lastResultSource: "d1",
        cachedAt: 1_781_000_000_000,
        lastScannedBlock: 10856500,
        acceptedCount: 3,
        appliedCount: 2,
      },
    });

    const response = await onOpsStatusGet({
      request: new Request("https://preview.inshell.art/api/ops/status"),
      env: { INSHELL_CHAIN_DATA_DB: d1.db },
    });
    const payload = (await response.json()) as {
      routes?: { event?: { route?: string; targets?: string[] } };
      indexerEventIngest?: {
        enabled?: boolean;
        route?: string;
        targets?: string[];
        statusSource?: string;
        lastAcceptedAt?: string | null;
        lastAppliedAt?: string | null;
        lastAppliedTarget?: string | null;
        lastTxHash?: string | null;
        acceptedCount?: number;
        appliedCount?: number;
        statusError?: string | null;
      };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload.routes?.event?.route).toBe("/api/indexer/event");
    expect(payload.routes?.event?.targets).toEqual(["pulse-auction", "path-tokens", "thought-gallery"]);
    expect(payload.indexerEventIngest?.enabled).toBe(true);
    expect(payload.indexerEventIngest?.route).toBe("/api/indexer/event");
    expect(payload.indexerEventIngest?.targets).toEqual(["pulse-auction", "path-tokens", "thought-gallery"]);
    expect(payload.indexerEventIngest?.statusSource).toBe("d1");
    expect(payload.indexerEventIngest?.statusError).toBeNull();
    expect(payload.indexerEventIngest?.lastAcceptedAt).toBe("2026-06-16T11:00:00.000Z");
    expect(payload.indexerEventIngest?.lastAppliedAt).toBe("2026-06-16T11:00:00.000Z");
    expect(payload.indexerEventIngest?.lastAppliedTarget).toBe("pulse-auction");
    expect(payload.indexerEventIngest?.lastTxHash).toBe(`0x${"456".padStart(64, "0")}`);
    expect(payload.indexerEventIngest?.acceptedCount).toBe(3);
    expect(payload.indexerEventIngest?.appliedCount).toBe(2);
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
    expect(image.body).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960"/>');
    expect(kvGet).toHaveBeenCalledWith("thought-gallery:v1:sepolia", "json");
  });
});

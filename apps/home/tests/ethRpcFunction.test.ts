import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  __clearRpcProxyCachesForTests,
  onRequestPost as onFallbackRpcPost,
} from "../../../functions/api/eth-rpc";
import { onRequestPost as onPathRpcPost } from "../../../functions/api/path-rpc";

type MockFetchResponse = {
  status: number;
  text: () => Promise<string>;
};

const originalFetch = globalThis.fetch;
const originalResponse = globalThis.Response;

class TestResponse {
  status: number;
  headers: unknown;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers = init?.headers;
    this.bodyText = typeof body === "string" ? body : "";
  }

  async text(): Promise<string> {
    return this.bodyText;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

function rpcRequest(payload: unknown): Request {
  return {
    text: async () => JSON.stringify(payload),
  } as Request;
}

function postRpc(payload: unknown): Promise<Response> {
  return onFallbackRpcPost({
    request: rpcRequest(payload),
    env: {
      ETH_RPC_UPSTREAM: "https://rpc.example/sepolia",
    },
  });
}

function postPathRpc(payload: unknown): Promise<Response> {
  return onPathRpcPost({
    request: rpcRequest(payload),
    env: {
      PATH_RPC_UPSTREAM: "https://path-rpc.example/sepolia",
      ETH_RPC_UPSTREAM: "https://fallback-rpc.example/sepolia",
    },
  });
}

describe("Cloudflare Ethereum RPC proxy", () => {
  beforeEach(() => {
    globalThis.Response = TestResponse as unknown as typeof Response;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.Response = originalResponse;
    __clearRpcProxyCachesForTests();
    jest.restoreAllMocks();
  });

  test("caches safe single-call RPC results and rewrites the response id", async () => {
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(async () => ({
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const first = await postRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_chainId",
      params: [],
    });
    const second = await postRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "eth_chainId",
      params: [],
    });

    await expect(first.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "0xaa36a7",
    });
    await expect(second.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: "0xaa36a7",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("serves stale safe-call data when the upstream is temporarily rate-limited", async () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(0);
    const fetchMock = jest
      .fn<() => Promise<MockFetchResponse>>()
      .mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1234" }),
      })
      .mockResolvedValue({
        status: 429,
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            error: { code: 429, message: "Too Many Requests" },
          }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const call = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: "0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39", data: "0x1234" }, "latest"],
    };

    await expect((await postRpc(call)).json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "0x1234",
    });

    nowSpy.mockReturnValue(3_000);
    await expect(
      (
        await postRpc({
          ...call,
          id: 2,
        })
      ).json()
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: "0x1234",
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("retries a transient upstream 429 before returning the RPC result", async () => {
    const fetchMock = jest
      .fn<() => Promise<MockFetchResponse>>()
      .mockResolvedValueOnce({
        status: 429,
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: 429, message: "Too Many Requests" },
          }),
      })
      .mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xaa36a7" }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      (
        await postRpc({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        })
      ).json()
    ).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "0xaa36a7",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("caches numbered block reads for sale timestamp lookups", async () => {
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { number: "0x123", timestamp: "0x6818f240" },
        }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const call = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBlockByNumber",
      params: ["0x123", false],
    };
    const first = await postRpc(call);
    const second = await postRpc({
      ...call,
      id: 2,
    });

    await expect(first.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { number: "0x123", timestamp: "0x6818f240" },
    });
    await expect(second.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: { number: "0x123", timestamp: "0x6818f240" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("coalesces concurrent safe single-call RPC requests", async () => {
    let resolveFetch: ((value: MockFetchResponse) => void) | undefined;
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const call = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    };
    const first = postRpc(call);
    const second = postRpc({ ...call, id: 2 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.({
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x123" }),
    });

    await expect((await first).json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "0x123",
    });
    await expect((await second).json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 2,
      result: "0x123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("rejects broad legacy eth_getLogs access", async () => {
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await postRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D",
          fromBlock: "0x1",
          toBlock: "0xa",
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
        },
      ],
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "RPC method is not allowed: eth_getLogs",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("routes PATH logs through the PATH upstream and chunks provider calls", async () => {
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(async () => ({
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: [] }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await postPathRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: "0x84915746a1f06850CF41a3E90C60c2DcA3fa116D",
          fromBlock: "0x1",
          toBlock: "0x14",
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"],
        },
      ],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => url === "https://path-rpc.example/sepolia")).toBe(true);
  });
});

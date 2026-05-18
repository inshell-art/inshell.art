import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { onRequestPost } from "../../../functions/api/eth-rpc";

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
  return onRequestPost({
    request: rpcRequest(payload),
    env: {
      ETH_RPC_UPSTREAM: "https://rpc.example/sepolia",
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
      params: [{ to: "0x0000000000000000000000000000000000000001", data: "0x1234" }, "latest"],
    };

    await expect((await postRpc(call)).json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: "0x1234",
    });

    nowSpy.mockReturnValue(1_000);
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
});

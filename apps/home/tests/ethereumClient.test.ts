import { describe, expect, jest, test, afterEach } from "@jest/globals";
import { getDefaultProvider, getLogs, JsonRpcProvider } from "@inshell/ethereum";

function providerRpcUrl() {
  return (getDefaultProvider() as any).rpcUrl as string;
}

type MockFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

describe("Ethereum client production RPC guard", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    delete (globalThis as any).__VITE_ENV__;
    globalThis.fetch = originalFetch;
  });

  test("uses explicit VITE_PATH_RPC_URL when configured", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_PATH_RPC_URL: "https://path-rpc.example/sepolia",
    };

    expect(providerRpcUrl()).toBe("https://path-rpc.example/sepolia");
  });

  test("keeps legacy VITE_ETH_RPC as a migration fallback", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_ETH_RPC: "https://legacy-rpc.example/sepolia",
    };

    expect(providerRpcUrl()).toBe("https://legacy-rpc.example/sepolia");
  });

  test("allows same-origin RPC proxy URL for production deployments", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_PATH_RPC_URL: "/api/path-rpc",
    };

    expect(providerRpcUrl()).toBe("/api/path-rpc");
  });

  test("allows localhost RPC fallback only for local development", () => {
    delete (globalThis as any).__VITE_ENV__;

    expect(providerRpcUrl()).toBe("http://127.0.0.1:8546");
  });

  test("uses same-origin RPC proxy for Sepolia launch modes without a public RPC", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
    };

    expect(providerRpcUrl()).toBe("/api/path-rpc");
  });

  test("uses same-origin RPC proxy for production launch mode without a public RPC", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_PUBLIC_LAUNCH_MODE: "production",
    };

    expect(providerRpcUrl()).toBe("/api/path-rpc");
  });

  test("surfaces empty RPC responses with method context", async () => {
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new JsonRpcProvider("/api/eth-rpc");

    await expect(provider.request({ method: "eth_getLogs", params: [] })).rejects.toThrow(
      "RPC request returned an empty response for eth_getLogs."
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("retries transient empty RPC responses", async () => {
    const fetchMock = jest
      .fn<() => Promise<MockFetchResponse>>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      })
      .mockResolvedValueOnce(
        {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x7b" }),
        }
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new JsonRpcProvider("/api/eth-rpc");

    await expect(provider.request({ method: "eth_blockNumber", params: [] })).resolves.toBe(
      "0x7b"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("sends eth_getLogs topic0 as a flat allowed topic", async () => {
    const topic0 =
      "0xa789468a0212cbe853fbdd6011d2ee7d85144ebc1d67c7dd82f087a970d9593d";
    const fetchMock = jest.fn<() => Promise<MockFetchResponse>>(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result: [] }),
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const provider = new JsonRpcProvider("/api/path-rpc");

    await expect(
      getLogs(provider, {
        address: "0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39",
        fromBlock: 10854123,
        toBlock: 10859122,
        topics: [topic0],
      })
    ).resolves.toEqual([]);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}"));
    expect(body.params[0].topics).toEqual([topic0]);
  });
});

import { describe, expect, jest, test, afterEach } from "@jest/globals";
import { getDefaultProvider, JsonRpcProvider } from "@inshell/ethereum";

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

  test("uses explicit VITE_ETH_RPC when configured", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_ETH_RPC: "https://rpc.example/sepolia",
    };

    expect(providerRpcUrl()).toBe("https://rpc.example/sepolia");
  });

  test("allows same-origin RPC proxy URL for production deployments", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_ETH_RPC: "/api/path-rpc",
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
});

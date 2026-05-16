import { describe, expect, jest, test, afterEach } from "@jest/globals";
import { getDefaultProvider, JsonRpcProvider } from "@inshell/ethereum";

function providerRpcUrl() {
  return (getDefaultProvider() as any).rpcUrl as string;
}

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
      VITE_ETH_RPC: "/api/eth-rpc",
    };

    expect(providerRpcUrl()).toBe("/api/eth-rpc");
  });

  test("allows localhost RPC fallback only for local development", () => {
    delete (globalThis as any).__VITE_ENV__;

    expect(providerRpcUrl()).toBe("http://127.0.0.1:8546");
  });

  test("rejects missing RPC for Sepolia launch modes", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
    };

    expect(() => getDefaultProvider()).toThrow(
      "VITE_ETH_RPC is required outside local development.",
    );
  });

  test("surfaces empty RPC responses with method context", async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    })) as any;

    const provider = new JsonRpcProvider("/api/eth-rpc");

    await expect(provider.request({ method: "eth_getLogs", params: [] })).rejects.toThrow(
      "RPC request returned an empty response for eth_getLogs."
    );
  });
});

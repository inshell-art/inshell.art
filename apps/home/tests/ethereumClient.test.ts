import { describe, expect, test, afterEach } from "@jest/globals";
import { getDefaultProvider } from "@inshell/ethereum";

function providerRpcUrl() {
  return (getDefaultProvider() as any).rpcUrl as string;
}

describe("Ethereum client production RPC guard", () => {
  afterEach(() => {
    delete (globalThis as any).__VITE_ENV__;
  });

  test("uses explicit VITE_ETH_RPC when configured", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_ETH_RPC: "https://rpc.example/sepolia",
    };

    expect(providerRpcUrl()).toBe("https://rpc.example/sepolia");
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
});

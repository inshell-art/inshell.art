import { describe, expect, test, afterEach, jest } from "@jest/globals";
import {
  EIP6963_ANNOUNCE_EVENT,
  EIP6963_REQUEST_EVENT,
  discoverEip6963Providers,
  fallbackWindowEthereumProviders,
  readWalletConnectProjectId,
  walletConnectMetadata,
  walletConnectEnabled,
  type Eip1193Provider,
} from "@inshell/wallet";

function mockProvider(flags: Record<string, unknown> = {}) {
  return {
    ...flags,
    request: jest.fn(),
  } as unknown as Eip1193Provider;
}

describe("wallet EVM transport helpers", () => {
  afterEach(() => {
    delete (window as any).ethereum;
  });

  test("EIP-6963 discovery collects multiple announced injected providers", async () => {
    const metamask = mockProvider();
    const rabby = mockProvider();
    const onRequest = () => {
      window.dispatchEvent(
        new globalThis.CustomEvent(EIP6963_ANNOUNCE_EVENT, {
          detail: {
            info: { uuid: "mm", name: "MetaMask", rdns: "io.metamask" },
            provider: metamask,
          },
        }),
      );
      window.dispatchEvent(
        new globalThis.CustomEvent(EIP6963_ANNOUNCE_EVENT, {
          detail: {
            info: { uuid: "rabby", name: "Rabby", rdns: "io.rabby" },
            provider: rabby,
          },
        }),
      );
    };
    window.addEventListener(EIP6963_REQUEST_EVENT, onRequest);

    const providers = await discoverEip6963Providers(0);

    window.removeEventListener(EIP6963_REQUEST_EVENT, onRequest);
    expect(providers.map((provider) => provider.info.name)).toEqual([
      "MetaMask",
      "Rabby",
    ]);
  });

  test("window.ethereum.providers fallback keeps MetaMask and Rabby separate", () => {
    (window as any).ethereum = {
      providers: [
        mockProvider({ isRabby: true }),
        mockProvider({ isMetaMask: true }),
      ],
    };

    const providers = fallbackWindowEthereumProviders();

    expect(providers.map((provider) => provider.info.name)).toEqual([
      "MetaMask",
      "Rabby",
    ]);
  });

  test("WalletConnect project id is public env config and trims whitespace", () => {
    const env = (name: string) =>
      name === "VITE_WALLETCONNECT_PROJECT_ID" ? " project-id " : "";

    expect(readWalletConnectProjectId(env)).toBe("project-id");
    expect(walletConnectEnabled(env)).toBe(true);
    expect(walletConnectEnabled(() => "")).toBe(false);
  });

  test("WalletConnect metadata uses public HTTPS URL on localhost", () => {
    expect(walletConnectMetadata("home").url).toBe("https://inshell.art");
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  EIP6963_ANNOUNCE_EVENT,
  EIP6963_REQUEST_EVENT,
  WalletProvider,
  useWallet,
} from "@inshell/wallet";

const RABBY_ADDRESS = "0x1111111111111111111111111111111111111111";
const NEXT_ADDRESS = "0x2222222222222222222222222222222222222222";
const METAMASK_ADDRESS = "0x3333333333333333333333333333333333333333";

function connectRequestMock(address = RABBY_ADDRESS, chainId = "0xaa36a7") {
  return jest.fn(async ({ method }: { method: string }) => {
    if (method === "eth_requestAccounts" || method === "eth_accounts") {
      return [address];
    }
    if (method === "eth_chainId") return chainId;
    throw new Error(`unexpected wallet request: ${method}`);
  });
}

function ConnectorHarness() {
  const wallet = useWallet();
  return (
    <>
      {wallet.connectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          onClick={() => void wallet.connectAsync({ connector })}
        >
          connect {connector.name}
        </button>
      ))}
      <output data-testid="wallet-address">{wallet.address ?? "none"}</output>
      <output data-testid="wallet-chain">{wallet.chainId ?? "none"}</output>
      <output data-testid="wallet-provider">{wallet.evm.providerName ?? "none"}</output>
    </>
  );
}

describe("WalletProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("inshell.wallet.soft-disconnected.v1", "1");
  });

  afterEach(() => {
    delete (window as typeof window & { ethereum?: unknown }).ethereum;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("refreshConnectors discovers a Rabby provider announced after mount", async () => {
    const rabbyProvider = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: jest.fn(),
    };
    let announceRabby = false;
    const onProviderRequest = () => {
      if (!announceRabby) return;
      window.dispatchEvent(
        new globalThis.CustomEvent(EIP6963_ANNOUNCE_EVENT, {
          detail: {
            info: {
              uuid: "late-rabby",
              name: "Rabby Wallet",
              rdns: "io.rabby",
            },
            provider: rabbyProvider,
          },
        })
      );
    };
    window.addEventListener(EIP6963_REQUEST_EVENT, onProviderRequest);

    function Harness() {
      const wallet = useWallet();
      return (
        <>
          <button type="button" onClick={() => void wallet.refreshConnectors()}>
            refresh connectors
          </button>
          <output>{wallet.connectors.map((item) => item.name).join(",")}</output>
        </>
      );
    }

    render(
      <WalletProvider>
        <Harness />
      </WalletProvider>
    );

    expect(screen.queryByText(/Rabby Wallet/)).not.toBeInTheDocument();
    announceRabby = true;
    fireEvent.click(screen.getByRole("button", { name: "refresh connectors" }));

    await waitFor(() => {
      expect(screen.getByText(/Rabby Wallet/)).toBeInTheDocument();
    });
    window.removeEventListener(EIP6963_REQUEST_EVENT, onProviderRequest);
  });

  test("selecting dual-flag Rabby sends connection requests only to Rabby", async () => {
    const metamaskRequest = connectRequestMock(METAMASK_ADDRESS);
    const rabbyRequest = connectRequestMock();
    const metamaskProvider = {
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: metamaskRequest,
    };
    const rabbyProvider = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: rabbyRequest,
    };
    (window as typeof window & { ethereum?: unknown }).ethereum = {
      providers: [metamaskProvider, rabbyProvider],
      request: jest.fn(),
    };

    render(
      <WalletProvider>
        <ConnectorHarness />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "connect Rabby" }));

    await waitFor(() => {
      expect(screen.getByTestId("wallet-address")).toHaveTextContent(RABBY_ADDRESS);
    });
    expect(screen.getByTestId("wallet-provider")).toHaveTextContent("Rabby");
    expect(rabbyRequest.mock.calls.map(([request]) => request.method)).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
    ]);
    expect(metamaskRequest).not.toHaveBeenCalled();
  });

  test("ensureWalletConnected maps an EIP-1193 4001 rejection to cancelled", async () => {
    const rabbyProvider = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: jest.fn(async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts") {
          throw Object.assign(new Error("User rejected the request"), { code: 4001 });
        }
        throw new Error(`unexpected wallet request: ${method}`);
      }),
    };
    (window as typeof window & { ethereum?: unknown }).ethereum = rabbyProvider;

    function CancellationHarness() {
      const wallet = useWallet();
      const [result, setResult] = React.useState("");
      return (
        <>
          <button
            type="button"
            onClick={() => {
              void wallet.ensureWalletConnected().then((value) => {
                setResult(JSON.stringify(value));
              });
            }}
          >
            ensure wallet
          </button>
          <output>{result}</output>
        </>
      );
    }

    render(
      <WalletProvider>
        <CancellationHarness />
      </WalletProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "ensure wallet" }));

    await waitFor(() => {
      expect(screen.getByText(/"reason":"cancelled"/)).toHaveTextContent(
        '"message":"wallet connection cancelled"'
      );
    });
    expect(rabbyProvider.request).toHaveBeenCalledTimes(1);
  });

  test("accountsChanged and chainChanged update the exposed connected state", async () => {
    const listeners = new Map<string, (value: unknown) => void>();
    const rabbyProvider = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn((event: string, listener: (value: unknown) => void) => {
        listeners.set(event, listener);
      }),
      removeListener: jest.fn(),
      request: connectRequestMock(),
    };
    (window as typeof window & { ethereum?: unknown }).ethereum = rabbyProvider;

    render(
      <WalletProvider>
        <ConnectorHarness />
      </WalletProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "connect Rabby" }));

    await waitFor(() => {
      expect(listeners.has("accountsChanged")).toBe(true);
      expect(listeners.has("chainChanged")).toBe(true);
    });
    act(() => {
      listeners.get("accountsChanged")?.([NEXT_ADDRESS]);
      listeners.get("chainChanged")?.("0x7a6a");
    });

    expect(screen.getByTestId("wallet-address")).toHaveTextContent(NEXT_ADDRESS);
    expect(screen.getByTestId("wallet-chain")).toHaveTextContent("31338");
  });

  test("soft disconnect suppresses authorized injected-wallet auto-restore", async () => {
    const rabbyRequest = connectRequestMock();
    (window as typeof window & { ethereum?: unknown }).ethereum = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: rabbyRequest,
    };

    render(
      <WalletProvider>
        <ConnectorHarness />
      </WalletProvider>
    );
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
    });

    expect(rabbyRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId("wallet-address")).toHaveTextContent("none");
  });

  test("ensureWalletConnected fails closed on account and chain mismatch", async () => {
    const rabbyProvider = {
      isRabby: true,
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request: connectRequestMock(),
    };
    (window as typeof window & { ethereum?: unknown }).ethereum = rabbyProvider;

    function PreconditionsHarness() {
      const wallet = useWallet();
      const [result, setResult] = React.useState("");
      return (
        <>
          {wallet.connectors
            .filter((connector) => connector.name === "Rabby")
            .map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={() => void wallet.connectAsync({ connector })}
              >
                connect Rabby
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              void wallet.ensureWalletConnected({ expectedAccount: NEXT_ADDRESS }).then(
                (value) => setResult(JSON.stringify(value))
              );
            }}
          >
            require account
          </button>
          <button
            type="button"
            onClick={() => {
              void wallet.ensureWalletConnected({ expectedChainId: 31338 }).then(
                (value) => setResult(JSON.stringify(value))
              );
            }}
          >
            require chain
          </button>
          <output data-testid="precondition-result">{result}</output>
          <output data-testid="precondition-address">{wallet.address ?? "none"}</output>
        </>
      );
    }

    render(
      <WalletProvider>
        <PreconditionsHarness />
      </WalletProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "connect Rabby" }));
    await waitFor(() => {
      expect(screen.getByTestId("precondition-address")).toHaveTextContent(
        RABBY_ADDRESS
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "require account" }));
    await waitFor(() => {
      expect(screen.getByTestId("precondition-result")).toHaveTextContent(
        '"reason":"error"'
      );
      expect(screen.getByTestId("precondition-result")).toHaveTextContent(
        "connected wallet does not match"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "require chain" }));
    await waitFor(() => {
      expect(screen.getByTestId("precondition-result")).toHaveTextContent(
        '"reason":"wrong_chain"'
      );
      expect(screen.getByTestId("precondition-result")).toHaveTextContent(
        "wrong network. expected chain 31338."
      );
    });
  });
});

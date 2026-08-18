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

const ADDRESS = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("WalletProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      "inshell.wallet.soft-disconnected.v1",
      "1"
    );
  });

  afterEach(() => {
    delete (window as typeof window & { ethereum?: unknown }).ethereum;
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test("shares one injected account request across concurrent connect calls", async () => {
    const accounts = deferred<string[]>();
    const request = jest.fn(
      ({ method }: { method: string }): Promise<unknown> => {
        if (method === "eth_requestAccounts") return accounts.promise;
        if (method === "eth_chainId") return Promise.resolve("0x7a69");
        if (method === "eth_accounts") return Promise.resolve([]);
        return Promise.reject(new Error(`unexpected wallet method: ${method}`));
      }
    );
    const provider = {
      isMetaMask: true,
      on: jest.fn(),
      removeListener: jest.fn(),
      request,
    };
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: provider,
    });

    let firstConnect: ReturnType<ReturnType<typeof useWallet>["connectAsync"]>;
    let secondConnect: ReturnType<ReturnType<typeof useWallet>["connectAsync"]>;

    function Harness() {
      const wallet = useWallet();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              const connector = wallet.connectors.find(
                (item) => item.name === "MetaMask"
              );
              firstConnect = wallet.connectAsync({ connector });
              secondConnect = wallet.connectAsync({ connector });
            }}
          >
            connect twice
          </button>
          <output>{wallet.address ?? "disconnected"}</output>
        </>
      );
    }

    render(
      <WalletProvider>
        <Harness />
      </WalletProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "connect twice" }));

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ method: "eth_requestAccounts" });
    expect(firstConnect!).toBe(secondConnect!);

    await act(async () => {
      accounts.resolve([ADDRESS]);
      await Promise.all([firstConnect!, secondConnect!]);
    });

    await waitFor(() => {
      expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    });
    expect(
      request.mock.calls.filter(
        ([args]) => (args as { method: string }).method === "eth_requestAccounts"
      )
    ).toHaveLength(1);
  });

  test("refreshConnectors discovers a Rabby provider announced after mount", async () => {
    const rabbyProvider = {
      isRabby: true,
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
});

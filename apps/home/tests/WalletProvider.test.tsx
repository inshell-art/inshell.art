import React from "react";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  EIP6963_ANNOUNCE_EVENT,
  EIP6963_REQUEST_EVENT,
  WalletProvider,
  useWallet,
} from "@inshell/wallet";

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
});

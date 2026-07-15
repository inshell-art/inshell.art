import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseWallet = jest.fn();

jest.mock("@inshell/wallet", () => ({
  __esModule: true,
  useWallet: () => mockUseWallet(),
}));

import { InshellTopBar, openInshellWallet } from "@inshell/inshell-shell";

const ADDRESS = "0x170af4d923de5e3155067e10413c3b11d82e100";

function linkPath(name: string) {
  const link = screen.getByText(name, { selector: "a" }) as HTMLAnchorElement;
  return new URL(link.href).pathname;
}

function linkHref(name: string) {
  const link = screen.getByText(name, { selector: "a" }) as HTMLAnchorElement;
  return link.href;
}

function walletState(overrides: Record<string, unknown> = {}) {
  return {
    address: ADDRESS,
    chain: { id: 11155111, name: "Sepolia", network: "sepolia" },
    chainId: 11155111,
    connectAsync: jest.fn(),
    connectors: [],
    connectError: null,
    disconnectWallet: jest.fn(),
    evm: { provider: null },
    isConnected: true,
    isConnecting: false,
    refreshWallet: jest.fn(),
    ...overrides,
  };
}

describe("InshellTopBar", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    mockUseWallet.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  test("renders same-origin ecosystem links", () => {
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
      })
    );

    render(<InshellTopBar />);

    expect(linkPath("INSHELL")).toBe("/");
    expect(linkPath("$PATH")).toBe("/path");
    expect(linkPath("docs")).toBe("/docs");
    expect(linkHref("x")).toBe("https://twitter.com/inshell_art");
    expect(
      screen.getByRole("button", { name: "connect wallet" })
    ).toBeTruthy();
  });

  test("uses the PATH wallet-options picker while disconnected", async () => {
    const connectAsync = jest.fn().mockResolvedValue({ address: ADDRESS, chainId: 11155111 });
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
        connectAsync,
        connectors: [{ id: "metamask", name: "MetaMask" }],
      })
    );

    render(<InshellTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "connect wallet" }));

    expect(screen.getByRole("menu", { name: "Wallet options" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "MetaMask" }));
    });
    expect(connectAsync).toHaveBeenCalledWith({
      connector: { id: "metamask", name: "MetaMask" },
    });
  });

  test("uses the PATH network label without changing wallet-picker behavior", async () => {
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
        connectors: [{ id: "metamask", name: "MetaMask" }],
      })
    );
    render(<InshellTopBar disconnectedWalletNote="Sepolia ETH" />);

    const walletControl = screen.getByRole("button", { name: "connect wallet" });
    expect(walletControl).toHaveTextContent("connect wallet");
    expect(walletControl).toHaveTextContent("Sepolia ETH");
    fireEvent.click(walletControl);

    expect(screen.getByRole("menu", { name: "Wallet options" })).toBeTruthy();
  });

  test("opens the wallet picker when an app flow requests the global wallet", () => {
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
        connectors: [{ id: "metamask", name: "MetaMask" }],
      })
    );

    render(<InshellTopBar />);
    act(() => openInshellWallet());

    expect(screen.getByRole("menu", { name: "Wallet options" })).toBeTruthy();
  });

  test("copies the connected wallet address from the global shell", async () => {
    mockUseWallet.mockReturnValue(walletState());
    render(<InshellTopBar />);

    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "copy address" }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText("address copied.")).toBeTruthy();
  });

  test("soft-disconnects from the global shell wallet modal", async () => {
    const disconnectWallet = jest.fn();
    mockUseWallet.mockReturnValue(walletState({ disconnectWallet }));
    render(<InshellTopBar />);

    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "disconnect" }));
    });

    expect(disconnectWallet).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "disconnected in Inshell. to fully remove site access, disconnect this site in your wallet."
      )
    ).toBeTruthy();
  });

  test("switches a connected wallet to the expected network", async () => {
    const request = jest.fn().mockResolvedValue(undefined);
    const refreshWallet = jest.fn().mockResolvedValue(undefined);
    mockUseWallet.mockReturnValue(
      walletState({
        chain: { id: 1, name: "Mainnet", network: "mainnet" },
        chainId: 1,
        evm: { provider: { request } },
        refreshWallet,
      })
    );

    render(<InshellTopBar expectedChainId={11155111} />);
    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "switch network" }));
    });

    expect(request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
  });
});

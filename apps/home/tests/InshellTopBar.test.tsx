import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUseWallet = jest.fn();

jest.mock("@inshell/wallet", () => ({
  __esModule: true,
  useWallet: () => mockUseWallet(),
}));

import {
  INSHELL_WALLET_VISIBILITY_EVENT,
  InshellTopBar,
  isLocalRuntimeHost,
  openInshellWallet,
} from "@inshell/inshell-shell";

const ADDRESS = "0x170af4d923de5e3155067e10413c3b11d82e100";

function linkPath(name: string) {
  const link = screen.getByText(name, { selector: "a" }) as HTMLAnchorElement;
  return new URL(link.href).pathname;
}

function linkHref(name: string) {
  const link = screen.getByText(name, { selector: "a" }) as HTMLAnchorElement;
  return link.href;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
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
    refreshConnectors: jest.fn().mockResolvedValue(undefined),
    refreshWallet: jest.fn(),
    ...overrides,
  };
}

describe("InshellTopBar", () => {
  beforeEach(() => {
    jest.useRealTimers();
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

  test("recognizes LAN hosts as local same-origin runtimes", () => {
    expect(isLocalRuntimeHost("192.168.0.104")).toBe(true);
    expect(isLocalRuntimeHost("10.0.0.42")).toBe(true);
    expect(isLocalRuntimeHost("172.16.4.8")).toBe(true);
    expect(isLocalRuntimeHost("studio-mac.local")).toBe(true);
    expect(isLocalRuntimeHost("inshell.art")).toBe(false);
    expect(isLocalRuntimeHost("preview.inshell.art")).toBe(false);
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
    expect(
      screen.getByText(/Connecting shares your address only\. No signature or transaction\./)
    ).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "MetaMask" }));
    });
    expect(connectAsync).toHaveBeenCalledWith({
      connector: { id: "metamask", name: "MetaMask" },
    });
  });

  test("refreshes injected connectors whenever the disconnected picker opens", async () => {
    const refreshConnectors = jest.fn().mockResolvedValue(undefined);
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        connectors: [{ id: "metamask", name: "MetaMask" }],
        isConnected: false,
        refreshConnectors,
      })
    );

    render(<InshellTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "connect wallet" }));

    expect(refreshConnectors).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu", { name: "Wallet options" })).toBeTruthy();
  });

  test("shows immediate connector feedback and suppresses duplicate clicks", async () => {
    const connection = deferred<{ address: string; chainId: number }>();
    const connectAsync = jest.fn(() => connection.promise);
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
        connectAsync,
        connectors: [
          { id: "metamask", name: "MetaMask" },
          { id: "walletconnect", name: "WalletConnect" },
        ],
      })
    );

    render(<InshellTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "connect wallet" }));
    const picker = screen.getByRole("menu", { name: "Wallet options" });
    const metamask = screen.getByRole("menuitem", { name: "MetaMask" });
    const walletConnect = screen.getByRole("menuitem", {
      name: "WalletConnect",
    });

    fireEvent.click(metamask);

    expect(picker).toHaveAttribute("aria-busy", "true");
    expect(metamask).toHaveAttribute("aria-busy", "true");
    expect(metamask).toBeDisabled();
    expect(walletConnect).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "opening MetaMask..."
    );
    fireEvent.click(metamask);
    fireEvent.click(walletConnect);
    expect(connectAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      connection.resolve({ address: ADDRESS, chainId: 11155111 });
      await connection.promise;
    });

    expect(picker).toHaveAttribute("aria-busy", "false");
    expect(metamask).not.toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("wallet connected.");
  });

  test("turns an unresolved MetaMask request into actionable guidance", () => {
    jest.useFakeTimers();
    const connection = deferred<{ address: string; chainId: number }>();
    const connectAsync = jest.fn(() => connection.promise);
    mockUseWallet.mockReturnValue(
      walletState({
        address: null,
        chain: null,
        chainId: null,
        isConnected: false,
        connectAsync,
        connectors: [
          { id: "metamask", name: "MetaMask" },
          { id: "rabby", name: "Rabby" },
        ],
      })
    );

    render(<InshellTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "connect wallet" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "MetaMask" }));

    act(() => jest.advanceTimersByTime(5_000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "open MetaMask from your browser toolbar, then approve or cancel the connection."
    );
    expect(connectAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menuitem", { name: "MetaMask" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Rabby" })).toBeDisabled();

    act(() => jest.advanceTimersByTime(25_000));
    expect(screen.getByRole("status")).toHaveTextContent(
      "still waiting for MetaMask. approve or cancel the request there. if no request appears, restart MetaMask and reload this page."
    );
    expect(connectAsync).toHaveBeenCalledTimes(1);
  });

  test("explains when MetaMask already has a request open", async () => {
    const connectAsync = jest.fn().mockRejectedValue({
      code: -32002,
      message: "Already processing eth_requestAccounts. Please wait.",
    });
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
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "MetaMask" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "a wallet request is already open. open your wallet and approve or cancel it."
    );
    expect(screen.getByRole("menuitem", { name: "MetaMask" })).not.toBeDisabled();
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

  test("announces global wallet popover visibility", () => {
    mockUseWallet.mockReturnValue(walletState());
    const visibility = jest.fn();
    window.addEventListener(INSHELL_WALLET_VISIBILITY_EVENT, visibility);

    render(<InshellTopBar />);
    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    expect(visibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { open: true } })
    );

    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    expect(visibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { open: false } })
    );
    window.removeEventListener(INSHELL_WALLET_VISIBILITY_EVENT, visibility);
  });

  test("copies the connected wallet address from the global shell", async () => {
    mockUseWallet.mockReturnValue(walletState());
    render(<InshellTopBar />);

    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));
    const walletDialog = screen.getByRole("dialog", { name: "wallet" });
    expect(walletDialog).toHaveTextContent(ADDRESS);
    expect(walletDialog).toHaveTextContent("Sepolia");
    expect(walletDialog).toHaveTextContent(
      "This menu never requests a signature or transaction."
    );
    expect(walletDialog).not.toHaveTextContent("read-only connected");
    expect(walletDialog).not.toHaveTextContent("approval");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "copy address" }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText("address copied.")).toBeTruthy();
  });

  test("uses the canonical local network label in the wallet modal", () => {
    mockUseWallet.mockReturnValue(
      walletState({
        chain: { id: 31337, name: "Anvil Local", network: "anvil" },
        chainId: 31337,
      })
    );
    render(<InshellTopBar />);

    fireEvent.click(screen.getByRole("button", { name: /wallet 0x170a/i }));

    expect(screen.getByRole("dialog", { name: "wallet" })).toHaveTextContent("Local Anvil");
    expect(screen.getByRole("dialog", { name: "wallet" })).not.toHaveTextContent("Anvil Local");
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

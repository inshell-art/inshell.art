import "@testing-library/jest-dom";
import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HeaderWalletCTA from "../src/components/HeaderWalletCTA";

const createWalletState = (overrides: Partial<any> = {}) => ({
  address: "0x1111222233334444555566667777888899990000",
  chain: { name: "Starknet Sepolia Testnet", network: "sepolia" },
  isConnected: true,
  disconnect: jest.fn(),
  ...overrides,
});

let mockWalletState = createWalletState();

jest.mock("@inshell/wallet", () => ({
  useWallet: () => mockWalletState,
}));

describe("HeaderWalletCTA", () => {
  beforeEach(() => {
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {};
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).__VITE_ENV__;
  });

  test("renders CTA label and triggers click", () => {
    const onCtaClick = jest.fn();
    render(
      <HeaderWalletCTA ctaLabel="connect" onCtaClick={onCtaClick} />
    );
    const button = screen.getByText(/\[\s*connect\s*\]/i);
    fireEvent.click(button);
    expect(onCtaClick).toHaveBeenCalled();
  });

  test("opens menu and fires copy/disconnect callbacks", async () => {
    const onCopyNotice = jest.fn();
    const onDisconnectNotice = jest.fn();
    const { container } = render(
      <HeaderWalletCTA
        ctaLabel="mint"
        onCtaClick={() => {}}
        onCopyNotice={onCopyNotice}
        onDisconnectNotice={onDisconnectNotice}
        lastTxHash="0xabc123"
        dotState="on"
      />
    );
    const dotButton = container.querySelector(
      ".dotfield__cta-address"
    ) as HTMLElement;
    fireEvent.click(dotButton);
    expect(screen.getByText(/^address$/i)).toBeTruthy();
    const copyButton = screen.getByText(/copy address/i);
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(onCopyNotice).toHaveBeenCalled();
    });
    const lastTxLink = screen.getByText(/last tx/i);
    expect(lastTxLink).toBeTruthy();
    const disconnectButton = screen.getByText(/disconnect/i);
    fireEvent.click(disconnectButton);
    expect(mockWalletState.disconnect).toHaveBeenCalled();
    expect(onDisconnectNotice).toHaveBeenCalled();
  });

  test("menu disables actions when not connected", () => {
    const onCopyNotice = jest.fn();
    mockWalletState = createWalletState({
      address: null,
      chain: undefined,
      isConnected: false,
    });
    const { container } = render(
      <HeaderWalletCTA
        ctaLabel="connect"
        onCtaClick={() => {}}
        onCopyNotice={onCopyNotice}
      />
    );
    const dotButton = container.querySelector(
      ".dotfield__cta-address"
    ) as HTMLElement;
    fireEvent.click(dotButton);
    const copyButton = screen.getByText(/copy address/i);
    const disconnectButton = screen.getByText(/disconnect/i);
    expect(copyButton).toBeDisabled();
    expect(disconnectButton).toBeDisabled();
    fireEvent.click(copyButton);
    expect(onCopyNotice).not.toHaveBeenCalled();
  });
});

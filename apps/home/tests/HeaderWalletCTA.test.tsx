import "@testing-library/jest-dom";
import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HeaderWalletCTA from "../src/components/HeaderWalletCTA";

const createWalletState = (overrides: Partial<any> = {}) => ({
  address: "0x1111222233334444555566667777888899990000",
  chain: { name: "Sepolia", network: "sepolia" },
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
    expect(screen.getByText(/^mode$/i)).toBeTruthy();
    expect(screen.getByText("read-only connected")).toBeTruthy();
    expect(screen.getByText(/^signature$/i)).toBeTruthy();
    expect(screen.getByText(/^transaction$/i)).toBeTruthy();
    expect(screen.getAllByText("none")).toHaveLength(3);
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

  test("honors disabled and dot visibility states", () => {
    const onCtaClick = jest.fn();
    const { container } = render(
      <HeaderWalletCTA
        ctaLabel="mint"
        ctaDisabled
        onCtaClick={onCtaClick}
        showWalletDot={false}
      />,
    );
    const cta = screen.getByRole("button", { name: /mint/i });
    expect(cta).toBeDisabled();
    fireEvent.click(cta);
    expect(onCtaClick).not.toHaveBeenCalled();
    expect(container.querySelector(".dotfield__cta-address")).toBeNull();
  });

  test("closes its menu on Escape and an outside pointer", () => {
    const { container } = render(
      <div>
        <HeaderWalletCTA ctaLabel="mint" onCtaClick={() => {}} />
        <button type="button">outside</button>
      </div>,
    );
    const dotButton = container.querySelector(
      ".dotfield__cta-address",
    ) as HTMLElement;

    fireEvent.click(dotButton);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(dotButton);
    fireEvent.mouseDown(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("uses the configured explorer and does not claim a failed copy", async () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_EXPLORER_BASE_URL: "https://explorer.example/",
    };
    mockWalletState = createWalletState({
      chain: { name: "Local Devnet Testnet", network: "devnet" },
    });
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(
      new Error("clipboard denied") as never,
    );
    const onCopyNotice = jest.fn();
    const { container } = render(
      <HeaderWalletCTA
        ctaLabel="mint"
        onCtaClick={() => {}}
        onCopyNotice={onCopyNotice}
        lastTxHash="0xabc123"
        dotState="amber"
      />,
    );
    const dotButton = container.querySelector(
      ".dotfield__cta-address",
    ) as HTMLElement;
    expect(dotButton).toHaveAttribute("title", expect.stringContaining("Local Devnet"));
    expect(container.querySelector(".dotfield__cta-dot")).toHaveClass("is-pending");
    fireEvent.click(dotButton);

    expect(screen.getByRole("link", { name: "open in explorer" })).toHaveAttribute(
      "href",
      `https://explorer.example/address/${mockWalletState.address}`,
    );
    expect(screen.getByRole("link", { name: "last tx" })).toHaveAttribute(
      "href",
      "https://explorer.example/tx/0xabc123",
    );
    fireEvent.click(screen.getByRole("button", { name: "copy address" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(onCopyNotice).not.toHaveBeenCalled();
  });
});

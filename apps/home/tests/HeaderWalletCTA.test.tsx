import "@testing-library/jest-dom";
import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HeaderWalletCTA from "../src/components/HeaderWalletCTA";

const createWalletState = (overrides: Partial<any> = {}) => ({
  address: "0x1111222233334444555566667777888899990000",
  isConnected: true,
  isConnecting: false,
  isReconnecting: false,
  status: "connected",
  chain: { name: "Starknet Sepolia Testnet", network: "sepolia" },
  chainId: BigInt("0x534e5f5345504f4c4941"),
  account: null,
  accountMissing: false,
  connect: jest.fn(),
  connectAsync: jest.fn().mockResolvedValue(null),
  disconnect: jest.fn(),
  disconnectAsync: jest.fn().mockResolvedValue(null),
  connectors: [],
  connectStatus: "idle",
  requestAccounts: jest.fn().mockResolvedValue(["0x1"]),
  watchAsset: jest.fn(),
  ...overrides,
});

let mockWalletState = createWalletState();
const fakeConnector = { id: "ready", name: "Ready", available: () => true };

jest.mock("@inshell/wallet", () => ({
  useWallet: () => mockWalletState,
}));

describe("HeaderWalletCTA", () => {
  beforeEach(() => {
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).__VITE_ENV__;
  });

  test("shows connect when disconnected and calls connect", async () => {
    mockWalletState.isConnected = false;
    mockWalletState.connectors = [fakeConnector];
    render(<HeaderWalletCTA />);
    const button = screen.getByText(/connect/i);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockWalletState.connect).toHaveBeenCalled();
  });

  test("shows unlock wallet and requests accounts", async () => {
    mockWalletState.accountMissing = true;
    mockWalletState.connectors = [fakeConnector];
    render(<HeaderWalletCTA />);
    const button = screen.getByText(/unlock wallet/i);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockWalletState.requestAccounts).toHaveBeenCalled();
    expect(mockWalletState.connectAsync).toHaveBeenCalled();
  });

  test("shows wrong network when chain id mismatches", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_EXPECTED_CHAIN_ID: "0x534e5f5345504f4c4941",
    };
    mockWalletState.chainId = BigInt("0x534e5f4d41494e");
    render(<HeaderWalletCTA />);
    const button = screen.getByText(/wrong network/i);
    expect(button).toBeDisabled();
  });
});

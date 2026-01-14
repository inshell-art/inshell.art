import "@testing-library/jest-dom";
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import AuctionCanvas from "../src/components/AuctionCanvas";
import { mockAuctionCore } from "./testUtils";

const mockUseAuctionBids = jest.fn();
const mockUseAuctionCore = jest.fn();
const mockCallContract = jest.fn<
  (...args: any[]) => Promise<{ result: string[] }>
>();
const mockProvider = {
  callContract: mockCallContract,
};
const createWalletState = (overrides: Partial<any> = {}) => ({
  address: "0x1111222233334444555566667777888899990000",
  isConnected: true,
  isConnecting: false,
  isReconnecting: false,
  status: "connected",
  chain: { name: "Starknet Sepolia Testnet" },
  chainId: BigInt("0x534e5f5345504f4c4941"),
  account: null,
  accountMissing: false,
  connect: jest.fn(),
  connectAsync: jest.fn(),
  disconnect: jest.fn(),
  disconnectAsync: jest.fn(),
  connectors: [],
  connectStatus: "idle",
  requestAccounts: jest.fn(),
  watchAsset: jest.fn(),
  ...overrides,
});
let mockWalletState = createWalletState();

jest.mock("../src/hooks/useAuctionBids", () => ({
  useAuctionBids: (...args: any[]) => mockUseAuctionBids(...args),
}));
jest.mock("../src/hooks/useAuctionCore", () => ({
  useAuctionCore: (...args: any[]) => mockUseAuctionCore(...args),
}));
jest.mock("@inshell/wallet", () => ({
  useWallet: () => mockWalletState,
}));

const sampleBids = [
  {
    key: "b1",
    atMs: Date.UTC(2025, 0, 1),
    amount: { raw: { low: "1", high: "0" }, dec: "1", value: 1n },
    bidder: "0x1111111111111111",
    blockNumber: 10,
    epochIndex: 1,
  },
  {
    key: "b2",
    atMs: Date.UTC(2025, 0, 1, 1),
    amount: { raw: { low: "2", high: "0" }, dec: "2", value: 2n },
    bidder: "0x2222222222222222",
    blockNumber: 11,
    epochIndex: 2,
  },
];

describe("AuctionCanvas", () => {
  beforeEach(() => {
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {};
    mockCallContract.mockReset();
    mockCallContract.mockResolvedValue({ result: [] });
    mockUseAuctionBids.mockReturnValue({
      bids: sampleBids,
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (globalThis as any).__VITE_ENV__;
  });

  test("renders mint button and dots", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(screen.getByText(/mint/i)).toBeTruthy();

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });

  test("shows popover on hover with shortened info", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    fireEvent.click(screen.getByText(/bids/i));

    const dot = container.querySelector(".dotfield__dot");
    expect(dot).toBeTruthy();
    await act(async () => {
      fireEvent.mouseMove(dot as unknown as HTMLElement, {
        clientX: 10,
        clientY: 10,
      });
      await Promise.resolve();
    });

    expect(screen.getByText(/sale #/i)).toBeTruthy();
    expect(screen.getByText(/STRK/)).toBeTruthy();
  });

  test("curve hover shows above-floor percent", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const svg = container.querySelector("svg") as any;
    if (svg) {
      svg.getScreenCTM = () => null;
      svg.createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 0, y: 0 }),
      });
    }
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 50,
      clientY: 10,
    });
    await waitFor(() => {
      expect(screen.getByText(/premium vs floor/i)).toBeTruthy();
    });
  });

  test("shows loading placeholder when curve is still loading", () => {
    mockUseAuctionCore.mockReturnValue({
      data: null,
      ready: false,
      loading: true,
      error: null,
      refresh: jest.fn(),
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/loading curve/i)).toBeTruthy();
  });

  test("shows error message when curve load fails", () => {
    jest.useFakeTimers();
    mockUseAuctionCore.mockReturnValue({
      data: {
        config: {
          // Force curve derivation to bail so the error message displays.
          openTimeSec: Date.UTC(2024, 0, 1) / 1000,
          genesisPrice: { dec: "not-a-number" },
          genesisFloor: { dec: "not-a-number" },
          k: { dec: "nan" },
          pts: "abc",
        },
      },
      ready: true,
      loading: false,
      error: new Error("boom"),
      refresh: jest.fn(),
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(screen.getByText(/error loading curve/i)).toBeTruthy();
    expect(screen.getByText(/boom/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows genesis waiting message when there are no bids", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 60,
          genesisPrice: { dec: "1" },
          genesisFloor: { dec: "1" },
          k: { dec: "10" },
          pts: "1",
        },
      },
      ready: true,
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [],
      ready: true,
      loading: false,
      error: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/Genesis is waiting for bid/i)).toBeTruthy();
  });

  test("shows pre-open message when open time is in the future", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) + 3600,
          genesisPrice: { dec: "1" },
          genesisFloor: { dec: "1" },
          k: { dec: "10" },
          pts: "1",
        },
      },
      ready: true,
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [],
      ready: true,
      loading: false,
      error: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/Auction will open at/i)).toBeTruthy();
  });

  test("mint flow approves then bids when allowance is low", async () => {
    const execute = jest.fn().mockResolvedValue({});
    mockWalletState.account = { execute };
    mockWalletState.watchAsset = jest.fn().mockResolvedValue(true);
    mockCallContract
      .mockResolvedValueOnce({ price: { low: "100", high: "0" } })
      .mockResolvedValueOnce({ balance: { low: "200", high: "0" } })
      .mockResolvedValueOnce({ remaining: { low: "0", high: "0" } });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/mint/i));
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });
    expect(execute.mock.calls[0][0].entrypoint).toBe("approve");
    expect(execute.mock.calls[1][0].entrypoint).toBe("bid");
    expect(mockWalletState.watchAsset).toHaveBeenCalled();
  });

  test("mint flow skips approve when allowance is sufficient", async () => {
    const execute = jest.fn().mockResolvedValue({});
    mockWalletState.account = { execute };
    mockWalletState.watchAsset = jest.fn().mockResolvedValue(true);
    mockCallContract
      .mockResolvedValueOnce({ price: { low: "100", high: "0" } })
      .mockResolvedValueOnce({ balance: { low: "200", high: "0" } })
      .mockResolvedValueOnce({ remaining: { low: "150", high: "0" } });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/mint/i));
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0][0].entrypoint).toBe("bid");
  });
});

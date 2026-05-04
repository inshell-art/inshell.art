import "@testing-library/jest-dom";
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import React from "react";
import AuctionCanvas from "../src/components/AuctionCanvas";
import { mockAuctionCore } from "./testUtils";
/* global SVGLineElement */

const mockUseAuctionBids = jest.fn();
const mockUseAuctionCore = jest.fn();
const mockCallContract = jest.fn<
  (...args: any[]) => Promise<{ result: string[] }>
>();
const mockGetBalance = jest.fn<(...args: any[]) => Promise<bigint>>();
const mockProvider = {
  callContract: mockCallContract,
  getBalance: mockGetBalance,
};
const fakeConnector = { id: "ready", name: "Ready", available: () => true };
const TEST_AUCTION_ADDRESS = "0x1111111111111111111111111111111111111111";
const TEST_PAYMENT_TOKEN = "0x2222222222222222222222222222222222222222";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const STARTUP_GRACE_MS = 2500;
const DELAY_MS = 500;
const SAMPLE_BASE_MS = Date.now() - 2 * 60 * 1000;
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const createWalletState = (overrides: Partial<any> = {}) => ({
  address: "0x1111222233334444555566667777888899990000",
  isConnected: true,
  isConnecting: false,
  isReconnecting: false,
  status: "connected",
  chain: { name: "Sepolia" },
  chainId: 11155111n,
  account: null,
  accountMissing: false,
  connect: jest.fn(),
  connectAsync: jest.fn(),
  disconnect: jest.fn(),
  disconnectAsync: jest.fn(),
  connectors: [fakeConnector],
  connectStatus: "idle",
  requestAccounts: jest.fn(),
  watchAsset: jest.fn(),
  evm: {
    providers: [],
    address: null,
    chainId: null,
    providerName: null,
    isConnected: false,
    error: null,
    connectInjected: jest.fn(),
    connectWalletConnectV2: jest.fn(),
    disconnect: jest.fn(),
  },
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
    atMs: SAMPLE_BASE_MS,
    amount: { raw: { low: "1", high: "0" }, dec: "1", value: 1n },
    bidder: "0x1111111111111111",
    blockNumber: 10,
    epochIndex: 1,
  },
  {
    key: "b2",
    atMs: SAMPLE_BASE_MS + 60 * 1000,
    amount: { raw: { low: "2", high: "0" }, dec: "2", value: 2n },
    bidder: "0x2222222222222222",
    blockNumber: 11,
    epochIndex: 2,
  },
];

describe("AuctionCanvas", () => {
  beforeEach(() => {
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PAYMENT_TOKEN: TEST_PAYMENT_TOKEN,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
      VITE_ETH_RPC: "https://ethereum-sepolia-rpc.publicnode.com",
    };
    mockCallContract.mockReset();
    mockGetBalance.mockReset();
    mockGetBalance.mockResolvedValue(1000n);
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "10", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "1000", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "1000", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
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
    delete (globalThis as any).__PULSE_STATUS__;
    delete (window as any).ethereum;
  });

  test("renders mint button and dots", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(container.querySelector(".dotfield__mint")).toBeTruthy();

    const dots = container.querySelectorAll(".dotfield__point, .dotfield__now-dot");
    expect(dots.length).toBeGreaterThan(0);
  });

  test("renders one linked segment per sale plus current active segment", () => {
    const threeBids = [
      ...sampleBids,
      {
        key: "b3",
        atMs: SAMPLE_BASE_MS + 2 * 60 * 1000,
        amount: { raw: { low: "3", high: "0" }, dec: "3", value: 3n },
        bidder: "0x3333333333333333",
        blockNumber: 12,
        epochIndex: 3,
      },
    ];
    mockUseAuctionBids.mockReturnValue({
      bids: threeBids,
      ready: true,
      loading: false,
      error: null,
    });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(container.querySelectorAll(".dotfield__curve")).toHaveLength(4);
    expect(container.querySelectorAll(".dotfield__pump")).toHaveLength(4);
  });

  test("shows popover on hover with shortened info", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    const dot = container.querySelector(".dotfield__point--sale .dotfield__dot");
    expect(dot).toBeTruthy();
    await act(async () => {
      fireEvent.mouseMove(dot as unknown as HTMLElement, {
        clientX: 10,
        clientY: 10,
      });
      await Promise.resolve();
    });

    expect(screen.getByText(/sale #/i)).toBeTruthy();
    const popover = container.querySelector(".dotfield__popover") as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.textContent).toMatch(/ETH/i);
  });

  test("clicking blank area clears selected sale", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    const svg = container.querySelector("svg") as HTMLElement | null;
    expect(svg).toBeTruthy();
    if (svg) {
      Object.defineProperty(svg, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 1000,
          bottom: 600,
          width: 1000,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    }

    const dotButton = container.querySelector(
      ".dotfield__point--sale"
    ) as HTMLElement | null;
    expect(dotButton).toBeTruthy();
    fireEvent.click(dotButton as HTMLElement);
    expect(dotButton?.classList.contains("is-selected")).toBe(true);

    fireEvent.click(svg as HTMLElement, {
      clientX: 980,
      clientY: 580,
    });

    await waitFor(() => {
      expect(container.querySelector(".dotfield__point--sale.is-selected")).toBeNull();
    });
  });

  test("curve hover shows above-floor amount", async () => {
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
      expect(screen.getByText(/above floor/i)).toBeTruthy();
      expect(screen.getByText(/^1 t½ drop$/i)).toBeTruthy();
    });
  });

  test("hover near first curve start ask area shows opening ask tooltip", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const svg = container.querySelector("svg") as HTMLElement | null;
    expect(svg).toBeTruthy();
    if (svg) {
      Object.defineProperty(svg, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 60,
          width: 100,
          height: 60,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    }
    const pump = container.querySelector(".dotfield__pump") as SVGLineElement | null;
    expect(pump).toBeTruthy();
    const x = Number((pump as SVGLineElement).getAttribute("x1") ?? Number.NaN);
    const y = Number((pump as SVGLineElement).getAttribute("y1") ?? Number.NaN);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);

    fireEvent.mouseMove(svg as HTMLElement, {
      clientX: x - 1.0,
      clientY: y - 1.0,
    });

    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^opening ask$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^time$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^floor b$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^time premium$/i)).toBeNull();
      expect(
        within(popover as HTMLElement).getByText(/ask price when the auction opens/i)
      ).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ drop$/i)).toBeNull();
    });
  });

  test("hovering an init ask dot shows composition tooltip", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const askDot = container.querySelector(".dotfield__point--ask .dotfield__dot");
    expect(askDot).toBeTruthy();
    fireEvent.mouseEnter(askDot as HTMLElement, {
      clientX: 12,
      clientY: 12,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^opening ask$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^time$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^floor b$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^time premium$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ drop$/i)).toBeNull();
      expect(
        within(popover as HTMLElement).getByText(/ask price when the auction opens/i)
      ).toBeTruthy();
    });
  });

  test("hovering opening floor dot shows opening floor tooltip", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const floorDot = container.querySelector(".dotfield__point--opening-floor .dotfield__dot");
    expect(floorDot).toBeTruthy();
    fireEvent.mouseEnter(floorDot as HTMLElement, {
      clientX: 12,
      clientY: 12,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^opening floor$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^price$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^time$/i)).toBeTruthy();
    });
  });

  test("first ask dot uses regular initial-ask tooltip even for epoch 1", async () => {
    mockAuctionCore(mockUseAuctionCore, {
      genesisPrice: { dec: "12" },
      genesisFloor: { dec: "10" },
      k: { dec: "1000000" },
      pts: "1",
    });
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const askDot = container.querySelector(".dotfield__point--ask .dotfield__dot");
    expect(askDot).toBeTruthy();
    fireEvent.mouseEnter(askDot as HTMLElement, {
      clientX: 12,
      clientY: 12,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^opening ask$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^time$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^floor b$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^time premium$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ drop$/i)).toBeNull();
      expect(
        within(popover as HTMLElement).getByText(/ask price when the auction opens/i)
      ).toBeTruthy();
    });
  });

  test("first segment follows event floor/anchor when provided", async () => {
    const t1 = Date.UTC(2025, 0, 1, 0, 0, 0);
    const t2 = t1 + 10_000;
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: t1,
          amount: { raw: { low: "50", high: "0" }, dec: "50", value: 50n },
          floorB: { raw: { low: "40", high: "0" }, dec: "40", value: 40n },
          anchorASec: t1 / 1000 - 20,
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
        {
          key: "b2",
          atMs: t2,
          amount: { raw: { low: "73", high: "0" }, dec: "73", value: 73n },
          floorB: { raw: { low: "73", high: "0" }, dec: "73", value: 73n },
          anchorASec: t2 / 1000 - 20,
          bidder: "0x2222222222222222",
          blockNumber: 11,
          epochIndex: 2,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore, {
      // Deliberately disagree with event floor/anchor; curve should follow event data.
      genesisPrice: { dec: "120" },
      genesisFloor: { dec: "10" },
      k: { dec: "1000" },
      pts: "1",
    });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} decimals={0} />
    );
    const askDot = container.querySelector(".dotfield__point--ask .dotfield__dot");
    expect(askDot).toBeTruthy();
    fireEvent.mouseMove(askDot as HTMLElement, {
      clientX: 8,
      clientY: 8,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^opening ask$/i)).toBeTruthy();
      const priceRow = within(popover as HTMLElement).getByText(/^price$/i).parentElement;
      expect(priceRow).toBeTruthy();
      expect((priceRow?.textContent ?? "").replace(/,/g, "")).toMatch(/120(?:\.00)?\s*ETH/i);
    });
  });

  test("sale #1 dot shows regular sale tooltip", async () => {
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: Date.UTC(2025, 0, 1),
          amount: { raw: { low: "12", high: "0" }, dec: "12", value: 12n },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore, {
      genesisPrice: { dec: "12" },
      genesisFloor: { dec: "10" },
      k: { dec: "1000000" },
      pts: "1",
    });
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} decimals={0} />
    );
    const saleDot = container.querySelector(".dotfield__point--sale .dotfield__dot");
    expect(saleDot).toBeTruthy();
    fireEvent.mouseMove(saleDot as HTMLElement, {
      clientX: 8,
      clientY: 8,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^sale #1$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^price$/i)).toBeTruthy();
    });
  });

  test("hovering pump line shows time premium tooltip", async () => {
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: Date.UTC(2025, 0, 1),
          amount: { raw: { low: "40", high: "0" }, dec: "40", value: 40n },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
        {
          key: "b2",
          atMs: Date.UTC(2025, 0, 1, 0, 5),
          amount: { raw: { low: "50", high: "0" }, dec: "50", value: 50n },
          bidder: "0x2222222222222222",
          blockNumber: 11,
          epochIndex: 2,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore, {
      genesisPrice: { dec: "40" },
      genesisFloor: { dec: "10" },
      k: { dec: "1000000" },
      pts: "1",
    });
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} decimals={0} />
    );
    const svg = container.querySelector("svg") as HTMLElement | null;
    expect(svg).toBeTruthy();
    if (svg) {
      Object.defineProperty(svg, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 60,
          width: 100,
          height: 60,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    }
    const pumps = container.querySelectorAll(".dotfield__pump");
    const pump = pumps.item(0) as SVGLineElement | null;
    expect(pump).toBeTruthy();
    const x = Number((pump as SVGLineElement).getAttribute("x1") ?? Number.NaN);
    const y0 = Number((pump as SVGLineElement).getAttribute("y1") ?? Number.NaN);
    const y1 = Number((pump as SVGLineElement).getAttribute("y2") ?? Number.NaN);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y0)).toBe(true);
    expect(Number.isFinite(y1)).toBe(true);
    const yMid = (y0 + y1) / 2;

    fireEvent.mouseMove(svg as HTMLElement, {
      clientX: x + 0.7,
      clientY: yMid,
    });

    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^time premium$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^amount$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/amount = duration × PTS/i)).toBeTruthy();
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

  test("shows open waiting message when there are no bids", () => {
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
    expect(screen.getByText(/Waiting for first bid/i)).toBeTruthy();
  });

  test("keeps loading state while initial bid backfill is still pending", () => {
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
      loading: true,
      error: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/loading curve/i)).toBeTruthy();
    expect(screen.queryByText(/Waiting for first bid/i)).toBeNull();
  });

  test("opening ask label scales by token decimals", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 60,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "1000000000000000000" },
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
    expect(screen.getByText(/Opening ask: 1 ETH/i)).toBeTruthy();
  });

  test("opening ask label preserves tiny ETH values instead of rounding to zero", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 60,
          genesisPrice: { dec: "1000" },
          genesisFloor: { dec: "900" },
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
    expect(screen.getByText(/Opening ask: 0\.000000000000001 ETH/i)).toBeTruthy();
  });

  test("auction status override wins over live state", () => {
    (globalThis as any).__PULSE_STATUS__ = "before_open";
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: true,
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
      bids: sampleBids,
      ready: true,
      loading: false,
      error: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/Auction will open at/i)).toBeTruthy();
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

  test("shows no wallet notice when no connectors are available", () => {
    mockWalletState = createWalletState({
      connectors: [],
      address: null,
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/No supported wallet found/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    });
  });

  test("shows unlock notice when wallet is locked", () => {
    mockWalletState = createWalletState({
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/\[\s*unlock\s*\]/i)).toBeTruthy();
    });
  });

  test("unlock CTA requests accounts before reconnect", async () => {
    const requestAccounts = jest.fn().mockResolvedValue(["0xabc"]);
    mockWalletState = createWalletState({
      account: null,
      accountMissing: true,
      requestAccounts,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const unlockButton = await waitFor(() =>
      screen.getByText(/\[\s*unlock\s*\]/i)
    );
    fireEvent.click(unlockButton);
    await waitFor(() => {
      expect(requestAccounts).toHaveBeenCalled();
      expect(mockWalletState.connectAsync).toHaveBeenCalled();
    });
  });

  test("shows connect notice when wallet is detected but not connected", () => {
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    });
  });

  test("connect CTA falls back to connectAsync when no enumerated connectors are present", async () => {
    const connectAsync = jest
      .fn()
      .mockResolvedValue({ address: "0xabc", chainId: 11155111 });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const connectButton = await waitFor(() =>
      screen.getByText(/\[\s*connect\s*\]/i)
    );
    fireEvent.click(connectButton);
    await waitFor(() => {
      expect(connectAsync).toHaveBeenCalled();
    });
  });

  test("connect CTA prefers MetaMask over generic injected fallback", async () => {
    const genericConnector = {
      id: "window.ethereum",
      name: "Injected",
      kind: "injected",
      available: () => true,
      detail: { info: { rdns: "window.ethereum" } },
    };
    const metaMaskConnector = {
      id: "metamask",
      name: "MetaMask",
      kind: "injected",
      available: () => true,
      detail: { info: { rdns: "io.metamask" } },
    };
    const connectAsync = jest
      .fn()
      .mockResolvedValue({ address: "0xabc", chainId: 11155111 });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [genericConnector, metaMaskConnector],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const connectButton = await waitFor(() =>
      screen.getByText(/\[\s*connect\s*\]/i)
    );
    fireEvent.click(connectButton);
    await waitFor(() => {
      expect(connectAsync).toHaveBeenCalledWith({
        connector: metaMaskConnector,
      });
    });
  });

  test("connect CTA maps pending MetaMask request to actionable notice", async () => {
    const connectAsync = jest.fn().mockRejectedValue({
      code: -32002,
      message: "Request of type 'eth_requestAccounts' already pending",
    });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const connectButton = await waitFor(() =>
      screen.getByText(/\[\s*connect\s*\]/i)
    );
    fireEvent.click(connectButton);
    await waitFor(() => {
      expect(
        screen.getByText(/Open MetaMask and finish the pending request/i)
      ).toBeTruthy();
    });
  });

  test("shows wrong network notice when chain is incorrect", () => {
    mockWalletState = createWalletState({
      account: {},
      chainId: 1n,
      chain: { name: "Othernet" },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/Sepolia only/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*switch\s*\]/i)).toBeTruthy();
    });
  });

  test("switch CTA adds Sepolia when wallet reports unknown chain", async () => {
    const request = jest
      .fn()
      .mockRejectedValueOnce({ code: 4902, message: "Unknown chain" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (window as any).ethereum = { request };
    mockWalletState = createWalletState({
      account: {},
      chainId: 1n,
      chain: { name: "Othernet" },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const switchButton = await waitFor(() =>
      screen.getByText(/\[\s*switch\s*\]/i)
    );
    fireEvent.click(switchButton);
    await waitFor(() => {
      expect(request).toHaveBeenNthCalledWith(1, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      expect(request).toHaveBeenNthCalledWith(2, {
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          }),
        ],
      });
      expect(request).toHaveBeenNthCalledWith(3, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    });
  });

  test("preflight calls current price/balance/allowance with latest block tag", async () => {
    const calls: Array<{ args: any; blockId: any }> = [];
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any, blockId?: any) => {
      calls.push({ args, blockId });
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "10", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "1000", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "1000", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(mockCallContract).toHaveBeenCalledTimes(3);
    });
    const entrypoints = calls.map((call) => call.args.entrypoint);
    expect(entrypoints).toEqual([
      "get_current_price",
      "balance_of",
      "allowance",
    ]);
    expect(calls.every((call) => call.blockId === "latest")).toBe(true);
  });

  test("preflight resets on disconnect", async () => {
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    const { rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    await waitFor(() => {
      expect(screen.getByText(/Approve ETH/i)).toBeTruthy();
    });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(screen.queryByText(/Approve ETH/i)).toBeNull();
      expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    });
  });

  test("preflight reruns on address change", async () => {
    const addrA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const addrB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    mockWalletState = createWalletState({
      account: {},
      address: addrA,
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "10", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "1000", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "1000", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    const { rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    await waitFor(() => {
      expect(mockCallContract).toHaveBeenCalledTimes(3);
    });
    mockWalletState = createWalletState({
      account: {},
      address: addrB,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(mockCallContract).toHaveBeenCalledTimes(6);
    });
    const balanceCalls = mockCallContract.mock.calls.filter(
      ([args]) => args?.entrypoint === "balance_of"
    );
    expect(balanceCalls[1]?.[0]?.calldata?.[0]).toBe(addrB);
  });

  test("loading notice is debounced during preflight", async () => {
    jest.useFakeTimers();
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async () => new Promise(() => {}));
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText(/Loading/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(DELAY_MS - 50);
    });
    expect(screen.queryByText(/Loading/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByText(/Loading/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("rpc error notice honors startup grace", async () => {
    jest.useFakeTimers();
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        throw new Error("rpc failed");
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(STARTUP_GRACE_MS - 200);
    });
    expect(screen.queryByText(/RPC read failed/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByText(/RPC read failed/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows approval notice when allowance is low", async () => {
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(screen.getByText(/Approve ETH/i)).toBeTruthy();
    });
    expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeTruthy();
  });

  test("awaiting signature shows approve notice", async () => {
    const deferred = createDeferred<any>();
    const execute = jest.fn(() => deferred.promise);
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/Wallet open: Approve in wallet/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*sign\s*\]/i)).toBeTruthy();
    });
  });

  test("awaiting signature shows bid notice", async () => {
    const deferred = createDeferred<any>();
    const execute = jest.fn(() => deferred.promise);
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/Sign mint/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*sign\s*\]/i)).toBeTruthy();
    });
  });

  test("submitted approve shows pending notice", async () => {
    jest.useFakeTimers();
    const waitDeferred = createDeferred<void>();
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState = createWalletState({
      account: { execute, waitForTransaction: jest.fn(() => waitDeferred.promise) },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Submitted: Approval pending/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("submitted bid shows pending notice", async () => {
    jest.useFakeTimers();
    const waitDeferred = createDeferred<void>();
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState = createWalletState({
      account: { execute, waitForTransaction: jest.fn(() => waitDeferred.promise) },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Minting .* pending/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows invalid signature notice after mint failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest.fn().mockRejectedValue(new Error("invalid signature length"));
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(
          screen.getByText(/Account needs upgrade\/activation/i)
        ).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("shows user refused notice after mint failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest.fn().mockRejectedValue(new Error("USER_REFUSED_OP"));
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/Signature cancelled/i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("shows rpc read failed notice after invalid block id", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest.fn().mockRejectedValue(new Error("Invalid block id"));
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/RPC read failed/i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("shows rpc busy notice after fee tip stats failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest
      .fn()
      .mockRejectedValue(
        new Error(
          "Failed to analyze tip statistics (sequential): Failed to determine starting block number: Failed to fetch"
        )
      );
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/RPC busy\. Retry\./i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("shows overflow notice and re-preflights after overflow", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest.fn().mockRejectedValue(new Error("u256_sub Overflow"));
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/Insufficient ETH at execution/i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
      await waitFor(() => {
        expect(mockCallContract.mock.calls.length).toBeGreaterThanOrEqual(6);
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("shows fallback failure notice after mint error", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const execute = jest.fn().mockRejectedValue(new Error("boom"));
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/Mint failed\./i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("mint flow approves then bids when allowance is low", async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ transaction_hash: "0x1" })
      .mockResolvedValueOnce({ transaction_hash: "0x2" });
    mockWalletState.account = { execute };
    mockWalletState.watchAsset = jest.fn().mockResolvedValue(true);
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(2);
    });
    expect(execute.mock.calls[0][0].entrypoint).toBe("approve");
    expect(execute.mock.calls[1][0].entrypoint).toBe("bid");
    expect(mockWalletState.watchAsset).toHaveBeenCalled();
  });

  test("mint flow skips approve when allowance is sufficient", async () => {
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState.account = { execute };
    mockWalletState.watchAsset = jest.fn().mockResolvedValue(true);
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "150", high: "0" } } as any;
      }
      return { result: [] } as any;
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0][0].entrypoint).toBe("bid");
  });

  test("mint flow uses native ETH when payment token is zero address", async () => {
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState.account = { execute };
    mockWalletState.watchAsset = jest.fn().mockResolvedValue(true);
    (globalThis as any).__VITE_ENV__ = {
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PAYMENT_TOKEN: ZERO_ADDRESS,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
    };
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    mockGetBalance.mockResolvedValue(200n);

    render(<AuctionCanvas address={TEST_AUCTION_ADDRESS} provider={mockProvider as any} />);
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0][0]).toEqual({
      contractAddress: TEST_AUCTION_ADDRESS,
      entrypoint: "bid",
      calldata: ["100", "0"],
      value: 100n,
    });
    expect(mockWalletState.watchAsset).not.toHaveBeenCalled();
    expect(mockGetBalance.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("copied toast overrides notice then returns", async () => {
    jest.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    mockWalletState = createWalletState({
      account: {},
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    await waitFor(() => {
      expect(screen.getByText(/Approve ETH/i)).toBeTruthy();
    });
    const dotButton = container.querySelector(
      ".dotfield__cta-address"
    ) as HTMLElement;
    fireEvent.click(dotButton);
    const copyButton = screen.getByText(/copy address/i);
    await act(async () => {
      fireEvent.click(copyButton);
    });
    expect(screen.getByText(/Copied/i)).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Approve ETH/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("disconnect toast shows and resets CTA", async () => {
    jest.useFakeTimers();
    mockWalletState = createWalletState({
      account: {},
    });
    const { container, rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const dotButton = container.querySelector(
      ".dotfield__cta-address"
    ) as HTMLElement;
    fireEvent.click(dotButton);
    const disconnectButton = screen.getByText(/disconnect/i);
    await act(async () => {
      fireEvent.click(disconnectButton);
    });
    expect(screen.getByText(/Disconnected/i)).toBeTruthy();
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    act(() => {
      jest.advanceTimersByTime(DELAY_MS + 20);
    });
    expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows minted toast after confirmation when bid appears", async () => {
    jest.useFakeTimers();
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0xmint" });
    const waitForTransaction = jest.fn().mockResolvedValue({});
    mockWalletState = createWalletState({
      account: { execute, waitForTransaction },
    });
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "200", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    mockUseAuctionBids.mockReturnValue({
      bids: sampleBids,
      ready: true,
      loading: false,
      error: null,
    });
    const { rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/Confirmed\./i)).toBeTruthy();
    });
    const mintedBid = {
      key: "tx:0xmint",
      atMs: Date.UTC(2025, 0, 1, 2),
      amount: { raw: { low: "3", high: "0" }, dec: "3", value: 3n },
      bidder: mockWalletState.address,
      blockNumber: 12,
      epochIndex: 5,
      tokenId: 5,
      txHash: "0xmint",
    };
    mockUseAuctionBids.mockReturnValue({
      bids: [...sampleBids, mintedBid],
      ready: true,
      loading: false,
      error: null,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Minted #5/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows inline error when balance is insufficient", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState.account = { execute };
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "100", high: "0" } } as any;
      }
      if (args?.entrypoint === "balance_of") {
        return { balance: { low: "50", high: "0" } } as any;
      }
      if (args?.entrypoint === "allowance") {
        return { remaining: { low: "0", high: "0" } } as any;
      }
      return { result: [] } as any;
    });

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(screen.getByText(/Need .* have/i)).toBeTruthy();
      });
      expect(mintButton).toBeDisabled();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

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
const DEFAULT_WALLET_ADDRESS = "0x1111222233334444555566667777888899990000";

function normalizeMockChainId(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = trimmed.startsWith("0x")
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function stubSvgRect(container: HTMLElement) {
  const svg = container.querySelector("svg") as any;
  if (!svg) return;
  svg.getScreenCTM = () => null;
  svg.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 1000,
    bottom: 600,
    width: 1000,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const createWalletState = (overrides: Partial<any> = {}) => {
  const evmOverrides = overrides.evm ?? {};
  const address =
    overrides.address === undefined ? DEFAULT_WALLET_ADDRESS : overrides.address;
  const chainId = overrides.chainId === undefined ? 11155111n : overrides.chainId;
  const isConnected = overrides.isConnected ?? Boolean(address);
  const base = {
    address,
    isConnected,
    isConnecting: false,
    isReconnecting: false,
    status: isConnected ? "connected" : "disconnected",
    chain: { name: "Sepolia" },
    chainId,
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
    ...overrides,
  };
  return {
    ...base,
    evm: {
      providers: [],
      address:
        evmOverrides.address !== undefined ? evmOverrides.address : base.address,
      chainId:
        evmOverrides.chainId !== undefined
          ? evmOverrides.chainId
          : normalizeMockChainId(base.chainId),
      providerName:
        evmOverrides.providerName !== undefined
          ? evmOverrides.providerName
          : base.address
            ? "Ready"
            : null,
      isConnected:
        evmOverrides.isConnected !== undefined
          ? evmOverrides.isConnected
          : Boolean(base.isConnected && base.address),
      error: null,
      connectInjected: jest.fn(),
      connectWalletConnectV2: jest.fn(),
      disconnect: jest.fn(),
      ...evmOverrides,
    },
  };
};
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

async function clickMintForReview() {
  const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
  await waitFor(() => {
    expect(mintButton).not.toBeDisabled();
  });
  await act(async () => {
    fireEvent.click(mintButton);
  });
  return waitFor(() => screen.getByText(/\[\s*confirm\s*\]/i));
}

async function clickMintThenSign() {
  const signButton = await clickMintForReview();
  await act(async () => {
    fireEvent.click(signButton);
  });
}

describe("AuctionCanvas", () => {
  beforeEach(() => {
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
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
    window.localStorage.removeItem("inshellDebug");
    window.history.pushState({}, "", "/");
  });

  test("renders mint button and dots", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(screen.getByRole("link", { name: "$PATH" })).toHaveAttribute("href", "/path");
    expect(screen.getByRole("link", { name: "$PATH" })).toHaveAttribute("target", "_blank");
    expect(screen.queryByRole("navigation", { name: "Inshell dapps" })).toBeNull();
    expect(container.querySelector(".dotfield__mint")).toBeTruthy();

    const dots = container.querySelectorAll(".dotfield__point, .dotfield__now-dot");
    expect(dots.length).toBeGreaterThan(0);
  });

  test("renders current price in the dedicated now dot tooltip", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(container.querySelector(".dotfield__now-label")).toBeNull();

    const now = container.querySelector(".dotfield__point--now") as HTMLElement | null;
    expect(now).toBeTruthy();
    fireEvent.mouseEnter(now as HTMLElement, { clientX: 100, clientY: 100 });

    const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
    expect(popover).toBeTruthy();
    expect(within(popover as HTMLElement).getByText("current ask")).toBeInTheDocument();
    expect(within(popover as HTMLElement).getByText("price")).toBeInTheDocument();
    expect(within(popover as HTMLElement).getByText("above floor")).toBeInTheDocument();
  });

  test("keeps now dot on the padded right edge after clock ticks", () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 99;
    const oneEth = 10n ** 18n;
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: nowSec - 109,
      genesisPrice: { dec: (2n * oneEth).toString() },
      genesisFloor: { dec: oneEth.toString() },
      k: { dec: (100n * oneEth).toString() },
      pts: oneEth.toString(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: saleSec * 1000,
          amount: {
            raw: { low: (15n * oneEth / 10n).toString(), high: "0" },
            dec: (15n * oneEth / 10n).toString(),
            value: 15n * oneEth / 10n,
          },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    try {
      const { container } = render(
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      );
      const readNowLeft = () => {
        const now = container.querySelector(
          ".dotfield__point--now"
        ) as HTMLElement | null;
        expect(now).toBeTruthy();
        return Number.parseFloat(now?.style.left ?? "NaN");
      };
      const initialLeft = readNowLeft();
      expect(initialLeft).toBeGreaterThan(95);
      expect(initialLeft).toBeLessThan(99);
      act(() => {
        jest.advanceTimersByTime(1200);
      });
      expect(readNowLeft()).toBeCloseTo(initialLeft, 4);
    } finally {
      jest.useRealTimers();
    }
  });

  test("keeps user zoom while devnet mimics time", () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 99;
    const oneEth = 10n ** 18n;
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a69",
      VITE_ETH_RPC: "http://127.0.0.1:8546",
      VITE_WALLET_CHAIN_RPC_URL: "",
    };
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: nowSec - 109,
      genesisPrice: { dec: (2n * oneEth).toString() },
      genesisFloor: { dec: oneEth.toString() },
      k: { dec: (100n * oneEth).toString() },
      pts: oneEth.toString(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: saleSec * 1000,
          amount: {
            raw: { low: (15n * oneEth / 10n).toString(), high: "0" },
            dec: (15n * oneEth / 10n).toString(),
            value: 15n * oneEth / 10n,
          },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    try {
      const { container } = render(
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      );
      stubSvgRect(container);
      const svg = screen.getByRole("img", {
        name: /pulse auction curve/i,
      }) as HTMLElement;
      const readNow = () => container.querySelector(".dotfield__point--now");
      expect(readNow()).toBeTruthy();

      fireEvent.wheel(svg, { deltaY: -120, clientX: 500, clientY: 300 });
      expect(readNow()).toBeNull();

      act(() => {
        jest.advanceTimersByTime(1200);
      });
      expect(readNow()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test("keeps current ask visible at the right edge while panning", () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 99;
    const oneEth = 10n ** 18n;
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: nowSec - 109,
      genesisPrice: { dec: (2n * oneEth).toString() },
      genesisFloor: { dec: oneEth.toString() },
      k: { dec: (100n * oneEth).toString() },
      pts: oneEth.toString(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: saleSec * 1000,
          amount: {
            raw: { low: (15n * oneEth / 10n).toString(), high: "0" },
            dec: (15n * oneEth / 10n).toString(),
            value: 15n * oneEth / 10n,
          },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    try {
      const { container } = render(
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      );
      stubSvgRect(container);
      const canvas = container.querySelector(".dotfield__canvas") as HTMLElement;
      const readNowLeft = () => {
        const now = container.querySelector(
          ".dotfield__point--now"
        ) as HTMLElement | null;
        expect(now).toBeTruthy();
        return Number.parseFloat(now?.style.left ?? "NaN");
      };

      const initialLeft = readNowLeft();
      expect(initialLeft).toBeGreaterThan(95);
      act(() => {
        fireEvent.pointerDown(canvas, {
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
          clientX: 500,
          clientY: 300,
        });
        fireEvent.pointerMove(canvas, {
          pointerId: 1,
          pointerType: "mouse",
          clientX: 0,
          clientY: 300,
        });
        fireEvent.pointerUp(canvas, {
          pointerId: 1,
          pointerType: "mouse",
          clientX: 0,
          clientY: 300,
        });
      });
      expect(readNowLeft()).toBeCloseTo(initialLeft, 4);
    } finally {
      jest.useRealTimers();
    }
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

  test("keeps sparse tiny live sales visible while focusing active window", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const openTimeSec = nowSec - 1_000_000;
    const sale1Sec = openTimeSec + 500_000;
    const sale2Sec = nowSec - 250_000;
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec,
      genesisPrice: { dec: "1000" },
      genesisFloor: { dec: "900" },
      k: { dec: "600" },
      pts: "1",
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: sale1Sec * 1000,
          amount: { raw: { low: "950", high: "0" }, dec: "950", value: 950n },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
        {
          key: "b2",
          atMs: sale2Sec * 1000,
          amount: { raw: { low: "975", high: "0" }, dec: "975", value: 975n },
          bidder: "0x2222222222222222",
          blockNumber: 11,
          epochIndex: 2,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    expect(container.querySelectorAll(".dotfield__curve").length).toBeLessThan(3);
    expect(container.querySelectorAll(".dotfield__context-curve")).toHaveLength(1);
    expect(container.querySelectorAll(".dotfield__point--sale")).toHaveLength(2);
    expect(container.querySelectorAll(".dotfield__point--opening-floor")).toHaveLength(1);
    expect(container.querySelectorAll(".dotfield__point--ask").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll(".dotfield__pump")).toHaveLength(2);
  });

  test("spreads compressed sale history when eleven live sales would collapse at the left edge", () => {
    const eth = 10n ** 18n;
    const rawEth = (hundredths: number) =>
      ((BigInt(hundredths) * eth) / 100n).toString();
    const nowSec = Math.floor(Date.now() / 1000);
    const openTimeSec = nowSec - 2_000_000;
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec,
      genesisPrice: { dec: rawEth(30) },
      genesisFloor: { dec: rawEth(20) },
      k: { dec: (100n * eth).toString() },
      pts: eth.toString(),
    });
    const bids = Array.from({ length: 11 }, (_, index) => {
      const saleSec = openTimeSec + 60 * (index + 1);
      const price = rawEth(32 + index);
      return {
        key: `b${index + 1}`,
        atMs: saleSec * 1000,
        amount: {
          raw: { low: price, high: "0" },
          dec: price,
          value: BigInt(price),
        },
        bidder: `0x${String(index + 1).padStart(40, "0")}`,
        blockNumber: 10 + index,
        epochIndex: index + 1,
        anchorASec: saleSec - 1000,
      };
    });
    mockUseAuctionBids.mockReturnValue({
      bids,
      ready: true,
      loading: false,
      error: null,
    });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    expect(container.querySelectorAll(".dotfield__context-curve")).toHaveLength(11);
    expect(container.querySelectorAll(".dotfield__point--sale")).toHaveLength(11);
    expect(container.querySelector(".dotfield__point--now")).toBeTruthy();
  });

  test("keeps live sale history readable when a completed curve has an extreme start ask", () => {
    const eth = 10n ** 18n;
    const nowSec = 1779616315;
    const openTimeSec = 1778804388;
    const liveSales: Array<[number, number, string, number]> = [
      [1, 1778810988, "114900908955446282", 1778810837],
      [2, 1778811936, "205892719692479948", 1778810882],
      [3, 1778822412, "214565746578863295", 1778822317],
      [4, 1778887080, "216109838112609415", 1778887065],
      [5, 1778942184, "217924094539612807", 1778942166],
      [6, 1779003456, "219555682074284042", 1779003440],
      [7, 1779350664, "219843680599731591", 1779350662],
      [8, 1779356184, "237953061258913046", 1779356003],
      [9, 1779360264, "261421730585362236", 1779360019],
      [10, 1779361704, "320768911594264313", 1779361010],
      [11, 1779439008, "322050995750268313", 1779438996],
    ];
    try {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(nowSec * 1000));
      mockAuctionCore(mockUseAuctionCore, {
        openTimeSec,
        genesisPrice: { dec: eth.toString() },
        genesisFloor: { dec: (eth / 10n).toString() },
        k: { dec: (100n * eth).toString() },
        pts: (eth / 10_000n).toString(),
      });
      mockUseAuctionBids.mockReturnValue({
        bids: liveSales.map(([epochIndex, saleSec, price, anchorASec]) => ({
          key: `b${epochIndex}`,
          atMs: saleSec * 1000,
          amount: {
            raw: { low: price, high: "0" },
            dec: price,
            value: BigInt(price),
          },
          bidder: `0x${String(epochIndex).padStart(40, "0")}`,
          blockNumber: 100 + epochIndex,
          epochIndex,
          anchorASec,
        })),
        ready: true,
        loading: false,
        error: null,
      });

      const { container } = render(
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      );
      const salePoints = Array.from(
        container.querySelectorAll<HTMLElement>(".dotfield__point--sale")
      );
      const yValues = salePoints
        .map((point) => Number(point.dataset.y))
        .filter(Number.isFinite);
      const pumpYValues = Array.from(
        container.querySelectorAll(".dotfield__pump")
      ).flatMap((line) => [
        Number(line.getAttribute("y1")),
        Number(line.getAttribute("y2")),
      ]);
      const curveYValues = Array.from(
        container.querySelectorAll(".dotfield__curve, .dotfield__context-curve")
      ).flatMap((path) => {
        const nums = (path.getAttribute("d")?.match(/-?\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?/gi) ?? [])
          .map(Number)
          .filter(Number.isFinite);
        return nums.filter((_, index) => index % 2 === 1);
      });

      expect(salePoints).toHaveLength(11);
      expect(yValues).toHaveLength(11);
      expect(container.querySelectorAll(".dotfield__curve--muted-history").length)
        .toBeGreaterThan(0);
      expect(
        [...pumpYValues, ...curveYValues].every((y) => y >= 0 && y <= 60)
      ).toBe(true);
      const pumpSpans = Array.from(
        container.querySelectorAll(".dotfield__pump")
      ).map((line) =>
        Math.abs(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1")))
      );
      expect(Math.max(0, ...pumpSpans)).toBeLessThanOrEqual(18);
    } finally {
      jest.useRealTimers();
    }
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
    expect(container.querySelector(".dotfield__popover")).toBeTruthy();

    fireEvent.mouseLeave(dotButton as HTMLElement);
    expect(container.querySelector(".dotfield__popover")).toBeTruthy();

    fireEvent.click(svg as HTMLElement, {
      clientX: 980,
      clientY: 580,
    });

    await waitFor(() => {
      expect(container.querySelector(".dotfield__point--sale.is-selected")).toBeNull();
    });
    expect(container.querySelector(".dotfield__popover")).toBeNull();
  });

  test("clicking current ask pins its tooltip until blank click", async () => {
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

    const nowButton = container.querySelector(
      ".dotfield__point--now"
    ) as HTMLElement | null;
    expect(nowButton).toBeTruthy();
    fireEvent.click(nowButton as HTMLElement);
    expect(nowButton?.classList.contains("is-selected")).toBe(true);
    expect(screen.getByText(/current ask/i)).toBeTruthy();

    fireEvent.mouseLeave(nowButton as HTMLElement);
    expect(screen.getByText(/current ask/i)).toBeTruthy();

    fireEvent.click(svg as HTMLElement, {
      clientX: 980,
      clientY: 580,
    });

    await waitFor(() => {
      expect(container.querySelector(".dotfield__point--now.is-selected")).toBeNull();
    });
    expect(container.querySelector(".dotfield__popover")).toBeNull();
  });

  test("dragging canvas clears selected sale tooltip", async () => {
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
    expect(container.querySelector(".dotfield__popover")).toBeTruthy();

    fireEvent.pointerDown(svg as HTMLElement, {
      clientX: 900,
      clientY: 300,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
    });
    fireEvent.pointerMove(svg as HTMLElement, {
      clientX: 850,
      clientY: 300,
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() => {
      expect(container.querySelector(".dotfield__point--sale.is-selected")).toBeNull();
    });
    expect(container.querySelector(".dotfield__popover")).toBeNull();
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

  test("hover near first start ask area shows opening ask tooltip", async () => {
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
        within(popover as HTMLElement).getByText(/ask when the auction opens/i)
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
        within(popover as HTMLElement).getByText(/ask when the auction opens/i)
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
        within(popover as HTMLElement).getByText(/ask when the auction opens/i)
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
      expect(
        within(popover as HTMLElement).getByText(
          /mints one \$PATH and starts the next curve/i
        )
      ).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^next floor b$/i)).toBeNull();
    });
  });

  test("start ask tooltip explains floor b comes from the last sale", async () => {
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
      openTimeSec: Date.UTC(2024, 11, 31, 23, 55) / 1000,
      genesisPrice: { dec: "40" },
      genesisFloor: { dec: "10" },
      k: { dec: "1000000" },
      pts: "1",
    });
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} decimals={0} />
    );
    const startAskDot = container.querySelector(
      '.dotfield__point--ask[data-dot-key="ask#2"]'
    ) as HTMLElement | null;
    expect(startAskDot).toBeTruthy();
    fireEvent.mouseMove(startAskDot as HTMLElement, {
      clientX: 8,
      clientY: 8,
    });
    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover") as HTMLElement | null;
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^start ask$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^floor b$/i)).toBeTruthy();
      expect(
        within(popover as HTMLElement).getByText(/price = floor b \+ time premium/i)
      ).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/floor b = last sale/i)).toBeTruthy();
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
      const durationRow = within(popover as HTMLElement).getByText(/^duration$/i)
        .parentElement;
      expect(durationRow?.textContent).toMatch(/^duration\d+s$/i);
      expect(within(popover as HTMLElement).getByText(/^PTS \(ETH\/s\)$/i)).toBeTruthy();
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

  test("shows no deployment message when no protocol release is loaded", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "mainnet",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PAYMENT_TOKEN: TEST_PAYMENT_TOKEN,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
    };
    mockUseAuctionCore.mockReturnValue({
      data: null,
      ready: false,
      loading: false,
      error: null,
      refresh: jest.fn(),
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/No PATH deployment loaded/i)).toBeTruthy();
    expect(screen.getByText(/PATH auction not loaded/i)).toBeTruthy();
    expect(mockUseAuctionCore).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
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
    expect(screen.getByText(/curve error/i)).toBeTruthy();
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

  test("does not block active curve while bid history backfill is pending", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: true,
        price: { dec: "1500000000000000000" },
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 60,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "100000000000000000" },
          k: { dec: "10000000000000000000" },
          pts: "1000000000000000000",
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
    const { container } = render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.queryByText(/loading curve/i)).toBeNull();
    expect(screen.queryByText(/Loading sale history/i)).toBeNull();
    expect(container.querySelector(".dotfield__curve")).toBeTruthy();
  });

  test("renders active curve from contract state before sale history finishes", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: true,
        price: { dec: "1200000000000000000" },
        config: {
          openTimeSec: nowSec - 120,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "100000000000000000" },
          k: { dec: "10000000000000000000" },
          pts: "1000000000000000000",
        },
        state: {
          epochIndex: 1,
          startTimeSec: nowSec - 10,
          anchorTimeSec: nowSec - 20,
          floorPrice: { dec: "500000000000000000" },
          active: true,
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
    const { container } = render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.queryByText(/Loading sale history/i)).toBeNull();
    expect(container.querySelector(".dotfield__curve")).toBeTruthy();
  });

  test("keeps active state from contract state when sale history backfill errors", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        price: { dec: "1200000000000000000" },
        config: {
          openTimeSec: nowSec - 120,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "100000000000000000" },
          k: { dec: "10000000000000000000" },
          pts: "1000000000000000000",
        },
        state: {
          epochIndex: 6,
          startTimeSec: nowSec - 10,
          anchorTimeSec: nowSec - 20,
          floorPrice: { dec: "500000000000000000" },
          active: false,
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
      error: new Error("history backfill too broad"),
    });
    const { container } = render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.queryByText(/Waiting for first bid/i)).toBeNull();
    expect(container.querySelector(".dotfield__curve")).toBeTruthy();
  });

  test("shows open waiting message even if inactive bid backfill is pending", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        price: { dec: "900000000000000000" },
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 60,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "100000000000000000" },
          k: { dec: "10000000000000000000" },
          pts: "1000000000000000000",
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
    const { container } = render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.queryByText(/loading curve/i)).toBeNull();
    expect(screen.getByText(/Waiting for first bid/i)).toBeTruthy();
    expect(container.textContent).toMatch(/Current ask:\s*[0-9.]+\s*ETH/i);
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
    expect(screen.getByText(/Current ask: 1 ETH/i)).toBeTruthy();
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
    expect(screen.getByText(/Current ask: 0\.0000000000000009 ETH/i)).toBeTruthy();
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
    expect(screen.getByText(/Auction opens at/i)).toBeTruthy();
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
    expect(screen.getByText(/Auction opens at/i)).toBeTruthy();
  });

  test("disables mint before open time", async () => {
    const execute = jest.fn();
    mockWalletState = createWalletState({
      account: { execute },
    });
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: false,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) + 3600,
          genesisPrice: { dec: "100" },
          genesisFloor: { dec: "10" },
          k: { dec: "1000" },
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
    const mintButton = await waitFor(() =>
      screen.getByText(/\[\s*mint\s*\]/i)
    );
    await waitFor(() => {
      expect(mintButton).toBeDisabled();
    });
    expect(screen.getByText(/Auction opens at/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(mintButton);
    });
    expect(execute).not.toHaveBeenCalled();
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

  test("sepolia invite shows testnet notice and hides debug by default", () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new",
      VITE_DEBUG_PANEL: "off",
    };
    (globalThis as any).__PULSE_DEBUG__ = true;

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    expect(screen.getByText("Sepolia testnet only.")).toBeTruthy();
    expect(screen.queryByText(/^debug$/i)).toBeNull();
  });

  test("sepolia invite wrong network uses exact testnet notice", () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new",
      VITE_DEBUG_PANEL: "off",
    };
    mockWalletState = createWalletState({
      account: {},
      chainId: 1n,
      chain: { name: "Othernet" },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    return waitFor(() => {
      expect(screen.getByText("Sepolia testnet only.")).toBeTruthy();
      expect(screen.getByText(/\[\s*switch\s*\]/i)).toBeTruthy();
      expect(screen.queryByText(/Sepolia only/i)).toBeNull();
    });
  });

  test("sepolia invite no-wallet failure exposes contextual report bug link", () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md",
      VITE_DEBUG_PANEL: "off",
    };
    mockWalletState = createWalletState({
      connectors: [],
      address: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    return waitFor(() => {
      expect(screen.getByText(/No supported wallet found/i)).toBeTruthy();
      const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
      expect(report).toHaveTextContent("report bug ↗");
      const url = new window.URL(report.getAttribute("href") ?? "");
      expect(url.searchParams.get("body")).toContain("state: no_supported_wallet");
      expect(url.searchParams.get("body")).toContain("Remove anything private");
    });
  });

  test("shows connect CTA when wallet is locked", () => {
    mockWalletState = createWalletState({
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    });
  });

  test("locked wallet connect CTA requests accounts before reconnect", async () => {
    const requestAccounts = jest.fn().mockResolvedValue(["0xabc"]);
    mockWalletState = createWalletState({
      account: null,
      accountMissing: true,
      requestAccounts,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const connectButton = await waitFor(() =>
      screen.getByText(/\[\s*connect\s*\]/i)
    );
    fireEvent.click(connectButton);
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

  test("connect CTA opens supported wallet options sorted with MetaMask first", async () => {
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
    const rabbyConnector = {
      id: "rabby",
      name: "Rabby Wallet",
      kind: "injected",
      available: () => true,
      detail: { info: { rdns: "io.rabby" } },
    };
    const templeConnector = {
      id: "temple",
      name: "Temple Wallet",
      kind: "injected",
      available: () => true,
      detail: { info: { rdns: "com.templewallet" } },
    };
    const connectAsync = jest
      .fn()
      .mockResolvedValue({ address: "0xabc", chainId: 11155111 });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [genericConnector, templeConnector, rabbyConnector, metaMaskConnector],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const connectButton = await waitFor(() =>
      screen.getByText(/\[\s*connect\s*\]/i)
    );
    fireEvent.click(connectButton);
    const options = await screen.findAllByRole("menuitem");
    const note = document.querySelector(".dotfield__wallet-picker-note") as HTMLElement;
    expect(note).toBeTruthy();
    expect(note).toHaveTextContent("New dapp? Wallet may warn.");
    expect(
      note
    ).toHaveTextContent("Verify domain and action before continuing.");
    expect(screen.getByRole("link", { name: "verify ↗" })).toHaveAttribute(
      "href",
      "/verify",
    );
    expect(options.map((item) => item.textContent)).toEqual([
      "MetaMask",
      "Rabby Wallet",
    ]);
    fireEvent.click(options[0]);
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
        screen.getByText(/Finish the pending wallet request/i)
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
      expect(screen.getByText(/Sepolia(?: testnet)? only/i)).toBeTruthy();
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

  test("switch CTA does not register the read-only dapp RPC with wallets", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_ETH_RPC: "/api/eth-rpc",
      VITE_WALLET_CHAIN_RPC_URL: "",
    };
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
      expect(request).toHaveBeenNthCalledWith(2, {
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0xaa36a7",
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          }),
        ],
      });
    });
  });

  test("switch CTA uses explicit wallet chain RPC when configured", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_ETH_RPC: "/api/eth-rpc",
      VITE_WALLET_CHAIN_RPC_URL: "https://wallet-rpc.example/sepolia",
    };
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
      expect(request).toHaveBeenNthCalledWith(2, {
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0xaa36a7",
            rpcUrls: ["https://wallet-rpc.example/sepolia"],
          }),
        ],
      });
    });
  });

  test("refreshes Sepolia wallet RPC before mint writes", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_ETH_RPC: "/api/eth-rpc",
      VITE_WALLET_CHAIN_RPC_URL: "",
    };
    const request = jest.fn().mockResolvedValue(null);
    (window as any).ethereum = { request };
    const execute = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ transaction_hash: "0xmint" });
    mockWalletState = createWalletState({
      account: { execute },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();

    await waitFor(() => {
      expect(execute).toHaveBeenCalled();
      expect(request).toHaveBeenCalledWith({
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0xaa36a7",
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          }),
        ],
      });
    });
  });

  test("switch CTA adds PATH Local when devnet wallet reports unknown chain", async () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a6a",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
      VITE_PAYMENT_TOKEN: TEST_PAYMENT_TOKEN,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
      VITE_ETH_RPC: "http://127.0.0.1:8546",
      VITE_WALLET_CHAIN_RPC_URL: "",
      VITE_PUBLIC_LAUNCH_MODE: "local",
    };
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
    await waitFor(() => {
      expect(screen.getByText(/PATH Local only/i)).toBeTruthy();
    });
    const switchButton = await waitFor(() =>
      screen.getByText(/\[\s*switch\s*\]/i)
    );
    fireEvent.click(switchButton);
    await waitFor(() => {
      expect(request).toHaveBeenNthCalledWith(1, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a6a" }],
      });
      expect(request).toHaveBeenNthCalledWith(2, {
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0x7a6a",
            chainName: "PATH Local",
            rpcUrls: ["http://127.0.0.1:8546"],
          }),
        ],
      });
      expect(request).toHaveBeenNthCalledWith(3, {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a6a" }],
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
    expect(screen.queryByText(/Checking mint state/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(DELAY_MS - 50);
    });
    expect(screen.queryByText(/Checking mint state/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByText(/Checking mint state/i)).toBeTruthy();
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

  test("first mint click shows transaction review before wallet", async () => {
    const execute = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ transaction_hash: "0x1" });
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
    await clickMintForReview();
    const review = screen.getByText(/review before wallet/i).closest(".dotfield__mint-review");
    expect(review).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/current ask/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/max bid/i)).toBeTruthy();
    expect(
      within(review as HTMLElement).getByText(/verify domain, chain, and action in wallet/i)
    ).toBeTruthy();
    expect(within(review as HTMLElement).getByRole("link", { name: "verify ↗" })).toHaveAttribute(
      "href",
      "/verify",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  test("sepolia invite mint review shows public labels and testnet notice", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new",
      VITE_DEBUG_PANEL: "off",
    };
    const execute = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ transaction_hash: "0x1" });
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
    await clickMintForReview();

    const review = screen.getByText(/review before wallet/i).closest(".dotfield__mint-review");
    expect(review).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/current ask/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/tx value/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/max bid/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/max charge/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/network gas/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText("Sepolia testnet only.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Report a Sepolia bug" })).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  test("confirmed mint reopens the current ask tooltip on the next curve", async () => {
    const execute = jest
      .fn<(...args: any[]) => Promise<any>>()
      .mockResolvedValue({ transaction_hash: "0xmint" });
    mockWalletState = createWalletState({
      account: { execute },
    });
    let bids: any[] = [...sampleBids];
    mockUseAuctionBids.mockImplementation(() => ({
      bids,
      ready: true,
      loading: false,
      error: null,
      pullOnce: jest.fn(async () => bids),
    }));

    const { container, rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    stubSvgRect(container);

    await waitFor(() => {
      expect(container.querySelector(".dotfield__popover")).toBeTruthy();
    });
    expect(
      within(container.querySelector(".dotfield__popover") as HTMLElement).getByText(
        /current ask/i
      )
    ).toBeTruthy();

    const svg = container.querySelector("svg") as unknown as HTMLElement;
    fireEvent.click(svg, { clientX: 900, clientY: 40 });
    await waitFor(() => {
      expect(container.querySelector(".dotfield__popover")).toBeNull();
    });

    await clickMintForReview();
    await act(async () => {
      fireEvent.click(screen.getByText(/\[\s*confirm\s*\]/i));
    });
    await waitFor(() => {
      expect(execute).toHaveBeenCalled();
    });

    bids = [
      ...bids,
      {
        key: "b3",
        atMs: SAMPLE_BASE_MS + 120 * 1000,
        amount: { raw: { low: "3", high: "0" }, dec: "3", value: 3n },
        amountDec: "3",
        bidder: mockWalletState.address,
        blockNumber: 12,
        epochIndex: 3,
        txHash: "0xmint",
      },
    ];
    await act(async () => {
      rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    });

    await waitFor(() => {
      const popover = container.querySelector(".dotfield__popover");
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/current ask/i)).toBeTruthy();
    });
  });

  test("devnet mint review and bid use the local time-mimicked current ask", async () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 60;
    const oneEth = 10n ** 18n;
    const visualAsk =
      1.2 + 0.06 / (1 + 60 / (100 / 0.06));
    const visualAskWei = BigInt(visualAsk.toFixed(18).replace(".", ""));
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a69",
      VITE_ETH_RPC: "http://127.0.0.1:8546",
      VITE_WALLET_CHAIN_RPC_URL: "",
      VITE_PAYTOKEN: ZERO_ADDRESS,
      VITE_PUBLIC_LAUNCH_MODE: "local",
    };
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState = createWalletState({
      chain: { name: "Anvil" },
      chainId: 31337n,
      account: { execute },
    });
    mockGetBalance.mockResolvedValue(10n * oneEth);
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        return { price: { low: "5349700000000000000", high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: nowSec - 120,
      genesisPrice: { dec: (2n * oneEth).toString() },
      genesisFloor: { dec: oneEth.toString() },
      k: { dec: (100n * oneEth).toString() },
      pts: "1000000000000000",
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: saleSec * 1000,
          amount: {
            raw: { low: "1200000000000000000", high: "0" },
            dec: "1200000000000000000",
            value: 1_200_000_000_000_000_000n,
          },
          amountDec: "1.2",
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      await clickMintForReview();
      const review = screen.getByText(/review before wallet/i).closest(".dotfield__mint-review");
      expect(review).toBeTruthy();
      const rows = Array.from(
        (review as HTMLElement).querySelectorAll(".dotfield__mint-review-row")
      );
      const currentAskRow = rows.find((row) => row.textContent?.includes("current ask"));
      const txValueRow = rows.find((row) => row.textContent?.includes("tx value"));
      const maxBidRow = rows.find((row) => row.textContent?.includes("max bid"));
      expect(currentAskRow?.textContent).toContain(`${visualAsk.toFixed(8)} ETH`);
      expect(txValueRow?.textContent).toContain(`${visualAsk.toFixed(8)} ETH`);
      expect(maxBidRow?.textContent).toContain(`${visualAsk.toFixed(8)} ETH`);

      await act(async () => {
        fireEvent.click(screen.getByText(/\[\s*confirm\s*\]/i));
      });
      await waitFor(() => {
        expect(execute).toHaveBeenCalled();
      });
      const bidCall = execute.mock.calls.find(
        ([call]) => (call as any)?.entrypoint === "bid"
      )?.[0] as any;
      expect(bidCall).toBeTruthy();
      expect(bidCall.value).toBe(visualAskWei);
      expect(BigInt(bidCall.calldata[0])).toBe(visualAskWei);
    } finally {
      jest.useRealTimers();
    }
  });

  test("confirm reruns preflight and bids the refreshed live ask", async () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 60;
    const oneEth = 10n ** 18n;
    const initialAsk = 1n * oneEth;
    const reviewAsk = 2n * oneEth;
    const confirmAsk = 3n * oneEth;
    const askQueue = [initialAsk, reviewAsk, confirmAsk];
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_ETH_RPC: "http://127.0.0.1:8546",
      VITE_PAYTOKEN: ZERO_ADDRESS,
      VITE_PAYMENT_TOKEN: ZERO_ADDRESS,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
    };
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState = createWalletState({
      chain: { name: "Sepolia" },
      chainId: 11155111n,
      account: { execute },
    });
    mockGetBalance.mockResolvedValue(10n * oneEth);
    mockCallContract.mockReset();
    mockCallContract.mockImplementation(async (args: any) => {
      if (args?.entrypoint === "get_current_price") {
        const price = askQueue.shift() ?? confirmAsk;
        return { price: { low: price.toString(), high: "0" } } as any;
      }
      return { result: [] } as any;
    });
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: nowSec - 120,
      genesisPrice: { dec: (2n * oneEth).toString() },
      genesisFloor: { dec: oneEth.toString() },
      k: { dec: (100n * oneEth).toString() },
      pts: "1000000000000000",
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: saleSec * 1000,
          amount: {
            raw: { low: "1200000000000000000", high: "0" },
            dec: "1200000000000000000",
            value: 1_200_000_000_000_000_000n,
          },
          amountDec: "1.2",
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      await clickMintForReview();
      const review = screen.getByText(/review before wallet/i).closest(".dotfield__mint-review");
      expect(review).toBeTruthy();
      const rows = Array.from(
        (review as HTMLElement).querySelectorAll(".dotfield__mint-review-row")
      );
      const currentAskRow = rows.find((row) => row.textContent?.includes("current ask"));
      expect(currentAskRow?.textContent).toMatch(/3(?:\.0+)? ETH/);

      await act(async () => {
        fireEvent.click(screen.getByText(/\[\s*confirm\s*\]/i));
      });
      await waitFor(() => {
        expect(execute).toHaveBeenCalled();
      });
      const bidCall = execute.mock.calls.find(
        ([call]) => (call as any)?.entrypoint === "bid"
      )?.[0] as any;
      expect(bidCall).toBeTruthy();
      expect(bidCall.value).toBe(confirmAsk);
      expect(BigInt(bidCall.calldata[0])).toBe(confirmAsk);
    } finally {
      jest.useRealTimers();
    }
  });

  test("clicking outside the mint review dismisses it", async () => {
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    mockWalletState = createWalletState({
      account: { execute },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintForReview();
    expect(screen.getByText(/review before wallet/i)).toBeTruthy();

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    await waitFor(() => {
      expect(screen.queryByText(/review before wallet/i)).toBeNull();
      expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeTruthy();
    });
    expect(execute).not.toHaveBeenCalled();
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
    await clickMintThenSign();
    await waitFor(() => {
      expect(screen.getByText(/Wallet open: approve ETH/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
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
    await clickMintThenSign();
    await waitFor(() => {
      expect(screen.getByText(/Wallet open: confirm mint/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
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
    await clickMintThenSign();
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Approval submitted/i)).toBeTruthy();
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
    await clickMintThenSign();
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Mint pending/i)).toBeTruthy();
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
      await clickMintThenSign();
      await waitFor(() => {
        expect(
          screen.getByText(/Account needs upgrade or activation/i)
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
      await clickMintThenSign();
      await waitFor(() => {
        expect(screen.getByText(/Wallet request cancelled/i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("reports plain Rabby user cancel as a transaction creation failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new",
      VITE_DEBUG_PANEL: "off",
    };
    const execute = jest.fn().mockRejectedValue(new Error("user cancel"));
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
      await clickMintThenSign();
      await waitFor(() => {
        expect(screen.getByText(/Mint failed/i)).toBeTruthy();
      });
      const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
      const url = new window.URL(report.getAttribute("href") ?? "");
      expect(url.searchParams.get("body")).toContain("state: mint_failed");
      expect(url.searchParams.get("body")).toContain("error: user cancel");
      expect(errorSpy).toHaveBeenCalledWith("mint failed", expect.anything());
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
      await clickMintThenSign();
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
      await clickMintThenSign();
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
      await clickMintThenSign();
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
      await clickMintThenSign();
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
    await clickMintThenSign();

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
    await clickMintThenSign();

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
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
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
    await clickMintThenSign();

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

  test("shows return CTA after THOUGHT mint-path success", async () => {
    const returnTo = "http://127.0.0.1:5174/";
    window.history.pushState(
      {},
      "",
      `/?intent=mint-path&from=thought&returnTo=${encodeURIComponent(returnTo)}`
    );
    const execute = jest.fn().mockResolvedValue({ transaction_hash: "0x1" });
    const waitForTransaction = jest.fn().mockResolvedValue({});
    mockWalletState.account = { execute, waitForTransaction };
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
        return { remaining: { low: "200", high: "0" } } as any;
      }
      return { result: [] } as any;
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();

    await waitFor(() => {
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
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
    expect(screen.getByText(/wallet disconnected/i)).toBeTruthy();
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
    await clickMintThenSign();
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
    expect(screen.getByText(/Minted \$PATH #5/i)).toBeTruthy();
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
        expect(screen.getByText(/Need .*; have/i)).toBeTruthy();
      });
      expect(mintButton).toBeDisabled();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

import "@testing-library/jest-dom";
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { pulseAuctionAbi, sendTransaction } from "@inshell/ethereum";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
  createEvent,
} from "@testing-library/react";
import { encodeFunctionData, getAbiItem } from "viem";
import React from "react";
import AuctionCanvas from "../src/components/AuctionCanvas";
import { clampLockedExplorationXWindow } from "../src/utils/auctionViewport";
import { withPathMintSubmissionLock } from "../src/pathMintSubmissionLock";
import { mockAuctionCore } from "./testUtils";
import {
  INSHELL_OPEN_WALLET_EVENT,
  INSHELL_WALLET_VISIBILITY_EVENT,
} from "@inshell/inshell-shell";
/* global SVGLineElement */

const mockUseAuctionBids = jest.fn();
const mockUseAuctionCore = jest.fn();
const mockCallContract = jest.fn<
  (...args: any[]) => Promise<{ result: string[] }>
>();
const mockGetBalance = jest.fn<(...args: any[]) => Promise<bigint>>();
const mockClearPathTokenInventoryCache = jest.fn();
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
const PATH_HANDOFF_ID = "mint-test-handoff-1";
const PATH_MINT_RETURN_STORAGE_PREFIX = "inshell:path-mint-return:v1:";
const PATH_TX_HASH = `0x${"ab".repeat(32)}`;

type PathMintLockRequest = (
  name: string,
  options: { mode: "exclusive"; ifAvailable: true },
  callback: (lock: unknown | null) => Promise<void>,
) => Promise<void>;

function setPathMintLockRequest(request: PathMintLockRequest | null) {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: request ? { request } : undefined,
  });
}

function createPathWalletProvider(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    request: jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [DEFAULT_WALLET_ADDRESS];
      if (method === "eth_chainId") return "0xaa36a7";
      if (method === "wallet_addEthereumChain") return null;
      return null;
    }),
    ...overrides,
  };
}

function setPathMintIntentUrl(
  overrides: {
    handoffId?: string;
    account?: string | null;
    chainId?: string;
    movement?: string;
    returnTo?: string;
  } = {},
) {
  const handoffId = overrides.handoffId ?? PATH_HANDOFF_ID;
  const returnTo =
    overrides.returnTo ?? `/thought?pathHandoff=${encodeURIComponent(handoffId)}`;
  const params = new URLSearchParams({
    intent: "mint-path",
    from: "thought",
    returnTo,
    handoff: handoffId,
    chainId: overrides.chainId ?? "11155111",
    movement: overrides.movement ?? "THOUGHT",
  });
  const account =
    overrides.account === undefined ? DEFAULT_WALLET_ADDRESS : overrides.account;
  if (account !== null) params.set("account", account);
  window.history.pushState({}, "", `/?${params.toString()}`);
  return { handoffId, returnTo };
}

function pathMintReturnRecord(
  overrides: Partial<{
    handoffId: string;
    status: "submitted" | "confirmed";
    account: string;
    chainId: number;
    txHash: string;
    tokenId: string;
    baselineTokenId: number | null;
    updatedAt: number;
  }> = {},
) {
  return {
    version: 1,
    handoffId: overrides.handoffId ?? PATH_HANDOFF_ID,
    status: overrides.status ?? "confirmed",
    account: overrides.account ?? DEFAULT_WALLET_ADDRESS,
    chainId: overrides.chainId ?? 11155111,
    txHash: overrides.txHash ?? PATH_TX_HASH,
    baselineTokenId: overrides.baselineTokenId ?? 2,
    updatedAt: overrides.updatedAt ?? Date.now(),
    ...(overrides.tokenId === undefined ? {} : { tokenId: overrides.tokenId }),
  };
}

function clearPathMintReturnRecords(storage: {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(PATH_MINT_RETURN_STORAGE_PREFIX)) {
      storage.removeItem(key);
    }
  }
}

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
      provider: evmOverrides.provider ?? null,
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
jest.mock("../src/services/pathTokens", () => ({
  clearPathTokenInventoryCache: (...args: any[]) =>
    mockClearPathTokenInventoryCache(...args),
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

function expectCtaAnchoredOverlay(overlay: Element | null) {
  expect(overlay).toBeTruthy();
  const anchor = overlay?.parentElement;
  expect(anchor).toHaveClass("dotfield__cta-anchor");
  expect(anchor?.querySelector(".dotfield__mint")).toBeTruthy();

  const stack = anchor?.parentElement;
  expect(stack).toHaveClass("dotfield__cta-stack");
  const notice = Array.from(stack?.children ?? []).find((child) =>
    child.classList.contains("dotfield__mint-notice"),
  );
  expect(notice).toBeTruthy();
  expect(anchor?.contains(notice ?? null)).toBe(false);
}

describe("AuctionCanvas", () => {
  beforeEach(() => {
    clearPathMintReturnRecords(window.localStorage);
    clearPathMintReturnRecords(window.sessionStorage);
    setPathMintLockRequest(async (_name, _options, callback) => {
      await callback({ name: "available-path-mint-lock" });
    });
    delete (mockProvider as any).waitForTransaction;
    delete (mockProvider as any).request;
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
      VITE_PAYMENT_TOKEN: TEST_PAYMENT_TOKEN,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
      VITE_PATH_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
    };
    mockCallContract.mockReset();
    mockGetBalance.mockReset();
    mockClearPathTokenInventoryCache.mockReset();
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
    window.localStorage.removeItem("inshell.pathMintProof.v1");
    window.localStorage.removeItem("inshell.pathMintProof.v2");
    clearPathMintReturnRecords(window.localStorage);
    clearPathMintReturnRecords(window.sessionStorage);
    setPathMintLockRequest(null);
    delete (mockProvider as any).waitForTransaction;
    delete (mockProvider as any).request;
    window.history.pushState({}, "", "/");
  });

  test("shared PulseAuction ABI keeps bid payable and maxPrice named", () => {
    const bid = getAbiItem({ abi: pulseAuctionAbi, name: "bid" });

    expect(bid.stateMutability).toBe("payable");
    expect(bid.inputs[0]?.name).toBe("maxPrice");
    expect(
      encodeFunctionData({
        abi: pulseAuctionAbi,
        functionName: "bid",
        args: [1n],
      }).slice(0, 10),
    ).toBe("0x454a2ab3");
  });

  test("wallet transaction payload omits undefined value", async () => {
    const request = jest.fn(async ({ method }: { method: string }) =>
      method === "eth_estimateGas" ? "0x28b79" : "0xabc"
    );
    await sendTransaction(
      {
        request,
      },
      {
        from: DEFAULT_WALLET_ADDRESS,
        to: TEST_AUCTION_ADDRESS,
        data: "0x454a2ab3",
      }
    );

    expect(request).toHaveBeenNthCalledWith(1, {
      method: "eth_estimateGas",
      params: [
        {
          from: DEFAULT_WALLET_ADDRESS,
          to: TEST_AUCTION_ADDRESS,
          data: "0x454a2ab3",
        },
      ],
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "eth_sendTransaction",
      params: [
        {
          from: DEFAULT_WALLET_ADDRESS,
          to: TEST_AUCTION_ADDRESS,
          data: "0x454a2ab3",
          gas: "0x34ec9",
        },
      ],
    });
    expect(
      Object.prototype.hasOwnProperty.call(
        (request.mock.calls[1]?.[0] as any).params[0],
        "value"
      )
    ).toBe(false);
  });

  test("wallet transaction falls back when gas preflight is unavailable", async () => {
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_estimateGas") {
        throw new Error("estimate unavailable");
      }
      return "0xabc";
    });

    await sendTransaction(
      { request },
      {
        from: DEFAULT_WALLET_ADDRESS,
        to: TEST_AUCTION_ADDRESS,
        data: "0x454a2ab3",
      }
    );

    expect(request).toHaveBeenLastCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          from: DEFAULT_WALLET_ADDRESS,
          to: TEST_AUCTION_ADDRESS,
          data: "0x454a2ab3",
        },
      ],
    });
  });

  test("renders PATH context and dots without a duplicate wallet control", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(screen.queryByRole("link", { name: "$PATH" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "$PATH" })).toBeInTheDocument();
    expect(screen.getByText("permission token for movement mints.")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Inshell dapps" })).toBeNull();
    expect(container.querySelector(".dotfield__mint")).toHaveTextContent("mint");

    const dots = container.querySelectorAll(".dotfield__point, .dotfield__now-dot");
    expect(dots.length).toBeGreaterThan(0);
  });

  test("renders current ask in the dedicated now dot tooltip", () => {
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
    expect(within(popover as HTMLElement).getByText("ask")).toBeInTheDocument();
    expect(within(popover as HTMLElement).getByText("premium")).toBeInTheDocument();
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

  test("allows unselected wheel page scroll without zooming the curve", () => {
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
      VITE_PATH_RPC_URL: "http://127.0.0.1:8545",
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

      fireEvent.click(svg, { clientX: 999, clientY: 10 });
      expect(container.querySelector(".dotfield__point.is-selected")).toBeNull();

      const wheel = createEvent.wheel(svg, {
        deltaY: -120,
        clientX: 500,
        clientY: 300,
      });
      const preventDefault = jest.spyOn(wheel, "preventDefault");
      fireEvent(svg, wheel);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(readNow()).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1200);
      });
      expect(readNow()).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  test("keeps wheel zoom available when a curve dot is selected", async () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    stubSvgRect(container);
    const svg = screen.getByRole("img", {
      name: /pulse auction curve/i,
    }) as HTMLElement;
    const dotButton = container.querySelector(
      ".dotfield__point--sale"
    ) as HTMLElement | null;
    expect(dotButton).toBeTruthy();
    fireEvent.click(dotButton as HTMLElement, { clientX: 80, clientY: 120 });
    expect(dotButton?.classList.contains("is-selected")).toBe(true);
    const popover = container.querySelector(".dotfield__popover") as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.style.getPropertyValue("--popover-anchor-x")).toBe("88px");
    expect(popover.style.top).toBe("128px");

    const wheel = createEvent.wheel(svg, {
      deltaY: -120,
      clientX: 500,
      clientY: 300,
    });
    const preventDefault = jest.spyOn(wheel, "preventDefault");
    fireEvent(svg, wheel);

    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() => {
      expect(container.querySelector(".dotfield")).toHaveAttribute(
        "data-layout-zoomed",
        "true"
      );
    });
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

  test("keeps full live sale history data-driven on first render", () => {
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
    stubSvgRect(container);

    expect(container.querySelectorAll(".dotfield__context-curve")).toHaveLength(0);
    expect(container.querySelectorAll(".dotfield__curve").length).toBeGreaterThan(1);
    expect(container.querySelectorAll(".dotfield__point--sale")).toHaveLength(11);
    expect(container.querySelector(".dotfield__point--now")).toBeTruthy();

    const svg = screen.getByRole("img", {
      name: /pulse auction curve/i,
    }) as HTMLElement;
    fireEvent.wheel(svg, { deltaY: -120, clientX: 600, clientY: 300 });
    expect(container.querySelectorAll(".dotfield__context-curve")).toHaveLength(0);
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
      expect(container.querySelectorAll(".dotfield__curve--muted-history")).toHaveLength(0);
      expect(
        [...pumpYValues, ...curveYValues].every((y) => y >= 0 && y <= 60)
      ).toBe(true);
      const pumpSpans = Array.from(
        container.querySelectorAll(".dotfield__pump")
      ).map((line) =>
        Math.abs(Number(line.getAttribute("y2")) - Number(line.getAttribute("y1")))
      );
      expect(Math.max(0, ...pumpSpans)).toBeGreaterThan(18);
      expect(Math.max(0, ...pumpSpans)).toBeLessThanOrEqual(60);
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
    expect(popover.style.getPropertyValue("--popover-anchor-x")).toBe("18px");
    expect(popover.style.top).toBe("18px");
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

  test("every curve dot toggles between locked and unlocked", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const selectors = [
      ".dotfield__point--opening-floor",
      ".dotfield__point--ask:not(.dotfield__point--opening-floor)",
      ".dotfield__point--sale",
      ".dotfield__point--now",
    ];

    for (const selector of selectors) {
      const dot = container.querySelector(selector) as HTMLElement | null;
      expect(dot).toBeTruthy();
      fireEvent.click(dot as HTMLElement);
      expect(dot?.classList.contains("is-selected")).toBe(true);
      fireEvent.click(dot as HTMLElement);
      expect(container.querySelector(".dotfield__point.is-selected")).toBeNull();
      expect(container.querySelector(".dotfield__popover")).toBeNull();
    }
  });

  test("unlocking a dot exits zoom and restores the default viewport", async () => {
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

    const dot = container.querySelector(
      ".dotfield__point--sale"
    ) as HTMLElement | null;
    expect(dot).toBeTruthy();
    fireEvent.click(dot as HTMLElement);
    expect(dot?.classList.contains("is-selected")).toBe(true);

    const wheel = createEvent.wheel(svg as HTMLElement, {
      deltaY: -120,
      clientX: 500,
      clientY: 300,
    });
    fireEvent(svg as HTMLElement, wheel);
    await waitFor(() => {
      expect(container.querySelector(".dotfield")).toHaveAttribute(
        "data-layout-zoomed",
        "true"
      );
    });

    fireEvent.click(
      container.querySelector(".dotfield__point--sale.is-selected") as HTMLElement
    );
    await waitFor(() => {
      expect(container.querySelector(".dotfield__point.is-selected")).toBeNull();
      expect(container.querySelector(".dotfield")).toHaveAttribute(
        "data-layout-zoomed",
        "false"
      );
    });
  });

  test("locked exploration admits a full viewport beyond both data edges", () => {
    const xRange = 10;
    const xEnd = 100;
    const firstCurveAtRight = clampLockedExplorationXWindow(
      -100,
      -90,
      xRange,
      xEnd,
    );
    const latestCurveAtLeft = clampLockedExplorationXWindow(
      110,
      120,
      xRange,
      xEnd,
    );

    expect(firstCurveAtRight).toEqual({ xMin: -10, xMax: 0 });
    expect(latestCurveAtLeft).toEqual({ xMin: 100, xMax: 110 });
    expect(((0 - firstCurveAtRight.xMin) / xRange) * 100).toBe(100);
    expect(((xEnd - latestCurveAtLeft.xMin) / xRange) * 100).toBe(0);
  });

  test("locked sale remains selected while its zoomed curve is dragged", async () => {
    const nowMs = Date.now();
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          ...sampleBids[0],
          atMs: nowMs - 6 * 60 * 60 * 1000,
        },
        {
          ...sampleBids[1],
          atMs: nowMs - 3 * 60 * 60 * 1000,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore, {
      openTimeSec: Math.floor(nowMs / 1000) - 8 * 60 * 60,
    });
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

    const saleDots = container.querySelectorAll(".dotfield__point--sale");
    const dotButton = saleDots[saleDots.length - 1] as HTMLElement | null;
    expect(dotButton).toBeTruthy();
    fireEvent.click(dotButton as HTMLElement);
    expect(dotButton?.classList.contains("is-selected")).toBe(true);
    expect(container.querySelector(".dotfield__popover")).toBeTruthy();

    const wheel = createEvent.wheel(svg as HTMLElement, {
      deltaY: -120,
      clientX: 500,
      clientY: 300,
    });
    fireEvent(svg as HTMLElement, wheel);
    await waitFor(() => {
      expect(container.querySelector(".dotfield")).toHaveAttribute(
        "data-layout-zoomed",
        "true"
      );
    });

    const selectedDot = container.querySelector(
      ".dotfield__point--sale.is-selected"
    ) as HTMLElement | null;
    expect(selectedDot).toBeTruthy();

    fireEvent.pointerDown(selectedDot as HTMLElement, {
      clientX: 80,
      clientY: 300,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
    });
    fireEvent.pointerMove(container.querySelector(".dotfield__canvas") as HTMLElement, {
      clientX: 10,
      clientY: 300,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(container.querySelector(".dotfield__canvas.is-dragging")).toBeTruthy();
    fireEvent.pointerUp(container.querySelector(".dotfield__canvas") as HTMLElement, {
      clientX: 10,
      clientY: 300,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(container.querySelector(".dotfield__point--sale.is-selected")).toBeTruthy();
    expect(container.querySelector(".dotfield__popover")).toBeTruthy();
  });

  test("curve hover shows premium amount", async () => {
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
      expect(screen.getByText(/^premium$/i)).toBeTruthy();
      expect(screen.getByText(/^1 t½ decay$/i)).toBeTruthy();
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
    const x = Number((pump as SVGLineElement).getAttribute("x2") ?? Number.NaN);
    const y = Number((pump as SVGLineElement).getAttribute("y2") ?? Number.NaN);
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
      expect(within(popover as HTMLElement).queryByText(/^floor$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^initial premium$/i)).toBeNull();
      expect(
        within(popover as HTMLElement).getByText(/ask when the auction opens/i)
      ).toBeTruthy();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ decay$/i)).toBeNull();
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
      expect(within(popover as HTMLElement).queryByText(/^floor$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^initial premium$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ decay$/i)).toBeNull();
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
      expect(within(popover as HTMLElement).getByText(/^floor$/i)).toBeTruthy();
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
      expect(within(popover as HTMLElement).queryByText(/^floor$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^initial premium$/i)).toBeNull();
      expect(within(popover as HTMLElement).queryByText(/^1 t½ decay$/i)).toBeNull();
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
      const askRow = within(popover as HTMLElement).getByText(/^ask$/i).parentElement;
      expect(askRow).toBeTruthy();
      expect((askRow?.textContent ?? "").replace(/,/g, "")).toMatch(/120(?:\.00)?\s*ETH/i);
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
      expect(within(popover as HTMLElement).queryByText(/^next floor$/i)).toBeNull();
    });
  });

  test("start ask tooltip explains floor comes from the last sale", async () => {
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
      expect(within(popover as HTMLElement).getByText(/^floor$/i)).toBeTruthy();
      expect(
        within(popover as HTMLElement).getByText(/ask = floor \+ initial premium/i)
      ).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/floor = last price/i)).toBeTruthy();
    });
  });

  test("hovering pump line shows initial premium tooltip", async () => {
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
      expect(within(popover as HTMLElement).getAllByText(/^initial premium$/i).length).toBeGreaterThan(0);
      const durationRow = within(popover as HTMLElement).getByText(/^elapsed time$/i)
        .parentElement;
      expect(durationRow?.textContent).toMatch(/^elapsed time\d+s$/i);
      expect(within(popover as HTMLElement).getByText(/^PTS \(ETH\/s\)$/i)).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/initial premium = elapsed time × PTS/i)).toBeTruthy();
      expect(
        within(popover as HTMLElement).queryByText(/next ask = next floor \+ initial premium/i)
      ).toBeNull();
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
    expect(screen.getByText(/loading pricing/i)).toBeTruthy();
  });

  test("keeps cached sale curves visible while core state refreshes", () => {
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: true,
        config: {
          openTimeSec: Math.floor(Date.now() / 1000) - 5 * 60,
          genesisPrice: { dec: "1000000000000000000" },
          genesisFloor: { dec: "100000000000000000" },
          k: { dec: "10000000000000000000" },
          pts: "1000000000000000000",
        },
      },
      ready: false,
      loading: true,
      error: null,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: sampleBids,
      ready: true,
      loading: false,
      error: null,
    });

    const { container } = render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    expect(screen.queryByText(/loading pricing/i)).toBeNull();
    expect(container.querySelector(".dotfield__curve")).toBeTruthy();
  });

  test("public home uses indexed auction cache without enabling direct RPC core", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PAYMENT_TOKEN: TEST_PAYMENT_TOKEN,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
      VITE_PATH_RPC_URL: "/api/path-rpc",
    };

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    expect(mockUseAuctionCore).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    );
    expect(mockUseAuctionBids).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        preferCacheApi: true,
        allowDirectFallback: false,
      })
    );
    expect(mockCallContract).not.toHaveBeenCalled();
  });

  test("devnet reads auction config and sale curves directly from Anvil", async () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a69",
      VITE_PULSE_AUCTION: TEST_AUCTION_ADDRESS,
      VITE_PAYMENT_TOKEN: ZERO_ADDRESS,
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
      VITE_PATH_RPC_URL: "http://127.0.0.1:8545",
    };

    render(<AuctionCanvas address={TEST_AUCTION_ADDRESS} provider={mockProvider as any} />);

    await waitFor(() => {
      expect(mockUseAuctionCore).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });
    expect(mockUseAuctionBids).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preferCacheApi: false,
        allowDirectFallback: true,
      })
    );
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
    expect(screen.queryByText(/loading pricing/i)).toBeNull();
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

  test("renders Pulse's valid anchor-equals-start clamp state", () => {
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
          epochIndex: 3,
          startTimeSec: nowSec - 10,
          anchorTimeSec: nowSec - 10,
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
      loading: false,
      error: null,
    });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    expect(screen.queryByText(/invalid half-life/i)).toBeNull();
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
    expect(screen.queryByText(/loading pricing/i)).toBeNull();
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
      expect(screen.getByText(/wallet provider not found/i)).toBeTruthy();
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
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

    expect(screen.queryByText("Sepolia ETH")).toBeNull();
    expect(screen.queryByText(/Mainnet is the future canonical record/i)).toBeNull();
    expect(screen.queryByText(/^debug$/i)).toBeNull();
  });

  test("sepolia invite leaves wrong-network recovery to the global wallet menu", () => {
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
      expect(screen.queryByText(/Switch to Sepolia/i)).toBeNull();
      expect(screen.queryByText(/\[\s*switch\s*\]/i)).toBeNull();
      expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeDisabled();
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
      expect(screen.getByText(/wallet provider not found/i)).toBeTruthy();
      const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
      expect(report).toHaveTextContent("report bug ↗");
      const url = new window.URL(report.getAttribute("href") ?? "");
      expect(url.searchParams.get("body")).toContain("state: no_supported_wallet");
      expect(url.searchParams.get("body")).toContain("Remove anything private");
    });
  });

  test("does not duplicate the global wallet control when the wallet is locked", () => {
    mockWalletState = createWalletState({
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
    });
  });

  test("locked wallet leaves connection to the global shell", async () => {
    const requestAccounts = jest.fn().mockResolvedValue(["0xabc"]);
    mockWalletState = createWalletState({
      account: null,
      accountMissing: true,
      requestAccounts,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
      expect(requestAccounts).not.toHaveBeenCalled();
      expect(mockWalletState.connectAsync).not.toHaveBeenCalled();
    });
  });

  test("keeps mint visible when disconnected and opens the global wallet", async () => {
    const openWallet = jest.fn();
    window.addEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    try {
      const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
      expect(mintButton).not.toBeDisabled();
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
      fireEvent.click(mintButton);
      expect(openWallet).toHaveBeenCalledTimes(1);
      expect(mockWalletState.connectAsync).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    }
  });

  test("canvas does not initiate a connection when no connectors are present", async () => {
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    fireEvent.click(mintButton);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
      expect(connectAsync).not.toHaveBeenCalled();
    });
  });

  test("canvas does not request signing, transactions, or approvals while disconnected", async () => {
    const requestedMethods: string[] = [];
    const connectAsync = jest.fn(async () => {
      requestedMethods.push("eth_requestAccounts");
      return { address: "0xabc", chainId: 11155111 };
    });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    fireEvent.click(mintButton);
    expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
    expect(requestedMethods).toEqual([]);
    expect(requestedMethods).not.toContain("eth_sendTransaction");
    expect(requestedMethods).not.toContain("personal_sign");
    expect(requestedMethods).not.toContain("eth_sign");
    expect(requestedMethods).not.toContain("eth_signTypedData");
    expect(requestedMethods).not.toContain("eth_signTypedData_v4");
    expect(requestedMethods).not.toContain("approve");
    expect(requestedMethods).not.toContain("permit");
  });

  test("canvas does not render a second wallet-options picker", async () => {
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
    const walletConnectConnector = {
      id: "walletconnect-v2",
      name: "WalletConnect",
      kind: "walletconnect",
      available: () => true,
    };
    const connectAsync = jest
      .fn()
      .mockResolvedValue({ address: "0xabc", chainId: 11155111 });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
      connectors: [
        genericConnector,
        templeConnector,
        walletConnectConnector,
        rabbyConnector,
        metaMaskConnector,
      ],
      connectAsync,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(connectAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/\[\s*mint\s*\]/i));
    expect(screen.queryByRole("menu", { name: "Wallet options" })).toBeNull();
    expect(connectAsync).not.toHaveBeenCalled();
  });

  test("canvas does not open a second pending MetaMask request", async () => {
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    fireEvent.click(mintButton);
    expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
    expect(connectAsync).not.toHaveBeenCalled();
  });

  test("does not mutate wallet chain configuration before mint writes", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PATH_RPC_URL: "/api/path-rpc",
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
      expect(request).not.toHaveBeenCalled();
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

  test("preflight falls back to connected wallet provider after project RPC throttle", async () => {
    const fallbackCallContract = jest.fn(async (args: any) => {
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
    mockWalletState = createWalletState({
      account: {},
      evm: {
        provider: {
          request: jest.fn(),
          callContract: fallbackCallContract,
        },
        providerName: "MetaMask",
      },
    });
    mockCallContract.mockReset();
    mockCallContract.mockRejectedValue(
      new Error(
        "RPC endpoint returned too many errors, retrying in 0.14 minutes. Consider using a different RPC endpoint."
      )
    );

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    await waitFor(() => {
      expect(mockCallContract).toHaveBeenCalledTimes(1);
      expect(fallbackCallContract).toHaveBeenCalledTimes(3);
      expect(screen.queryByText(/RPC read failed/i)).toBeNull();
    });
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
      expect(screen.queryByRole("button", { name: "connect wallet" })).toBeNull();
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
    const review = screen.getByText("$PATH mint", { exact: true }).closest(".dotfield__mint-review");
    expectCtaAnchoredOverlay(review);
    expect(within(review as HTMLElement).getByText("Sepolia · 11155111")).toBeTruthy();
    expect(within(review as HTMLElement).getByText("contract")).toBeTruthy();
    expect(within(review as HTMLElement).getByRole("link", { name: /0x[a-fA-F0-9]{4}.*↗/ })).toHaveAttribute(
      "href",
      expect.stringContaining("sepolia.etherscan.io/address/"),
    );
    expect(within(review as HTMLElement).getByRole("link", { name: "verify contracts ↗" })).toHaveAttribute(
      "href",
      "/verify",
    );
    expect(within(review as HTMLElement).getByText(/price now/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/max spend/i)).toBeTruthy();
    expect(within(review as HTMLElement).queryByText(/function/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/approval/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/network gas/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/ETH sent/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/decoded call/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/raw transaction data/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/PulseAuction/i)).toBeNull();
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

    const review = screen.getByText("$PATH mint", { exact: true }).closest(".dotfield__mint-review");
    expect(review).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/price now/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText(/max spend/i)).toBeTruthy();
    expect(within(review as HTMLElement).getByText("network")).toBeTruthy();
    expect(within(review as HTMLElement).getByText("Sepolia rehearsal · 11155111")).toBeTruthy();
    expect(within(review as HTMLElement).queryByText(/ETH sent/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/approval/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/network gas/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText("chain")).toBeNull();
    expect(within(review as HTMLElement).queryByText("chain id")).toBeNull();
    expect(within(review as HTMLElement).queryByText(/currency/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText("record")).toBeNull();
    expect(within(review as HTMLElement).queryByText(/Sepolia rehearsal network/i)).toBeNull();
    expect(within(review as HTMLElement).queryByText(/uses testnet ETH/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Report a Sepolia bug" })).toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  test("local mint review uses Anvil labels and no external explorer", async () => {
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a69",
      VITE_PATH_RPC_URL: "http://127.0.0.1:8545",
    };
    mockWalletState = createWalletState({
      chain: { name: "Anvil Local" },
      chainId: 31337n,
      account: { execute: jest.fn().mockResolvedValue({ transaction_hash: "0x1" }) },
      evm: { chainId: 31337 },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintForReview();

    const review = screen.getByText("$PATH mint", { exact: true }).closest(".dotfield__mint-review");
    expect(review).toBeTruthy();
    expect(within(review as HTMLElement).getByText("Local Anvil · 31337")).toBeTruthy();
    expect(
      within(review as HTMLElement).queryByRole("link", { name: /0x[a-fA-F0-9]{4}.*↗/ })
    ).toBeNull();
    expect(within(review as HTMLElement).queryByText(/Sepolia/i)).toBeNull();
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

  test("devnet curve estimates never replace the exact contract mint quote", async () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 60;
    const oneEth = 10n ** 18n;
    const contractAsk = 5_349_700_000_000_000_000n;
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "devnet",
      VITE_EXPECTED_CHAIN_ID: "0x7a69",
      VITE_PATH_RPC_URL: "http://127.0.0.1:8545",
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
        return { price: { low: contractAsk.toString(), high: "0" } } as any;
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
      const review = screen.getByText("$PATH mint", { exact: true }).closest(".dotfield__mint-review");
      expect(review).toBeTruthy();
      const rows = Array.from(
        (review as HTMLElement).querySelectorAll(".dotfield__mint-review-row")
      );
      const currentAskRow = rows.find((row) => row.textContent?.includes("price now"));
      const maxBidRow = rows.find((row) => row.textContent?.includes("max spend"));
      expect(currentAskRow?.textContent).toContain("5.3497 ETH");
      expect(maxBidRow?.textContent).toContain("5.3497 ETH");

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
      expect(bidCall.value).toBe(contractAsk);
      expect(BigInt(bidCall.calldata[0])).toBe(contractAsk);
    } finally {
      jest.useRealTimers();
    }
  });

  test("confirm reads the execution-time ask immediately before submission", async () => {
    jest.useFakeTimers();
    const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    jest.setSystemTime(nowMs);
    const nowSec = Math.floor(nowMs / 1000);
    const saleSec = nowSec - 60;
    const oneEth = 10n ** 18n;
    const initialAsk = 1n * oneEth;
    const reviewAsk = 2n * oneEth;
    const confirmAsk = 3n * oneEth;
    const preSubmitAsk = 4n * oneEth;
    const executionAsk = 5n * oneEth;
    const askQueue = [
      initialAsk,
      reviewAsk,
      confirmAsk,
      preSubmitAsk,
      executionAsk,
    ];
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_NETWORK: "sepolia",
      VITE_EXPECTED_CHAIN_ID: "0xaa36a7",
      VITE_PATH_RPC_URL: "http://127.0.0.1:8545",
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
        const price = askQueue.shift() ?? executionAsk;
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
      const review = screen.getByText("$PATH mint", { exact: true }).closest(".dotfield__mint-review");
      expect(review).toBeTruthy();
      const rows = Array.from(
        (review as HTMLElement).querySelectorAll(".dotfield__mint-review-row")
      );
      const currentAskRow = rows.find((row) => row.textContent?.includes("price now"));
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
      expect(bidCall.value).toBe(executionAsk);
      expect(BigInt(bidCall.calldata[0])).toBe(executionAsk);
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
    expect(screen.getByText("$PATH mint", { exact: true })).toBeTruthy();

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    await waitFor(() => {
      expect(screen.queryByText("$PATH mint", { exact: true })).toBeNull();
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
      expect(screen.getByText(/Wallet open: confirm \$PATH mint/i)).toBeTruthy();
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
    expect(screen.getByText(/\$PATH mint pending/i)).toBeTruthy();
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

  test("shows MetaMask RPC fix action after MetaMask send throttle", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const request = jest.fn().mockResolvedValue(null);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
    (globalThis as any).__VITE_ENV__ = {
      ...(globalThis as any).__VITE_ENV__,
      VITE_PATH_RPC_URL: "/api/path-rpc",
      VITE_WALLET_CHAIN_RPC_URL: "",
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new",
      VITE_DEBUG_PANEL: "off",
    };
    const execute = jest.fn().mockRejectedValue(
      new Error(
        "RPC endpoint returned too many errors, retrying in 0.14 minutes. Consider using a different RPC endpoint."
      )
    );
    mockWalletState = createWalletState({
      account: { execute },
      evm: {
        provider: { request },
        providerName: "MetaMask",
      },
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
          screen.getByText(/MetaMask RPC busy\. Select Sepolia or update RPC\./i)
        ).toBeTruthy();
      });
      expect(screen.queryByText(/RPC read failed/i)).toBeNull();
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
      expect(request).not.toHaveBeenCalled();
      const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
      const url = new window.URL(report.getAttribute("href") ?? "");
      expect(url.searchParams.get("body")).toContain("state: wallet_rpc_busy");
      const requestCountBeforeCopy = request.mock.calls.length;
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Fix MetaMask Sepolia RPC" })
        );
      });
      expect(request).toHaveBeenCalledTimes(requestCountBeforeCopy);
      expect(writeText).toHaveBeenCalledWith("https://ethereum-sepolia-rpc.publicnode.com");
      expect(
        screen.getByText(/Copied RPC\. Select Sepolia, update RPC, retry\./i)
      ).toBeTruthy();
      expect(errorSpy).toHaveBeenCalledWith("mint failed", expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("keeps bid submitted when confirmation wait hits transient RPC throttle", async () => {
    jest.useFakeTimers();
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: "0xwaitfail" });
    const waitForTransaction = jest.fn().mockRejectedValue(
      new Error(
        "RPC endpoint returned too many errors, retrying in 0.14 minutes. Consider using a different RPC endpoint."
      )
    );
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

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      await clickMintThenSign();
      await waitFor(() => {
        expect(waitForTransaction).toHaveBeenCalledWith("0xwaitfail");
      });
      expect(
        screen.getByText(/Submitted\. Confirmation check delayed\./i)
      ).toBeTruthy();
      expect(screen.queryByText(/RPC read failed/i)).toBeNull();
      expect(screen.queryByText(/\[\s*retry\s*\]/i)).toBeNull();
    } finally {
      act(() => {
        jest.runOnlyPendingTimers();
      });
      jest.useRealTimers();
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
    const { handoffId } = setPathMintIntentUrl({ account: null });
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    const waitForTransaction = jest.fn().mockResolvedValue({ status: 1 });
    mockWalletState = createWalletState({
      account: { execute, waitForTransaction },
      watchAsset: jest.fn().mockResolvedValue(true),
      evm: { provider: createPathWalletProvider() },
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

    const { rerender } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    await clickMintThenSign();

    await waitFor(() => {
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        handoffId,
        status: "confirmed",
        account: DEFAULT_WALLET_ADDRESS.toLowerCase(),
        chainId: 11155111,
        txHash: PATH_TX_HASH,
      }),
    );

    mockUseAuctionBids.mockReturnValue({
      bids: [
        ...sampleBids,
        {
          key: `tx:${PATH_TX_HASH}`,
          atMs: Date.now(),
          amount: { raw: { low: "3", high: "0" }, dec: "3", value: 3n },
          bidder: DEFAULT_WALLET_ADDRESS,
          blockNumber: 12,
          epochIndex: 7,
          tokenId: 7,
          txHash: PATH_TX_HASH,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(
            `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
          ) ?? "{}",
        ).tokenId,
      ).toBe("7");
    });
  });

  test("lets execution failure beat accepted finality in a PATH receipt", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { handoffId } = setPathMintIntentUrl();
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockResolvedValue({
          status: "confirmed",
          execution_status: "REVERTED",
          finality_status: "ACCEPTED_ON_L2",
        }),
      },
      evm: { provider: createPathWalletProvider() },
    });
    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      await clickMintThenSign();
      await waitFor(() => {
        expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
      });
      expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
      expect(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ),
      ).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("keeps a timed-out PATH receipt submitted without offering return", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest
          .fn()
          .mockRejectedValue(new Error("RPC request timed out")),
      },
      evm: { provider: createPathWalletProvider() },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(
            `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
          ) ?? "{}",
        ).status,
      ).toBe("submitted");
    });
  });

  test("migrates a repriced PATH mint to its confirmed replacement hash", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const replacementHash = `0x${"bc".repeat(32)}`;
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockRejectedValue({
          code: "TRANSACTION_REPLACED",
          reason: "repriced",
          cancelled: false,
          replacement: { hash: replacementHash },
          receipt: { status: 1, transactionHash: replacementHash },
        }),
      },
      evm: { provider: createPathWalletProvider() },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();

    expect(await screen.findByText(/\[\s*return\s*\]/i)).toBeTruthy();
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(
            `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
          ) ?? "{}",
        ),
      ).toEqual(
        expect.objectContaining({
          status: "confirmed",
          txHash: replacementHash,
        }),
      );
    });
  });

  test("keeps only a pending replacement hash for a repriced PATH mint", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const replacementHash = `0x${"cd".repeat(32)}`;
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    const receiptReads: string[] = [];
    (mockProvider as any).request = jest.fn(
      async ({ method, params }: { method: string; params?: string[] }) => {
        if (method === "eth_getTransactionReceipt") {
          receiptReads.push(params?.[0] ?? "");
          return null;
        }
        return null;
      },
    );
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockRejectedValue({
          code: "TRANSACTION_REPLACED",
          reason: "repriced",
          cancelled: false,
          replacement: { hash: replacementHash },
        }),
      },
      evm: { provider: createPathWalletProvider() },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();

    await waitFor(() => {
      const record = JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
      );
      expect(record).toEqual(
        expect.objectContaining({
          status: "submitted",
          txHash: replacementHash,
        }),
      );
    });
    await act(async () => {
      window.dispatchEvent(new globalThis.Event("focus"));
    });
    await waitFor(() => {
      expect(receiptReads[receiptReads.length - 1]).toBe(replacementHash);
    });
    expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
  });

  test("retains the submitted PATH record when a replacement hash is unavailable", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockRejectedValue({
          code: "TRANSACTION_REPLACED",
          reason: "repriced",
          cancelled: false,
        }),
      },
      evm: { provider: createPathWalletProvider() },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();

    expect(
      await screen.findByText(/Replacement detected; hash unavailable/i),
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(
            `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
          ) ?? "{}",
        ),
      ).toEqual(
        expect.objectContaining({
          status: "submitted",
          txHash: PATH_TX_HASH,
        }),
      );
    });
    expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
  });

  test("treats a cancelled PATH replacement as terminal", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { handoffId } = setPathMintIntentUrl();
    const replacementHash = `0x${"de".repeat(32)}`;
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockRejectedValue({
          code: "TRANSACTION_REPLACED",
          reason: "cancelled",
          cancelled: true,
          replacement: { hash: replacementHash },
          receipt: { status: 1, transactionHash: replacementHash },
        }),
      },
      evm: { provider: createPathWalletProvider() },
    });

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      await clickMintThenSign();
      expect(await screen.findByText(/\[\s*retry\s*\]/i)).toBeTruthy();
      expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
      expect(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ),
      ).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test("resumes a submitted PATH receipt after reload", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted" })),
    );
    const waitForTransaction = jest.fn(function (this: unknown) {
      expect(this).toBe(mockProvider);
      return Promise.resolve({ status: "0x1" });
    });
    (mockProvider as any).waitForTransaction = waitForTransaction;
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(waitForTransaction).toHaveBeenCalledWith(PATH_TX_HASH);
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
    ).status,
    ).toBe("confirmed");
  });

  test("polls a restored PATH receipt through production providers in StrictMode", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted" })),
    );
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_getTransactionReceipt") return { status: "0x1" };
      if (method === "eth_chainId") return "0xaa36a7";
      if (method === "eth_getCode") return "0x01";
      return null;
    });
    (mockProvider as any).request = request;
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(
      <React.StrictMode>
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      </React.StrictMode>,
    );
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: "eth_getTransactionReceipt",
        params: [PATH_TX_HASH],
      });
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
  });

  test("announces a submitted-to-confirmed PATH handoff as an atomic status", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted" })),
    );
    let resolveReceipt: ((receipt: unknown) => void) | null = null;
    const receipt = new Promise<unknown>((resolve) => {
      resolveReceipt = resolve;
    });
    (mockProvider as any).request = jest.fn(
      async ({ method }: { method: string }) =>
        method === "eth_getTransactionReceipt" ? receipt : null,
    );
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("$PATH mint submitted. Waiting for confirmation.");

    await act(async () => {
      resolveReceipt?.({ status: 1 });
      await receipt;
    });
    await waitFor(() => {
      expect(status).toHaveTextContent("$PATH minted. Return to THOUGHT.");
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
  });

  test("keeps the THOUGHT PATH handoff usable below the desktop breakpoint", async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 600,
    });
    setPathMintIntentUrl();
    mockWalletState = createWalletState({ account: {} });
    const view = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />,
    );
    try {
      expect(screen.queryByText(/This view needs more room/i)).toBeNull();
      expect(await screen.findByText(/\[\s*mint\s*\]/i)).toBeTruthy();
    } finally {
      view.unmount();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
    }
  });

  test("retains an ambiguous receipt transport failure and retries on focus", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted" })),
    );
    let receiptReads = 0;
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_getTransactionReceipt") {
        receiptReads += 1;
        if (receiptReads === 1) {
          throw new Error("transaction failed to fetch receipt");
        }
        return { status: 1 };
      }
      if (method === "eth_chainId") return "0xaa36a7";
      if (method === "eth_getCode") return "0x01";
      return null;
    });
    (mockProvider as any).request = request;
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => expect(receiptReads).toBe(1));
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
      ).status,
    ).toBe("submitted");
    await act(async () => {
      window.dispatchEvent(new globalThis.Event("focus"));
    });
    await waitFor(() => {
      expect(receiptReads).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/\[\s*return\s*\]/i)).toBeTruthy();
    });
  });

  test("adopts a submitted PATH record written by another same-origin tab", async () => {
    const { handoffId } = setPathMintIntentUrl();
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const key = `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`;
    const serialized = JSON.stringify(pathMintReturnRecord({ status: "submitted" }));
    window.localStorage.setItem(key, serialized);
    await act(async () => {
      window.dispatchEvent(
        new globalThis.StorageEvent("storage", { key, newValue: serialized }),
      );
    });
    expect(await screen.findByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
  });

  test("uses the freshest valid PATH return storage copy", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const older = Date.now() - 5_000;
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted", updatedAt: older })),
    );
    window.sessionStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "confirmed", updatedAt: older + 1_000 })),
    );
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(await screen.findByText(/\[\s*return\s*\]/i)).toBeTruthy();
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
      ).status,
    ).toBe("confirmed");
    expect(
      window.sessionStorage.getItem(
        `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      ),
    ).toBeNull();
  });

  test("does not restore an expired PATH return record", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(
        pathMintReturnRecord({
          updatedAt: Date.now() - 86_400_001,
        }),
      ),
    );
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText(/\[\s*return\s*\]/i)).toBeNull();
  });

  test("keeps an old submitted PATH record until a terminal receipt exists", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(
        pathMintReturnRecord({
          status: "submitted",
          updatedAt: Date.now() - 86_400_001,
        }),
      ),
    );
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_getTransactionReceipt") return null;
      return null;
    });
    (mockProvider as any).request = request;
    mockWalletState = createWalletState({
      address: null,
      isConnected: false,
      chainId: null,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(await screen.findByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
        ) ?? "{}",
      ).status,
    ).toBe("submitted");
    expect(request).toHaveBeenCalledWith({
      method: "eth_getTransactionReceipt",
      params: [PATH_TX_HASH],
    });
  });

  test("blocks duplicate confirm clicks in the same tab", async () => {
    setPathMintIntentUrl();
    const execute = jest
      .fn()
      .mockResolvedValue({ transaction_hash: PATH_TX_HASH });
    mockWalletState = createWalletState({
      account: {
        execute,
        waitForTransaction: jest.fn().mockResolvedValue({ status: 1 }),
      },
      evm: { provider: createPathWalletProvider() },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const confirm = await clickMintForReview();

    await act(async () => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  });

  test("runs the PATH task when the Web Lock is available", async () => {
    const request = jest.fn(
      async (
        _name: string,
        _options: { mode: "exclusive"; ifAvailable: true },
        callback: (lock: unknown | null) => Promise<void>,
      ) => {
        await callback({ name: "available-path-mint-lock" });
      },
    );
    setPathMintLockRequest(request);
    const task = jest.fn(async () => {});

    const result = await withPathMintSubmissionLock(
      "mint-web-lock-success-1",
      task,
    );

    expect(result).toBe("acquired");
    expect(task).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      "inshell:path-mint-submit:mint-web-lock-success-1",
      { mode: "exclusive", ifAvailable: true },
      expect.any(Function),
    );
  });

  test("reports busy and skips the PATH task when another tab owns the Web Lock", async () => {
    setPathMintLockRequest(async (_name, _options, callback) => {
      await callback(null);
    });
    const task = jest.fn(async () => {});

    const result = await withPathMintSubmissionLock(
      "mint-web-lock-busy-1",
      task,
    );

    expect(result).toBe("busy");
    expect(task).not.toHaveBeenCalled();
  });

  test("fails closed without Web Locks even when localStorage is writable", async () => {
    const storageKey = "inshell:path-mint-submit-lock:v1:legacy-active-lock";
    const storedLease = JSON.stringify({
      owner: "legacy-tab",
      expiresAt: Date.now() + 15_000,
    });
    window.localStorage.setItem(storageKey, storedLease);
    setPathMintLockRequest(null);
    const task = jest.fn(async () => {});

    try {
      const result = await withPathMintSubmissionLock(
        "mint-no-web-lock-1",
        task,
      );

      expect(result).toBe("unsupported");
      expect(task).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(storageKey)).toBe(storedLease);
    } finally {
      window.localStorage.removeItem(storageKey);
    }
  });

  test("shows another-tab busy when the PATH Web Lock is held", async () => {
    setPathMintLockRequest(async (_name, _options, callback) => {
      await callback(null);
    });
    setPathMintIntentUrl();
    const execute = jest.fn();
    mockWalletState = createWalletState({
      account: { execute },
      evm: { provider: createPathWalletProvider() },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();
    expect(await screen.findByText(/already open in another tab/i)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  test("explains unsupported browser coordination before opening the wallet", async () => {
    setPathMintLockRequest(null);
    setPathMintIntentUrl();
    const execute = jest.fn();
    mockWalletState = createWalletState({
      account: { execute },
      evm: { provider: createPathWalletProvider() },
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await clickMintThenSign();
    expect(
      await screen.findByText(/requires browser tab coordination \(Web Locks\)/i),
    ).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  test("rechecks storage before submitting a PATH mint", async () => {
    const { handoffId } = setPathMintIntentUrl();
    const execute = jest.fn();
    mockWalletState = createWalletState({
      account: { execute },
      evm: { provider: createPathWalletProvider() },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const confirm = await clickMintForReview();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord({ status: "submitted" })),
    );

    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(await screen.findByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  test("rechecks wallet account immediately before PATH submission", async () => {
    setPathMintIntentUrl();
    const execute = jest.fn();
    const changedAccount = `0x${"cd".repeat(20)}`;
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [changedAccount];
      if (method === "eth_chainId") return "0xaa36a7";
      return null;
    });
    mockWalletState = createWalletState({
      account: { execute },
      evm: { provider: createPathWalletProvider({ request }) },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    await clickMintThenSign();
    expect(await screen.findByText(/wallet account changed before PATH mint/i)).toBeTruthy();
    expect(request).toHaveBeenCalledWith({ method: "eth_accounts" });
    expect(request).toHaveBeenCalledWith({ method: "eth_chainId" });
    expect(execute).not.toHaveBeenCalled();
  });

  test("rechecks wallet chain immediately before PATH submission", async () => {
    setPathMintIntentUrl();
    const execute = jest.fn();
    const request = jest.fn(async ({ method }: { method: string }) => {
      if (method === "eth_accounts") return [DEFAULT_WALLET_ADDRESS];
      if (method === "eth_chainId") return "0x1";
      return null;
    });
    mockWalletState = createWalletState({
      account: { execute },
      evm: { provider: createPathWalletProvider({ request }) },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    await clickMintThenSign();
    expect(await screen.findByText(/wallet network changed before PATH mint/i)).toBeTruthy();
    expect(execute).not.toHaveBeenCalled();
  });

  test("treats a stored confirmed result as authoritative over query account", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.localStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(
        pathMintReturnRecord({ account: `0x${"cd".repeat(20)}` }),
      ),
    );
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    expect(await screen.findByText(/\[\s*return\s*\]/i)).toBeTruthy();
    expect(screen.queryByText(/Switch to the THOUGHT wallet/i)).toBeNull();
  });

  test("keeps confirmed return above wallet and network state", async () => {
    const { handoffId } = setPathMintIntentUrl();
    window.sessionStorage.setItem(
      `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      JSON.stringify(pathMintReturnRecord()),
    );
    mockWalletState = createWalletState({
      address: `0x${"cd".repeat(20)}`,
      chainId: 1n,
      account: null,
    });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const returnButton = await screen.findByText(/\[\s*return\s*\]/i);
    expect(returnButton).not.toBeDisabled();
    expect(screen.queryByText(/\[\s*connect\s*\]/i)).toBeNull();
    expect(screen.queryByText(/Switch to the THOUGHT wallet/i)).toBeNull();
    expect(
      window.localStorage.getItem(
        `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      ),
    ).not.toBeNull();
    expect(
      window.sessionStorage.getItem(
        `${PATH_MINT_RETURN_STORAGE_PREFIX}${handoffId}`,
      ),
    ).toBeNull();
  });

  test.each([
    {
      name: "wallet",
      intent: { account: `0x${"aa".repeat(20)}` },
      notice: /Switch to the THOUGHT wallet/i,
    },
    {
      name: "chain",
      intent: {},
      wallet: { chainId: 1n },
      notice: /Switch wallet to THOUGHT chain 11155111/i,
    },
  ])("blocks a $name mismatch before PATH mint", async ({ intent, wallet, notice }) => {
    setPathMintIntentUrl(intent);
    const execute = jest.fn();
    mockWalletState = createWalletState({ account: { execute }, ...wallet });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    expect(await screen.findByText(notice)).toBeTruthy();
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    expect(mintButton).toBeDisabled();
    fireEvent.click(mintButton);
    expect(execute).not.toHaveBeenCalled();
  });

  test("rejects non-THOUGHT return routes and movement values", async () => {
    setPathMintIntentUrl({
      movement: "PATH",
      returnTo: `/gallery?pathHandoff=${PATH_HANDOFF_ID}`,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(await screen.findByText(/Invalid THOUGHT mint movement/i)).toBeTruthy();
    expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeDisabled();
  });

  test("rejects handoff ids that THOUGHT cannot restore", async () => {
    setPathMintIntentUrl({ handoffId: "bad.handoff" });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(await screen.findByText(/Invalid THOUGHT mint handoff id/i)).toBeTruthy();
    expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeDisabled();
  });

  test("keeps wallet menu out of the PATH-local CTA stack", async () => {
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
    expect(container.querySelector(".dotfield__cta-address")).toBeNull();
    expect(screen.queryByText(/copy address/i)).toBeNull();
    expect(screen.queryByText(/disconnect/i)).toBeNull();
  });

  test("shows PATH mint proof after confirmation when bid appears", async () => {
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
    const proof = screen.getByText("$PATH minted").closest(".dotfield__mint-proof");
    expectCtaAnchoredOverlay(proof);
    const proofScope = within(proof as HTMLElement);
    expect(proofScope.getByText("$PATH minted")).toBeTruthy();
    expect(proofScope.getAllByText(/PATH #5/).length).toBeGreaterThan(0);
    expect(proofScope.getByText("minted via Pulse")).toBeTruthy();
    expect(proofScope.getByText("owner")).toBeTruthy();
    expect(proofScope.getAllByText("price").length).toBeGreaterThan(0);
    expect(proofScope.getByText("epoch")).toBeTruthy();
    expect(proofScope.getByText("tx")).toBeTruthy();
    expect(proofScope.getByText("block")).toBeTruthy();
    expect(proofScope.getByRole("link", { name: "view PATH" })).toHaveAttribute(
      "href",
      "/path/5"
    );
    expect(proofScope.getByRole("link", { name: "explorer ↗" })).toHaveAttribute(
      "href",
      expect.stringContaining("/tx/0xmint")
    );
    expect(proofScope.getByText("source indexing...")).toBeTruthy();
    expect(proof).toHaveTextContent("PulseAuction.Sale");
    expect(proof).toHaveTextContent("PathPulseAdapter.EpochMinted");
    expect(proof).toHaveTextContent("PathNFT.Transfer");
    expect(proofScope.getByRole("button", { name: "copy proof JSON" })).toBeTruthy();
    expect(
      JSON.parse(window.localStorage.getItem("inshell.pathMintProof.v2") ?? "{}")
        .tokenId
    ).toBe(5);
    jest.useRealTimers();
  });

  test("restores PATH mint proof only after its active-chain receipt is verified", async () => {
    (mockProvider as any).request = jest.fn(
      async ({ method }: { method: string }) => {
        if (method === "eth_getTransactionReceipt") {
          return {
            status: "0x1",
            to: TEST_AUCTION_ADDRESS,
            transactionHash: "0xstoredmint",
            blockNumber: "0x7b",
          };
        }
        return null;
      },
    );
    window.localStorage.setItem(
      "inshell.pathMintProof.v2",
      JSON.stringify({
        version: 2,
        chainId: 11155111,
        pulseAuction: TEST_AUCTION_ADDRESS,
        tokenId: 18,
        epoch: 18,
        owner: DEFAULT_WALLET_ADDRESS,
        priceDec: "400000000000000000",
        priceLabel: "0.4",
        txHash: "0xstoredmint",
        blockNumber: 123,
        sourceUrl: "https://inshell-public-feed.pages.dev/source/sepolia/path.minted/example",
        sourceStatus: "ready",
      })
    );

    const { unmount } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const proof = (await screen.findByText("$PATH minted")).closest(
      ".dotfield__mint-proof",
    );
    expectCtaAnchoredOverlay(proof);
    const proofScope = within(proof as HTMLElement);
    expect(proofScope.getAllByText(/PATH #18/).length).toBeGreaterThan(0);
    expect(proofScope.getByRole("link", { name: "view PATH" })).toHaveAttribute(
      "href",
      "/path/18"
    );
    act(() => {
      window.dispatchEvent(
        new globalThis.CustomEvent(INSHELL_WALLET_VISIBILITY_EVENT, {
          detail: { open: true },
        })
      );
    });
    expect(screen.queryByText("$PATH minted")).toBeNull();
    act(() => {
      window.dispatchEvent(
        new globalThis.CustomEvent(INSHELL_WALLET_VISIBILITY_EVENT, {
          detail: { open: false },
        })
      );
    });
    expect(screen.getByText("$PATH minted")).toBeTruthy();
    unmount();

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(screen.getAllByText(/PATH #18/).length).toBeGreaterThan(0);
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss PATH mint proof" })
    );
    expect(screen.queryByText("$PATH minted")).toBeNull();
    expect(window.localStorage.getItem("inshell.pathMintProof.v2")).toBeNull();
  });

  test("discards legacy PATH mint proof instead of mixing it with a new chain", async () => {
    window.localStorage.setItem(
      "inshell.pathMintProof.v1",
      JSON.stringify({
        version: 1,
        tokenId: 3,
        epoch: 3,
        owner: DEFAULT_WALLET_ADDRESS,
        priceDec: "9041000000000000",
        priceLabel: "0.009041",
        txHash: "0xstale",
        blockNumber: 742,
        sourceUrl: "https://example.test/stale",
        sourceStatus: "ready",
      }),
    );

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    await waitFor(() => {
      expect(window.localStorage.getItem("inshell.pathMintProof.v1")).toBeNull();
    });
    expect(screen.queryByText("$PATH minted")).toBeNull();
  });

  test("discards a stored PATH mint proof when its receipt no longer exists", async () => {
    (mockProvider as any).request = jest.fn(async () => null);
    window.localStorage.setItem(
      "inshell.pathMintProof.v2",
      JSON.stringify({
        version: 2,
        chainId: 11155111,
        pulseAuction: TEST_AUCTION_ADDRESS,
        tokenId: 3,
        epoch: 3,
        owner: DEFAULT_WALLET_ADDRESS,
        priceDec: "9041000000000000",
        priceLabel: "0.009041",
        txHash: "0xmissing",
        blockNumber: 742,
        sourceUrl: "https://example.test/missing",
        sourceStatus: "ready",
      }),
    );

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);

    await waitFor(() => {
      expect(window.localStorage.getItem("inshell.pathMintProof.v2")).toBeNull();
    });
    expect(screen.queryByText("$PATH minted")).toBeNull();
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
      expect(screen.getByText(/Need .*; have/i).parentElement).toHaveClass(
        "dotfield__cta-stack",
      );
      expect(mintButton).toBeDisabled();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

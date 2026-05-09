import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import AuctionCanvas from "../src/components/AuctionCanvas";
import normal from "./fixtures/pulse_normal.json";
import huge from "./fixtures/pulse_huge_pump.json";
import tiny from "./fixtures/pulse_tiny_pump.json";
import epoch2 from "./fixtures/pulse_epoch2.json";
import stale from "./fixtures/pulse_stale.json";

const mockUseAuctionBids = jest.fn();
const mockUseAuctionCore = jest.fn();
const mockCallContract = jest.fn<
  (...args: any[]) => Promise<{ result: string[] }>
>();
const mockProvider = {
  callContract: mockCallContract,
};

jest.mock("../src/hooks/useAuctionBids", () => ({
  useAuctionBids: (...args: any[]) => mockUseAuctionBids(...args),
}));
jest.mock("../src/hooks/useAuctionCore", () => ({
  useAuctionCore: (...args: any[]) => mockUseAuctionCore(...args),
}));
jest.mock("@inshell/wallet", () => ({
  useWallet: () => ({
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
    connectors: [],
    connectStatus: "idle",
    requestAccounts: jest.fn(),
    watchAsset: jest.fn(),
  }),
}));

type Fixture = {
  k: number;
  epoch: {
    epochIndex: number;
    floor: number;
    D: number | null;
    tStart: number;
    tNow: number;
  };
};

function toDec(val: number) {
  return Math.round(Math.max(0, val)).toString();
}

function withFixture(fx: Fixture) {
  const { floor, D, tStart, tNow, epochIndex } = fx.epoch as {
    floor: number;
    D: number | null;
    tStart: number;
    tNow: number;
    epochIndex: number;
  };
  const k = fx.k;
  const decimals = 18;
  const scale = 10n ** 18n;
  const kScaled = BigInt(Math.round(k)) * scale;
  const ptsScaled = BigInt(Math.round(D ?? 1)) * scale;
  const floorRaw = BigInt(Math.round(Math.max(0, floor))) * scale;
  const genesisPremium = Math.max(1, Math.round(D ?? 1));
  const genesisPriceRaw = BigInt(Math.round(Math.max(0, floor + genesisPremium))) * scale;
  const floorDec = floorRaw.toString();
  const genesisPriceDec = genesisPriceRaw.toString();
  const amountU256 = { low: floorRaw.toString(), high: "0" };
  mockUseAuctionCore.mockReturnValue({
    data: {
      config: {
        openTimeSec: tStart - 2,
        genesisPrice: { dec: genesisPriceDec },
        genesisFloor: { dec: floorDec },
        k: { dec: kScaled.toString() },
        pts: ptsScaled.toString(),
      },
    },
    ready: true,
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
  // two bids to seed last/prev times
  const lastBidAt = tStart * 1000;
  const prevBidAt = (tStart - 1) * 1000;
  mockUseAuctionBids.mockReturnValue({
    bids: [
      {
        key: `b#${epochIndex - 1}`,
        atMs: prevBidAt,
        amount: {
          dec: floorDec,
          raw: amountU256,
          value: floorRaw,
        },
        bidder: "0xprev",
        blockNumber: 1,
        epochIndex: epochIndex - 1,
      },
      {
        key: `b#${epochIndex}`,
        atMs: lastBidAt,
        amount: {
          dec: floorDec,
          raw: amountU256,
          value: floorRaw,
        },
        bidder: "0xlast",
        blockNumber: 2,
        epochIndex,
      },
    ],
    ready: true,
    loading: false,
    error: null,
  });
  return { floor, tNow };
}

function stubSvg(container: HTMLElement) {
  const svg = container.querySelector("svg") as any;
  if (svg) {
    svg.getScreenCTM = () => null;
    svg.createSVGPoint = () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 0, y: 0 }),
    });
  }
}

function parsePathEnd(pathD: string | null): { x: number; y: number } | null {
  if (!pathD) return null;
  const nums = pathD
    .match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)
    ?.map((raw) => Number(raw))
    .filter((n) => Number.isFinite(n));
  if (!nums || nums.length < 2) return null;
  return { x: nums[nums.length - 2], y: nums[nums.length - 1] };
}

describe("AuctionCanvas with pulse fixtures", () => {
  beforeEach(() => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
      VITE_PAYMENT_TOKEN_SYMBOL: "ETH",
    };
    mockCallContract.mockReset();
    mockCallContract.mockResolvedValue({ result: [] });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(normal.epoch.tNow * 1000));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (globalThis as any).__VITE_ENV__;
    window.history.pushState({}, "", "/");
  });

  const fixtures: Array<[string, Fixture]> = [
    ["normal", normal],
    ["tiny pump", tiny],
    ["stale", stale],
  ];

  fixtures.forEach(([label, fx]) => {
    test(`renders and shows tooltip for ${label} fixture`, () => {
      withFixture(fx);
      jest.setSystemTime(new Date((fx as any).epoch.tNow * 1000));
      const { container } = render(
        <AuctionCanvas address="0xabc" provider={mockProvider as any} />
      );
      stubSvg(container);
      expect(screen.getByRole("img", { name: /pulse auction curve/i })).toBeTruthy();
      expect(screen.getByText(/^time\s*→$/i)).toBeTruthy();
      expect(screen.getByText(/price\s*\(eth\)\s*↑/i)).toBeTruthy();
      const path = container.querySelector(".dotfield__curve");
      expect(path).toBeTruthy();
      fireEvent.mouseMove(path as unknown as HTMLElement, {
        clientX: 10,
        clientY: 10,
      });
      const popover = container.querySelector(".dotfield__popover");
      expect(popover).toBeTruthy();
      expect(within(popover as HTMLElement).getByText(/^price$/i)).toBeTruthy();
    });
  });

  test("curve tooltip shows t½, u(t½), and 1 t½ drop rows", () => {
    const fx: Fixture = {
      k: 1000,
      epoch: {
        epochIndex: 2,
        floor: 10,
        D: 1,
        tStart: 1000,
        tNow: 1000 + 3661,
      },
    };
    withFixture(fx);
    jest.setSystemTime(new Date(fx.epoch.tNow * 1000));
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    stubSvg(container);
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 10,
      clientY: 10,
    });
    const popover = container.querySelector(".dotfield__popover") as HTMLElement;
    expect(popover).toBeTruthy();
    const tHalfRow = within(popover).getByText(/^t½$/i).parentElement;
    expect(tHalfRow).toBeTruthy();
    expect(within(tHalfRow as HTMLElement).getByText(/^16m40s$/i)).toBeTruthy();
    const uRow = within(popover).getByText(/^u\(t½\)$/i).parentElement;
    expect(uRow).toBeTruthy();
    expect(within(popover).getByText(/^1 t½ drop$/i)).toBeTruthy();
    expect(within(popover).getByText(/^time$/i)).toBeTruthy();
    expect(within(popover).queryByText(/since last sale/i)).toBeNull();
    expect(within(popover).getByText(/^age$/i)).toBeTruthy();
  });

  test("renders without cliff for huge pump fixture", () => {
    withFixture(huge);
    jest.setSystemTime(new Date((huge as any).epoch.tNow * 1000));
    const { container } = render(
      <AuctionCanvas address="0xdef" provider={mockProvider as any} />
    );
    stubSvg(container);
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 15,
      clientY: 10,
    });
    const popover = container.querySelector(".dotfield__popover");
    expect(popover).toBeTruthy();
    expect(within(popover as HTMLElement).getByText(/^price$/i)).toBeTruthy();
  });

  test("epoch 2 fixture renders with synthetic curve", () => {
    withFixture(epoch2);
    jest.setSystemTime(new Date((epoch2 as any).epoch.tNow * 1000));
    const { container } = render(
      <AuctionCanvas address="0xghi" provider={mockProvider as any} />
    );
    stubSvg(container);
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 12,
      clientY: 8,
    });
    const popover = container.querySelector(".dotfield__popover");
    expect(popover).toBeTruthy();
    expect(within(popover as HTMLElement).getByText(/^price$/i)).toBeTruthy();
  });

  test("sale dot popover renders amounts", async () => {
    withFixture(normal);
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    const dots = Array.from(
      container.querySelectorAll(".dotfield__point--sale .dotfield__dot")
    ) as HTMLElement[];
    const dot = dots[Math.min(1, Math.max(0, dots.length - 1))] ?? null;
    expect(dot).toBeTruthy();
    await act(async () => {
      fireEvent.mouseMove(dot as HTMLElement, {
        clientX: 5,
        clientY: 5,
      });
      await Promise.resolve();
    });
    expect(screen.getByText(/sale #/i)).toBeTruthy();
    const popover = container.querySelector(".dotfield__popover") as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.textContent).toMatch(/ETH/i);
  });

  test("normal fixture selects sale dots without rendering inspect panel", () => {
    window.history.pushState({}, "", "/?fixture=normal");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    const points = Array.from(
      container.querySelectorAll(".dotfield__point--sale")
    ) as HTMLElement[];
    expect(points.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(points[0]);
    expect(points[0].classList.contains("is-selected")).toBe(true);
    expect(container.querySelector(".dotfield__inspect")).toBeNull();
    expect(screen.queryByText(/pinned sale/i)).toBeNull();

    fireEvent.click(points[1]);
    expect(points[0].classList.contains("is-selected")).toBe(false);
    expect(points[1].classList.contains("is-selected")).toBe(true);

    window.history.pushState({}, "", "/");
  });

  test.each(["mixeda", "mixedb", "mixedc"])(
    "keeps segment endpoints aligned to next sale dot for %s",
    (fixtureName) => {
      window.history.pushState({}, "", `/?fixture=${fixtureName}`);
      mockUseAuctionCore.mockReturnValue({
        data: null,
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
      const paths = Array.from(container.querySelectorAll(".dotfield__curve"));
      const points = Array.from(
        container.querySelectorAll(".dotfield__point--sale")
      );
      expect(paths.length).toBeGreaterThan(2);
      expect(paths.length).toBe(points.length + 1);

      let maxDelta = 0;
      for (let i = 0; i < points.length; i += 1) {
        const end = parsePathEnd(paths[i].getAttribute("d"));
        expect(end).toBeTruthy();
        const nextPoint = points[i] as HTMLElement;
        const cx = Number(nextPoint.dataset.x ?? Number.NaN);
        const cy = Number(nextPoint.dataset.y ?? Number.NaN);
        const dx = Math.abs((end as { x: number; y: number }).x - cx);
        const dy = Math.abs((end as { x: number; y: number }).y - cy);
        maxDelta = Math.max(maxDelta, Math.hypot(dx, dy));
      }
      expect(maxDelta).toBeLessThan(1.5);
      window.history.pushState({}, "", "/");
    }
  );

  test("random fixture honors epoch count override from query", () => {
    window.history.pushState({}, "", "/?fixture=random&epochs=37");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    const points = container.querySelectorAll(".dotfield__point--sale");
    expect(points.length).toBe(37);
    window.history.pushState({}, "", "/");
  });

  test("random fixture honors sale count override from query", () => {
    window.history.pushState({}, "", "/?fixture=random&sales=13");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    const points = container.querySelectorAll(".dotfield__point--sale");
    expect(points.length).toBe(13);
    window.history.pushState({}, "", "/");
  });

  test("random fixture does not remain stuck in loading state", () => {
    window.history.pushState({}, "", "/?fixture=random");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    expect(screen.queryByText(/loading curve/i)).toBeNull();
    window.history.pushState({}, "", "/");
  });

  test("before_open fixture renders pre-open countdown state", async () => {
    window.history.pushState({}, "", "/?fixture=before_open");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    expect(await screen.findByText(/Auction opens at/i)).toBeTruthy();
    expect(screen.getByText(/Opens in 10m0s/i)).toBeTruthy();
    expect(
      screen.getByText(/First bid can land at or after open time/i)
    ).toBeTruthy();
    expect(container.querySelector(".dotfield__curve")).toBeNull();
    window.history.pushState({}, "", "/");
  });

  test("open_not_active fixture renders after-open before-mint state", async () => {
    window.history.pushState({}, "", "/?fixture=open_not_active");
    mockUseAuctionCore.mockReturnValue({
      data: null,
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
    expect(await screen.findByText(/Auction is open/i)).toBeTruthy();
    expect(screen.getByText(/Waiting for first bid/i)).toBeTruthy();
    expect(screen.getByText(/Opening ask:/i)).toBeTruthy();
    expect(screen.getByText(/Current ask:/i)).toBeTruthy();
    expect(container.querySelector(".dotfield__curve")).toBeNull();
    window.history.pushState({}, "", "/");
  });

});

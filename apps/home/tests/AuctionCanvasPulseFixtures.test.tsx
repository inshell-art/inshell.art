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
  const amountDec = toDec(floor);
  const amountU256 = { low: amountDec, high: "0" };
  mockUseAuctionCore.mockReturnValue({
    data: {
      config: {
        openTimeSec: tStart,
        genesisPrice: { dec: amountDec },
        genesisFloor: { dec: amountDec },
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
          dec: amountDec,
          raw: amountU256,
          value: BigInt(Math.round(floor)) * scale,
        },
        bidder: "0xprev",
        blockNumber: 1,
        epochIndex: epochIndex - 1,
      },
      {
        key: `b#${epochIndex}`,
        atMs: lastBidAt,
        amount: {
          dec: amountDec,
          raw: amountU256,
          value: BigInt(Math.round(floor)) * scale,
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

describe("AuctionCanvas with pulse fixtures", () => {
  beforeEach(() => {
    mockCallContract.mockReset();
    mockCallContract.mockResolvedValue({ result: [] });
    jest.useFakeTimers();
    jest.setSystemTime(new Date(normal.epoch.tNow * 1000));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
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
      expect(screen.getByRole("img", { name: /pulse curve/i })).toBeTruthy();
      expect(screen.getByText(/time/i)).toBeTruthy();
      expect(screen.getByText(/price/i)).toBeTruthy();
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

  test("curve tooltip uses elapsed time for since/ago rows", () => {
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
    const sinceRow = within(popover).getByText(/since last sale/i).parentElement;
    expect(sinceRow).toBeTruthy();
    expect(within(sinceRow as HTMLElement).getByText("00:00:00")).toBeTruthy();
    const agoRow = within(popover).getByText(/^ago$/i).parentElement;
    expect(agoRow).toBeTruthy();
    expect(within(agoRow as HTMLElement).getByText("01:01:01")).toBeTruthy();
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

  test("bids tab popover renders amounts", async () => {
    withFixture(normal);
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    fireEvent.click(screen.getByText(/bids/i));
    const dot = container.querySelector(".dotfield__dot");
    expect(dot).toBeTruthy();
    await act(async () => {
      fireEvent.mouseMove(dot as unknown as HTMLElement, {
        clientX: 5,
        clientY: 5,
      });
      await Promise.resolve();
    });
    expect(screen.getByText(/sale #/i)).toBeTruthy();
    expect(screen.getByText(/STRK/i)).toBeTruthy();
  });
});

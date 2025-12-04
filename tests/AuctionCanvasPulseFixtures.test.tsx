import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import AuctionCanvas from "../src/components/AuctionCanvas";
import normal from "./fixtures/pulse_normal.json";
import huge from "./fixtures/pulse_huge_pump.json";
import tiny from "./fixtures/pulse_tiny_pump.json";
import epoch2 from "./fixtures/pulse_epoch2.json";
import stale from "./fixtures/pulse_stale.json";

const mockUseAuctionBids = jest.fn();
const mockUseAuctionCore = jest.fn();

jest.mock("../src/hooks/useAuctionBids", () => ({
  useAuctionBids: (...args: any[]) => mockUseAuctionBids(...args),
}));
jest.mock("../src/hooks/useAuctionCore", () => ({
  useAuctionCore: (...args: any[]) => mockUseAuctionCore(...args),
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
      const { container } = render(<AuctionCanvas address="0xabc" />);
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
      expect(screen.getByText(/amount/i)).toBeTruthy();
    });
  });

  test("renders without cliff for huge pump fixture", () => {
    withFixture(huge);
    jest.setSystemTime(new Date((huge as any).epoch.tNow * 1000));
    const { container } = render(<AuctionCanvas address="0xdef" />);
    stubSvg(container);
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 15,
      clientY: 10,
    });
    expect(screen.getByText(/amount/i)).toBeTruthy();
  });

  test("epoch 2 fixture renders with synthetic curve", () => {
    withFixture(epoch2);
    jest.setSystemTime(new Date((epoch2 as any).epoch.tNow * 1000));
    const { container } = render(<AuctionCanvas address="0xghi" />);
    stubSvg(container);
    const path = container.querySelector(".dotfield__curve");
    expect(path).toBeTruthy();
    fireEvent.mouseMove(path as unknown as HTMLElement, {
      clientX: 12,
      clientY: 8,
    });
    expect(screen.getByText(/amount/i)).toBeTruthy();
  });

  test("bids tab popover renders amounts", () => {
    withFixture(normal);
    const { container } = render(<AuctionCanvas address="0xabc" />);
    fireEvent.click(screen.getByText(/bids/i));
    const dot = container.querySelector(".dotfield__dot");
    expect(dot).toBeTruthy();
    fireEvent.mouseMove(dot as unknown as HTMLElement, {
      clientX: 5,
      clientY: 5,
    });
    expect(screen.getByText(/bid #/i)).toBeTruthy();
    expect(screen.getByText(/STRK/i)).toBeTruthy();
  });
});

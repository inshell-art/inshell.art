import "@testing-library/jest-dom/extend-expect";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, test, expect, jest, afterEach } from "@jest/globals";
import AuctionStatus from "../src/components/AuctionStatus";

// Mocks
jest.mock("../src/hooks/useAuctionCore");
jest.mock("../src/hooks/useAuctionBids");

const mockUseAuctionCore =
  (jest.requireMock("../src/hooks/useAuctionCore") as any)
    .useAuctionCore as jest.MockedFunction<any>;
const mockUseAuctionBids =
  (jest.requireMock("../src/hooks/useAuctionBids") as any)
    .useAuctionBids as jest.MockedFunction<any>;

const mkU256 = (n: number) => ({
  raw: { low: String(n), high: "0" },
  value: BigInt(n),
  dec: String(n),
});

const baseSnapshot = {
  price: mkU256(100),
  active: false,
  config: {
    openTimeSec: 0,
    genesisPrice: mkU256(50),
    genesisFloor: mkU256(25),
    k: mkU256(1),
    pts: "1",
  },
};

function setup(nowMs: number, snapshot: any) {
  jest.spyOn(Date, "now").mockReturnValue(nowMs);
  mockUseAuctionCore.mockReturnValue({
    data: snapshot,
    loading: false,
    error: null,
    ready: true,
    refresh: jest.fn(),
  });
  mockUseAuctionBids.mockReturnValue({
    bids: [],
    loading: false,
    error: null,
    ready: true,
    pullOnce: jest.fn(),
  });
}

describe("AuctionStatus status pill", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("shows Upcoming before open_time", () => {
    const now = Date.UTC(2025, 0, 1);
    const snapshot = {
      ...baseSnapshot,
      active: false,
      config: { ...baseSnapshot.config, openTimeSec: now / 1000 + 3600 },
    };
    setup(now, snapshot);

    render(<AuctionStatus address="0x1" />);

    expect(screen.getByText(/Upcoming/i)).toBeInTheDocument();
  });

  test("shows Awaiting genesis after open but before first bid", () => {
    const now = Date.UTC(2025, 0, 1, 1, 0, 0);
    const snapshot = {
      ...baseSnapshot,
      active: false,
      config: { ...baseSnapshot.config, openTimeSec: now / 1000 - 120 },
    };
    setup(now, snapshot);

    render(<AuctionStatus address="0x1" />);

    expect(screen.getByText(/Awaiting genesis/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting first bid/i)).toBeInTheDocument();
  });

  test("shows Active once curve is active", () => {
    const now = Date.UTC(2025, 0, 1, 2, 0, 0);
    const snapshot = {
      ...baseSnapshot,
      active: true,
      config: { ...baseSnapshot.config, openTimeSec: now / 1000 - 500 },
    };
    setup(now, snapshot);

    render(<AuctionStatus address="0x1" />);

    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });
});

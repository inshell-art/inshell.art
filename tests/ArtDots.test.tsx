import "@testing-library/jest-dom";
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AuctionCanvas from "../src/components/AuctionCanvas";

const mockUseAuctionBids = jest.fn();

jest.mock("../src/hooks/useAuctionBids", () => ({
  useAuctionBids: (...args: any[]) => mockUseAuctionBids(...args),
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

describe.skip("AuctionCanvas", () => {
  beforeEach(() => {
    mockUseAuctionBids.mockReturnValue({
      bids: sampleBids,
      ready: true,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders mint button and dots", () => {
    const { container } = render(<AuctionCanvas address="0xabc" />);
    expect(screen.getByText(/mint/i)).toBeTruthy();

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBeGreaterThan(0);
  });

  test("shows popover on hover with shortened info", () => {
    const { container } = render(<AuctionCanvas address="0xabc" />);
    const circle = container.querySelector("circle");
    expect(circle).toBeTruthy();
    fireEvent.mouseMove(circle as unknown as HTMLElement, {
      clientX: 10,
      clientY: 10,
    });

    expect(screen.getByText(/bid #/i)).toBeTruthy();
    expect(screen.getByText(/STRK/)).toBeTruthy();
  });
});

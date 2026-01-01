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

jest.mock("../src/hooks/useAuctionBids", () => ({
  useAuctionBids: (...args: any[]) => mockUseAuctionBids(...args),
}));
jest.mock("../src/hooks/useAuctionCore", () => ({
  useAuctionCore: (...args: any[]) => mockUseAuctionCore(...args),
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
      data: {
        config: {
          openTimeSec: Date.UTC(2024, 0, 1) / 1000,
          genesisPrice: { dec: "1" },
          genesisFloor: { dec: "1" },
          k: { dec: "10" },
          pts: "1" },
      },
      ready: false,
      loading: true,
      error: null,
      refresh: jest.fn(),
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/loading curve/i)).toBeTruthy();
  });

  test("shows error message when curve load fails", () => {
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
    expect(screen.getByText(/error loading curve/i)).toBeTruthy();
    expect(screen.getByText(/boom/i)).toBeTruthy();
  });

  test("renders baseline curve when there are no bids", () => {
    mockUseAuctionBids.mockReturnValue({
      bids: [],
      ready: true,
      loading: false,
      error: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByRole("img", { name: /pulse curve/i })).toBeTruthy();
    expect(screen.getByText(/time \(half-lives\)/i)).toBeTruthy();
  });
});

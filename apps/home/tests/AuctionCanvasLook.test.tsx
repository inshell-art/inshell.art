import "@testing-library/jest-dom";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import React from "react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
import AuctionCanvas from "../src/components/AuctionCanvas";
import { encodeByteArray, mockAuctionCore } from "./testUtils";

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
  }),
}));

describe("AuctionCanvas look tab", () => {
  beforeEach(() => {
    mockCallContract.mockReset();
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b2",
          atMs: Date.UTC(2025, 0, 1, 1),
          amount: { raw: { low: "2", high: "0" }, dec: "2", value: 2n },
          bidder: "0x2222222222222222",
          blockNumber: 11,
          epochIndex: 2,
          tokenId: 2,
        },
      ],
      ready: true,
      loading: false,
      error: null,
    });
    mockAuctionCore(mockUseAuctionCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("loads look metadata and shows attributes popover", async () => {
    const meta = {
      name: "PATH #1",
      image: "data:image/svg+xml,<svg viewBox='0 0 1 1'></svg>",
      attributes: [
        { trait_type: "Steps", value: 47 },
        { trait_type: "Voice", value: 2 },
        { trait_type: "THOUGHT", value: "Manifested(1/2)" },
        { trait_type: "WILL", value: "Manifested(0/2)" },
        { trait_type: "AWA", value: "Manifested(0/1)" },
      ],
    };
    const tokenUri = `data:application/json,${JSON.stringify(meta)}`;
    mockCallContract.mockResolvedValue({ result: encodeByteArray(tokenUri) });

    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    fireEvent.click(screen.getByText(/look/i));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /path #1/i })).toBeTruthy();
    });

    expect(screen.getByText(/token #1/i)).toBeTruthy();
    expect(screen.getByText(/THOUGHT/i)).toBeTruthy();
    expect(screen.getByText(/\(1\/2\)/i)).toBeTruthy();

    const viewport = container.querySelector(
      ".dotfield__look-viewport"
    ) as HTMLElement;
    expect(viewport).toBeTruthy();
    fireEvent.mouseMove(viewport, { clientX: 10, clientY: 10 });

    expect(screen.getByText(/attributes/i)).toBeTruthy();
    expect(screen.getByText(/steps/i)).toBeTruthy();
    const popover = container.querySelector(
      ".dotfield__popover"
    ) as HTMLElement;
    expect(popover).toBeTruthy();
    expect(
      within(popover).getByText(/Manifested\(1\/2\)/i)
    ).toBeTruthy();
  });

  test("look nav shows no more at lower bound", async () => {
    const meta = {
      name: "PATH #1",
      image: "data:image/svg+xml,<svg viewBox='0 0 1 1'></svg>",
      attributes: [],
    };
    const tokenUri = `data:application/json,${JSON.stringify(meta)}`;
    mockCallContract.mockResolvedValue({ result: encodeByteArray(tokenUri) });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    fireEvent.click(screen.getByText(/look/i));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /path #1/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText(/previous token/i));
    expect(screen.getByText(/no more/i)).toBeTruthy();
  });

  test("loading look appears only after delay", async () => {
    jest.useFakeTimers();
    const pending = new Promise<{ result: string[] }>(() => {});
    mockCallContract.mockReturnValue(pending);

    try {
      render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
      fireEvent.click(screen.getByText(/look/i));

      expect(screen.queryByText(/loading svg/i)).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(499);
      });
      expect(screen.queryByText(/loading svg/i)).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(2);
      });
      expect(screen.getByText(/loading svg/i)).toBeTruthy();
      expect(screen.queryByText(/no svg yet/i)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test("look nav shows no more at upper bound", async () => {
    const meta = {
      name: "PATH #1",
      image: "data:image/svg+xml,<svg viewBox='0 0 1 1'></svg>",
      attributes: [],
    };
    const tokenUri = `data:application/json,${JSON.stringify(meta)}`;
    mockCallContract.mockResolvedValue({ result: encodeByteArray(tokenUri) });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    fireEvent.click(screen.getByText(/look/i));

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /path #1/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText(/next token/i));
    await waitFor(() => {
      expect(screen.getByText(/token #2/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText(/next token/i));
    expect(screen.getByText(/no more/i)).toBeTruthy();
  });

  test("shows error when token_uri response is invalid", async () => {
    jest.useFakeTimers();
    mockCallContract.mockResolvedValue({ result: ["0", "0", "0"] });

    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    fireEvent.click(screen.getByText(/look/i));

    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(screen.getByText(/error loading look/i)).toBeTruthy();
    jest.useRealTimers();
  });
});

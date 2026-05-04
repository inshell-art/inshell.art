import "@testing-library/jest-dom";
import { render, fireEvent } from "@testing-library/react";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";
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

describe("AuctionCanvas sale tooltip", () => {
  beforeEach(() => {
    const nowMs = Date.now();
    mockCallContract.mockReset();
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "b1",
          atMs: nowMs - 2 * 60 * 1000,
          amount: { raw: { low: "1", high: "0" }, dec: "1", value: 1n },
          bidder: "0x1111111111111111",
          blockNumber: 10,
          epochIndex: 1,
          tokenId: 1,
        },
        {
          key: "b2",
          atMs: nowMs - 60 * 1000,
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

  test("shows sale details without loading token image", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );

    const dot = container.querySelector(".dotfield__point--sale .dotfield__dot");
    expect(dot).toBeTruthy();
    fireEvent.mouseMove(dot as unknown as HTMLElement, {
      clientX: 10,
      clientY: 10,
    });

    expect(container.querySelector(".dotfield__popover")).toBeTruthy();
    expect(container.querySelector("img[alt^='PATH #']")).toBeNull();
    const tokenUriCalls = mockCallContract.mock.calls.filter(
      (args) => args[0]?.entrypoint === "token_uri"
    );
    expect(tokenUriCalls).toHaveLength(0);
  });
});

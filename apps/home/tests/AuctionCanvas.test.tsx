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
const fakeConnector = { id: "ready", name: "Ready", available: () => true };
const STARTUP_GRACE_MS = 2500;
const DELAY_MS = 500;
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const createWalletState = (overrides: Partial<any> = {}) => ({
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
  connectors: [fakeConnector],
  connectStatus: "idle",
  requestAccounts: jest.fn(),
  watchAsset: jest.fn(),
  ...overrides,
});
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
    mockWalletState = createWalletState();
    (globalThis as any).__VITE_ENV__ = {};
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
  });

  test("renders mint button and dots", () => {
    const { container } = render(
      <AuctionCanvas address="0xabc" provider={mockProvider as any} />
    );
    expect(container.querySelector(".dotfield__mint")).toBeTruthy();

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
      data: null,
      ready: false,
      loading: true,
      error: null,
      refresh: jest.fn(),
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    expect(screen.getByText(/loading curve/i)).toBeTruthy();
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
    expect(screen.getByText(/error loading curve/i)).toBeTruthy();
    expect(screen.getByText(/boom/i)).toBeTruthy();
    jest.useRealTimers();
  });

  test("shows genesis waiting message when there are no bids", () => {
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
    expect(screen.getByText(/Genesis not yet minted/i)).toBeTruthy();
  });

  test("genesis ask label scales by token decimals", () => {
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
    expect(screen.getByText(/Ask: 1 STRK/i)).toBeTruthy();
  });

  test("auction status override wins over live state", () => {
    (globalThis as any).__PULSE_STATUS__ = "pre_open";
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
    expect(screen.getByText(/Auction will open at/i)).toBeTruthy();
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
    expect(screen.getByText(/Auction will open at/i)).toBeTruthy();
  });

  test("shows no wallet notice when no connectors are available", () => {
    mockWalletState = createWalletState({
      connectors: [],
      address: null,
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/No Starknet wallet found/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*connect\s*\]/i)).toBeTruthy();
    });
  });

  test("shows unlock notice when wallet is locked", () => {
    mockWalletState = createWalletState({
      account: null,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/\[\s*unlock\s*\]/i)).toBeTruthy();
    });
  });

  test("unlock CTA requests accounts before reconnect", async () => {
    const requestAccounts = jest.fn().mockResolvedValue(["0xabc"]);
    mockWalletState = createWalletState({
      account: null,
      accountMissing: true,
      requestAccounts,
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    const unlockButton = await waitFor(() =>
      screen.getByText(/\[\s*unlock\s*\]/i)
    );
    fireEvent.click(unlockButton);
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

  test("shows wrong network notice when chain is incorrect", () => {
    mockWalletState = createWalletState({
      account: {},
      chainId: 1n,
      chain: { name: "Othernet" },
    });
    render(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    return waitFor(() => {
      expect(screen.getByText(/Sepolia only/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*switch\s*\]/i)).toBeTruthy();
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
      expect(screen.getByText(/Approve STRK/i)).toBeTruthy();
    });
    mockWalletState = createWalletState({
      isConnected: false,
      address: null,
      account: null,
    });
    rerender(<AuctionCanvas address="0xabc" provider={mockProvider as any} />);
    await waitFor(() => {
      expect(screen.queryByText(/Approve STRK/i)).toBeNull();
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
    expect(screen.queryByText(/Loading/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(DELAY_MS - 50);
    });
    expect(screen.queryByText(/Loading/i)).toBeNull();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.getByText(/Loading/i)).toBeTruthy();
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
      expect(screen.getByText(/Approve STRK/i)).toBeTruthy();
    });
    expect(screen.getByText(/\[\s*mint\s*\]/i)).toBeTruthy();
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/Wallet open: Approve in wallet/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*sign\s*\]/i)).toBeTruthy();
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/Sign mint/i)).toBeTruthy();
      expect(screen.getByText(/\[\s*sign\s*\]/i)).toBeTruthy();
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Submitted: Approval pending/i)).toBeTruthy();
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
    await waitFor(() => {
      expect(screen.getByText(/\[\s*pending\s*\]/i)).toBeTruthy();
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText(/Minting .* pending/i)).toBeTruthy();
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(
          screen.getByText(/Account needs upgrade\/activation/i)
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/Signature cancelled/i)).toBeTruthy();
      });
      expect(screen.getByText(/\[\s*retry\s*\]/i)).toBeTruthy();
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
      await waitFor(() => {
        expect(screen.getByText(/Insufficient STRK at execution/i)).toBeTruthy();
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
      const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
      await waitFor(() => {
        expect(mintButton).not.toBeDisabled();
      });
      await act(async () => {
        fireEvent.click(mintButton);
      });
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
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });

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
    const mintButton = screen.getByText(/\[\s*mint\s*\]/i);
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });

    await waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    expect(execute.mock.calls[0][0].entrypoint).toBe("bid");
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
      expect(screen.getByText(/Approve STRK/i)).toBeTruthy();
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
    expect(screen.getByText(/Approve STRK/i)).toBeTruthy();
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
    expect(screen.getByText(/Disconnected/i)).toBeTruthy();
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
    const mintButton = await waitFor(() => screen.getByText(/\[\s*mint\s*\]/i));
    await waitFor(() => {
      expect(mintButton).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(mintButton);
    });
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
    expect(screen.getByText(/Minted #5/i)).toBeTruthy();
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
        expect(screen.getByText(/Need .* have/i)).toBeTruthy();
      });
      expect(mintButton).toBeDisabled();
      expect(execute).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

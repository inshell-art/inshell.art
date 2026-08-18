import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { useAuctionBids } from "../src/hooks/useAuctionBids";
import { useAuctionCore } from "../src/hooks/useAuctionCore";

const mockCreateBidsService = jest.fn<any>();
const mockCreateCoreService = jest.fn<any>();

jest.mock("../src/services/auction/bidsService", () => ({
  createBidsService: (...args: unknown[]) => mockCreateBidsService(...args),
}));

jest.mock("../src/services/auction/coreService", () => ({
  createCoreService: (...args: unknown[]) => mockCreateCoreService(...args),
}));

describe("auction hooks", () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("loads bids, publishes service snapshots, and supports a manual refresh", async () => {
    let publish: ((bids: any[]) => void) | undefined;
    const off = jest.fn();
    const pullOnce = jest
      .fn<any>()
      .mockResolvedValueOnce([{ key: "initial" }])
      .mockResolvedValueOnce([{ key: "manual" }]);
    mockCreateBidsService.mockReturnValue({
      onBids: (listener: (bids: any[]) => void) => {
        publish = listener;
        return off;
      },
      pullOnce,
    });

    const { result, unmount } = renderHook(() =>
      useAuctionBids({ address: "0xauction", refreshMs: 0 }),
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(pullOnce).toHaveBeenCalledTimes(1);

    act(() => publish?.([{ key: "published" }]));
    expect(result.current.bids).toEqual([{ key: "published" }]);

    await act(async () => {
      await result.current.pullOnce();
    });
    expect(pullOnce).toHaveBeenCalledTimes(2);

    unmount();
    expect(off).toHaveBeenCalled();
  });

  test("reports bid service construction and request failures", async () => {
    mockCreateBidsService.mockImplementationOnce(() => {
      throw new Error("invalid auction");
    });
    const construction = renderHook(() =>
      useAuctionBids({ address: "bad", refreshMs: 0 }),
    );
    await waitFor(() =>
      expect(String(construction.result.current.error)).toContain("invalid auction"),
    );
    expect(construction.result.current.loading).toBe(false);
    construction.unmount();

    mockCreateBidsService.mockReturnValueOnce({
      onBids: () => jest.fn(),
      pullOnce: jest.fn<any>().mockRejectedValue(new Error("RPC unavailable")),
    });
    const request = renderHook(() =>
      useAuctionBids({ address: "0xauction", refreshMs: 0 }),
    );
    await waitFor(() =>
      expect(String(request.result.current.error)).toContain("RPC unavailable"),
    );
    expect(request.result.current.bids).toEqual([]);
  });

  test("does not fetch bids while disabled", async () => {
    const pullOnce = jest.fn<any>().mockResolvedValue([]);
    mockCreateBidsService.mockReturnValue({
      onBids: () => jest.fn(),
      pullOnce,
    });
    const { result } = renderHook(() =>
      useAuctionBids({ address: "0xauction", enabled: false }),
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(pullOnce).not.toHaveBeenCalled();
  });

  test("loads, refreshes, and reports failures from auction core", async () => {
    const first = { ask: { low: "1", high: "0" } };
    const second = { ask: { low: "2", high: "0" } };
    const snapshot = jest
      .fn<any>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)
      .mockRejectedValueOnce(new Error("snapshot failed"));
    mockCreateCoreService.mockReturnValue({ snapshot });
    const provider = {} as any;

    const { result } = renderHook(() =>
      useAuctionCore({
        address: "0x0000000000000000000000000000000000000001",
        provider,
        refreshMs: 0,
      }),
    );

    await waitFor(() => expect(result.current.data).toEqual(first));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.data).toEqual(second);

    await act(async () => {
      await result.current.refresh();
    });
    expect(String(result.current.error)).toContain("snapshot failed");
    expect(result.current.data).toEqual(second);
  });

  test("reports auction core construction failures and respects disabled state", async () => {
    mockCreateCoreService.mockImplementationOnce(() => {
      throw new Error("missing contract");
    });
    const failed = renderHook(() =>
      useAuctionCore({ address: "bad", refreshMs: 0 }),
    );
    await waitFor(() =>
      expect(String(failed.result.current.error)).toContain("missing contract"),
    );
    expect(failed.result.current.loading).toBe(false);
    failed.unmount();

    const snapshot = jest.fn<any>().mockResolvedValue({ ok: true });
    mockCreateCoreService.mockReturnValueOnce({ snapshot });
    const disabled = renderHook(() =>
      useAuctionCore({ address: "0xauction", enabled: false, refreshMs: 0 }),
    );
    await waitFor(() => expect(disabled.result.current.ready).toBe(true));
    expect(snapshot).not.toHaveBeenCalled();
  });
});

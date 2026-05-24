import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  encodeAbiParameters,
  getAddress,
  toEventSelector,
  type Hex,
} from "viem";
import { createBidsService } from "../src/services/auction/bidsService";

const SALE_TOPIC = toEventSelector("Sale(address,uint64,uint256,uint64,uint64,uint256)");
const AUCTION = "0x1111222233334444555566667777888899990000";
const BUYER = "0x9999888877776666555544443333222211110000";

function addressTopic(address: string): Hex {
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}` as Hex;
}

function uintTopic(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}` as Hex;
}

function saleLog(blockNumber: number, epochIndex: bigint, price: bigint) {
  return {
    address: AUCTION,
    blockNumber: `0x${blockNumber.toString(16)}`,
    data: encodeAbiParameters(
      [
        { name: "price", type: "uint256" },
        { name: "timestamp", type: "uint64" },
        { name: "nextAnchorA", type: "uint64" },
        { name: "nextFloorB", type: "uint256" },
      ],
      [price, BigInt(1_778_888_000 + blockNumber), BigInt(1_778_888_100 + blockNumber), price]
    ),
    logIndex: "0x0",
    topics: [SALE_TOPIC, addressTopic(BUYER), uintTopic(epochIndex)],
    transactionHash: `0x${blockNumber.toString(16).padStart(64, "0")}` as Hex,
  };
}

async function waitForEthGetLogs(provider: { request: jest.Mock }) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const calls = provider.request.mock.calls.filter(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    if (calls.length) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("eth_getLogs was not requested");
}

describe("auction bids service", () => {
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  test("adapts to RPCs with tight eth_getLogs block ranges", async () => {
    const logs = [saleLog(12, 1n, 100n), saleLog(31, 2n, 120n)];
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x28";
        if (method === "eth_getLogs") {
          const filter = params[0];
          const from = Number(BigInt(filter.fromBlock));
          const to = Number(BigInt(filter.toBlock));
          if (to - from + 1 > 10) {
            throw new Error(
              "Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range."
            );
          }
          return logs.filter((log) => {
            const block = Number(BigInt(log.blockNumber));
            return block >= from && block <= to;
          });
        }
        if (method === "eth_getBlockByNumber") {
          return { number: params[0], timestamp: "0x6a000000" };
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    const fresh = await service.pullOnce();
    expect(fresh.map((bid) => bid.epochIndex)).toEqual([1, 2]);
    expect(fresh.map((bid) => bid.amount.dec)).toEqual(["100", "120"]);
    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "eth_getLogs" })
    );
  });

  test("limits broad tight-range log backfills and resumes on the next pull", async () => {
    const logs = [saleLog(12, 1n, 100n), saleLog(55, 2n, 120n)];
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x200";
        if (method === "eth_getLogs") {
          const filter = params[0];
          const from = Number(BigInt(filter.fromBlock));
          const to = Number(BigInt(filter.toBlock));
          if (to - from + 1 > 10) {
            throw new Error(
              "Under the Free tier plan, you can make eth_getLogs requests with up to a 10 block range. Based on your parameters, this block range should work: [0x1, 0xa]."
            );
          }
          return logs.filter((log) => {
            const block = Number(BigInt(log.blockNumber));
            return block >= from && block <= to;
          });
        }
        if (method === "eth_getBlockByNumber") {
          return { number: params[0], timestamp: "0x6a000000" };
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    const first = await service.pullOnce();
    expect(first.map((bid) => bid.epochIndex)).toEqual([1]);
    const firstLogCalls = provider.request.mock.calls.filter(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(firstLogCalls.length).toBeLessThanOrEqual(25);

    const second = await service.pullOnce();
    expect(second.map((bid) => bid.epochIndex)).toEqual([2]);

    const allLogCalls = provider.request.mock.calls.filter(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(allLogCalls.length).toBeLessThan(60);
  });

  test("backs off instead of failing when RPC rate-limits sale history", async () => {
    const provider = {
      request: jest.fn(async ({ method }: any) => {
        if (method === "eth_blockNumber") return "0x20";
        if (method === "eth_getLogs") {
          throw new Error("429 Too Many Requests");
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    await expect(service.pullOnce()).resolves.toEqual([]);
    const firstLogCalls = provider.request.mock.calls.filter(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(firstLogCalls).toHaveLength(1);

    await expect(service.pullOnce()).resolves.toEqual([]);
    const allLogCalls = provider.request.mock.calls.filter(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(allLogCalls).toHaveLength(1);
  });

  test("hydrates cached sale history after a transient RPC rate limit", async () => {
    const logs = [saleLog(12, 1n, 100n)];
    const firstProvider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x20";
        if (method === "eth_getLogs") {
          const filter = params[0];
          const from = Number(BigInt(filter.fromBlock));
          const to = Number(BigInt(filter.toBlock));
          return logs.filter((log) => {
            const block = Number(BigInt(log.blockNumber));
            return block >= from && block <= to;
          });
        }
        if (method === "eth_getBlockByNumber") {
          return { number: params[0], timestamp: "0x6a000000" };
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const firstService = createBidsService({
      address: AUCTION,
      provider: firstProvider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    await expect(firstService.pullOnce()).resolves.toHaveLength(1);

    const secondProvider = {
      request: jest.fn(async ({ method }: any) => {
        if (method === "eth_blockNumber") return "0x28";
        if (method === "eth_getLogs") throw new Error("429 Too Many Requests");
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const secondService = createBidsService({
      address: AUCTION,
      provider: secondProvider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    expect(secondService.getBids().map((bid) => bid.amount.dec)).toEqual(["100"]);
    await expect(secondService.pullOnce()).resolves.toEqual([]);
    expect(secondService.getBids().map((bid) => bid.amount.dec)).toEqual(["100"]);
  });

  test("does not trust incomplete cached lastBlock when backfilling sale history", async () => {
    const cacheKey = `inshell:pulse:bids:${AUCTION.toLowerCase()}:1`;
    globalThis.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 3,
        savedAt: Date.now(),
        lastBlock: 500,
        complete: false,
        bids: [
          {
            key: "tx:cached",
            atMs: 1_778_888_000_000,
            amount: { raw: { low: "100", high: "0" }, dec: "100" },
            blockNumber: 100,
            epochIndex: 1,
          },
        ],
      })
    );
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x20";
        if (method === "eth_getLogs") return [];
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    expect(service.getBids().map((bid) => bid.amount.dec)).toEqual(["100"]);
    await expect(service.pullOnce()).resolves.toEqual([]);

    const firstGetLogsCall = provider.request.mock.calls.find(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(firstGetLogsCall?.[0].params[0].fromBlock).toBe("0x1");
  });

  test("ignores old complete sale-history caches after cache version changes", async () => {
    const cacheKey = `inshell:pulse:bids:${AUCTION.toLowerCase()}:1`;
    globalThis.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        version: 2,
        savedAt: Date.now(),
        lastBlock: 500,
        complete: true,
        bids: [
          {
            key: "tx:legacy",
            atMs: 1_778_888_000_000,
            amount: { raw: { low: "100", high: "0" }, dec: "100" },
            blockNumber: 100,
            epochIndex: 1,
          },
        ],
      })
    );
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x20";
        if (method === "eth_getLogs") return [];
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    expect(service.getBids()).toEqual([]);
    await expect(service.pullOnce()).resolves.toEqual([]);

    const firstGetLogsCall = provider.request.mock.calls.find(
      ([arg]: any[]) => arg.method === "eth_getLogs"
    );
    expect(firstGetLogsCall?.[0].params[0].fromBlock).toBe("0x1");
  });

  test("deduplicates overlapping polling scans", async () => {
    const logs = [saleLog(20, 1n, 100n)];
    let resolveLogs: (logs: any[]) => void = () => undefined;
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x20";
        if (method === "eth_getLogs") {
          const filter = params[0];
          const from = Number(BigInt(filter.fromBlock));
          const to = Number(BigInt(filter.toBlock));
          return new Promise((resolve) => {
            resolveLogs = () =>
              resolve(
                logs.filter((log) => {
                  const block = Number(BigInt(log.blockNumber));
                  return block >= from && block <= to;
                })
              );
          });
        }
        if (method === "eth_getBlockByNumber") {
          return { number: params[0], timestamp: "0x6a000000" };
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const service = createBidsService({
      address: AUCTION,
      provider,
      fromBlock: 1,
      chunkSize: 40_000,
      reorgDepth: 0,
    });

    const first = service.pullOnce();
    const second = service.pullOnce();
    await waitForEthGetLogs(provider);
    resolveLogs(logs);

    await expect(first).resolves.toHaveLength(1);
    await expect(second).resolves.toHaveLength(1);
    expect(
      provider.request.mock.calls.filter(([arg]: any[]) => arg.method === "eth_getLogs")
    ).toHaveLength(1);
  });
});

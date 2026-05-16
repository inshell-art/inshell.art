import { describe, expect, jest, test } from "@jest/globals";
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

import { describe, expect, test } from "@jest/globals";
import { encodeAbiParameters, getAddress, toEventSelector, type Hex } from "viem";
import { extractLocalAnvilSaleHistory } from "../dev/localAnvilSaleHistory";

const SALE_TOPIC = toEventSelector(
  "Sale(address,uint64,uint256,uint64,uint64,uint256)"
);
const AUCTION = "0x1111222233334444555566667777888899990000";
const OTHER_AUCTION = "0x2222333344445555666677778888999900001111";
const BUYER = "0x9999888877776666555544443333222211110000";

function addressTopic(address: string): Hex {
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}` as Hex;
}

function uintTopic(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, "0")}` as Hex;
}

function transaction(
  blockNumber: number,
  epochIndex: bigint,
  price: bigint,
  address = AUCTION
) {
  return {
    block_number: blockNumber,
    info: {
      transaction_hash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
      traces: [
        {
          trace: { address },
          logs: [
            {
              index: 2,
              raw_log: {
                topics: [
                  SALE_TOPIC,
                  addressTopic(BUYER),
                  uintTopic(epochIndex),
                ],
                data: encodeAbiParameters(
                  [
                    { name: "price", type: "uint256" },
                    { name: "timestamp", type: "uint64" },
                    { name: "nextAnchorA", type: "uint64" },
                    { name: "nextFloorB", type: "uint256" },
                  ],
                  [
                    price,
                    BigInt(1_778_888_000 + blockNumber),
                    BigInt(1_778_888_100 + blockNumber),
                    price,
                  ]
                ),
              },
            },
          ],
        },
      ],
    },
  };
}

describe("local Anvil sale history", () => {
  test("recovers persisted Sale receipts that restored eth_getLogs omits", () => {
    const history = extractLocalAnvilSaleHistory(
      {
        best_block_number: 31,
        transactions: [
          transaction(31, 2n, 120n),
          transaction(12, 1n, 100n),
          transaction(20, 99n, 999n, OTHER_AUCTION),
        ],
      },
      AUCTION
    );

    expect(history.lastScannedBlock).toBe(31);
    expect(history.bids.map((bid) => bid.epochIndex)).toEqual([1, 2]);
    expect(history.bids.map((bid) => bid.tokenId)).toEqual([1, 2]);
    expect(history.bids.map((bid) => bid.amount.dec)).toEqual(["100", "120"]);
    expect(history.bids[0]?.bidder).toBe(BUYER.toLowerCase());
    expect(history.bids[0]?.blockNumber).toBe(12);
  });
});

import { http, HttpResponse } from "msw";
import {
  mockAuctionConfig,
  mockGenesisFloor,
  mockSales,
  mockNow,
} from "./data";
import * as SELECTORS from "@/constants/Constants";

/** Utility: wrap result into JSON-RPC 2.0 envelope */
const ok = (id: number, result: unknown) =>
  HttpResponse.json({ id, jsonrpc: "2.0", result });

export const handlers = [
  /* Matches Sepolia, mainnet, or local devnet (/rpc/v0_8 or /rpc) */
  http.post(/\/rpc(\/v0_8)?$/, async ({ request }) => {
    const body = (await request.json()) as any;
    const id = body.id ?? 0;

    switch (body.method) {
      /* ----------------------------------------------------------
       * Generic chain data
       * -------------------------------------------------------- */
      case "starknet_blockNumber": // used by provider.getBlock('latest')
        console.log("starknet_blockNumber", id);
        return ok(id, 6_666_666);

      case "starknet_getBlockWithTxHashes": // getBlock('latest')
        console.log("starknet_getBlockWithTxHashes", id);
        return ok(id, { timestamp: mockNow, block_number: 6_666_666 });

      case "starknet_getClassHashAt": // isDeployed()
        console.log("starknet_getClassHashAt ROOT", id);
        return ok(id, "0xDEADBEEF"); // any felt works

      /* ----------------------------------------------------------
       * Contract read calls (starknet_call)
       * -------------------------------------------------------- */
      case "starknet_call": {
        const selector =
          body.params?.request?.entry_point_selector ??
          body.params?.[0]?.entry_point_selector;

        switch (selector) {
          case SELECTORS.GET_AUCTION_CONFIG:
            return ok(id, mockAuctionConfig);

          case SELECTORS.CURVE_ACTIVE:
            console.log("curve_active", id);
            return ok(id, [1]); // true

          case SELECTORS.GET_CURRENT_PRICE:
            console.log("get_current_price", id);
            return ok(id, ["0x456"]); // ≈ 1110 STRK wei

          case SELECTORS.GET_GENESIS_FLOOR:
            console.log("get_genesis_floor", id);
            return ok(id, [mockGenesisFloor]);

          default:
            return; // bypass
        }
      }

      /* ----------------------------------------------------------
       * Event streaming
       * -------------------------------------------------------- */
      case "starknet_getEvents":
        return ok(id, {
          events: mockSales,
          continuation_token: null,
        });

      default:
        return; // bypass any other RPC method
    }
  }),
];

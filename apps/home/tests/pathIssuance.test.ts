import { describe, expect, test } from "@jest/globals";
import { toU256Num } from "@inshell/utils";
import {
  findPathIssuance,
  formatPathMintPrice,
} from "../src/services/pathIssuance";

describe("PATH issuance", () => {
  test("prefers the explicit token id recorded by persisted Pulse history", () => {
    const issuance = findPathIssuance({
      tokenId: 42n,
      tokenBase: 100,
      epochBase: 7,
      sales: [
        {
          key: "tx:one",
          atMs: 1_778_888_000_000,
          bidder: "0x1111222233334444555566667777888899990000",
          amount: toU256Num({ low: "9041000000000000", high: "0" }),
          tokenId: 42,
          epochIndex: 7,
          txHash: "0xabc",
          blockNumber: 12,
        },
      ],
    });

    expect(issuance?.initialMinter).toBe(
      "0x1111222233334444555566667777888899990000",
    );
    expect(issuance?.blockNumber).toBe(12);
  });

  test("maps a Pulse epoch through the pinned adapter bases", () => {
    const issuance = findPathIssuance({
      tokenId: 102n,
      tokenBase: 100,
      epochBase: 7,
      sales: [
        {
          key: "tx:two",
          atMs: 1_778_888_000_000,
          amount: toU256Num({ low: "9041000000000000", high: "0" }),
          epochIndex: 9,
        },
      ],
    });

    expect(issuance?.price.dec).toBe("9041000000000000");
  });

  test("formats the historical native mint amount for display", () => {
    expect(
      formatPathMintPrice(
        toU256Num({ low: "9041000000000000", high: "0" }),
      ),
    ).toBe("0.009041");
  });
});

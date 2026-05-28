import { describe, expect, jest, test } from "@jest/globals";
import { createCoreService } from "../src/services/auction/coreService";

describe("auction core service", () => {
  test("pins snapshot reads to one block", async () => {
    const blockTags: string[] = [];
    const provider = {
      getBlockNumber: jest.fn(async () => 123),
      callContract: jest.fn(async (args: any, blockTag: any) => {
        blockTags.push(`${args.entrypoint}:${String(blockTag)}`);
        switch (args.entrypoint) {
          case "get_current_price":
            return { price: 500n };
          case "get_config":
            return {
              openTime: 100,
              genesisPrice: 1000n,
              genesisFloor: 100n,
              k: 10_000n,
              pts: 10n,
            };
          case "get_state":
            return {
              epochIndex: 2,
              startTime: 120,
              anchorTime: 110,
              floorPrice: 400n,
              active: true,
            };
          default:
            throw new Error(`unexpected entrypoint ${args.entrypoint}`);
        }
      }),
    };

    const service = createCoreService({
      address: "0x1111111111111111111111111111111111111111",
      provider,
    });

    const snapshot = await service.snapshot();

    expect(provider.getBlockNumber).toHaveBeenCalledTimes(1);
    expect(snapshot.price.dec).toBe("500");
    expect(snapshot.state?.epochIndex).toBe(2);
    expect(blockTags).toEqual([
      "get_current_price:0x7b",
      "get_config:0x7b",
      "get_state:0x7b",
    ]);
  });
});

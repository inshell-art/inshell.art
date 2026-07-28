import assert from "node:assert/strict";
import {
  parsePendingThoughtPathAcquisition,
  pendingThoughtPathAcquisitionMatches,
  serializePendingThoughtPathAcquisition,
  withThoughtPathAcquisitionLock,
} from "./thought-path-acquisition";

const pending = {
  version: 1 as const,
  account: "0x1111111111111111111111111111111111111111",
  chainId: 31337,
  auction: "0x2222222222222222222222222222222222222222",
  pathNft: "0x3333333333333333333333333333333333333333",
  workHash: `0x${"44".repeat(32)}`,
  txHash: `0x${"55".repeat(32)}`,
  updatedAt: 1_000,
};

export const runThoughtPathAcquisitionTests = async () => {
  {
    assert.deepEqual(
      parsePendingThoughtPathAcquisition(
        serializePendingThoughtPathAcquisition(pending),
        pending.updatedAt,
      ),
      pending,
    );
  }

  {
    assert.equal(
      parsePendingThoughtPathAcquisition(pending, pending.updatedAt + 8 * 24 * 60 * 60 * 1_000),
      null,
    );
    assert.equal(
      pendingThoughtPathAcquisitionMatches(pending, {
        account: pending.account,
        chainId: pending.chainId,
        auction: "0x9999999999999999999999999999999999999999",
        pathNft: pending.pathNft,
        workHash: pending.workHash,
      }),
      false,
    );
  }

  {
    assert.deepEqual(
      await withThoughtPathAcquisitionLock(null, async () => "unused"),
      { acquired: false, reason: "unsupported" },
    );
    assert.deepEqual(
      await withThoughtPathAcquisitionLock(
        {
          request: async (_name, _options, callback) => callback(null),
        },
        async () => "unused",
      ),
      { acquired: false, reason: "busy" },
    );
  }
};

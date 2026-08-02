import assert from "node:assert/strict";
import {
  advanceThoughtPathAcquisitionLocalBlock,
  formatThoughtPathAcquisitionFailure,
  parsePendingThoughtPathAcquisition,
  pendingThoughtPathAcquisitionMatches,
  serializePendingThoughtPathAcquisition,
  thoughtPathAcquisitionGasLimit,
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
      await withThoughtPathAcquisitionLock(null, async () => "fallback"),
      { acquired: true, value: "fallback" },
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

    let releaseFallback: (() => void) | undefined;
    let markFallbackStarted: (() => void) | undefined;
    const fallbackStarted = new Promise<void>((resolve) => {
      markFallbackStarted = resolve;
    });
    const fallbackRelease = new Promise<void>((resolve) => {
      releaseFallback = resolve;
    });
    const activeFallback = withThoughtPathAcquisitionLock(null, async () => {
      markFallbackStarted?.();
      await fallbackRelease;
      return "first";
    });
    await fallbackStarted;
    assert.deepEqual(
      await withThoughtPathAcquisitionLock(null, async () => "second"),
      { acquired: false, reason: "busy" },
    );
    releaseFallback?.();
    assert.deepEqual(await activeFallback, { acquired: true, value: "first" });
  }

  {
    assert.equal(
      thoughtPathAcquisitionGasLimit(136_409n),
      200_512n,
      "PATH submission must retain a settlement gas margin above the RPC estimate",
    );
  }

  {
    const calls: Array<{ method: string; params: unknown[] }> = [];
    assert.equal(
      await advanceThoughtPathAcquisitionLocalBlock(
        {
          getBlockNumber: async () => 148,
          send: async (method, params) => {
            calls.push({ method, params });
            return "0x0";
          },
        },
        742n,
        true,
      ),
      true,
    );
    assert.deepEqual(calls, [{ method: "anvil_mine", params: ["0x253"] }]);
    const settledCalls: Array<{ method: string; params: unknown[] }> = [];
    assert.equal(
      await advanceThoughtPathAcquisitionLocalBlock(
        {
          getBlockNumber: async () => 743,
          send: async (method, params) => {
            settledCalls.push({ method, params });
            return "0x0";
          },
        },
        742n,
        true,
      ),
      false,
    );
    assert.deepEqual(settledCalls, []);
    assert.equal(
      await advanceThoughtPathAcquisitionLocalBlock(
        {
          getBlockNumber: async () => 148,
          send: async () => {
            throw new Error("method unavailable");
          },
        },
        742n,
        false,
      ),
      false,
      "public runtimes must not request a dev-only block",
    );
  }

  {
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        {
          shortMessage: "could not coalesce error",
          info: {
            error: {
              code: -32603,
              data: {
                originalError: {
                  message: "Insufficient funds for gas * price + value",
                },
              },
            },
          },
        },
        "local ETH",
      ),
      {
        title: "not enough funds",
        detail: "This wallet needs enough local ETH for the $PATH price and gas.",
        nextStep: "add local ETH, then try again",
      },
      "nested wallet failures must take precedence over ethers' generic wrapper",
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("could not coalesce error"),
        "local ETH",
      ),
      {
        title: "wallet is connected to the wrong local node",
        detail: "Set chain 31337 RPC to http://127.0.0.1:8546.",
        nextStep: "update the wallet network, then try again",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("execution reverted: ASK_ABOVE_MAX_PRICE"),
        "local ETH",
      ),
      {
        title: "$PATH price changed",
        detail: "The price changed before your wallet submitted the transaction.",
        nextStep: "try again with the refreshed price",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("execution reverted: ONE_BID_PER_BLOCK"),
        "local ETH",
      ),
      {
        title: "$PATH auction is settling",
        detail: "The previous bid is still in the latest block.",
        nextStep: "try again",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("out of gas: not enough gas for reentrancy sentry"),
        "local ETH",
      ),
      {
        title: "$PATH mint failed",
        detail: "The transaction did not have enough gas.",
        nextStep: "try again",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        { code: 4001, message: "User rejected the request" },
        "local ETH",
      ),
      {
        title: "$PATH mint canceled",
        detail: "No transaction was submitted. No $PATH was created.",
        nextStep: "select “Try again” when ready",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("transaction reverted on-chain"),
        "local ETH",
      ),
      {
        title: "$PATH mint failed",
        detail: "The transaction failed. No $PATH was created.",
        nextStep: "try again",
      },
    );
    assert.deepEqual(
      formatThoughtPathAcquisitionFailure(
        new Error("unrecognized provider failure: raw internals"),
        "local ETH",
      ),
      {
        title: "$PATH mint failed",
        detail: "The App could not complete the transaction.",
        nextStep: "try again, or open /path",
      },
      "unknown provider errors must not leak raw internals into guidance",
    );
  }
};

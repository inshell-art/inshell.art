import assert from "node:assert/strict";

import {
  THOUGHT_MINT_SUBMISSION_LOCK_NAME,
  createMintAttemptId,
  waitForMintSubmissionOrRelease,
  withMintSubmissionLock,
} from "./thought-mint-submission-lock";

const cryptoWithSequence = () => {
  let sequence = 0;
  return {
    randomUUID: () => {
      sequence += 1;
      return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
    },
    getRandomValues: <T extends ArrayBufferView | null>(value: T) => value,
  };
};

export const runThoughtMintSubmissionLockTests = async () => {
  const crypto = cryptoWithSequence();
  const fixedNow = 1_752_624_000_000;
  const firstId = createMintAttemptId("mint", crypto, fixedNow);
  const secondId = createMintAttemptId("mint", crypto, fixedNow);
  assert.notEqual(firstId, secondId, "fixed clocks still produce cross-tab unique IDs");
  assert.match(firstId, /^[A-Za-z0-9][A-Za-z0-9-]{0,95}$/);

  let requestedName = "";
  const webLockSuccess = await withMintSubmissionLock({
    crypto,
    locks: {
      request: async (name, options, callback) => {
        requestedName = name;
        assert.deepEqual(options, { mode: "exclusive", ifAvailable: true });
        return callback({ name });
      },
    },
  }, async (handle) => {
    assert.equal(handle.kind, "web-lock");
    assert.equal(handle.ownsExclusion(), true);
    return "safe";
  });
  assert.equal(requestedName, THOUGHT_MINT_SUBMISSION_LOCK_NAME);
  assert.deepEqual(webLockSuccess, { acquired: true, value: "safe" });

  let busyTaskCalled = false;
  const webLockBusy = await withMintSubmissionLock({
    crypto,
    locks: {
      request: async (_name, _options, callback) => callback(null),
    },
  }, async () => {
    busyTaskCalled = true;
    return "unsafe";
  });
  assert.deepEqual(webLockBusy, { acquired: false, reason: "busy" });
  assert.equal(busyTaskCalled, false, "a busy Web Lock never opens the wallet request");

  let unavailableTaskCalled = false;
  const legacyStorage = new Map<string, string>([[
    "thought-mint-submission-lease-v1",
    JSON.stringify({ ownerId: "legacy-tab" }),
  ]]);
  const noWebLocksEnvironment = {
    crypto,
    locks: null,
    // Deliberately present: legacy storage must never be used as an exclusion
    // fallback when Web Locks are unavailable.
    storage: legacyStorage,
  };
  const noWebLocks = await withMintSubmissionLock(noWebLocksEnvironment, async () => {
    unavailableTaskCalled = true;
    return "unsafe";
  });
  assert.deepEqual(noWebLocks, { acquired: false, reason: "unavailable" });
  assert.equal(unavailableTaskCalled, false, "no Web Locks means no wallet request");

  let rejectedTaskCalled = false;
  const rejectedWebLocks = await withMintSubmissionLock({
    crypto,
    locks: {
      request: async () => {
        throw new Error("Web Locks denied");
      },
    },
  }, async () => {
    rejectedTaskCalled = true;
    return "unsafe";
  });
  assert.deepEqual(rejectedWebLocks, { acquired: false, reason: "unavailable" });
  assert.equal(rejectedTaskCalled, false, "a rejected lock request fails closed");

  let releaseNeverSettling!: () => void;
  const neverSettling = new Promise<string>(() => {});
  const releaseNeverSettlingSignal = new Promise<void>((resolve) => {
    releaseNeverSettling = resolve;
  });
  const recoverableWait = waitForMintSubmissionOrRelease(
    neverSettling,
    releaseNeverSettlingSignal,
  );
  releaseNeverSettling();
  assert.deepEqual(
    await recoverableWait,
    { kind: "released" },
    "an explicitly recovered never-settling provider promise releases its exclusion waiter",
  );
};

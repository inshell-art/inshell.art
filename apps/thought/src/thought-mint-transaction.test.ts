import assert from "node:assert/strict";

import {
  classifyMintTrackingFailure,
  createMintSubmissionContext,
  createPendingMintTransaction,
  mintReceiptStatusOutcome,
  parseConflictingMintTransactions,
  parsePendingMintTransaction,
  parseMintTransactionReplacement,
  pendingMintTransactionMatches,
  planPendingMintRestore,
  replacePendingMintTransactionHash,
  serializeConflictingMintTransactions,
} from "./thought-mint-transaction";

const txHash = `0x${"AB".repeat(32)}`;
const secondTxHash = `0x${"12".repeat(32)}`;
const account = `0x${"AB".repeat(20)}`;
const thoughtNft = `0x${"CD".repeat(20)}`;
const workHash = `0x${"EF".repeat(32)}`;

const legacyPendingRaw = JSON.stringify({
  version: 1,
  attemptId: " legacy-attempt ",
  hash: txHash,
  account,
  chainId: 31337,
  thoughtNft,
  workHash,
  pathId: "2",
  submittedAt: 1_752_624_000_000,
});

export const runThoughtMintTransactionTests = () => {
  const parsedLegacy = parsePendingMintTransaction(legacyPendingRaw);
  assert(parsedLegacy, "a valid nonce-less v1 record must remain readable");
  assert.equal(parsedLegacy.nonce, undefined);
  assert.equal(parsedLegacy.attemptId, "legacy-attempt");
  assert.equal(parsedLegacy.hash, txHash.toLowerCase());
  assert.equal(parsedLegacy.account, account.toLowerCase());
  assert.equal(Object.isFrozen(parsedLegacy), true);

  const legacyMigration = planPendingMintRestore({
    currentRaw: null,
    legacySessionRaw: legacyPendingRaw,
  });
  assert.equal(legacyMigration.source, "legacy");
  assert.deepEqual(legacyMigration.transaction, parsedLegacy);
  assert.equal(legacyMigration.persistedRaw, JSON.stringify(parsedLegacy));
  assert.equal(legacyMigration.removeLegacy, true);

  const currentPendingRaw = JSON.stringify({
    ...JSON.parse(legacyPendingRaw),
    hash: secondTxHash,
    nonce: 9,
  });
  const currentWins = planPendingMintRestore({
    currentRaw: currentPendingRaw,
    legacySessionRaw: legacyPendingRaw,
  });
  assert.equal(currentWins.source, "current");
  assert.equal(currentWins.transaction?.hash, secondTxHash.toLowerCase());
  assert.equal(currentWins.transaction?.nonce, 9);
  assert.equal(currentWins.removeLegacy, true);

  const corruptCurrentFallback = planPendingMintRestore({
    currentRaw: "not json",
    legacySessionRaw: legacyPendingRaw,
  });
  assert.equal(corruptCurrentFallback.source, "legacy");
  assert.deepEqual(corruptCurrentFallback.transaction, parsedLegacy);

  const invalidCleanup = planPendingMintRestore({
    currentRaw: JSON.stringify({ version: 2 }),
    legacySessionRaw: "also not json",
  });
  assert.deepEqual(invalidCleanup, {
    transaction: null,
    source: null,
    persistedRaw: null,
    removeLegacy: true,
  });
  assert.equal(
    parsePendingMintTransaction(JSON.stringify({
      ...JSON.parse(legacyPendingRaw),
      nonce: -1,
    })),
    null,
    "a present v1 nonce must be a non-negative safe integer",
  );

  const mutableInput = {
    attemptId: " mint-attempt-7 ",
    account,
    chainId: 31337,
    thoughtNft,
    workHash,
    pathId: 2n,
    nonce: 17,
  };
  const submissionContext = createMintSubmissionContext(mutableInput);
  assert.equal(Object.isFrozen(submissionContext), true);
  assert.deepEqual(submissionContext, {
    attemptId: "mint-attempt-7",
    account: account.toLowerCase(),
    chainId: 31337,
    thoughtNft: thoughtNft.toLowerCase(),
    workHash: workHash.toLowerCase(),
    pathId: "2",
    nonce: 17,
  });

  mutableInput.attemptId = "different-attempt";
  mutableInput.account = `0x${"11".repeat(20)}`;
  mutableInput.chainId = 1;
  mutableInput.pathId = 99n;
  mutableInput.nonce = 18;
  const latePending = createPendingMintTransaction(
    submissionContext,
    txHash,
    1_752_624_000_123,
  );
  assert.equal(Object.isFrozen(latePending), true);
  assert.deepEqual(latePending, {
    version: 1,
    attemptId: "mint-attempt-7",
    hash: txHash.toLowerCase(),
    account: account.toLowerCase(),
    chainId: 31337,
    thoughtNft: thoughtNft.toLowerCase(),
    workHash: workHash.toLowerCase(),
    pathId: "2",
    nonce: 17,
    submittedAt: 1_752_624_000_123,
  });
  assert.equal(pendingMintTransactionMatches(latePending, txHash), true);
  assert.equal(pendingMintTransactionMatches(latePending, secondTxHash), false);
  const replacementPending = replacePendingMintTransactionHash(latePending, secondTxHash);
  assert.equal(replacementPending.hash, secondTxHash.toLowerCase());
  assert.equal(replacementPending.workHash, latePending.workHash);
  assert.equal(replacementPending.submittedAt, latePending.submittedAt);
  assert.equal(Object.isFrozen(replacementPending), true);
  const conflicts = parseConflictingMintTransactions(JSON.stringify([
    latePending,
    replacementPending,
    replacementPending,
    { version: 2 },
  ]));
  assert.deepEqual(conflicts, [latePending, replacementPending]);
  assert.equal(Object.isFrozen(conflicts), true);
  assert.deepEqual(
    parseConflictingMintTransactions(serializeConflictingMintTransactions(conflicts)),
    conflicts,
  );

  assert.equal(mintReceiptStatusOutcome(1), "success");
  assert.equal(mintReceiptStatusOutcome(1n), "success");
  assert.equal(mintReceiptStatusOutcome("0x1"), "success");
  assert.equal(mintReceiptStatusOutcome(0), "reverted");
  assert.equal(mintReceiptStatusOutcome("0x0"), "reverted");
  assert.equal(mintReceiptStatusOutcome(null), "unknown");
  assert.equal(mintReceiptStatusOutcome(2), "unknown");

  const repricedReplacement = parseMintTransactionReplacement({
    code: "TRANSACTION_REPLACED",
    reason: "repriced",
    cancelled: false,
    replacement: { hash: secondTxHash },
    receipt: { hash: secondTxHash, status: 1 },
  });
  assert.deepEqual(repricedReplacement, {
    cancelled: false,
    reason: "repriced",
    hash: secondTxHash.toLowerCase(),
    receipt: { hash: secondTxHash, status: 1 },
    replacement: { hash: secondTxHash },
  });

  const cancelledReplacement = {
    code: "TRANSACTION_REPLACED",
    reason: "cancelled",
    cancelled: true,
    replacement: { hash: secondTxHash },
    receipt: { hash: secondTxHash, status: 1 },
  };
  assert.equal(parseMintTransactionReplacement(cancelledReplacement)?.cancelled, true);
  assert.deepEqual(
    classifyMintTrackingFailure(cancelledReplacement, txHash),
    { category: "rejected", keepTracking: false },
    "an explicitly cancelled replacement is terminal even when its cancellation receipt succeeded",
  );

  assert.deepEqual(
    classifyMintTrackingFailure(
      { code: "TIMEOUT", info: { error: { message: "request timed out" } } },
      txHash,
    ),
    { category: "timeout", keepTracking: true },
  );
  assert.deepEqual(
    classifyMintTrackingFailure(new Error("wallet transaction not submitted."), txHash),
    { category: "timeout", keepTracking: true },
  );
  assert.deepEqual(
    classifyMintTrackingFailure(new Error("wallet transaction not submitted."), ""),
    { category: "timeout", keepTracking: false },
  );
  assert.deepEqual(
    classifyMintTrackingFailure(
      { cause: { code: "NETWORK_ERROR", message: "socket connection lost" } },
      txHash,
    ),
    { category: "transport", keepTracking: true },
  );
  assert.deepEqual(
    classifyMintTrackingFailure(new Error("transaction reverted."), txHash),
    { category: "reverted", keepTracking: false },
  );
  assert.deepEqual(
    classifyMintTrackingFailure({ code: 4001, message: "User rejected request" }, txHash),
    { category: "rejected", keepTracking: true },
    "a wallet-looking monitor error cannot erase a hash-backed transaction",
  );
  assert.deepEqual(
    classifyMintTrackingFailure(new Error("unexpected provider failure"), txHash),
    { category: "other", keepTracking: true },
    "unknown monitor failures retain a hash-backed transaction",
  );
  assert.deepEqual(
    classifyMintTrackingFailure(new Error("request timed out"), "0xdead"),
    { category: "timeout", keepTracking: false },
    "only a complete transaction hash may retain submitted tracking",
  );
};

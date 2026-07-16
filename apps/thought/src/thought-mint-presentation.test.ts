import assert from "node:assert/strict";

import {
  presentThoughtMint,
  type ThoughtMintFacts,
} from "./thought-mint-presentation";

const baseFacts = (): ThoughtMintFacts => ({
  state: "path_required",
  mintEnabled: true,
  providerDetected: true,
  walletRequestPending: false,
  address: "0x1111111111111111111111111111111111111111",
  chainId: 31337,
  requiredChainId: 31337,
  chainName: "Anvil Local",
  inventory: {
    status: "loaded",
    matchesWallet: true,
    held: 2,
    available: 2,
  },
  pathId: "",
  existingTokenId: null,
  authorization: {
    signed: false,
    deadline: null,
  },
  transaction: {
    state: "idle",
    hash: "",
  },
  error: {
    kind: "none",
    message: "",
  },
});

export const runThoughtMintPresentationTests = () => {
  const unavailable = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "unavailable",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
  });
  assert.equal(unavailable.title, "PATH inventory unavailable");
  assert.match(unavailable.detail, /does not mean the wallet is empty/i);
  assert.deepEqual(unavailable.actions.map((item) => item.label), ["Recheck PATHs", "Enter token ID"]);

  const empty = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "loaded",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
  });
  assert.equal(empty.title, "you need a PATH");
  assert.deepEqual(empty.actions.map((item) => item.label), ["Mint a PATH", "Recheck"]);

  const pathReady = presentThoughtMint({
    ...baseFacts(),
    state: "path_ready",
    pathId: "2",
  });
  assert.equal(pathReady.activeStep, "sign");
  assert.deepEqual(pathReady.completedSteps, ["path"]);
  assert.equal(pathReady.actions[0]?.label, "Sign PATH permission");
  assert.match(pathReady.stageCopy, /1 of 2.*no transaction.*no gas/i);

  const authorized = presentThoughtMint({
    ...baseFacts(),
    state: "authorized",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
  });
  assert.equal(authorized.activeStep, "mint");
  assert.deepEqual(authorized.completedSteps, ["path", "sign"]);
  assert.equal(authorized.actions[0]?.label, "Mint THOUGHT");
  assert.doesNotMatch(`${authorized.title} ${authorized.detail} ${authorized.stageCopy}`, /consume/i);

  const rejected = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "transaction rejected.",
    },
  });
  assert.equal(rejected.title, "mint not submitted");
  assert.match(rejected.detail, /permission is still valid/i);
  assert.equal(rejected.actions[0]?.label, "Try transaction again");

  const submitted = presentThoughtMint({
    ...baseFacts(),
    state: "minting",
    pathId: "2",
    address: "",
    chainId: null,
    transaction: {
      state: "submitted",
      hash: `0x${"ab".repeat(32)}`,
    },
  });
  assert.equal(submitted.title, "mint submitted");
  assert.equal(submitted.actions[0]?.label, "View transaction");

  const trackingDelayed = presentThoughtMint({
    ...baseFacts(),
    state: "minting",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    transaction: {
      state: "submitted",
      hash: `0x${"cd".repeat(32)}`,
    },
    error: {
      kind: "mint",
      message: "Automatic confirmation monitoring is unavailable. Hash retained; do not submit a duplicate.",
    },
  });
  assert.equal(trackingDelayed.title, "mint tracking delayed");
  assert.match(trackingDelayed.stageCopy, /hash retained.*do not submit a duplicate/i);
  assert.equal(trackingDelayed.actions[0]?.label, "View transaction");

  const unresolvedSubmission = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "The original wallet submission is unresolved; do not submit a duplicate.",
    },
  });
  assert.equal(unresolvedSubmission.title, "wallet response delayed");
  assert.equal(unresolvedSubmission.actions[0]?.id, "recover_submission");

  const recoveredSubmission = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "Recovery check complete: the old wallet waiter is detached.",
    },
  });
  assert.equal(recoveredSubmission.title, "wallet retry unlocked");
  assert.deepEqual(
    recoveredSubmission.actions.map((item) => item.id),
    ["confirm_mint", "recover_submission"],
  );

  const accountMismatch = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "wallet_account_mismatch",
      message: "PATH was minted to 0x1234…abcd; select that account in your wallet to continue.",
    },
  });
  assert.equal(accountMismatch.title, "switch wallet account");
  assert.match(accountMismatch.detail, /PATH was minted to/i);
  assert.deepEqual(accountMismatch.actions.map((item) => item.label), ["Recheck account", "Disconnect wallet"]);

  const disconnectedAccountMismatch = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    address: "",
    chainId: null,
    error: {
      kind: "wallet_account_mismatch",
      message: "PATH was minted to 0x1234…abcd; select that account in your wallet to continue.",
    },
  });
  assert.deepEqual(disconnectedAccountMismatch.actions.map((item) => item.label), ["Connect wallet"]);

  const pathMintPending = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "path_mint_pending",
      message: "PATH transaction 0x1234…abcd is still confirming.",
    },
  });
  assert.equal(pathMintPending.title, "PATH mint confirming");
  assert.equal(pathMintPending.actions[0]?.label, "Check confirmation");

  const pathMintChainMismatch = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "path_mint_chain_mismatch",
      message: "PATH was minted on chain 1; THOUGHT needs Anvil Local (31337).",
    },
  });
  assert.equal(pathMintChainMismatch.title, "PATH minted on another network");
  assert.equal(pathMintChainMismatch.actions[0]?.label, "Mint another PATH");

  for (const presentation of [
    unavailable,
    empty,
    pathReady,
    authorized,
    rejected,
    submitted,
    trackingDelayed,
    unresolvedSubmission,
    recoveredSubmission,
    accountMismatch,
    disconnectedAccountMismatch,
    pathMintPending,
    pathMintChainMismatch,
  ]) {
    assert.equal(
      presentation.actions.some((item) => item.label.toLowerCase() === "reset"),
      false,
      "the canonical mint panel must not expose a generic reset action",
    );
  }
};

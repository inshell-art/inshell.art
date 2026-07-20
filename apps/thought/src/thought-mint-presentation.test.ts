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
  pathAcquisition: {
    state: "idle",
    completed: false,
    priceLabel: "0.1 local ETH",
    txHash: "",
    error: "",
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
  assert.equal(unavailable.title, "$PATH inventory unavailable");
  assert.match(unavailable.detail, /does not mean the wallet is empty/i);
  assert.equal(unavailable.consoleNextStep, "refresh wallet from the shell bar");
  assert.deepEqual(unavailable.actions.map((item) => item.label), ["Enter token ID"]);

  const empty = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "loaded",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
  });
  assert.equal(empty.title, "you need a $PATH");
  assert.equal(empty.consoleNextStep, "mint here, or explore $PATH at /path");
  assert.equal(empty.tone, "running");
  assert.deepEqual(empty.actions.map((item) => item.id), ["none"]);

  const pathQuote = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "loaded",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
    pathAcquisition: {
      state: "review",
      completed: false,
      priceLabel: "0.1 local ETH",
      txHash: "",
      error: "",
    },
  });
  assert.equal(pathQuote.title, "you need a $PATH");
  assert.match(pathQuote.detail, /0\.1 local ETH/);
  assert.match(pathQuote.stageCopy, /1 of 3.*transaction.*gas applies/i);
  assert.equal(pathQuote.consoleNextStep, "mint here, or explore $PATH at /path");
  assert.deepEqual(pathQuote.actions.map((item) => item.id), ["confirm_path_mint"]);
  assert.equal(pathQuote.actions[0]?.label, "Mint $PATH for 0.1 local ETH");

  const pathSubmitted = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "loaded",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
    pathAcquisition: {
      state: "submitted",
      completed: false,
      priceLabel: "0.1 local ETH",
      txHash: `0x${"aa".repeat(32)}`,
      error: "",
    },
  });
  assert.equal(pathSubmitted.title, "$PATH mint submitted");
  assert.equal(pathSubmitted.actions[0]?.id, "view_path_tx");

  const pickPath = presentThoughtMint(baseFacts());
  assert.equal(pickPath.title, "pick a $PATH");
  assert.equal(pickPath.stageCopy, "The picked $PATH becomes part of this THOUGHT’s provenance.");
  assert.equal(pickPath.consoleNextStep, undefined);
  assert.equal(pickPath.actions[0]?.label, "Pick $PATH");

  const pickAnotherPath = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    error: {
      kind: "path_consumed",
      message: "$PATH has no THOUGHT mint available.",
    },
  });
  assert.equal(pickAnotherPath.stageCopy, "Pick another $PATH, or refresh wallet from the shell bar.");
  assert.equal(pickAnotherPath.consoleNextStep, "pick another $PATH, or refresh wallet from the shell bar");
  assert.equal(pickAnotherPath.actions[0]?.label, "Pick another $PATH");

  const pathReady = presentThoughtMint({
    ...baseFacts(),
    state: "path_ready",
    pathId: "2",
  });
  assert.equal(pathReady.activeStep, "sign");
  assert.deepEqual(pathReady.completedSteps, ["path"]);
  assert.equal(pathReady.title, "sign $PATH #2");
  assert.equal(pathReady.actions[0]?.label, "Sign $PATH #2");
  assert.equal(pathReady.actions[1]?.label, "Pick another $PATH");
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
  assert.equal(authorized.title, "$PATH #2 signed");
  assert.deepEqual(authorized.completedSteps, ["path", "sign"]);
  assert.equal(authorized.actions[0]?.label, "Mint THOUGHT");
  assert.equal(authorized.actions[1]?.label, "Pick another $PATH");
  assert.doesNotMatch(`${authorized.title} ${authorized.detail} ${authorized.stageCopy}`, /consume/i);

  const textTaken = presentThoughtMint({
    ...baseFacts(),
    state: "text_taken",
    existingTokenId: 7,
  });
  assert.equal(textTaken.title, "THOUGHT already exists");
  assert.match(textTaken.detail, /exact text is already on-chain/i);
  assert.match(textTaken.detail, /each THOUGHT can be minted only once/i);
  assert.match(textTaken.detail, /your \$PATH was not used/i);
  assert.equal(textTaken.stageCopy, "THOUGHT #7 is already on-chain.");
  assert.equal(textTaken.consoleNextStep, "reset and create a new THOUGHT");

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

  const failedOnchain = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    transaction: {
      state: "failed",
      hash: `0x${"ef".repeat(32)}`,
    },
    error: {
      kind: "mint",
      message: "transaction reverted.",
    },
  });
  assert.equal(
    failedOnchain.consoleNextStep,
    "view the transaction, then refresh wallet from the shell bar",
  );

  const genericMintError = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "thought",
      message: "mint contract unavailable.",
    },
  });
  assert.equal(genericMintError.consoleNextStep, "refresh wallet from the shell bar");

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
      message: "$PATH was minted to 0x1234…abcd; select that account in your wallet to continue.",
    },
  });
  assert.equal(accountMismatch.title, "switch wallet account");
  assert.match(accountMismatch.detail, /\$PATH was minted to/i);
  assert.equal(
    accountMismatch.consoleNextStep,
    "switch to the $PATH owner account, then refresh wallet from the shell bar",
  );
  assert.deepEqual(accountMismatch.actions.map((item) => item.label), ["Disconnect wallet"]);

  const disconnectedAccountMismatch = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    address: "",
    chainId: null,
    error: {
      kind: "wallet_account_mismatch",
      message: "$PATH was minted to 0x1234…abcd; select that account in your wallet to continue.",
    },
  });
  assert.deepEqual(disconnectedAccountMismatch.actions.map((item) => item.label), ["Connect wallet"]);

  const pathMintPending = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "path_mint_pending",
      message: "$PATH transaction 0x1234…abcd is still confirming.",
    },
  });
  assert.equal(pathMintPending.title, "$PATH mint confirming");
  assert.equal(pathMintPending.consoleNextStep, "refresh wallet from the shell bar");
  assert.equal(pathMintPending.actions[0]?.id, "none");

  const pathMintChainMismatch = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "path_mint_chain_mismatch",
      message: "$PATH was minted on chain 1; THOUGHT needs Anvil Local (31337).",
    },
  });
  assert.equal(pathMintChainMismatch.title, "$PATH minted on another network");
  assert.equal(
    pathMintChainMismatch.consoleNextStep,
    "mint another $PATH, then refresh wallet from the shell bar",
  );
  assert.equal(pathMintChainMismatch.actions[0]?.label, "Mint another $PATH");

  for (const presentation of [
    unavailable,
    empty,
    pathQuote,
    pathSubmitted,
    pickPath,
    pickAnotherPath,
    pathReady,
    authorized,
    textTaken,
    rejected,
    failedOnchain,
    genericMintError,
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
    assert.equal(
      presentation.actions.map((item) => String(item.id)).includes("refresh"),
      false,
      "wallet refresh must remain in the shell bar",
    );
  }
};

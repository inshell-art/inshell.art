import assert from "node:assert/strict";

import {
  presentThoughtMint,
  type ThoughtMintFacts,
} from "./thought-mint-presentation";

const baseFacts = (): ThoughtMintFacts => ({
  state: "path_required",
  mintEnabled: true,
  work: {
    ready: true,
    blockedTitle: "",
    reason: "",
  },
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
  const staleWork = presentThoughtMint({
    ...baseFacts(),
    state: "closed",
    work: {
      ready: false,
      blockedTitle: "work needs rerun",
      reason: "Agent result release mismatch.",
    },
  });
  assert.equal(staleWork.title, "run this work again");
  assert.equal(staleWork.detail, "This work is no longer ready to mint.");
  assert.equal(staleWork.stageCopy, "Select “reset”, then send the prompt to your Agent again.");
  assert.equal(staleWork.consoleNextStep, "reset and send the prompt to your Agent again");
  assert.equal(staleWork.tone, "warning");
  assert.deepEqual(staleWork.actions, []);

  const currentWork = presentThoughtMint({
    ...baseFacts(),
    state: "closed",
  });
  assert.equal(currentWork.title, "work ready");
  assert.equal(currentWork.detail, "Select “mint” above to start minting this THOUGHT work.");
  assert.equal(currentWork.stageCopy, "1 THOUGHT requires 1 available $PATH.");

  const connectWallet = presentThoughtMint({
    ...baseFacts(),
    state: "wallet_required",
    address: "",
    chainId: null,
  });
  assert.equal(connectWallet.title, "connect wallet");
  assert.equal(
    connectWallet.detail,
    "Select “Connect wallet” above to use that wallet for this THOUGHT mint.",
  );
  assert.equal(connectWallet.stageCopy, "Connection only · no signature · no transaction");

  const unavailable = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "unavailable",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
  });
  assert.equal(unavailable.title, "$PATH list unavailable");
  assert.equal(
    unavailable.detail,
    "The App could not load this wallet’s $PATH tokens. Your wallet may still hold them.",
  );
  assert.equal(unavailable.stageCopy, "Open the wallet menu and select “refresh”.");
  assert.equal(unavailable.consoleNextStep, "open the wallet menu and select refresh");
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
  assert.equal(
    pathQuote.detail,
    "Select “Mint $PATH for 0.1 local ETH” above to mint the $PATH required for this THOUGHT work.",
  );
  assert.equal(
    pathQuote.stageCopy,
    "Your wallet will ask you to confirm a transaction. Gas applies.",
  );
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

  const pathInventoryPending = presentThoughtMint({
    ...baseFacts(),
    inventory: {
      status: "loaded",
      matchesWallet: true,
      held: 0,
      available: 0,
    },
    pathAcquisition: {
      state: "inventory_pending",
      completed: true,
      priceLabel: "0.1 local ETH",
      txHash: `0x${"bb".repeat(32)}`,
      error: "The transaction confirmed, but the new $PATH is not visible yet.",
    },
  });
  assert.equal(pathInventoryPending.title, "$PATH minted; wallet updating");
  assert.equal(
    pathInventoryPending.detail,
    "The transaction is confirmed, but the new $PATH is not listed yet.",
  );
  assert.equal(
    pathInventoryPending.stageCopy,
    "Do not mint another. Open the wallet menu and select “refresh”.",
  );
  assert.equal(pathInventoryPending.consoleNextStep, "open the wallet menu and select refresh");
  assert.deepEqual(pathInventoryPending.actions.map((item) => item.id), ["none"]);

  const pickPath = presentThoughtMint(baseFacts());
  assert.equal(pickPath.title, "pick a $PATH");
  assert.equal(pickPath.stageCopy, "Pick a $PATH above for this THOUGHT work.");
  assert.equal(pickPath.consoleNextStep, undefined);
  assert.equal(pickPath.actions[0]?.label, "Pick $PATH");

  const pickedPath = presentThoughtMint({
    ...baseFacts(),
    pathId: "2",
  });
  assert.equal(pickedPath.stageCopy, "Select “Use $PATH #2” above for this THOUGHT work.");
  assert.equal(pickedPath.actions[0]?.label, "Use $PATH #2");

  const pickAnotherPath = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    error: {
      kind: "path_consumed",
      message: "$PATH has no THOUGHT mint available.",
    },
  });
  assert.equal(
    pickAnotherPath.stageCopy,
    "Select “Pick another $PATH”, or open the wallet menu and select “refresh”.",
  );
  assert.equal(
    pickAnotherPath.consoleNextStep,
    "pick another $PATH, or open the wallet menu and select refresh",
  );
  assert.equal(pickAnotherPath.actions[0]?.label, "Pick another $PATH");

  const pathReady = presentThoughtMint({
    ...baseFacts(),
    state: "path_ready",
    pathId: "2",
  });
  assert.equal(pathReady.activeStep, "sign");
  assert.deepEqual(pathReady.completedSteps, ["path"]);
  assert.equal(pathReady.title, "sign $PATH #2");
  assert.equal(
    pathReady.detail,
    "Select “Sign $PATH #2” above, then approve the signature in your wallet.",
  );
  assert.equal(pathReady.stageCopy, "Signature only · no transaction · no gas");
  assert.equal(pathReady.actions[0]?.label, "Sign $PATH #2");
  assert.equal(pathReady.actions[1]?.label, "Pick another $PATH");

  const authorizing = presentThoughtMint({
    ...baseFacts(),
    state: "authorizing",
    pathId: "2",
  });
  assert.equal(authorizing.title, "sign $PATH #2 in wallet");
  assert.equal(authorizing.detail, "Open your wallet and approve the signature.");
  assert.equal(authorizing.stageCopy, "Signature only · no transaction · no gas");

  const rejectedSignature = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    error: {
      kind: "signature",
      message: "signature rejected in wallet.",
    },
  });
  assert.equal(rejectedSignature.title, "$PATH not signed");
  assert.equal(
    rejectedSignature.detail,
    "Nothing changed. Select “Try again”, or pick another $PATH.",
  );
  assert.equal(rejectedSignature.tone, "warning");
  assert.equal(
    rejectedSignature.consoleNextStep,
    "select “Try again”, or pick another $PATH",
  );
  assert.deepEqual(
    rejectedSignature.actions.map((item) => item.label),
    ["Try again", "Pick another $PATH"],
  );

  const authorized = presentThoughtMint({
    ...baseFacts(),
    state: "authorized",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: null,
    },
  });
  assert.equal(authorized.activeStep, "mint");
  assert.equal(authorized.title, "$PATH #2 signed");
  assert.equal(
    authorized.detail,
    "Select “Mint THOUGHT” above to submit this THOUGHT work to the network.",
  );
  assert.equal(authorized.stageCopy, "Next wallet request · transaction · gas applies");
  assert.deepEqual(authorized.completedSteps, ["path", "sign"]);
  assert.equal(authorized.actions[0]?.label, "Mint THOUGHT");
  assert.equal(authorized.actions[1]?.label, "Pick another $PATH");
  assert.doesNotMatch(`${authorized.title} ${authorized.detail} ${authorized.stageCopy}`, /consume/i);

  const confirmMint = presentThoughtMint({
    ...baseFacts(),
    state: "minting",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: null,
    },
    transaction: {
      state: "awaiting_signature",
      hash: "",
    },
  });
  assert.equal(confirmMint.title, "confirm THOUGHT mint in wallet");
  assert.equal(confirmMint.detail, "Open your wallet and confirm the transaction.");
  assert.equal(confirmMint.stageCopy, "Transaction not submitted yet · gas applies");

  const textTaken = presentThoughtMint({
    ...baseFacts(),
    state: "text_taken",
    existingTokenId: 7,
  });
  assert.equal(textTaken.title, "THOUGHT already exists");
  assert.match(textTaken.detail, /exact prompt \+ Agent response pair is already on-chain/i);
  assert.match(textTaken.detail, /ordered pair can be minted only once/i);
  assert.match(textTaken.detail, /your \$PATH was not used/i);
  assert.equal(textTaken.stageCopy, "THOUGHT #7 is already on-chain.");
  assert.equal(
    textTaken.consoleNextStep,
    "view the existing THOUGHT, or reset and create a new one",
  );

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
  assert.equal(rejected.detail, "Nothing was sent. Your $PATH signature is still valid.");
  assert.equal(rejected.tone, "warning");
  assert.equal(
    rejected.consoleNextStep,
    "select “Try again”, or pick another $PATH",
  );
  assert.equal(rejected.actions[0]?.label, "Try again");

  const canceledAfterSubmission = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    transaction: {
      state: "failed",
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
    error: {
      kind: "mint",
      message: "transaction canceled.",
    },
  });
  assert.equal(canceledAfterSubmission.title, "mint canceled");
  assert.equal(
    canceledAfterSubmission.detail,
    "The submitted mint was canceled. No THOUGHT was created.",
  );
  assert.match(canceledAfterSubmission.stageCopy, /transaction canceled$/);
  assert.equal(canceledAfterSubmission.actions[0]?.label, "Try again");

  const missingAgentRun = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "App attestation requires a returned Agent run held by this dev backend.",
    },
  });
  assert.equal(missingAgentRun.title, "run this work again");
  assert.equal(
    missingAgentRun.detail,
    "This work is no longer ready to mint. Nothing was submitted.",
  );
  assert.equal(
    missingAgentRun.consoleNextStep,
    "reset and send the prompt to your Agent again",
  );
  assert.equal(
    missingAgentRun.stageCopy,
    "Select “reset”, then send the prompt to your Agent again.",
  );
  assert.deepEqual(missingAgentRun.actions, [{ id: "none", label: "" }]);

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
  assert.equal(failedOnchain.detail, "The transaction failed. No THOUGHT was created.");
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
  assert.equal(
    genericMintError.consoleNextStep,
    "select “Try again”",
  );
  assert.deepEqual(genericMintError.actions, [{ id: "continue", label: "Try again" }]);

  const localDeploymentUnavailable = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    error: {
      kind: "local_deployment",
      message: "local THOUGHT V2 deployment unavailable.",
    },
  });
  assert.equal(localDeploymentUnavailable.title, "local mint unavailable");
  assert.equal(
    localDeploymentUnavailable.detail,
    "Local Anvil is not serving the THOUGHT contracts configured for this App. Nothing was submitted.",
  );
  assert.equal(
    localDeploymentUnavailable.consoleNextStep,
    "start or restore the local dev chain, then select “Try again”",
  );
  assert.deepEqual(localDeploymentUnavailable.actions, [
    { id: "continue", label: "Try again" },
  ]);

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
  assert.equal(
    trackingDelayed.stageCopy,
    "View the transaction to check its status. Do not submit another mint.",
  );
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

  const walletReturnedWithoutHash = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "wallet returned but the transaction was not submitted.",
    },
  });
  assert.equal(walletReturnedWithoutHash.title, "mint not submitted");
  assert.equal(
    walletReturnedWithoutHash.detail,
    "The wallet closed without returning a transaction hash. Check wallet activity before trying again.",
  );
  assert.equal(walletReturnedWithoutHash.stageCopy, "No transaction hash received");
  assert.equal(
    walletReturnedWithoutHash.consoleNextStep,
    "select “Check wallet activity” before retrying",
  );
  assert.deepEqual(
    walletReturnedWithoutHash.actions.map((item) => [item.id, item.label]),
    [["recover_submission", "Check wallet activity"]],
  );

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
  assert.equal(recoveredSubmission.title, "ready to retry");
  assert.equal(
    recoveredSubmission.detail,
    "The previous wallet request was not submitted. Confirm that your wallet has no open request, then retry.",
  );
  assert.deepEqual(
    recoveredSubmission.actions.map((item) => item.id),
    ["confirm_mint", "choose_another"],
  );
  assert.deepEqual(
    recoveredSubmission.actions.map((item) => item.label),
    ["Try again", "Pick another $PATH"],
  );

  const walletRequestOpen = presentThoughtMint({
    ...baseFacts(),
    state: "error",
    pathId: "2",
    authorization: {
      signed: true,
      deadline: 4_102_444_800n,
    },
    error: {
      kind: "mint",
      message: "A previous transaction is still being signed or submitted.",
    },
  });
  assert.equal(walletRequestOpen.title, "wallet request already open");
  assert.equal(
    walletRequestOpen.detail,
    "Finish or cancel the previous transaction request in your wallet. This mint was not submitted.",
  );
  assert.equal(walletRequestOpen.stageCopy, "Resolve the open wallet request first");
  assert.deepEqual(
    walletRequestOpen.actions.map((item) => [item.id, item.label]),
    [["confirm_wallet_request_closed", "I closed it"]],
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
  assert.equal(accountMismatch.detail, "This $PATH belongs to another wallet account.");
  assert.equal(
    accountMismatch.consoleNextStep,
    "switch to the $PATH owner account, then open the wallet menu and select refresh",
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
  assert.equal(
    pathMintPending.consoleNextStep,
    "wait for confirmation, then open the wallet menu and select refresh",
  );
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
    "switch to Anvil Local, then mint another $PATH",
  );
  assert.equal(pathMintChainMismatch.actions[0]?.label, "Mint another $PATH");

  for (const presentation of [
    staleWork,
    currentWork,
    connectWallet,
    unavailable,
    empty,
    pathQuote,
    pathSubmitted,
    pathInventoryPending,
    pickPath,
    pickedPath,
    pickAnotherPath,
    pathReady,
    authorizing,
    rejectedSignature,
    authorized,
    confirmMint,
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

  const forbiddenPreMintJargon =
    /\b(?:provenance|attestation|manifest|nonce|release mismatch|run context|spec anchor|Agent evidence|App session)\b/i;
  for (const presentation of [
    staleWork,
    currentWork,
    connectWallet,
    unavailable,
    pathQuote,
    pathInventoryPending,
    pickPath,
    pickedPath,
    pickAnotherPath,
    pathReady,
    authorizing,
    authorized,
    confirmMint,
    missingAgentRun,
    genericMintError,
    trackingDelayed,
    recoveredSubmission,
  ]) {
    const visibleCopy = [
      presentation.title,
      presentation.detail,
      presentation.stageCopy,
      presentation.consoleNextStep ?? "",
    ].join(" ");
    assert.doesNotMatch(
      visibleCopy,
      forbiddenPreMintJargon,
      `pre-mint presentation leaked internal jargon: ${visibleCopy}`,
    );
  }
};

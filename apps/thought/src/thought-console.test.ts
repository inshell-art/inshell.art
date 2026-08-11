import assert from "node:assert/strict";

import {
  THOUGHT_CONSOLE_EMPTY_DETAIL,
  THOUGHT_CONSOLE_EMPTY_TITLE,
  THOUGHT_PATH_REQUIRED_DETAIL,
  THOUGHT_PATH_SELECTION_DETAIL,
  THOUGHT_PATH_LINK_LABEL,
  appendThoughtConsoleContextBoundary,
  appendThoughtConsoleEvent,
  buildThoughtConsoleLines,
  createThoughtConsoleHistory,
  newestFirstThoughtConsoleEntries,
  pendingMintWalletChangeTitle,
  parseThoughtConsoleHistory,
  serializeThoughtConsoleHistory,
  thoughtConsolePathLinkParts,
  thoughtConsoleVisualRole,
  type ThoughtConsoleContext,
} from "./thought-console";

const baseContext: ThoughtConsoleContext = {
  attemptId: "attempt-1",
  workHash: "0xwork",
  account: "0x581800000000000000000000000000000000E100",
  chainId: 31337,
  deploymentFingerprint: "anvil-v2",
};

export const runThoughtConsoleTests = () => {
  assert.deepEqual(
    [THOUGHT_CONSOLE_EMPTY_TITLE, THOUGHT_CONSOLE_EMPTY_DETAIL],
    [
      "start with a prompt",
      "Write one line above, then send it to your Agent.",
    ],
    "an empty Console must give one concise first action",
  );
  assert.deepEqual(
    buildThoughtConsoleLines({
      time: "08:15:30",
      title: THOUGHT_CONSOLE_EMPTY_TITLE,
      detail: THOUGHT_CONSOLE_EMPTY_DETAIL,
    }),
    [
      "[08:15:30] start with a prompt",
      "Write one line above, then send it to your Agent.",
    ],
    "first-visit help must use the normal timestamped Console message format",
  );
  assert.deepEqual(
    thoughtConsolePathLinkParts(
      { kind: "mint_requirement" },
      THOUGHT_PATH_SELECTION_DETAIL,
    ),
    {
      leadingText: "Choose an available $PATH above, or ",
      label: THOUGHT_PATH_LINK_LABEL,
    },
    "available-PATH guidance must expose a quiet PATH link without punctuation",
  );
  assert.deepEqual(
    thoughtConsolePathLinkParts(
      { kind: "mint_requirement" },
      THOUGHT_PATH_REQUIRED_DETAIL,
    ),
    {
      leadingText: "No available $PATH can mint this THOUGHT; ",
      label: THOUGHT_PATH_LINK_LABEL,
    },
    "missing-PATH guidance must expose the same quiet PATH link",
  );
  assert.deepEqual(
    thoughtConsolePathLinkParts(
      { kind: "mint_requirement" },
      "Minting 1 THOUGHT uses 1 available $PATH. Pick one, or mint a new $PATH here.",
    ),
    {
      leadingText:
        "Minting 1 THOUGHT uses 1 available $PATH. Pick one, or ",
      label: THOUGHT_PATH_LINK_LABEL,
    },
    "restored legacy guidance must receive the same clean PATH link",
  );
  assert.equal(
    thoughtConsolePathLinkParts(
      { kind: "paths_found" },
      THOUGHT_PATH_SELECTION_DETAIL,
    ),
    null,
    "unrelated console entries must remain plain text",
  );

  assert.deepEqual(
    buildThoughtConsoleLines({
      time: "20:43:12",
      title: "\"哦\" can't be used",
      detail:
        "The \"哦\" at character 1 isn't supported in THOUGHT text. Allowed: [space] A-Z a-z 0-9",
    }),
    [
      "[20:43:12] \"哦\" can't be used",
      "The \"哦\" at character 1 isn't supported in THOUGHT text.",
      "Allowed: [space] A-Z a-z 0-9",
    ],
    "guidance detail sections must render as separate console lines",
  );

  const empty = createThoughtConsoleHistory();
  const pathFound = appendThoughtConsoleEvent(empty, {
    eventId: "inventory:7",
    kind: "paths_found",
    time: "19:47:13",
    title: "$PATH tokens found",
    detail: "4 held · 2 available",
    context: baseContext,
  });
  assert.equal(pathFound.entries.length, 1);
  assert.equal(pathFound.entries[0]?.context.account, baseContext.account?.toLowerCase());

  const samePathFound = appendThoughtConsoleEvent(pathFound, {
    eventId: "inventory:7",
    kind: "paths_found",
    time: "19:47:14",
    title: "$PATH tokens found",
    detail: "4 held · 2 available",
    context: baseContext,
  });
  assert.equal(
    samePathFound,
    pathFound,
    "a stable event id must make repeated async/render delivery idempotent",
  );
  const samePathFoundAfterHydration = appendThoughtConsoleEvent(pathFound, {
    eventId: "inventory:7",
    kind: "paths_found",
    time: "19:47:15",
    title: "$PATH tokens found",
    detail: "4 held · 2 available",
    context: {
      ...baseContext,
      account: "0x170A00000000000000000000000000000000E100",
    },
  });
  assert.equal(
    samePathFoundAfterHydration,
    pathFound,
    "an event id remains idempotent when wallet hydration changes only its metadata",
  );

  const transient = appendThoughtConsoleEvent(pathFound, {
    kind: "checking_paths",
    time: "19:47:15",
    title: "checking $PATH",
    context: baseContext,
    transient: true,
  });
  assert.equal(
    transient,
    pathFound,
    "short-lived progress belongs in the control panel rather than retained history",
  );

  const permissionRequested = appendThoughtConsoleEvent(pathFound, {
    eventId: "permission:request:1",
    kind: "permission_requested",
    time: "19:47:25",
    title: "permission requested",
    detail: "wallet request 1 of 2 · no gas",
    context: baseContext,
  });
  const walletChangedContext: ThoughtConsoleContext = {
    ...baseContext,
    attemptId: "attempt-2",
    account: "0x170A00000000000000000000000000000000E100",
  };
  const noPath = appendThoughtConsoleEvent(permissionRequested, {
    eventId: "inventory:8",
    kind: "no_usable_path",
    time: "20:01:10",
    title: "no usable $PATH",
    detail: "this wallet has no available THOUGHT mints",
    nextStep: "mint a $PATH, then refresh wallet from the shell bar",
    context: walletChangedContext,
    tone: "warning",
  });

  assert.equal(noPath.entries.length, 3);
  assert.deepEqual(
    noPath.entries.map(({ kind }) => kind),
    [
      "paths_found",
      "permission_requested",
      "no_usable_path",
    ],
    "context metadata must not manufacture a wallet action",
  );
  assert.equal(noPath.entries.at(-1)?.boundary, false);
  assert.equal(noPath.entries.at(-1)?.context.attemptId, "attempt-2");
  assert.equal(
    noPath.entries.at(-1)?.context.account,
    walletChangedContext.account?.toLowerCase(),
  );
  assert.equal(
    noPath.entries.at(-1)?.nextStep,
    "mint a $PATH, then refresh wallet from the shell bar",
  );

  const explicitResetContext: ThoughtConsoleContext = {
    ...walletChangedContext,
    attemptId: "idle-3",
    workHash: undefined,
  };
  const resetBoundary = appendThoughtConsoleContextBoundary(noPath, {
    time: "20:01:30",
    context: explicitResetContext,
    kind: "mint_reset",
    title: "mint reset",
    detail: "previous attempt kept in history",
  });
  assert.equal(resetBoundary.entries.at(-1)?.kind, "mint_reset");
  assert.equal(resetBoundary.entries.at(-1)?.boundary, true);
  assert.equal(resetBoundary.entries.at(-1)?.context.attemptId, "idle-3");

  const differentNetworkContext: ThoughtConsoleContext = {
    ...walletChangedContext,
    attemptId: "attempt-3",
    chainId: 1,
  };
  const networkReady = appendThoughtConsoleEvent(noPath, {
    eventId: "network:1",
    kind: "network_ready",
    time: "20:02:00",
    title: "network ready",
    detail: "Ethereum",
    context: differentNetworkContext,
  });
  assert.equal(networkReady.entries.length, noPath.entries.length + 1);
  assert.equal(networkReady.entries.at(-1)?.kind, "network_ready");
  assert.equal(networkReady.entries.at(-1)?.boundary, false);

  const inferredNetworkBoundary = appendThoughtConsoleContextBoundary(networkReady, {
    time: "20:02:05",
    context: walletChangedContext,
  });
  assert.equal(
    inferredNetworkBoundary,
    networkReady,
    "a context delta without an explicit semantic event must stay metadata-only",
  );

  const unsignedRepeat = appendThoughtConsoleEvent(networkReady, {
    kind: "wallet_prompt_closed",
    time: "20:02:10",
    title: "$PATH not signed",
    detail: "nothing changed",
    context: differentNetworkContext,
  });
  const adjacentRepeat = appendThoughtConsoleEvent(unsignedRepeat, {
    kind: "wallet_prompt_closed",
    time: "20:02:11",
    title: "$PATH not signed",
    detail: "nothing changed",
    context: differentNetworkContext,
  });
  assert.equal(
    adjacentRepeat,
    unsignedRepeat,
    "identical adjacent events without an explicit id must collapse",
  );
  const interveningEvent = appendThoughtConsoleEvent(unsignedRepeat, {
    kind: "permission_requested",
    time: "20:02:12",
    title: "permission requested",
    context: differentNetworkContext,
  });
  const legitimateRetry = appendThoughtConsoleEvent(interveningEvent, {
    kind: "wallet_prompt_closed",
    time: "20:02:13",
    title: "$PATH not signed",
    detail: "nothing changed",
    context: differentNetworkContext,
  });
  assert.equal(
    legitimateRetry.entries.length,
    interveningEvent.entries.length + 1,
    "the same outcome after another semantic event is a legitimate retry",
  );

  const neutralWithAction = appendThoughtConsoleEvent(legitimateRetry, {
    eventId: "quote:live",
    kind: "quote_ready",
    time: "20:02:14",
    title: "quote ready",
    detail: "0.01 local ETH",
    nextStep: "mint here",
    context: differentNetworkContext,
  });
  assert.equal(
    neutralWithAction.entries.at(-1)?.nextStep,
    undefined,
    "neutral history must not mirror a live CTA as a next step",
  );

  const warningWithRecovery = appendThoughtConsoleEvent(neutralWithAction, {
    eventId: "quote:failed",
    kind: "quote_failed",
    time: "20:02:15",
    title: "quote unavailable",
    nextStep: "try again",
    tone: "warning",
    context: differentNetworkContext,
  });
  assert.equal(
    warningWithRecovery.entries.at(-1)?.nextStep,
    "try again",
    "warnings must retain one recovery step",
  );

  const transactionHash = `0x${"AB".repeat(32)}`;
  const transactionConfirmed = appendThoughtConsoleEvent(
    warningWithRecovery,
    {
      eventId: "minted:6",
      kind: "transaction_confirmed",
      time: "20:02:16",
      title: "THOUGHT #6 minted",
      detail: "transaction 0xABABABABAB...ABABABAB",
      transactionHash,
      context: differentNetworkContext,
      tone: "success",
    },
  );
  assert.equal(
    transactionConfirmed.entries.at(-1)?.transactionHash,
    transactionHash.toLowerCase(),
    "confirmed transactions must retain their exact full hash for explorer links",
  );
  assert.deepEqual(
    parseThoughtConsoleHistory(
      serializeThoughtConsoleHistory(transactionConfirmed),
    ),
    transactionConfirmed,
    "confirmed transaction hashes must survive console-history restoration",
  );

  const malformedTransaction = appendThoughtConsoleEvent(
    warningWithRecovery,
    {
      eventId: "minted:malformed",
      kind: "transaction_confirmed",
      time: "20:02:16",
      title: "THOUGHT minted",
      transactionHash: "0xnot-a-transaction",
      context: differentNetworkContext,
      tone: "success",
    },
  );
  assert.equal(
    malformedTransaction.entries.at(-1)?.transactionHash,
    undefined,
    "malformed transaction hashes must never become explorer links",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "work_ready", tone: "success" }),
    "guidance",
    "a successful work handoff must highlight the next action without becoming a warning",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "transaction_requested", tone: "neutral" }),
    "guidance",
    "a wallet action gate must be visually prominent",
  );
  for (const kind of [
    "work_agent_selection_ready",
    "work_claim_authorization_needed",
    "work_ready",
    "path_selected",
    "authorization_requested",
    "authorization_signed",
    "transaction_requested",
    "transaction_confirmed",
    "wallet_connection_requested",
    "path_acquisition_wallet",
  ]) {
    assert.equal(
      thoughtConsoleVisualRole({ kind, tone: "success" }),
      "guidance",
      `${kind} must highlight the current or next user action`,
    );
  }
  assert.equal(
    thoughtConsoleVisualRole({ kind: "work_preview_rejected", tone: "warning" }),
    "guidance",
    "warnings with a recovery path must be visually prominent",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "work_failed", tone: "error" }),
    "guidance",
    "errors with a recovery path must be visually prominent",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "work_previewing", tone: "neutral" }),
    "standard",
    "automatic processing must stay muted",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "work_agent_returned", tone: "success" }),
    "standard",
    "an intermediate successful process must stay muted",
  );
  assert.equal(
    thoughtConsoleVisualRole({ kind: "transaction_submitted", tone: "neutral" }),
    "standard",
    "submitted transactions that are already tracking must stay muted",
  );

  const orderedConsoleEntries = newestFirstThoughtConsoleEntries([
    {
      id: "older-guidance",
      dedupeKey: "older-guidance",
      kind: "work_ready",
      time: "20:02:14",
      title: "work ready",
      context: differentNetworkContext,
      tone: "success",
      boundary: false,
    },
    {
      id: "submitted",
      dedupeKey: "submitted",
      kind: "transaction_submitted",
      time: "20:02:15",
      title: "$PATH mint submitted",
      context: differentNetworkContext,
      tone: "neutral",
      boundary: false,
    },
    {
      id: "minted",
      dedupeKey: "minted",
      kind: "path_acquisition_confirmed",
      time: "20:02:15",
      title: "$PATH #2 minted",
      context: differentNetworkContext,
      tone: "success",
      boundary: false,
    },
    {
      id: "ready",
      dedupeKey: "ready",
      kind: "path_selected",
      time: "20:02:15",
      title: "$PATH #2 ready",
      context: differentNetworkContext,
      tone: "neutral",
      boundary: false,
    },
    {
      id: "second-guidance",
      dedupeKey: "second-guidance",
      kind: "transaction_requested",
      time: "20:02:15",
      title: "confirm THOUGHT mint in wallet",
      context: differentNetworkContext,
      tone: "neutral",
      boundary: false,
    },
  ]);
  assert.deepEqual(
    orderedConsoleEntries.map((entry) => entry.id),
    ["second-guidance", "ready", "minted", "submitted", "older-guidance"],
    "the newest second must render first, with its latest guidance promoted above process entries",
  );

  const sameSecondMintProgress = newestFirstThoughtConsoleEntries([
    {
      id: "picked",
      dedupeKey: "picked",
      kind: "path_selected",
      time: "20:02:16",
      title: "$PATH #2 picked",
      context: differentNetworkContext,
      tone: "neutral",
      boundary: false,
    },
    {
      id: "sign-requested",
      dedupeKey: "sign-requested",
      kind: "authorization_requested",
      time: "20:02:16",
      title: "sign $PATH #2 in wallet",
      context: differentNetworkContext,
      tone: "neutral",
      boundary: false,
    },
    {
      id: "signed",
      dedupeKey: "signed",
      kind: "authorization_signed",
      time: "20:02:16",
      title: "$PATH #2 signed",
      context: differentNetworkContext,
      tone: "success",
      boundary: false,
    },
  ]);
  assert.deepEqual(
    sameSecondMintProgress.map((entry) => entry.id),
    ["signed", "sign-requested", "picked"],
    "the console must show the latest mint guidance when PICK and SIGN finish in one second",
  );

  const newAttemptContext: ThoughtConsoleContext = {
    ...differentNetworkContext,
    attemptId: "attempt-4",
  };
  const attemptOnlyBoundary = appendThoughtConsoleContextBoundary(
    warningWithRecovery,
    {
      time: "20:02:16",
      context: newAttemptContext,
    },
  );
  assert.equal(
    attemptOnlyBoundary,
    warningWithRecovery,
    "an internal attempt id change must not create a visible history entry",
  );

  const restored = parseThoughtConsoleHistory(
    serializeThoughtConsoleHistory(warningWithRecovery),
  );
  assert.deepEqual(restored, warningWithRecovery, "session history must round-trip");

  const legacyLiveEntry = {
    ...warningWithRecovery.entries.at(-1)!,
    id: "thought-console-legacy-quote",
    dedupeKey: "legacy-quote",
    kind: "path_acquisition_quote",
    title: "$PATH quote ready",
    detail: "0.01 local ETH",
    nextStep: "mint here",
    tone: "neutral" as const,
  };
  const passiveBoundaryKinds = [
    "wallet_connected",
    "wallet_disconnected",
    "wallet_changed",
    "network_changed",
    "work_changed",
    "deployment_changed",
  ];
  const passiveBoundaries = passiveBoundaryKinds.map((kind, index) => ({
    ...warningWithRecovery.entries.at(-1)!,
    id: `thought-console-legacy-boundary-${index}`,
    dedupeKey: `legacy-boundary-${index}`,
    kind,
    title: kind.replaceAll("_", " "),
    boundary: true,
  }));
  const restoredWithEveryPriorMessage = parseThoughtConsoleHistory(
    JSON.stringify({
      version: 1,
      entries: [
        ...warningWithRecovery.entries,
        legacyLiveEntry,
        ...passiveBoundaries,
      ],
    }),
  );
  assert.equal(
    restoredWithEveryPriorMessage.entries.length,
    warningWithRecovery.entries.length + 1 + passiveBoundaries.length,
    "restoring history must preserve every valid prior Console message",
  );
  assert.deepEqual(
    restoredWithEveryPriorMessage.entries
      .slice(-(1 + passiveBoundaries.length))
      .map((entry) => entry.kind),
    [legacyLiveEntry.kind, ...passiveBoundaryKinds],
  );

  const terminalOutcome = {
    ...warningWithRecovery.entries.at(-1)!,
    id: "thought-console-existing-latest",
    dedupeKey: "legacy-existing-latest",
    kind: "thought_exists",
    time: "20:03:00",
    title: "THOUGHT already exists",
    detail: "This exact work is already on-chain.",
  };
  const restoredTerminalOutcome = parseThoughtConsoleHistory(
    JSON.stringify({
      version: 1,
      entries: [
        {
          ...terminalOutcome,
          id: "thought-console-existing-old",
          dedupeKey: "legacy-existing-old",
          time: "20:02:30",
        },
        terminalOutcome,
      ],
    }),
  );
  assert.deepEqual(
    restoredTerminalOutcome.entries.map((entry) => entry.time),
    ["20:02:30", "20:03:00"],
    "history restore must not collapse earlier terminal messages",
  );
  assert.equal(
    restoredTerminalOutcome.entries[1]?.nextStep,
    "view the existing THOUGHT, or reset and create a new one",
    "history restore updates the terminal guide to match the live View and reset actions",
  );

  assert.equal(
    pendingMintWalletChangeTitle({
      previousAddress: "",
      previousChainId: null,
      nextAddress: baseContext.account ?? "",
      nextChainId: 31337,
      trackedAddress: baseContext.account ?? "",
      trackedChainId: 31337,
    }),
    null,
    "restoring the tracked mint wallet is hydration, not a wallet action",
  );
  assert.equal(
    pendingMintWalletChangeTitle({
      previousAddress: baseContext.account ?? "",
      previousChainId: 31337,
      nextAddress: "",
      nextChainId: null,
      trackedAddress: baseContext.account ?? "",
      trackedChainId: 31337,
    }),
    "active wallet disconnected",
  );
  assert.equal(
    pendingMintWalletChangeTitle({
      previousAddress: baseContext.account ?? "",
      previousChainId: 31337,
      nextAddress: walletChangedContext.account ?? "",
      nextChainId: 31337,
      trackedAddress: baseContext.account ?? "",
      trackedChainId: 31337,
    }),
    "active wallet changed",
  );
  assert.equal(
    pendingMintWalletChangeTitle({
      previousAddress: baseContext.account ?? "",
      previousChainId: 31337,
      nextAddress: baseContext.account ?? "",
      nextChainId: 1,
      trackedAddress: baseContext.account ?? "",
      trackedChainId: 31337,
    }),
    "wallet network changed",
  );
  assert.equal(
    pendingMintWalletChangeTitle({
      previousAddress: "",
      previousChainId: null,
      nextAddress: baseContext.account ?? "",
      nextChainId: 1,
      trackedAddress: baseContext.account ?? "",
      trackedChainId: 31337,
    }),
    "wallet network changed",
    "first hydration must still report a tracked-mint network mismatch",
  );

  const legacyNeutralAction = {
    ...warningWithRecovery.entries.at(-1)!,
    id: "thought-console-legacy-neutral-action",
    dedupeKey: "legacy-neutral-action",
    kind: "work_saved",
    title: "work saved",
    detail: "Stored in this browser.",
    nextStep: "open the load panel",
    tone: "success" as const,
  };
  const restoredNeutralAction = parseThoughtConsoleHistory(
    JSON.stringify({ version: 1, entries: [legacyNeutralAction] }),
  );
  assert.equal(
    restoredNeutralAction.entries[0]?.nextStep,
    undefined,
    "restoring history must remove CTA mirrors from neutral and success entries",
  );

  assert.deepEqual(
    parseThoughtConsoleHistory("not json"),
    createThoughtConsoleHistory(),
    "corrupt retained history must fail closed",
  );
  let appendOnlyHistory = createThoughtConsoleHistory();
  for (let index = 0; index < 100; index += 1) {
    appendOnlyHistory = appendThoughtConsoleEvent(appendOnlyHistory, {
      eventId: `append-only:${index}`,
      kind: "append_only_check",
      time: `21:00:${String(index % 60).padStart(2, "0")}`,
      title: `message ${index}`,
      context: baseContext,
    });
  }
  assert.equal(
    appendOnlyHistory.entries.length,
    100,
    "Console history must not discard older messages after an internal limit",
  );
  assert.equal(
    parseThoughtConsoleHistory(serializeThoughtConsoleHistory(appendOnlyHistory)).entries.length,
    100,
    "restoring history must preserve every retained message",
  );
};

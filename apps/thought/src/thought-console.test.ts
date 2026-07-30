import assert from "node:assert/strict";

import {
  appendThoughtConsoleContextBoundary,
  appendThoughtConsoleEvent,
  createThoughtConsoleHistory,
  parseThoughtConsoleHistory,
  serializeThoughtConsoleHistory,
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
  const empty = createThoughtConsoleHistory();
  const pathFound = appendThoughtConsoleEvent(empty, {
    eventId: "inventory:7",
    kind: "paths_found",
    time: "19:47:13",
    title: "PATHs found",
    detail: "4 held · 2 available",
    context: baseContext,
  });
  assert.equal(pathFound.entries.length, 1);
  assert.equal(pathFound.entries[0]?.context.account, baseContext.account?.toLowerCase());

  const samePathFound = appendThoughtConsoleEvent(pathFound, {
    eventId: "inventory:7",
    kind: "paths_found",
    time: "19:47:14",
    title: "PATHs found",
    detail: "4 held · 2 available",
    context: baseContext,
  });
  assert.equal(
    samePathFound,
    pathFound,
    "a stable event id must make repeated async/render delivery idempotent",
  );

  const transient = appendThoughtConsoleEvent(pathFound, {
    kind: "checking_paths",
    time: "19:47:15",
    title: "checking PATHs",
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

  assert.equal(noPath.entries.length, 4);
  assert.deepEqual(
    noPath.entries.map(({ kind }) => kind),
    [
      "paths_found",
      "permission_requested",
      "wallet_changed",
      "no_usable_path",
    ],
    "a context change must retain prior events and insert an explicit boundary",
  );
  const walletBoundary = noPath.entries[2];
  assert.equal(walletBoundary?.boundary, true);
  assert.match(walletBoundary?.detail ?? "", /0x5818…e100 → 0x170a…e100/i);
  assert.match(walletBoundary?.detail ?? "", /permission cleared/i);
  assert.equal(walletBoundary?.context.attemptId, "attempt-2");
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
  assert.equal(networkReady.entries.at(-2)?.kind, "network_changed");
  assert.equal(networkReady.entries.at(-2)?.boundary, true);

  const switchedBack = appendThoughtConsoleContextBoundary(networkReady, {
    time: "20:02:05",
    context: walletChangedContext,
  });
  const switchedAgain = appendThoughtConsoleContextBoundary(switchedBack, {
    time: "20:02:06",
    context: differentNetworkContext,
  });
  assert.equal(
    switchedAgain.entries.length,
    networkReady.entries.length + 2,
    "returning to a prior context must create a fresh semantic boundary",
  );

  const unsignedRepeat = appendThoughtConsoleEvent(switchedAgain, {
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

  const restored = parseThoughtConsoleHistory(
    serializeThoughtConsoleHistory(legitimateRetry),
  );
  assert.deepEqual(restored, legitimateRetry, "session history must round-trip");
  assert.deepEqual(
    parseThoughtConsoleHistory("not json"),
    createThoughtConsoleHistory(),
    "corrupt retained history must fail closed",
  );
  assert.equal(
    parseThoughtConsoleHistory(serializeThoughtConsoleHistory(legitimateRetry), {
      limit: 2,
    }).entries.length,
    2,
    "restored history must honor its retention limit",
  );
};

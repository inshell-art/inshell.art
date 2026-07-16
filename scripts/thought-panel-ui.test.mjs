import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../apps/thought/index.html", import.meta.url), "utf8");
const thoughtCss = await readFile(new URL("../apps/thought/src/style.css", import.meta.url), "utf8");
const thoughtMain = await readFile(new URL("../apps/thought/src/main.ts", import.meta.url), "utf8");

const ruleBody = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = thoughtCss.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
};

test("mint panel presents wallet context before controls", () => {
  const promptIndex = indexHtml.indexOf('id="thought-dock"');
  const walletIndex = indexHtml.indexOf('id="thought-wallet-strip"');
  const actionIndex = indexHtml.indexOf('id="thought-dock-action-area"');
  const pathIndex = indexHtml.indexOf('id="thought-dock-path"');

  assert.ok(promptIndex >= 0, "prompt composer is present");
  assert.ok(walletIndex > promptIndex, "wallet context follows the work prompt");
  assert.ok(actionIndex > walletIndex, "wallet context precedes current actions");
  assert.ok(pathIndex > walletIndex, "wallet context precedes the mint stage");
  assert.match(indexHtml, /id="thought-wallet-strip"[\s\S]*?aria-label="Mint wallet context"/);
});

test("dock and compatibility sheet share the PATH SIGN MINT spine", () => {
  const expectedSteps = /<ol[^>]+aria-label="THOUGHT mint progress"[^>]*>\s*<li data-step="select">PATH<\/li>\s*<li data-step="authorize">SIGN<\/li>\s*<li data-step="confirm">MINT<\/li>\s*<\/ol>/g;
  assert.equal([...indexHtml.matchAll(expectedSteps)].length, 2);

  const dockFlowIndex = indexHtml.indexOf('id="thought-dock-path-flow"');
  const inventoryIndex = indexHtml.indexOf('id="thought-dock-path-inventory"');
  const sheetFlowIndex = indexHtml.indexOf('id="mint-sheet-flow"');
  const sheetFieldIndex = indexHtml.indexOf('id="mint-sheet-path-field"');

  assert.ok(dockFlowIndex < inventoryIndex, "dock progress precedes its active PATH stage");
  assert.ok(sheetFlowIndex < sheetFieldIndex, "sheet progress precedes its active PATH stage");
});

test("integrated mint stage has one atomic announcement and a stable region name", () => {
  assert.match(
    indexHtml,
    /id="thought-dock-path"[\s\S]*?aria-label="THOUGHT mint"/,
  );
  assert.match(
    indexHtml,
    /class="thought-mint-step" role="status" aria-live="polite" aria-atomic="true"/,
  );
  assert.doesNotMatch(
    indexHtml,
    /id="thought-dock-path-status"[^>]*aria-live/,
  );
  assert.doesNotMatch(
    indexHtml,
    /id="thought-dock-details"[^>]*aria-live/,
  );
});

test("SIGN and MINT review stays compact behind a native disclosure", () => {
  assert.match(
    indexHtml,
    /<details id="thought-dock-path-review"[^>]*>[\s\S]*?<summary id="thought-dock-path-review-summary">review wallet request<\/summary>/,
  );
  assert.match(thoughtMain, /const syncMintDockReview = \(\) =>/);
  assert.match(thoughtMain, /review signature request · 1 of 2/);
  assert.match(thoughtMain, /review mint transaction · 2 of 2/);
  assert.match(thoughtMain, /thoughtDockPathReview\.open = false/);
});

test("mint progress and active stage have compact component styling", () => {
  for (const selector of [".thought-dock-path-flow", ".mint-sheet-flow"]) {
    const body = ruleBody(selector);
    assert.match(body, /display:\s*grid/);
    assert.match(body, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(body, /gap:\s*var\(--thought-mint-progress-gap\)/);
  }

  const walletBody = ruleBody(".thought-wallet-strip");
  assert.match(walletBody, /border-block:\s*var\(--thought-mint-hairline-width\) solid var\(--panel-border\)/);

  const pathBody = ruleBody(".thought-dock-path");
  assert.match(pathBody, /border:\s*var\(--thought-mint-hairline-width\) solid var\(--panel-border\)/);
  assert.match(pathBody, /background:\s*var\(--panel-soft\)/);
});

test("PATH inventory is bounded and collapses after selection", () => {
  const pickerBody = ruleBody(".thought-dock-path-inventory-list");
  assert.match(pickerBody, /max-height:\s*var\(--thought-path-picker-max-height\)/);
  assert.match(pickerBody, /overflow-y:\s*auto/);
  assert.match(pickerBody, /overscroll-behavior:\s*contain/);

  const inventorySelectStart = thoughtMain.indexOf("const shouldUsePathInventorySelect");
  const inventorySelectEnd = thoughtMain.indexOf("const focusMintDockStage", inventorySelectStart);
  const inventorySelectBody = thoughtMain.slice(inventorySelectStart, inventorySelectEnd);
  assert.match(inventorySelectBody, /mintFlowState === "path_required"/);
  assert.match(inventorySelectBody, /mintFlowData\.pathId === null/);
  assert.doesNotMatch(inventorySelectBody, /mintFlowState === "path_ready"/);

  assert.match(
    thoughtMain,
    /availableItems\.length === 1[\s\S]*?!mintFlowData\.pathIdInput[\s\S]*?await checkPathEligibility\(\)/,
    "single available PATH remains auto-selected",
  );
});

test("panel controls expose visible focus and action hierarchy", () => {
  assert.match(indexHtml, /id="thought-dock-path-title"[^>]*tabindex="-1"/);
  assert.match(thoughtCss, /:focus-visible[\s\S]*?outline:\s*var\(--thought-focus-ring-width\) solid var\(--thought-focus-ring-color\)/);
  assert.match(thoughtMain, /const focusMintDockStage = \(preference:/);
  assert.match(thoughtMain, /const focusRestoredMintElement = \(element: HTMLElement\) =>/);
  assert.match(thoughtMain, /focusRestoredMintElement\(thoughtDockPathTitle\)/);
  assert.match(thoughtCss, /\.thought-panel \.thought-dock-path \.is-focus-restored/);

  const secondaryBody = ruleBody(".thought-dock-button--secondary");
  const tertiaryBody = ruleBody(".thought-dock-button--tertiary");
  assert.match(secondaryBody, /background:\s*transparent/);
  assert.match(secondaryBody, /color:\s*var\(--thought-panel-accent-text\)/);
  assert.match(tertiaryBody, /border-color:\s*transparent/);
  assert.match(tertiaryBody, /color:\s*var\(--muted\)/);
  assert.doesNotMatch(ruleBody(".thought-dock-button"), /text-transform/);
});

test("dark panel text uses dedicated accessible contrast tokens", () => {
  assert.match(thoughtCss, /--thought-panel-accent-text:\s*#00a000/);
  assert.match(thoughtCss, /--thought-panel-subtle-text:\s*#9ca3af/);
  assert.match(ruleBody(".thought-mint-step__title"), /var\(--thought-panel-accent-text\)/);
  assert.match(ruleBody(".thought-dock-path-flow"), /var\(--thought-panel-subtle-text\)/);
});

test("console rendering is read-only and mint attempts survive navigation", () => {
  const renderStart = thoughtMain.indexOf("const renderThoughtDockDetails");
  const renderEnd = thoughtMain.indexOf("const getResolvedThoughtDockState", renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart, "console render function is present");
  const renderBody = thoughtMain.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderBody, /emitThoughtConsoleEvent|recordMintConsoleState|appendThoughtConsoleEvent/);

  assert.match(thoughtMain, /createMintSubmissionContext\(\{[\s\S]*?attemptId:\s*mintAttemptId/);
  assert.match(thoughtMain, /pendingMintTransaction\s*=\s*createPendingMintTransaction\(submission, tx\.hash/);
  assert.match(thoughtMain, /mintAttemptId\s*=\s*pending\.attemptId\?\.trim\(\)\s*\|\|\s*retainedAttemptId/);
  assert.match(thoughtMain, /await mintThoughtDockWork\(\{[\s\S]*?attemptId:\s*mintAttemptId,[\s\S]*?pathId:\s*confirmedReturn\?\.tokenId/);
  assert.match(thoughtMain, /pathMintHandoffStorageKey\(handoff\.attemptId\)/);
  assert.match(thoughtMain, /work:\s*\{\s*output:\s*currentOutputText,[\s\S]*?workId:\s*currentWorkId/);
  assert.match(thoughtMain, /const confirmedReturn = returnRecord\?\.status === "confirmed"/);
  assert.match(thoughtMain, /PATH was minted to \$\{shortHex\(confirmedReturn\.account\)\}; select that account in your wallet to continue\./);
  const handoffReadStart = thoughtMain.indexOf("const readPathMintHandoff");
  const handoffReadEnd = thoughtMain.indexOf("const readStoredThoughtWorks", handoffReadStart);
  assert.ok(handoffReadStart >= 0 && handoffReadEnd > handoffReadStart, "handoff reader is present");
  assert.doesNotMatch(
    thoughtMain.slice(handoffReadStart, handoffReadEnd),
    /removePathMintHandoff/,
    "reading a valid handoff must not consume it",
  );
  assert.match(thoughtMain, /if \(resumeSucceeded\) \{[\s\S]*?removePathMintReturnRecord\([\s\S]*?removePathMintHandoff\(handoff\.attemptId\)/);
  assert.match(thoughtMain, /mintFlowUiMode === "sheet"[\s\S]*?closeMintSheet\(\)/);
});

test("mint submission and recovery keep one durable hash", () => {
  const authorizeStart = thoughtMain.indexOf("const authorizeMint = async");
  const authorizeEnd = thoughtMain.indexOf("type MintTransactionResponse", authorizeStart);
  const authorizeBody = thoughtMain.slice(authorizeStart, authorizeEnd);
  assert.ok(authorizeStart >= 0 && authorizeEnd > authorizeStart);
  assert.ok(
    authorizeBody.indexOf("mintAuthorizationInFlight = true") <
      authorizeBody.indexOf("await readPathEligibility"),
    "authorization locks synchronously before its first eligibility read",
  );

  const confirmStart = thoughtMain.indexOf("const confirmMint = async");
  const confirmEnd = thoughtMain.indexOf("const pathMintUrl", confirmStart);
  const confirmBody = thoughtMain.slice(confirmStart, confirmEnd);
  assert.ok(confirmStart >= 0 && confirmEnd > confirmStart);
  assert.match(confirmBody, /if \(mintTransactionInFlight\)/);
  assert.ok(
    confirmBody.indexOf("mintTransactionInFlight = true") <
      confirmBody.indexOf("await rebuildFinalMintProvenance"),
    "transaction submission locks synchronously before preparation awaits",
  );
  assert.match(confirmBody, /const payload = Object\.freeze\(\{/);
  assert.match(confirmBody, /ethereum\.request\(\{ method: "eth_accounts" \}\)[\s\S]*?ethereum\.request\(\{ method: "eth_chainId" \}\)/);
  assert.match(confirmBody, /const competingPending = pendingMintTransaction \?\? readPendingMintTransaction\(\);[\s\S]*?const txPromise/);
  assert.match(confirmBody, /await withMintSubmissionLock\([\s\S]*?lock\.ownsExclusion\(\)[\s\S]*?const txPromise/);
  assert.match(confirmBody, /walletMintSubmitPromiseUnresolved = true[\s\S]*?waitForMintSubmissionOrRelease\([\s\S]*?void txPromise\.then\([\s\S]*?walletMintSubmitPromiseUnresolved = false/);

  assert.match(thoughtMain, /const clearPendingMintTransactionIfMatches[\s\S]*?pendingMintTransactionMatches\(pendingMintTransaction, expectedHash\)/);
  assert.match(thoughtMain, /mintReceiptStatusOutcome\(result\.receipt\.status\)[\s\S]*?receiptOutcome !== "success"/);
  assert.match(thoughtMain, /parseMintTransactionReplacement\(error\)[\s\S]*?migratePendingMintTransactionHash/);
  assert.match(thoughtMain, /appendConflictingMintTransaction\(returnedTransaction\)[\s\S]*?startConflictingMintReceiptMonitor\(returnedTransaction/);
  assert.match(thoughtMain, /const recoverUnresolvedMintSubmission[\s\S]*?getTransactionCount\(unresolved\.submission\.account, "latest"\)[\s\S]*?getTransactionCount\(unresolved\.submission\.account, "pending"\)/);
  assert.match(thoughtMain, /firstNonceSnapshot[\s\S]*?MINT_RECOVERY_NONCE_RECHECK_MS[\s\S]*?secondNonceSnapshot[\s\S]*?releaseLockAfterRecovery\(\)/);
  assert.match(thoughtMain, /mintFlowData\.errorKind === "path_mint_chain_mismatch"[\s\S]*?mintAttemptId = nextMintAttemptId\("path"\)/);
  assert.match(thoughtMain, /window\.addEventListener\("storage"[\s\S]*?event\.newValue === null[\s\S]*?return/);
  assert.match(thoughtMain, /const resetThought = [\s\S]*?if \(blockPendingMintMutation\(\)\)/);
  assert.match(thoughtMain, /const setAgentOutput = [\s\S]*?if \(blockPendingMintMutation\(\)\)/);
});

test("submitted PATH return is promoted only by an explicit successful receipt", () => {
  const checkStart = thoughtMain.indexOf("const checkSubmittedPathMintReturn");
  const checkEnd = thoughtMain.indexOf("const resumePathMintHandoff", checkStart);
  const checkBody = thoughtMain.slice(checkStart, checkEnd);
  assert.ok(checkStart >= 0 && checkEnd > checkStart);
  assert.match(checkBody, /provider\.getTransactionReceipt\(record\.txHash\)/);
  assert.match(checkBody, /outcome === "reverted"[\s\S]*?removePathMintReturnRecord/);
  assert.match(checkBody, /outcome === "success"[\s\S]*?status: "confirmed"[\s\S]*?writePathMintReturnRecord/);
  assert.match(checkBody, /return \{ outcome: "pending" as const, record \}/);
  assert.match(thoughtMain, /let resumeSucceeded =[\s\S]*?mintFlowState === "path_ready"/);
});

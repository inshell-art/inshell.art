import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../apps/thought/index.html", import.meta.url), "utf8");
const thoughtCss = await readFile(new URL("../apps/thought/src/style.css", import.meta.url), "utf8");
const thoughtMain = await readFile(new URL("../apps/thought/src/main.ts", import.meta.url), "utf8");
const thoughtConsole = await readFile(
  new URL("../apps/thought/src/thought-console.ts", import.meta.url),
  "utf8",
);
const thoughtMintPresentation = await readFile(
  new URL("../apps/thought/src/thought-mint-presentation.ts", import.meta.url),
  "utf8",
);
const thoughtTextPolicy = await readFile(
  new URL("../apps/thought/src/thought-text-policy.ts", import.meta.url),
  "utf8",
);
const thoughtShell = await readFile(
  new URL("../apps/thought/src/thought-shell.tsx", import.meta.url),
  "utf8",
);
const inshellShell = await readFile(
  new URL("../packages/inshell-shell/src/index.tsx", import.meta.url),
  "utf8",
);

const ruleBody = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = thoughtCss.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
};

test("Work owns prompt and CTAs before sibling Mint and Save/Load panels", () => {
  const workIndex = indexHtml.indexOf('id="thought-dock"');
  const promptIndex = indexHtml.indexOf('id="thought-dock-prompt"');
  const actionIndex = indexHtml.indexOf('id="thought-dock-action-area"');
  const mintIndex = indexHtml.indexOf('id="thought-dock-path"');
  const worksIndex = indexHtml.indexOf('id="thought-dock-works"');
  const consoleIndex = indexHtml.indexOf('id="thought-dock-details"');

  assert.ok(workIndex >= 0, "Work panel is present");
  assert.ok(promptIndex > workIndex, "Work contains the prompt");
  assert.ok(actionIndex > promptIndex, "Work actions follow the prompt");
  assert.ok(mintIndex > actionIndex, "Mint follows Work");
  assert.ok(worksIndex > mintIndex, "Save/Load is a sibling after Mint");
  assert.ok(consoleIndex > worksIndex, "Console follows the control panels");
  assert.match(indexHtml, /id="thought-dock" class="thought-dock" aria-label="THOUGHT work"/);
  assert.match(indexHtml, /id="thought-dock-action-area"[\s\S]*?aria-label="THOUGHT work actions"/);
  assert.match(indexHtml, /id="thought-dock-path"\s+class="thought-dock-path thought-path-panel is-hidden"/);
  assert.match(indexHtml, /id="thought-dock-works"\s+class="thought-dock-works is-hidden"/);
  assert.match(indexHtml, /id="thought-dock-works-select"[\s\S]*?aria-labelledby="thought-dock-works-label"/);
  assert.match(indexHtml, /id="thought-dock-details"[\s\S]*?aria-label="THOUGHT console"/);
  assert.doesNotMatch(indexHtml, /thought-wallet-strip|Mint wallet context/);
  assert.doesNotMatch(thoughtCss, /\.thought-wallet-strip/);
  assert.doesNotMatch(thoughtMain, /thoughtWalletStrip|WalletStripView/);
});

test("desktop panel stack shares the canvas top and bottom edges", () => {
  assert.match(thoughtCss, /--thought-panel-row-alignment:\s*center/);
  assert.match(
    ruleBody(".thought-panel"),
    /align-self:\s*var\(--thought-panel-row-alignment\)/,
  );
  assert.match(
    thoughtCss,
    /@media \(max-width: 900px\)[\s\S]*?--thought-panel-row-alignment:\s*stretch/,
  );
});

test("Save/Load uses prompt-labelled one-line options and loads the selected canvas work", () => {
  assert.match(indexHtml, /aria-label="THOUGHT load a saved work"/);
  assert.match(thoughtMain, /thoughtDockWorksLabel\.textContent = "load a saved work"/);
  assert.match(thoughtMain, /placeholder\.textContent = works\.length \? "load a saved work" : "no saved works"/);
  assert.doesNotMatch(thoughtMain, /"select a saved work"/);
  assert.doesNotMatch(thoughtMain, /thoughtDockWorksLabel\.textContent = `saved works/);
  assert.match(
    thoughtMain,
    /kind: "work_library_opened",\s*title: "load a saved work",\s*detail: "Saved works use this browser's local storage\. They are not on-chain or synced across browsers or devices\."/,
  );
  assert.match(indexHtml, /id="thought-dock-works"[\s\S]*?class="thought-dock-select-wrap"[\s\S]*?class="thought-dock-select-arrow"/);
  const worksBody = ruleBody(".thought-dock-works");
  const selectBody = ruleBody(".thought-dock-select");
  const selectArrowBody = ruleBody(".thought-dock-select-arrow");
  const selectArrowGlyphBody = ruleBody(".thought-dock-select-arrow::before");
  assert.match(worksBody, /padding:\s*var\(--thought-panel-section-padding\)/);
  assert.match(worksBody, /border:\s*0/);
  assert.match(worksBody, /background:\s*var\(--panel\)/);
  assert.match(selectBody, /overflow:\s*hidden/);
  assert.match(selectBody, /text-overflow:\s*ellipsis/);
  assert.match(selectBody, /white-space:\s*nowrap/);
  assert.match(selectBody, /appearance:\s*none/);
  assert.match(selectArrowBody, /inset-inline-end:\s*var\(--thought-mint-hairline-width\)/);
  assert.match(selectArrowBody, /pointer-events:\s*none/);
  assert.match(selectArrowGlyphBody, /width:\s*calc\(var\(--font-size-12\) \/ 2\)/);
  assert.match(selectArrowGlyphBody, /height:\s*calc\(var\(--font-size-12\) \/ 2\)/);
  assert.match(thoughtMain, /option\.textContent = formatSavedWorkPromptLabel\(work\.prompt \|\| work\.runContext\.prompt\)/);
  assert.match(thoughtMain, /thoughtDockWorksSelect\.addEventListener\("change"[\s\S]*?loadWorkRecord\(work\)/);
  assert.match(thoughtMain, /const loadWorkRecord =[\s\S]*?syncCurrentWorkVisual\(\{ suppressWarning: true \}\)/);
  const saveStart = thoughtMain.indexOf("const saveCurrentWorkFromDock =");
  const saveEnd = thoughtMain.indexOf("const loadWorkRecord =", saveStart);
  const saveBody = thoughtMain.slice(saveStart, saveEnd);
  assert.doesNotMatch(saveBody, /workLibraryRevealed|mintDockRevealed/);
});

test("THOUGHT panel copy uses canonical product terms", () => {
  const productCopy = [indexHtml, thoughtMain, thoughtMintPresentation].join("\n");
  assert.doesNotMatch(productCopy, /load a work/);
  assert.doesNotMatch(productCopy, /\$PATHs/);
  assert.doesNotMatch(productCopy, /THOUGHT (?:mint )?unit/);
  assert.doesNotMatch(productCopy, /["'`][^"'`\n]*\bonchain\b[^"'`\n]*["'`]/);
  assert.match(productCopy, /load a saved work/);
  assert.match(productCopy, /THOUGHT mint available/);
  assert.match(productCopy, /on-chain/);
  assert.doesNotMatch(productCopy, /choose an agent\.|agent result schema invalid\.|agent request (?:timed out|failed)\./);
  assert.match(productCopy, /choose an Agent\.|Agent result schema invalid\.|Agent request (?:timed out|failed)\./);
  assert.doesNotMatch(productCopy, /agent output:/);
  assert.match(productCopy, /Agent output:/);
});

test("dock and compatibility sheet share the PICK SIGN MINT spine", () => {
  const expectedSteps = /<ol[^>]+aria-label="THOUGHT mint progress"[^>]*>\s*<li data-step="select">PICK<\/li>\s*<li data-step="authorize">SIGN<\/li>\s*<li data-step="confirm">MINT<\/li>\s*<\/ol>/g;
  assert.equal([...indexHtml.matchAll(expectedSteps)].length, 2);

  const dockFlowIndex = indexHtml.indexOf('id="thought-dock-path-flow"');
  const inventoryIndex = indexHtml.indexOf('id="thought-dock-path-inventory"');
  const sheetFlowIndex = indexHtml.indexOf('id="mint-sheet-flow"');
  const sheetFieldIndex = indexHtml.indexOf('id="mint-sheet-path-field"');

  assert.ok(dockFlowIndex < inventoryIndex, "dock progress precedes its active PATH stage");
  assert.ok(sheetFlowIndex < sheetFieldIndex, "sheet progress precedes its active PATH stage");
  assert.match(thoughtMintPresentation, /title: inventory\.available === 1 \? "one \$PATH is ready" : "pick a \$PATH"/);
  assert.match(thoughtMintPresentation, /stageCopy: "Pick another \$PATH, or refresh wallet from the shell bar\."/);
  assert.match(thoughtMain, /placeholder\.textContent = "pick a \$PATH"/);
  assert.match(thoughtMain, /return "pick another \$PATH or refresh wallet from the shell bar"/);
  assert.match(thoughtConsole, /\$PATH pick and permission cleared/);
  assert.doesNotMatch(thoughtMintPresentation, /(?<!\$)\bPATHs?\b/);
  assert.doesNotMatch(thoughtMain, /(?:select|choose) \$PATH \/ authorize \/ confirm\./i);
});

test("shell-bar refresh is the only manual wallet and $PATH inventory refresh control", () => {
  assert.doesNotMatch(thoughtMintPresentation, /action\("refresh"/);
  assert.doesNotMatch(thoughtMain, /mintSheetAction\("refresh"|action === "refresh"|refreshMintSheetPath/);
  assert.doesNotMatch(thoughtMintPresentation, /Recheck/i);
  assert.match(inshellShell, /await refreshWallet\(\);\s*await onRefresh\?\.\(\);/);
  assert.match(thoughtShell, /onWalletRefresh=\{onWalletRefresh\}/);
  assert.match(thoughtMain, /mountThoughtShell\(thoughtShellRoot, THOUGHT_CHAIN_ID, \(\) => refreshThoughtWalletFromShell\(\)\)/);
  assert.match(
    thoughtMain,
    /async function refreshThoughtWalletFromShell\(\)[\s\S]*?refreshPathInventoryForCurrentWallet\(\{ force: true \}\)/,
  );
});

test("Console preserves shell-refresh notices after mint-panel Recheck removal", () => {
  assert.match(
    thoughtMintPresentation,
    /consoleNextStep\?: string/,
  );
  assert.match(
    thoughtMintPresentation,
    /title: "\$PATH inventory unavailable"[\s\S]*?consoleNextStep: "refresh wallet from the shell bar"/,
  );
  assert.match(
    thoughtMintPresentation,
    /title: "\$PATH mint confirming"[\s\S]*?consoleNextStep: "refresh wallet from the shell bar"/,
  );
  assert.match(
    thoughtMain,
    /presentation\.consoleNextStep \|\| presentation\.tone === "warning"[\s\S]*?nextStep: presentationNextStep/,
  );
});

test("integrated mint stage has one atomic announcement and a stable region name", () => {
  assert.match(
    indexHtml,
    /id="thought-dock-path"[\s\S]*?aria-label="THOUGHT mint"/,
  );
  assert.match(
    indexHtml,
    /class="thought-mint-step is-hidden"\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"/,
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

test("Mint keeps stable status and actions while prose stays in Console", () => {
  assert.match(indexHtml, /id="thought-dock-path-title" class="thought-mint-step__title"/);
  assert.doesNotMatch(indexHtml, /thought-dock-path-detail|thought-dock-path-status|thought-dock-path-review|thought-dock-path-provenance/);
  assert.match(thoughtMain, /presentation\.tone === "running"[\s\S]*?appendThoughtProgressEllipsis\(thoughtDockPathTitle/);
  assert.doesNotMatch(thoughtMain, /thoughtDockPathDetail|syncMintDockReview|getMintDockPathStatusCopy/);
  assert.match(thoughtMain, /const base = \{[\s\S]*?detail: presentation\.detail/);
  assert.match(thoughtMain, /thoughtDockPathTitle\.dataset\.tone = presentation\.tone/);
  assert.match(
    thoughtCss,
    /\.thought-mint-step__title\[data-tone="warning"\][\s\S]*?color:\s*var\(--thought-panel-secondary-text\)/,
  );
  assert.match(
    ruleBody('.thought-mint-step__title[data-tone="error"]'),
    /color:\s*var\(--thought-panel-error-text\)/,
  );
});

test("THOUGHT mint requirement explains the $PATH permission model", () => {
  assert.match(
    thoughtMain,
    /1 THOUGHT requires 1 available \$PATH\. \$PATH is the permission token for Inshell’s three fully on-chain movements for Agent Art\./,
  );
});

test("mint progress and active stage have compact component styling", () => {
  for (const selector of [".thought-dock-path-flow", ".mint-sheet-flow"]) {
    const body = ruleBody(selector);
    assert.match(body, /display:\s*grid/);
    assert.match(body, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(body, /gap:\s*var\(--thought-mint-progress-gap\)/);
  }

  const workBody = ruleBody(".thought-dock");
  assert.match(workBody, /grid-template-areas:\s*"input"\s*"actions"/);
  assert.match(workBody, /row-gap:\s*var\(--thought-path-picker-gap\)/);
  assert.match(workBody, /padding:\s*var\(--thought-panel-section-padding\)/);
  assert.match(workBody, /background:\s*var\(--panel\)/);
  const pathBody = ruleBody(".thought-dock-path");
  assert.match(pathBody, /border:\s*0/);
  assert.match(pathBody, /background:\s*var\(--panel\)/);
  const groupBody = ruleBody(".thought-dock-control-area");
  assert.match(groupBody, /gap:\s*var\(--thought-panel-control-gap\)/);
  assert.match(groupBody, /padding:\s*0/);
  assert.match(groupBody, /background:\s*transparent/);
  assert.match(ruleBody(".thought-panel__body"), /gap:\s*var\(--thought-panel-console-gap\)/);
  assert.match(thoughtCss, /--thought-panel-control-gap:\s*10px/);
  assert.match(thoughtCss, /--thought-panel-console-gap:\s*22px/);
});

test("$PATH inventory select has no default and advances on selection", () => {
  const inventoryPickerStart = thoughtMain.indexOf("const shouldUsePathInventoryPicker");
  const inventoryPickerEnd = thoughtMain.indexOf("const focusMintDockStage", inventoryPickerStart);
  const inventoryPickerBody = thoughtMain.slice(inventoryPickerStart, inventoryPickerEnd);
  assert.match(inventoryPickerBody, /mintFlowState === "path_required"/);
  assert.doesNotMatch(inventoryPickerBody, /mintFlowState === "path_ready"/);

  assert.doesNotMatch(
    thoughtMain,
    /!mintFlowData\.pathIdInput && mintFlowState === "path_required"[\s\S]*?applyMintPathInputValue\(availableItems\[0\]\.pathId\.toString\(\)\)/,
    "inventory refresh must not preselect a $PATH",
  );
  assert.match(
    indexHtml,
    /id="thought-dock-path-inventory"[\s\S]*?class="thought-dock-select-wrap"[\s\S]*?id="thought-dock-path-inventory-select"[\s\S]*?class="thought-dock-select"[\s\S]*?class="thought-dock-select-arrow"/,
  );
  assert.match(thoughtMain, /placeholder\.textContent = "pick a \$PATH"/);
  assert.match(thoughtMain, /placeholder\.disabled = true/);
  assert.match(thoughtMain, /select\.value = available\.some\([\s\S]*?\? selectedValue\s*:\s*""/);
  assert.match(
    thoughtMain,
    /thoughtDockPathInventorySelect\.addEventListener\("change"[\s\S]*?handlePathInventorySelectChange\(thoughtDockPathInventorySelect\)/,
  );
  const selectItemStart = thoughtMain.indexOf("const selectPathInventoryItem =");
  const selectItemEnd = thoughtMain.indexOf("const isMintPathFieldVisible", selectItemStart);
  assert.match(
    thoughtMain.slice(selectItemStart, selectItemEnd),
    /void checkPathEligibility\(\)/,
    "selecting a $PATH immediately validates it and advances the flow",
  );
  assert.match(
    thoughtMain,
    /config\.action !== "enter_path_manually" && config\.action !== "continue"/,
    "the integrated picker has no redundant confirmation CTA",
  );
  assert.match(
    thoughtMain,
    /\(mintFlowState === "path_required" && pathInventoryVisible\) \|\|[\s\S]*?mintFlowState === "path_ready"[\s\S]*?thoughtDockMintStep\.classList\.toggle\("is-hidden", hideRedundantPathStatus\)/,
    "the redundant status row stays hidden for the $PATH picker and SIGN CTA",
  );
  assert.doesNotMatch(thoughtMain, /classList\.toggle\("is-hidden", presentation\.activeStep === "path"\)/);
  assert.doesNotMatch(indexHtml, /id="thought-dock-path-(?:field|box|options)"/);
  assert.doesNotMatch(thoughtMain, /thoughtDockPath(?:Field|Box|Options)/);
  assert.doesNotMatch(thoughtCss, /\.thought-dock-path-(?:field|input)/);
  for (const compatibilityId of [
    "mint-sheet-path-field",
    "mint-sheet-path-box",
    "mint-sheet-path-options",
    "mint-sheet-path-select",
  ]) {
    assert.match(indexHtml, new RegExp(`id="${compatibilityId}"`));
  }
  assert.match(
    thoughtMain,
    /getMintSheetActionConfigs\(\)[\s\S]*?config\.action !== "enter_path_manually" && config\.action !== "continue"/,
    "the integrated dock exposes neither manual input nor redundant confirmation",
  );
});

test("$PATH inventory uses a secondary white label and the shared select style", () => {
  assert.match(
    indexHtml,
    /id="thought-dock-path-inventory-label"\s+class="thought-dock-label thought-dock-label--secondary"/,
  );
  assert.match(thoughtCss, /--thought-panel-secondary-text:\s*#ffffff/);
  assert.match(
    ruleBody(".thought-dock-label--secondary"),
    /color:\s*var\(--thought-panel-secondary-text\)/,
  );
  assert.match(ruleBody(".thought-dock-select"), /border:\s*var\(--thought-mint-hairline-width\) solid var\(--accent\)/);
  assert.equal((indexHtml.match(/class="thought-dock-select"/g) ?? []).length, 2);
  assert.equal((indexHtml.match(/class="thought-dock-select-arrow"/g) ?? []).length, 2);
});

test("panel controls expose visible focus and action hierarchy", () => {
  assert.doesNotMatch(indexHtml, /id="thought-dock-path-title"[^>]*tabindex/);
  assert.match(thoughtCss, /--thought-focus-ring-width:\s*1px/);
  assert.match(thoughtCss, /--thought-focus-ring-offset:\s*1px/);
  assert.match(thoughtCss, /--thought-focus-ring-color:\s*var\(--thought-panel-interactive\)/);
  assert.match(thoughtCss, /:focus-visible[\s\S]*?outline:\s*var\(--thought-focus-ring-width\) solid var\(--thought-focus-ring-color\)/);
  assert.match(thoughtMain, /const focusMintDockStage = \(preference:/);
  assert.match(thoughtMain, /const focusRestoredMintElement = \(element: HTMLElement\) =>/);
  assert.doesNotMatch(thoughtMain, /focusRestoredMintElement\(thoughtDockPathTitle\)/);
  assert.match(thoughtMain, /focusRestoredMintElement\(thoughtDockPathInventorySelect\)/);
  assert.match(thoughtCss, /\.thought-panel \.thought-dock-path \.is-focus-restored/);

  const secondaryBody = ruleBody(".thought-dock-button--secondary");
  const tertiaryBody = ruleBody(".thought-dock-button--tertiary");
  assert.match(secondaryBody, /background:\s*transparent/);
  assert.match(secondaryBody, /color:\s*var\(--thought-panel-accent-text\)/);
  assert.match(tertiaryBody, /border-color:\s*var\(--accent-border\)/);
  assert.match(tertiaryBody, /color:\s*var\(--thought-panel-accent-text\)/);
  assert.doesNotMatch(ruleBody(".thought-dock-button"), /text-transform/);
});

test("Work uses monochrome interactive and disabled CTAs", () => {
  const renderStart = thoughtMain.indexOf("const renderThoughtDock = () =>");
  const renderEnd = thoughtMain.indexOf("const syncThoughtDock = () =>", renderStart);
  const renderBody = thoughtMain.slice(renderStart, renderEnd);
  const buttonStart = thoughtMain.indexOf("const thoughtDockButton = (");
  const buttonEnd = thoughtMain.indexOf("const assertDockRailView", buttonStart);
  const buttonBody = thoughtMain.slice(buttonStart, buttonEnd);

  assert.doesNotMatch(thoughtMain, /thoughtDockStatusChip|thought-dock-status-label/);
  assert.match(renderBody, /const railHidden = rail\.actions\.length === 0/);
  assert.doesNotMatch(renderBody, /rail\.status|rail\.tone|thought-dock-status/);
  assert.match(buttonBody, /button\.className = "thought-dock-button thought-work-cta"/);
  assert.doesNotMatch(buttonBody, /thought-work-cta--secondary/);
  assert.doesNotMatch(thoughtMain, /variant:\s*"secondary"/);
  assert.match(
    ruleBody(".thought-panel"),
    /--accent:\s*var\(--thought-panel-interactive\)/,
  );
  assert.match(
    ruleBody(".thought-panel"),
    /--accent-border:\s*var\(--thought-panel-interactive\)/,
  );
  assert.match(
    thoughtCss,
    /\.thought-dock-action-rail \.thought-work-cta,[\s\S]*?border-color:\s*var\(--accent\);[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--thought-panel-accent-text\)/,
  );
  assert.match(
    thoughtCss,
    /--thought-button-disabled-text:\s*var\(--thought-panel-subtle-text\)/,
  );
  const disabledBody = ruleBody(".thought-dock-action-rail .thought-work-cta:disabled");
  assert.match(disabledBody, /border-color:\s*var\(--thought-button-disabled-text\)/);
  assert.match(disabledBody, /background:\s*transparent/);
  assert.match(disabledBody, /color:\s*var\(--thought-button-disabled-text\)/);
  assert.match(disabledBody, /opacity:\s*1/);
  assert.match(buttonBody, /button\.setAttribute\("aria-expanded", String\(options\.expanded\)\)/);
  assert.doesNotMatch(thoughtCss, /\.thought-work-cta\[aria-expanded="true"\]/);
  assert.match(ruleBody(".thought-dock"), /row-gap:\s*var\(--thought-path-picker-gap\)/);
  assert.match(ruleBody(".thought-dock-action-rail"), /grid-auto-rows:\s*var\(--thought-dock-chip-height\)/);
});

test("Work prompt never renders the panel-wide focus frame", () => {
  assert.match(
    thoughtCss,
    /\.thought-dock-input:focus,\s*\.thought-panel \.thought-panel__body \.thought-dock-input:focus-visible\s*\{\s*outline:\s*none/,
  );
  assert.match(ruleBody(".thought-dock-input"), /border:\s*0/);
});

test("Work CTAs appear without an entrance animation", () => {
  assert.doesNotMatch(thoughtMain, /animateThoughtDockRailEntry|thought-dock-chip-enter-delay/);
  assert.doesNotMatch(thoughtCss, /thought-dock-chip-enter|@keyframes thought-dock-chip-enter/);
  assert.match(thoughtMain, /const shouldRenderRail = nextRailSignature !== thoughtDockRailSignature/);
});

test("Work lifecycle messages move into Console history", () => {
  const recordStart = thoughtMain.indexOf("const recordThoughtDockConsoleTransition =");
  const recordEnd = thoughtMain.indexOf("const thoughtDockRunFromStored", recordStart);
  const recordBody = thoughtMain.slice(recordStart, recordEnd);

  for (const state of [
    "agent_select",
    "creating_run",
    "opening_agent",
    "claim_authorization",
    "waiting_for_agent",
    "agent_returned",
    "previewing",
  ]) {
    assert.match(recordBody, new RegExp(`state\\.kind === "${state}"`));
  }
  assert.match(recordBody, /title:\s*rail\.status\.replace/);
  assert.match(recordBody, /emitThoughtConsoleEvent\(/);
});

test("active process messages share one animated ellipsis", () => {
  for (const kind of [
    "work_creating_run",
    "work_opening_agent",
    "work_waiting_for_agent",
    "work_previewing",
    "wallet_connection_requested",
    "authorization_requested",
    "transaction_requested",
    "transaction_submitted",
    "path_mint_returned",
    "path_mint_handoff",
  ]) {
    assert.match(thoughtMain, new RegExp(`"${kind}"`));
  }
  assert.match(thoughtMain, /entry\.id === newestEntry\?\.id && isThoughtConsoleProgressActive/);
  assert.match(thoughtMain, /entry\.kind === "work_claim_authorization" && entry\.title === "Codex authorized"/);
  assert.match(thoughtMain, /presentation\.tone === "running"[\s\S]*?appendThoughtProgressEllipsis/);
  assert.match(thoughtCss, /@keyframes thought-progress-ellipsis-dot/);
  assert.match(ruleBody(".thought-progress-ellipsis"), /white-space:\s*nowrap/);
  assert.match(ruleBody(".thought-progress-ellipsis.is-active .thought-progress-ellipsis__dot"), /animation:/);
  assert.match(thoughtCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/);
});

test("panel interaction colors are monochrome in both themes", () => {
  assert.match(thoughtCss, /--thought-panel-interactive:\s*#ffffff/);
  assert.match(thoughtCss, /--thought-panel-on-interactive:\s*#000000/);
  assert.match(thoughtCss, /--thought-panel-accent-text:\s*var\(--thought-panel-interactive\)/);
  assert.match(
    thoughtCss,
    /@media \(prefers-color-scheme: light\)[\s\S]*?--thought-panel-interactive:\s*#000000;[\s\S]*?--thought-panel-on-interactive:\s*#ffffff/,
  );
  assert.doesNotMatch(thoughtCss, /--thought-panel-accent-text:\s*#00a000/);
  assert.match(thoughtCss, /--thought-panel-subtle-text:\s*#9ca3af/);
  assert.match(ruleBody(".thought-mint-step__title"), /var\(--thought-panel-accent-text\)/);
  assert.match(ruleBody(".thought-dock-path-flow"), /var\(--thought-panel-subtle-text\)/);
});

test("Console history keeps the same text intensity as the current attempt", () => {
  assert.doesNotMatch(thoughtCss, /--thought-console-history-opacity/);
  assert.doesNotMatch(thoughtCss, /\.thought-dock-status-screen__entry:not\(\.is-current-attempt\)/);
  assert.match(thoughtCss, /--thought-console-text-opacity:\s*0\.5/);
  assert.match(
    ruleBody(".thought-dock-status-screen__line"),
    /opacity:\s*var\(--thought-console-text-opacity\)/,
  );
});

test("Console uses theme-aware text for every tone", () => {
  const consoleBody = ruleBody(".thought-dock-status-screen");
  assert.match(thoughtCss, /--thought-console-text:\s*#ffffff/);
  assert.match(
    thoughtCss,
    /@media \(prefers-color-scheme: light\)[\s\S]*?--thought-console-text:\s*var\(--text\)/,
  );
  assert.doesNotMatch(consoleBody, /--thought-console-text:/);
  assert.match(consoleBody, /color:\s*var\(--thought-console-text\)/);

  for (const selector of [
    ".thought-dock-status-screen__line",
    ".thought-dock-status-screen__line--heading",
    ".thought-dock-status-screen__line--error",
    ".thought-dock-status-screen__line--success",
  ]) {
    assert.match(ruleBody(selector), /color:\s*var\(--thought-console-text\)/);
  }
});

test("Console warnings use one stable muted yellow in both themes", () => {
  assert.match(
    thoughtCss,
    /--thought-console-warning-text:\s*#8b731c/,
  );
  assert.match(
    thoughtCss,
    /--thought-console-warning-opacity:\s*1/,
  );
  assert.match(
    ruleBody(".thought-dock-status-screen__line--warning"),
    /color:\s*var\(--thought-console-warning-text\)/,
  );
  assert.match(
    ruleBody(".thought-dock-status-screen__line--warning"),
    /opacity:\s*var\(--thought-console-warning-opacity\)/,
  );
  assert.doesNotMatch(thoughtCss, /thought-console-warning-flash|is-warning-flash/);
  assert.doesNotMatch(thoughtMain, /activeThoughtConsoleWarningFlashes|is-warning-flash/);
  assert.doesNotMatch(thoughtMain, /review this warning, then retry/);
  assert.match(
    thoughtMain,
    /if \(title\.includes\("path"\)\) \{[\s\S]*?return "pick another \$PATH or refresh wallet from the shell bar";[\s\S]*?return undefined;/,
    "warnings without a concrete recovery action must not invent a next step",
  );
});

test("text-too-long rejection is a byte-usage warning", () => {
  assert.match(thoughtMain, /title:\s*state\.issue\?\.title \?\? \(textTooLong \? "text too long" : "work rejected"\)/);
  assert.match(thoughtMain, /tone:\s*state\.issue \|\| textTooLong \? "warning" : "error"/);
  assert.match(thoughtMain, /error\.previewReasonCode === 3 && error\.byteLimit/);
  assert.match(thoughtMain, /formatThoughtByteLimitUsage\(error\.byteLimit\)/);
  assert.match(
    thoughtMain,
    /reduce prompt to \$\{THOUGHT_V2_PROTOCOL_RELEASE\.limits\.promptMaxBytes\} UTF-8 bytes or less/,
  );
  assert.match(
    thoughtMain,
    /input\.tone === "warning" \|\| input\.tone === "error"[\s\S]*?suggestedThoughtConsoleNextStep\(input\)/,
  );
  assert.match(thoughtMain, /thoughtConsoleNextStepForPresentation\(presentation\)/);
  assert.match(
    thoughtMain,
    /const rejectInvalidThoughtDockPrompt = \(prompt: string\)[\s\S]*?measureThoughtV2Line\(prompt, "prompt"\)/,
  );
  assert.match(thoughtMain, /describeThoughtTextPolicyIssue\(\{[\s\S]*?value: prompt,[\s\S]*?line: "prompt"/);
  assert.match(thoughtTextPolicy, /\? "leading space"[\s\S]*?: "trailing space"/);
  assert.match(thoughtTextPolicy, /ends with U\+0020/);
  assert.match(thoughtTextPolicy, /output is never auto-corrected/);
  assert.match(thoughtMain, /const deriveThoughtV2VisibleLine = \(value: string\): string => value/);
  assert.match(
    thoughtMain,
    /const openThoughtDockAgentSelect = \(\) => \{[\s\S]*?const prompt = thoughtDockPrompt\.value;\s*if \(rejectInvalidThoughtDockPrompt\(prompt\)\)/,
  );
  assert.match(
    thoughtMain,
    /if \(rejectInvalidThoughtDockPrompt\(prompt\)\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?setThoughtDockState\(\{ kind: "agent_select", prompt \}\)/,
  );
});

test("Console exposes a thin scrollbar only when its content overflows", () => {
  const consoleBody = ruleBody(".thought-dock-status-screen");
  assert.match(consoleBody, /overflow-y:\s*auto/);
  assert.match(
    consoleBody,
    /scrollbar-color:\s*var\(--detail-scrollbar-thumb\) var\(--detail-scrollbar-track\)/,
  );
  assert.match(consoleBody, /scrollbar-width:\s*thin/);
  assert.doesNotMatch(consoleBody, /scrollbar-width:\s*none/);

  const scrollbarBody = ruleBody(".thought-dock-status-screen::-webkit-scrollbar");
  assert.match(scrollbarBody, /width:\s*8px/);
  assert.doesNotMatch(scrollbarBody, /display:\s*none/);
  assert.match(
    ruleBody(".thought-dock-status-screen::-webkit-scrollbar-track"),
    /background:\s*var\(--detail-scrollbar-track\)/,
  );
  assert.match(
    ruleBody(".thought-dock-status-screen::-webkit-scrollbar-thumb"),
    /background:\s*var\(--detail-scrollbar-thumb\)/,
  );
});

test("Console keeps the newest time group at the top without reversing causal order", () => {
  assert.match(
    thoughtMain,
    /const newestFirstThoughtConsoleEntries = \(entries: ThoughtConsoleEntry\[\]\) => \{[\s\S]*?if \(currentGroup\?\.at\(-1\)\?\.time === entry\.time\) \{[\s\S]*?return timeGroups\.reverse\(\)\.flat\(\);/,
  );
  assert.match(
    thoughtMain,
    /const entries = newestFirstThoughtConsoleEntries\(thoughtConsoleHistory\.entries\)\.map\(\(entry\) => \{/,
  );
  assert.match(thoughtMain, /element\.dataset\.consoleEntryId = entry\.id/);
  assert.match(
    thoughtMain,
    /const hasNewLatestEntry = newestEntry\?\.id !== previousNewestEntryId;[\s\S]*?if \(hasNewLatestEntry \|\| wasPinnedToLatest\) \{[\s\S]*?thoughtDockDetails\.scrollTop = 0;/,
  );
  assert.match(
    thoughtMain,
    /else \{\s*thoughtDockDetails\.scrollTop = previousScrollTop;\s*\}/,
    "rerenders must preserve the reader's position when no new entry arrives",
  );
});

test("console rendering is read-only and mint attempts survive navigation", () => {
  const renderStart = thoughtMain.indexOf("const renderThoughtDockDetails");
  const renderEnd = thoughtMain.indexOf("const getResolvedThoughtDockState", renderStart);
  assert.ok(renderStart >= 0 && renderEnd > renderStart, "console render function is present");
  const renderBody = thoughtMain.slice(renderStart, renderEnd);
  assert.doesNotMatch(renderBody, /emitThoughtConsoleEvent|recordMintConsoleState|appendThoughtConsoleEvent/);

  assert.match(thoughtMain, /createMintSubmissionContext\(\{[\s\S]*?attemptId:\s*payload\.attemptId/);
  assert.match(thoughtMain, /pendingMintTransaction\s*=\s*createPendingMintTransaction\(submission, tx\.hash/);
  assert.match(thoughtMain, /mintAttemptId\s*=\s*pending\.attemptId\?\.trim\(\)\s*\|\|\s*retainedAttemptId/);
  assert.match(thoughtMain, /await mintThoughtDockWork\(\{[\s\S]*?attemptId:\s*mintAttemptId,[\s\S]*?pathId:\s*confirmedReturn\?\.tokenId/);
  assert.match(thoughtMain, /serializePendingThoughtPathAcquisition\(pending\)/);
  assert.match(thoughtMain, /workHash:\s*workHash\.toLowerCase\(\),[\s\S]*?txHash:\s*tx\.hash\.toLowerCase\(\)/);
  assert.match(thoughtMain, /const confirmedReturn = returnRecord\?\.status === "confirmed"/);
  assert.match(thoughtMain, /\$PATH was minted to \$\{shortHex\(confirmedReturn\.account\)\}; select that account in your wallet to continue\./);
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

test("Codex launch errors keep their actionable message in Console", () => {
  const runStart = thoughtMain.indexOf("const runThoughtDockAdapter = async");
  const runEnd = thoughtMain.indexOf("const updateThoughtDockRunState =", runStart);
  const runBody = thoughtMain.slice(runStart, runEnd);

  assert.match(runBody, /setThoughtDockState\(\{ kind: "failed", message \}\)/);
  assert.doesNotMatch(runBody, /details:\s*"Try again\."/);
});

test("local Agent fixture mode keeps work generation independent from Anvil", () => {
  const runStart = thoughtMain.indexOf("const runThoughtDockAdapter = async");
  const runEnd = thoughtMain.indexOf("const updateThoughtDockRunState =", runStart);
  const runBody = thoughtMain.slice(runStart, runEnd);

  assert.match(thoughtMain, /const THOUGHT_AGENT_FIXTURE_MODE = shouldUseThoughtAgentFixture/);
  assert.match(runBody, /if \(!THOUGHT_AGENT_FIXTURE_MODE && !adapter\.canDeepLink\)/);
  assert.match(
    runBody,
    /const payload = await buildThoughtDockRunPayload\(prompt\);[\s\S]*?if \(THOUGHT_AGENT_FIXTURE_MODE\) \{[\s\S]*?await runThoughtDockFixtureAdapter\(adapterId, prompt, payload, runSessionId\)/,
  );
  assert.match(
    thoughtMain,
    /const runThoughtDockFixtureAdapter =[\s\S]*?handleThoughtDockReturnedWork\(run, agentLine, payload, runSessionId\)/,
    "the fixture must rejoin the normal return and mint-readiness pipeline",
  );
  assert.match(
    thoughtMain,
    /const selectThoughtPreviewProvider = async \(\) => \{[\s\S]*?if \(THOUGHT_AGENT_FIXTURE_MODE\) \{\s*return \{ provider: createFrontendPreviewProvider\(\), reason: "" \};/,
    "fixture returns must use the deterministic browser preview instead of an Anvil contract read",
  );
  assert.match(
    thoughtMain,
    /const ensureThoughtDockActiveSpec = async \(\) => \{\s*if \(THOUGHT_AGENT_FIXTURE_MODE && shouldUseBundledThoughtSpecFallback\(\)\) \{[\s\S]*?activeThoughtSpec = buildBundledActiveThoughtSpec\(\);/,
    "fixture runs must use the bundled release spec before trying an Anvil registry read",
  );
  assert.match(thoughtMain, /title: `\$\{thoughtAgentProductLabel\(adapterId\)\} fixture return`/);
});

test("Work owns mutually exclusive Mint and Load disclosures", () => {
  assert.doesNotMatch(thoughtMain, /\{ kind: "minting"; work: ThoughtDockWorkView \}/);
  assert.doesNotMatch(thoughtMain, /setThoughtDockState\(\{ kind: "minting"/);
  assert.doesNotMatch(thoughtMain, /thoughtDock\.hidden\s*=/);
  assert.match(thoughtMain, /let mintDockRevealed = false/);
  assert.match(thoughtMain, /const mintPanelOpen = mintDockRevealed/);
  assert.match(thoughtMain, /workReady\.canMint && workMintReadiness\.ready/);
  assert.match(
    thoughtMain,
    /revealMintDock\(\);[\s\S]*?kind: "mint_requirement"[\s\S]*?title: "to mint THOUGHT"[\s\S]*?detail: "1 THOUGHT requires 1 available \$PATH\. \$PATH is the permission token for Inshell’s three fully on-chain movements for Agent Art\."[\s\S]*?tone: "warning"[\s\S]*?syncThoughtDock\(\);\s*void mintThoughtDockWork\(\)/,
    "the Work Mint CTA explains the PATH requirement before starting the mint flow",
  );
  assert.match(
    thoughtMain,
    /mintPanelOpen \? "mint ↓" : "mint"[\s\S]*?mintPanelOpen \? "collapse Mint panel"[\s\S]*?mintDockRevealed = false;[\s\S]*?\{ expanded: mintPanelOpen \}/,
    "the Work Mint CTA becomes a clickable expanded disclosure that can collapse Mint",
  );
  assert.match(
    thoughtMain,
    /const revealMintDock = \(\) => \{\s*mintDockRevealed = true;\s*workLibraryRevealed = false;\s*writeCurrentOutputSession\(\);\s*\}/,
    "revealing Mint closes Load and persists with the current Work",
  );
  assert.match(
    thoughtMain,
    /loadPanelOpen \? "load ↓" : "load"[\s\S]*?workLibraryRevealed = !loadPanelOpen;[\s\S]*?mintDockRevealed = false;[\s\S]*?\{ expanded: loadPanelOpen \}/,
    "Load is a clickable disclosure and opening it closes Mint",
  );
  assert.match(
    thoughtMain,
    /currentWorkSaved \? "saved" : "save"[\s\S]*?currentWorkSaved \? "current work is saved" : "save current work"/,
    "saved Work uses an explicit saved state label",
  );
  const mintedCase = thoughtMain.slice(
    thoughtMain.indexOf('case "minted"'),
    thoughtMain.indexOf('case "run_access_needed"'),
  );
  assert.match(mintedCase, /dockRailAction\("view"/);
  assert.match(mintedCase, /dockRailAction\(\s*"save"/);
  assert.match(mintedCase, /loadAction\(\)/);
  assert.match(mintedCase, /resetAction\(\)/);
  assert.match(mintedCase, /maxActions: 4/);
  assert.match(thoughtMain, /mintFlowState = "thought_checking";[\s\S]*?setThoughtDockState\(\{ kind: "work_ready", work \}\)/);
  assert.match(thoughtMain, /const isVisible = mintDockRevealed/);
  assert.match(
    thoughtMain,
    /mintDockRevealed: candidate\.mintDockRevealed === true/,
    "legacy Work snapshots default to hidden while revealed snapshots restore",
  );
  assert.match(
    thoughtMain,
    /workId: currentWorkId,\s*mintDockRevealed,/,
    "the Mint disclosure state is stored inside the current Work snapshot",
  );
  assert.match(
    thoughtMain,
    /currentWorkId = stored\.workId;\s*mintDockRevealed = stored\.mintDockRevealed;\s*runState = "output_ready"/,
    "the Mint disclosure state restores before the Work UI is rendered",
  );
  assert.match(
    thoughtMain,
    /if \(!resumedPendingMint && !resumedPathMint\) \{\s*if \(mintDockRevealed\) \{\s*await mintThoughtDockWork\(\)/,
    "refresh safely rebuilds the visible Mint flow for the restored Work",
  );

  const resetMintFlowStart = thoughtMain.indexOf("const resetMintFlow =");
  const resetMintFlowEnd = thoughtMain.indexOf("const resetMintRuntimeState =", resetMintFlowStart);
  assert.doesNotMatch(
    thoughtMain.slice(resetMintFlowStart, resetMintFlowEnd),
    /mintDockRevealed/,
    "mint workflow resets do not hide a revealed panel",
  );

  for (const [startMarker, endMarker] of [
    ["const setAgentOutput =", "const hasCurrentContractWorkSvg ="],
    ["const loadWorkRecord =", "const isThoughtRunContext ="],
    ["const resetThought =", "const base64UrlEncode ="],
  ]) {
    const start = thoughtMain.indexOf(startMarker);
    const end = thoughtMain.indexOf(endMarker, start);
    assert.match(
      thoughtMain.slice(start, end),
      /mintDockRevealed = false/,
      `${startMarker} starts a hidden Mint panel for the new Work boundary`,
    );
  }

  const resetThoughtStart = thoughtMain.indexOf("const resetThought =");
  const resetThoughtEnd = thoughtMain.indexOf("const base64UrlEncode =", resetThoughtStart);
  assert.match(
    thoughtMain.slice(resetThoughtStart, resetThoughtEnd),
    /mintDockRevealed = false;\s*workLibraryRevealed = false;/,
    "Reset collapses both Mint and Load panels",
  );

  const handoffRestoreStart = thoughtMain.indexOf("const restorePathMintHandoffWork =");
  const handoffRestoreEnd = thoughtMain.indexOf("const pathTokenIdFromMintReceipt =", handoffRestoreStart);
  assert.match(
    thoughtMain.slice(handoffRestoreStart, handoffRestoreEnd),
    /mintDockRevealed = true;\s*writeCurrentOutputSession\(\)/,
    "returning from same-origin PATH mint keeps the Mint panel revealed",
  );
});

test("mint submission and recovery keep one durable hash", () => {
  const pathCheckStart = thoughtMain.indexOf("const checkPathEligibility = async");
  const pathCheckEnd = thoughtMain.indexOf("const authorizeMint = async", pathCheckStart);
  const pathCheckBody = thoughtMain.slice(pathCheckStart, pathCheckEnd);
  assert.ok(pathCheckStart >= 0 && pathCheckEnd > pathCheckStart);
  assert.ok(pathCheckBody.indexOf("await rebuildFinalMintProvenance()") >= 0);
  assert.ok(pathCheckBody.indexOf('mintFlowState = "path_ready"') >= 0);
  assert.ok(
    pathCheckBody.indexOf("await rebuildFinalMintProvenance()") <
      pathCheckBody.indexOf('mintFlowState = "path_ready"'),
    "final V2 provenance must validate before the panel offers SIGN",
  );

  const authorizeStart = thoughtMain.indexOf("const authorizeMint = async");
  const authorizeEnd = thoughtMain.indexOf("type MintTransactionResponse", authorizeStart);
  const authorizeBody = thoughtMain.slice(authorizeStart, authorizeEnd);
  assert.ok(authorizeStart >= 0 && authorizeEnd > authorizeStart);
  assert.doesNotMatch(authorizeBody, /readPathEligibility|rebuildFinalMintProvenance/);
  assert.ok(authorizeBody.indexOf('mintFlowState = "authorizing"') >= 0);
  assert.ok(
    authorizeBody.indexOf("mintAuthorizationInFlight = true") <
      authorizeBody.indexOf('mintFlowState = "authorizing"'),
    "authorization locks synchronously before the wallet phase",
  );
  assert.ok(
    authorizeBody.indexOf('mintFlowState = "authorizing"') <
      authorizeBody.indexOf(
        "recordCurrentMintConsoleState()",
        authorizeBody.indexOf('mintFlowState = "authorizing"'),
      ),
    "the wallet-request console event must be recorded only after entering the real wallet phase",
  );

  const confirmStart = thoughtMain.indexOf("const confirmMint = async");
  const confirmEnd = thoughtMain.indexOf("const readPathAcquisitionQuote", confirmStart);
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
  assert.match(thoughtMain, /readPathAcquisitionQuote[\s\S]*?adapterPathNft\.toLowerCase\(\) !== PATH_NFT_ADDRESS\.toLowerCase\(\)/);
  assert.match(thoughtMain, /window\.addEventListener\("storage"[\s\S]*?event\.newValue === null[\s\S]*?return/);
  assert.match(thoughtMain, /const resetThought = [\s\S]*?blockPendingMintMutation\(\) \|\| blockPendingPathAcquisitionMutation\(\)/);
  assert.match(thoughtMain, /const setAgentOutput = [\s\S]*?blockPendingMintMutation\(\) \|\| blockPendingPathAcquisitionMutation\(\)/);
});

test("current work verifies THOUGHT uniqueness before PICK and before submission", () => {
  const preflightStart = thoughtMain.indexOf("const preflightCurrentThoughtExistence = async");
  const preflightEnd = thoughtMain.indexOf("const handlePendingTx = async", preflightStart);
  const preflightBody = thoughtMain.slice(preflightStart, preflightEnd);
  assert.ok(preflightStart >= 0 && preflightEnd > preflightStart);
  assert.match(preflightBody, /await verifyLocalThoughtV2Deployment\(\)/);
  assert.match(preflightBody, /await textHashFromContract\(checkedText\)/);
  assert.match(preflightBody, /await lookupExistingThoughtToken\(token, textHash\)/);
  assert.match(preflightBody, /currentOutputText !== checkedText[\s\S]*?mintFlowState !== "closed"/);
  assert.match(preflightBody, /mintFlowData\.existingTokenId = Number\(existingTokenId\)[\s\S]*?mintFlowState = "text_taken"/);
  assert.doesNotMatch(preflightBody, /refreshWalletState|refreshPathInventory|authorizeMint/);

  for (const [startMarker, endMarker] of [
    ["const loadWorkRecord =", "const isThoughtRunContext ="],
    ["const restoreCurrentOutputSession =", "const recordThoughtRun ="],
    ["const promotePreviewedCandidateToWork =", "const completeThoughtRunFromModelReturn ="],
  ]) {
    const start = thoughtMain.indexOf(startMarker);
    const end = thoughtMain.indexOf(endMarker, start);
    assert.match(
      thoughtMain.slice(start, end),
      /void preflightCurrentThoughtExistence\(\)/,
      `${startMarker} starts the read-only uniqueness preflight`,
    );
  }

  const resolvedStateStart = thoughtMain.indexOf("const getResolvedThoughtDockState =");
  const resolvedStateEnd = thoughtMain.indexOf("type ThoughtWorkMintReadiness", resolvedStateStart);
  assert.match(
    thoughtMain.slice(resolvedStateStart, resolvedStateEnd),
    /mintFlowState === "text_taken"[\s\S]*?kind: "minted"[\s\S]*?existing: true/,
    "an existing token replaces mint controls with the success rail",
  );

  const openStart = thoughtMain.indexOf("const openMintFlow = async");
  const openEnd = thoughtMain.indexOf("type PathEligibilityResult", openStart);
  const openBody = thoughtMain.slice(openStart, openEnd);
  assert.ok(
    openBody.indexOf("lookupExistingThoughtToken") < openBody.indexOf("refreshWalletState"),
    "Mint click checks uniqueness before reading wallet or $PATH inventory",
  );

  const confirmStart = thoughtMain.indexOf("const confirmMint = async");
  const confirmEnd = thoughtMain.indexOf("const readPathAcquisitionQuote", confirmStart);
  const confirmBody = thoughtMain.slice(confirmStart, confirmEnd);
  assert.ok(
    confirmBody.indexOf("lookupExistingThoughtToken(readToken, payload.workHash)") <
      confirmBody.indexOf('getTransactionCount(signerAddress, "pending")'),
    "the race guard rechecks uniqueness before opening the transaction request",
  );
});

test("PICK can acquire the exact V2 $PATH without leaving THOUGHT", () => {
  assert.match(thoughtMintPresentation, /state === "review"[\s\S]*?Wallet request 1 of 3[\s\S]*?confirm_path_mint[\s\S]*?Mint \$PATH for/);
  assert.match(thoughtMintPresentation, /consoleNextStep: "mint here, or explore \$PATH at \/path"/);
  assert.doesNotMatch(thoughtMintPresentation, /action\("explore_path"/);
  assert.match(thoughtMain, /availableItems\.length === 0[\s\S]*?pathAcquisitionState === "idle"[\s\S]*?handleMintPath\(\)/);
  assert.match(thoughtMain, /action === "mint_path"[\s\S]*?handleMintPath\(\{ submit: true \}\)/);
  assert.match(thoughtMain, /const readPathAcquisitionQuote = async[\s\S]*?auction\.mintAdapter\(\)[\s\S]*?adapter\.pathNft\(\)[\s\S]*?wiringFrozen/);
  assert.match(thoughtMain, /withThoughtPathAcquisitionLock\([\s\S]*?auction\.bid\(quote\.price, \{ value: quote\.price \}\)/);
  assert.match(thoughtMain, /writePendingPathAcquisition\(pending\)[\s\S]*?monitorPendingPathAcquisition/);
  assert.match(thoughtMain, /pathTokenIdFromMintReceipt\(receipt, pending\.account\)[\s\S]*?refreshPathInventoryForCurrentWallet\(\{ force: true \}\)[\s\S]*?checkPathEligibility\(\)/);
  assert.doesNotMatch(thoughtMain, /window\.location\.assign\(pathMintUrl\(\)\)/);
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

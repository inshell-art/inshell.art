import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexHtml = await readFile(new URL("../apps/thought/index.html", import.meta.url), "utf8");
const thoughtCss = await readFile(new URL("../apps/thought/src/style.css", import.meta.url), "utf8");
const thoughtMain = await readFile(new URL("../apps/thought/src/main.ts", import.meta.url), "utf8");
const thoughtClaudeCoworkQualification = await readFile(
  new URL(
    "../apps/thought/src/thought-claude-cowork-qualification.ts",
    import.meta.url,
  ),
  "utf8",
);
const thoughtLocalMint = await readFile(
  new URL("../apps/thought/src/thought-v2-local-mint.ts", import.meta.url),
  "utf8",
);
const thoughtRendererAbi = JSON.parse(
  await readFile(
    new URL(
      "../apps/thought/contract-integration/current/thought-renderer-v2.abi.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
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
const thoughtViteConfig = await readFile(
  new URL("../apps/thought/vite.config.ts", import.meta.url),
  "utf8",
);

const ruleBody = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = thoughtCss.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `missing CSS rule: ${selector}`);
  return match[1];
};

test("THOUGHT creation page presents its canonical slogan below the title", () => {
  assert.match(
    indexHtml,
    /<div class="thought-create__identity">\s*<h1 id="frontpage-title" class="thought-create__title">THOUGHT<\/h1>\s*<p class="thought-create__slogan">one person\. one Agent\. one thought\.<\/p>\s*<\/div>/,
  );

  const sloganBody = ruleBody(".thought-create__slogan");
  const identityBody = ruleBody(".thought-create__identity");
  assert.match(
    identityBody,
    /width:\s*var\(--thought-create-identity-width,\s*100%\)/,
  );
  assert.match(identityBody, /align-items:\s*flex-start/);
  assert.match(identityBody, /text-align:\s*left/);
  assert.match(thoughtCss, /--thought-create-column-gap:\s*36px/);
  assert.match(
    thoughtCss,
    /body\.frontpage:has\(\.frontpage-stage:not\(\.is-hidden\)\) \.thought-create__header[\s\S]*?column-gap:\s*var\(--thought-create-column-gap\)/,
  );
  assert.match(
    thoughtCss,
    /body\.frontpage:has\(\.frontpage-stage:not\(\.is-hidden\)\) \.frontpage-main[\s\S]*?column-gap:\s*var\(--thought-create-column-gap\)/,
  );
  assert.match(sloganBody, /color:\s*var\(--bright\)/);
  assert.match(
    sloganBody,
    /font-size:\s*clamp\(\s*var\(--font-size-12\),\s*1\.2vw,\s*var\(--font-size-16\)\s*\)/,
  );
  assert.match(sloganBody, /font-weight:\s*var\(--weight-mid\)/);

  const stackedHeightStart = thoughtMain.indexOf(
    "const getStackedOperatorAvailableHeight =",
  );
  const stackedHeightEnd = thoughtMain.indexOf(
    "const getViewportWidthCap =",
    stackedHeightStart,
  );
  assert.match(
    thoughtMain.slice(stackedHeightStart, stackedHeightEnd),
    /const headerHeight = visibleBlockOuterHeight\(frontpageHeader\)/,
  );
  assert.doesNotMatch(
    thoughtMain.slice(stackedHeightStart, stackedHeightEnd),
    /frontpageTitle|titleHeight/,
  );
  assert.match(
    thoughtMain,
    /frontpageStage\.style\.setProperty\(\s*"--thought-create-identity-width",/,
  );
  assert.match(
    thoughtMain,
    /thoughtCanvasPanel\.style\.setProperty\(\s*"--thought-canvas-frame-width",/,
  );
});

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

test("same-origin dev handles local THOUGHT contract attestation in its backend", () => {
  assert.match(
    thoughtViteConfig,
    /requestUrl\.pathname === "\/api\/thought-contract\/v1\/mock-attestation"/,
  );
  assert.match(thoughtViteConfig, /buildBackendOnlyMockThoughtV2Mint\(runtime/);
});

test("standalone devnet keeps PATH acquisition contracts on the active THOUGHT runtime", () => {
  assert.match(
    thoughtViteConfig,
    /buildThoughtV2PathAcquisitionBrowserAddresses\(runtime\)/,
  );
});

test("desktop panel stack shares the canvas top and bottom edges", () => {
  assert.match(thoughtCss, /--thought-panel-row-alignment:\s*center/);
  assert.match(
    ruleBody(".thought-panel"),
    /align-self:\s*var\(--thought-panel-row-alignment\)/,
  );
  assert.match(
    thoughtCss,
    /@media \(max-width: 1023px\)[\s\S]*?--thought-panel-row-alignment:\s*stretch/,
  );
});

test("empty creation canvas follows the active contract work frame", () => {
  assert.match(thoughtCss, /--thought-work-frame-color:\s*#006100/);
  assert.match(thoughtCss, /--thought-work-frame-inset:\s*32/);
  assert.match(thoughtCss, /--thought-work-canvas-size:\s*960/);
  assert.match(
    thoughtLocalMint,
    /THOUGHT_V2_LOCAL_RENDERER_ABI = THOUGHT_V2_CURRENT_RENDERER_ABI/,
  );
  assert.ok(
    thoughtRendererAbi.some(
      (entry) =>
        entry.type === "function" &&
        entry.name === "IMPLEMENTATION_ID" &&
        entry.stateMutability === "view",
    ),
    "compiled renderer ABI exposes IMPLEMENTATION_ID()",
  );

  const renderStart = thoughtMain.indexOf("const renderCanvas =");
  const renderEnd = thoughtMain.indexOf("const syncOutputToCanvas =", renderStart);
  const renderBody = thoughtMain.slice(renderStart, renderEnd);
  assert.match(renderBody, /thoughtV2EmptyFrameCanvasRect/);
  assert.match(renderBody, /context\.fillStyle = emptyFrameStyle\.color/);
  assert.match(renderBody, /context\.fillRect\(canvasRect\.x, canvasRect\.y, canvasRect\.width, canvasRect\.height\)/);

  const syncStart = thoughtMain.indexOf("const syncEmptyFrameStyleFromContract =");
  const syncEnd = thoughtMain.indexOf("const setAgentOutput =", syncStart);
  const syncBody = thoughtMain.slice(syncStart, syncEnd);
  assert.match(syncBody, /await renderer\.IMPLEMENTATION_ID\(\)/);
  assert.match(syncBody, /parseThoughtV2EmptyFrameStyle\(implementationId\)/);

  const contractPreviewStart = thoughtMain.indexOf("const previewWorkViaAllowedProvider =");
  const contractPreviewEnd = thoughtMain.indexOf(
    "const createThoughtPreviewProvider =",
    contractPreviewStart,
  );
  const contractPreviewBody = thoughtMain.slice(contractPreviewStart, contractPreviewEnd);
  assert.match(contractPreviewBody, /IS_LOCAL_THOUGHT_V2[\s\S]*?await renderer\.render\(/);
  assert.doesNotMatch(
    contractPreviewBody,
    /buildThoughtV2Svg/,
    "the active V2 contract preview must not be reconstructed by the frontend",
  );
  assert.doesNotMatch(
    thoughtMain,
    /const createFrontendPreviewProvider =/,
    "the current App must not expose an unpinned frontend renderer fallback",
  );
  const providerSelectionStart = thoughtMain.indexOf("const selectThoughtPreviewProvider =");
  const providerSelectionEnd = thoughtMain.indexOf(
    "const prunePreviewRateEvents =",
    providerSelectionStart,
  );
  const providerSelectionBody = thoughtMain.slice(providerSelectionStart, providerSelectionEnd);
  assert.match(providerSelectionBody, /pinned THOUGHT renderer release mismatch; preview stopped\./);
  assert.doesNotMatch(providerSelectionBody, /frontend-renderer|createFrontendPreviewProvider/);
  const rpcStart = thoughtMain.indexOf("const resolveThoughtRpcUrl =");
  const rpcEnd = thoughtMain.indexOf("const THOUGHT_RPC_URL =", rpcStart);
  const rpcBody = thoughtMain.slice(rpcStart, rpcEnd);
  assert.match(rpcBody, /currentContractRuntimeRpcUrl[\s\S]*?envRpcUrl/);
  assert.ok(
    rpcBody.indexOf("currentContractRuntimeRpcUrl ||") <
      rpcBody.indexOf("envRpcUrl ||"),
    "the injected current Contract runtime must override stale local env RPC values",
  );

  const previewStart = thoughtMain.indexOf("const showContractImagePreview =");
  const previewEnd = thoughtMain.indexOf("const syncCurrentWorkVisual =", previewStart);
  const previewBody = thoughtMain.slice(previewStart, previewEnd);
  assert.match(previewBody, /thoughtSvgPreview\.src = image/);
  assert.match(previewBody, /thoughtSvgPreview\.classList\.remove\("is-hidden"\)/);
  assert.match(previewBody, /canvas\.classList\.add\("is-hidden"\)/);
  assert.equal(
    (previewBody.match(/thoughtV2EmptyFrameCanvasRect/g) ?? []).length,
    0,
    "a contract SVG already contains its frame; the App must not draw a second frame",
  );
});

test("local runtime bootstrap preserves provenance eligibility facts", () => {
  const addressesStart = thoughtViteConfig.indexOf("evmAddresses: {");
  const addressesEnd = thoughtViteConfig.indexOf("function serializeForInlineScript", addressesStart);
  assert.ok(addressesStart >= 0 && addressesEnd > addressesStart);
  const addressesBody = thoughtViteConfig.slice(addressesStart, addressesEnd);
  assert.match(
    addressesBody,
    /provenance:\s*runtime\.provenance/,
    "the reduced browser address runtime must retain the provenance pin required by the local release gate",
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
    /kind: "work_library_opened",\s*title: "load a saved work",\s*detail: "Saved in this browser only—not on-chain or synced\."/,
  );
  const loadActionStart = thoughtMain.indexOf("const loadAction = () =>");
  const loadActionEnd = thoughtMain.indexOf("const newThoughtAction =", loadActionStart);
  const loadActionBody = thoughtMain.slice(loadActionStart, loadActionEnd);
  assert.equal(
    (loadActionBody.match(/emitThoughtConsoleEvent\(/g) ?? []).length,
    1,
    "only opening Load emits its browser-storage guidance",
  );
  assert.match(
    loadActionBody,
    /workLibraryRevealed = !loadPanelOpen;[\s\S]*?if \(workLibraryRevealed\) \{[\s\S]*?kind: "work_library_opened"/,
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
  assert.match(thoughtMintPresentation, /action\("confirm_mint", "Try again"\)/);
  assert.doesNotMatch(productCopy, /Try transaction again|Try signature again|Retry mint/);
  assert.match(
    thoughtMintPresentation,
    /action\("authorize", rejected \? "Try again" : `Sign \$\{signaturePath\}`\)/,
  );
  assert.match(
    thoughtMintPresentation,
    /action\("confirm_mint", "Try again"\), action\("choose_another", "Pick another \$PATH"\)/,
  );
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
  assert.match(
    thoughtMintPresentation,
    /stageCopy: "Select “Pick another \$PATH”, or open the wallet menu and select “refresh”\."/,
  );
  assert.match(thoughtMain, /placeholder\.textContent = "pick a \$PATH"/);
  assert.match(thoughtMain, /return "pick another \$PATH or select refresh in the wallet menu"/);
  assert.doesNotMatch(thoughtConsole, /\$PATH selection cleared/);
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
    /title: "\$PATH list unavailable"[\s\S]*?consoleNextStep: "open the wallet menu and select refresh"/,
  );
  assert.match(
    thoughtMintPresentation,
    /title: "\$PATH mint confirming"[\s\S]*?consoleNextStep: "wait for confirmation, then open the wallet menu and select refresh"/,
  );
  assert.match(
    thoughtMain,
    /const presentationNextStep = presentation\.consoleNextStep[\s\S]*?nextStep: presentationNextStep/,
  );
});

test("Console retains its timestamped first-visit guidance as normal history", () => {
  assert.match(
    thoughtConsole,
    /THOUGHT_CONSOLE_EMPTY_TITLE = "start with a prompt"/,
  );
  assert.match(
    thoughtConsole,
    /THOUGHT_CONSOLE_EMPTY_DETAIL =\s*\n?\s*"Write one line above, then send it to your Agent\."/,
  );
  assert.match(
    thoughtMain,
    /const ensureThoughtConsoleWelcomeMessage = \(\) => \{[\s\S]*?if \(thoughtConsoleHistory\.entries\.length > 0\) return;[\s\S]*?kind: "console_welcome"[\s\S]*?title: THOUGHT_CONSOLE_EMPTY_TITLE[\s\S]*?detail: THOUGHT_CONSOLE_EMPTY_DETAIL/,
  );
  assert.match(
    thoughtMain,
    /ensureThoughtConsoleWelcomeMessage\(\);[\s\S]*?loadCliTranscript\(\)/,
    "the welcome message must enter retained history before the first Console render",
  );
});

test("local deployment failures never prescribe wallet refresh", () => {
  assert.match(
    thoughtMintPresentation,
    /kind === "local_deployment"[\s\S]*?title: "local mint unavailable"[\s\S]*?Local Anvil is not serving the THOUGHT contracts configured for this App\.[\s\S]*?start or restore the local dev chain, then select “Try again”[\s\S]*?action\("continue", "Try again"\)/,
  );
  assert.match(
    thoughtMain,
    /verifyLocalThoughtV2Deployment\(\);[\s\S]*?catch \(error\) \{[\s\S]*?setMintFlowError\([\s\S]*?"local_deployment"/,
  );
  assert.match(
    thoughtMain,
    /localThoughtV2DeploymentPromise = \(async \(\) => \{[\s\S]*?finally\(\(\) => \{\s*localThoughtV2DeploymentPromise = null;/,
    "restoring Anvil must make deployment verification retryable without a page refresh",
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

test("THOUGHT mint guidance follows the resolved wallet and $PATH state", () => {
  assert.match(
    thoughtConsole,
    /THOUGHT_PATH_SELECTION_DETAIL\s*=\s*\n?\s*"Choose an available \$PATH above, or mint a new \$PATH"/,
  );
  assert.match(
    thoughtConsole,
    /THOUGHT_PATH_REQUIRED_DETAIL\s*=\s*\n?\s*"No available \$PATH can mint this THOUGHT; mint a new \$PATH"/,
  );
  assert.match(thoughtConsole, /THOUGHT_PATH_LINK_LABEL = "mint a new \$PATH ↗"/);
  assert.match(
    thoughtMain,
    /if \(mintFlowState === "wallet_required"\) \{[\s\S]*?kind: "wallet_required"[\s\S]*?presentation\.title/,
    "wallet guidance must use the resolved wallet presentation",
  );
  assert.match(
    thoughtMain,
    /const hasAvailablePath = availablePathInventoryItems\(\)\.length > 0;[\s\S]*?detail: hasAvailablePath[\s\S]*?THOUGHT_PATH_SELECTION_DETAIL[\s\S]*?THOUGHT_PATH_REQUIRED_DETAIL/,
    "PATH guidance must distinguish a selectable PATH from a missing PATH",
  );
});

test("Console retains durable mint events instead of live panel state", () => {
  assert.doesNotMatch(
    thoughtMain,
    /kind: "path_acquisition_quote"/,
    "the live auction quote must stay in the Mint CTA rather than retained history",
  );
  assert.match(
    thoughtMain,
    /if \(pathInventoryState\.status === "loaded"\) \{[\s\S]*?const hasAvailablePath = availablePathInventoryItems\(\)\.length > 0;[\s\S]*?kind: "mint_requirement"/,
  );
  assert.match(
    thoughtMain,
    /const actionNeeded = input\.tone === "warning" \|\| input\.tone === "error";[\s\S]*?: undefined;/,
    "only blockers retain recovery copy; neutral history must not mirror a live CTA",
  );
  assert.match(
    thoughtConsole,
    /Context is metadata for an event, not evidence that an action happened\.[\s\S]*?if \(!input\.kind \|\| !input\.title\) \{[\s\S]*?return history;/,
    "context changes require a caller-supplied semantic event",
  );
  const appendConsoleEventStart = thoughtConsole.indexOf(
    "export const appendThoughtConsoleEvent =",
  );
  const appendConsoleEventEnd = thoughtConsole.indexOf(
    "export type PendingMintWalletChangeInput",
    appendConsoleEventStart,
  );
  assert.ok(
    appendConsoleEventStart >= 0 && appendConsoleEventEnd > appendConsoleEventStart,
    "console event append function is present",
  );
  assert.doesNotMatch(
    thoughtConsole.slice(appendConsoleEventStart, appendConsoleEventEnd),
    /appendThoughtConsoleContextBoundary/,
    "ordinary events must not infer wallet, network, work, or deployment actions",
  );
  assert.doesNotMatch(
    thoughtMain,
    /recordThoughtConsoleContextBoundary/,
    "wallet hydration and work restoration must not project context as history",
  );
  assert.doesNotMatch(
    thoughtConsole,
    /LEGACY_NON_EVENT_KINDS|collapseRestoredIdempotentOutcomes|trimThoughtConsoleEntries|THOUGHT_CONSOLE_HISTORY_LIMIT/,
    "restoring or extending Console history must never prune valid earlier messages",
  );
  const walletRefreshStart = thoughtMain.indexOf("const refreshWalletState = async");
  const walletRefreshEnd = thoughtMain.indexOf(
    "async function refreshThoughtWalletFromShell",
    walletRefreshStart,
  );
  const walletRefreshBody = thoughtMain.slice(walletRefreshStart, walletRefreshEnd);
  assert.match(
    walletRefreshBody,
    /walletContextChanged &&[\s\S]*?\(walletStateHydrated \|\| pendingMintTransaction !== null\)/,
    "a pending mint checks its active wallet even on first hydration",
  );
  assert.match(
    walletRefreshBody,
    /const title = pendingMintWalletChangeTitle\([\s\S]*?if \(title\) \{[\s\S]*?kind: "wallet_changed_after_submission"/,
    "only a classified pending-mint safety change reaches Console",
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
    "claim_authorization",
    "waiting_for_agent",
    "agent_returned",
    "previewing",
  ]) {
    assert.match(recordBody, new RegExp(`state\\.kind === "${state}"`));
  }
  assert.match(recordBody, /title:\s*rail\.status\.replace/);
  assert.match(recordBody, /emitThoughtConsoleEvent\(/);
  assert.match(
    recordBody,
    /kind: "work_agent_selection_ready",[\s\S]*?title: "choose an Agent",[\s\S]*?detail: "Choose an Agent available on this machine to receive the prompt\."/
  );
  assert.match(
    recordBody,
    /kind: "work_claim_authorization_needed",[\s\S]*?title: `allow \$\{product\}`,[\s\S]*?Match code \$\{state\.authorization\.verificationCode \|\| "------"\} with \$\{product\}, then select “allow \$\{product\.toLowerCase\(\)\}” above\./
  );
  assert.match(
    thoughtMain,
    /The App asked the ChatGPT desktop app to open this THOUGHT task in Codex\./,
  );
  assert.match(
    thoughtMain,
    /open this THOUGHT task in Codex within the ChatGPT desktop app/,
  );
  assert.match(
    thoughtMain,
    /The App asked Claude to open this THOUGHT task\./,
  );
  assert.match(
    thoughtMain,
    /open this THOUGHT task in Claude/,
  );
});

test("active process messages share one animated ellipsis", () => {
  for (const kind of [
    "work_creating_run",
    "work_claim_authorizing",
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
  assert.match(
    thoughtMain,
    /entry\.id === newestEntry\?\.id &&[\s\S]*?isThoughtConsoleProgressActive/,
  );
  assert.match(thoughtMain, /element\.textContent = text\.replace\([^\n]+\);\s*if \(!active\) return;/);
  assert.match(thoughtMain, /case "work_claim_authorizing":[\s\S]*?state\.kind === "claim_authorization" && Boolean\(state\.approving\)/);
  assert.match(thoughtMain, /kind: "work_claim_authorized",\s*title: `\$\{product\} authorized`,\s*tone: "success"/);
  assert.match(thoughtMain, /presentation\.tone === "running"[\s\S]*?appendThoughtProgressEllipsis/);
  assert.match(thoughtCss, /@keyframes thought-progress-ellipsis-dot/);
  assert.match(ruleBody(".thought-progress-ellipsis"), /white-space:\s*nowrap/);
  assert.match(ruleBody(".thought-progress-ellipsis.is-active .thought-progress-ellipsis__dot"), /animation:/);
  assert.match(thoughtCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none/);
});

test("unchanged Agent polling preserves Console entry DOM and text selection", () => {
  const renderStart = thoughtMain.indexOf("const renderThoughtConsoleHistory =");
  const renderEnd = thoughtMain.indexOf("const renderThoughtDockDetails =", renderStart);
  const renderBody = thoughtMain.slice(renderStart, renderEnd);

  assert.match(renderBody, /currentElements = new Map/);
  assert.match(renderBody, /currentElement\?\.dataset\.consoleRenderSignature === renderSignature/);
  assert.match(renderBody, /thoughtDockDetailsBody\.insertBefore\(element, cursor\)/);
  assert.doesNotMatch(renderBody, /thoughtDockDetailsBody\.replaceChildren/);
  assert.match(thoughtMain, /const syncThoughtProgressEllipsis =/);
});

test("Agent waiting expires for every nonterminal remote state", () => {
  const pollStart = thoughtMain.indexOf("const startThoughtDockPolling =");
  const pollEnd = thoughtMain.indexOf("const handleThoughtDockReturnedWork =", pollStart);
  const pollBody = thoughtMain.slice(pollStart, pollEnd);

  assert.match(pollBody, /if \(hasThoughtPollDeadlineExpired\(activeRun\.expiresAt\)\)/);
  assert.doesNotMatch(
    pollBody,
    /activeRun\.remoteState === "created" && hasThoughtPollDeadlineExpired/,
  );
});

test("wallet return without a transaction hash becomes a bounded recoverable state", () => {
  assert.match(thoughtMain, /const WALLET_RETURN_WITHOUT_HASH_GRACE_MS = 8000/);
  assert.match(thoughtMain, /const createWalletReturnWithoutHashGuard = \(\) =>/);
  assert.match(thoughtMain, /window\.addEventListener\("blur", markWalletLeave\)/);
  assert.match(thoughtMain, /window\.addEventListener\("focus", scheduleWalletReturnCheck\)/);
  assert.match(thoughtMain, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
  assert.match(thoughtMain, /wallet returned but the transaction was not submitted\./);
  assert.match(thoughtMain, /Promise\.race\(\[txPromise, walletReturnGuard\.promise\]\)/);
  assert.match(thoughtMain, /walletReturnGuard\.dispose\(\)/);
  assert.match(thoughtMain, /const restoredDanglingMintRequest = thoughtConsoleHistory\.entries\.at\(-1\)\?\.kind === "transaction_requested"/);
  assert.match(thoughtMain, /kind: "mint_request_interrupted",\s*title: "mint status needs checking"/);
  assert.match(thoughtMain, /The page reloaded before the wallet returned a transaction hash\./);
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

test("Console key guidance uses full-opacity theme-aware text", () => {
  assert.match(
    thoughtCss,
    /--thought-console-guidance-text:\s*var\(--thought-console-text\)/,
  );
  assert.match(
    thoughtCss,
    /--thought-console-guidance-opacity:\s*1/,
  );
  assert.match(
    ruleBody(".thought-dock-status-screen__line--guidance"),
    /color:\s*var\(--thought-console-guidance-text\)/,
  );
  assert.match(
    ruleBody(".thought-dock-status-screen__line--guidance"),
    /opacity:\s*var\(--thought-console-guidance-opacity\)/,
  );
  assert.doesNotMatch(thoughtCss, /--thought-console-warning-(?:text|opacity)/);
  assert.match(
    thoughtMain,
    /const guidance = thoughtConsoleVisualRole\(entry\) === "guidance";[\s\S]*?statusScreenLine\(line, \{[\s\S]*?guidance,/,
  );
  assert.match(
    thoughtConsole,
    /"work_agent_selection_ready",[\s\S]*?"work_claim_authorization_needed",[\s\S]*?"work_ready",[\s\S]*?"wallet_connection_requested",[\s\S]*?"authorization_requested",[\s\S]*?"transaction_requested",[\s\S]*?"transaction_confirmed",[\s\S]*?"path_acquisition_wallet"/,
  );
  assert.match(
    thoughtConsole,
    /entry\.tone === "warning" \|\|[\s\S]*?entry\.tone === "error" \|\|[\s\S]*?THOUGHT_CONSOLE_GUIDANCE_KINDS\.has\(entry\.kind\)/,
  );
  assert.match(
    thoughtMain,
    /kind: readiness\.ready \? "work_ready" : "work_blocked"[\s\S]*?tone: readiness\.ready \? "success" : "warning"/,
    "work ready remains semantically successful while its visual role supplies guidance emphasis",
  );
  assert.doesNotMatch(thoughtCss, /thought-console-warning-flash|is-warning-flash/);
  assert.doesNotMatch(thoughtMain, /activeThoughtConsoleWarningFlashes|is-warning-flash/);
  assert.doesNotMatch(thoughtMain, /review this warning, then retry/);
  assert.match(
    thoughtMain,
    /if \(title\.includes\("path"\)\) \{[\s\S]*?return "pick another \$PATH or select refresh in the wallet menu";[\s\S]*?return undefined;/,
    "warnings without a concrete recovery action must not invent a next step",
  );
});

test("Console guidance states the next visible action without protocol jargon", () => {
  const recordStart = thoughtMain.indexOf("const recordMintConsoleState =");
  const recordEnd = thoughtMain.indexOf("const THOUGHT_CONSOLE_PROGRESS_KINDS", recordStart);
  const recordBody = thoughtMain.slice(recordStart, recordEnd);
  assert.ok(recordStart >= 0 && recordEnd > recordStart);

  assert.match(recordBody, /title: readiness\.ready \? "ready to mint" : "run this work again"/);
  assert.match(recordBody, /Select “mint” above to start minting this THOUGHT work\./);
  assert.match(
    recordBody,
    /const signAction = thoughtMintActionLabel\(presentation, "authorize", `Sign \$\{path\}`\)/,
  );
  assert.match(recordBody, /title: `\$\{path\} picked`/);
  assert.match(
    recordBody,
    /detail: `Select “\$\{signAction\}” above to authorize minting this THOUGHT work\.`/,
  );
  assert.match(recordBody, /Approve the signature request\. No transaction or gas\./);
  assert.match(
    recordBody,
    /const mintAction = thoughtMintActionLabel\(presentation, "confirm_mint", "Mint THOUGHT"\)/,
  );
  assert.match(
    recordBody,
    /Select “\$\{mintAction\}” above to submit this THOUGHT work to \$\{THOUGHT_CHAIN_NAME\}\. Signature valid until/,
  );
  assert.doesNotMatch(recordBody, /submit this THOUGHT work to the network/);
  assert.doesNotMatch(recordBody, /above to continue/);
  assert.match(recordBody, /Open your wallet and confirm the transaction\. Gas applies\./);
  assert.match(
    recordBody,
    /const viewAction = thoughtMintActionLabel\([\s\S]*?"view_thought",[\s\S]*?"View THOUGHT"/,
  );
  assert.match(recordBody, /Select “\$\{viewAction\}” above to open it\./);
  assert.doesNotMatch(
    recordBody,
    /\b(?:provenance|attestation|manifest|nonce|waiter|deployment|run context|spec anchor|Agent evidence|App session)\b/i,
    "normal creation guidance must not introduce internal protocol concepts",
  );

  assert.match(
    thoughtMain,
    /kind: "wallet_connection_requested",[\s\S]*?title: "approve wallet connection",[\s\S]*?Open your wallet and approve the connection\. No signature or transaction\./,
  );
  assert.match(
    thoughtMain,
    /kind: "path_acquisition_wallet",[\s\S]*?title: "confirm \$PATH mint in wallet",[\s\S]*?Open your wallet and confirm the transaction\. Gas applies\./,
  );
  assert.match(
    thoughtMain,
    /kind: "path_acquisition_inventory_pending",[\s\S]*?title: "new \$PATH not visible yet",[\s\S]*?open the wallet menu and select refresh/,
  );
});

test("retained authorization copy resolves the configured network name without deleting history", () => {
  assert.match(
    thoughtMain,
    /const withCurrentThoughtNetworkName = \(entry: ThoughtConsoleEntry\): ThoughtConsoleEntry =>[\s\S]*?entry\.kind !== "authorization_signed"[\s\S]*?submit this THOUGHT work to the network\.[\s\S]*?submit this THOUGHT work to \$\{THOUGHT_CHAIN_NAME\}\./,
  );
  assert.match(
    thoughtMain,
    /newestFirstThoughtConsoleEntries\(thoughtConsoleHistory\.entries\)\s*\.map\(withCurrentThoughtNetworkName\)\s*\.map\(\(entry\) =>/,
  );
});

test("persisted Console guidance is scoped to one mint attempt", () => {
  assert.match(
    thoughtMain,
    /const mintAttemptConsoleEventId = \([\s\S]*?\[kind, mintAttemptId, \.\.\.parts\]\.join\(":"\)/,
  );
  for (const kind of [
    "path-inventory",
    "path-selected",
    "authorization-requested",
    "authorization-signed",
    "transaction-requested",
    "mint-error",
    "authorization-canceled",
    "mint-canceled",
    "network-switch",
  ]) {
    assert.match(
      thoughtMain,
      new RegExp(`mintAttemptConsoleEventId\\(\\s*[\\x60"]${kind}`),
      `${kind} must not collide with a prior page-load counter`,
    );
  }
  assert.match(
    thoughtMain,
    /mintAttemptConsoleEventId\(\s*`path-acquisition-\$\{canceled \? "canceled" : "failed"\}`/,
  );
  assert.doesNotMatch(
    thoughtMain,
    /eventId: `(?:authorization-requested|authorization-signed|transaction-requested|mint-error|authorization-canceled|mint-canceled|network-switch):\$\{/,
  );
});

test("every canceled THOUGHT wallet request records its terminal outcome", () => {
  const errorStart = thoughtMain.indexOf("const setMintFlowError =");
  const errorEnd = thoughtMain.indexOf("const hiddenMintSheetAction =", errorStart);
  const errorBody = thoughtMain.slice(errorStart, errorEnd);
  assert.ok(errorStart >= 0 && errorEnd > errorStart);

  assert.match(errorBody, /kind === "signature" && walletRequestCanceled/);
  assert.match(errorBody, /kind: "authorization_canceled"/);
  assert.match(errorBody, /title: `\$\{path\} signature canceled`/);
  assert.match(errorBody, /No signature was created\. No transaction or gas\./);
  assert.match(errorBody, /nextStep: "select “Try again”, or pick another \$PATH"/);
  assert.match(errorBody, /kind === "mint"[\s\S]*?walletRequestCanceled/);
  assert.match(errorBody, /Boolean\(walletState\.txHash \|\| mintFlowData\.txHash\)/);
  assert.match(errorBody, /kind: "transaction_canceled"/);
  assert.match(errorBody, /title: "THOUGHT mint canceled"/);
  assert.match(errorBody, /No transaction was submitted, and \$\{path\} was not used\./);
  assert.match(errorBody, /The submitted mint was canceled\. No THOUGHT was created, and \$\{path\} was not used\./);
  assert.match(errorBody, /nextStep: "select “Try again”, or pick another \$PATH"/);
  assert.match(errorBody, /tone: "warning"/);

  const connectStart = thoughtMain.indexOf("const walletConnectionConsoleFailure =");
  const connectEnd = thoughtMain.indexOf("const requestWalletConnect =", connectStart);
  const connectBody = thoughtMain.slice(connectStart, connectEnd);
  assert.match(connectBody, /kind: "wallet_connection_canceled"/);
  assert.match(connectBody, /title: "wallet connection canceled"/);
  assert.match(connectBody, /detail: "No account access was granted\."/);
  assert.match(connectBody, /nextStep: "select “Connect wallet” when ready"/);

  const switchStart = thoughtMain.indexOf("const recordWalletNetworkSwitchFailure =");
  const switchEnd = thoughtMain.indexOf("const disconnectThoughtDockWallet =", switchStart);
  const switchBody = thoughtMain.slice(switchStart, switchEnd);
  assert.match(switchBody, /kind: canceled \? "network_switch_canceled" : "network_switch_failed"/);
  assert.match(switchBody, /title: canceled \? "network switch canceled" : "network switch failed"/);
  assert.match(switchBody, /The wallet network did not change\./);
  assert.match(switchBody, /nextStep: "select “Switch network” when ready"/);
  assert.match(
    switchBody,
    /const shouldRegisterOrRepair =[\s\S]*?errorCode === 4902[\s\S]*?IS_LOCAL_CONTRACT_INTEGRATION[\s\S]*?errorCategory !== "wallet_rejected"[\s\S]*?errorCategory !== "wallet_busy"/,
    "local switch failures may repair a stale LAN RPC without retrying canceled or busy requests",
  );
  assert.match(
    switchBody,
    /await requestThoughtWalletChainRegistration\(ethereum\);[\s\S]*?await requestThoughtWalletChainSwitch\(ethereum\);[\s\S]*?catch \(repairError\)[\s\S]*?recordWalletNetworkSwitchFailure\(repairError, requestId\)/,
    "adding or refreshing the chain must be followed by an explicit switch and retained failure",
  );
  assert.match(
    switchBody,
    /await refreshWalletState\(\);[\s\S]*?walletState\.chainId !== THOUGHT_CHAIN_ID[\s\S]*?recordWalletNetworkSwitchFailure/,
    "switch success must be verified from the wallet's live chain",
  );

  const pathStart = thoughtMain.indexOf("const setPathAcquisitionError =");
  const pathEnd = thoughtMain.indexOf("const handleMintPath =", pathStart);
  const pathBody = thoughtMain.slice(pathStart, pathEnd);
  assert.match(pathBody, /failure\.title === "\$PATH mint canceled"/);
  assert.match(pathBody, /kind: canceled \? "path_acquisition_canceled" : "path_acquisition_failed"/);
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
  assert.doesNotMatch(thoughtMain, /thoughtConsoleNextStepForPresentation\(presentation\)/);
  assert.match(
    thoughtMain,
    /const rejectInvalidThoughtDockPrompt = \(prompt: string\)[\s\S]*?measureThoughtV2TerminalLine\(prompt, "prompt"\)/,
  );
  assert.match(thoughtMain, /describeThoughtTextPolicyIssue\(\{[\s\S]*?value: prompt,[\s\S]*?line: "prompt"/);
  assert.match(thoughtTextPolicy, /\? "leading space"[\s\S]*?: "trailing space"/);
  assert.match(thoughtTextPolicy, /ends with a space/);
  assert.match(
    thoughtTextPolicy,
    /title: "extra spaces",[\s\S]*?has more than one space together[\s\S]*?delete the extra space/,
  );
  assert.doesNotMatch(thoughtTextPolicy, /title: "text invalid"/);
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

test("Console keeps the newest time group at the top and promotes guidance within it", () => {
  assert.match(
    thoughtConsole,
    /export const newestFirstThoughtConsoleEntries = \([\s\S]*?if \(currentGroup\?\.at\(-1\)\?\.time === entry\.time\) \{[\s\S]*?return timeGroups\.reverse\(\)\.flatMap\(\(group\) => \{[\s\S]*?thoughtConsoleVisualRole\(entry\) === "guidance"[\s\S]*?return \[\.\.\.guidance\.reverse\(\), \.\.\.standard\.reverse\(\)\];/,
  );
  assert.match(
    thoughtMain,
    /const entries = newestFirstThoughtConsoleEntries\(thoughtConsoleHistory\.entries\)\s*\.map\(withCurrentThoughtNetworkName\)\s*\.map\(\(entry\) => \{/,
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
  assert.match(
    thoughtMain,
    /\$PATH was minted to \$\{shortHex\(confirmedReturn\.account\)\}; select that account in your wallet to use it for this THOUGHT work\./,
  );
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

test("Agent launch errors keep their actionable message in Console", () => {
  const prepareStart = thoughtMain.indexOf("const prepareThoughtDockRun = async");
  const prepareEnd = thoughtMain.indexOf("const launchPreparedThoughtDockAdapter =", prepareStart);
  const prepareBody = thoughtMain.slice(prepareStart, prepareEnd);

  assert.match(prepareBody, /setThoughtDockState\(\{ kind: "failed", message \}\)/);
  assert.doesNotMatch(prepareBody, /details:\s*"Try again\."/);
});

test("Agent selection seals and launches one run without a second Open Agent action", () => {
  const selectStart = thoughtMain.indexOf("const openThoughtDockAgentSelect = () =>");
  const prepareStart = thoughtMain.indexOf("const prepareThoughtDockRun = async", selectStart);
  const prepareEnd = thoughtMain.indexOf("const launchPreparedThoughtDockAdapter =", prepareStart);
  const selectBody = thoughtMain.slice(selectStart, prepareStart);
  const prepareBody = thoughtMain.slice(prepareStart, prepareEnd);
  const runStart = prepareEnd;
  const runEnd = thoughtMain.indexOf("const updateThoughtDockRunState =", runStart);
  const runBody = thoughtMain.slice(runStart, runEnd);

  assert.match(selectBody, /setThoughtDockState\(\{ kind: "agent_select", prompt \}\)/);
  assert.match(prepareBody, /const payload = await buildThoughtDockRunPayload\(prompt\)/);
  assert.match(
    prepareBody,
    /const payload = await buildThoughtDockRunPayload\(prompt\);[\s\S]*?const run = await createThoughtDockRun\(prompt, payload, adapterId, surface\)/,
  );
  assert.match(
    prepareBody,
    /launchPreparedThoughtDockAdapter\(\{[\s\S]*?run,[\s\S]*?adapterId,[\s\S]*?payload,[\s\S]*?runSessionId/,
    "the selected Agent must launch automatically after the run is sealed",
  );
  assert.doesNotMatch(prepareBody, /kind: "agent_task_ready"/);
  assert.match(
    thoughtMain,
    /requestedAgent:\s*\{\s*adapterId,\s*model: null,/,
    "the backend run is bound to the selected adapter before launch",
  );
  assert.doesNotMatch(
    runBody,
    /\bawait\b/,
    "the direct Agent-button handler must not lose browser activation to asynchronous work",
  );
  assert.match(
    runBody,
    /launchThoughtDockAgentLink\(thoughtDockLaunchUrl\(run\)\)/,
  );
  assert.match(runBody, /launchedThoughtDockRunIds\.has\(run\.runId\)/);
  assert.match(runBody, /launchedThoughtDockRunIds\.add\(run\.runId\)/);
  assert.ok(
    runBody.indexOf("launchThoughtDockAgentLink") < runBody.indexOf("storeThoughtDockRun"),
    "the custom-protocol navigation must be the first launch side effect",
  );
  assert.match(runBody, /storeThoughtDockRun\(run, adapterId\)/);
  assert.match(runBody, /startThoughtDockPolling\(run, payload, adapterId, runSessionId\)/);
  const railStart = thoughtMain.indexOf("const getThoughtDockRailView =");
  const waitingRailStart = thoughtMain.indexOf('case "waiting_for_agent":', railStart);
  const waitingRailEnd = thoughtMain.indexOf('case "agent_returned":', waitingRailStart);
  const waitingRailBody = thoughtMain.slice(waitingRailStart, waitingRailEnd);
  assert.match(waitingRailBody, /actions: \[resetAction\(state\.run\)\]/);
  assert.doesNotMatch(
    waitingRailBody,
    /thoughtDockLaunchUrl|launchThoughtDockAgentLink|open-\$\{state\.adapterId\}/,
    "an active run must not expose a speculative Agent relaunch control",
  );
  assert.doesNotMatch(thoughtMain, /case "agent_task_ready":/);
  assert.doesNotMatch(thoughtMain, /`open \$\{state\.adapterId\}`/);
  assert.match(thoughtMain, /const THOUGHT_DOCK_PENDING_LAUNCH_KEY = "thought:dock:pending-agent-launch:v1"/);
  assert.match(thoughtMain, /const writeStoredThoughtDockLaunch = \(run: AgentDemoRun\)[\s\S]*?sealedTask: run\.sealedTask/);
  assert.match(
    thoughtMain,
    /const thoughtDockRunFromStored = \(stored: StoredThoughtDockRun\)[\s\S]*?const launch = readStoredThoughtDockLaunch\(stored\.runId\)[\s\S]*?const sealedTask = launch\?\.sealedTask \?\? null[\s\S]*?codexUrl: sealedTask \? buildCodexAgentUrl\(sealedTask\) : "#"/,
    "a same-tab refresh must retain the original sealed Agent task while the run resumes",
  );
  assert.doesNotMatch(
    thoughtMain,
    /const sealedTask = response\.request\?\.agentInput\?\.text/,
    "the raw prompt returned as Agent input must never be mistaken for the sealed Agent task",
  );
  assert.doesNotMatch(thoughtMain, /reserveThoughtDockAgentLaunch/);
  assert.doesNotMatch(`${prepareBody}\n${runBody}`, /about:blank/);
  assert.doesNotMatch(thoughtMain, /THOUGHT_AGENT_FIXTURE_MODE|runThoughtDockFixtureAdapter|local dev Agent bypass/);
  assert.match(
    thoughtMain,
    /const agentDemoSha256 = \(value: string\): ThoughtSha256 =>\s*`\$\{THOUGHT_SHA256_PREFIX\}\$\{sha256\(toUtf8Bytes\(value\)\)\.slice\(2\)\}`/,
    "LAN HTTP must use the synchronous ethers SHA-256 implementation instead of secure-context-only crypto.subtle",
  );
  assert.doesNotMatch(
    thoughtMain,
    /\bsha256Hex\b/,
    "the browser run path must not depend on WebCrypto subtle, which is unavailable on LAN HTTP",
  );
});

test("Agent retry is a Console-only control gated by terminal evidence", () => {
  const recordStart = thoughtMain.indexOf("const recordThoughtDockConsoleTransition =");
  const recordEnd = thoughtMain.indexOf("const thoughtDockRunFromStored", recordStart);
  const recordBody = thoughtMain.slice(recordStart, recordEnd);
  const waitingStart = recordBody.indexOf('state.kind === "waiting_for_agent"');
  const waitingEnd = recordBody.indexOf('state.kind === "creating_run"', waitingStart);
  const waitingBody = recordBody.slice(waitingStart, waitingEnd);

  assert.doesNotMatch(waitingBody, /canReopen|open \$\{product\}|thoughtDockLaunchUrl/);
  assert.match(
    waitingBody,
    /state\.run\.remoteState === "created"[\s\S]*?keep this page open while \$\{product\} connects/,
  );
  assert.match(
    recordBody,
    /kind: state\.confirmedRunFailure \? "work_run_failed" : "work_failed"/,
  );
  assert.match(
    thoughtMain,
    /remoteState === "failed" \|\| remoteState === "cancelled"[\s\S]*?confirmedRunFailure: true/,
    "a polled terminal response must explicitly authorize fresh-run recovery",
  );
  assert.match(
    thoughtMain,
    /status\.state === "failed" \|\| status\.state === "cancelled"[\s\S]*?confirmedRunFailure: true/,
    "an authenticated terminal run page must explicitly authorize fresh-run recovery",
  );
  assert.match(
    thoughtMain,
    /const thoughtConsoleRunRecoveryAvailable =[\s\S]*?entry\.kind === "work_run_expired" && state\.kind === "expired"[\s\S]*?entry\.kind === "work_run_failed"[\s\S]*?state\.confirmedRunFailure === true/,
  );
  assert.match(
    thoughtMain,
    /const retryThoughtDockAgentRunFromConsole =[\s\S]*?if \(!recoveryConfirmed \|\| !resetThoughtDock\(\)\) return;[\s\S]*?void openThoughtDockAgentSelect\(\)/,
    "Console recovery must discard terminal state and prepare a fresh run id",
  );
  assert.match(
    thoughtMain,
    /action\.className =[\s\S]*?thought-dock-status-screen__action[\s\S]*?action\.textContent = "\[ try again \]";[\s\S]*?action\.setAttribute\("aria-label", "start a new Agent run"\)/,
  );
  assert.match(ruleBody(".thought-dock-status-screen__action"), /background:\s*transparent/);
  assert.match(ruleBody(".thought-dock-status-screen__action"), /font:\s*inherit/);
});

test("Agent launch uses direct data-only protocol calls without a client binding", () => {
  assert.doesNotMatch(thoughtMain, /resolveThoughtAgentClientBinding/);
  assert.doesNotMatch(
    thoughtMain,
    /if \(!run\.clientUrl \|\| !run\.clientSha256\)/,
    "a compatibility client artifact must not gate direct protocol task creation",
  );
  assert.match(
    thoughtMain,
    /const buildTask = adapterId === "claude"[\s\S]*?buildThoughtClaudeTask[\s\S]*?: buildThoughtCodexTask;[\s\S]*?return buildTask\(\{[\s\S]*?runUrl: absoluteStatusUrl,[\s\S]*?launchToken: run\.launchToken/,
    "the sealed Agent task must bind direct calls to the exact run URL and one-time token",
  );
  assert.match(thoughtMain, /const thoughtDockLaunchUrl = \(run: AgentDemoRun\) =>\s*run\.surface === "codex" \? run\.codexUrl : run\.claudeUrl/);
});

test("Claude gates Cowork on public HTTPS and keeps Code explicit", () => {
  assert.match(thoughtMain, /const CLAUDE_COWORK_AGENT_ROUTE = "claude:\/\/cowork\/new"/);
  assert.match(thoughtMain, /const CLAUDE_CODE_AGENT_ROUTE = "claude:\/\/code\/new"/);
  assert.match(
    thoughtMain,
    /id: "claude",[\s\S]*?label: "Claude",[\s\S]*?defaultSurface: "claude-cowork"/,
  );
  assert.match(
    thoughtMain,
    /const claudeCoworkQualifiedForCurrentOrigin = \(\) =>[\s\S]*?isThoughtClaudeCoworkPublicHttpsOrigin\(thoughtDockAgentPublicApiOrigin\(\)\)[\s\S]*?IS_DEV_MODE[\s\S]*?IS_PREVIEW_DEPLOYMENT[\s\S]*?THOUGHT_CLAUDE_COWORK_QUALIFICATION\.qualified === true/,
  );
  assert.match(
    thoughtMain,
    /if \(adapterId === "claude"\) \{[\s\S]*?claudeCoworkQualifiedForCurrentOrigin\(\)[\s\S]*?"claude-cowork"[\s\S]*?: "claude-code"/,
  );
  assert.match(thoughtClaudeCoworkQualification, /qualified: false/);
  assert.match(
    thoughtClaudeCoworkQualification,
    /Awaiting a successful public-HTTPS Claude Cowork canary/,
  );
  assert.doesNotMatch(thoughtMain, /shouldRecoverClaudeInCode|recoverInClaudeCode/);
  assert.match(
    thoughtMain,
    /const createThoughtDockRun = async[\s\S]*?surface: ThoughtDockAgentSurface[\s\S]*?requestedAgent: \{\s*adapterId,[\s\S]*?client: \{\s*surface: surface === "codex" \? "thought-dock" : `thought-dock:\$\{surface\}`/,
  );
});

test("saved Agent handoffs carry and verify an integrity digest without becoming a trust root", () => {
  assert.match(
    thoughtMain,
    /const thoughtAgentHandoffSha256 = \(sealedTask: string\): ThoughtSha256 =>[\s\S]*?sha256\(toUtf8Bytes\(sealedTask\)\)/,
  );
  assert.match(
    thoughtMain,
    /sealedTask: run\.sealedTask,\s*handoffSha256: run\.handoffSha256/,
  );
  assert.match(
    thoughtMain,
    /thoughtAgentHandoffSha256\(sealedTask\) !== handoffSha256[\s\S]*?stored Agent handoff digest mismatch/,
  );
  assert.match(
    thoughtMain,
    /appAcceptedAndBound !== true \|\| providerAttested !== false[\s\S]*?Agent result trust evidence is incomplete/,
    "the App accepts a returned run without misrepresenting it as provider-signed authorship",
  );
});

test("Agent readiness is an internal checkpoint that continues automatically", () => {
  assert.match(
    thoughtMain,
    /case "ready":\s*return `\$\{product\} creating\.\.\.`/,
  );
  assert.match(
    thoughtMain,
    /const controlVerified = state\.run\.remoteState === "ready";[\s\S]*?detail: controlVerified[\s\S]*?"Control checks passed\. Creation is continuing automatically\."[\s\S]*?nextStep: `keep this page open while \$\{product\} creates`/,
  );
  assert.match(
    thoughtMain,
    /message: remoteState === "ready"[\s\S]*?`\$\{thoughtAgentProductLabel\(adapterId\)\} passed preflight and is continuing automatically\.`/,
  );
  assert.doesNotMatch(thoughtMain, /Reply CREATE/);
  assert.match(
    thoughtMain,
    /const submitAgentDemoProtocolResult = async[\s\S]*?fetchThoughtAgentJson<Record<string, unknown>>\(run\.readyUrl,[\s\S]*?control: agentDemoControlEvidence\(\)[\s\S]*?fetchThoughtAgentJson<Record<string, unknown>>\(run\.startUrl/,
    "the manual demo callback must pass readiness before opening the creative request",
  );
});

test("Work prompt exposes persistent terminal-style history navigation", () => {
  assert.match(thoughtMain, /THOUGHT_DOCK_PROMPT_HISTORY_KEY = "thought:dock:prompt-history:v1"/);
  assert.match(thoughtMain, /THOUGHT_DOCK_PROMPT_HISTORY_LIMIT = 50/);
  assert.match(
    thoughtMain,
    /const prepareThoughtDockRun = async[\s\S]*?const run = await createThoughtDockRun\(prompt, payload, adapterId, surface\)[\s\S]*?recordThoughtDockPromptHistory\(prompt\)/,
    "only an accepted real Agent run should record its exact prompt",
  );
  assert.match(
    thoughtMain,
    /thoughtDockPrompt\.addEventListener\("keydown"[\s\S]*?event\.key === "ArrowUp" && navigateThoughtDockPrompt\("older"\)[\s\S]*?event\.key === "ArrowDown" && navigateThoughtDockPrompt\("newer"\)/,
  );
  assert.match(indexHtml, /id="thought-dock-prompt"[\s\S]*?title="Up\/Down: prompt history"/);
  assert.match(
    thoughtMain,
    /thoughtDockPrompt\.addEventListener\("input"[\s\S]*?const start = thoughtDockPrompt\.selectionStart;[\s\S]*?const end = thoughtDockPrompt\.selectionEnd;[\s\S]*?applyThoughtDockPromptValue\([\s\S]*?\{\s*start,\s*end,\s*direction: direction \?\? "none"/,
    "typing must preserve the live caret and selection instead of moving them to the prompt end",
  );
  assert.match(
    thoughtMain,
    /if \(selection\) \{[\s\S]*?thoughtDockPrompt\.setSelectionRange\(\s*selection\.start,\s*selection\.end,\s*selection\.direction/,
  );
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
    /revealMintDock\(\);\s*syncThoughtDock\(\);\s*void mintThoughtDockWork\(\)/,
    "the Work Mint CTA starts resolution without writing a premature universal requirement",
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
  assert.match(
    thoughtMain,
    /kind: "work_saved",\s*title: "work saved",\s*detail: "Stored in this browser\. You can load it later\."/,
    "saving a Work tells the creator it can be loaded later",
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
  const resetDockStart = thoughtMain.indexOf("const resetThoughtDock =");
  const resetDockEnd = thoughtMain.indexOf("const resumeThoughtDockPendingRun =", resetDockStart);
  const resetDockBody = thoughtMain.slice(resetDockStart, resetDockEnd);
  assert.match(
    resetDockBody,
    /if \(!resetThought\(\)\) \{\s*return false;\s*\}/,
    "a blocked data reset must not clear the visible Dock",
  );
  assert.match(
    resetDockBody,
    /kind: "work_reset",\s*title: "work reset",[\s\S]*?Prompt, current work, and open panels cleared\./,
    "a successful explicit Reset replaces stale panel guidance with a truthful event",
  );
  assert.match(
    thoughtMain,
    /element\.dataset\.consoleKind = entry\.kind/,
    "rendered console entries expose their semantic kind for browser regressions",
  );
  assert.match(
    thoughtMain,
    /handlerKey: options\?\.handlerKey[\s\S]*?handlerKey: action\.handlerKey \?\? action\.id/,
    "cached Dock buttons include semantic handler identity",
  );

  const handoffRestoreStart = thoughtMain.indexOf("const restorePathMintHandoffWork =");
  const handoffRestoreEnd = thoughtMain.indexOf("const pathTokenIdFromMintReceipt =", handoffRestoreStart);
  assert.match(
    thoughtMain.slice(handoffRestoreStart, handoffRestoreEnd),
    /mintDockRevealed = true;\s*writeCurrentOutputSession\(\)/,
    "returning from same-origin PATH mint keeps the Mint panel revealed",
  );
});

test("opening Mint gives one concise overview before state-specific guidance", () => {
  const openStart = thoughtMain.indexOf("const openMintFlow = async");
  const openEnd = thoughtMain.indexOf("type PathEligibilityResult", openStart);
  const openBody = thoughtMain.slice(openStart, openEnd);
  const attemptOffset = openBody.indexOf(
    'mintAttemptId = options?.attemptId?.trim() || nextMintAttemptId("mint")',
  );
  const overviewOffset = openBody.indexOf('kind: "mint_flow_opened"');

  assert.ok(attemptOffset >= 0 && overviewOffset > attemptOffset);
  assert.match(
    openBody,
    /kind: "mint_flow_opened",\s*title: "to mint this THOUGHT",\s*detail: "Pick a \$PATH, sign for this work, then mint\.",\s*tone: "neutral",\s*eventId: mintAttemptConsoleEventId\("mint-flow-opened"\)/,
  );
  assert.match(
    thoughtConsole,
    /THOUGHT_CONSOLE_GUIDANCE_KINDS = new Set\(\[[\s\S]*?"mint_flow_opened"/,
  );
});

test("a verified preview explains temporary Work storage before mint readiness", () => {
  assert.match(
    thoughtMain,
    /const recordTemporaryThoughtWork = \(work: ThoughtDockWorkView\) => \{[\s\S]*?kind: "work_created_temporarily",\s*title: "the work is created by you",\s*detail: "Stored temporarily\. A new work replaces it; select “save” above to keep it in this browser\.",\s*tone: "neutral"/,
  );

  for (const [startMarker, endMarker] of [
    ["const handleThoughtDockReturnedWork = async", "const formatThoughtDockPreviewError ="],
    ["const retryThoughtDockPreview = async", "const mintThoughtDockWork = async"],
  ]) {
    const start = thoughtMain.indexOf(startMarker);
    const end = thoughtMain.indexOf(endMarker, start);
    const body = thoughtMain.slice(start, end);
    assert.match(
      body,
      /recordTemporaryThoughtWork\(work\);\s*recordCurrentMintConsoleState\(\)/,
      `${startMarker} must insert temporary storage copy before ready-to-mint copy`,
    );
  }
});

test("mint submission and recovery keep one durable hash", () => {
  assert.match(
    thoughtMain,
    /const mintSubmissionLockEnvironment = \(\): MintSubmissionLockEnvironment => \(\{[\s\S]*?allowSamePageFallback:\s*IS_DEV_MODE\s*&&\s*IS_LOCAL_RUNTIME_HOST,/,
    "disposable LAN runtimes must not reject THOUGHT minting solely because plain HTTP lacks Web Locks",
  );

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
  assert.match(thoughtMain, /firstNonceSnapshot[\s\S]*?MINT_RECOVERY_NONCE_RECHECK_MS[\s\S]*?secondNonceSnapshot[\s\S]*?No submitted transaction was found, but the wallet request may still be open/);
  assert.doesNotMatch(
    thoughtMain.slice(
      thoughtMain.indexOf("const recoverUnresolvedMintSubmission = async"),
      thoughtMain.indexOf("const confirmPreviousWalletRequestClosed = async"),
    ),
    /releaseLockAfterRecovery\(\)/,
    "nonce checks alone must not release a wallet request that may still be open",
  );
  assert.match(thoughtMain, /const confirmPreviousWalletRequestClosed = async[\s\S]*?releaseLockAfterRecovery\(\)/);
  assert.match(thoughtMain, /action === "confirm_wallet_request_closed"[\s\S]*?confirmPreviousWalletRequestClosed\(\)/);
  assert.match(thoughtMain, /readPathAcquisitionQuote[\s\S]*?adapterPathNft\.toLowerCase\(\) !== PATH_NFT_ADDRESS\.toLowerCase\(\)/);
  assert.match(thoughtMain, /window\.addEventListener\("storage"[\s\S]*?event\.newValue === null[\s\S]*?return/);
  assert.match(thoughtMain, /const resetThought = [\s\S]*?blockPendingMintMutation\(\) \|\| blockPendingPathAcquisitionMutation\(\)/);
  assert.match(thoughtMain, /const setAgentOutput = [\s\S]*?blockPendingMintMutation\(\) \|\| blockPendingPathAcquisitionMutation\(\)/);
});

test("local App attestation binds selected Agent and runtime-reported Model records", () => {
  assert.match(
    thoughtViteConfig,
    /const selectedAgent =[\s\S]*?authoritativeRun\.requestedAdapterId[\s\S]*?const reportedModel = authoritativeRun\.agent\.model\?\.trim\(\) \|\| "";[\s\S]*?const authoritativeModel = formatThoughtAgentModelLabel\(/,
    "the backend must derive Agent from the selected adapter and Model from returned runtime metadata",
  );
  assert.match(
    thoughtViteConfig,
    /if \(authoritativeModel === "unknown"\)[\s\S]*?"MODEL_METADATA_UNAVAILABLE"/,
    "the backend must fail closed instead of attesting an unknown model",
  );
  assert.match(
    thoughtViteConfig,
    /const authoritativeProcess: ThoughtV2ProcessEvidence = \{[\s\S]*?agent:\s*\{[\s\S]*?label: selectedAgent,[\s\S]*?model:\s*\{[\s\S]*?label: authoritativeModel,[\s\S]*?reference: authoritativeRun\.runId,[\s\S]*?resultEnvelope,/,
  );
  assert.match(
    thoughtViteConfig,
    /buildBackendOnlyMockThoughtV2Mint\(runtime, \{[\s\S]*?process: authoritativeProcess,/,
    "the signed attestation must use the backend-canonical process",
  );
  assert.match(
    thoughtViteConfig,
    /process\.model\.label === authoritativeModel/,
    "the submitted Model record must exactly match the backend's runtime-reported Model record",
  );
  assert.match(
    thoughtMain,
    /mintFlowData\.agent = attestedMint\.agent;[\s\S]*?mintFlowData\.model = attestedMint\.model;/,
    "the final contract payload must carry the neutral records signed by the backend",
  );
  assert.match(
    thoughtMain,
    /agent: payload\.agent,[\s\S]*?model: payload\.model,/,
  );
});

test("console outcomes require the action or async result they describe", () => {
  const promptApplyStart = thoughtMain.indexOf("const applyThoughtDockPromptValue =");
  const promptApplyEnd = thoughtMain.indexOf("const navigateThoughtDockPrompt =", promptApplyStart);
  assert.match(
    thoughtMain.slice(promptApplyStart, promptApplyEnd),
    /if \(!resetMintRuntimeState\(\)\) \{\s*thoughtDockPrompt\.value = sessionState\.prompt;\s*return false;/,
    "prompt history must not mutate the work after a pending-mint warning",
  );

  const claimRailStart = thoughtMain.indexOf('case "claim_authorization":');
  const claimRailEnd = thoughtMain.indexOf('case "waiting_for_agent":', claimRailStart);
  const claimRailBody = thoughtMain.slice(claimRailStart, claimRailEnd);
  assert.match(claimRailBody, /const authorized = state\.authorization\.state === "authorized"/);
  assert.doesNotMatch(claimRailBody, /state === "authorized" \|\| state\.approving/);
  assert.match(claimRailBody, /approving\s*\?\s*`Authorizing \$\{product\}\.\.\.`/);

  const pathReceiptStart = thoughtMain.indexOf("const finishPathAcquisitionReceipt =");
  const pathReceiptEnd = thoughtMain.indexOf("const resumePendingPathAcquisition =", pathReceiptStart);
  const pathReceiptBody = thoughtMain.slice(pathReceiptStart, pathReceiptEnd);
  assert.match(
    pathReceiptBody,
    /pathAcquisitionReceiptMonitorHash !== pending\.txHash/,
    "a canceled receipt monitor cannot append a later success",
  );
  assert.match(pathReceiptBody, /kind: "path_acquisition_inventory_pending"/);
  assert.doesNotMatch(
    pathReceiptBody,
    /setPathAcquisitionError\(\s*available\.length/,
    "a confirmed $PATH must not be relabeled mint unavailable",
  );

  const revertRecoveryStart = thoughtMain.indexOf("const recoverMintStateAfterRevert =");
  const revertRecoveryEnd = thoughtMain.indexOf("const waitForMintReceipt =", revertRecoveryStart);
  const revertRecoveryBody = thoughtMain.slice(revertRecoveryStart, revertRecoveryEnd);
  assert.match(
    revertRecoveryBody,
    /mintFlowState = "text_taken"/,
    "revert recovery must not claim that the locally selected $PATH was used",
  );
});

test("current work verifies THOUGHT uniqueness before PICK and before submission", () => {
  const preflightStart = thoughtMain.indexOf("const preflightCurrentThoughtExistence = async");
  const preflightEnd = thoughtMain.indexOf("const handlePendingTx = async", preflightStart);
  const preflightBody = thoughtMain.slice(preflightStart, preflightEnd);
  assert.ok(preflightStart >= 0 && preflightEnd > preflightStart);
  assert.match(preflightBody, /await verifyLocalThoughtV2Deployment\(\)/);
  assert.match(
    preflightBody,
    /await textHashFromContract\([\s\S]*?checkedText,[\s\S]*?currentRunContext\?\.prompt \?\? sessionState\.prompt,[\s\S]*?\)/,
  );
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
  assert.match(
    thoughtMain.slice(resolvedStateStart, resolvedStateEnd),
    /mintFlowState === "minted"[\s\S]*?kind: "minted"[\s\S]*?tokenId/,
    "a successful mint keeps the success rail even while its token id is resolving",
  );

  const railStart = thoughtMain.indexOf("const getThoughtDockRailView =");
  const railEnd = thoughtMain.indexOf("const shortRunId =", railStart);
  const railBody = thoughtMain.slice(railStart, railEnd);
  const mintedRailStart = railBody.indexOf('case "minted"');
  const mintedRailEnd = railBody.indexOf('case "run_access_needed"', mintedRailStart);
  const mintedRailBody = railBody.slice(mintedRailStart, mintedRailEnd);
  assert.match(mintedRailBody, /dockRailAction\("view", "view"/);
  assert.match(mintedRailBody, /dockRailAction\(\s*"save"/);
  assert.match(mintedRailBody, /loadAction\(\)/);
  assert.match(mintedRailBody, /resetAction\(\)/);
  assert.doesNotMatch(
    mintedRailBody,
    /dockRailAction\("mint"/,
    "terminal work must never offer another mint",
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

test("post-mint View THOUGHT opens the canonical token detail directly", () => {
  assert.match(
    thoughtMain,
    /const handleViewThought = async[\s\S]*?window\.location\.href = thoughtDetailUrl\(thoughtNftId\);/,
  );
  assert.match(
    thoughtMain,
    /const thoughtDetailUrl = \(tokenId: number\) => \{[\s\S]*?url\.pathname = `\/thought\/\$\{tokenId\}`;/,
  );
});

test("minted console identifies the shortened value as a transaction", () => {
  assert.match(
    thoughtMain,
    /` · transaction \$\{shortHex\(walletState\.txHash \|\| mintFlowData\.txHash, 10, 8\)\}`/,
  );
  assert.match(
    thoughtMain,
    /transactionHash: walletState\.txHash \|\| mintFlowData\.txHash/,
  );
  assert.match(
    thoughtMain,
    /const transactionUrl = transactionHash \? thoughtTxUrl\(transactionHash\) : "";/,
  );
  assert.match(thoughtMain, /link\.textContent = `\$\{shortTransactionHash\} ↗`;/);
  assert.match(thoughtMain, /link\.target = "_blank";/);
  assert.match(thoughtMain, /link\.rel = "noopener noreferrer";/);
});

test("creation links reset minted work but resume unfinished creation state", () => {
  assert.match(
    thoughtMain,
    /const IS_FRESH_CREATION_ENTRY = ROUTE_SEARCH_PARAMS\.get\("new"\) === "1";/,
  );
  assert.match(
    thoughtMain,
    /const thoughtCreateUrl = \(\) => \{[\s\S]*?url\.searchParams\.set\("new", "1"\);/,
  );
  assert.match(
    thoughtMain,
    /const beginFreshThoughtCreation = \(\) => \{[\s\S]*?if \(!resetThought\(\)\) \{\s*return false;[\s\S]*?sessionState\.prompt = "";[\s\S]*?setThoughtDockState\(\{ kind: "empty" \}\);/,
  );
  assert.match(
    thoughtMain,
    /const consumeFreshCreationEntryUrl = \(\) => \{[\s\S]*?url\.searchParams\.delete\("new"\);[\s\S]*?window\.history\.replaceState/,
  );
  assert.match(
    thoughtMain,
    /const currentOutputSessionIsMinted = async \(\) => \{[\s\S]*?const stored = readCurrentOutputSession\(\);[\s\S]*?lookupExistingThoughtToken\(token, identityHash\)[\s\S]*?Only a proven mint resets it\./,
  );
  assert.match(
    thoughtMain,
    /const openedFreshCreation =\s*IS_FRESH_CREATION_ENTRY &&\s*await currentOutputSessionIsMinted\(\) &&\s*beginFreshThoughtCreation\(\);\s*if \(!openedFreshCreation\) \{\s*resetThought\(\{ preserveStoredOutput: true \}\);\s*restoreCurrentOutputSession\(\);\s*restoreCurrentCandidateSession\(\);/,
  );
  assert.match(
    thoughtMain,
    /if \(IS_FRESH_CREATION_ENTRY\) \{\s*consumeFreshCreationEntryUrl\(\);\s*\}/,
  );
});

test("unminted creation state stays in its originating tab session", () => {
  const privateStorageStart = thoughtMain.indexOf(
    "const readPrivateCreationSessionItem =",
  );
  const privateStorageEnd = thoughtMain.indexOf(
    "const readPendingPathAcquisition =",
    privateStorageStart,
  );
  const privateStorageBody = thoughtMain.slice(privateStorageStart, privateStorageEnd);
  assert.ok(privateStorageStart >= 0 && privateStorageEnd > privateStorageStart);
  assert.match(
    privateStorageBody,
    /safeStorageRemove\(getStorageOrNull\(\(\) => window\.localStorage\), key\)/,
    "legacy localStorage drafts are discarded",
  );
  assert.match(privateStorageBody, /safeStorageGet\(getSessionStorage\(\), key\)/);
  assert.match(privateStorageBody, /safeStorageSet\(getSessionStorage\(\), key, value\)/);

  for (const [startMarker, endMarker, key] of [
    ["const readStoredThoughtDockRun =", "const readStoredThoughtDockLaunch =", "THOUGHT_DOCK_PENDING_RUN_KEY"],
    ["const readPendingThoughtAgentRun =", "const isRouteConfigured =", "THOUGHT_AGENT_PENDING_RUN_STORAGE_KEY"],
    ["const writeCurrentCandidateSession =", "const restoreCurrentCandidateSession =", "THOUGHT_CURRENT_CANDIDATE_STORAGE_KEY"],
    ["const readCurrentOutputSession =", "const restoreCurrentOutputSession =", "THOUGHT_OUTPUT_STORAGE_KEY"],
  ]) {
    const start = thoughtMain.indexOf(startMarker);
    const end = thoughtMain.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} test slice exists`);
    const body = thoughtMain.slice(start, end);
    assert.match(body, new RegExp(`PrivateCreationSessionItem\\(${key}`));
    assert.doesNotMatch(body, new RegExp(`SharedBrowserItem\\(${key}`));
  }

  const storedSessionTypeStart = thoughtMain.indexOf("type StoredThoughtSessionState =");
  const storedSessionTypeEnd = thoughtMain.indexOf("type EvmAddresses =", storedSessionTypeStart);
  const storedSessionType = thoughtMain.slice(storedSessionTypeStart, storedSessionTypeEnd);
  assert.match(storedSessionType, /version: 2/);
  assert.doesNotMatch(storedSessionType, /prompt:/);

  const serializeStart = thoughtMain.indexOf("const serializeSessionState =");
  const serializeEnd = thoughtMain.indexOf("const mergeStoredSessionState =", serializeStart);
  assert.doesNotMatch(thoughtMain.slice(serializeStart, serializeEnd), /prompt:/);
  assert.match(
    thoughtMain,
    /fallback\.prompt = readPrivateCreationSessionItem\(THOUGHT_PROMPT_SESSION_STORAGE_KEY\) \?\? ""/,
  );
  assert.match(
    thoughtMain,
    /writePrivateCreationSessionItem\(THOUGHT_PROMPT_SESSION_STORAGE_KEY, sessionState\.prompt\)/,
  );

  assert.match(
    thoughtMain,
    /const thoughtBrowserStorage: WorkStorage = \{\s*getItem: readSharedBrowserItem,\s*setItem: writeSharedBrowserItem,\s*removeItem: removeSharedBrowserItem,\s*\}/,
    "explicitly saved works remain browser-persistent",
  );
  assert.match(
    thoughtMain,
    /const recordCurrentWork = \(rawOutput: string\) => \{[\s\S]*?writeStoredThoughtWorks\(result\.works\)/,
  );
});

test("terminal THOUGHT state survives wallet and $PATH refresh side effects", () => {
  assert.match(
    thoughtMain,
    /const isTerminalMintFlowState = \(state: MintFlowState\) =>\s*state === "text_taken" \|\| state === "minted"/,
  );

  for (const [startMarker, endMarker] of [
    ["const mintThoughtDockWork = async", "const connectThoughtDockWallet = async"],
    ["const syncMintFlowAfterWalletCommand =", "const runThoughtDockWalletCommand ="],
    ["const setMintFlowError =", "const hiddenMintSheetAction ="],
    ["const refreshWalletState = async", "async function refreshThoughtWalletFromShell"],
    ["const disconnectThoughtDockWallet =", "const refreshWalletChainRpc ="],
    ["const openMintFlow = async", "type PathEligibilityResult"],
    ["const checkPathEligibility = async", "const authorizeMint = async"],
    ["const authorizeMint = async", "type MintTransactionResponse"],
    ["const confirmMint = async", "const readPathAcquisitionQuote"],
    ["const handleMintPath = async", "const finishPathAcquisitionReceipt = async"],
    ["const confirmPathAcquisition = async", "const viewPathAcquisitionTx = async"],
    ["const chooseAnotherPath =", "const handleMintSheetAction = async"],
    ["const handleMintSheetAction = async", "const handleViewTx = async"],
  ]) {
    const start = thoughtMain.indexOf(startMarker);
    const end = thoughtMain.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `${startMarker} test slice exists`);
    assert.match(
      thoughtMain.slice(start, end),
      /isTerminalMintFlowState\(mintFlowState\)/,
      `${startMarker} preserves terminal mint state`,
    );
  }

  const inventoryStart = thoughtMain.indexOf("const refreshPathInventoryForCurrentWallet = async");
  const inventoryEnd = thoughtMain.indexOf(
    "const moveMintFlowToWalletOrPathSelection =",
    inventoryStart,
  );
  const inventoryBody = thoughtMain.slice(inventoryStart, inventoryEnd);
  assert.match(
    inventoryBody,
    /availableItems\.length === 0 && !isTerminalMintFlowState\(mintFlowState\)/,
  );
  assert.match(
    inventoryBody,
    /pathAcquisitionState === "idle" && mintFlowState === "path_required"[\s\S]*?handleMintPath\(\)/,
    "wallet refresh may open $PATH acquisition only during the active PICK step",
  );

  const pathReceiptStart = thoughtMain.indexOf("const finishPathAcquisitionReceipt = async");
  const pathReceiptEnd = thoughtMain.indexOf(
    "const monitorPendingPathAcquisition = async",
    pathReceiptStart,
  );
  assert.match(
    thoughtMain.slice(pathReceiptStart, pathReceiptEnd),
    /await refreshPathInventoryForCurrentWallet\(\{ force: true \}\);[\s\S]*?isTerminalMintFlowState\(mintFlowState\)[\s\S]*?return true;[\s\S]*?applyMintPathInputValue/,
    "a late $PATH receipt cannot reopen selection after THOUGHT resolves",
  );

  const shellRefreshStart = thoughtMain.indexOf("async function refreshThoughtWalletFromShell");
  const shellRefreshEnd = thoughtMain.indexOf("const bindThoughtShellWallet =", shellRefreshStart);
  assert.match(
    thoughtMain.slice(shellRefreshStart, shellRefreshEnd),
    /isTerminalMintFlowState\(mintFlowState\)[\s\S]*?syncInterface\(\);[\s\S]*?return;/,
    "shell refresh stops before stale PATH handoff recovery after terminal resolution",
  );
});

test("PICK can acquire the exact V2 $PATH without leaving THOUGHT", () => {
  assert.match(
    thoughtMintPresentation,
    /state === "review"[\s\S]*?const mintLabel = `Mint \$PATH for[\s\S]*?Select “\$\{mintLabel\}” above to mint the \$PATH required for this THOUGHT work\.[\s\S]*?confirm_path_mint/,
  );
  assert.match(thoughtMintPresentation, /consoleNextStep: "mint here, or explore \$PATH at \/path"/);
  assert.doesNotMatch(thoughtMintPresentation, /action\("explore_path"/);
  assert.match(thoughtMain, /availableItems\.length === 0[\s\S]*?pathAcquisitionState === "idle"[\s\S]*?handleMintPath\(\)/);
  assert.match(thoughtMain, /action === "mint_path"[\s\S]*?handleMintPath\(\{ submit: true \}\)/);
  assert.match(thoughtMain, /const readPathAcquisitionQuote = async[\s\S]*?auction\.mintAdapter\(\)[\s\S]*?adapter\.pathNft\(\)[\s\S]*?wiringFrozen/);
  assert.match(thoughtMain, /walletAuction\.getCurrentPrice\(\)[\s\S]*?auction\.bid\.estimateGas\(executionPrice[\s\S]*?thoughtPathAcquisitionGasLimit\(estimatedGas\)[\s\S]*?auction\.bid\(executionPrice/);
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

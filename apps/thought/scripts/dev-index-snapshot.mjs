import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyCurrentThoughtLaunchMainDeltas } from "./thought-launch-main-deltas.generated.mjs";

export const THOUGHT_DEV_SNAPSHOT_QUERY_PARAM = "inshell-thought-dev-snapshot";
export const THOUGHT_DEV_SNAPSHOT_QUERY_VALUE = "da998e1";

export const THOUGHT_DEV_INDEX_SNAPSHOT = Object.freeze({
  tag: "thought-app-e2e-integration-20260810-r1",
  tagCommit: "da998e1145d20b4a7301aaa61748c68fbc91a2e1",
  immutableDeployment: "https://9f8ac359.inshell-art.pages.dev/thought/",
  securityHardenedPreviewCommit: "bdd9640f7a2969b3b7a27a1c81c11a0b94df4b4f",
  indexBlob: "ac5a07c18176a6e8e05984e30840c1925e3149b9",
  indexSha256: "e991fe996e1732aca3ec6d9f77a9cac73609505ba29128c7892afabaa9908164",
  mainBlob: "0366396bcfaac34b1ad770b37a6cb8e117ff4406",
  mainSha256: "bb8424109fb12bd980014e942114a507d8629ff027d8b271a5e73d4168a8972f",
  styleBlob: "5d5448e8766bf4f32d1867e1534ce73797465de5",
  styleSha256: "950156fb82ff9d4449dfb03e914445eeeace10de0796361108e29e5637a48cf1",
});

const SNAPSHOT_FILES = Object.freeze({
  main: Object.freeze({
    path: "apps/thought/src/main.ts",
    blob: THOUGHT_DEV_INDEX_SNAPSHOT.mainBlob,
    sha256: THOUGHT_DEV_INDEX_SNAPSHOT.mainSha256,
  }),
  style: Object.freeze({
    path: "apps/thought/src/style.css",
    blob: THOUGHT_DEV_INDEX_SNAPSHOT.styleBlob,
    sha256: THOUGHT_DEV_INDEX_SNAPSHOT.styleSha256,
  }),
});

const TAGGED_NAVIGATION_SCOPE = `const INSHELL_HOME_URL =
  readConfiguredUrl("VITE_INSHELL_HOME_URL") || INSHELL_LINKS.home;
const PATH_VERIFY_CONTRACTS_URL = new URL("/verify#verify-contracts", PATH_MINT_ABSOLUTE_URL).toString();
const GALLERY_URL = INSHELL_HOME_URL;
const THOUGHT_APP_URL =
  (!IS_LOCAL_RUNTIME_HOST && readConfiguredUrl("VITE_THOUGHT_URL")) ||
  INSHELL_LINKS.thought;
const defaultThoughtDetailBaseUrl = () => {
  return new URL("/thought", INSHELL_HOME_URL).toString();
};`;

const CURRENT_NAVIGATION_SCOPE = `const INSHELL_HOME_URL = INSHELL_LINKS.home;
const PATH_VERIFY_CONTRACTS_URL = new URL("/verify#verify-contracts", PATH_MINT_ABSOLUTE_URL).toString();
const GALLERY_URL =
  (!IS_LOCAL_RUNTIME_HOST &&
    (readConfiguredUrl("VITE_GALLERY_URL") ||
      readConfiguredUrl("VITE_THOUGHT_GALLERY_URL"))) ||
  INSHELL_LINKS.works;
const THOUGHT_APP_URL =
  (!IS_LOCAL_RUNTIME_HOST && readConfiguredUrl("VITE_THOUGHT_URL")) ||
  INSHELL_LINKS.thought;
const defaultThoughtDetailBaseUrl = () => {
  return INSHELL_LINKS.thought;
};`;

const TAGGED_GALLERY_REDIRECT = `  if (IS_GALLERY_PAGE) {
    window.location.replace(galleryUrl(GALLERY_TARGET_TOKEN_ID));
    return;
  }`;

const CURRENT_GALLERY_REDIRECT = `  if (IS_GALLERY_PAGE && (!IS_GALLERY_PATH || IS_GALLERY_HOST)) {
    window.location.replace(galleryUrl(GALLERY_TARGET_TOKEN_ID));
    return;
  }`;

const CURRENT_GALLERY_RENDER = `  if (IS_GALLERY_PAGE) {
    frontpageStage.classList.add("is-hidden");
    galleryPage.classList.remove("is-hidden");
    thoughtPage.classList.add("is-hidden");
    agentDemoPage.classList.add("is-hidden");
    pluginPage.classList.add("is-hidden");
    colorFontPage.classList.add("is-hidden");
    verifyPage.classList.add("is-hidden");
    await loadThoughtGallery();
    return;
  }

`;

const TAGGED_THOUGHT_RENDER_MARKER = `  if (IS_THOUGHT_PAGE) {
    frontpageStage.classList.add("is-hidden");`;

const POST_SNAPSHOT_SURFACE_ROUTER = `      const requestedSurface = params.get("surface");
      const useDevAgentDefault =
        requestedSurface === null &&
        globalThis.__INSHELL_THOUGHT_DEV_DEFAULT_SURFACE__ === "agent";
      const isCliSurface =
        params.get("debug") === "cli" ||
        requestedSurface === "cli" ||
        (requestedSurface !== "agent" && !useDevAgentDefault);
      document.documentElement.classList.add(isCliSurface ? "cli-surface" : "agent-surface");
`;

const POST_SNAPSHOT_SURFACE_NAV = `        <nav class="thought-create__links" aria-label="THOUGHT creation surfaces">
          <a href="/thought?surface=cli">[ cli ]</a>
          <a href="/thought?surface=agent">[ Agent ]</a>
          <a href="/thought/verify">[ verify ]</a>
        </nav>
`;

const POST_SNAPSHOT_CLI_TITLE =
  `          <h1 class="frontpage-title thought-cli-title">THOUGHT</h1>\n`;

const TAGGED_DETAIL_TITLE = `        <div>
          <h1 id="thought-detail-title" class="thought-detail__title">THOUGHT #<span id="thought-detail-token-id">-</span></h1>
        </div>`;

const CURRENT_DETAIL_TITLE = `        <h1 id="thought-detail-title" class="thought-detail__title">THOUGHT #<span id="thought-detail-token-id">-</span></h1>`;

const TAGGED_DETAIL_HOME_LINK = `          <a id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/gallery">[ gallery ]</a>`;

const CURRENT_DETAIL_HOME_LINK = `          <a id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/">[ Home ]</a>`;

const TAGGED_GALLERY_CREATE_LINK = `        <a id="gallery-create-link" class="thought-gallery__create" href="/thought">create your THOUGHT</a>`;

const CURRENT_GALLERY_CREATE_LINK = `        <a id="gallery-create-link" class="thought-gallery__create" href="/thought">Create the first THOUGHT</a>`;

const TAGGED_GALLERY_HOME_LINK = `        <a id="gallery-home-link" class="thought-gallery__home" href="https://inshell.art/">[ home ]</a>`;

const CURRENT_GALLERY_HOME_LINK = `        <a id="gallery-home-link" class="thought-gallery__home" href="https://inshell.art/">[ Home ]</a>`;

const TAGGED_DETAIL_CREATE_LINK = `          <a id="thought-detail-create-link" class="thought-detail__link" href="/thought">[ create yours ]</a>`;

const CURRENT_DETAIL_CREATE_LINK = `          <a id="thought-detail-create-link" class="thought-detail__link" href="/thought">[ Create yours ]</a>`;

const TAGGED_DETAIL_HOME_CONFIGURATION = `const inshellHomeUrl = () => INSHELL_HOME_URL;
const configureGalleryLink = () => {
  thoughtGalleryLink.href = galleryUrl();
  thoughtDetailGalleryLink.href = galleryUrl();`;

const CURRENT_DETAIL_HOME_CONFIGURATION = `const inshellHomeUrl = (targetTokenId?: number | null) => {
  const url = new URL(INSHELL_HOME_URL, window.location.origin);
  url.search = "";
  url.hash = "";
  if (targetTokenId !== null && targetTokenId !== undefined) {
    url.hash = \`thought-\${targetTokenId}\`;
  }
  return url.toString();
};
const configureGalleryLink = () => {
  thoughtGalleryLink.href = galleryUrl();
  thoughtDetailGalleryLink.href = inshellHomeUrl(ROUTE_THOUGHT_NFT_ID);`;

const snapshotSource = (source) =>
  source.replaceAll("\\`", "`").replaceAll("\\${", "${");

const CURRENT_MOBILE_MAIN_DELTAS = Object.freeze([
  [
    "short viewport constants",
    `const MIN_CANVAS_SIZE = 180;
const STACKED_MIN_CLI_HEIGHT = 160;
const STACKED_CANVAS_MAX_VIEWPORT_RATIO = 0.62;`,
    `const MIN_CANVAS_SIZE = 180;
const STACKED_MIN_CLI_HEIGHT = 160;
const SHORT_VIEWPORT_MIN_CANVAS_SIZE = 120;
const SHORT_VIEWPORT_STACKED_MIN_CLI_HEIGHT = 112;
const STACKED_CANVAS_MAX_VIEWPORT_RATIO = 0.62;`,
    1,
  ],
  [
    "mobile Agent guidance",
    `
  switch (state.kind) {`,
    `  const mobileAgentGuidance = (): DockRailView => ({
    status: "Agent creation requires desktop",
    tone: "idle",
    actions: [loadAction()],
  });

  switch (state.kind) {`,
    1,
  ],
  [
    "mobile empty Agent gate",
    `    case "empty":
      return {`,
    `    case "empty":
      if (isThoughtMobileAgentSurface()) return mobileAgentGuidance();
      return {`,
    1,
  ],
  [
    "mobile ready Agent gate",
    `    case "ready":
      return {`,
    `    case "ready":
      if (isThoughtMobileAgentSurface()) return mobileAgentGuidance();
      return {`,
    1,
  ],
  [
    "mobile Agent selection gate",
    `    case "agent_select":
      return {`,
    `    case "agent_select":
      if (isThoughtMobileAgentSurface()) return mobileAgentGuidance();
      return {`,
    1,
  ],
  [
    "mobile Agent runtime boundary",
    `const syncThoughtDock = () => {
  renderThoughtDock();
};`,
    `const syncThoughtDock = () => {
  renderThoughtDock();
};

const THOUGHT_MOBILE_AGENT_QUERY =
  "(max-width: 760px), ((max-height: 500px) and (orientation: landscape) and (pointer: coarse))";
const thoughtMobileAgentMedia = window.matchMedia(THOUGHT_MOBILE_AGENT_QUERY);
const isThoughtMobileAgentSurface = () => thoughtMobileAgentMedia.matches;

const blockMobileThoughtAgentLaunch = (prompt: string) => {
  if (!isThoughtMobileAgentSurface()) return false;
  emitThoughtConsoleEvent({
    kind: "work_agent_mobile_desktop_required",
    title: "continue on desktop",
    detail: "Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",
    tone: "neutral",
    eventId: "agent-mobile-desktop-required",
  });
  setThoughtDockState({ kind: "ready", prompt });
  return true;
};`,
    1,
  ],
  [
    "mobile Agent welcome guidance",
    `const ensureThoughtConsoleWelcomeMessage = () => {
  if (thoughtConsoleHistory.entries.length > 0) return;
  emitThoughtConsoleEvent({`,
    `const ensureThoughtConsoleWelcomeMessage = () => {
  if (thoughtConsoleHistory.entries.length > 0) return;
  if (isThoughtMobileAgentSurface()) {
    emitThoughtConsoleEvent({
      kind: "work_agent_mobile_desktop_required",
      title: "continue on desktop",
      detail: "Codex and Claude Code creation are available from the desktop THOUGHT App. Mobile wallet connection and PATH minting remain available here.",
      tone: "neutral",
      eventId: "agent-mobile-desktop-required",
    });
    return;
  }
  emitThoughtConsoleEvent({`,
    1,
  ],
  [
    "mobile Agent select action guard",
    `  if (rejectInvalidThoughtDockPrompt(prompt)) {
    return;
  }
  setThoughtDockState({ kind: "agent_select", prompt });`,
    `  if (rejectInvalidThoughtDockPrompt(prompt)) {
    return;
  }
  if (blockMobileThoughtAgentLaunch(prompt)) {
    return;
  }
  setThoughtDockState({ kind: "agent_select", prompt });`,
    1,
  ],
  [
    "mobile Agent adapter guard",
    `const prepareThoughtDockAdapter = (adapterId: ThoughtDockAgentAdapterId) => {
  if (thoughtDockState.kind !== "agent_select") {`,
    `const prepareThoughtDockAdapter = (adapterId: ThoughtDockAgentAdapterId) => {
  if (blockMobileThoughtAgentLaunch(thoughtDockPrompt.value)) {
    return;
  }
  if (thoughtDockState.kind !== "agent_select") {`,
    1,
  ],
  [
    "short landscape sizing helpers",
    `const getStackedOperatorAvailableHeight = () => {`,
    `const isShortLandscapeViewport = () =>
  window.matchMedia("(max-height: 500px) and (orientation: landscape)").matches;

const getMinimumCanvasSize = () =>
  isShortLandscapeViewport() ? SHORT_VIEWPORT_MIN_CANVAS_SIZE : MIN_CANVAS_SIZE;

const getStackedMinimumCliHeight = () =>
  isShortLandscapeViewport()
    ? SHORT_VIEWPORT_STACKED_MIN_CLI_HEIGHT
    : STACKED_MIN_CLI_HEIGHT;

const getStackedOperatorAvailableHeight = () => {`,
    1,
  ],
  [
    "short landscape CLI canvas floor",
    `        MIN_CANVAS_SIZE,
        getStackedOperatorAvailableHeight() - STACKED_MIN_CLI_HEIGHT,`,
    `        getMinimumCanvasSize(),
        getStackedOperatorAvailableHeight() - getStackedMinimumCliHeight(),`,
    1,
    0,
  ],
  [
    "short landscape stacked canvas floor",
    `      MIN_CANVAS_SIZE,
      Math.min(
        getStackedOperatorAvailableHeight() - STACKED_MIN_CLI_HEIGHT,`,
    `      getMinimumCanvasSize(),
      Math.min(
        getStackedOperatorAvailableHeight() - getStackedMinimumCliHeight(),`,
    1,
  ],
  [
    "short landscape available-height floors",
    `return Math.max(MIN_CANVAS_SIZE, availableHeight);`,
    `return Math.max(getMinimumCanvasSize(), availableHeight);`,
    2,
    1,
  ],
  [
    "short landscape display-width input floor",
    `  const availableWidth = Math.max(MIN_CANVAS_SIZE, Math.floor(panelRect.width - horizontalInset));`,
    `  const availableWidth = Math.max(getMinimumCanvasSize(), Math.floor(panelRect.width - horizontalInset));`,
    1,
  ],
  [
    "short landscape display-width output floor",
    `  return Math.max(
    MIN_CANVAS_SIZE,
    Math.min(availableWidth, getViewportWidthCap()),`,
    `  return Math.max(
    getMinimumCanvasSize(),
    Math.min(availableWidth, getViewportWidthCap()),`,
    1,
  ],
  [
    "short landscape CLI panel-height floor",
    `    ? Math.max(STACKED_MIN_CLI_HEIGHT, getStackedOperatorAvailableHeight() - displayWidth)`,
    `    ? Math.max(getStackedMinimumCliHeight(), getStackedOperatorAvailableHeight() - displayWidth)`,
    1,
  ],
  [
    "mobile Agent breakpoint listener",
    `thoughtDockWorksSelect.addEventListener("change", () => {`,
    `thoughtMobileAgentMedia.addEventListener("change", () => {
  syncThoughtDock();
});

thoughtDockWorksSelect.addEventListener("change", () => {`,
    1,
  ],
]);

const applyCurrentMobileMainDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? CURRENT_MOBILE_MAIN_DELTAS
    : [...CURRENT_MOBILE_MAIN_DELTAS].reverse();
  for (const [label, tagged, mobile, restoreCount, layerCount] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? mobile : tagged,
      direction === "restore" ? tagged : mobile,
      direction === "restore" ? restoreCount : layerCount ?? restoreCount,
    );
  }
  return current;
};

// Restore the immutable tagged bytes through the superseded reservation layer
// before applying the current prepared-choice flow below. This intermediate
// transform keeps the historic snapshot verifiable; it is not shipped output.
const CURRENT_AGENT_LAUNCH_DELTAS = Object.freeze([
  [
    "Agent launch link",
    `const launchThoughtDockAgentLink = (url: string) => {
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.rel = "noopener noreferrer";
  if (/^https?:\\/\\//i.test(url)) {
    anchor.target = "_blank";
  }
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 1000);
};`,
    `type ThoughtDockLaunchReservation = Window;

const reserveThoughtDockAgentLaunch = (): ThoughtDockLaunchReservation | null => {
  const reservation = window.open("about:blank", "_blank");
  if (reservation) {
    reservation.opener = null;
  }
  return reservation;
};

const closeThoughtDockAgentLaunchReservation = (
  reservation: ThoughtDockLaunchReservation | null,
) => {
  if (reservation && !reservation.closed) {
    reservation.close();
  }
};

const launchThoughtDockAgentLink = (
  url: string,
  reservation: ThoughtDockLaunchReservation,
) => {
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  if (reservation.closed) {
    return false;
  }
  try {
    reservation.location.replace(url);
    return true;
  } catch {
    closeThoughtDockAgentLaunchReservation(reservation);
    return false;
  }
};`,
  ],
  [
    "Agent selection launch reservation",
    `  const surface = defaultThoughtDockAgentSurface(adapterId);
  return prepareThoughtDockRun(
    thoughtDockState.prompt,
    adapterId,
    surface,
  );`,
    `  const surface = defaultThoughtDockAgentSurface(adapterId);
  const launchReservation = reserveThoughtDockAgentLaunch();
  if (!launchReservation) {
    emitThoughtConsoleEvent({
      kind: "work_agent_launch_blocked",
      title: "allow Agent launch",
      detail: "Allow popups for this page, then choose your Agent again.",
      tone: "warning",
      eventId: \`work-agent-launch-blocked:\${adapterId}\`,
    });
    return;
  }
  void prepareThoughtDockRun(
    thoughtDockState.prompt,
    adapterId,
    surface,
    launchReservation,
  );`,
  ],
  [
    "Agent preparation reservation parameter",
    `const prepareThoughtDockRun = async (
  prompt: string,
  adapterId: ThoughtDockAgentAdapterId,
  surface: ThoughtDockAgentSurface,
) => {`,
    `const prepareThoughtDockRun = async (
  prompt: string,
  adapterId: ThoughtDockAgentAdapterId,
  surface: ThoughtDockAgentSurface,
  launchReservation: ThoughtDockLaunchReservation,
) => {`,
  ],
  [
    "Agent preparation launch reservation",
    `    launchPreparedThoughtDockAdapter({
      run,
      adapterId,
      payload,
      runSessionId,
    });`,
    `    launchPreparedThoughtDockAdapter({
      run,
      adapterId,
      payload,
      runSessionId,
      launchReservation,
    });`,
  ],
  [
    "Agent launch implementation reservation",
    `const launchPreparedThoughtDockAdapter = ({
  run,
  adapterId,
  payload,
  runSessionId,
}: {
  run: AgentDemoRun;
  adapterId: ThoughtDockAgentAdapterId;
  payload: ThoughtRunPayload;
  runSessionId: number;
}) => {
  if (!isCurrentRunSession(runSessionId)) {
    return;
  }
  if (launchedThoughtDockRunIds.has(run.runId)) {
    return;
  }
  launchThoughtDockAgentLink(thoughtDockLaunchUrl(run));`,
    `const launchPreparedThoughtDockAdapter = ({
  run,
  adapterId,
  payload,
  runSessionId,
  launchReservation,
}: {
  run: AgentDemoRun;
  adapterId: ThoughtDockAgentAdapterId;
  payload: ThoughtRunPayload;
  runSessionId: number;
  launchReservation: ThoughtDockLaunchReservation;
}) => {
  if (!isCurrentRunSession(runSessionId)) {
    closeThoughtDockAgentLaunchReservation(launchReservation);
    return;
  }
  if (launchedThoughtDockRunIds.has(run.runId)) {
    closeThoughtDockAgentLaunchReservation(launchReservation);
    return;
  }
  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run), launchReservation)) {
    // A browser-level deep-link refusal can happen after the API run was
    // created. Release that run immediately instead of leaving it counted as
    // active until the 30-minute claim TTL expires and making the next retry
    // look like a server rate-limit failure.
    void requestThoughtDockRunCancellation(run);
    runState = "run_failed";
    runInFlight = false;
    setThoughtDockState({
      kind: "failed",
      message: "The browser could not open the Agent app.",
      details: "Allow the launch window, then choose your Agent again.",
    });
    syncInterface();
    return;
  }`,
  ],
]);
const CURRENT_PREPARED_AGENT_CHOICE_DELTAS = Object.freeze([
  [
    "prepared Agent choice types",
    "type ThoughtDockAgentSurface = \"codex\" | \"claude-cowork\" | \"claude-code\";\n\n",
    "type ThoughtDockAgentSurface = \"codex\" | \"claude-cowork\" | \"claude-code\";\n\ntype PreparedThoughtDockAgentSelection = {\n  prompt: string;\n  payload: ThoughtRunPayload;\n  runSessionId: number;\n};\n\n"
  ],
  [
    "prepared Agent choices state",
    "let thoughtDockAdapterId: ThoughtDockAgentAdapterId = \"codex\";\n",
    "let thoughtDockAdapterId: ThoughtDockAgentAdapterId = \"codex\";\nlet preparedThoughtDockAgentSelection: PreparedThoughtDockAgentSelection | null = null;\n"
  ],
  [
    "prepared Agent choice cancellation",
    "  const cancelAgentSelectAction = (prompt: string) =>\n    dockRailAction(\"cancel\", \"cancel\", \"cancel Agent selection\", () => {\n      setThoughtDockState({ kind: \"ready\", prompt });\n      focusThoughtDockPrompt({ preventScroll: true });\n    }, { handlerKey: `cancel:${hashText(prompt)}` });\n",
    "  const cancelPreparedAgentSelection = (prompt: string) =>\n    dockRailAction(\"cancel\", \"cancel\", \"cancel Agent selection\", () => {\n      preparedThoughtDockAgentSelection = null;\n      invalidateRunSession();\n      runState = \"idle\";\n      runInFlight = false;\n      setThoughtDockState({ kind: \"ready\", prompt });\n      focusThoughtDockPrompt({ preventScroll: true });\n    }, { handlerKey: `cancel:${hashText(prompt)}` });\n"
  ],
  [
    "prepared Agent choice rail",
    "    case \"agent_select\":\n      if (isThoughtMobileAgentSurface()) return mobileAgentGuidance();\n      return {\n        status: \"Choose Agent\",\n        tone: \"idle\",\n        actions: [\n          dockRailAction(\"codex\", thoughtAgentCtaLabel(\"codex\"), thoughtAgentLaunchActionDescription(\"codex\"), () => {\n            void prepareThoughtDockAdapter(\"codex\");\n          }),\n          dockRailAction(\"claude\", thoughtAgentCtaLabel(\"claude\"), thoughtAgentLaunchActionDescription(\"claude\"), () => {\n            void prepareThoughtDockAdapter(\"claude\");\n          }),\n          cancelAgentSelectAction(state.prompt),\n        ],\n        maxActions: 3,\n      };\n",
    "    case \"agent_select\":\n      if (isThoughtMobileAgentSurface()) return mobileAgentGuidance();\n      return {\n        status: \"Choose Agent\",\n        tone: \"idle\",\n        actions: [\n          dockRailAction(\"codex\", thoughtAgentCtaLabel(\"codex\"), thoughtAgentLaunchActionDescription(\"codex\"), () => {\n            prepareThoughtDockAdapter(\"codex\");\n          }),\n          dockRailAction(\"claude\", thoughtAgentCtaLabel(\"claude\"), thoughtAgentLaunchActionDescription(\"claude\"), () => {\n            prepareThoughtDockAdapter(\"claude\");\n          }),\n          cancelPreparedAgentSelection(state.prompt),\n        ],\n        maxActions: 3,\n      };\n"
  ],
  [
    "synchronous Agent deep link",
    "type ThoughtDockLaunchReservation = Window;\n\nconst reserveThoughtDockAgentLaunch = (): ThoughtDockLaunchReservation | null => {\n  const reservation = window.open(\"about:blank\", \"_blank\");\n  if (reservation) {\n    reservation.opener = null;\n  }\n  return reservation;\n};\n\nconst closeThoughtDockAgentLaunchReservation = (\n  reservation: ThoughtDockLaunchReservation | null,\n) => {\n  if (reservation && !reservation.closed) {\n    reservation.close();\n  }\n};\n\nconst launchThoughtDockAgentLink = (\n  url: string,\n  reservation: ThoughtDockLaunchReservation,\n) => {\n  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;\n  if (reservation.closed) {\n    return false;\n  }\n  try {\n    reservation.location.replace(url);\n    return true;\n  } catch {\n    closeThoughtDockAgentLaunchReservation(reservation);\n    return false;\n  }\n};\n\n",
    "const launchThoughtDockAgentLink = (url: string) => {\n  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;\n  try {\n    const anchor = document.createElement(\"a\");\n    anchor.href = url;\n    anchor.rel = \"noopener noreferrer\";\n    anchor.style.display = \"none\";\n    document.body.appendChild(anchor);\n    anchor.click();\n    window.setTimeout(() => anchor.remove(), 1000);\n    return true;\n  } catch {\n    return false;\n  }\n};\n\n"
  ],
  [
    "preparing Agent choices",
    "const openThoughtDockAgentSelect = () => {\n  if (blockPendingMintMutation()) {\n    return;\n  }\n  const prompt = thoughtDockPrompt.value;\n  if (rejectInvalidThoughtDockPrompt(prompt)) {\n    return;\n  }\n  if (blockMobileThoughtAgentLaunch(prompt)) {\n    return;\n  }\n  setThoughtDockState({ kind: \"agent_select\", prompt });\n};\n\n",
    "const openThoughtDockAgentSelect = () => {\n  if (blockPendingMintMutation()) {\n    return;\n  }\n  const prompt = thoughtDockPrompt.value;\n  if (rejectInvalidThoughtDockPrompt(prompt)) {\n    return;\n  }\n  if (blockMobileThoughtAgentLaunch(prompt)) {\n    return;\n  }\n  void prepareThoughtDockAgentSelection(prompt);\n};\n\n"
  ],
  [
    "prepared Agent choice lifecycle",
    "const prepareThoughtDockAdapter = (adapterId: ThoughtDockAgentAdapterId) => {\n  if (blockMobileThoughtAgentLaunch(thoughtDockPrompt.value)) {\n    return;\n  }\n  if (thoughtDockState.kind !== \"agent_select\") {\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"Agent selection is not ready.\",\n      details: \"Reset and send the prompt to your Agent again.\",\n    });\n    return;\n  }\n  const surface = defaultThoughtDockAgentSurface(adapterId);\n  const launchReservation = reserveThoughtDockAgentLaunch();\n  if (!launchReservation) {\n    emitThoughtConsoleEvent({\n      kind: \"work_agent_launch_blocked\",\n      title: \"allow Agent launch\",\n      detail: \"Allow popups for this page, then choose your Agent again.\",\n      tone: \"warning\",\n      eventId: `work-agent-launch-blocked:${adapterId}`,\n    });\n    return;\n  }\n  void prepareThoughtDockRun(\n    thoughtDockState.prompt,\n    adapterId,\n    surface,\n    launchReservation,\n  );\n};\n\nconst prepareThoughtDockRun = async (\n  prompt: string,\n  adapterId: ThoughtDockAgentAdapterId,\n  surface: ThoughtDockAgentSurface,\n  launchReservation: ThoughtDockLaunchReservation,\n) => {\n  if (blockPendingMintMutation()) {\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    return;\n  }\n  if (\n    (adapterId === \"codex\" && surface !== \"codex\") ||\n    (adapterId === \"claude\" && surface !== \"claude-cowork\" && surface !== \"claude-code\")\n  ) {\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"Agent launch surface does not match its adapter.\",\n    });\n    return;\n  }\n  const adapter = THOUGHT_DOCK_AGENT_ADAPTERS.find((candidate) => candidate.id === adapterId);\n  if (!adapter || !adapter.canDeepLink) {\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    emitThoughtConsoleEvent({\n      kind: \"work_agent_adapter_unavailable\",\n      title: `${thoughtAgentProductLabel(adapterId)} unavailable`,\n      detail: `${thoughtAgentProductLabel(adapterId)} does not expose a supported App link yet.`,\n      tone: \"warning\",\n      eventId: `work-agent-adapter-unavailable:${adapterId}`,\n    });\n    return;\n  }\n  const runSessionId = startRunSession();\n  lastRunErrorCliLines = [];\n  lastPreviewRetryContext = null;\n  runState = \"running\";\n  runInFlight = true;\n  setWarning(\"\");\n  setStatus(\"\");\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId });\n\n  try {\n    const payload = await buildThoughtDockRunPayload(prompt);\n    if (!isCurrentRunSession(runSessionId)) {\n      closeThoughtDockAgentLaunchReservation(launchReservation);\n      return;\n    }\n    const run = await createThoughtDockRun(prompt, payload, adapterId, surface);\n    if (!isCurrentRunSession(runSessionId)) {\n      closeThoughtDockAgentLaunchReservation(launchReservation);\n      return;\n    }\n    recordThoughtDockPromptHistory(prompt);\n    launchPreparedThoughtDockAdapter({\n      run,\n      adapterId,\n      payload,\n      runSessionId,\n      launchReservation,\n    });\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      closeThoughtDockAgentLaunchReservation(launchReservation);\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({ kind: \"failed\", message });\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    syncInterface();\n  }\n};\n\nconst launchPreparedThoughtDockAdapter = ({\n  run,\n  adapterId,\n  payload,\n  runSessionId,\n  launchReservation,\n}: {\n  run: AgentDemoRun;\n  adapterId: ThoughtDockAgentAdapterId;\n  payload: ThoughtRunPayload;\n  runSessionId: number;\n  launchReservation: ThoughtDockLaunchReservation;\n}) => {\n  if (!isCurrentRunSession(runSessionId)) {\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    return;\n  }\n  if (launchedThoughtDockRunIds.has(run.runId)) {\n    closeThoughtDockAgentLaunchReservation(launchReservation);\n    return;\n  }\n  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run), launchReservation)) {\n    // A browser-level deep-link refusal can happen after the API run was\n    // created. Release that run immediately instead of leaving it counted as\n    // active until the 30-minute claim TTL expires and making the next retry\n    // look like a server rate-limit failure.\n    void requestThoughtDockRunCancellation(run);\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"The browser could not open the Agent app.\",\n      details: \"Allow the launch window, then choose your Agent again.\",\n    });\n    syncInterface();\n    return;\n  }\n  launchedThoughtDockRunIds.add(run.runId);\n  thoughtDockRun = run;\n  storeThoughtDockRun(run, adapterId);\n  setThoughtDockState({\n    kind: \"waiting_for_agent\",\n    run,\n    adapterId,\n    message: `${thoughtAgentProductLabel(adapterId)} launch requested.`,\n  });\n  startThoughtDockPolling(run, payload, adapterId, runSessionId);\n};\n\n",
    "const prepareThoughtDockAdapter = (adapterId: ThoughtDockAgentAdapterId) => {\n  if (blockMobileThoughtAgentLaunch(thoughtDockPrompt.value)) {\n    return;\n  }\n  if (thoughtDockState.kind !== \"agent_select\") {\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"Agent selection is not ready.\",\n      details: \"Reset and send the prompt to your Agent again.\",\n    });\n    return;\n  }\n  const selection = preparedThoughtDockAgentSelection;\n  if (!selection || selection.prompt !== thoughtDockState.prompt) {\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"Agent selection is not ready.\",\n      details: \"Reset and send the prompt to your Agent again.\",\n    });\n    return;\n  }\n  void prepareThoughtDockRun(selection, adapterId);\n};\n\nconst prepareThoughtDockAgentSelection = async (prompt: string) => {\n  if (blockPendingMintMutation()) {\n    return;\n  }\n  const runSessionId = startRunSession();\n  lastRunErrorCliLines = [];\n  lastPreviewRetryContext = null;\n  runState = \"running\";\n  runInFlight = true;\n  setWarning(\"\");\n  setStatus(\"\");\n  preparedThoughtDockAgentSelection = null;\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId: \"codex\" });\n\n  try {\n    const payload = await buildThoughtDockRunPayload(prompt);\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    preparedThoughtDockAgentSelection = { prompt, payload, runSessionId };\n    setThoughtDockState({ kind: \"agent_select\", prompt });\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({ kind: \"failed\", message });\n    syncInterface();\n  }\n};\n\nconst prepareThoughtDockRun = async ({\n  prompt,\n  payload,\n  runSessionId,\n}: PreparedThoughtDockAgentSelection, adapterId: ThoughtDockAgentAdapterId) => {\n  if (!isCurrentRunSession(runSessionId)) {\n    return;\n  }\n  const adapter = THOUGHT_DOCK_AGENT_ADAPTERS.find((candidate) => candidate.id === adapterId);\n  if (!adapter || !adapter.canDeepLink) {\n    emitThoughtConsoleEvent({\n      kind: \"work_agent_adapter_unavailable\",\n      title: `${thoughtAgentProductLabel(adapterId)} unavailable`,\n      detail: `${thoughtAgentProductLabel(adapterId)} does not expose a supported App link yet.`,\n      tone: \"warning\",\n      eventId: `work-agent-adapter-unavailable:${adapterId}`,\n    });\n    return;\n  }\n  const surface = defaultThoughtDockAgentSurface(adapterId);\n  runState = \"running\";\n  runInFlight = true;\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId });\n\n  let run: AgentDemoRun;\n  try {\n    run = await createThoughtDockRun(prompt, payload, adapterId, surface);\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    runInFlight = false;\n    if (\n      error instanceof Error &&\n      error.name === \"ThoughtAgentHttpError\" &&\n      (error as Error & { status?: number }).status === 429\n    ) {\n      runState = \"idle\";\n      setThoughtDockState({ kind: \"agent_select\", prompt });\n      emitThoughtConsoleEvent({\n        kind: \"work_agent_rate_limited\",\n        title: \"Agent run limit reached\",\n        detail: \"Previous Agent launches are still active. No new Agent task was opened.\",\n        nextStep: \"wait for an earlier run to finish, then choose an Agent again\",\n        tone: \"warning\",\n        eventId: \"work-agent-rate-limited:choice\",\n      });\n      syncInterface();\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    setThoughtDockState({ kind: \"failed\", message });\n    syncInterface();\n    return;\n  }\n  if (!isCurrentRunSession(runSessionId)) {\n    void requestThoughtDockRunCancellation(run).catch(() => {\n      // A reset won the race after creation; release the unused run.\n    });\n    return;\n  }\n  recordThoughtDockPromptHistory(prompt);\n  if (launchedThoughtDockRunIds.has(run.runId)) {\n    return;\n  }\n  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run))) {\n    // A browser-level deep-link refusal can happen after the API run was\n    // created. Release that run immediately instead of leaving it counted as\n    // active until the 30-minute claim TTL expires and making the next retry\n    // look like a server rate-limit failure.\n    void requestThoughtDockRunCancellation(run);\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"The browser could not open the Agent app.\",\n      details: \"Allow this site to open the Agent app, then choose your Agent again.\",\n    });\n    syncInterface();\n    return;\n  }\n  launchedThoughtDockRunIds.add(run.runId);\n  preparedThoughtDockAgentSelection = null;\n  thoughtDockRun = run;\n  storeThoughtDockRun(run, adapterId);\n  setThoughtDockState({\n    kind: \"waiting_for_agent\",\n    run,\n    adapterId,\n    message: `${thoughtAgentProductLabel(adapterId)} launch requested.`,\n  });\n  startThoughtDockPolling(run, payload, adapterId, runSessionId);\n};\n\n"
  ],
  [
    "prepared Agent choice reset",
    "const resetThoughtDock = (options?: { clearPrompt?: boolean; focusPrompt?: boolean }) => {\n  if (!resetThought()) {\n    return false;\n  }\n  thoughtDockPollGeneration += 1;\n  thoughtDockPollWakeScheduler.clearImmediatePoll();\n  thoughtDockPollWakeScheduler.wake();\n  clearStoredThoughtDockRun();\n  thoughtDockRun = null;\n  thoughtDockAdapterId = \"codex\";\n  runInFlight = false;\n",
    "const resetThoughtDock = (options?: { clearPrompt?: boolean; focusPrompt?: boolean }) => {\n  if (!resetThought()) {\n    return false;\n  }\n  invalidateRunSession();\n  thoughtDockPollGeneration += 1;\n  thoughtDockPollWakeScheduler.clearImmediatePoll();\n  thoughtDockPollWakeScheduler.wake();\n  clearStoredThoughtDockRun();\n  thoughtDockRun = null;\n  thoughtDockAdapterId = \"codex\";\n  preparedThoughtDockAgentSelection = null;\n  runInFlight = false;\n"
  ]
]);

const applyCurrentPreparedAgentChoiceDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? CURRENT_PREPARED_AGENT_CHOICE_DELTAS
    : [...CURRENT_PREPARED_AGENT_CHOICE_DELTAS].reverse();
  for (const [label, previous, prepared] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? prepared : previous,
      direction === "restore" ? previous : prepared,
    );
  }
  return current;
};

const CURRENT_SINGLE_RUN_AGENT_CHOOSER_DELTAS = Object.freeze([
  [
    "single-run chooser protocol import",
    "  THOUGHT_AGENT_PROTOCOL_VERSION,\n  THOUGHT_SHA256_PREFIX,",
    "  THOUGHT_AGENT_PROTOCOL_VERSION,\n  THOUGHT_AGENT_UNBOUND_ADAPTER_ID,\n  THOUGHT_SHA256_PREFIX,",
  ],
  [
    "single-run chooser prepared types",
    `type ThoughtDockAgentSurface = "codex" | "claude-cowork" | "claude-code";

type PreparedThoughtDockAgentSelection = {
  prompt: string;
  payload: ThoughtRunPayload;
  runSessionId: number;
};`,
    `type ThoughtDockAgentSurface = "codex" | "claude-cowork" | "claude-code";

type PreparedThoughtDockRun = Omit<
  AgentDemoRun,
  "surface" | "codexUrl" | "claudeUrl" | "sealedTask" | "handoffSha256"
>;

type PreparedThoughtDockAgentSelection = {
  prompt: string;
  payload: ThoughtRunPayload;
  run: PreparedThoughtDockRun;
  runSessionId: number;
};`,
  ],
  [
    "single-run chooser cancellation",
    `  const cancelPreparedAgentSelection = (prompt: string) =>
    dockRailAction("cancel", "cancel", "cancel Agent selection", () => {
      preparedThoughtDockAgentSelection = null;`,
    `  const cancelPreparedAgentSelection = (prompt: string) =>
    dockRailAction("cancel", "cancel", "cancel Agent selection", () => {
      const prepared = preparedThoughtDockAgentSelection;
      preparedThoughtDockAgentSelection = null;
      if (prepared) {
        void requestThoughtDockRunCancellation(prepared.run).catch(() => {
          // The local chooser can still close if the unused run is already terminal.
        });
      }`,
  ],
  [
    "single-run chooser create signature",
    `const createThoughtDockRun = async (
  prompt: string,
  payload: ThoughtRunPayload,
  adapterId: ThoughtDockAgentAdapterId,
  surface: ThoughtDockAgentSurface,
): Promise<AgentDemoRun> => {`,
    `const createThoughtDockRun = async (
  prompt: string,
  payload: ThoughtRunPayload,
): Promise<PreparedThoughtDockRun> => {`,
  ],
  [
    "single-run chooser requested adapter",
    `        requestedAgent: {
          adapterId,
          model: null,
        },
        client: {
          surface: surface === "codex" ? "thought-dock" : \`thought-dock:\${surface}\`,`,
    `        requestedAgent: {
          adapterId: THOUGHT_AGENT_UNBOUND_ADAPTER_ID,
          model: null,
        },
        client: {
          surface: "thought-dock:chooser",`,
  ],
  [
    "single-run chooser base run surface",
    `  const baseRun = {
    runId: createPayload.runId,
    surface,
    prompt,`,
    `  const baseRun = {
    runId: createPayload.runId,
    prompt,`,
  ],
  [
    "single-run chooser binds selected adapter",
    `  const sealedTask = buildAgentDemoSealedTask(baseRun, adapterId);
  const handoffSha256 = thoughtAgentHandoffSha256(sealedTask);
  return {
    ...baseRun,
    sealedTask,
    handoffSha256,
    codexUrl: buildCodexAgentUrl(sealedTask),
    claudeUrl: buildClaudeAgentUrl(sealedTask, surface),
    candidate: null,
  };
};`,
    `  return { ...baseRun, candidate: null };
};

const bindPreparedThoughtDockRun = (
  prepared: PreparedThoughtDockRun,
  adapterId: ThoughtDockAgentAdapterId,
): AgentDemoRun => {
  const surface = defaultThoughtDockAgentSurface(adapterId);
  const run = { ...prepared, surface } as AgentDemoRun;
  const sealedTask = buildAgentDemoSealedTask(run, adapterId);
  const handoffSha256 = thoughtAgentHandoffSha256(sealedTask);
  return {
    ...run,
    sealedTask,
    handoffSha256,
    codexUrl: buildCodexAgentUrl(sealedTask),
    claudeUrl: buildClaudeAgentUrl(sealedTask, surface),
  };
};`,
  ],
  [
    "single-run chooser cancellation input",
    "const requestThoughtDockRunCancellation = async (run: AgentDemoRun) => {",
    `const requestThoughtDockRunCancellation = async (
  run: Pick<AgentDemoRun, "statusUrl" | "browserToken">,
) => {`,
  ],
  [
    "single-run chooser synchronous selection",
    "  void prepareThoughtDockRun(selection, adapterId);",
    "  prepareThoughtDockRun(selection, adapterId);",
  ],
  [
    "single-run chooser lifecycle",
    "const prepareThoughtDockAgentSelection = async (prompt: string) => {\n  if (blockPendingMintMutation()) {\n    return;\n  }\n  const runSessionId = startRunSession();\n  lastRunErrorCliLines = [];\n  lastPreviewRetryContext = null;\n  runState = \"running\";\n  runInFlight = true;\n  setWarning(\"\");\n  setStatus(\"\");\n  preparedThoughtDockAgentSelection = null;\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId: \"codex\" });\n\n  try {\n    const payload = await buildThoughtDockRunPayload(prompt);\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    preparedThoughtDockAgentSelection = { prompt, payload, runSessionId };\n    setThoughtDockState({ kind: \"agent_select\", prompt });\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({ kind: \"failed\", message });\n    syncInterface();\n  }\n};\n\nconst prepareThoughtDockRun = async ({\n  prompt,\n  payload,\n  runSessionId,\n}: PreparedThoughtDockAgentSelection, adapterId: ThoughtDockAgentAdapterId) => {\n  if (!isCurrentRunSession(runSessionId)) {\n    return;\n  }\n  const adapter = THOUGHT_DOCK_AGENT_ADAPTERS.find((candidate) => candidate.id === adapterId);\n  if (!adapter || !adapter.canDeepLink) {\n    emitThoughtConsoleEvent({\n      kind: \"work_agent_adapter_unavailable\",\n      title: `${thoughtAgentProductLabel(adapterId)} unavailable`,\n      detail: `${thoughtAgentProductLabel(adapterId)} does not expose a supported App link yet.`,\n      tone: \"warning\",\n      eventId: `work-agent-adapter-unavailable:${adapterId}`,\n    });\n    return;\n  }\n  const surface = defaultThoughtDockAgentSurface(adapterId);\n  runState = \"running\";\n  runInFlight = true;\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId });\n\n  let run: AgentDemoRun;\n  try {\n    run = await createThoughtDockRun(prompt, payload, adapterId, surface);\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    runInFlight = false;\n    if (\n      error instanceof Error &&\n      error.name === \"ThoughtAgentHttpError\" &&\n      (error as Error & { status?: number }).status === 429\n    ) {\n      runState = \"idle\";\n      setThoughtDockState({ kind: \"agent_select\", prompt });\n      emitThoughtConsoleEvent({\n        kind: \"work_agent_rate_limited\",\n        title: \"Agent run limit reached\",\n        detail: \"Previous Agent launches are still active. No new Agent task was opened.\",\n        nextStep: \"wait for an earlier run to finish, then choose an Agent again\",\n        tone: \"warning\",\n        eventId: \"work-agent-rate-limited:choice\",\n      });\n      syncInterface();\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    setThoughtDockState({ kind: \"failed\", message });\n    syncInterface();\n    return;\n  }\n  if (!isCurrentRunSession(runSessionId)) {\n    void requestThoughtDockRunCancellation(run).catch(() => {\n      // A reset won the race after creation; release the unused run.\n    });\n    return;\n  }\n  recordThoughtDockPromptHistory(prompt);\n  if (launchedThoughtDockRunIds.has(run.runId)) {\n    return;\n  }\n  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run))) {\n    // A browser-level deep-link refusal can happen after the API run was\n    // created. Release that run immediately instead of leaving it counted as\n    // active until the 30-minute claim TTL expires and making the next retry\n    // look like a server rate-limit failure.\n    void requestThoughtDockRunCancellation(run);\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"The browser could not open the Agent app.\",\n      details: \"Allow this site to open the Agent app, then choose your Agent again.\",\n    });\n    syncInterface();\n    return;\n  }\n  launchedThoughtDockRunIds.add(run.runId);\n  preparedThoughtDockAgentSelection = null;\n  thoughtDockRun = run;\n  storeThoughtDockRun(run, adapterId);\n  setThoughtDockState({\n    kind: \"waiting_for_agent\",\n    run,\n    adapterId,\n    message: `${thoughtAgentProductLabel(adapterId)} launch requested.`,\n  });\n  startThoughtDockPolling(run, payload, adapterId, runSessionId);\n};\n\n",
    "const prepareThoughtDockAgentSelection = async (prompt: string) => {\n  if (blockPendingMintMutation()) {\n    return;\n  }\n  const runSessionId = startRunSession();\n  lastRunErrorCliLines = [];\n  lastPreviewRetryContext = null;\n  runState = \"running\";\n  runInFlight = true;\n  setWarning(\"\");\n  setStatus(\"\");\n  preparedThoughtDockAgentSelection = null;\n  setThoughtDockState({ kind: \"creating_run\", prompt, adapterId: \"codex\" });\n\n  try {\n    const payload = await buildThoughtDockRunPayload(prompt);\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    const run = await createThoughtDockRun(prompt, payload);\n    if (!isCurrentRunSession(runSessionId)) {\n      void requestThoughtDockRunCancellation(run).catch(() => {\n        // A reset won the race after creation; release the unused run.\n      });\n      return;\n    }\n    preparedThoughtDockAgentSelection = { prompt, payload, run, runSessionId };\n    setThoughtDockState({ kind: \"agent_select\", prompt });\n  } catch (error) {\n    if (!isCurrentRunSession(runSessionId)) {\n      return;\n    }\n    runInFlight = false;\n    if (\n      error instanceof Error &&\n      error.name === \"ThoughtAgentHttpError\" &&\n      (error as Error & { status?: number }).status === 429\n    ) {\n      runState = \"idle\";\n      setThoughtDockState({ kind: \"ready\", prompt });\n      emitThoughtConsoleEvent({\n        kind: \"work_agent_rate_limited\",\n        title: \"Agent run limit reached\",\n        detail: \"Previous Agent launches are still active. No new Agent task was opened.\",\n        nextStep: \"wait for an earlier run to finish, then send the prompt again\",\n        tone: \"warning\",\n        eventId: \"work-agent-rate-limited:prepare\",\n      });\n      syncInterface();\n      return;\n    }\n    const rawMessage = error instanceof Error ? error.message : \"\";\n    const message = rawMessage.includes(\"spec\") || /failed to fetch|network|connection refused|could not connect|econnrefused/i.test(rawMessage)\n      ? formatThoughtSpecError(error)\n      : rawMessage.replace(/\\bTHOUGHT Bridge\\b/g, \"Agent link\") || \"Could not create Agent run.\";\n    runState = \"run_failed\";\n    setThoughtDockState({ kind: \"failed\", message });\n    syncInterface();\n  }\n};\n\nconst prepareThoughtDockRun = ({\n  prompt,\n  payload,\n  run: preparedRun,\n  runSessionId,\n}: PreparedThoughtDockAgentSelection, adapterId: ThoughtDockAgentAdapterId) => {\n  if (!isCurrentRunSession(runSessionId)) {\n    return;\n  }\n  const adapter = THOUGHT_DOCK_AGENT_ADAPTERS.find((candidate) => candidate.id === adapterId);\n  if (!adapter || !adapter.canDeepLink) {\n    emitThoughtConsoleEvent({\n      kind: \"work_agent_adapter_unavailable\",\n      title: `${thoughtAgentProductLabel(adapterId)} unavailable`,\n      detail: `${thoughtAgentProductLabel(adapterId)} does not expose a supported App link yet.`,\n      tone: \"warning\",\n      eventId: `work-agent-adapter-unavailable:${adapterId}`,\n    });\n    return;\n  }\n  const run = bindPreparedThoughtDockRun(preparedRun, adapterId);\n  runState = \"running\";\n  runInFlight = true;\n  recordThoughtDockPromptHistory(prompt);\n  if (launchedThoughtDockRunIds.has(run.runId)) {\n    return;\n  }\n  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run))) {\n    // A browser-level deep-link refusal can happen after the API run was\n    // created. Release that run immediately instead of leaving it counted as\n    // active until the 30-minute claim TTL expires and making the next retry\n    // look like a server rate-limit failure.\n    void requestThoughtDockRunCancellation(run);\n    runState = \"run_failed\";\n    runInFlight = false;\n    setThoughtDockState({\n      kind: \"failed\",\n      message: \"The browser could not open the Agent app.\",\n      details: \"Allow this site to open the Agent app, then choose your Agent again.\",\n    });\n    syncInterface();\n    return;\n  }\n  launchedThoughtDockRunIds.add(run.runId);\n  preparedThoughtDockAgentSelection = null;\n  thoughtDockRun = run;\n  storeThoughtDockRun(run, adapterId);\n  setThoughtDockState({\n    kind: \"waiting_for_agent\",\n    run,\n    adapterId,\n    message: `${thoughtAgentProductLabel(adapterId)} launch requested.`,\n  });\n  startThoughtDockPolling(run, payload, adapterId, runSessionId);\n};\n\n",
  ],

  [
    "single-run chooser reset cancellation",
    `  thoughtDockRun = null;
  thoughtDockAdapterId = "codex";
  preparedThoughtDockAgentSelection = null;
  runInFlight = false;`,
    `  thoughtDockRun = null;
  thoughtDockAdapterId = "codex";
  const prepared = preparedThoughtDockAgentSelection;
  preparedThoughtDockAgentSelection = null;
  if (prepared) {
    void requestThoughtDockRunCancellation(prepared.run).catch(() => {
      // Reset still completes if the unused run is already terminal or unreachable.
    });
  }
  runInFlight = false;`,
  ],
]);

const applyCurrentSingleRunAgentChooserDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? CURRENT_SINGLE_RUN_AGENT_CHOOSER_DELTAS
    : [...CURRENT_SINGLE_RUN_AGENT_CHOOSER_DELTAS].reverse();
  for (const [label, previous, currentValue] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? currentValue : previous,
      direction === "restore" ? previous : currentValue,
    );
  }
  return current;
};

const CURRENT_TRUSTED_AGENT_LINK_DELTAS = Object.freeze([
  [
    "trusted Agent link action shape",
    `  handlerKey?: string;
  disabled?: boolean;`,
    `  handlerKey?: string;
  href?: () => string;
  disabled?: boolean;`,
  ],
  [
    "trusted Agent link element",
    `const assertDockRailView = (view: DockRailView) => {`,
    `const thoughtDockLink = (
  label: string,
  href: () => string,
  onClick: () => void,
  options?: { ariaLabel?: string },
) => {
  const link = document.createElement("a");
  link.className = "thought-dock-button thought-work-cta";
  link.textContent = label;
  link.href = "#";
  if (options?.ariaLabel) {
    link.setAttribute("aria-label", options.ariaLabel);
  }
  link.addEventListener("click", () => {
    // Let the browser own the trusted custom-protocol navigation. Setting the
    // href during the real link click keeps the launch token out of the idle
    // DOM while preserving the click's user activation.
    link.href = href();
    onClick();
  });
  return link;
};

const assertDockRailView = (view: DockRailView) => {`,
  ],
  [
    "trusted Agent link rail action",
    `  options?: { disabled?: boolean; expanded?: boolean; handlerKey?: string },
): DockRailAction => ({
  id,
  label,
  ariaLabel,
  onClick,
  handlerKey: options?.handlerKey,
  disabled: options?.disabled,
  expanded: options?.expanded,
});

const renderDockRailAction = (action: DockRailAction) =>
  thoughtDockButton(action.label, action.onClick, {
    disabled: action.disabled,
    ariaLabel: action.ariaLabel,
    expanded: action.expanded,
  });`,
    `  options?: {
    disabled?: boolean;
    expanded?: boolean;
    handlerKey?: string;
    href?: () => string;
  },
): DockRailAction => ({
  id,
  label,
  ariaLabel,
  onClick,
  handlerKey: options?.handlerKey,
  href: options?.href,
  disabled: options?.disabled,
  expanded: options?.expanded,
});

const renderDockRailAction = (action: DockRailAction) =>
  action.href
    ? thoughtDockLink(action.label, action.href, action.onClick, {
        ariaLabel: action.ariaLabel,
      })
    : thoughtDockButton(action.label, action.onClick, {
        disabled: action.disabled,
        ariaLabel: action.ariaLabel,
        expanded: action.expanded,
      });`,
  ],
  [
    "trusted Agent link render identity",
    `      handlerKey: action.handlerKey ?? action.id,
      disabled: !!action.disabled,`,
    `      handlerKey: action.handlerKey ?? action.id,
      linked: !!action.href,
      disabled: !!action.disabled,`,
  ],
  [
    "trusted Agent chooser links",
    `          dockRailAction("codex", thoughtAgentCtaLabel("codex"), thoughtAgentLaunchActionDescription("codex"), () => {
            prepareThoughtDockAdapter("codex");
          }),
          dockRailAction("claude", thoughtAgentCtaLabel("claude"), thoughtAgentLaunchActionDescription("claude"), () => {
            prepareThoughtDockAdapter("claude");
          }),`,
    `          dockRailAction("codex", thoughtAgentCtaLabel("codex"), thoughtAgentLaunchActionDescription("codex"), () => {
            prepareThoughtDockAdapter("codex");
          }, {
            href: () => preparedThoughtDockLaunchUrl("codex"),
            handlerKey: "launch:codex",
          }),
          dockRailAction("claude", thoughtAgentCtaLabel("claude"), thoughtAgentLaunchActionDescription("claude"), () => {
            prepareThoughtDockAdapter("claude");
          }, {
            href: () => preparedThoughtDockLaunchUrl("claude"),
            handlerKey: "launch:claude",
          }),`,
  ],
  [
    "trusted Agent launch URL",
    `const launchThoughtDockAgentLink = (url: string) => {
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => anchor.remove(), 1000);
    return true;
  } catch {
    return false;
  }
};`,
    `const preparedThoughtDockLaunchUrl = (adapterId: ThoughtDockAgentAdapterId) => {
  const selection = preparedThoughtDockAgentSelection;
  if (!selection || thoughtDockState.kind !== "agent_select") {
    return "#";
  }
  suppressBridgeLaunchUnloadUntil = Date.now() + 3000;
  return thoughtDockLaunchUrl(bindPreparedThoughtDockRun(selection.run, adapterId));
};`,
  ],
  [
    "trusted Agent launch transition",
    `  prepareThoughtDockRun(selection, adapterId);`,
    `  // Keep the chooser link in the DOM until its trusted default navigation has
  // fired. The run state transition begins on the next task; no synthetic
  // click, popup reservation, or second Agent launch is involved.
  preparedThoughtDockAgentSelection = null;
  window.setTimeout(() => prepareThoughtDockRun(selection, adapterId), 0);`,
  ],
  [
    "trusted Agent launch side effect",
    `  if (!launchThoughtDockAgentLink(thoughtDockLaunchUrl(run))) {
    // A browser-level deep-link refusal can happen after the API run was
    // created. Release that run immediately instead of leaving it counted as
    // active until the 30-minute claim TTL expires and making the next retry
    // look like a server rate-limit failure.
    void requestThoughtDockRunCancellation(run);
    runState = "run_failed";
    runInFlight = false;
    setThoughtDockState({
      kind: "failed",
      message: "The browser could not open the Agent app.",
      details: "Allow this site to open the Agent app, then choose your Agent again.",
    });
    syncInterface();
    return;
  }
  launchedThoughtDockRunIds.add(run.runId);
  preparedThoughtDockAgentSelection = null;`,
    `  launchedThoughtDockRunIds.add(run.runId);`,
  ],
  [
    "same-origin Agent public API normalization",
    `const THOUGHT_DOCK_AGENT_PUBLIC_API_BASE = (
  readConfiguredUrl("VITE_THOUGHT_AGENT_PUBLIC_API_BASE") ||
  THOUGHT_DOCK_AGENT_API_BASE
).replace(/\\/+$/g, "");`,
    `const THOUGHT_DOCK_AGENT_PUBLIC_API_BASE = resolveBrowserRpcUrl(
  readConfiguredUrl("VITE_THOUGHT_AGENT_PUBLIC_API_BASE") ||
  THOUGHT_DOCK_AGENT_API_BASE,
).replace(/\\/+$/g, "");`,
  ],
]);

const applyCurrentTrustedAgentLinkDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? [...CURRENT_TRUSTED_AGENT_LINK_DELTAS].reverse()
    : CURRENT_TRUSTED_AGENT_LINK_DELTAS;
  for (const [label, previous, currentValue] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? currentValue : previous,
      direction === "restore" ? previous : currentValue,
    );
  }
  return current;
};

const applyCurrentAgentLaunchDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? CURRENT_AGENT_LAUNCH_DELTAS
    : [...CURRENT_AGENT_LAUNCH_DELTAS].reverse();
  for (const [label, tagged, trusted] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? trusted : tagged,
      direction === "restore" ? tagged : trusted,
    );
  }
  return current;
};

const layerCurrentAgentRateLimitHandling = (source) => {
  let current = source;
  current = replaceExactCount(
    current,
    "Agent HTTP status error class",
    "const fetchThoughtAgentJson = async <T>(url: string, init: RequestInit) => {",
    `class ThoughtAgentHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ThoughtAgentHttpError";
    this.status = status;
  }
}

const fetchThoughtAgentJson = async <T>(url: string, init: RequestInit) => {`,
  );
  current = replaceExactCount(
    current,
    "Agent HTTP status throw",
    "throw new Error(readErrorMessage(payload, `THOUGHT Agent API failed (\${response.status}).`));",
    "throw new ThoughtAgentHttpError(\n      response.status,\n      readErrorMessage(payload, `THOUGHT Agent API failed (\${response.status}).`),\n    );",
  );
  return current;
};

const restoreCurrentAgentRateLimitHandling = (source) => {
  let current = source;
  current = replaceExactCount(
    current,
    "current Agent HTTP status error class",
    `class ThoughtAgentHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ThoughtAgentHttpError";
    this.status = status;
  }
}

const fetchThoughtAgentJson = async <T>(url: string, init: RequestInit) => {`,
    "const fetchThoughtAgentJson = async <T>(url: string, init: RequestInit) => {",
  );
  current = replaceExactCount(
    current,
    "current Agent HTTP status throw",
    "throw new ThoughtAgentHttpError(\n      response.status,\n      readErrorMessage(payload, `THOUGHT Agent API failed (\${response.status}).`),\n    );",
    "throw new Error(readErrorMessage(payload, `THOUGHT Agent API failed (\${response.status}).`));",
  );
  return current;
};

const CURRENT_PINNED_BROWSER_PREVIEW_DELTAS = Object.freeze([
  [
    "pinned browser preview import",
    'import { THOUGHT_V2_CURRENT_MINTED_TOPIC } from "./thought-v2-contract-client";',
    `import { THOUGHT_V2_CURRENT_MINTED_TOPIC } from "./thought-v2-contract-client";
import { buildThoughtV2Svg, THOUGHT_V2_ARTIFACT } from "./thought-v2-renderer";`,
  ],
  [
    "pinned browser preview provider",
    "const createWalletPreviewProvider = (): ThoughtPreviewProvider | null => {",
    `// This renderer is pinned through the generated THOUGHT V2 artifact and is
// useful before a network has a matching contract deployment. It is strictly a
// visual preview: only a contract-rendered result can make a work mint-ready.
const createPinnedBrowserPreviewProvider = (): ThoughtPreviewProvider => ({
  kind: "frontend-renderer",
  chainId: THOUGHT_CHAIN_ID,
  endpointLabel: \`pinned:\${THOUGHT_V2_ARTIFACT.manifestSha256}\`,
  preview: async (rawReturn: string, context?: { prompt?: string }) => {
    const validation = prevalidateThoughtV2Preview({
      rawPrompt: context?.prompt ?? sessionState.prompt,
      rawReturn,
    });
    if (!validation.ok) {
      return {
        ok: false,
        text: validation.agentLine,
        svg: "",
        reasonCode: validation.reasonCode,
        ...(validation.byteLimit ? { byteLimit: validation.byteLimit } : {}),
        ...(validation.issue ? { issue: validation.issue } : {}),
      };
    }
    return {
      ok: true,
      text: validation.agentLine,
      svg: buildThoughtV2Svg({
        agentLine: validation.agentLine,
        promptLine: validation.promptLine,
      }),
      reasonCode: 0,
    };
  },
  trace: () => ({
    kind: "frontend-renderer",
    chainId: THOUGHT_CHAIN_ID,
    endpointLabel: \`pinned:\${THOUGHT_V2_ARTIFACT.manifestSha256}\`,
    method: "frontendRender",
    fetchedAt: new Date().toISOString(),
  }),
});

const createWalletPreviewProvider = (): ThoughtPreviewProvider | null => {`,
  ],
  [
    "pinned browser preview selection",
    `  return {
    provider: null,
    reason: "pinned THOUGHT renderer release mismatch; preview stopped.",
  };`,
    '  return { provider: createPinnedBrowserPreviewProvider(), reason: "" };',
  ],
  [
    "Studio Preview browser preview selection",
    `  if (IS_LOCAL_THOUGHT_V2) {
    const provider = getReadProvider();`,
    `  if (thoughtLaunchState.phase === "studio-preview") {
    const provider = createPinnedBrowserPreviewProvider();
    return { provider, reason: "" };
  }
  if (IS_LOCAL_THOUGHT_V2) {
    const provider = getReadProvider();`,
  ],
  [
    "pinned browser preview capability",
    "  const frontendPreview = true;",
    '  const frontendPreview = selection.provider.kind === "frontend-renderer";',
  ],
  [
    "contract-only mint readiness",
    'const hasCurrentContractWorkSvg = () => currentWorkSvg.trim().startsWith("<svg");',
    `const hasCurrentContractWorkSvg = () =>
  currentWorkSvg.trim().startsWith("<svg") &&
  currentRunContext?.previewProvider?.method !== "frontendRender";`,
  ],
]);

const applyCurrentPinnedBrowserPreviewDeltas = (source, direction) => {
  let current = source;
  const deltas = direction === "restore"
    ? CURRENT_PINNED_BROWSER_PREVIEW_DELTAS
    : [...CURRENT_PINNED_BROWSER_PREVIEW_DELTAS].reverse();
  for (const [label, tagged, browserPreview] of deltas) {
    current = replaceExactCount(
      current,
      label,
      direction === "restore" ? browserPreview : tagged,
      direction === "restore" ? tagged : browserPreview,
    );
  }
  return current;
};

const applyMono76DisplayDelta = (source, direction) => {
  const pairs = [
    ['import { normalizeThoughtV2StoredVisual } from "./thought-v2-stored-visual";',
      'import { normalizeThoughtV2StoredVisual, thoughtV2DisplayImage } from "./thought-v2-stored-visual";'],
    ['  thoughtSvgPreview.src = image;', '  thoughtSvgPreview.src = thoughtV2DisplayImage(image);'],
  ];
  for (const [before, after] of pairs) {
    source = replaceExactCount(source, "Mono 76 display-only recovery",
      direction === "restore" ? after : before,
      direction === "restore" ? before : after);
  }
  return source;
};

const applyFailureReportDelta = (source, direction) => {
  const pairs = [
    ["  thoughtReportBugLink.href = link.href;\n  thoughtReportBugLink.target = link.target;\n  thoughtReportBugLink.rel = link.rel;\n  thoughtReportBugLink.ariaLabel = link.ariaLabel;\n  thoughtReportBugLink.textContent = link.label;", "  thoughtReportBugLink.href = \"https://github.com/inshell-art/inshell.art/issues/new\";\n  thoughtReportBugLink.target = link.target;\n  thoughtReportBugLink.rel = link.rel;\n  thoughtReportBugLink.ariaLabel = \"Report a problem\";\n  thoughtReportBugLink.textContent = \"Report a problem\";\n  thoughtReportBugLink.onclick = (event) => { event.preventDefault(); openSiteProblemReport(APP_BUILD); };"],
    ["  thoughtConsoleHistory = next;\n  writeThoughtConsoleHistory();","  if (input.kind === \"work_run_failed\" || input.kind === \"work_failed\") {\n    const entry = next.entries.at(-1);\n    if (entry) failureReportContexts.set(entry.id, {\n      agent: thoughtDockAdapterId, surface: thoughtDockRun?.surface ?? \"unknown\",\n      appVersion: APP_VERSION, build: APP_BUILD,\n      stage: input.kind === \"work_run_failed\" ? \"agent-run\" : \"app-run\",\n      simulated: import.meta.env.DEV && thoughtDockState.kind === \"failed\" && thoughtDockState.simulatedReportTest === true,\n    });\n  }\n  const retainedIds = new Set(next.entries.map((entry) => entry.id));\n  for (const id of failureReportContexts.keys()) if (!retainedIds.has(id)) failureReportContexts.delete(id);\n  thoughtConsoleHistory = next;\n  writeThoughtConsoleHistory();"],
    ["let thoughtDockState: ThoughtDockState = { kind: \"empty\" };","const failureReportContexts = new Map<string, Parameters<typeof openFailureReport>[0]>();\nlet thoughtDockState: ThoughtDockState = { kind: \"empty\" };"],
    ['      confirmedRunFailure?: boolean;', '      confirmedRunFailure?: boolean;\n      simulatedReportTest?: boolean;'],
    ['import "@inshell/shared/design.css";', 'import "@inshell/shared/design.css";\nimport { openFailureReport, installLocalFailureTest } from "./thought-failure-report";\nimport { openSiteProblemReport } from "@inshell/shared/problem-report";'],
    ["const shortRunId = (runId: string) =>", "installLocalFailureTest(() => {\n  if (runInFlight) return;\n  setThoughtDockState({ kind: \"failed\", message: `Simulated local UI failure ${Date.now()}`, confirmedRunFailure: true, simulatedReportTest: true });\n});\n\nconst shortRunId = (runId: string) =>"],
    ["const thoughtDockConsoleTime = () =>","const addThoughtConsoleFailureReportAction = (\n  element: HTMLElement,\n  entry: ThoughtConsoleEntry,\n) => {\n  const context = failureReportContexts.get(entry.id) ?? {\n    agent: \"unknown\", surface: \"unknown\", appVersion: \"unknown\", build: \"unknown\",\n    contextUnavailable: true,\n    stage: entry.kind === \"work_run_failed\" ? \"agent-run\" as const : \"app-run\" as const,\n  };\n  const line = statusScreenLine(\"\", { guidance: true });\n  const action = document.createElement(\"button\");\n  action.type = \"button\";\n  action.className = \"thought-dock-status-screen__link thought-dock-status-screen__action\";\n  action.textContent = \"[ Report this problem ]\";\n  action.setAttribute(\"aria-label\", \"Review a sanitized problem report\");\n  action.addEventListener(\"click\", () => openFailureReport(context));\n  line.append(action);\n  element.append(line);\n};\n\nconst thoughtDockConsoleTime = () =>"],
    ["    const runRecoveryAvailable = entry.id === runRecoveryEntryId;","    const runRecoveryAvailable = entry.id === runRecoveryEntryId;\n    const failureReportAvailable = entry.kind === \"work_run_failed\" || entry.kind === \"work_failed\";"],
    ["      runRecoveryAvailable,", "      runRecoveryAvailable,\n      failureReportAvailable,"],
    ["    element.dataset.consoleEntryId = entry.id;","    if (failureReportAvailable) {\n      addThoughtConsoleFailureReportAction(element, entry);\n    }\n    element.dataset.consoleEntryId = entry.id;"],
  ];
  for (const [before, after] of pairs) {
    source = replaceExactCount(source, "opt-in failure report",
      direction === "restore" ? after : before,
      direction === "restore" ? before : after);
  }
  return source;
};

const layerCurrentAgentLinePreviewUnavailableCopy = (source) => {
  let layered = replaceExactCount(
    source,
    "tagged preview-unavailable console copy",
    `      title: "preview unavailable",
      detail: "The App could not prepare the artwork preview.",`,
    `      title: "Agent line received",
      detail: state.rawCandidate,
      nextStep: "canonical artwork preview is unavailable in this environment",`,
  );
  layered = replaceExactCount(
    layered,
    "tagged preview-unavailable rail status",
    `        status: "Preview unavailable",`,
    `        status: "Agent line received",`,
  );
  return layered;
};

const TAGGED_DETAIL_SPEC_LINK = snapshotSource(String.raw`const thoughtSpecCachePayload = (spec: ActiveThoughtSpec) => ({
  chainId: THOUGHT_CHAIN_ID,
  registry: THOUGHT_SPEC_REGISTRY_ADDRESS,
  cacheKey: getThoughtSpecCacheKey(spec.specId, spec.specHash),
  source: {
    contract: "ThoughtSpecRegistry",
    read: "thoughtSpecText(bytes32)",
  },
  specId: spec.specId,
  specHash: spec.specHash,
  ref: spec.ref,
  pointer: spec.pointer,
  byteLength: spec.byteLength,
  text: spec.text,
  fetchedAt: spec.fetchedAt,
});

const specJsonFilename = (spec: ActiveThoughtSpec) =>
  \`\${(spec.ref || "THOUGHT.md").replace(/[^A-Za-z0-9._-]+/g, "-")}.\${shortHex(spec.specId, 8, 6)}.json\`;

const specLinkText = (ref?: string) => \`\${ref || "THOUGHT.v1.md"} ↗\`;

const setThoughtDetailSpecJsonLink = (spec: ActiveThoughtSpec) => {
  revokeThoughtDetailSpecJsonUrl();
  const json = JSON.stringify(thoughtSpecCachePayload(spec), null, 2);
  thoughtDetailSpecJsonUrl = URL.createObjectURL(new Blob([\`\${json}\n\`], { type: "application/json" }));
  thoughtDetailSpecRef.textContent = specLinkText(spec.ref);
  thoughtDetailSpecRef.href = thoughtDetailSpecJsonUrl;
  thoughtDetailSpecRef.target = "_blank";
  thoughtDetailSpecRef.rel = "noopener noreferrer";
  thoughtDetailSpecRef.title = \`Open local cached spec JSON: \${specJsonFilename(spec)}\`;
};

const clearThoughtDetailSpecJsonLink = (title = "Spec JSON loads after the spec is verified.") => {
  revokeThoughtDetailSpecJsonUrl();
  thoughtDetailSpecRef.href = "#";
  thoughtDetailSpecRef.removeAttribute("target");
  thoughtDetailSpecRef.removeAttribute("rel");
  thoughtDetailSpecRef.title = title;
};`);

const CURRENT_DETAIL_SPEC_LINK = snapshotSource(String.raw`const specMarkdownFilename = (ref?: string) => {
  const candidate = (ref || "").split(/[\\/]/).filter(Boolean).at(-1) ?? "";
  return /^[A-Za-z0-9._-]+\.md$/i.test(candidate) ? candidate : "THOUGHT.md";
};

const specLinkText = (ref?: string) => \`\${specMarkdownFilename(ref)} ↗\`;

const setThoughtDetailSpecJsonLink = (spec: ActiveThoughtSpec) => {
  revokeThoughtDetailSpecJsonUrl();
  thoughtDetailSpecJsonUrl = URL.createObjectURL(
    new Blob([spec.text], { type: "text/markdown;charset=utf-8" }),
  );
  const filename = specMarkdownFilename(spec.ref);
  thoughtDetailSpecRef.textContent = \`\${filename} ↗\`;
  thoughtDetailSpecRef.href = thoughtDetailSpecJsonUrl;
  thoughtDetailSpecRef.target = "_blank";
  thoughtDetailSpecRef.rel = "noopener noreferrer";
  thoughtDetailSpecRef.title = \`Open verified \${filename} Markdown from ThoughtSpecRegistry\`;
};

const clearThoughtDetailSpecJsonLink = (title = "Spec Markdown loads after the spec is verified.") => {
  revokeThoughtDetailSpecJsonUrl();
  thoughtDetailSpecRef.href = "#";
  thoughtDetailSpecRef.removeAttribute("target");
  thoughtDetailSpecRef.removeAttribute("rel");
  thoughtDetailSpecRef.title = title;
};`);

const TAGGED_DETAIL_SPEC_STATUS = Object.freeze([
  ["Loading local cached spec JSON...", "Loading verified spec Markdown..."],
  ["Spec JSON unavailable.", "Spec Markdown unavailable."],
  ["spec json unavailable.", "spec markdown unavailable."],
]);

const TAGGED_DETAIL_RAIL_TO_TRAITS = `          </section>
        </aside>

        <div class="thought-detail__support">
          <section class="thought-detail__section">
            <h2>canonical traits</h2>`;

const CURRENT_DETAIL_RAIL_TO_TRAITS = `          </section>

          <section class="thought-detail__section">
            <h2>canonical traits</h2>`;

const TAGGED_DETAIL_ONCHAIN_TO_RECORD = `          </section>
        </div>

        <details class="thought-detail__record thought-detail__verification">`;

const CURRENT_DETAIL_ONCHAIN_TO_RECORD = `          </section>
        </aside>

        <details class="thought-detail__record thought-detail__verification">`;

const PRE_TIGHT_DETAIL_CREATION_RECORD = `            <h2>creation provenance</h2>
            <p class="thought-detail__attestation-summary">
              <span id="thought-detail-attestation" class="thought-detail__attestation">-</span>
              <span id="thought-detail-attestation-copy">Reading the creation record.</span>
            </p>
            <dl class="thought-detail__fields">`;

const CURRENT_DETAIL_CREATION_RECORD = `            <h2>creation record</h2>
            <dl class="thought-detail__fields">`;

const TAGGED_DETAIL_LEGACY_HOOKS = `        <div class="thought-detail__legacy-hooks" hidden aria-hidden="true">
          <p id="thought-detail-canonical-title">-</p>`;

const CURRENT_DETAIL_LEGACY_HOOKS = `        <div class="thought-detail__legacy-hooks" hidden aria-hidden="true">
          <p id="thought-detail-attestation">-</p>
          <p id="thought-detail-attestation-copy">Reading the creation record.</p>
          <p id="thought-detail-canonical-title">-</p>`;

const PRE_TIGHT_DETAIL_TRAITS_SECTION = `          <section class="thought-detail__section">
            <h2>canonical traits</h2>
            <dl id="thought-detail-traits" class="thought-detail__fields">
              <div><dt>status</dt><dd>reading token metadata</dd></div>
            </dl>
          </section>

`;

const CURRENT_DETAIL_TRAITS_VERIFICATION = `            <div class="thought-detail__verification-traits">
              <h3>canonical traits</h3>
              <dl id="thought-detail-traits" class="thought-detail__fields">
                <div><dt>status</dt><dd>reading token metadata</dd></div>
              </dl>
            </div>
`;

const PRE_TIGHT_DETAIL_TOKEN_HEADING = "            <h2>on-chain record</h2>";
const CURRENT_DETAIL_TOKEN_HEADING = "            <h2>token details</h2>";
const PRE_TIGHT_DETAIL_TOKEN_SECTION = `          <section class="thought-detail__section">
${PRE_TIGHT_DETAIL_TOKEN_HEADING}`;
const CURRENT_DETAIL_RECORD_BODY = `          <div class="thought-detail__record-body">
`;

const CURRENT_DETAIL_STYLE_START =
  "\n/* INSHELL_CURRENT_THOUGHT_DETAIL_PATH_CANON_START */\n";
const CURRENT_DETAIL_STYLE_END =
  "/* INSHELL_CURRENT_THOUGHT_DETAIL_PATH_CANON_END */\n";

const POST_SNAPSHOT_INDEX_FRAGMENTS = [
  ["surface router", POST_SNAPSHOT_SURFACE_ROUTER],
  ["surface navigation", POST_SNAPSHOT_SURFACE_NAV],
  ["CLI title", POST_SNAPSHOT_CLI_TITLE],
];

function removeExactlyOnce(html, label, fragment) {
  const first = html.indexOf(fragment);
  const last = html.lastIndexOf(fragment);
  if (first === -1 || first !== last) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected exactly one ${label} delta`,
    );
  }
  return `${html.slice(0, first)}${html.slice(first + fragment.length)}`;
}

function replaceExactlyOnce(source, label, from, to) {
  const first = source.indexOf(from);
  const last = source.lastIndexOf(from);
  if (first === -1 || first !== last) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected exactly one ${label}`,
    );
  }
  return `${source.slice(0, first)}${to}${source.slice(first + from.length)}`;
}

function verifySnapshotBytes(label, source, expectedSha256) {
  const digest = createHash("sha256").update(source).digest("hex");
  if (digest !== expectedSha256) {
    throw new Error(
      `Refusing unverified THOUGHT ${label} snapshot: expected ${expectedSha256}, received ${digest}`,
    );
  }
  return source;
}

function replaceExactCount(source, label, from, to, expectedCount = 1) {
  const parts = source.split(from);
  const actualCount = parts.length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected ${expectedCount} ${label} delta(s), received ${actualCount}`,
    );
  }
  return parts.join(to);
}

function restorePreTightDetailGrouping(source) {
  let restored = replaceExactCount(
    source,
    "tight creation record",
    CURRENT_DETAIL_CREATION_RECORD,
    PRE_TIGHT_DETAIL_CREATION_RECORD,
  );
  restored = replaceExactCount(
    restored,
    "tight token details heading",
    CURRENT_DETAIL_TOKEN_HEADING,
    PRE_TIGHT_DETAIL_TOKEN_HEADING,
  );
  restored = replaceExactCount(
    restored,
    "tight canonical traits disclosure",
    CURRENT_DETAIL_TRAITS_VERIFICATION,
    "",
  );
  restored = replaceExactCount(
    restored,
    "pre-tight token details section",
    PRE_TIGHT_DETAIL_TOKEN_SECTION,
    `${PRE_TIGHT_DETAIL_TRAITS_SECTION}${PRE_TIGHT_DETAIL_TOKEN_SECTION}`,
  );
  return replaceExactCount(
    restored,
    "current hidden detail hooks",
    CURRENT_DETAIL_LEGACY_HOOKS,
    TAGGED_DETAIL_LEGACY_HOOKS,
  );
}

function layerTightDetailGrouping(source) {
  let layered = replaceExactCount(
    source,
    "pre-tight creation record",
    PRE_TIGHT_DETAIL_CREATION_RECORD,
    CURRENT_DETAIL_CREATION_RECORD,
  );
  layered = replaceExactCount(
    layered,
    "pre-tight canonical traits section",
    PRE_TIGHT_DETAIL_TRAITS_SECTION,
    "",
  );
  layered = replaceExactCount(
    layered,
    "pre-tight token details heading",
    PRE_TIGHT_DETAIL_TOKEN_HEADING,
    CURRENT_DETAIL_TOKEN_HEADING,
  );
  layered = replaceExactCount(
    layered,
    "current detail record body",
    CURRENT_DETAIL_RECORD_BODY,
    `${CURRENT_DETAIL_RECORD_BODY}${CURRENT_DETAIL_TRAITS_VERIFICATION}`,
  );
  return replaceExactCount(
    layered,
    "tagged hidden detail hooks",
    TAGGED_DETAIL_LEGACY_HOOKS,
    CURRENT_DETAIL_LEGACY_HOOKS,
  );
}

function restoreMainSnapshot(source) {
  source = applyFailureReportDelta(source, "restore");
  source = applyMono76DisplayDelta(source, "restore");
  let currentSource = applyCurrentThoughtLaunchMainDeltas(
    source,
    "restore",
    replaceExactCount,
  );
  currentSource = applyCurrentTrustedAgentLinkDeltas(currentSource, "restore");
  currentSource = applyCurrentSingleRunAgentChooserDeltas(currentSource, "restore");
  currentSource = restoreCurrentAgentRateLimitHandling(currentSource);
  currentSource = applyCurrentPreparedAgentChoiceDeltas(currentSource, "restore");
  currentSource = applyCurrentAgentLaunchDeltas(currentSource, "restore");
  currentSource = applyCurrentPinnedBrowserPreviewDeltas(currentSource, "restore");
  currentSource = applyCurrentMobileMainDeltas(currentSource, "restore");
  currentSource = replaceExactCount(
    currentSource,
    "current canonical gallery render",
    CURRENT_GALLERY_RENDER,
    "",
  );
  currentSource = replaceExactCount(
    currentSource,
    "current THOUGHT detail spec Markdown link",
    CURRENT_DETAIL_SPEC_LINK,
    TAGGED_DETAIL_SPEC_LINK,
  );
  for (const [tagged, current] of TAGGED_DETAIL_SPEC_STATUS) {
    currentSource = replaceExactCount(
      currentSource,
      `current THOUGHT detail spec status: ${current}`,
      current,
      tagged,
    );
  }
  let restored = replaceExactCount(
    currentSource,
    "CLI surface symbol",
    "IS_CLI_SURFACE",
    "IS_CLI_DEBUG",
    12,
  );
  const replacements = [
    [
      "current Agent-line preview-unavailable console copy",
      `      title: "Agent line received",
      detail: state.rawCandidate,
      nextStep: "canonical artwork preview is unavailable in this environment",`,
      `      title: "preview unavailable",
      detail: "The App could not prepare the artwork preview.",`,
    ],
    [
      "current Agent-line preview-unavailable rail status",
      `        status: "Agent line received",`,
      `        status: "Preview unavailable",`,
    ],
    [
      "CLI debug definition",
      'const IS_CLI_DEBUG = document.documentElement.classList.contains("cli-surface");',
      'const IS_CLI_DEBUG = ROUTE_SEARCH_PARAMS.get("debug") === "cli";',
    ],
    [
      "CLI title lookup",
      'const thoughtCliTitle = document.querySelector(".thought-cli-title") as HTMLElement | null;\n',
      "",
    ],
    [
      "CLI dock reserve",
      'if (IS_CLI_DEBUG || frontpageStage.classList.contains("is-hidden")) {',
      'if (frontpageStage.classList.contains("is-hidden")) {',
    ],
    [
      "CLI stacked breakpoint",
      'window.matchMedia(IS_CLI_DEBUG ? "(max-width: 900px)" : "(max-width: 1023px)").matches',
      'window.matchMedia("(max-width: 1023px)").matches',
    ],
    [
      "CLI heading lookup",
      "  const creationHeading = IS_CLI_DEBUG ? thoughtCliTitle : frontpageHeader;\n",
      "",
    ],
    [
      "CLI heading measurement",
      "  const headerHeight = visibleBlockOuterHeight(creationHeading);",
      "  const headerHeight = visibleBlockOuterHeight(frontpageHeader);",
    ],
    [
      "CLI viewport cap",
      `  if (IS_CLI_DEBUG) {
    if (isStackedOperatorLayout()) {
      return Math.max(
        MIN_CANVAS_SIZE,
        getStackedOperatorAvailableHeight() - STACKED_MIN_CLI_HEIGHT,
      );
    }

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const shellStyles = window.getComputedStyle(frontpageShell);
    const mainStyles = window.getComputedStyle(frontpageMain);
    const frameStyles = window.getComputedStyle(thoughtCanvasFrame);
    const shellInset = readPx(shellStyles.paddingTop) + readPx(shellStyles.paddingBottom);
    const frameInset = readPx(frameStyles.paddingTop) + readPx(frameStyles.paddingBottom);
    const titleHeight = visibleBlockOuterHeight(thoughtCliTitle);
    const rowGap = readPx(mainStyles.rowGap);
    const availableHeight = Math.floor(
      viewportHeight - shellInset - titleHeight - rowGap - frameInset,
    );

    return Math.max(MIN_CANVAS_SIZE, availableHeight);
  }

`,
      "",
    ],
    [
      "CLI idle canvas",
      `
  context.clearRect(0, 0, displayWidth, height);
  if (IS_CLI_DEBUG && !currentWorkSvg && !currentWorkImage) {
    context.fillStyle = readThoughtCssToken("--thought-cli-idle-canvas-bg");
    context.fillRect(0, 0, displayWidth, height);
    return;
  }

`,
      "",
    ],
    [
      "tagged canvas clear",
      `  );
  context.fillStyle = emptyFrameStyle.color;`,
      `  );

  context.clearRect(0, 0, displayWidth, height);
  context.fillStyle = emptyFrameStyle.color;`,
    ],
    [
      "CLI initial focus",
      `  if (!IS_RUN_PAGE && IS_CLI_DEBUG) {
    focusCliInput();
  } else if (!IS_RUN_PAGE) {
    focusThoughtDockPrompt({ preventScroll: true });
  }`,
      `  if (!IS_RUN_PAGE) {
    focusThoughtDockPrompt({ preventScroll: true });
  }`,
    ],
    [
      "current same-origin navigation scope",
      CURRENT_NAVIGATION_SCOPE,
      TAGGED_NAVIGATION_SCOPE,
    ],
    [
      "current canonical gallery route",
      CURRENT_GALLERY_REDIRECT,
      TAGGED_GALLERY_REDIRECT,
    ],
    [
      "current detail home configuration",
      CURRENT_DETAIL_HOME_CONFIGURATION,
      TAGGED_DETAIL_HOME_CONFIGURATION,
    ],
  ];
  for (const [label, from, to] of replacements) {
    restored = replaceExactCount(restored, label, from, to);
  }
  return restored;
}

function splitCurrentDetailStyle(source) {
  const startIndex = source.indexOf(CURRENT_DETAIL_STYLE_START);
  const endIndex = source.indexOf(CURRENT_DETAIL_STYLE_END);
  if (
    startIndex === -1 ||
    startIndex !== source.lastIndexOf(CURRENT_DETAIL_STYLE_START) ||
    endIndex === -1 ||
    endIndex !== source.lastIndexOf(CURRENT_DETAIL_STYLE_END) ||
    endIndex <= startIndex
  ) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected one current detail style overlay`,
    );
  }
  const overlayEnd = endIndex + CURRENT_DETAIL_STYLE_END.length;
  return {
    base: `${source.slice(0, startIndex)}${source.slice(overlayEnd)}`,
    overlay: source.slice(startIndex, overlayEnd),
  };
}

function restoreStyleSnapshot(source) {
  let restored = splitCurrentDetailStyle(source).base;
  const replacements = [
    [
      "CLI visual tokens",
      `  --thought-cli-canvas-column-gap: 18px;
  --thought-cli-canvas-row-gap: clamp(12px, 1.5vw, 20px);
  --thought-cli-canvas-frame-padding: 16px;
  --thought-cli-canvas-column-mobile-gap: 12px;
  --thought-cli-shell-padding-block-start: clamp(16px, 2.2vh, 28px);
  --thought-cli-shell-padding-inline: clamp(18px, 2.8vw, 52px);
  --thought-cli-shell-padding-block-end: clamp(14px, 2vh, 28px);
  --thought-cli-title-letter-spacing: 0.08em;
  --thought-cli-idle-canvas-bg: #050505;
`,
      "",
    ],
    [
      "creation grid",
      `  grid-template-rows: minmax(0, 1fr) auto;
  grid-template-areas:
    "canvas side"
    "panel side";`,
      `  grid-template-rows: minmax(0, 1fr);
  grid-template-areas:
    "canvas panel";`,
    ],
    [
      "Agent panel default",
      `  align-self: var(--thought-panel-row-alignment);
  justify-self: center;
  box-sizing: border-box;
  display: none;`,
      `  align-self: var(--thought-panel-row-alignment);
  box-sizing: border-box;
  display: flex;`,
    ],
    [
      "CLI panel default",
      `  position: relative;
  display: flex;
  flex-direction: column;`,
      `  position: relative;
  display: none;
  flex-direction: column;`,
    ],
    [
      "Agent surface overrides",
      `html.agent-surface .frontpage-side {
  display: none;
}

html.agent-surface .thought-panel {
  display: flex;
}

html.agent-surface body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
  grid-template-rows: minmax(0, 1fr);
  grid-template-areas:
    "canvas panel";
}

`,
      "",
    ],
    [
      "desktop creation grid",
      `  body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
    grid-template-columns: minmax(0, 1fr) var(--thought-panel-width);
    grid-template-areas:
      "canvas side"
      "panel side";
    column-gap: var(--thought-create-column-gap);`,
      `  body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
    grid-template-columns: minmax(0, 1fr) var(--thought-panel-width);
    grid-template-areas:
      "canvas panel";
    column-gap: var(--thought-create-column-gap);`,
    ],
    [
      "desktop debug and Agent grids",
      `  html.debug-cli body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
    max-width: var(--main-area-width);
    grid-template-columns: minmax(0, 1fr) var(--thought-panel-width);
    grid-template-areas:
      "canvas side"
      "panel side";
    column-gap: var(--thought-create-column-gap);
  }

  html.agent-surface body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
    grid-template-columns: minmax(0, 1fr) var(--thought-panel-width);
    grid-template-areas:
      "canvas panel";
    column-gap: var(--thought-create-column-gap);
  }`,
      `  html.debug-cli body.frontpage:has(.frontpage-stage:not(.is-hidden)) .frontpage-main {
    max-width: min(1440px, 100%);
    grid-template-columns: minmax(0, 1fr) var(--thought-panel-width) 360px;
    grid-template-areas:
      "canvas panel side";
    column-gap: 24px;
  }`,
    ],
  ];
  for (const [label, from, to] of replacements) {
    restored = replaceExactCount(restored, label, from, to);
  }

  const cliBlockMarker =
    "\n/* The canonical CLI creation surface preserves the exact June 10 production canvas. */\n";
  const markerIndex = restored.indexOf(cliBlockMarker);
  if (markerIndex === -1 || markerIndex !== restored.lastIndexOf(cliBlockMarker)) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: expected one terminal CLI block`,
    );
  }
  if (!restored.slice(markerIndex).endsWith("}\n")) {
    throw new Error(
      `Cannot restore ${THOUGHT_DEV_INDEX_SNAPSHOT.tag}: CLI block is not terminal`,
    );
  }
  return restored.slice(0, markerIndex);
}

export function restoreThoughtDevSnapshotSource(source, fileKey) {
  const snapshotFile = SNAPSHOT_FILES[fileKey];
  if (!snapshotFile) {
    throw new Error(`Unknown THOUGHT dev snapshot file: ${fileKey}`);
  }
  const restored = fileKey === "main"
    ? restoreMainSnapshot(source)
    : restoreStyleSnapshot(source);
  return verifySnapshotBytes(fileKey, restored, snapshotFile.sha256);
}

/**
 * Reverses only the three known post-tag index deltas. The resulting bytes must
 * match the immutable tagged index before Vite may serve them as the dev UI.
 */
export function restoreThoughtDevIndexSnapshot(html) {
  let current = replaceExactCount(
    html,
    "current THOUGHT detail home link",
    CURRENT_DETAIL_HOME_LINK,
    TAGGED_DETAIL_HOME_LINK,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT gallery create link",
    CURRENT_GALLERY_CREATE_LINK,
    TAGGED_GALLERY_CREATE_LINK,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT gallery home link",
    CURRENT_GALLERY_HOME_LINK,
    TAGGED_GALLERY_HOME_LINK,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT detail create link",
    CURRENT_DETAIL_CREATE_LINK,
    TAGGED_DETAIL_CREATE_LINK,
  );
  current = restorePreTightDetailGrouping(current);
  current = replaceExactCount(
    current,
    "current THOUGHT detail title hierarchy",
    CURRENT_DETAIL_TITLE,
    TAGGED_DETAIL_TITLE,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT detail rail opening",
    CURRENT_DETAIL_RAIL_TO_TRAITS,
    TAGGED_DETAIL_RAIL_TO_TRAITS,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT detail rail closing",
    CURRENT_DETAIL_ONCHAIN_TO_RECORD,
    TAGGED_DETAIL_ONCHAIN_TO_RECORD,
  );
  current = replaceExactCount(
    current,
    "current THOUGHT dock prompt label",
    ">\n                    Prompt\n                  </label>",
    ">\n                    prompt\n                  </label>",
  );
  current = replaceExactCount(
    current,
    "current THOUGHT dock prompt placeholder",
    'placeholder="Give a thought here"',
    'placeholder="give a thought here"',
  );
  current = replaceExactCount(
    current,
    "current THOUGHT dock works label",
    ">\n                  Load a saved work\n                </label>",
    ">\n                  load a saved work\n                </label>",
  );
  current = replaceExactCount(
    current,
    "current THOUGHT dock $PATH label",
    ">\n                    Available $PATH\n                  </p>",
    ">\n                    available $PATH\n                  </p>",
  );
  const restored = POST_SNAPSHOT_INDEX_FRAGMENTS.reduce(
    (current, [label, fragment]) => removeExactlyOnce(current, label, fragment),
    current,
  );
  verifySnapshotBytes("index", restored, THOUGHT_DEV_INDEX_SNAPSHOT.indexSha256);

  let layered = replaceExactCount(
    restored,
    "tagged THOUGHT detail title hierarchy",
    TAGGED_DETAIL_TITLE,
    CURRENT_DETAIL_TITLE,
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT detail rail opening",
    TAGGED_DETAIL_RAIL_TO_TRAITS,
    CURRENT_DETAIL_RAIL_TO_TRAITS,
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT detail rail closing",
    TAGGED_DETAIL_ONCHAIN_TO_RECORD,
    CURRENT_DETAIL_ONCHAIN_TO_RECORD,
  );
  // The creation panel uses sentence case now; layer it back over the tagged
  // snapshot so the dev Agent surface shows the current labels.
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT dock prompt label",
    ">\n                    prompt\n                  </label>",
    ">\n                    Prompt\n                  </label>",
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT dock prompt placeholder",
    'placeholder="give a thought here"',
    'placeholder="Give a thought here"',
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT dock works label",
    ">\n                  load a saved work\n                </label>",
    ">\n                  Load a saved work\n                </label>",
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT dock $PATH label",
    ">\n                    available $PATH\n                  </p>",
    ">\n                    Available $PATH\n                  </p>",
  );
  layered = layerTightDetailGrouping(layered);
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT detail home link",
    TAGGED_DETAIL_HOME_LINK,
    CURRENT_DETAIL_HOME_LINK,
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT gallery create link",
    TAGGED_GALLERY_CREATE_LINK,
    CURRENT_GALLERY_CREATE_LINK,
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT gallery home link",
    TAGGED_GALLERY_HOME_LINK,
    CURRENT_GALLERY_HOME_LINK,
  );
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT detail create link",
    TAGGED_DETAIL_CREATE_LINK,
    CURRENT_DETAIL_CREATE_LINK,
  );
  const query = `${THOUGHT_DEV_SNAPSHOT_QUERY_PARAM}=${THOUGHT_DEV_SNAPSHOT_QUERY_VALUE}`;
  return [
    ["tagged stylesheet reference", 'href="/src/style.css"', `href="/src/style.css?${query}"`],
    ["tagged main reference", 'src="/src/main.ts"', `src="/src/main.ts?${query}"`],
  ].reduce(
    (current, [label, from, to]) => replaceExactlyOnce(current, label, from, to),
    layered,
  );
}

export function loadThoughtDevSnapshotFile(workspaceRoot, fileKey) {
  const snapshotFile = SNAPSHOT_FILES[fileKey];
  if (!snapshotFile) {
    throw new Error(`Unknown THOUGHT dev snapshot file: ${fileKey}`);
  }
  const currentSource = readFileSync(path.resolve(workspaceRoot, snapshotFile.path), "utf8");
  const verifiedSnapshot = restoreThoughtDevSnapshotSource(currentSource, fileKey);
  if (fileKey === "style") {
    return `${verifiedSnapshot}${splitCurrentDetailStyle(currentSource).overlay}`;
  }

  // Keep the tagged visual/runtime snapshot byte-verified, then layer only the
  // current same-origin navigation policy required by local and LAN runtimes.
  const currentNavigationScope = replaceExactCount(
    verifiedSnapshot,
    "tagged same-origin navigation scope",
    TAGGED_NAVIGATION_SCOPE,
    CURRENT_NAVIGATION_SCOPE,
  );
  const currentGalleryRedirect = replaceExactCount(
    currentNavigationScope,
    "tagged gallery redirect",
    TAGGED_GALLERY_REDIRECT,
    CURRENT_GALLERY_REDIRECT,
  );
  const currentDetailHomeConfiguration = replaceExactCount(
    currentGalleryRedirect,
    "tagged detail home configuration",
    TAGGED_DETAIL_HOME_CONFIGURATION,
    CURRENT_DETAIL_HOME_CONFIGURATION,
  );
  let currentSpecLink = replaceExactCount(
    currentDetailHomeConfiguration,
    "tagged THOUGHT detail spec JSON link",
    TAGGED_DETAIL_SPEC_LINK,
    CURRENT_DETAIL_SPEC_LINK,
  );
  for (const [tagged, current] of TAGGED_DETAIL_SPEC_STATUS) {
    currentSpecLink = replaceExactCount(
      currentSpecLink,
      `tagged THOUGHT detail spec status: ${tagged}`,
      tagged,
      current,
    );
  }
  const currentGalleryRender = replaceExactCount(
    currentSpecLink,
    "tagged thought render marker",
    TAGGED_THOUGHT_RENDER_MARKER,
    `${CURRENT_GALLERY_RENDER}${TAGGED_THOUGHT_RENDER_MARKER}`,
  );
  const currentMobile = applyCurrentMobileMainDeltas(currentGalleryRender, "layer");
  const currentBrowserPreview = applyCurrentPinnedBrowserPreviewDeltas(currentMobile, "layer");
  const currentAgentLaunch = applyCurrentAgentLaunchDeltas(currentBrowserPreview, "layer");
  const currentPreparedAgentChoices = applyCurrentPreparedAgentChoiceDeltas(
    currentAgentLaunch,
    "layer",
  );
  const currentAgentRateLimitHandling = layerCurrentAgentRateLimitHandling(
    currentPreparedAgentChoices,
  );
  const currentSingleRunAgentChooser = applyCurrentSingleRunAgentChooserDeltas(
    currentAgentRateLimitHandling,
    "layer",
  );
  const currentTrustedAgentLinks = applyCurrentTrustedAgentLinkDeltas(
    currentSingleRunAgentChooser,
    "layer",
  );
  const currentAgentLinePreview = layerCurrentAgentLinePreviewUnavailableCopy(
    currentTrustedAgentLinks,
  );
  return applyFailureReportDelta(applyMono76DisplayDelta(applyCurrentThoughtLaunchMainDeltas(
    currentAgentLinePreview,
    "layer",
    replaceExactCount,
  ), "layer"), "layer");
}

export function loadThoughtDevSnapshotModule(workspaceRoot, id) {
  const queryStart = id.indexOf("?");
  if (queryStart === -1) return null;
  const query = new URLSearchParams(id.slice(queryStart + 1));
  if (
    query.get(THOUGHT_DEV_SNAPSHOT_QUERY_PARAM) !==
    THOUGHT_DEV_SNAPSHOT_QUERY_VALUE
  ) {
    return null;
  }

  const requestedPath = path.resolve(id.slice(0, queryStart));
  const fileKey = Object.entries(SNAPSHOT_FILES).find(([, file]) =>
    requestedPath === path.resolve(workspaceRoot, file.path)
  )?.[0];
  if (!fileKey) {
    throw new Error(`Unexpected THOUGHT snapshot module request: ${id}`);
  }
  return loadThoughtDevSnapshotFile(workspaceRoot, fileKey);
}

export function shouldRestoreThoughtDevIndexSnapshot(originalUrl, path) {
  const requestUrl = new URL(originalUrl || path || "/", "http://thought.local");
  const normalizedPath = requestUrl.pathname.replace(/\/+$/, "") || "/";
  const requestedSurface = requestUrl.searchParams.get("surface");
  return (
    (normalizedPath === "/" || normalizedPath === "/thought") &&
    requestUrl.searchParams.get("debug") !== "cli" &&
    (requestedSurface === null || requestedSurface === "agent")
  );
}

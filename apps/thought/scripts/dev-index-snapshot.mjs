import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

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
  mainSha256: "ffbfd1f2a7818c68aec6e07096c4be80c9df4dfdda0df23f2d4fd01563c7e939",
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
      const isCliSurface =
        params.get("debug") === "cli" ||
        requestedSurface === "cli";
      document.documentElement.classList.add(isCliSurface ? "cli-surface" : "agent-surface");
`;

const POST_SNAPSHOT_CLI_TITLE =
  `          <h1 class="frontpage-title thought-cli-title">THOUGHT</h1>\n`;

const TAGGED_DETAIL_TITLE = `        <div>
          <h1 id="thought-detail-title" class="thought-detail__title">THOUGHT #<span id="thought-detail-token-id">-</span></h1>
        </div>`;

const CURRENT_DETAIL_TITLE = `        <h1 id="thought-detail-title" class="thought-detail__title">THOUGHT #<span id="thought-detail-token-id">-</span></h1>`;

const TAGGED_DETAIL_HOME_LINK = `          <a id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/gallery">[ gallery ]</a>`;

const CURRENT_DETAIL_HOME_LINK = `          <a id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/">[ home ]</a>`;

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
  let currentSource = applyCurrentMobileMainDeltas(source, "restore");
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
  layered = layerTightDetailGrouping(layered);
  layered = replaceExactCount(
    layered,
    "tagged THOUGHT detail home link",
    TAGGED_DETAIL_HOME_LINK,
    CURRENT_DETAIL_HOME_LINK,
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
  return applyCurrentMobileMainDeltas(currentGalleryRender, "layer");
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

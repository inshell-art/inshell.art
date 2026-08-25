#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadThoughtDevSnapshotFile,
  restoreThoughtDevIndexSnapshot,
} from "../apps/thought/scripts/dev-index-snapshot.mjs";
import {
  assertDetailSurfaceActionLayout,
  assertDetailSurfaceNavigation,
} from "./detail-surface-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockRelativePath = "apps/thought/production/detail-surface-contract.lock.json";
const lockPath = path.join(root, lockRelativePath);

// This digest is intentionally independent from the lock file. Updating it is
// an explicit product-contract acceptance action, never a build/generate step.
const acceptedLockSha256 =
  "91ec88004d0e62df4c3d0d70ff7ac471cbeb800e43bd51a98d7bafcff8779fdf";

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const fail = (message) => {
  throw new Error(`Detail surface contract check failed: ${message}`);
};
const assert = (condition, message) => {
  if (!condition) fail(message);
};
const mustInclude = (source, snippet, label) => {
  assert(source.includes(snippet), `${label} drifted`);
};
const compactCssValue = (value) => value.replace(/\s+/g, " ").trim();
const cssVariableValues = (source, variableName) => [
  ...source.matchAll(new RegExp(`${variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`, "g")),
].map((match) => compactCssValue(match[1]));
const requireCssVariable = (source, variableName, expected, label) => {
  const values = cssVariableValues(source, variableName);
  assert(
    values.includes(expected),
    `${label} must declare ${variableName}: ${expected}; found ${JSON.stringify(values)}`,
  );
};
const headings = (source, pattern) => [...source.matchAll(pattern)].map((match) => match[1]);

const lockBytes = fs.readFileSync(lockPath);
const lockSha256 = createHash("sha256").update(lockBytes).digest("hex");
assert(
  lockSha256 === acceptedLockSha256,
  `${lockRelativePath} changed without an explicit accepted digest update`,
);
const lock = JSON.parse(lockBytes.toString("utf8"));
assert(lock.schema === "inshell.detail-surface-contract-lock.v1", "lock schema mismatch");
assert(lock.artifactId === "inshell-detail-surface-contract-20260824-r2", "artifact ID mismatch");
assert(lock.status === "operator-accepted", "contract is not operator accepted");
assert(lock.authority?.layoutCanon === "PATH detail", "PATH detail is not the layout canon");
assert(
  lock.authority?.navigationRecoveryCommit ===
    "5180f71764b33a40f9e68243ffe87a0fb57ea7fb",
  "navigation recovery authority changed",
);

const homeDetail = read("apps/home/src/components/ThoughtDetailPage.tsx");
const homeCss = read("apps/home/src/main.css");
const standaloneIndex = read("apps/thought/index.html");
const standaloneMain = read("apps/thought/src/main.ts");
const standaloneCss = read("apps/thought/src/style.css");
const restoredIndex = restoreThoughtDevIndexSnapshot(standaloneIndex);
const restoredMain = loadThoughtDevSnapshotFile(root, "main");
const restoredStyle = loadThoughtDevSnapshotFile(root, "style");

assertDetailSurfaceNavigation({
  contract: lock,
  homeDetail,
  standaloneIndex,
  standaloneMain,
  restoredIndex,
  restoredMain,
});
assertDetailSurfaceActionLayout({
  contract: lock,
  homeCss,
  standaloneCss,
  restoredCss: restoredStyle,
});

mustInclude(homeDetail, lock.thoughtDetail.create.label, "Home THOUGHT create label");
mustInclude(homeDetail, "href={thoughtAppUrl()}", "Home THOUGHT create route");
mustInclude(standaloneMain, 'url.searchParams.set("new", "1");', "standalone fresh-create query");

const homeRailHeadings = headings(homeDetail, /<ThoughtSection title="([^"]+)">/g);
assert(
  JSON.stringify(homeRailHeadings) === JSON.stringify(lock.thoughtDetail.railHeadings),
  `Home THOUGHT rail headings drifted: ${JSON.stringify(homeRailHeadings)}`,
);
const standaloneRailMatch = standaloneIndex.match(
  /<aside class="thought-detail__rail"[\s\S]*?<\/aside>/,
);
assert(standaloneRailMatch, "standalone THOUGHT rail is missing");
const standaloneRailHeadings = headings(standaloneRailMatch[0], /<h2>([^<]+)<\/h2>/g);
assert(
  JSON.stringify(standaloneRailHeadings) === JSON.stringify(lock.thoughtDetail.railHeadings),
  `standalone THOUGHT rail headings drifted: ${JSON.stringify(standaloneRailHeadings)}`,
);
for (const heading of lock.thoughtDetail.collapsedRecordHeadings) {
  mustInclude(standaloneIndex, `<h3>${heading}</h3>`, `standalone collapsed ${heading} heading`);
  mustInclude(restoredIndex, `<h3>${heading}</h3>`, `restored collapsed ${heading} heading`);
}

const visuals = lock.pathCanonicalVisuals;
const tokenPairs = [
  ["fontWeight", "--path-detail-font-weight", "--thought-detail-font-weight"],
  ["desktopRailWidth", "--path-detail-rail-width", "--thought-detail-rail-width"],
  ["desktopLayoutGap", "--path-detail-layout-gap", "--thought-detail-layout-gap"],
  ["headerGap", "--path-detail-header-gap", "--thought-detail-header-gap"],
  ["headerMarginBottom", "--path-detail-header-margin-bottom", "--thought-detail-header-margin-bottom"],
  ["sectionGap", "--path-detail-section-gap", "--thought-detail-section-gap"],
  ["sectionPadding", "--path-detail-section-padding", "--thought-detail-section-padding"],
  ["sectionHeadingGap", "--path-detail-section-heading-gap", "--thought-detail-section-title-gap"],
  ["fieldGap", "--path-detail-field-gap", "--thought-detail-field-gap"],
  ["fieldLabelWidth", "--path-detail-field-label-width", "--thought-detail-field-label-width"],
  ["fieldColumnGap", "--path-detail-field-column-gap", "--thought-detail-field-column-gap"],
  ["textLineHeight", "--path-detail-text-line-height", "--thought-detail-text-line-height"],
  ["labelLetterSpacing", "--path-detail-label-letter-spacing", "--thought-detail-label-letter-spacing"],
  ["tabletPanelSize", "--path-detail-tablet-panel-size", "--thought-detail-tablet-panel-size"],
  ["tabletGutter", "--path-detail-tablet-gutter", "--thought-detail-tablet-gutter"],
  ["mobileGutter", "--path-detail-mobile-gutter", "--thought-detail-mobile-gutter"],
  ["mobileLayoutGap", "--path-detail-mobile-layout-gap", "--thought-detail-mobile-layout-gap"],
  ["mobileHeaderGap", "--path-detail-mobile-header-gap", "--thought-detail-mobile-header-gap"],
];

for (const [contractKey, pathVariable, thoughtVariable] of tokenPairs) {
  const expected = visuals[contractKey];
  requireCssVariable(homeCss, pathVariable, expected, "PATH detail canon");
  requireCssVariable(homeCss, thoughtVariable, expected, "Home THOUGHT detail");
  requireCssVariable(standaloneCss, thoughtVariable, expected, "standalone THOUGHT detail");
  requireCssVariable(restoredStyle, thoughtVariable, expected, "restored THOUGHT detail");
}

for (const source of [homeCss, standaloneCss, restoredStyle]) {
  mustInclude(source, "color: var(--text);", "detail primary copy color");
  mustInclude(source, "color: var(--muted);", "detail label color");
  mustInclude(source, "font-weight: var(--weight-thin);", "detail title weight");
}
mustInclude(homeCss, "@media (max-width: 980px)", "PATH/THOUGHT tablet breakpoint");
mustInclude(homeCss, "@media (max-width: 760px)", "PATH/THOUGHT mobile breakpoint");
mustInclude(standaloneCss, "@media (max-width: 980px)", "standalone tablet breakpoint");
mustInclude(standaloneCss, "@media (max-width: 760px)", "standalone mobile breakpoint");

console.log(JSON.stringify({
  artifactId: lock.artifactId,
  layoutCanon: lock.authority.layoutCanon,
  lockSha256,
  navigationRecoveryCommit: lock.authority.navigationRecoveryCommit,
  surfacesChecked: ["Home PATH", "Home THOUGHT", "standalone THOUGHT", "restored THOUGHT snapshot"],
}, null, 2));

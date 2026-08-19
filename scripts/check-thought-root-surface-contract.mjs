#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadThoughtDevSnapshotFile,
  restoreThoughtDevIndexSnapshot,
  THOUGHT_DEV_INDEX_SNAPSHOT,
} from "../apps/thought/scripts/dev-index-snapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockRelativePath = "apps/thought/production/root-surface-contract.lock.json";
const lockPath = path.join(root, lockRelativePath);

// Independent acceptance anchor. Generators must never update this digest.
const acceptedLockSha256 =
  "8dc97923a8ee309dd8cf0dc3e32cc107a0f180ad3b5f89572b9ec62bbe9451bf";

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const lockBytes = fs.readFileSync(lockPath);
const lockSha256 = createHash("sha256").update(lockBytes).digest("hex");

assert.equal(
  lockSha256,
  acceptedLockSha256,
  `${lockRelativePath} changed without an explicit accepted digest update`,
);

const lock = JSON.parse(lockBytes.toString("utf8"));
assert.equal(lock.schema, "inshell.thought-root-surface-contract-lock.v1");
assert.equal(lock.artifactId, "inshell-thought-root-surface-20260817-r1");
assert.equal(lock.status, "operator-accepted");
assert.equal(lock.route, "/thought");
assert.equal(lock.defaultSurface, "agent");
assert.deepEqual(lock.snapshot, THOUGHT_DEV_INDEX_SNAPSHOT);

const restoredIndex = restoreThoughtDevIndexSnapshot(read("apps/thought/index.html"));
const restoredMain = loadThoughtDevSnapshotFile(root, "main");
const restoredStyle = loadThoughtDevSnapshotFile(root, "style");
const packageJson = read("package.json");
const viteConfig = read("apps/thought/vite.config.ts");
const linksSource = read("packages/inshell-shell/src/links.ts");

for (const required of [
  `id="${lock.requiredSurface.titleId}"`,
  `class="${lock.requiredSurface.titleClass}"`,
  `id="${lock.requiredSurface.agentPanelId}"`,
  `id="${lock.requiredSurface.promptId}"`,
]) {
  assert.ok(restoredIndex.includes(required), `locked root surface is missing ${required}`);
}
assert.match(
  restoredStyle,
  /\.thought-panel\s*\{[\s\S]*?display:\s*flex;/,
  "locked Agent panel must be visible by default",
);
assert.match(
  restoredStyle,
  /\.frontpage-side\s*\{[\s\S]*?display:\s*none;/,
  "legacy operator panel must be hidden by default",
);
assert.match(
  restoredMain,
  /const INSHELL_LINKS = resolveInshellLinks\(\);/,
  "locked root must use the shared product-link resolver",
);

assert.ok(
  packageJson.includes(lock.build.requiredEnvironment),
  "same-origin THOUGHT build must opt into the locked surface",
);
assert.match(
  viteConfig,
  /useLockedSurface \? undefined : "serve"/,
  "the locked surface plugin must run during the opted-in production build",
);
assert.match(
  viteConfig,
  /useLockedSurface \|\| shouldRestoreThoughtDevIndexSnapshot/,
  "the opted-in build must restore the byte-verified root snapshot",
);
assert.ok(
  linksSource.includes(`normalized.endsWith(".${lock.sameOriginNavigation.pagesProjectHost}")`),
  "immutable and branch Pages hosts must be recognized",
);
assert.match(
  linksSource,
  /isInshellPagesPreviewHost\(hostname\)[\s\S]*?return sameOriginLinks\(origin\)/,
  "Pages previews must keep product navigation on the inspected artifact origin",
);

console.log(
  `[thought-root-surface] OK ${lock.artifactId} (${lockSha256.slice(0, 12)})`,
);

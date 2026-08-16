import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
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
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const contract = JSON.parse(
  read("apps/thought/production/detail-surface-contract.lock.json"),
);
const accepted = {
  contract,
  homeDetail: read("apps/home/src/components/ThoughtDetailPage.tsx"),
  standaloneIndex: read("apps/thought/index.html"),
  standaloneMain: read("apps/thought/src/main.ts"),
  restoredIndex: restoreThoughtDevIndexSnapshot(read("apps/thought/index.html")),
  restoredMain: loadThoughtDevSnapshotFile(root, "main"),
  homeCss: read("apps/home/src/main.css"),
  standaloneCss: read("apps/thought/src/style.css"),
  restoredCss: loadThoughtDevSnapshotFile(root, "style"),
};

test("accepts the operator-locked detail navigation on both THOUGHT surfaces", () => {
  assert.doesNotThrow(() => assertDetailSurfaceNavigation(accepted));
});

test("rejects the known standalone partial revert from Home back to gallery", () => {
  const partiallyReverted = {
    ...accepted,
    standaloneIndex: accepted.standaloneIndex.replace(
      'id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/">[ home ]',
      'id="thought-detail-gallery-link" class="thought-detail__link" href="https://inshell.art/gallery">[ gallery ]',
    ),
    standaloneMain: accepted.standaloneMain.replace(
      "thoughtDetailGalleryLink.href = inshellHomeUrl(ROUTE_THOUGHT_NFT_ID);",
      "thoughtDetailGalleryLink.href = galleryUrl(ROUTE_THOUGHT_NFT_ID);",
    ),
  };

  assert.throws(
    () => assertDetailSurfaceNavigation(partiallyReverted),
    /standalone THOUGHT detail return drifted/,
  );
});

test("rejects a Home detail return that stops targeting its matching card", () => {
  const partiallyReverted = {
    ...accepted,
    homeDetail: accepted.homeDetail.replace(
      'href={`/#thought-${tokenId}`}',
      'href={`/gallery#thought-${tokenId}`}',
    ),
  };

  assert.throws(
    () => assertDetailSurfaceNavigation(partiallyReverted),
    /Home THOUGHT detail return href drifted/,
  );
});

test("keeps bracketed PATH and THOUGHT detail actions atomic", () => {
  assert.doesNotThrow(() => assertDetailSurfaceActionLayout(accepted));
});

test("rejects the reported PATH mint action line break", () => {
  const wrappedAction = {
    ...accepted,
    homeCss: accepted.homeCss.replace(
      `.path-detail__link {
  font-size: var(--font-size-16);
  white-space: nowrap;
}`,
      `.path-detail__link {
  font-size: var(--font-size-16);
  white-space: normal;
}`,
    ),
  };

  assert.throws(
    () => assertDetailSurfaceActionLayout(wrappedAction),
    /Home PATH action must keep \.path-detail__link white-space: nowrap;/,
  );
});

test("rejects a THOUGHT work label that drifts from the record-key color", () => {
  const primaryLabel = {
    ...accepted,
    standaloneCss: accepted.standaloneCss.replace(
      `.thought-detail__dialogue-role {
  color: var(--muted);
  line-height: var(--thought-detail-text-line-height);`,
      `.thought-detail__dialogue-role {
  color: var(--text);
  line-height: var(--thought-detail-text-line-height);`,
    ),
  };

  assert.throws(
    () => assertDetailSurfaceActionLayout(primaryLabel),
    /standalone THOUGHT work label must end with \.thought-detail__dialogue-role color: var\(--muted\);/,
  );
});

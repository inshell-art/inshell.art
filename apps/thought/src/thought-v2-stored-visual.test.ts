import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  isCurrentThoughtV2ContractSvg,
  normalizeThoughtV2StoredVisual,
} from "./thought-v2-stored-visual";

const implementationId =
  "inshell.thought.renderer.v2.humanist-smooth-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom";
const currentSvg = [
  `<svg data-renderer="${implementationId}">`,
  '<rect id="work-frame" width="1024" height="1024" fill="#006100"/>',
  "<defs><path id=\"g1\"/></defs>",
  '<g id="prompt-line"><use href="#g1"/></g>',
  '<g id="agent-line"><use href="#g1"/></g>',
  "</svg>",
].join("");
const currentImage =
  `data:image/svg+xml;base64,${Buffer.from(currentSvg, "utf8").toString("base64")}`;
const staleSvg =
  '<svg width="960" height="960"><g id="binary-background"/><text>stale</text></svg>';

test("keeps the exact current metadata image URI", () => {
  assert.equal(isCurrentThoughtV2ContractSvg(currentSvg, implementationId), true);
  assert.deepEqual(
    normalizeThoughtV2StoredVisual({
      image: currentImage,
      implementationId,
      svg: currentSvg,
    }),
    {
      image: currentImage,
      migrated: false,
      svg: currentSvg,
    },
  );
});

test("recovers current SVG bytes from metadata.image without rebuilding them", () => {
  assert.deepEqual(
    normalizeThoughtV2StoredVisual({
      image: currentImage,
      implementationId,
      svg: staleSvg,
    }),
    {
      image: currentImage,
      migrated: true,
      svg: currentSvg,
    },
  );
});

test("drops a stale renderer instead of reconstructing it", () => {
  assert.deepEqual(
    normalizeThoughtV2StoredVisual({
      image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(staleSvg)}`,
      implementationId,
      svg: staleSvg,
    }),
    {
      image: "",
      migrated: true,
      svg: "",
    },
  );
});

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  isCurrentThoughtV2ContractSvg,
  normalizeThoughtV2StoredVisual,
  thoughtV2DisplayImage,
} from "./thought-v2-stored-visual";
import { buildThoughtV2Svg } from "./thought-v2-renderer";

const implementationId =
  "inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom";
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

test("corrects only the exact known browser-preview regression for display without altering saved bytes", () => {
  const corrected = buildThoughtV2Svg({ promptLine: "Hey?", agentLine: "Here. Still awake, still listening. What are we making?" });
  const legacy = corrected.replaceAll(' stroke-linecap="round" stroke-linejoin="round"', "")
    .replace(/(<use href="#g-[0-9a-f]+" x=")(\d+)("\/?>)/g, (_m, a, x, b) => `${a}${Number(x) - 1}${b}`);
  const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(legacy)}`;
  const saved = normalizeThoughtV2StoredVisual({ svg: legacy, image, implementationId });
  const displayed = thoughtV2DisplayImage(saved.image);
  assert.equal(decodeURIComponent(displayed.slice(displayed.indexOf(",") + 1)), corrected);
  assert.equal(saved.svg, legacy);
  assert.equal(saved.image, image);
  assert.equal(saved.migrated, false);
  assert.equal(thoughtV2DisplayImage(displayed), displayed);
  const tampered = image.replace(encodeURIComponent('d="M.35'), encodeURIComponent('d="M.36'));
  assert.notEqual(tampered, image);
  assert.equal(thoughtV2DisplayImage(tampered), tampered);
  assert.equal(thoughtV2DisplayImage(currentImage), currentImage);
});

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

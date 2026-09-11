import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildThoughtV2Svg } from "./thought-v2-renderer";

const release = new URL("../contract-release/releases/thought-v2-canonical-portable-release-20260807-r2/", import.meta.url);
const faceBytes = readFileSync(new URL("dependencies/mono-76/glyphs.json", release));
const face = JSON.parse(faceBytes.toString());
const profile = JSON.parse(readFileSync(new URL("protocol/current/v2/renderer/thought.renderer.v2.profile.json", release), "utf8"));

test("browser artwork preserves the sealed Mono 76 face and its complete paint contract", () => {
  assert.equal(createHash("sha256").update(faceBytes).digest("hex"), profile.glyphSource.faceSha256);
  const svg = buildThoughtV2Svg({ promptLine: "Hey?", agentLine: "Here. Still awake, still listening. What are we making?" });
  for (const field of ["prompt", "agent"]) {
    const group = svg.match(new RegExp(`<g id="${field}-line"[^>]*>`))![0];
    for (const [attribute, value] of Object.entries({ fill: profile.paint.fill, stroke: profile.paint.stroke, "stroke-width": profile.paint.strokeWidth, "stroke-linecap": profile.paint.strokeLinecap, "stroke-linejoin": profile.paint.strokeLinejoin })) {
      assert.ok(group.includes(`${attribute}="${value}"`), `${field}: missing ${attribute}=${value}`);
    }
  }
  assert.equal((svg.match(/<path /g) ?? []).length, 75);
  assert.doesNotMatch(svg, /<text\b|foreignObject|font-family|@font-face/);
  for (const glyph of face.glyphs.filter((g: { character: string }) => g.character !== " ")) {
    assert.ok(svg.includes(`id="g-${glyph.character.codePointAt(0).toString(16)}" d="${glyph.d}"`));
  }
});

test("glyphs keep fixed advance, one global origin shift, and no second optical translation", () => {
  const svg = buildThoughtV2Svg({ promptLine: "THOUGHT WILL AWA!", agentLine: "i j & PATH" });
  assert.ok(svg.includes('<use href="#g-69" x="1"/>'));
  assert.ok(svg.includes('<use href="#g-6a" x="21"/>'));
  assert.ok(svg.includes('<use href="#g-26" x="41"/>'));
  assert.ok(svg.includes('translate(57.6 811.52) scale(2.88 -2.88)'));
  const promptX = 57.6 + 844.8 - "THOUGHT WILL AWA!".length * 10 * 2.88;
  assert.ok(svg.includes(`translate(${promptX} 171.52) scale(2.88 -2.88)`));
});

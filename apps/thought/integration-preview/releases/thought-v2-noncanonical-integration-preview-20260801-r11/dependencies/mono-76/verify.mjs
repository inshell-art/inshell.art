import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMono76Font,
  assertMono76Text,
  loadMono76Font,
  renderMono76Line,
  supportsMono76Text
} from "./index.mjs";
import {
  decodeMono76PackedGlyph,
  inspectMono76Packed
} from "./onchain/decoder.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPERTOIRE = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,?!:;'\"-()/&";
const EXPECTED_FACE_SHA256 = "7ed61ed6335fce2c1e58184916f5d344b8384fc05d4c616e83c35ad4fa9ed47f";
const EXPECTED_PACKED_SHA256 = "3acc0a9cf60c00aa2d512356386d1e2a999499896e25661e8e631d53d5e10926";
const EXPECTED_PACKED_KECCAK256 = "0xba37d00bb395b84f0487791300a29cdd2b1712b078fa218c6ed74fa11d74a081";
const EXPECTED_PACKED_BYTES = 4600;
const EXPECTED_PATH_BYTES = 4438;
const EXPECTED_MANUAL_EDIT_SHA256 = "755f16a8f70d9141a8b2175bc1bafeaef93ead366179d85f3597bc3dfc9ddc56";
const EXPECTED_VERSION = "1.0.0";
const EXPECTED_TAG = "v1.0.0";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonicalJson = (value) => {
  const normalize = (item) => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, normalize(item[key])])
      );
    }
    return item;
  };
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
};

const [faceText, manifestText, metadataText, packageText, packed, packedHex] =
  await Promise.all([
    readFile(path.join(ROOT, "glyphs.json"), "utf8"),
    readFile(path.join(ROOT, "manifest.json"), "utf8"),
    readFile(path.join(ROOT, "onchain/metadata.json"), "utf8"),
    readFile(path.join(ROOT, "package.json"), "utf8"),
    readFile(path.join(ROOT, "onchain/packed.bin")),
    readFile(path.join(ROOT, "onchain/packed.hex"), "utf8")
  ]);
const face = JSON.parse(faceText);
const manifest = JSON.parse(manifestText);
const metadata = JSON.parse(metadataText);
const packageJson = JSON.parse(packageText);

assert.equal(faceText, canonicalJson(face), "glyphs JSON is not canonical");
assert.equal(manifestText, canonicalJson(manifest), "manifest JSON is not canonical");
assert.equal(metadataText, canonicalJson(metadata), "metadata JSON is not canonical");
assert.equal(packageText, canonicalJson(packageJson), "package JSON is not canonical");
assert.equal(sha256(faceText), EXPECTED_FACE_SHA256, "face SHA-256 differs");
assert.equal(sha256(packed), EXPECTED_PACKED_SHA256, "packed SHA-256 differs");
assert.equal(packedHex, `0x${packed.toString("hex")}\n`, "packed hex differs");
assert.equal(face.schema, "inshell.mono-76.centerline-face.v1");
assert.equal(face.family.name, "Inshell Mono 76");
assert.equal(face.family.shortName, "Mono 76");
assert.equal(face.release.version, EXPECTED_VERSION);
assert.equal(face.release.tag, EXPECTED_TAG);
assert.equal(face.release.status, "sealed");
assert.equal(face.release.manualEditPayloadSha256, EXPECTED_MANUAL_EDIT_SHA256);
assert.equal(face.provenance.owner, "Inshell");
assert.equal(face.provenance.importedFontOutlines, false);
assert.equal(face.provenance.tracedFontOutlines, false);
assert.equal(face.repertoire, REPERTOIRE);
assert.equal(face.glyphs.length, 76);
assert.equal(face.glyphs.map(({ character }) => character).join(""), REPERTOIRE);
assert.equal(face.metrics.fixedAdvanceWidth, 10);
assert.equal(face.composition.defaultOriginShiftX, 1);
assert.equal(face.renderStyle.strokeWidth, 1.23);
assert.equal(face.renderStyle.fill, "none");
assert.equal(face.composition.bakedOpticalAlignment.pathsContainOffsets, true);
assert.equal(packageJson.name, "@inshell/mono-76");
assert.equal(packageJson.version, EXPECTED_VERSION);
assert.equal(packageJson.private, true);
assert.equal(manifest.integrity.faceSha256, EXPECTED_FACE_SHA256);
assert.equal(manifest.integrity.packedSha256, EXPECTED_PACKED_SHA256);
assert.equal(manifest.integrity.packedKeccak256, EXPECTED_PACKED_KECCAK256);
assert.equal(metadata.faceSha256, EXPECTED_FACE_SHA256);
assert.equal(metadata.sha256, EXPECTED_PACKED_SHA256);
assert.equal(metadata.keccak256, EXPECTED_PACKED_KECCAK256);

const inspected = inspectMono76Packed(packed);
assert.equal(inspected.bytes.length, EXPECTED_PACKED_BYTES);
assert.equal(inspected.pathBytes, EXPECTED_PATH_BYTES);
for (const glyph of face.glyphs) {
  assert.equal(sha256(glyph.d), glyph.pathSha256);
  assert.equal(decodeMono76PackedGlyph(packed, glyph.character), glyph.d);
}

assertMono76Font(face);
assertMono76Text(face, "THOUGHT WILL AWA!");
assert.equal(supportsMono76Text(face, "PATH"), true);
assert.equal(supportsMono76Text(face, "THOUGHT_WILL_AWA"), false);
assert.throws(() => assertMono76Text(face, "THOUGHT_WILL_AWA"), RangeError);
const loaded = await loadMono76Font();
assert.equal(loaded.release.version, EXPECTED_VERSION);
const svg = renderMono76Line(face, "THOUGHT WILL AWA!", {
  background: "#000000",
  stroke: "#00ff35"
});
assert.match(svg, /data-font="Inshell Mono 76"/);
assert.match(svg, /stroke-width="1.23"/);

const checksumsText = await readFile(path.join(ROOT, "SHA256SUMS"), "utf8");
assert.ok(checksumsText.endsWith("\n"));
for (const line of checksumsText.trimEnd().split("\n")) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert.ok(match, `invalid checksum line: ${line}`);
  assert.equal(
    match[1],
    sha256(await readFile(path.join(ROOT, match[2]))),
    `checksum differs for ${match[2]}`
  );
}

console.log(
  `Inshell Mono 76 v1.0.0 verified: 76 records, ${EXPECTED_PATH_BYTES} path bytes, ${EXPECTED_PACKED_BYTES} packed bytes, SHA-256 ${EXPECTED_PACKED_SHA256}`
);

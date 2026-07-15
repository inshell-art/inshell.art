import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";

const ARTIFACT_ID = "thought-v2-line-limits-agent-identity-20260711T1847Z";
const MANIFEST_SHA256 = "9b290f7458ae942805ff41b59de08588afa609a5e5603c258b460ac870ef3b5d";
const releaseDir = resolve(
  cwd(),
  "public/artifacts/thought-v2",
  ARTIFACT_ID,
);

const readReleaseFile = (relativePath: string) =>
  readFileSync(resolve(releaseDir, relativePath), "utf8");

describe("pinned THOUGHT V2 artifact", () => {
  test("pins the exact immutable release and all 53 works", () => {
    const manifestRaw = readReleaseFile("manifest.json");
    const manifest = JSON.parse(manifestRaw) as {
      artifact_id: string;
      files: Array<{ path: string }>;
    };
    const sampleIndex = JSON.parse(readReleaseFile("samples/index.json")) as {
      samples: Array<{ fixtureId: string | null }>;
    };

    expect(createHash("sha256").update(manifestRaw).digest("hex")).toBe(MANIFEST_SHA256);
    expect(manifest.artifact_id).toBe(ARTIFACT_ID);
    expect(sampleIndex.samples.filter((sample) => sample.fixtureId !== null)).toHaveLength(53);
    expect(manifest.files.filter((file) => file.path.startsWith("samples/works/"))).toHaveLength(53);
  });

  test("preserves the canonical binary field and clear text areas", () => {
    const svg = readReleaseFile("samples/works/01-mixed-script-default.svg");

    expect(svg).toContain('id="binary-background" opacity="1.00"');
    expect(svg).toContain('data-rendered-cells="892"');
    expect(svg).toContain('data-cleared-cells="132"');
    expect(svg).not.toContain('id="agent-line-bg"');
    expect(svg).not.toContain('id="prompt-line-bg"');
  });

  test("preserves line limits, prompt overflow, and multilingual text", () => {
    const limitSvg = readReleaseFile("samples/works/44-ascii-display-unit-limits.svg");
    const multilingualSvg = readReleaseFile("samples/works/20-dual-multilingual.svg");

    expect(limitSvg).not.toContain('id="agent-line-carousel"');
    expect(limitSvg).toContain('id="prompt-line-carousel"');
    expect(limitSvg.match(/<animate attributeName="x"/gu)).toHaveLength(2);
    expect(limitSvg).toContain('font-size="44"');
    expect(limitSvg).toContain('font-size="16"');
    expect(multilingualSvg).toContain("مرحبا");
    expect(multilingualSvg).toContain("你好");
  });
});

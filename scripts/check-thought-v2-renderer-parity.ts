import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  JsonRpcProvider,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";
import {
  assertThoughtV2AnvilRuntime,
  createThoughtNftV2Contract,
  createThoughtRendererV2Contract,
  verifyThoughtV2CurrentRuntime,
} from "../apps/thought/src/thought-v2-contract-client";
import { parseThoughtV2EmptyFrameStyle } from "../apps/thought/src/thought-v2-empty-frame";

const root = path.resolve(import.meta.dirname, "..");
const runtimeFile = path.resolve(
  process.env.THOUGHT_V2_RUNTIME_CONFIG ??
    path.join(root, "apps", "thought", "evm", "addresses.anvil.json"),
);

const decodeDataUri = (value: string, prefix: string) => {
  assert.ok(value.startsWith(prefix), `expected ${prefix} data URI`);
  return Buffer.from(value.slice(prefix.length), "base64").toString("utf8");
};

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const fieldGroup = (svg: string, id: "prompt-line" | "agent-line") => {
  const match = svg.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?<\\/g>`));
  assert.ok(match, `${id} group missing`);
  return match[0];
};

const glyphBaselines = (group: string) =>
  [...group.matchAll(/transform="translate\([^ ]+ ([0-9.]+)\) scale\(4\.8\)"/g)]
    .map((match) => Number(match[1]));

const runtime = assertThoughtV2AnvilRuntime(
  JSON.parse(await fs.readFile(runtimeFile, "utf8")),
);
const provider = new JsonRpcProvider(runtime.rpcUrl, runtime.chainId, {
  staticNetwork: true,
  batchMaxCount: 1,
});

try {
  const runtimeVerification = await verifyThoughtV2CurrentRuntime(provider, runtime);
  assert.deepEqual(runtimeVerification, { compatible: true, issues: [] });

  const renderer = createThoughtRendererV2Contract(
    runtime.contracts.thoughtRenderer,
    provider,
  );
  const thought = createThoughtNftV2Contract(runtime.contracts.thoughtNft, provider);
  const implementationId = String(await renderer.IMPLEMENTATION_ID());
  const frameStyle = parseThoughtV2EmptyFrameStyle(implementationId);
  assert.ok(frameStyle, "renderer implementation does not declare its work-frame geometry");

  const rowSamples = [
    "one row",
    `${"a".repeat(25)} ${"b".repeat(25)}`,
    `${"a".repeat(20)} ${"b".repeat(20)} ${"c".repeat(20)}`,
    `${"a".repeat(15)} ${"b".repeat(15)} ${"c".repeat(15)} ${"d".repeat(15)}`,
  ];
  const rendererSamples = [];
  for (const [index, sample] of rowSamples.entries()) {
    const expectedRows = index + 1;
    const svg = String(await renderer.render(sample, sample));
    const promptGroup = fieldGroup(svg, "prompt-line");
    const agentGroup = fieldGroup(svg, "agent-line");
    const promptY = glyphBaselines(promptGroup);
    const agentY = glyphBaselines(agentGroup);

    assert.match(promptGroup, new RegExp(`data-rows="${expectedRows}"`));
    assert.match(agentGroup, new RegExp(`data-rows="${expectedRows}"`));
    assert.equal(promptY[0], 140.8, `prompt row ${expectedRows} is not top-packed`);
    assert.equal(agentY.at(-1), 780.8, `Agent row ${expectedRows} is not bottom-packed`);
    assert.doesNotMatch(svg, /<text\b|<foreignObject\b|@font-face/i);
    assert.match(svg, /<path\b/);
    assert.match(svg, /<use\b/);
    assert.match(
      svg,
      new RegExp(
        `<rect id="work-frame" width="${frameStyle.canvasSize + (frameStyle.inset * 2)}" height="${frameStyle.canvasSize + (frameStyle.inset * 2)}" fill="${frameStyle.color}"\\/>`,
      ),
    );

    rendererSamples.push({
      rows: expectedRows,
      promptFirstBaseline: promptY[0],
      agentFinalBaseline: agentY.at(-1),
      sha256: sha256(svg),
    });
  }

  const supply = Number(await thought.totalSupply());
  assert.ok(Number.isSafeInteger(supply) && supply >= 0);
  const tokenSamples = [];
  for (const tokenId of supply > 0 ? [...new Set([1, supply])] : []) {
    const [promptLine, agentLine, svgOf, tokenUri] = await Promise.all([
      thought.promptLineOf(tokenId) as Promise<string>,
      thought.agentLineOf(tokenId) as Promise<string>,
      thought.svgOf(tokenId) as Promise<string>,
      thought.tokenURI(tokenId) as Promise<string>,
    ]);
    const directPreview = String(await renderer.render(promptLine, agentLine));
    const metadata = JSON.parse(
      decodeDataUri(String(tokenUri), "data:application/json;base64,"),
    ) as { image?: unknown };
    assert.equal(typeof metadata.image, "string", `THOUGHT #${tokenId} image is missing`);
    const tokenUriSvg = decodeDataUri(
      metadata.image as string,
      "data:image/svg+xml;base64,",
    );

    assert.equal(directPreview, String(svgOf));
    assert.equal(String(svgOf), tokenUriSvg);
    tokenSamples.push({
      sha256: sha256(tokenUriSvg),
      tokenId,
      tokenUriImageExact: true,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    check: "thought-v2-renderer-parity",
    implementationId,
    runtime: path.relative(root, runtimeFile),
    rendererSamples,
    supply,
    tokenSamples,
  }, null, 2));
} finally {
  await provider.destroy();
}

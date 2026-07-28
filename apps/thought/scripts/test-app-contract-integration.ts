import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import {
  AbiCoder,
  Contract,
  JsonRpcProvider,
  encodeBytes32String,
  getBytes,
  id,
  keccak256,
  toUtf8Bytes,
} from "ethers";

import {
  buildThoughtV2UnattestedMint,
  type ThoughtV2AppMintFacts,
} from "../src/thought-v2-app-mint";
import {
  assertThoughtV2AnvilRuntime,
  createThoughtNftV2Contract,
  createThoughtRendererV2Contract,
  verifyThoughtV2CurrentRuntime,
} from "../src/thought-v2-contract-client";
import { buildBackendOnlyMockThoughtV2Mint } from "./mock-thought-v2-anvil-signer";

const root = path.resolve(import.meta.dirname, "../../..");
const runtimePath = path.resolve(
  process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE ||
    path.join(root, "apps", "thought", "evm", "addresses.anvil.json"),
);
const runtime = assertThoughtV2AnvilRuntime(
  JSON.parse(await fs.readFile(runtimePath, "utf8")),
);
const provider = new JsonRpcProvider(runtime.rpcUrl, runtime.chainId);
const signer = await provider.getSigner(runtime.attestation.authority);
const minter = (await signer.getAddress()).toLowerCase() as `0x${string}`;
const thought = createThoughtNftV2Contract(runtime.contracts.thoughtNft, signer);
const renderer = createThoughtRendererV2Contract(
  runtime.contracts.thoughtRenderer,
  provider,
);
const pathNft = new Contract(runtime.contracts.pathNft, [
  "function getConsumeNonce(address claimer) view returns (uint256)",
], signer);
const localAuction = runtime as typeof runtime & {
  pathAuction: { openTime: number };
  pulseAuction: { address: string };
};
const auction = new Contract(localAuction.pulseAuction.address, [
  "function epochIndex() view returns (uint64)",
  "function getCurrentPrice() view returns (uint256)",
  "function bid(uint256 maxPrice) payable returns (uint256)",
], signer);
const registry = new Contract(runtime.contracts.thoughtSpecRegistry, [
  "function thoughtSpecText(bytes32 specId) view returns (string)",
], provider);
const abiCoder = AbiCoder.defaultAbiCoder();
const movement = encodeBytes32String("THOUGHT");
const consumeAuthorizationTypehash = id(
  "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 nonce,uint256 deadline)",
);

const pathSignature = async (pathId: bigint, deadline: bigint) => {
  const nonce = await pathNft.getConsumeNonce(minter) as bigint;
  const structHash = keccak256(abiCoder.encode(
    ["bytes32", "address", "uint256", "uint256", "bytes32", "address", "address", "uint256", "uint256"],
    [
      consumeAuthorizationTypehash,
      runtime.contracts.pathNft,
      BigInt(runtime.chainId),
      pathId,
      movement,
      minter,
      runtime.contracts.thoughtNft,
      nonce,
      deadline,
    ],
  ));
  return signer.signMessage(getBytes(structHash)) as Promise<`0x${string}`>;
};

const acquirePath = async () => {
  const latest = await provider.getBlock("latest");
  assert.ok(latest);
  if (latest.timestamp < localAuction.pathAuction.openTime) {
    await provider.send("evm_setNextBlockTimestamp", [localAuction.pathAuction.openTime]);
    await provider.send("evm_mine", []);
  }
  const pathId = BigInt(await auction.epochIndex()) + 1n;
  const price = await auction.getCurrentPrice() as bigint;
  await (await auction.bid(price, { value: price })).wait();
  return pathId;
};

const decodeMetadata = (tokenUri: string) => {
  const prefix = "data:application/json;base64,";
  assert.ok(tokenUri.startsWith(prefix));
  return JSON.parse(Buffer.from(tokenUri.slice(prefix.length), "base64").toString("utf8")) as {
    attributes: Array<{ trait_type: string; value: unknown }>;
    image: string;
    properties: {
      glyphDefinitionsKeccak256: string;
      glyphLibraryMemberId: string;
      rendererImplementationId: string;
    };
    thought: {
      rendererReleaseReady: boolean;
    };
  };
};

const decodeSvgImage = (image: string) => {
  const prefix = "data:image/svg+xml;base64,";
  assert.ok(image.startsWith(prefix));
  return Buffer.from(image.slice(prefix.length), "base64").toString("utf8");
};

const fieldGroup = (svg: string, id: "prompt-line" | "agent-line") => {
  const match = svg.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?<\\/g>`));
  assert.ok(match, `${id} group missing`);
  return match[0];
};

const glyphBaselines = (group: string) =>
  [...group.matchAll(/transform="translate\([^ ]+ ([0-9.]+)\) scale\(4\.8\)"/g)]
    .map((match) => Number(match[1]));

const selectedSpecText = await registry.thoughtSpecText(runtime.selectedSpec.id) as string;
const selectedSpec = {
  exactSpecBytes: toUtf8Bytes(selectedSpecText),
  specName: runtime.selectedSpec.name,
};
const protocol = {
  manifestKeccak256: runtime.protocolRelease.manifestHash.toLowerCase() as `0x${string}`,
  protocolReleaseId: runtime.protocolRelease.id.toLowerCase() as `0x${string}`,
  thoughtSpecHash: runtime.selectedSpec.hash.toLowerCase() as `0x${string}`,
  thoughtSpecId: runtime.selectedSpec.id.toLowerCase() as `0x${string}`,
};

const snapshot = await provider.send("evm_snapshot", []);
try {
  const runtimeVerification = await verifyThoughtV2CurrentRuntime(provider, runtime);
  assert.deepEqual(runtimeVerification, { compatible: true, issues: [] });

  const rowSamples = [
    "one row",
    `${"a".repeat(25)} ${"b".repeat(25)}`,
    `${"a".repeat(20)} ${"b".repeat(20)} ${"c".repeat(20)}`,
    `${"a".repeat(15)} ${"b".repeat(15)} ${"c".repeat(15)} ${"d".repeat(15)}`,
  ];
  for (const [index, sample] of rowSamples.entries()) {
    const expectedRows = index + 1;
    const svg = String(await renderer.render(sample, sample));
    const promptGroup = fieldGroup(svg, "prompt-line");
    const agentGroup = fieldGroup(svg, "agent-line");
    const promptY = glyphBaselines(promptGroup);
    const agentY = glyphBaselines(agentGroup);
    assert.match(promptGroup, new RegExp(`data-rows="${expectedRows}"`));
    assert.match(agentGroup, new RegExp(`data-rows="${expectedRows}"`));
    assert.equal(promptY[0], 140.8, `prompt row ${expectedRows} did not stay top-packed`);
    assert.equal(
      agentY.at(-1),
      780.8,
      `Agent row ${expectedRows} did not stay bottom-packed`,
    );
    assert.doesNotMatch(svg, /<text\b|<foreignObject\b|@font-face/i);
    assert.match(svg, /<path\b/);
    assert.match(svg, /<use\b/);
  }

  const basePathId = await acquirePath();
  const latestBlock = await provider.getBlock("latest");
  assert.ok(latestBlock);
  const deadline = BigInt(latestBlock.timestamp + 3_600);

  const manualFacts: ThoughtV2AppMintFacts = {
    chainId: BigInt(runtime.chainId),
    thoughtNft: runtime.contracts.thoughtNft.toLowerCase() as `0x${string}`,
    intendedMinter: minter,
    promptLine: "Can provenance certify itself?",
    agentLine: "A label cannot elevate its own evidence.",
    process: {
      agentDeclaration: {
        label: "Pretend Attested Agent",
        source: "manual",
        status: "declared-unverified",
      },
      kind: "manual",
      modelDeclaration: {
        label: "Pretend Attested Model",
        source: "manual",
        status: "declared-unverified",
      },
    },
    protocol,
    selectedSpec,
    path: {
      pathId: basePathId,
      deadline,
      pathSignature: await pathSignature(basePathId, deadline),
    },
  };
  const unattested = buildThoughtV2UnattestedMint(manualFacts);
  await (await thought.mint(unattested)).wait();
  const unattestedTokenId = await thought.totalSupply() as bigint;
  const unattestedMetadata = decodeMetadata(await thought.tokenURI(unattestedTokenId));
  const unattestedTraits = unattestedMetadata.attributes.map(({ trait_type }) => trait_type);
  assert.ok(unattestedTraits.includes("Creation Attestation"));
  assert.ok(!unattestedTraits.includes("Attested Agent"));
  assert.ok(!unattestedTraits.includes("Attested Model"));
  assert.equal(
    await thought.provenanceHashOf(unattestedTokenId),
    keccak256(toUtf8Bytes(unattested.provenanceJson)),
  );

  const attestedPathId = await acquirePath();
  const agentFacts: ThoughtV2AppMintFacts = {
    chainId: BigInt(runtime.chainId),
    thoughtNft: runtime.contracts.thoughtNft.toLowerCase() as `0x${string}`,
    intendedMinter: minter,
    promptLine: "Who signs the boundary?",
    agentLine: "The App signs facts the Contract can replay.",
    process: {
      agentDeclaration: {
        label: "Codex",
        source: "runtime_configured",
        status: "declared-unverified",
      },
      kind: "agent-run",
      modelDeclaration: {
        identifier: "gpt-5.6",
        label: "gpt-5.6",
        source: "runtime_configured",
        status: "declared-unverified",
      },
      transport: {
        adapter: "inshell.thought.app",
        provider: "openai",
        resultEnvelope: {
          agentLine: "The App signs facts the Contract can replay.",
          schema: "inshell.thought.agent-result.v2",
        },
        route: "local.mock-official",
        runReference: "public-app-contract-parity-run-0001",
      },
    },
    protocol,
    selectedSpec,
    path: {
      pathId: attestedPathId,
      deadline,
      pathSignature: await pathSignature(attestedPathId, deadline),
    },
  };
  const attested = await buildBackendOnlyMockThoughtV2Mint(runtime, agentFacts, {
    provider,
    signer,
    attestationDeadline: deadline,
  });
  await (await thought.mint(attested)).wait();
  const attestedTokenId = await thought.totalSupply() as bigint;
  const attestedMetadata = decodeMetadata(await thought.tokenURI(attestedTokenId));
  const attestedSvg = decodeSvgImage(attestedMetadata.image);
  assert.equal(
    attestedSvg,
    await thought.svgOf(attestedTokenId),
    "tokenURI().image must be the exact canonical svgOf() bytes",
  );
  assert.equal(attestedMetadata.thought.rendererReleaseReady, true);
  assert.equal(
    attestedMetadata.properties.rendererImplementationId,
    runtime.renderer.implementationId,
  );
  assert.equal(
    attestedMetadata.properties.glyphLibraryMemberId,
    runtime.renderer.glyphLibraryMemberId,
  );
  assert.equal(
    attestedMetadata.properties.glyphDefinitionsKeccak256.toLowerCase(),
    runtime.renderer.glyphDefinitionsKeccak256.toLowerCase(),
  );
  assert.doesNotMatch(attestedSvg, /<text\b|<foreignObject\b|@font-face/i);
  const traitMap = new Map(
    attestedMetadata.attributes.map(({ trait_type, value }) => [trait_type, value]),
  );
  assert.equal(traitMap.get("Creation Attestation"), "Inshell THOUGHT App");
  assert.equal(traitMap.get("Attested Agent"), "Codex");
  assert.equal(traitMap.get("Attested Model"), "gpt-5.6");
  assert.equal(await thought.promptLineOf(attestedTokenId), agentFacts.promptLine);
  assert.equal(await thought.agentLineOf(attestedTokenId), agentFacts.agentLine);
  assert.equal(await thought.declaredAgentOf(attestedTokenId), "Codex");
  assert.equal(await thought.declaredModelOf(attestedTokenId), "gpt-5.6");
  assert.equal(
    await thought.provenanceHashOf(attestedTokenId),
    keccak256(toUtf8Bytes(attested.provenanceJson)),
  );
  assert.notEqual(
    await thought.creationAttestationDigestOf(attestedTokenId),
    `0x${"00".repeat(32)}`,
  );

  console.log(JSON.stringify({
    runtime: path.relative(root, runtimePath),
    chainId: runtime.chainId,
    unattested: {
      tokenId: unattestedTokenId.toString(),
      agentModelTraits: false,
    },
    mockOfficial: {
      tokenId: attestedTokenId.toString(),
      agent: traitMap.get("Attested Agent"),
      model: traitMap.get("Attested Model"),
    },
    rendererEvidence: {
      rowCounts: [1, 2, 3, 4],
      promptFirstBaseline: 140.8,
      agentFinalBaseline: 780.8,
      nativeSvgPaths: true,
      rendererReleaseReady: attestedMetadata.thought.rendererReleaseReady,
      tokenUriImageExact: true,
    },
    revertedAfterTest: true,
  }));
} finally {
  await provider.send("evm_revert", [snapshot]);
  await provider.destroy();
}

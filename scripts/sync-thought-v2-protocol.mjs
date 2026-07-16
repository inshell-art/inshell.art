import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_COMMIT = "30292fd9c72a28ce896395f1dc16078beff025ea";
const RELEASE_ID = "inshell-thought-protocol-v2-64-byte-dev-490da981";
const EXPECTED_PROTOCOL_ID = "inshell.thought.protocol.v2";
const EXPECTED_MANIFEST_BYTES = 13185;
const EXPECTED_MANIFEST_SHA256 =
  "490da98199b64cbc67956d695deb6766cd4c0046f49b99e10e2728c77976bb46";
const EXPECTED_MANIFEST_KECCAK256 =
  "0x4fb509061538e6dc87bde4a8a4cfbfa34ff26c089409d55de5ba8bfdfa17a0b8";
const EXPECTED_ARTIFACT_COUNT = 38;
const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_ROOT = resolve(
  ROOT,
  "apps/home/public/artifacts/thought-protocol-v2",
  RELEASE_ID,
);
const GENERATED_PATH = resolve(
  ROOT,
  "packages/thought-agent-protocol/src/release.generated.ts",
);
const LOCK_PATH = resolve(
  ROOT,
  "packages/thought-agent-protocol/thought-v2.consumer-lock.json",
);
const sourceTargets = new Map([
  ["src/thought-v2-protocol.ts", resolve(ROOT, "packages/shared/src/thought-v2-protocol.ts")],
  ["src/thought-v2-renderer.ts", resolve(ROOT, "packages/shared/src/thought-v2-renderer.ts")],
  ["src/thought-v2-provenance.ts", resolve(ROOT, "packages/shared/src/thought-v2-provenance.ts")],
]);
const args = process.argv.slice(2);
const check = args.includes("--check");
const fromIndex = args.indexOf("--from");
const sourceRoot = resolve(
  ROOT,
  fromIndex >= 0 && args[fromIndex + 1] ? args[fromIndex + 1] : "../THOUGHT",
);

const supplementalPaths = [
  "docs/agent/THOUGHT_ARTIFACT_CONSUMPTION_BOOK.md",
  "docs/agent/THOUGHT_V2_64_BYTE_BINARY_WEAVE_IMPLEMENTATION_REPORT.md",
  "protocol/integrations/agent-run/v2/adapters/claude.md",
  "protocol/integrations/agent-run/v2/adapters/codex.md",
  "protocol/integrations/agent-run/v2/adapters/dev.md",
  "protocol/integrations/agent-run/v2/adapters/manual.md",
  "protocol/integrations/agent-run/v2/schemas/thought.agent-run.v2.schema.json",
  "protocol/integrations/agent-run/v2/thought-agent-run.v2.md",
  "src/thought-v2-protocol.ts",
  "src/thought-v2-renderer.ts",
  "src/thought-v2-provenance.ts",
  "src/thought-agent-run.ts",
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url);
const ethersEntry = require.resolve("ethers", {
  paths: [resolve(ROOT, "apps/thought")],
});
const { keccak256, toUtf8Bytes } = await import(pathToFileURL(ethersEntry).href);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const safePath = (value) => {
  assert(typeof value === "string" && value.length > 0, "artifact path is empty");
  assert(!value.startsWith("/"), `absolute artifact path: ${value}`);
  assert(!value.split("/").includes(".."), `parent-relative artifact path: ${value}`);
  assert(!value.split("/").includes(""), `malformed artifact path: ${value}`);
  return value;
};

const sourceBytes = (path) => readFile(resolve(sourceRoot, safePath(path)));

const readSnapshot = async () => {
  if (check) {
    const current = await readFile(resolve(PUBLIC_ROOT, "CURRENT.json"));
    const manifest = await readFile(resolve(PUBLIC_ROOT, "release-manifest.json"));
    const parsed = JSON.parse(manifest.toString("utf8"));
    const artifacts = new Map();
    for (const artifact of parsed.artifacts) {
      const path = safePath(artifact.path);
      artifacts.set(path, await readFile(resolve(PUBLIC_ROOT, "files", path)));
    }
    const supplemental = new Map();
    for (const path of supplementalPaths) {
      supplemental.set(
        path,
        await readFile(resolve(PUBLIC_ROOT, "supplemental", safePath(path))),
      );
    }
    return { current, manifest, artifacts, supplemental };
  }

  const current = await sourceBytes("protocol/CURRENT.json");
  const manifest = await sourceBytes("protocol/releases/v2/release-manifest.json");
  const parsed = JSON.parse(manifest.toString("utf8"));
  const artifacts = new Map();
  for (const artifact of parsed.artifacts) {
    const path = safePath(artifact.path);
    artifacts.set(path, await sourceBytes(`protocol/releases/v2/${path}`));
  }
  const supplemental = new Map();
  for (const path of supplementalPaths) {
    supplemental.set(path, await sourceBytes(path));
  }
  return { current, manifest, artifacts, supplemental };
};

const verifySnapshot = (snapshot) => {
  const current = JSON.parse(snapshot.current.toString("utf8"));
  const manifest = JSON.parse(snapshot.manifest.toString("utf8"));
  assert(current.id === EXPECTED_PROTOCOL_ID, "protocol ID mismatch");
  assert(current.manifest === "releases/v2/release-manifest.json", "manifest pointer mismatch");
  assert(snapshot.manifest.byteLength === EXPECTED_MANIFEST_BYTES, "manifest byte length mismatch");
  assert(sha256(snapshot.manifest) === EXPECTED_MANIFEST_SHA256, "manifest SHA-256 mismatch");
  assert(keccak256(snapshot.manifest) === EXPECTED_MANIFEST_KECCAK256, "manifest Keccak-256 mismatch");
  assert(current.byteLength === EXPECTED_MANIFEST_BYTES, "CURRENT byte length mismatch");
  assert(current.sha256 === EXPECTED_MANIFEST_SHA256, "CURRENT SHA-256 mismatch");
  assert(current.keccak256 === EXPECTED_MANIFEST_KECCAK256, "CURRENT Keccak-256 mismatch");
  assert(manifest.schema === "inshell.thought.release-manifest.v1", "manifest schema mismatch");
  assert(manifest.artifacts.length === EXPECTED_ARTIFACT_COUNT, "artifact count mismatch");
  assert(manifest.lineProfile?.id === manifest.identifiers.workProfile, "line profile ID mismatch");
  assert(manifest.lineProfile?.promptMaxUtf8Bytes === 64, "prompt byte limit mismatch");
  assert(manifest.lineProfile?.agentMaxUtf8Bytes === 64, "agent byte limit mismatch");
  assert(manifest.lineProfile?.normalization === "none", "normalization contract mismatch");
  assert(manifest.lineProfile?.displayUnitsAreAcceptanceLimits === false, "display-unit acceptance contract mismatch");

  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    const path = safePath(artifact.path);
    assert(!seen.has(path), `duplicate artifact path: ${path}`);
    seen.add(path);
    const bytes = snapshot.artifacts.get(path);
    assert(bytes, `missing artifact: ${path}`);
    assert(bytes.byteLength === artifact.byteLength, `byte length mismatch: ${path}`);
    assert(sha256(bytes) === artifact.sha256, `SHA-256 mismatch: ${path}`);
    assert(keccak256(bytes) === artifact.keccak256, `Keccak-256 mismatch: ${path}`);
    assert(!bytes.includes(Buffer.from("\r\n")), `CRLF artifact: ${path}`);
  }
  assert(snapshot.artifacts.size === seen.size, "artifact file-list mismatch");
  return { current, manifest };
};

const supplementalLock = (snapshot) =>
  supplementalPaths.map((path) => {
    const bytes = snapshot.supplemental.get(path);
    assert(bytes, `missing supplemental source: ${path}`);
    return {
      path,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      keccak256: keccak256(bytes),
    };
  });

const buildLock = (snapshot, manifest) => ({
  schema: "inshell.thought.consumer-lock.v1",
  releaseId: RELEASE_ID,
  protocolId: EXPECTED_PROTOCOL_ID,
  source: {
    repository: "https://github.com/inshell-art/THOUGHT.git",
    channel: "working-tree",
    commit: RELEASE_COMMIT,
    dirty: true,
    eligibleForProduction: false,
  },
  manifest: {
    path: "protocol/releases/v2/release-manifest.json",
    byteLength: EXPECTED_MANIFEST_BYTES,
    sha256: EXPECTED_MANIFEST_SHA256,
    keccak256: EXPECTED_MANIFEST_KECCAK256,
    artifactCount: EXPECTED_ARTIFACT_COUNT,
  },
  deployment: {
    status: "source-only",
    v2MintEnabled: false,
    reason: "Local development snapshot from a dirty THOUGHT producer worktree; not eligible for production promotion.",
  },
  rollback: {
    rendererArtifactId: "thought-v2-line-limits-agent-identity-20260711T1847Z",
    rendererManifestSha256:
      "9b290f7458ae942805ff41b59de08588afa609a5e5603c258b460ac870ef3b5d",
  },
  identifiers: manifest.identifiers,
  lineProfile: manifest.lineProfile,
  artifacts: manifest.artifacts.map(({ path, byteLength, sha256: hash, keccak256: evmHash }) => ({
    path,
    byteLength,
    sha256: hash,
    keccak256: evmHash,
  })),
  supplemental: supplementalLock(snapshot),
});

const parseLineLimits = (lineProfile) => {
  assert(lineProfile?.id === EXPECTED_PROTOCOL_ID.replace("protocol", "work"), "invalid line profile");
  return {
    promptMaxBytes: Number(lineProfile.promptMaxUtf8Bytes),
    agentMaxBytes: Number(lineProfile.agentMaxUtf8Bytes),
    normalization: lineProfile.normalization,
    displayUnitsAreAcceptanceLimits: lineProfile.displayUnitsAreAcceptanceLimits,
  };
};

const buildGeneratedSource = (snapshot, lock) => {
  const specBytes = snapshot.artifacts.get("art/THOUGHT.v2.md");
  const resultSchema = snapshot.artifacts.get("agent/thought.agent-result.v2.schema.json");
  const declarationSchema = snapshot.artifacts.get("agent/thought.agent-declaration.v1.schema.json");
  const provenanceSchema = snapshot.artifacts.get("provenance/thought.provenance.v2.schema.json");
  const agentRunDoc = snapshot.supplemental.get(
    "protocol/integrations/agent-run/v2/thought-agent-run.v2.md",
  );
  assert(specBytes && resultSchema && declarationSchema && provenanceSchema && agentRunDoc, "required protocol artifact missing");
  const specText = specBytes.toString("utf8");
  const limits = parseLineLimits(lock.lineProfile);
  const agentRunMatch = agentRunDoc.toString("utf8").match(/Identifier: `([^`]+)`/);
  assert(agentRunMatch, "could not derive Agent-run identifier");
  const publicBasePath = `/artifacts/thought-protocol-v2/${RELEASE_ID}`;
  const generated = {
    protocolId: lock.protocolId,
    releaseId: lock.releaseId,
    source: lock.source,
    commit: lock.source.commit,
    manifestSha256: lock.manifest.sha256,
    protocolReleaseKeccak256: lock.manifest.keccak256,
    agentRunId: agentRunMatch[1],
    deployment: lock.deployment,
    identifiers: lock.identifiers,
    limits,
    spec: {
      name: "THOUGHT.v2.md",
      version: 2,
      ref: "protocol/releases/v2/art/THOUGHT.v2.md",
      byteLength: specBytes.byteLength,
      sha256: sha256(specBytes),
      evmSpecId: keccak256(toUtf8Bytes("THOUGHT.v2.md")),
      evmSpecHash: keccak256(specBytes),
      text: specText,
    },
    publicBasePath,
    publicSpecPath: `${publicBasePath}/files/art/THOUGHT.v2.md`,
    publicThoughtNftAbiPath: `${publicBasePath}/files/contract/abi/ThoughtNFT.json`,
    publicThoughtSpecRegistryAbiPath: `${publicBasePath}/files/contract/abi/ThoughtSpecRegistry.json`,
    resultSchema: JSON.parse(resultSchema.toString("utf8")),
    declarationSchema: JSON.parse(declarationSchema.toString("utf8")),
    provenanceSchema: JSON.parse(provenanceSchema.toString("utf8")),
  };
  return `// Generated by scripts/sync-thought-v2-protocol.mjs. Do not edit manually.\n\nexport const THOUGHT_V2_PROTOCOL_RELEASE = ${JSON.stringify(generated, null, 2)} as const;\n`;
};

const writeSnapshot = async (snapshot, lock, generatedSource) => {
  await rm(PUBLIC_ROOT, { recursive: true, force: true });
  await mkdir(PUBLIC_ROOT, { recursive: true });
  await writeFile(resolve(PUBLIC_ROOT, "CURRENT.json"), snapshot.current);
  await writeFile(resolve(PUBLIC_ROOT, "release-manifest.json"), snapshot.manifest);
  for (const [path, bytes] of snapshot.artifacts) {
    const target = resolve(PUBLIC_ROOT, "files", path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  for (const [path, bytes] of snapshot.supplemental) {
    const target = resolve(PUBLIC_ROOT, "supplemental", path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  await writeFile(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  await writeFile(GENERATED_PATH, generatedSource);
  for (const [sourcePath, targetPath] of sourceTargets) {
    const bytes = snapshot.supplemental.get(sourcePath);
    assert(bytes, `missing reviewed source: ${sourcePath}`);
    await writeFile(targetPath, bytes);
  }
};

const compareGenerated = async (lock, generatedSource) => {
  const actualLock = JSON.parse(await readFile(LOCK_PATH, "utf8"));
  assert(JSON.stringify(actualLock) === JSON.stringify(lock), "consumer lock drift");
  const actualGenerated = await readFile(GENERATED_PATH, "utf8");
  assert(actualGenerated === generatedSource, "generated protocol metadata drift");
  for (const [sourcePath, targetPath] of sourceTargets) {
    const expected = snapshot.supplemental.get(sourcePath);
    const actual = await readFile(targetPath);
    assert(expected?.equals(actual), `reviewed source drift: ${sourcePath}`);
  }
};

const snapshot = await readSnapshot();
const { manifest } = verifySnapshot(snapshot);
const lock = buildLock(snapshot, manifest);
const generatedSource = buildGeneratedSource(snapshot, lock);
if (check) {
  await compareGenerated(lock, generatedSource);
  console.log(
    `verified ${EXPECTED_ARTIFACT_COUNT} normative artifacts (${EXPECTED_MANIFEST_KECCAK256})`,
  );
} else {
  await writeSnapshot(snapshot, lock, generatedSource);
  console.log(
    `synced ${EXPECTED_ARTIFACT_COUNT} normative artifacts from the THOUGHT working tree`,
  );
}

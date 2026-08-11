#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(
  root,
  "packages/thought-agent-protocol/src/release.generated.ts",
);
const lockPath = path.join(
  root,
  "packages/thought-agent-protocol/thought-v2.consumer-lock.json",
);
const contractLockPath = path.join(
  root,
  "apps/thought/contract-release/consumer-lock.json",
);
const integrationLockPath = path.join(
  root,
  "apps/thought/contract-integration/current/integration-lock.json",
);
const provenanceLockPath = path.join(
  root,
  "apps/thought/provenance/v2/provenance-lock.json",
);
const selectedSpecPath = path.join(root, "apps/thought/spec/THOUGHT.v2.md");
const selectedSpecLockPath = path.join(
  root,
  "apps/thought/spec/THOUGHT.v2.lock.json",
);
const briefPath = path.join(
  root,
  "apps/thought/spec/THOUGHT.agent-creative.v2.md",
);
const briefLockPath = path.join(
  root,
  "apps/thought/spec/THOUGHT.agent-creative.v2.lock.json",
);
const provenanceSchemaPath = path.join(
  root,
  "apps/thought/provenance/v2/thought.provenance.v2.schema.json",
);

const args = process.argv.slice(2);
const check = args.includes("--check");
const refreshContract = args.includes("--refresh-contract");
const fromIndex = args.indexOf("--from");
const sourceRepo = path.resolve(
  root,
  fromIndex >= 0 && args[fromIndex + 1] ? args[fromIndex + 1] : "../THOUGHT",
);
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const resultSchema = (releaseId, manifestHash, workProfile) => ({
  type: "object",
  additionalProperties: false,
  required: ["schema", "release", "agentLine"],
  properties: {
    schema: { const: "inshell.thought.agent-result.v2" },
    release: {
      type: "object",
      additionalProperties: false,
      required: ["protocolReleaseId", "manifestKeccak256"],
      properties: {
        protocolReleaseId: { const: releaseId },
        manifestKeccak256: { const: manifestHash },
      },
    },
    agentLine: {
      type: "string",
      minLength: 1,
      "x-thought-line-profile": workProfile,
      "x-thought-utf8-max-bytes": 64,
    },
    declaration: { $ref: "#/$defs/declaration" },
  },
  $defs: {
    declaration: {
      type: "object",
      additionalProperties: false,
      required: ["schema", "status", "label", "declaredOneCreativeResult"],
      properties: {
        schema: { const: "inshell.thought.agent-declaration.v1" },
        status: { const: "declared-unverified" },
        label: { type: "string", minLength: 1, maxLength: 64 },
        declaredOneCreativeResult: { const: true },
      },
    },
  },
});

const build = async () => {
  const contractLock = await readJson(contractLockPath);
  const integrationLock = await readJson(integrationLockPath);
  const provenanceLock = await readJson(provenanceLockPath);
  const selectedSpecLock = await readJson(selectedSpecLockPath);
  const briefLock = await readJson(briefLockPath);
  const selectedSpecBytes = await fs.readFile(selectedSpecPath);
  const briefBytes = await fs.readFile(briefPath);
  const provenanceSchema = await readJson(provenanceSchemaPath);
  const selected = integrationLock.runtimeBaseline.selectedSpec;
  const release = integrationLock.runtimeBaseline.protocolRelease;
  const compatibility = contractLock.compatibility;

  assert(
    contractLock.artifactId === integrationLock.id,
    "Contract and integration artifact IDs differ",
  );
  assert(
    contractLock.manifestSha256 === integrationLock.artifact.manifestSha256,
    "Contract and integration manifest hashes differ",
  );
  assert(selected.name === selectedSpecLock.artifact.name, "selected-spec name drift");
  assert(selected.id === selectedSpecLock.artifact.thoughtSpecId, "selected-spec ID drift");
  assert(selected.hash === selectedSpecLock.artifact.thoughtSpecHash, "selected-spec hash drift");
  assert(selected.sha256 === selectedSpecLock.artifact.sha256, "selected-spec SHA-256 drift");
  assert(selected.byteLength === selectedSpecBytes.length, "selected-spec byte-length drift");
  assert(sha256(selectedSpecBytes) === selected.sha256, "selected-spec byte drift");
  assert(briefLock.selectedSpec.artifactId === selectedSpecLock.artifactId, "brief selected-spec artifact drift");
  assert(briefLock.selectedSpec.sha256 === selected.sha256, "brief selected-spec SHA-256 drift");
  assert(briefLock.artifact.byteLength === briefBytes.length, "creative-brief byte-length drift");
  assert(briefLock.artifact.sha256 === sha256(briefBytes), "creative-brief byte drift");
  assert(
    provenanceLock.provenanceSchema === compatibility.provenance.id,
    "App provenance identifier differs from the Contract compatibility identifier",
  );

  const identifiers = {
    agentDeclaration: "inshell.thought.agent-declaration.v1",
    agentResult: "inshell.thought.agent-result.v2",
    contextProfile: compatibility.contextProfile.id,
    generationFile: selected.name,
    metadataProfile: compatibility.metadataProfile.id,
    protocolRelease: compatibility.protocol.id,
    provenance: compatibility.provenance.id,
    renderer: compatibility.renderer.canonicalId,
    workProfile: compatibility.workProfile.id,
  };
  const generated = {
    protocolId: compatibility.protocol.id,
    releaseId: contractLock.artifactId,
    source: {
      repository: "https://github.com/inshell-art/THOUGHT.git",
      channel: contractLock.channel,
      tag: contractLock.sourceTag,
      commit: contractLock.sourcePublicationCommit,
      dirty: false,
      eligibleForProduction: contractLock.productionConsumable,
    },
    commit: contractLock.sourcePublicationCommit,
    manifestSha256: contractLock.manifestSha256,
    protocolReleaseKeccak256: release.manifestHash,
    agentRunId: "inshell.thought.agent-run.v2",
    deployment: {
      status: "canonical-portable-not-deployed",
      v2MintEnabled: false,
      reason: "The portable Contract release is qualified, but no persistent-chain deployment or registration is authorized.",
    },
    release: {
      protocolReleaseId: release.id,
      manifestKeccak256: release.manifestHash,
    },
    identifiers,
    limits: {
      promptMaxBytes: 64,
      agentMaxBytes: 64,
      normalization: "none",
      displayUnitsAreAcceptanceLimits: false,
    },
    spec: {
      name: selected.name,
      version: 2,
      ref: selected.ref,
      byteLength: selected.byteLength,
      sha256: selected.sha256,
      evmSpecId: selected.id,
      evmSpecHash: selected.hash,
      text: selectedSpecBytes.toString("utf8"),
    },
    creativeBrief: {
      artifactId: briefLock.artifactId,
      id: briefLock.artifact.identifier,
      byteLength: briefLock.artifact.byteLength,
      sha256: briefLock.artifact.sha256,
      keccak256: briefLock.artifact.keccak256,
      text: briefBytes.toString("utf8"),
    },
    publicBasePath: `/protocol/releases/${contractLock.artifactId}`,
    publicSpecPath: `data:text/markdown;charset=utf-8,${encodeURIComponent(selectedSpecBytes.toString("utf8"))}`,
    resultSchema: resultSchema(
      release.id,
      release.manifestHash,
      identifiers.workProfile,
    ),
    declarationSchema: resultSchema(
      release.id,
      release.manifestHash,
      identifiers.workProfile,
    ).$defs.declaration,
    provenanceSchema,
  };
  const lock = {
    schema: "inshell.thought.current-v2-consumer-lock.v2",
    artifactId: contractLock.artifactId,
    protocolId: generated.protocolId,
    source: generated.source,
    contractManifestSha256: contractLock.manifestSha256,
    runtimeRelease: generated.release,
    selectedSpec: {
      artifactId: selectedSpecLock.artifactId,
      ...generated.spec,
      text: undefined,
    },
    creativeBrief: {
      artifactId: briefLock.artifactId,
      id: briefLock.artifact.identifier,
      byteLength: briefLock.artifact.byteLength,
      sha256: briefLock.artifact.sha256,
      keccak256: briefLock.artifact.keccak256,
    },
    identifiers,
    limits: generated.limits,
    deployment: generated.deployment,
    provenance: {
      artifactId: provenanceLock.artifactId,
      id: provenanceLock.provenanceSchema,
      schemaSha256: provenanceLock.artifacts.schema.sha256,
      schemaKeccak256: provenanceLock.artifacts.schema.keccak256,
    },
  };
  delete lock.selectedSpec.text;
  return { generated, lock };
};

const generatedSource = (value) =>
  `// Generated by scripts/sync-thought-v2-protocol.mjs from the current portable V2 consumer locks. Do not edit.\n\n` +
  `export const THOUGHT_V2_PROTOCOL_RELEASE = ${JSON.stringify(value, null, 2)} as const;\n`;

if (refreshContract) {
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts/sync-thought-v2-contract-release.mjs"),
      "--from",
      sourceRepo,
    ],
    { cwd: root, stdio: "inherit" },
  );
}

const { generated, lock } = await build();
const source = generatedSource(generated);
if (check) {
  assert(
    (await fs.readFile(generatedPath, "utf8")) === source,
    "generated current V2 protocol release drift",
  );
  assert(
    JSON.stringify(await readJson(lockPath)) === JSON.stringify(lock),
    "current V2 protocol consumer lock drift",
  );
} else {
  await fs.writeFile(generatedPath, source, "utf8");
  await fs.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

console.log(JSON.stringify({
  artifactId: generated.releaseId,
  protocolReleaseId: generated.release.protocolReleaseId,
  renderer: generated.identifiers.renderer,
  workProfile: generated.identifiers.workProfile,
  selectedSpecSha256: generated.spec.sha256,
  creativeBriefSha256: generated.creativeBrief.sha256,
  verified: true,
}));

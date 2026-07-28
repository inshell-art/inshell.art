#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AbiCoder,
  id,
  keccak256,
  toUtf8Bytes,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactId = "thought-v2-noncanonical-integration-preview-20260725-r7";
const sourceTag = artifactId;
const sourceCommit = "be0e9a5088856d1ab9262d86f4c2fead4a788867";
const manifestSha256 = "b2eb9fb0e5ed3b7ce11a46726b1f9b9d93d6a7868317b2b219076d6c6b978dbd";
const previewRoot = path.join(
  root,
  "apps",
  "thought",
  "integration-preview",
  "releases",
  artifactId,
);
const outputRoot = path.join(root, "apps", "thought", "contract-integration", "current");
const referenceOutputRoot = path.join(outputRoot, "reference");
const checkOnly = process.argv.includes("--check");

const preview = (...parts) => path.join(previewRoot, ...parts);
const output = (...parts) => path.join(outputRoot, ...parts);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const canonicalJsonStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const readJson = async (filename) => JSON.parse(await fs.readFile(filename, "utf8"));

const writeOrCheck = async (filename, bytes) => {
  if (checkOnly) {
    const actual = await fs.readFile(filename);
    if (!actual.equals(bytes)) {
      throw new Error(`App Contract vendor drift: ${path.relative(root, filename)}`);
    }
    return;
  }
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, bytes);
};

const copyExact = async (from, to) => {
  const bytes = await fs.readFile(from);
  await writeOrCheck(to, bytes);
  return {
    byteLength: bytes.length,
    sha256: sha256(bytes),
  };
};

const manifestEntry = (manifest, entryPath) => {
  const entry = manifest.files.find((candidate) => candidate.path === entryPath);
  if (!entry) throw new Error(`integration preview does not contain ${entryPath}`);
  return entry;
};

const verifyPreview = async () => {
  const manifestBytes = await fs.readFile(preview("manifest.json"));
  if (sha256(manifestBytes) !== manifestSha256) {
    throw new Error("immutable integration preview manifest SHA-256 mismatch");
  }
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (
    manifest.artifactId !== artifactId ||
    manifest.source?.tag !== sourceTag ||
    manifest.classification !== "noncanonical-integration-preview" ||
    manifest.flags?.productionConsumable !== false ||
    manifest.flags?.deploymentAuthorized !== false
  ) {
    throw new Error("integration preview identity or safety flags mismatch");
  }
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(preview(entry.path));
    if (bytes.length !== entry.byteLength || sha256(bytes) !== entry.sha256) {
      throw new Error(`immutable integration preview file mismatch: ${entry.path}`);
    }
  }
  return manifest;
};

const main = async () => {
  const manifest = await verifyPreview();
  const compatibility = manifest.compatibility;
  const runtimeManifestArtifacts = await Promise.all([
    ["creative-spec", "protocol/current/v2/THOUGHT.v2.md"],
    ["work-profile", "protocol/current/v2/work/thought.work.v2.profile.json"],
    ["context-profile", "protocol/current/v2/context/thought.context.v2.profile.json"],
    ["metadata-profile", "protocol/current/v2/metadata/thought.metadata.v2.profile.json"],
    ["provenance-schema", "protocol/current/v2/provenance/thought.provenance.v2.schema.json"],
    [
      "creation-attestation-profile",
      "protocol/current/v2/attestation/thought.creation-workflow-attestation.v1.md",
    ],
  ].map(async ([role, artifactPath]) => ({
    keccak256: keccak256(await fs.readFile(preview(artifactPath))),
    path: artifactPath,
    role,
  })));
  const rendererProfile = await readJson(
    preview("protocol", "current", "v2", "renderer", "thought.renderer.v2.profile.json"),
  );
  const [definitionsPart1, definitionsPart2] = await Promise.all([
    fs.readFile(preview(rendererProfile.glyphSource.pathDefinitions[0].path)),
    fs.readFile(preview(rendererProfile.glyphSource.pathDefinitions[1].path)),
  ]);
  const glyphDefinitionsKeccak256 = keccak256(
    Buffer.concat([definitionsPart1, definitionsPart2]),
  );
  const runtimeManifest = {
    artifacts: runtimeManifestArtifacts,
    chainId: "31337",
    glyphLibrary: {
      definitionsIndexKeccak256:
        rendererProfile.glyphSource.pathDefinitionIndex.keccak256,
      definitionsKeccak256: glyphDefinitionsKeccak256,
      definitionsPart1Keccak256:
        rendererProfile.glyphSource.pathDefinitions[0].keccak256,
      definitionsPart2Keccak256:
        rendererProfile.glyphSource.pathDefinitions[1].keccak256,
      memberId: rendererProfile.glyphSource.libraryMemberId,
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
    },
    identifiers: {
      contextProfile: compatibility.contextProfile.id,
      contextProfileHash: compatibility.contextProfile.idKeccak256,
      metadataProfile: compatibility.metadataProfile.id,
      metadataProfileHash: compatibility.metadataProfile.idKeccak256,
      provenance: compatibility.provenance.id,
      renderer: compatibility.renderer.canonicalId,
      rendererHash: compatibility.renderer.canonicalIdKeccak256,
      workProfile: compatibility.workProfile.id,
      workProfileHash: compatibility.workProfile.idKeccak256,
    },
    productionRegistrationAuthorized: false,
    rendererImplementation: {
      id: compatibility.renderer.packagedImplementation,
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
      usesForeignObject: rendererProfile.restrictions.foreignObject,
      usesNativeSvgPaths: true,
    },
    schema: "inshell.thought.protocol.v2.disposable-anvil-manifest.v1",
    selectedSpec: {
      name: compatibility.selectedSpec.name,
      thoughtSpecHash: compatibility.selectedSpec.thoughtSpecHash,
      thoughtSpecId: compatibility.selectedSpec.thoughtSpecId,
    },
    status: "registered-disposable-anvil",
  };
  const runtimeManifestHash = keccak256(
    toUtf8Bytes(canonicalJsonStringify(runtimeManifest)),
  );
  const runtimeReleaseId = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32"],
      [id("INSHELL_THOUGHT_PROTOCOL_RELEASE"), runtimeManifestHash],
    ),
  );

  const thoughtArtifactPath = preview("contract", "compiled", "ThoughtNFTV2.json");
  const verifierArtifactPath = preview(
    "contract",
    "compiled",
    "CreationAttestationVerifier.json",
  );
  const rendererArtifactPath = preview(
    "contract",
    "compiled",
    "ThoughtRendererV2.json",
  );
  const thoughtArtifactBytes = await fs.readFile(thoughtArtifactPath);
  const verifierArtifactBytes = await fs.readFile(verifierArtifactPath);
  const rendererArtifactBytes = await fs.readFile(rendererArtifactPath);
  const thoughtArtifact = JSON.parse(thoughtArtifactBytes.toString("utf8"));
  const verifierArtifact = JSON.parse(verifierArtifactBytes.toString("utf8"));
  const rendererArtifact = JSON.parse(rendererArtifactBytes.toString("utf8"));
  const thoughtAbiJson = JSON.stringify(thoughtArtifact.abi);
  const verifierAbiJson = JSON.stringify(verifierArtifact.abi);
  const rendererAbiJson = JSON.stringify(rendererArtifact.abi);

  await writeOrCheck(output("thought-nft-v2.abi.json"), jsonBytes(thoughtArtifact.abi));
  await writeOrCheck(
    output("creation-attestation-verifier.abi.json"),
    jsonBytes(verifierArtifact.abi),
  );
  await writeOrCheck(
    output("thought-renderer-v2.abi.json"),
    jsonBytes(rendererArtifact.abi),
  );

  const copied = {};
  for (const filename of [
    "thought-v2-canonical-json.ts",
    "thought-v2-context-profile.ts",
    "thought-v2-creation-attestation.ts",
    "thought-v2-terminal-provenance.ts",
    "thought-v2-terminal-work-profile.ts",
  ]) {
    copied[filename] = await copyExact(
      preview("reference", filename),
      path.join(referenceOutputRoot, filename),
    );
  }

  const boundary = await copyExact(
    preview(
      "protocol",
      "current",
      "v2",
      "integration",
      "thought.app-contract-boundary.v1.json",
    ),
    output("thought.app-contract-boundary.v1.json"),
  );
  await copyExact(
    preview(
      "protocol",
      "current",
      "v2",
      "integration",
      "thought.app-contract-boundary.v1.md",
    ),
    output("thought.app-contract-boundary.v1.md"),
  );
  const mintInput = await copyExact(
    preview("protocol", "current", "v2", "contract", "thought.mint-input.v2.schema.json"),
    output("thought.mint-input.v2.schema.json"),
  );
  const provenanceSchema = await copyExact(
    preview(
      "protocol",
      "current",
      "v2",
      "provenance",
      "thought.provenance.v2.schema.json",
    ),
    output("thought.provenance.v2.schema.json"),
  );
  await copyExact(
    preview("protocol", "current", "v2", "provenance", "thought.provenance.v2.md"),
    output("thought.provenance.v2.md"),
  );
  const workProfile = await copyExact(
    preview("protocol", "current", "v2", "work", "thought.work.v2.profile.json"),
    output("thought.work.v2.profile.json"),
  );
  const contextProfile = await copyExact(
    preview("protocol", "current", "v2", "context", "thought.context.v2.profile.json"),
    output("thought.context.v2.profile.json"),
  );
  const metadataProfile = await copyExact(
    preview("protocol", "current", "v2", "metadata", "thought.metadata.v2.profile.json"),
    output("thought.metadata.v2.profile.json"),
  );
  const attestationProfile = await copyExact(
    preview(
      "protocol",
      "current",
      "v2",
      "attestation",
      "thought.creation-workflow-attestation.v1.md",
    ),
    output("thought.creation-workflow-attestation.v1.md"),
  );
  const selectedSpec = await copyExact(
    preview("protocol", "current", "v2", "THOUGHT.v2.md"),
    output("thought.selected-spec.md"),
  );

  const deployedBytecode =
    typeof thoughtArtifact.deployedBytecode === "string"
      ? thoughtArtifact.deployedBytecode
      : thoughtArtifact.deployedBytecode?.object ?? "";
  const lock = {
    schema: "inshell.thought.app-contract-integration-lock.v1",
    id: artifactId,
    status: "experimental-local-development-only",
    productionConsumable: false,
    deploymentAuthorized: false,
    artifact: {
      artifactId,
      classification: manifest.classification,
      manifestSha256,
      sourceTag,
      sourceCommit,
      productionConsumable: false,
      deploymentAuthorized: false,
      registrationAuthorized: false,
    },
    source: {
      repository: "THOUGHT",
      tag: sourceTag,
      commit: sourceCommit,
      dirtySnapshot: manifest.source?.dirty === true,
      immutableConsumerRelease: true,
    },
    boundary: {
      id: "inshell.thought.app-contract-boundary.v1",
      sha256: boundary.sha256,
      authoritative: false,
    },
    chain: {
      chainId: 31337,
      runtimeDescriptorSchema: "inshell.thought.v2.anvil-gallery-runtime.v1",
      runtimeAddressSource: "external-local-generated-descriptor",
      committedAddresses: false,
    },
    runtimeBaseline: {
      protocolRelease: {
        id: runtimeReleaseId,
        manifestHash: runtimeManifestHash,
        status: "registered-disposable-anvil",
        rendererProfileHash: compatibility.renderer.canonicalIdKeccak256,
        workProfileHash: compatibility.workProfile.idKeccak256,
        contextProfileHash: compatibility.contextProfile.idKeccak256,
        metadataProfileHash: compatibility.metadataProfile.idKeccak256,
        creationAttestationProfileHash: compatibility.creationAttestation.idKeccak256,
        rendererImplementationId: compatibility.renderer.packagedImplementation,
      },
      selectedSpec: {
        name: compatibility.selectedSpec.name,
        id: compatibility.selectedSpec.thoughtSpecId,
        hash: compatibility.selectedSpec.thoughtSpecHash,
        ref: `dev://thought/integration-preview/${artifactId}/${compatibility.selectedSpec.name}`,
        byteLength: compatibility.selectedSpec.byteLength,
        sha256: compatibility.selectedSpec.sha256,
        file: "thought.selected-spec.md",
      },
    },
    contract: {
      name: "ThoughtNFTV2",
      sourceArtifactSha256: manifestEntry(
        manifest,
        "contract/compiled/ThoughtNFTV2.json",
      ).sha256,
      abi: {
        entryCount: thoughtArtifact.abi.length,
        canonicalJsonSha256: sha256(thoughtAbiJson),
        file: "thought-nft-v2.abi.json",
      },
      deployedBytecodeSha256: sha256(
        Buffer.from(deployedBytecode.replace(/^0x/, ""), "hex"),
      ),
    },
    renderer: {
      name: "ThoughtRendererV2",
      sourceArtifactSha256: manifestEntry(
        manifest,
        "contract/compiled/ThoughtRendererV2.json",
      ).sha256,
      abi: {
        entryCount: rendererArtifact.abi.length,
        canonicalJsonSha256: sha256(rendererAbiJson),
        file: "thought-renderer-v2.abi.json",
      },
      profile: {
        id: compatibility.renderer.canonicalId,
        implementationId: compatibility.renderer.packagedImplementation,
        glyphLibraryMemberId: rendererProfile.glyphSource.libraryMemberId,
        glyphDefinitionsPart1Keccak256:
          rendererProfile.glyphSource.pathDefinitions[0].keccak256,
        glyphDefinitionsPart2Keccak256:
          rendererProfile.glyphSource.pathDefinitions[1].keccak256,
        glyphDefinitionsKeccak256,
        glyphDefinitionsIndexKeccak256:
          rendererProfile.glyphSource.pathDefinitionIndex.keccak256,
        rendererReleaseReady: rendererProfile.qualification.rendererReleaseReady,
        usesForeignObject: rendererProfile.restrictions.foreignObject,
        usesNativeSvgPaths: true,
      },
    },
    verifier: {
      name: "CreationAttestationVerifier",
      sourceArtifactSha256: manifestEntry(
        manifest,
        "contract/compiled/CreationAttestationVerifier.json",
      ).sha256,
      abi: {
        entryCount: verifierArtifact.abi.length,
        canonicalJsonSha256: sha256(verifierAbiJson),
        file: "creation-attestation-verifier.abi.json",
      },
      signerPolicy: "backend-only-disposable-anvil-mock",
    },
    profiles: {
      work: {
        id: compatibility.workProfile.id,
        sha256: workProfile.sha256,
      },
      context: {
        id: compatibility.contextProfile.id,
        sha256: contextProfile.sha256,
      },
      metadata: {
        id: compatibility.metadataProfile.id,
        sha256: metadataProfile.sha256,
      },
      provenance: {
        id: compatibility.provenance.id,
        sha256: provenanceSchema.sha256,
      },
      creationAttestation: {
        id: compatibility.creationAttestation.id,
        sha256: attestationProfile.sha256,
      },
    },
    schemas: {
      mintInputSha256: mintInput.sha256,
      provenanceSha256: provenanceSchema.sha256,
    },
    references: copied,
    security: {
      containsPrivateKey: false,
      containsRuntimeAddresses: false,
      productionSignerDefined: false,
      rendererReleaseReady: rendererProfile.qualification.rendererReleaseReady,
    },
  };
  await writeOrCheck(output("integration-lock.json"), jsonBytes(lock));
  console.log(JSON.stringify({
    artifactId,
    checkOnly,
    lock: path.relative(root, output("integration-lock.json")),
    manifestSha256,
    verified: true,
  }));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

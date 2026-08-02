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
import {
  thoughtExternalUrlLegacyArtifacts,
  verifyThoughtMetadataPortability,
} from "./lib/thought-metadata-portability.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactId = "thought-v2-canonical-portable-release-20260801-r1";
const sourceTag = artifactId;
const sourceCommit = "a48191f5c0d5b51fab0de26707eaed86f2f1da5b";
const sourcePublicationCommit = "9617892bda9d7f7e880b614f84f1b6360ad8a652";
const manifestSha256 = "4d60feba36165c19a3cf3680078cc6baa7ba066c147ca607e5c82d0306f65b1a";
const previewRoot = path.join(
  root,
  "apps",
  "thought",
  "contract-release",
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

const removeLegacyOutput = async (filename) => {
  if (checkOnly) {
    try {
      await fs.access(filename);
      throw new Error(`stale App Contract vendor file: ${path.relative(root, filename)}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    return;
  }
  await fs.rm(filename, { force: true });
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
    manifest.source?.baseCommit !== sourceCommit ||
    manifest.source?.dirty !== false ||
    manifest.channel !== "stable" ||
    manifest.classification !== "canonical-portable-contract-release" ||
    manifest.flags?.productionConsumable !== true ||
    manifest.flags?.deploymentAuthorized !== false
  ) {
    throw new Error("canonical Contract release identity or safety flags mismatch");
  }
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(preview(entry.path));
    if (bytes.length !== entry.byteLength || sha256(bytes) !== entry.sha256) {
      throw new Error(`immutable integration preview file mismatch: ${entry.path}`);
    }
  }
  return manifest;
};

const verifyMetadataPortability = async (manifest) => {
  const metadataProfile = await readJson(
    preview("protocol", "current", "v2", "metadata", "thought.metadata.v2.profile.json"),
  );
  const decodedExamples = [];
  if (!thoughtExternalUrlLegacyArtifacts.has(artifactId)) {
    const fixtureEntries = manifest.files.filter((entry) =>
      entry.path.startsWith("fixtures/") &&
      entry.path.endsWith(".json") &&
      entry.path.includes("token-uri"),
    );
    for (const entry of fixtureEntries) {
      const fixture = await readJson(preview(...entry.path.split("/")));
      decodedExamples.push(...(fixture.examples ?? []));
    }
  }
  return verifyThoughtMetadataPortability({
    artifactId,
    decodedExamples,
    metadataProfile,
    requirePortableTraits: true,
  });
};

const main = async () => {
  const manifest = await verifyPreview();
  const metadataPortability = await verifyMetadataPortability(manifest);
  const compatibility = manifest.compatibility;
  const runtimeManifestArtifacts = await Promise.all([
    ["creative-spec", "protocol/current/v2/THOUGHT.v2.md"],
    ["work-profile", "protocol/current/v2/work/thought.work.v2.profile.json"],
    ["context-profile", "protocol/current/v2/context/thought.context.v2.profile.json"],
    ["metadata-profile", "protocol/current/v2/metadata/thought.metadata.v2.profile.json"],
    ["provenance-schema", "protocol/current/v2/provenance/thought.provenance.v2.schema.json"],
    [
      "creation-attestation-profile",
      "protocol/current/v2/attestation/thought.creation-workflow-attestation.v2.md",
    ],
    ["renderer-profile", "protocol/current/v2/renderer/thought.renderer.v2.profile.json"],
    ["renderer-glyph-packed-im76", "protocol/current/v2/renderer/mono-76.im76.bin"],
    ["renderer-glyph-package-manifest", "dependencies/mono-76/manifest.json"],
    ["renderer-glyph-provenance", "dependencies/mono-76/PROVENANCE.md"],
    ["renderer-glyph-license", "dependencies/mono-76/UNLICENSED.md"],
    ["renderer-glyph-notice", "dependencies/mono-76/NOTICE.md"],
  ].map(async ([role, artifactPath]) => ({
    keccak256: keccak256(await fs.readFile(preview(artifactPath))),
    path: artifactPath,
    role,
  })));
  const rendererProfile = await readJson(
    preview("protocol", "current", "v2", "renderer", "thought.renderer.v2.profile.json"),
  );
  const glyphPackedBytes = await fs.readFile(preview(rendererProfile.format.packedPath));
  const glyphPackedKeccak256 = keccak256(glyphPackedBytes);
  const glyphPackedSha256 = sha256(glyphPackedBytes);
  if (
    glyphPackedBytes.length !== rendererProfile.format.totalBytes ||
    glyphPackedKeccak256 !== rendererProfile.format.packedKeccak256 ||
    glyphPackedSha256 !== rendererProfile.format.packedSha256
  ) {
    throw new Error("Mono 76 packed renderer payload mismatch");
  }
  const runtimeManifest = {
    artifacts: runtimeManifestArtifacts,
    chainId: "31337",
    glyphLibrary: {
      family: rendererProfile.glyphSource.familyName,
      faceSha256: rendererProfile.glyphSource.faceSha256,
      libraryMemberId: rendererProfile.glyphSource.libraryMemberId,
      librarySetId: rendererProfile.glyphSource.familyId,
      manualEditPayloadSha256:
        rendererProfile.glyphSource.manualEditPayloadSha256,
      packedBytes: glyphPackedBytes.length,
      packedKeccak256: glyphPackedKeccak256,
      packedSha256: `0x${glyphPackedSha256}`,
      releaseTag: rendererProfile.glyphSource.releaseTag,
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
      role: "canonical-native-svg-paths",
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
    "CreationAttestationVerifierV2.json",
  );
  const verifierInterfaceArtifactPath = preview(
    "contract",
    "compiled",
    "ICreationAttestationVerifierV2.json",
  );
  const rendererArtifactPath = preview(
    "contract",
    "compiled",
    "ThoughtRendererV2.json",
  );
  const thoughtArtifactBytes = await fs.readFile(thoughtArtifactPath);
  const verifierArtifactBytes = await fs.readFile(verifierArtifactPath);
  const verifierInterfaceArtifactBytes = await fs.readFile(verifierInterfaceArtifactPath);
  const rendererArtifactBytes = await fs.readFile(rendererArtifactPath);
  const thoughtArtifact = JSON.parse(thoughtArtifactBytes.toString("utf8"));
  const verifierArtifact = JSON.parse(verifierArtifactBytes.toString("utf8"));
  const verifierInterfaceArtifact = JSON.parse(
    verifierInterfaceArtifactBytes.toString("utf8"),
  );
  const rendererArtifact = JSON.parse(rendererArtifactBytes.toString("utf8"));
  const thoughtAbiJson = JSON.stringify(thoughtArtifact.abi);
  const verifierAbiJson = JSON.stringify(verifierArtifact.abi);
  const verifierInterfaceAbiJson = JSON.stringify(verifierInterfaceArtifact.abi);
  const rendererAbiJson = JSON.stringify(rendererArtifact.abi);

  await writeOrCheck(output("thought-nft-v2.abi.json"), jsonBytes(thoughtArtifact.abi));
  await writeOrCheck(
    output("creation-attestation-verifier.abi.json"),
    jsonBytes(verifierArtifact.abi),
  );
  await writeOrCheck(
    output("creation-attestation-verifier-interface.abi.json"),
    jsonBytes(verifierInterfaceArtifact.abi),
  );
  await writeOrCheck(
    output("thought-renderer-v2.abi.json"),
    jsonBytes(rendererArtifact.abi),
  );

  const copied = {};
  for (const filename of [
    "thought-v2-canonical-json.ts",
    "thought-v2-context-profile.ts",
    "thought-v2-current-creation-attestation.ts",
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
      "thought.creation-workflow-attestation.v2.md",
    ),
    output("thought.creation-workflow-attestation.v2.md"),
  );
  const selectedSpec = await copyExact(
    preview("protocol", "current", "v2", "THOUGHT.v2.md"),
    output("thought.selected-spec.md"),
  );
  await removeLegacyOutput(
    path.join(referenceOutputRoot, "thought-v2-creation-attestation.ts"),
  );
  await removeLegacyOutput(output("thought.creation-workflow-attestation.v1.md"));

  const deployedBytecode =
    typeof thoughtArtifact.deployedBytecode === "string"
      ? thoughtArtifact.deployedBytecode
      : thoughtArtifact.deployedBytecode?.object ?? "";
  const lock = {
    schema: "inshell.thought.app-contract-integration-lock.v1",
    id: artifactId,
    status: "canonical-portable-local-acceptance",
    productionConsumable: true,
    deploymentAuthorized: false,
    artifact: {
      artifactId,
      classification: manifest.classification,
      manifestSha256,
      sourceTag,
      sourceTagPublished: true,
      sourceCommit,
      sourcePublicationCommit,
      productionConsumable: true,
      deploymentAuthorized: false,
      registrationApplicable: false,
      registrationAuthorized: false,
    },
    source: {
      repository: "THOUGHT",
      tag: sourceTag,
      commit: sourceCommit,
      dirtySnapshot: false,
      immutableConsumerRelease: true,
      artifactIntegrityVerified: true,
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
        ref: `dev://thought/contract-release/${artifactId}/${compatibility.selectedSpec.name}`,
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
        glyphPackedBytes: glyphPackedBytes.length,
        glyphPackedKeccak256,
        glyphPackedSha256,
        externalUrlBase: compatibility.metadataProfile.externalUrl.base,
        rendererReleaseReady: rendererProfile.qualification.rendererReleaseReady,
        usesForeignObject: rendererProfile.restrictions.foreignObject,
        usesNativeSvgPaths: true,
      },
    },
    verifier: {
      name: "CreationAttestationVerifierV2",
      sourceArtifactSha256: manifestEntry(
        manifest,
        "contract/compiled/CreationAttestationVerifierV2.json",
      ).sha256,
      abi: {
        entryCount: verifierArtifact.abi.length,
        canonicalJsonSha256: sha256(verifierAbiJson),
        file: "creation-attestation-verifier.abi.json",
      },
      interfaceAbi: {
        entryCount: verifierInterfaceArtifact.abi.length,
        canonicalJsonSha256: sha256(verifierInterfaceAbiJson),
        file: "creation-attestation-verifier-interface.abi.json",
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
    metadataPortability,
    verified: true,
  }));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

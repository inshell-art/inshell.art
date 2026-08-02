#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  keccak256,
  toUtf8Bytes,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadataRoot = path.join(root, "apps/thought/metadata/v2");
const releaseRoot = path.join(
  root,
  "apps/home/public/protocol/releases/thought-metadata-namespace-v2-20260731-r1",
);
const fixturePath = path.join(
  root,
  "apps/thought/contract-release/releases/",
  "thought-v2-canonical-portable-release-20260801-r1/fixtures/",
  "neutral-agent-model-token-uri-examples.anvil.json",
);
const lock = JSON.parse(
  await fs.readFile(path.join(metadataRoot, "metadata-namespace-lock.json"), "utf8"),
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const verifyArtifact = async (kind) => {
  const record = lock.artifacts?.[kind];
  assert(record?.file, `metadata namespace ${kind} lock file is missing`);
  const bytes = await fs.readFile(path.join(metadataRoot, record.file));
  assert(sha256(bytes) === record.sha256, `metadata namespace ${kind} SHA-256 mismatch`);
  assert(keccak256(bytes) === record.keccak256, `metadata namespace ${kind} Keccak-256 mismatch`);
  const packagedBytes = await fs.readFile(path.join(releaseRoot, record.file));
  assert(
    bytes.equals(packagedBytes),
    `packaged metadata namespace ${kind} bytes differ from the locked source`,
  );
  return { bytes, record };
};

const resolveLocalRef = (rootSchema, ref) => {
  assert(ref.startsWith("#/"), `unsupported non-local schema reference: ${ref}`);
  return ref.slice(2).split("/").reduce(
    (value, segment) => value[segment.replaceAll("~1", "/").replaceAll("~0", "~")],
    rootSchema,
  );
};

const validateSchemaValue = (value, schema, rootSchema, location = "$") => {
  if (schema.$ref) {
    validateSchemaValue(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, location);
    return;
  }
  if (schema.const !== undefined) {
    assert(same(value, schema.const), `${location} does not match const`);
  }
  if (schema.enum) {
    assert(schema.enum.some((candidate) => same(value, candidate)), `${location} is outside enum`);
  }
  if (schema.type) {
    const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    assert(actualType === schema.type, `${location} must be ${schema.type}; received ${actualType}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined) {
      assert([...value].length >= schema.minLength, `${location} is shorter than minLength`);
    }
    if (schema.maxLength !== undefined) {
      assert([...value].length <= schema.maxLength, `${location} exceeds maxLength`);
    }
    if (schema.pattern) {
      assert(new RegExp(schema.pattern, "u").test(value), `${location} does not match pattern`);
    }
    if (schema["x-thought-utf8-max-bytes"] !== undefined) {
      assert(
        Buffer.byteLength(value, "utf8") <= schema["x-thought-utf8-max-bytes"],
        `${location} exceeds UTF-8 byte limit`,
      );
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      assert(Object.hasOwn(value, required), `${location}.${required} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateSchemaValue(value[key], child, rootSchema, `${location}.${key}`);
      }
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        assert(known.has(key), `${location}.${key} is not allowed`);
      }
    }
  }
  for (const child of schema.allOf ?? []) {
    validateSchemaValue(value, child, rootSchema, location);
  }
  if (schema.if && isSchemaValid(value, schema.if, rootSchema)) {
    validateSchemaValue(value, schema.then ?? {}, rootSchema, location);
  }
};

const isSchemaValid = (value, schema, rootSchema) => {
  try {
    validateSchemaValue(value, schema, rootSchema);
    return true;
  } catch {
    return false;
  }
};

assert(
  lock.schema === "inshell.thought.metadata-namespace-lock.v1",
  "metadata namespace lock schema mismatch",
);
assert(
  lock.artifactId === "thought-metadata-namespace-v2-20260731-r1",
  "metadata namespace artifact ID mismatch",
);
assert(lock.namespace === "thought", "metadata namespace mismatch");
assert(
  lock.metadataProfile === "inshell.thought.metadata.v2.terminal-chat",
  "metadata profile mismatch",
);
assert(
  lock.authority?.tokenMetadataOwner === "THOUGHT Contract",
  "token metadata owner mismatch",
);
assert(
  lock.authority?.provenanceDocumentOwner === "THOUGHT App",
  "provenance document owner mismatch",
);
assert(lock.publication?.published === false, "unreviewed metadata namespace must stay unpublished");
assert(lock.publication?.packaged === true, "metadata namespace release must be packaged");
assert(
  lock.publication?.requiresCanonicalExternalUrlRelease === true,
  "external_url publication gate is missing",
);
assert(lock.publication?.canonicalOrigin === "https://inshell.art", "canonical origin mismatch");
assert(
  lock.publication?.previewOrigin === "https://preview.inshell.art",
  "preview origin mismatch",
);
assert(
  lock.publication?.immutableReleasePath ===
    "/protocol/releases/thought-metadata-namespace-v2-20260731-r1/",
  "immutable release path mismatch",
);
assert(
  lock.conventionalMetadata?.externalUrlBase === "https://inshell.art/thought/",
  "canonical external_url base mismatch",
);
assert(
  lock.conventionalMetadata?.externalUrlInsideNamespace === false,
  "external_url must remain a conventional top-level field",
);
assert(
  lock.validation?.contractArtifactId ===
    "thought-v2-canonical-portable-release-20260801-r1",
  "metadata namespace validation artifact mismatch",
);
assert(lock.validation?.decodedFixture === path.relative(root, fixturePath), "decoded fixture lock mismatch");
assert(lock.validation?.decodedExamples === 3, "decoded fixture count lock mismatch");
assert(
  same(lock.validation?.creationAttestationStatuses, ["Inshell THOUGHT App", "Unattested"]),
  "Creation Attestation fixture-state lock mismatch",
);

const [{ bytes: schemaBytes, record: schemaRecord }, { bytes: specBytes, record: specRecord }] =
  await Promise.all([verifyArtifact("schema"), verifyArtifact("spec")]);
const schema = JSON.parse(schemaBytes.toString("utf8"));
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "schema draft mismatch");
assert(
  schema.$id ===
    "https://inshell.art/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json",
  "immutable metadata namespace schema URI mismatch",
);
assert(schema.additionalProperties === false, "metadata namespace root must be closed");
assert(
  schema.properties?.metadataProfileId?.const === lock.metadataProfile,
  "metadata namespace profile identifier mismatch",
);
assert(
  schema.properties?.provenanceProfileId?.const === "inshell.thought.provenance.v2",
  "metadata namespace provenance identifier mismatch",
);
assert(
  schema.properties?.provenanceJson?.["x-thought-content-schema"] ===
    "https://inshell.art/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json",
  "metadata namespace provenance content-schema link mismatch",
);
for (const staleTerm of ["Attested Agent", "Attested Model", "declared-unverified"]) {
  assert(!schemaBytes.includes(staleTerm), `stale metadata schema term remains: ${staleTerm}`);
  assert(!specBytes.includes(staleTerm), `stale metadata specification term remains: ${staleTerm}`);
}

const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
assert(fixture.examples?.length === 3, "expected three r10 decoded tokenURI examples");
const attestationStatuses = new Set();
for (const example of fixture.examples) {
  const thought = example.metadata?.thought;
  validateSchemaValue(thought, schema, schema);
  attestationStatuses.add(thought.creationAttestation.status);
  assert(thought.mint.tokenId === String(example.tokenId), `token ${example.tokenId} mint ID mismatch`);
  assert(thought.workHash === thought.workHashPrecheck, `token ${example.tokenId} work hash mismatch`);
  assert(
    thought.provenanceHash === thought.provenanceCommitmentCheck,
    `token ${example.tokenId} provenance hash mismatch`,
  );
  assert(
    keccak256(toUtf8Bytes(thought.promptLine)) === thought.promptLineKeccak256,
    `token ${example.tokenId} prompt hash mismatch`,
  );
  assert(
    keccak256(toUtf8Bytes(thought.agentLine)) === thought.agentLineKeccak256,
    `token ${example.tokenId} Agent-line hash mismatch`,
  );
  assert(
    keccak256(toUtf8Bytes(thought.records.agent.label)) === thought.records.agent.keccak256,
    `token ${example.tokenId} Agent record hash mismatch`,
  );
  assert(
    keccak256(toUtf8Bytes(thought.records.model.label)) === thought.records.model.keccak256,
    `token ${example.tokenId} Model record hash mismatch`,
  );
  assert(JSON.parse(thought.provenanceJson), `token ${example.tokenId} provenance JSON is invalid`);
}
assert(
  same([...attestationStatuses].sort(), ["Inshell THOUGHT App", "Unattested"]),
  "r10 fixtures must cover attested and unattested namespace states",
);

const baseline = fixture.examples[0].metadata.thought;
const withUnknown = structuredClone(baseline);
withUnknown.unknownField = true;
assert(!isSchemaValid(withUnknown, schema, schema), "closed namespace accepted an unknown field");
const unattestedWithDigest = structuredClone(fixture.examples[1].metadata.thought);
unattestedWithDigest.creationAttestation.digest = baseline.creationAttestation.digest;
assert(
  !isSchemaValid(unattestedWithDigest, schema, schema),
  "unattested namespace accepted a nonzero digest",
);
const attestedWithoutDigest = structuredClone(baseline);
attestedWithoutDigest.creationAttestation.digest =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
assert(
  !isSchemaValid(attestedWithoutDigest, schema, schema),
  "attested namespace accepted a zero digest",
);
const leadingZeroToken = structuredClone(baseline);
leadingZeroToken.mint.tokenId = "01";
assert(!isSchemaValid(leadingZeroToken, schema, schema), "namespace accepted a leading-zero token ID");

const releaseFiles = (await fs.readdir(releaseRoot)).sort();
assert(
  same(releaseFiles, ["manifest.json", schemaRecord.file, specRecord.file].sort()),
  "immutable metadata namespace release contains an unexpected file set",
);

const manifestRecord = lock.publication?.manifest;
assert(manifestRecord?.file === "manifest.json", "metadata namespace manifest lock file mismatch");
const manifestBytes = await fs.readFile(path.join(releaseRoot, manifestRecord.file));
assert(sha256(manifestBytes) === manifestRecord.sha256, "metadata namespace manifest SHA-256 mismatch");
assert(
  keccak256(manifestBytes) === manifestRecord.keccak256,
  "metadata namespace manifest Keccak-256 mismatch",
);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert(
  manifest.schema === "inshell.thought.metadata-namespace-release-manifest.v1",
  "metadata namespace release manifest schema mismatch",
);
assert(manifest.artifactId === lock.artifactId, "metadata namespace manifest artifact ID mismatch");
assert(manifest.metadataProfile === lock.metadataProfile, "metadata namespace manifest profile mismatch");
assert(manifest.namespace === lock.namespace, "metadata namespace manifest namespace mismatch");
assert(manifest.releasePath === lock.publication.immutableReleasePath, "manifest release path mismatch");
assert(manifest.status === "immutable", "metadata namespace manifest status mismatch");
assert(
  same(manifest.files, [
    {
      path: specRecord.file,
      mediaType: "text/markdown; charset=utf-8",
      bytes: specBytes.length,
      sha256: specRecord.sha256,
      keccak256: specRecord.keccak256,
    },
    {
      path: schemaRecord.file,
      mediaType: "application/schema+json; charset=utf-8",
      bytes: schemaBytes.length,
      sha256: schemaRecord.sha256,
      keccak256: schemaRecord.keccak256,
    },
  ]),
  "metadata namespace manifest file records mismatch",
);

console.log(JSON.stringify({
  artifactId: lock.artifactId,
  metadataProfile: lock.metadataProfile,
  namespace: lock.namespace,
  packaged: lock.publication.packaged,
  published: lock.publication.published,
  fixtureExamples: fixture.examples.length,
  manifestSha256: manifestRecord.sha256,
  schemaSha256: schemaRecord.sha256,
  verified: true,
}));

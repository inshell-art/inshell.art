#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { keccak256 } from "../apps/thought/node_modules/ethers/lib.esm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const provenanceRoot = path.join(root, "apps/thought/provenance/v2");
const releaseRoot = path.join(
  root,
  "apps/thought/public/protocol/releases/thought-provenance-v2-20260731-r1",
);
const lock = JSON.parse(
  await fs.readFile(path.join(provenanceRoot, "provenance-lock.json"), "utf8"),
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const verifyArtifact = async (kind) => {
  const record = lock.artifacts?.[kind];
  assert(record?.file, `provenance ${kind} lock file is missing`);
  const bytes = await fs.readFile(path.join(provenanceRoot, record.file));
  assert(sha256(bytes) === record.sha256, `provenance ${kind} SHA-256 mismatch`);
  assert(keccak256(bytes) === record.keccak256, `provenance ${kind} Keccak-256 mismatch`);
  const publishedBytes = await fs.readFile(path.join(releaseRoot, record.file));
  assert(
    bytes.equals(publishedBytes),
    `packaged provenance ${kind} bytes differ from the locked source`,
  );
  return { bytes, record };
};

assert(lock.schema === "inshell.thought.provenance-lock.v1", "provenance lock schema mismatch");
assert(
  lock.artifactId === "thought-provenance-v2-20260731-r1",
  "provenance artifact ID mismatch",
);
assert(
  lock.provenanceSchema === "inshell.thought.provenance.v2",
  "provenance schema identifier mismatch",
);
assert(lock.authority?.owner === "THOUGHT App", "provenance owner mismatch");
assert(lock.authority?.contractParsesJson === false, "Contract JSON boundary mismatch");
assert(lock.publication?.published === false, "unreviewed provenance schema must remain unpublished");
assert(lock.publication?.packaged === true, "provenance release must be packaged");
assert(lock.publication?.canonicalOrigin === "https://inshell.art", "canonical origin mismatch");
assert(
  lock.publication?.previewOrigin === "https://preview.inshell.art",
  "preview origin mismatch",
);
assert(
  lock.publication?.immutableReleasePath ===
    "/protocol/releases/thought-provenance-v2-20260731-r1/",
  "immutable release path mismatch",
);

const [{ bytes: schemaBytes, record: schemaRecord }, { bytes: specBytes, record: specRecord }] =
  await Promise.all([
  verifyArtifact("schema"),
  verifyArtifact("spec"),
  ]);
const schema = JSON.parse(schemaBytes.toString("utf8"));
assert(
  schema.$id ===
    "https://inshell.art/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json",
  "immutable provenance schema URI mismatch",
);
assert(
  schema.properties?.schema?.const === "inshell.thought.provenance.v2",
  "provenance root identifier mismatch",
);
const schemaText = schemaBytes.toString("utf8");
for (const staleTerm of ["agentDeclaration", "modelDeclaration", "declared-unverified"]) {
  assert(!schemaText.includes(staleTerm), `stale provenance term remains: ${staleTerm}`);
}

const releaseFiles = (await fs.readdir(releaseRoot)).sort();
assert(
  JSON.stringify(releaseFiles) ===
    JSON.stringify(["manifest.json", specRecord.file, schemaRecord.file].sort()),
  "immutable provenance release contains an unexpected file set",
);

const manifestRecord = lock.publication?.manifest;
assert(manifestRecord?.file === "manifest.json", "provenance manifest lock file mismatch");
const manifestBytes = await fs.readFile(path.join(releaseRoot, manifestRecord.file));
assert(
  sha256(manifestBytes) === manifestRecord.sha256,
  "provenance manifest SHA-256 mismatch",
);
assert(
  keccak256(manifestBytes) === manifestRecord.keccak256,
  "provenance manifest Keccak-256 mismatch",
);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
assert(
  manifest.schema === "inshell.thought.provenance-release-manifest.v1",
  "provenance release manifest schema mismatch",
);
assert(manifest.artifactId === lock.artifactId, "provenance manifest artifact ID mismatch");
assert(
  manifest.provenanceSchema === lock.provenanceSchema,
  "provenance manifest schema identifier mismatch",
);
assert(
  manifest.releasePath === lock.publication.immutableReleasePath,
  "provenance manifest release path mismatch",
);
assert(manifest.status === "immutable", "provenance manifest status mismatch");

const expectedManifestFiles = [
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
];
assert(
  JSON.stringify(manifest.files) === JSON.stringify(expectedManifestFiles),
  "provenance manifest file records mismatch",
);

console.log(JSON.stringify({
  artifactId: lock.artifactId,
  provenanceSchema: lock.provenanceSchema,
  packaged: lock.publication.packaged,
  published: lock.publication.published,
  manifestSha256: manifestRecord.sha256,
  schemaSha256: lock.artifacts.schema.sha256,
  verified: true,
}));

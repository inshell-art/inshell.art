#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactId = "thought-v2-canonical-portable-release-20260801-r1";
const sourceTag = artifactId;
const sourceCommit = "a48191f5c0d5b51fab0de26707eaed86f2f1da5b";
const sourcePublicationCommit = "9617892bda9d7f7e880b614f84f1b6360ad8a652";
const sourceTagObject = "bfba44f93a8562989361174c769ffd95264b36ee";
const stableReceiptCommit = "a19d1cc3c0e9ff81b2e31f89a4b327784d897854";
const stableReceiptPath = "artifacts/thought-v2-contract-release/stable.json";
const manifestSha256 = "4d60feba36165c19a3cf3680078cc6baa7ba066c147ca607e5c82d0306f65b1a";
const destination = path.join(
  root,
  "apps",
  "thought",
  "contract-release",
  "releases",
  artifactId,
);
const lockFile = path.join(root, "apps", "thought", "contract-release", "consumer-lock.json");
const generatedFile = path.join(
  root,
  "apps",
  "thought",
  "src",
  "thought-v2-contract-release.generated.ts",
);
const localSpecFile = path.join(root, "apps", "thought", "spec", "THOUGHT.v2.local.md");
const baselineArtifactId = "thought-v2-noncanonical-integration-preview-20260801-r11";
const baselineManifestSha256 =
  "64acf59f8305f362d720fd418f0401ad16fcfcb0cfdc290fdc298dc83054e3dd";
const migrationEvidencePath = path.join(
  "validation",
  "r11-to-canonical-portable-release.json",
);
const portableAttributeOrder = [
  "Agent",
  "Model",
  "Creation Attestation",
  "Prompt Bytes",
  "Agent Bytes",
];

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const fromIndex = args.indexOf("--from");
const sourceRepo = path.resolve(root, fromIndex >= 0 ? args[fromIndex + 1] : "../THOUGHT");
const source = path.join(
  sourceRepo,
  "artifacts",
  "thought-v2-contract-release",
  "releases",
  artifactId,
);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

async function verifyRelease(directory) {
  const manifestBytes = await fs.readFile(path.join(directory, "manifest.json"));
  const actualManifestSha256 = sha256(manifestBytes);
  if (actualManifestSha256 !== manifestSha256) {
    throw new Error(`canonical Contract release manifest mismatch: ${actualManifestSha256}`);
  }

  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (
    manifest.artifactId !== artifactId ||
    manifest.channel !== "stable" ||
    manifest.classification !== "canonical-portable-contract-release" ||
    manifest.flags?.productionConsumable !== true ||
    manifest.flags?.deploymentAuthorized !== false ||
    manifest.flags?.registrationApplicable !== false ||
    manifest.flags?.registrationAuthorized !== false
  ) {
    throw new Error("canonical Contract release classification or safety flags mismatch");
  }

  for (const entry of manifest.files ?? []) {
    const bytes = await fs.readFile(path.join(directory, entry.path));
    if (bytes.length !== entry.byteLength || sha256(bytes) !== entry.sha256) {
      throw new Error(`canonical Contract release file mismatch: ${entry.path}`);
    }
  }

  const migration = await readJson(path.join(directory, migrationEvidencePath));
  if (
    migration.schema !==
      "inshell.thought.r11-to-canonical-portable-release.v1" ||
    migration.baseline?.artifactId !== baselineArtifactId ||
    migration.baseline?.manifestSha256 !== baselineManifestSha256 ||
    migration.current?.artifactId !== artifactId ||
    !Object.values(migration.declaredChanges ?? {}).every((value) => value === true) ||
    !Object.values(migration.declaredUnchanged ?? {}).every((value) => value === true) ||
    !(migration.exactFileEvidence ?? []).every(({ exact }) => exact === true) ||
    !(migration.compiledArtifacts ?? []).every(
      ({ abiEqual, creationBytecodeEqual, runtimeBytecodeEqual }) =>
        abiEqual === true &&
        creationBytecodeEqual === true &&
        runtimeBytecodeEqual === true,
    )
  ) {
    throw new Error("r11-to-canonical release migration evidence mismatch");
  }
  if (
    JSON.stringify(manifest.compatibility?.metadataProfile?.attributeOrder) !==
      JSON.stringify(portableAttributeOrder)
  ) {
    throw new Error("canonical portable marketplace trait order mismatch");
  }

  return manifest;
}

function lockFromManifest(manifest) {
  return {
    schema: "inshell.thought.canonical-contract-release-consumer-lock.v1",
    artifactId,
    classification: manifest.classification,
    channel: manifest.channel,
    manifestSha256,
    sourceTag,
    sourceTagObject,
    sourceTagTarget: sourcePublicationCommit,
    sourceTagPublished: true,
    sourceCommit,
    sourcePublicationCommit,
    stableReceiptCommit,
    stableReceiptPath,
    productionConsumable: true,
    deploymentAuthorized: false,
    registrationApplicable: false,
    registrationAuthorized: false,
    deploymentPolicy: manifest.deploymentPolicy,
    compatibility: manifest.compatibility,
  };
}

function generatedSource(lock, specText) {
  return `// Generated by scripts/sync-thought-v2-contract-release.mjs. Do not edit.\n` +
    `export const THOUGHT_V2_CONTRACT_RELEASE = ${JSON.stringify(lock, null, 2)} as const;\n` +
    `export const THOUGHT_V2_CONTRACT_RELEASE_SPEC_TEXT = ${JSON.stringify(specText)};\n`;
}

async function main() {
  if (!checkOnly) {
    const checkedOutCommit = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    const publishedTagCommit = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", `${sourceTag}^{}`],
      { encoding: "utf8" },
    ).trim();
    const publishedTagObject = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", sourceTag],
      { encoding: "utf8" },
    ).trim();
    if (
      checkedOutCommit !== sourcePublicationCommit ||
      publishedTagCommit !== sourcePublicationCommit ||
      publishedTagObject !== sourceTagObject
    ) {
      throw new Error(
        `canonical release publication mismatch: HEAD ${checkedOutCommit}, tag ${publishedTagCommit}, object ${publishedTagObject}`,
      );
    }
    const stableReceipt = JSON.parse(execFileSync(
      "git",
      ["-C", sourceRepo, "show", `${stableReceiptCommit}:${stableReceiptPath}`],
      { encoding: "utf8" },
    ));
    if (
      stableReceipt.artifactId !== artifactId ||
      stableReceipt.manifestSha256 !== manifestSha256 ||
      stableReceipt.publicationCommit !== sourcePublicationCommit ||
      stableReceipt.tagTarget !== sourcePublicationCommit ||
      stableReceipt.productionConsumable !== true ||
      stableReceipt.deploymentAuthorized !== false
    ) {
      throw new Error("canonical release stable receipt mismatch");
    }
    const manifest = await verifyRelease(source);
    if (
      manifest.source?.baseCommit !== sourceCommit ||
      manifest.source?.dirty !== false ||
      manifest.source?.tag !== sourceTag
    ) {
      throw new Error("canonical Contract release clean source identity mismatch");
    }
    await fs.rm(destination, { force: true, recursive: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true });
    const lock = lockFromManifest(manifest);
    const specText = await fs.readFile(
      path.join(source, "protocol", "current", "v2", "THOUGHT.v2.md"),
      "utf8",
    );
    await fs.writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
    await fs.writeFile(generatedFile, generatedSource(lock, specText), "utf8");
    await fs.writeFile(localSpecFile, specText, "utf8");
  }

  const manifest = await verifyRelease(destination);
  const expectedLock = lockFromManifest(manifest);
  const actualLock = await readJson(lockFile);
  if (JSON.stringify(actualLock) !== JSON.stringify(expectedLock)) {
    throw new Error("canonical Contract release consumer lock mismatch");
  }
  const specText = await fs.readFile(
    path.join(destination, "protocol", "current", "v2", "THOUGHT.v2.md"),
    "utf8",
  );
  if ((await fs.readFile(generatedFile, "utf8")) !== generatedSource(expectedLock, specText)) {
    throw new Error("canonical Contract release generated module mismatch");
  }
  if ((await fs.readFile(localSpecFile, "utf8")) !== specText) {
    throw new Error("canonical Contract release local THOUGHT spec mismatch");
  }

  console.log(JSON.stringify({ artifactId, fileCount: manifest.files.length, manifestSha256, verified: true }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

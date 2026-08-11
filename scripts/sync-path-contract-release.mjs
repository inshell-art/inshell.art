#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseTag = "v0.5.0";
const releaseTagObject = "931be2df9445de5031274e34cd092de4c41e3462";
const releasePublicationCommit = "085cfc084b0e568740e0da639e968eb535f7e5c8";
const contractSourceCommit = "5a1ab1f137e76c80dc69045dc520454f6e07cbb1";
const manifestSha256 = "a81355b459b40faea894cf1dfb7f484765a7ec62672039dd62d58a3a52849921";
const checksumListSha256 = "aeef6cd17d4f987e89f3824f9518ee9015698166ce40c3c08e32f9f73ed9dcaa";
const checksumManifestSha256 = "760cd3a12912518e61d5f590861c303b5fd676daccb4d2b746028ab4b215ed6c";
const canonicalContracts = ["PathNFT", "PathPulseAdapter", "PulseAuction"];
const checksums = {
  "DOWNSTREAM_HANDOFF.md": "da97dc3399b9c212ff7cbabc16b5b7c9a3601416765d33d846bd75874c7593de",
  "abi/PathNFT.json": "c66d840e88064753923668e6107ab9de8ce62130fa798de6f159540a14e899fe",
  "abi/PathPulseAdapter.json": "d248fbff3b9f429f4627bcaa65ac47f1df468bd00abd7b53efca08a8ea72c031",
  "abi/PulseAuction.json": "26cfa9162b98b3c6f43f943403b2697e9ded310df647377a0de6105a97ff086a",
  "hardhat/PathNFT.json": "c7e136539f94d6b5a4e3068c6afc1eaed26dea6c465d5716e83e2fc101d5583e",
  "hardhat/PathPulseAdapter.json": "ae0237c5731663e4a61fe1a676cec039665eea4d7fee26ee1a193305e58e1a31",
  "hardhat/PulseAuction.json": "d6ee3a6460fb02e6e391861ceab73b4fb8ee8cff0f1d514ca8695f717cdab796",
  "manifest.json": manifestSha256,
};
const releaseFiles = [
  ...Object.keys(checksums),
  "SHA256SUMS.txt",
  "checksums.json",
].sort();
const destination = path.join(
  root,
  "packages/contracts/src/path-release/releases",
  releaseTag,
);
const lockFile = path.join(
  root,
  "packages/contracts/src/path-release/consumer-lock.json",
);

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const fromIndex = args.indexOf("--from");
const sourceRepo = path.resolve(
  root,
  fromIndex >= 0 ? args[fromIndex + 1] : "../path",
);
const source = path.join(sourceRepo, "releases", releaseTag);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

function expectedLock(manifest) {
  return {
    schema: "inshell.path.contract-release-consumer-lock.v1",
    releaseTag,
    releaseTagObject,
    releasePublicationCommit,
    contractSourceCommit,
    manifestSha256,
    checksumListSha256,
    checksumManifestSha256,
    compiler: manifest.compiler,
    canonicalContracts,
    deploymentAddressesIncluded: false,
    deploymentRecordsCoupled: false,
    deploymentRecords: [
      "packages/contracts/src/addresses",
      "packages/contracts/src/releases",
    ],
    compatibility: manifest.compatibility,
    checksums,
  };
}

export function parseSha256Sums(text) {
  const parsed = {};
  for (const line of text.trim().split("\n")) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw new Error(`invalid PATH SHA256SUMS entry: ${line}`);
    if (Object.hasOwn(parsed, match[2])) {
      throw new Error(`duplicate PATH SHA256SUMS path: ${match[2]}`);
    }
    parsed[match[2]] = match[1];
  }
  return parsed;
}

function findFunction(abi, name) {
  return abi.find((entry) => entry?.type === "function" && entry.name === name);
}

function findEntry(abi, type, name) {
  return abi.find((entry) => entry?.type === type && entry.name === name);
}

async function listFiles(directory, relativeDirectory = "") {
  const entries = await fs.readdir(path.join(directory, relativeDirectory), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(directory, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`PATH ${releaseTag} release contains unsupported entry: ${relativePath}`);
    }
  }
  return files.sort();
}

export async function verifyRelease(directory) {
  const actualFiles = await listFiles(directory);
  if (JSON.stringify(actualFiles) !== JSON.stringify(releaseFiles)) {
    throw new Error(`PATH ${releaseTag} release file inventory mismatch`);
  }
  const checksumJsonBytes = await fs.readFile(path.join(directory, "checksums.json"));
  const checksumTextBytes = await fs.readFile(path.join(directory, "SHA256SUMS.txt"));
  if (sha256(checksumJsonBytes) !== checksumManifestSha256) {
    throw new Error(`PATH ${releaseTag} checksums.json digest mismatch`);
  }
  if (sha256(checksumTextBytes) !== checksumListSha256) {
    throw new Error(`PATH ${releaseTag} SHA256SUMS.txt digest mismatch`);
  }
  const checksumJson = JSON.parse(checksumJsonBytes.toString("utf8"));
  const checksumText = checksumTextBytes.toString("utf8");
  if (
    JSON.stringify(checksumJson) !== JSON.stringify(checksums) ||
    JSON.stringify(parseSha256Sums(checksumText)) !== JSON.stringify(checksums)
  ) {
    throw new Error(`PATH ${releaseTag} checksum inventory mismatch`);
  }

  for (const [relativePath, expectedSha256] of Object.entries(checksums)) {
    const bytes = await fs.readFile(path.join(directory, relativePath));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== expectedSha256) {
      throw new Error(`PATH ${releaseTag} file mismatch: ${relativePath} (${actualSha256})`);
    }
  }

  const manifest = await readJson(path.join(directory, "manifest.json"));
  if (
    manifest.schema !== "path.downstream-artifacts.v1" ||
    manifest.releaseTag !== releaseTag ||
    manifest.contractSourceCommit !== contractSourceCommit ||
    JSON.stringify(manifest.canonicalContracts) !== JSON.stringify(canonicalContracts) ||
    manifest.compatibility?.networkAddressesIncluded !== false ||
    manifest.compatibility?.legacyMintContractsIncluded !== false
  ) {
    throw new Error(`PATH ${releaseTag} manifest identity or safety policy mismatch`);
  }

  for (const contract of canonicalContracts) {
    const abi = await readJson(path.join(directory, `abi/${contract}.json`));
    const artifact = await readJson(path.join(directory, `hardhat/${contract}.json`));
    const contractManifest = manifest.contracts?.[contract];
    const bytecode = typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : artifact.bytecode?.object;
    const deployedBytecode = typeof artifact.deployedBytecode === "string"
      ? artifact.deployedBytecode
      : artifact.deployedBytecode?.object;
    if (
      !contractManifest ||
      JSON.stringify(abi) !== JSON.stringify(artifact.abi) ||
      abi.length !== contractManifest.abiEntries ||
      typeof bytecode !== "string" ||
      typeof deployedBytecode !== "string" ||
      (bytecode.length - 2) / 2 !== contractManifest.creationBytecodeBytes ||
      (deployedBytecode.length - 2) / 2 !== contractManifest.runtimeBytecodeBytes
    ) {
      throw new Error(`PATH ${releaseTag} ABI/bytecode manifest mismatch: ${contract}`);
    }
  }

  const pathAbi = await readJson(path.join(directory, "abi/PathNFT.json"));
  const consumeUnit = findFunction(pathAbi, "consumeUnit");
  if (
    !findFunction(pathAbi, "getMovementQuota") ||
    !findFunction(pathAbi, "getPermissionEpoch") ||
    !findFunction(pathAbi, "isSparker") ||
    !findFunction(pathAbi, "locked") ||
    !findFunction(pathAbi, "sparkName") ||
    !findFunction(pathAbi, "getSparkInvitation") ||
    !findFunction(pathAbi, "allowSparker") ||
    !findFunction(pathAbi, "mintSparker") ||
    !findEntry(pathAbi, "event", "PermissionEpochAdvanced") ||
    !findEntry(pathAbi, "event", "Locked") ||
    !findEntry(pathAbi, "event", "Unlocked") ||
    !findEntry(pathAbi, "error", "BadConsumeAuthorization") ||
    !findEntry(pathAbi, "error", "SparkSoulbound") ||
    consumeUnit?.outputs?.[0]?.type !== "uint32"
  ) {
    throw new Error(`PATH ${releaseTag} canonical permission/Spark ABI is incomplete`);
  }

  return manifest;
}

export function assertSourceIdentity({
  checkedOutCommit,
  tagObject,
  tagTarget,
  releaseStatus,
}) {
  if (
    checkedOutCommit !== releasePublicationCommit ||
    tagObject !== releaseTagObject ||
    tagTarget !== releasePublicationCommit ||
    releaseStatus !== ""
  ) {
    throw new Error(
      `PATH ${releaseTag} publication mismatch: HEAD ${checkedOutCommit}, ` +
        `tag ${tagObject} -> ${tagTarget}, release status ${JSON.stringify(releaseStatus)}`,
    );
  }
}

export async function main() {
  if (!checkOnly) {
    const checkedOutCommit = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim();
    const tagObject = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", releaseTag],
      { encoding: "utf8" },
    ).trim();
    const tagTarget = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", `${releaseTag}^{}`],
      { encoding: "utf8" },
    ).trim();
    const releaseStatus = execFileSync(
      "git",
      [
        "-C",
        sourceRepo,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        `releases/${releaseTag}`,
      ],
      { encoding: "utf8" },
    ).trim();
    assertSourceIdentity({ checkedOutCommit, tagObject, tagTarget, releaseStatus });
    const manifest = await verifyRelease(source);
    await fs.rm(destination, { force: true, recursive: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true });
    await fs.mkdir(path.dirname(lockFile), { recursive: true });
    await fs.writeFile(
      lockFile,
      `${JSON.stringify(expectedLock(manifest), null, 2)}\n`,
      "utf8",
    );
  }

  const manifest = await verifyRelease(destination);
  const actualLock = await readJson(lockFile);
  if (JSON.stringify(actualLock) !== JSON.stringify(expectedLock(manifest))) {
    throw new Error(`PATH ${releaseTag} consumer lock mismatch`);
  }

  console.log(JSON.stringify({
    releaseTag,
    contractSourceCommit,
    contractCount: canonicalContracts.length,
    checksumCount: Object.keys(checksums).length,
    deploymentAddressesIncluded: false,
    verified: true,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

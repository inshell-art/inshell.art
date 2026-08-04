#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseTag = "v0.4.2";
const releasePublicationCommit = "8a8e4fe91857fdff8c54e9d4cc918b1e1f08cd76";
const contractSourceCommit = "1c846e1cfcd761a8e7b7e908edfa655204b62036";
const manifestSha256 = "41cd0bc56398fe6823a3bd40a7497851b8ec132a8002a4f0a15bc5b284a29393";
const canonicalContracts = ["PathNFT", "PathPulseAdapter", "PulseAuction"];
const checksums = {
  "DOWNSTREAM_HANDOFF.md": "257da7a4f547f3fb01698cd440ca9606101af38ef4ff0c4ccaa4455c68527670",
  "abi/PathNFT.json": "cf91b546154e6c69a6ea664ce3fcdc01bebb2c9f930d994fa9711068f701ea3c",
  "abi/PathPulseAdapter.json": "d248fbff3b9f429f4627bcaa65ac47f1df468bd00abd7b53efca08a8ea72c031",
  "abi/PulseAuction.json": "26cfa9162b98b3c6f43f943403b2697e9ded310df647377a0de6105a97ff086a",
  "hardhat/PathNFT.json": "d22d1f41f4621b36cabc4768f9139a5a9ed11b935537523b31baee28e61e9d1f",
  "hardhat/PathPulseAdapter.json": "91d344bb7f38c2e49d457090429a5c1a4c8aa80e147652ad53f082070a179671",
  "hardhat/PulseAuction.json": "b7ec12760ffbb0c9baa1d6e80d37d26bee599a9d5589cd21be31826366709081",
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
    releasePublicationCommit,
    contractSourceCommit,
    manifestSha256,
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

function parseSha256Sums(text) {
  return Object.fromEntries(
    text
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  (.+)$/);
        if (!match) throw new Error(`invalid PATH SHA256SUMS entry: ${line}`);
        return [match[2], match[1]];
      }),
  );
}

function findFunction(abi, name) {
  return abi.find((entry) => entry?.type === "function" && entry.name === name);
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
    }
  }
  return files.sort();
}

async function verifyRelease(directory) {
  const actualFiles = await listFiles(directory);
  if (JSON.stringify(actualFiles) !== JSON.stringify(releaseFiles)) {
    throw new Error("PATH v0.4.2 release file inventory mismatch");
  }
  const checksumJson = await readJson(path.join(directory, "checksums.json"));
  const checksumText = await fs.readFile(path.join(directory, "SHA256SUMS.txt"), "utf8");
  if (
    JSON.stringify(checksumJson) !== JSON.stringify(checksums) ||
    JSON.stringify(parseSha256Sums(checksumText)) !== JSON.stringify(checksums)
  ) {
    throw new Error("PATH v0.4.2 checksum inventory mismatch");
  }

  for (const [relativePath, expectedSha256] of Object.entries(checksums)) {
    const bytes = await fs.readFile(path.join(directory, relativePath));
    const actualSha256 = sha256(bytes);
    if (actualSha256 !== expectedSha256) {
      throw new Error(`PATH v0.4.2 file mismatch: ${relativePath} (${actualSha256})`);
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
    throw new Error("PATH v0.4.2 manifest identity or safety policy mismatch");
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
      throw new Error(`PATH v0.4.2 ABI/bytecode manifest mismatch: ${contract}`);
    }
  }

  const pathAbi = await readJson(path.join(directory, "abi/PathNFT.json"));
  const consumeUnit = findFunction(pathAbi, "consumeUnit");
  if (
    !findFunction(pathAbi, "getMovementQuota") ||
    !findFunction(pathAbi, "isSparker") ||
    !findFunction(pathAbi, "allowSparker") ||
    !findFunction(pathAbi, "mintSparker") ||
    consumeUnit?.outputs?.[0]?.type !== "uint32"
  ) {
    throw new Error("PATH v0.4.2 canonical movement/self-claim ABI is incomplete");
  }

  return manifest;
}

async function main() {
  if (!checkOnly) {
    const tagTarget = execFileSync(
      "git",
      ["-C", sourceRepo, "rev-parse", `${releaseTag}^{}`],
      { encoding: "utf8" },
    ).trim();
    if (tagTarget !== releasePublicationCommit) {
      throw new Error(`PATH ${releaseTag} tag target mismatch: ${tagTarget}`);
    }
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
    throw new Error("PATH v0.4.2 consumer lock mismatch");
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

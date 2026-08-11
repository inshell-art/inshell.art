import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertSafeArtifactPath,
  parseSha256Sums,
  verifyPathDependencyEnvelope,
  verifyRelease,
} from "./sync-thought-v2-integration-preview.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDirectory = path.join(
  root,
  "apps",
  "thought",
  "contract-release",
  "releases",
  "thought-v2-canonical-portable-release-20260807-r2",
);
const dependencyFile = path.join(
  releaseDirectory,
  "protocol",
  "current",
  "v2",
  "integration",
  "path-nft.v0.5.0.json",
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const copyRelease = async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inshell-thought-r2-"));
  const copiedRelease = path.join(temporaryRoot, "release");
  await fs.cp(releaseDirectory, copiedRelease, { recursive: true });
  t.after(() => fs.rm(temporaryRoot, { force: true, recursive: true }));
  return copiedRelease;
};

const rewriteManifest = async (directory, mutate) => {
  const manifestFile = path.join(directory, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  mutate(manifest);
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(manifestFile, manifestBytes);

  const checksumsFile = path.join(directory, "SHA256SUMS.txt");
  const checksumsText = await fs.readFile(checksumsFile, "utf8");
  const updatedChecksums = checksumsText.replace(
    /^[a-f0-9]{64}  manifest\.json$/mu,
    `${sha256(manifestBytes)}  manifest.json`,
  );
  assert.notEqual(updatedChecksums, checksumsText, "manifest checksum entry must be updated");
  const checksumsBytes = Buffer.from(updatedChecksums);
  await fs.writeFile(checksumsFile, checksumsBytes);
  return {
    checksumsSha256: sha256(checksumsBytes),
    manifestSha256: sha256(manifestBytes),
  };
};

const rewriteChecksums = async (directory, mutate) => {
  const checksumsFile = path.join(directory, "SHA256SUMS.txt");
  const checksumsText = await fs.readFile(checksumsFile, "utf8");
  const checksumsBytes = Buffer.from(mutate(checksumsText));
  await fs.writeFile(checksumsFile, checksumsBytes);
  return {
    checksumsSha256: sha256(checksumsBytes),
    manifestSha256: sha256(await fs.readFile(path.join(directory, "manifest.json"))),
  };
};

test("accepts the pinned R2 release with exact manifest and checksum coverage", async () => {
  const manifest = await verifyRelease(releaseDirectory);
  assert.equal(manifest.files.length, 73);
});

test("authenticates SHA256SUMS.txt itself", async (t) => {
  const directory = await copyRelease(t);
  await fs.appendFile(path.join(directory, "SHA256SUMS.txt"), "\n");
  await assert.rejects(
    verifyRelease(directory),
    /canonical Contract release checksum list mismatch/u,
  );
});

test("rejects an artifact file absent from both integrity inventories", async (t) => {
  const directory = await copyRelease(t);
  await fs.writeFile(path.join(directory, "unexpected.txt"), "unexpected\n", "utf8");
  await assert.rejects(
    verifyRelease(directory),
    /file-list mismatch:.*unexpected.*unexpected\.txt/u,
  );
});

test("rejects duplicate manifest paths before reading artifact content", async (t) => {
  const directory = await copyRelease(t);
  const expectedIntegrity = await rewriteManifest(directory, (manifest) => {
    manifest.files.push({ ...manifest.files[0] });
  });
  await assert.rejects(
    verifyRelease(directory, expectedIntegrity),
    /manifest\.json contains duplicate path/u,
  );
});

test("rejects unsafe manifest paths before resolving them", async (t) => {
  const directory = await copyRelease(t);
  const expectedIntegrity = await rewriteManifest(directory, (manifest) => {
    manifest.files[0].path = "../outside.json";
  });
  await assert.rejects(
    verifyRelease(directory, expectedIntegrity),
    /manifest\.json contains unsafe artifact path/u,
  );
});

test("rejects duplicate and unsafe SHA256SUMS.txt paths", () => {
  const checksum = "a".repeat(64);
  assert.throws(
    () => parseSha256Sums(Buffer.from(`${checksum}  safe.json\n${checksum}  safe.json\n`)),
    /SHA256SUMS\.txt contains duplicate path/u,
  );
  assert.throws(
    () => parseSha256Sums(Buffer.from(`${checksum}  ../outside.json\n`)),
    /SHA256SUMS\.txt contains unsafe artifact path/u,
  );
});

test("requires SHA256SUMS.txt to cover every manifest path exactly", async (t) => {
  const directory = await copyRelease(t);
  const expectedIntegrity = await rewriteChecksums(directory, (checksumsText) =>
    checksumsText.replace(/^[a-f0-9]{64}  contract\/index\.json\n/mu, ""),
  );
  await assert.rejects(
    verifyRelease(directory, expectedIntegrity),
    /SHA256SUMS\.txt file-list mismatch: missing \["contract\/index\.json"\]/u,
  );
});

test("rejects nonportable artifact path spellings", () => {
  for (const artifactPath of [
    "",
    "/absolute.json",
    "../outside.json",
    "nested/../../outside.json",
    "nested/./file.json",
    "nested//file.json",
    "nested\\file.json",
    "nested/file.json\nignored",
  ]) {
    assert.throws(
      () => assertSafeArtifactPath(artifactPath, "test inventory"),
      /unsafe artifact path/u,
      artifactPath,
    );
  }
});

test("ties every runtime-relevant PATH dependency field to the local lane pin", async (t) => {
  const dependency = JSON.parse(await fs.readFile(dependencyFile, "utf8"));
  assert.equal(verifyPathDependencyEnvelope(dependency), dependency);

  const mismatches = [
    ["release tag", (value) => {
      value.releaseTag = "v0.5.1";
    }],
    ["publication commit", (value) => {
      value.releasePublicationCommit = "0".repeat(40);
    }],
    ["source commit", (value) => {
      value.contractSourceCommit = "0".repeat(40);
    }],
    ["manifest", (value) => {
      value.manifestSha256 = "0".repeat(64);
    }],
    ["PathNFT artifact", (value) => {
      value.pathNft.hardhatArtifactSha256 = "0".repeat(64);
    }],
    ["redeployment requirement", (value) => {
      value.pathNft.redeploymentRequired = false;
    }],
    ["authorization schema", (value) => {
      value.consumeAuthorization.schema = "stale";
    }],
    ["consume method", (value) => {
      value.consumeAuthorization.requiredMethod = "consumeUnit()";
    }],
    ["consume return type", (value) => {
      value.consumeAuthorization.requiredReturnType = "uint256";
    }],
  ];

  for (const [name, mutate] of mismatches) {
    await t.test(name, () => {
      const mismatched = structuredClone(dependency);
      mutate(mismatched);
      assert.throws(
        () => verifyPathDependencyEnvelope(mismatched),
        /PATH dependency does not match the local lane pin/u,
      );
    });
  }
});

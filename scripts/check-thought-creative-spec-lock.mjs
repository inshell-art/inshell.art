#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  id,
  keccak256,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const specPath = path.join(root, "apps/thought/spec/THOUGHT.v2.md");
const lockPath = path.join(root, "apps/thought/spec/THOUGHT.v2.lock.json");

const expected = {
  artifactId: "thought-v2-creative-work-spec-20260723-r1",
  byteLength: 14849,
  sha256: "67f65b79188d4294e7cc63ab1bd1eadd666ebf7fa6ed4a163eb3bd9ec4c06cd8",
  thoughtSpecId: "0x0a33583e39050834eb77372ea8b41ceded8fe4bb47c31fe1a72ebb880351b410",
  thoughtSpecHash: "0x247dc71285b4f1078c822830ed2044138d61343bbf25cc6719b66742ed5cd5ea",
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const specBytes = await fs.readFile(specPath);
const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
const specText = new TextDecoder("utf-8", { fatal: true }).decode(specBytes);
const sha256 = createHash("sha256").update(specBytes).digest("hex");
const thoughtSpecId = id("THOUGHT.v2.md");
const thoughtSpecHash = keccak256(specBytes);

assert(!specBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), "creative spec has a UTF-8 BOM");
assert(!specBytes.includes(13), "creative spec must use LF line endings");
assert(specText.endsWith("\n"), "creative spec must end with one LF");
assert(
  specText.startsWith("# THOUGHT v2 — Creative Work Specification\n"),
  "creative spec heading mismatch",
);
assert(lock.schema === "inshell.thought.creative-spec-lock.v1", "creative spec lock schema mismatch");
assert(lock.artifactId === expected.artifactId, "creative spec artifact ID changed");
assert(lock.authority?.owner === "THOUGHT App", "creative spec owner mismatch");
assert(lock.artifact?.name === "THOUGHT.v2.md", "creative spec name mismatch");
assert(lock.artifact?.path === "apps/thought/spec/THOUGHT.v2.md", "creative spec path mismatch");
assert(lock.artifact?.byteLength === expected.byteLength, "locked creative spec byte length changed");
assert(lock.artifact?.sha256 === expected.sha256, "locked creative spec SHA-256 changed");
assert(lock.artifact?.thoughtSpecId === expected.thoughtSpecId, "locked creative spec ID changed");
assert(lock.artifact?.thoughtSpecHash === expected.thoughtSpecHash, "locked creative spec hash changed");
assert(specBytes.length === expected.byteLength, "creative spec byte length mismatch");
assert(sha256 === expected.sha256, "creative spec SHA-256 mismatch");
assert(thoughtSpecId === expected.thoughtSpecId, "creative spec EVM ID mismatch");
assert(thoughtSpecHash === expected.thoughtSpecHash, "creative spec EVM hash mismatch");
assert(lock.contractIntegration?.registered === false, "unreviewed creative spec must not claim registration");

console.log(JSON.stringify({
  artifactId: expected.artifactId,
  byteLength: specBytes.length,
  sha256,
  thoughtSpecId,
  thoughtSpecHash,
  verified: true,
}));

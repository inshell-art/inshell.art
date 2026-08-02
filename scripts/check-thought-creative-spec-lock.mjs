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
  artifactId: "thought-v2-selected-spec-20260801-r10",
  byteLength: 4627,
  sha256: "90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b",
  thoughtSpecId: "0x0a33583e39050834eb77372ea8b41ceded8fe4bb47c31fe1a72ebb880351b410",
  thoughtSpecHash: "0xb2b0a167678816a7ae9dc9098b0d6a6852c0dc95feb59f9581de75bd2cc2231f",
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
  specText.startsWith("# THOUGHT.v2.md\n"),
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

#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

// Floors from GitHub alerts 121/122/123/125/126. Check the resolved graph,
// not just overrides: a second transitive version must not escape the check.
export function dependencySecurityErrors(lock) {
  if (!lock || lock.lockfileVersion !== "9.0" || !lock.packages || !lock.snapshots) return ["Expected a complete pnpm v9 lockfile."];
  const errors = [];
  for (const key of new Set([...Object.keys(lock.packages), ...Object.keys(lock.snapshots)])) {
    const match = /^(nanoid|postcss|js-yaml|extract-zip)@([^(:]+)/.exec(key);
    if (!match) continue;
    const [, name, version] = match;
    const numeric = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    const [major, minor, patch] = numeric ? numeric.slice(1).map(Number) : [];
    const atLeast = (m, p) => minor > m || (minor === m && patch >= p);
    const safe = numeric && (
      (name === "nanoid" && ((major === 3 && atLeast(3, 18)) || (major === 5 && atLeast(1, 6)))) ||
      (name === "postcss" && major === 8 && atLeast(5, 23)) ||
      (name === "js-yaml" && major === 4 && atLeast(3, 1))
    );
    if (!safe) errors.push(`${name}@${version}: vulnerable or unreviewed version; review the advisory before changing this guard.`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lock = load(readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"));
  const errors = dependencySecurityErrors(lock);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log("Known dependency security floors pass; extract-zip absent. This is not a complete vulnerability audit.");
}

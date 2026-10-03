#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

// Reviewed source identity. The codeload locator is an annotated tag object,
// not the peeled source commit; see docs/SURFACE_SHELL_DEPENDENCY.md.
export const SURFACE_SHELL_SPEC = "git+https://github.com/inshell-art/surface-shell.git#0.1.0";
export const SURFACE_SHELL_LOCK_TARBALL =
  "https://codeload.github.com/inshell-art/surface-shell/tar.gz/fbb3039416b3e01a24545aa4e9dada3399762550";

function hasOnlyKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function approvedIgnoreRules(ignore) {
  // A native Dependabot comment can hold this policy outside the repository.
  // Absence here proves nothing about that service-side state.
  return ignore === undefined || (Array.isArray(ignore) && (ignore.length === 0 || (
    ignore.length === 1 && hasOnlyKeys(ignore[0], ["dependency-name"]) &&
    ignore[0]["dependency-name"] === "surface-shell"
  )));
}

function preservesDefaultCoverage(allow) {
  return allow === undefined || (Array.isArray(allow) && allow.length === 1 &&
    hasOnlyKeys(allow[0], ["dependency-name", "dependency-type"]) &&
    (allow[0]["dependency-name"] === undefined || allow[0]["dependency-name"] === "*") &&
    (allow[0]["dependency-type"] === undefined || ["direct", "all"].includes(allow[0]["dependency-type"])) &&
    Object.keys(allow[0]).length > 0);
}

export function surfaceShellDependencyErrors({ thoughtPackage, dependabot, lock }) {
  const errors = [];
  const require = (condition, message) => {
    if (!condition) errors.push(message);
  };
  require(
    thoughtPackage?.dependencies?.["surface-shell"] === SURFACE_SHELL_SPEC,
    `apps/thought must declare the reviewed surface-shell source ${SURFACE_SHELL_SPEC}.`,
  );

  // Inspect active YAML, not matching words in comments or unrelated jobs.
  const npmEntries = Array.isArray(dependabot?.updates)
    ? dependabot.updates.filter((entry) => entry?.["package-ecosystem"] === "npm" && entry.directory === "/")
    : [];
  require(dependabot?.version === 2 && npmEntries.length === 1, "Dependabot must retain one active root npm update entry.");
  const npm = npmEntries[0];
  require(npm?.["target-branch"] === "staging", "Dependabot npm updates must target staging.");
  require(npm?.schedule?.interval === "daily", "Dependabot must retain the active daily npm schedule.");
  require(Number.isInteger(npm?.["open-pull-requests-limit"]) && npm["open-pull-requests-limit"] > 0, "Dependabot npm version updates must remain enabled.");
  require(
    approvedIgnoreRules(npm?.ignore),
    "Dependabot npm ignore rules may exclude only the exact surface-shell package, once and without version or update-type filters, under the approved manual-upkeep policy.",
  );
  require(
    preservesDefaultCoverage(npm?.allow),
    "Dependabot npm allow rules must retain default coverage for all declared dependencies or explicitly allow all dependencies.",
  );
  require(
    npm?.["exclude-paths"] === undefined || (Array.isArray(npm["exclude-paths"]) && npm["exclude-paths"].length === 0),
    "Dependabot npm path exclusions need review before changing the existing updater coverage.",
  );

  require(lock?.lockfileVersion === "9.0", "Expected a pnpm v9 lockfile.");
  const importer = lock?.importers?.["apps/thought"]?.dependencies?.["surface-shell"];
  require(importer?.specifier === SURFACE_SHELL_SPEC, "The apps/thought surface-shell lock importer must match its reviewed declared source.");
  require(importer?.version === SURFACE_SHELL_LOCK_TARBALL, "The apps/thought surface-shell importer must resolve to the reviewed codeload locator.");
  const packageKey = `surface-shell@${SURFACE_SHELL_LOCK_TARBALL}`;
  require(
    lock?.packages?.[packageKey]?.resolution?.tarball === SURFACE_SHELL_LOCK_TARBALL,
    "The surface-shell package resolution must match the importer codeload locator.",
  );
  require(
    Object.hasOwn(lock?.snapshots ?? {}, packageKey) && lock.snapshots[packageKey] !== null && typeof lock.snapshots[packageKey] === "object" && !Array.isArray(lock.snapshots[packageKey]),
    "The surface-shell importer must have its matching pnpm snapshot.",
  );
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  try {
    const dependabot = load(read(".github/dependabot.yml"));
    const errors = surfaceShellDependencyErrors({
      thoughtPackage: JSON.parse(read("apps/thought/package.json")),
      dependabot,
      lock: load(read("pnpm-lock.yaml")),
    });
    for (const error of errors) console.error(error);
    if (errors.length) process.exitCode = 1;
    else {
      const npm = dependabot.updates.find((entry) => entry["package-ecosystem"] === "npm" && entry.directory === "/");
      const policy = npm.ignore?.length
        ? "Local npm config excludes only surface-shell under the approved manual-upkeep policy."
        : "Local npm config has no package exclusion; any native service-side ignore must be verified separately.";
      console.log(`surface-shell declared source, importer and resolution agree. ${policy} Other declared dependencies retain automatic update coverage. Local checks do not verify Dependabot service-side ignore state, Releases-only watch, hosted updater success or upstream freshness.`);
    }
  } catch (error) {
    console.error(`Cannot check surface-shell dependency: ${error.message}`);
    process.exitCode = 1;
  }
}

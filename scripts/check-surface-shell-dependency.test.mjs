import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dump, load } from "js-yaml";
import {
  SURFACE_SHELL_LOCK_TARBALL,
  SURFACE_SHELL_SPEC,
  surfaceShellDependencyErrors,
} from "./check-surface-shell-dependency.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = {
  thoughtPackage: read("apps/thought/package.json"),
  dependabot: read(".github/dependabot.yml"),
  lock: read("pnpm-lock.yaml"),
};
const fixture = () => ({
  thoughtPackage: JSON.parse(source.thoughtPackage),
  dependabot: load(source.dependabot),
  lock: load(source.lock),
});
const npm = (value) => value.dependabot.updates.find((entry) => entry["package-ecosystem"] === "npm");
const importer = (value) => value.lock.importers["apps/thought"].dependencies["surface-shell"];
const packageKey = `surface-shell@${SURFACE_SHELL_LOCK_TARBALL}`;

test("reviewed repository source has a connected lock binding and active npm policy", () => {
  assert.deepEqual(surfaceShellDependencyErrors(fixture()), []);
});

test("commented configuration cannot stand in for an active npm updater", () => {
  const value = fixture();
  value.dependabot = load(`version: 2\nupdates: []\n${source.dependabot.split("\n").map((line) => `# ${line}`).join("\n")}`);
  assert.match(surfaceShellDependencyErrors(value).join("\n"), /active root npm/);
});

test("ignore text in comments or other ecosystems does not change active npm policy", () => {
  const value = fixture();
  value.dependabot.updates.find((entry) => entry["package-ecosystem"] === "github-actions").ignore = [{ "dependency-name": "surface-shell" }];
  value.dependabot = load(`${dump(value.dependabot)}\n# ignore:\n#   - dependency-name: surface-shell\n`);
  assert.deepEqual(surfaceShellDependencyErrors(value), []);
});

for (const [name, change, expected] of [
  ["inactive ecosystem with expected npm text in a comment", (value) => {
    npm(value)["package-ecosystem"] = "github-actions";
    value.dependabot = load(`${dump(value.dependabot)}\n# package-ecosystem: npm\n# directory: /\n`);
  }, /active root npm/],
  ["wrong target branch", (value) => { npm(value)["target-branch"] = "main"; }, /target staging/],
  ["wrong directory", (value) => { npm(value).directory = "/unrelated"; }, /active root npm/],
  ["disabled version updates", (value) => { npm(value)["open-pull-requests-limit"] = 0; }, /remain enabled/],
  ["invalid version-update limit", (value) => { npm(value)["open-pull-requests-limit"] = "5"; }, /remain enabled/],
  ["missing schedule", (value) => { delete npm(value).schedule; }, /daily npm schedule/],
  ["duplicate root npm entries", (value) => { value.dependabot.updates.push(structuredClone(npm(value))); }, /one active root npm/],
  ["wildcard ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-*" }]; }, /ignore rules may exclude only/],
  ["all-dependency ignore", (value) => { npm(value).ignore = [{ "dependency-name": "*" }]; }, /ignore rules may exclude only/],
  ["unrelated package ignore", (value) => { npm(value).ignore = [{ "dependency-name": "react" }]; }, /ignore rules may exclude only/],
  ["additional package ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell" }, { "dependency-name": "react" }]; }, /ignore rules may exclude only/],
  ["duplicate exact ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell" }, { "dependency-name": "surface-shell" }]; }, /ignore rules may exclude only/],
  ["case-changed ignore", (value) => { npm(value).ignore = [{ "dependency-name": "Surface-Shell" }]; }, /ignore rules may exclude only/],
  ["version-filtered ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell", versions: ["0.2.0"] }]; }, /without version or update-type filters/],
  ["update-type-filtered ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell", "update-types": ["version-update:semver-major"] }]; }, /without version or update-type filters/],
  ["empty version-filtered ignore", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell", versions: [] }]; }, /without version or update-type filters/],
  ["malformed ignore collection", (value) => { npm(value).ignore = { "dependency-name": "surface-shell" }; }, /ignore rules may exclude only/],
  ["null ignore collection", (value) => { npm(value).ignore = null; }, /ignore rules may exclude only/],
  ["null ignore rule", (value) => { npm(value).ignore = [null]; }, /ignore rules may exclude only/],
  ["missing ignore package", (value) => { npm(value).ignore = [{}]; }, /ignore rules may exclude only/],
  ["string ignore rule", (value) => { npm(value).ignore = ["surface-shell"]; }, /ignore rules may exclude only/],
  ["unknown ignore property", (value) => { npm(value).ignore = [{ "dependency-name": "surface-shell", unrelated: true }]; }, /ignore rules may exclude only/],
  ["allow excludes package", (value) => { npm(value).allow = [{ "dependency-name": "react" }]; }, /allow rules/],
  ["allow only surface-shell", (value) => { npm(value).allow = [{ "dependency-name": "surface-shell" }]; }, /allow rules/],
  ["allow only matching wildcard", (value) => { npm(value).allow = [{ "dependency-name": "surface-*" }]; }, /allow rules/],
  ["allow excludes production dependencies", (value) => { npm(value).allow = [{ "dependency-type": "development" }]; }, /allow rules/],
  ["allow excludes development dependencies", (value) => { npm(value).allow = [{ "dependency-type": "production" }]; }, /allow rules/],
  ["allow only indirect dependencies", (value) => { npm(value).allow = [{ "dependency-type": "indirect" }]; }, /allow rules/],
  ["allow excludes update types", (value) => { npm(value).allow = [{ "dependency-name": "surface-shell", "update-types": [] }]; }, /allow rules/],
  ["all-package allow with unsupported update-type filter", (value) => { npm(value).allow = [{ "dependency-name": "*", "update-types": ["version-update:semver-patch"] }]; }, /allow rules/],
  ["empty allow collection", (value) => { npm(value).allow = []; }, /allow rules/],
  ["empty allow rule", (value) => { npm(value).allow = [{}]; }, /allow rules/],
  ["malformed allow collection", (value) => { npm(value).allow = { "dependency-type": "all" }; }, /allow rules/],
  ["null allow collection", (value) => { npm(value).allow = null; }, /allow rules/],
  ["null allow rule", (value) => { npm(value).allow = [null]; }, /allow rules/],
  ["unknown allow property", (value) => { npm(value).allow = [{ "dependency-type": "all", unrelated: true }]; }, /allow rules/],
  ["manifest path excluded from updates", (value) => { npm(value)["exclude-paths"] = ["apps/thought/**"]; }, /path exclusions/],
  ["manifest source mismatch", (value) => { value.thoughtPackage.dependencies["surface-shell"] = "^0.1.0"; }, /must declare/],
  ["wrong active importer with expected specifier in a comment", (value) => {
    importer(value).specifier = "github:unrelated/surface-shell#0.1.0";
    value.lock = load(`${dump(value.lock)}\n# specifier: ${SURFACE_SHELL_SPEC}\n`);
  }, /lock importer must match/],
  ["expected specifier bound to another importer", (value) => {
    value.lock.importers.unrelated = structuredClone(value.lock.importers["apps/thought"]);
    delete value.lock.importers["apps/thought"].dependencies["surface-shell"];
  }, /lock importer must match/],
  ["wrong resolution with orphaned expected package and snapshot", (value) => {
    importer(value).version = "https://codeload.github.com/inshell-art/surface-shell/tar.gz/" + "a".repeat(40);
  }, /importer must resolve/],
  ["new resolved tag with stale declaration as produced by no-save", (value) => {
    const next = "https://codeload.github.com/inshell-art/surface-shell/tar.gz/" + "b".repeat(40);
    importer(value).version = next;
    value.lock.packages[`surface-shell@${next}`] = { resolution: { tarball: next } };
    value.lock.snapshots[`surface-shell@${next}`] = {};
  }, /importer must resolve/],
  ["missing package resolution", (value) => { delete value.lock.packages[packageKey]; }, /package resolution/],
  ["package tarball differs from importer", (value) => { value.lock.packages[packageKey].resolution.tarball = "https://example.invalid/wrong.tgz"; }, /package resolution/],
  ["missing matching snapshot", (value) => { delete value.lock.snapshots[packageKey]; }, /matching pnpm snapshot/],
  ["null matching snapshot", (value) => { value.lock.snapshots[packageKey] = null; }, /matching pnpm snapshot/],
  ["array matching snapshot", (value) => { value.lock.snapshots[packageKey] = []; }, /matching pnpm snapshot/],
  ["wrong lockfile version", (value) => { value.lock.lockfileVersion = "6.0"; }, /pnpm v9/],
]) {
  test(`rejects ${name}`, () => {
    const value = fixture();
    change(value);
    assert.match(surfaceShellDependencyErrors(value).join("\n"), expected);
  });
}

for (const [name, ignore] of [
  ["no config exclusion", undefined],
  ["empty config exclusion", []],
  ["exact unconditional surface-shell exclusion", [{ "dependency-name": "surface-shell" }]],
]) {
  test(`accepts ${name} without inferring native service-side state`, () => {
    const value = fixture();
    npm(value).ignore = ignore;
    assert.deepEqual(surfaceShellDependencyErrors(value), []);
  });
}

for (const allow of [
  [{ "dependency-name": "*" }],
  [{ "dependency-type": "direct" }],
  [{ "dependency-type": "all" }],
  [{ "dependency-name": "*", "dependency-type": "direct" }],
  [{ "dependency-name": "*", "dependency-type": "all" }],
]) {
  test(`accepts allow rules preserving default or broader coverage: ${JSON.stringify(allow)}`, () => {
    const value = fixture();
    npm(value).ignore = [{ "dependency-name": "surface-shell" }];
    npm(value).allow = allow;
    assert.deepEqual(surfaceShellDependencyErrors(value), []);
  });
}

test("CLI distinguishes checked local policy from unverified hosted policy and freshness", () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL("./check-surface-shell-dependency.mjs", import.meta.url))], { encoding: "utf8" });
  assert.match(output, /Local npm config has no package exclusion|Local npm config excludes only surface-shell/);
  assert.match(output, /Other declared dependencies retain automatic update coverage/);
  assert.match(output, /Local checks do not verify Dependabot service-side ignore state, Releases-only watch, hosted updater success or upstream freshness/);
});

test("missing parsed files fail closed", () => {
  assert.ok(surfaceShellDependencyErrors({}).length > 0);
});

test("duplicate YAML keys are rejected rather than selecting a convenient value", () => {
  assert.throws(() => load("updates: []\nupdates: []\n"), /duplicated mapping key/);
});

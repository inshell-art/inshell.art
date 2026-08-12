import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import {
  assertPathPublication,
  latestPathTag,
  latestThoughtTag,
  parseLsRemote,
} from "./check-upstream-releases.mjs";
import {
  assertSourceIdentity,
  parseSha256Sums,
  verifyRelease,
} from "./sync-path-contract-release.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pathReleaseDirectory = path.join(
  root,
  "packages/contracts/src/path-release/releases/v0.5.0",
);
const releaseTagObject = "931be2df9445de5031274e34cd092de4c41e3462";
const releasePublicationCommit = "085cfc084b0e568740e0da639e968eb535f7e5c8";

test("selects the newest PATH semantic release", () => {
  const tags = parseLsRemote(`
1111111111111111111111111111111111111111\trefs/tags/v0.4.2
2222222222222222222222222222222222222222\trefs/tags/v0.5.0
3333333333333333333333333333333333333333\trefs/tags/v0.5.0^{}
4444444444444444444444444444444444444444\trefs/tags/sepolia-candidate
`);
  assert.equal(latestPathTag(tags), "v0.5.0");
});

test("selects the newest canonical THOUGHT release by date and revision", () => {
  const tags = parseLsRemote(`
1111111111111111111111111111111111111111\trefs/tags/thought-v2-canonical-portable-release-20260731-r9
2222222222222222222222222222222222222222\trefs/tags/thought-v2-canonical-portable-release-20260801-r1
3333333333333333333333333333333333333333\trefs/tags/thought-v2-noncanonical-integration-preview-20260809-r99
`);
  assert.equal(
    latestThoughtTag(tags),
    "thought-v2-canonical-portable-release-20260801-r1",
  );
});

test("pins the annotated PATH tag object and publication target", () => {
  const lock = {
    releaseTagObject,
    releasePublicationCommit,
  };
  assert.doesNotThrow(() => assertPathPublication(lock, "v0.5.0", {
    object: releaseTagObject,
    target: releasePublicationCommit,
  }));
  assert.throws(
    () => assertPathPublication(lock, "v0.5.0", {
      object: "0".repeat(40),
      target: releasePublicationCommit,
    }),
    /consumer lock pins/u,
  );
});

test("requires a clean checkout of the exact PATH publication", () => {
  const identity = {
    checkedOutCommit: releasePublicationCommit,
    tagObject: releaseTagObject,
    tagTarget: releasePublicationCommit,
    releaseStatus: "",
  };
  assert.doesNotThrow(() => assertSourceIdentity(identity));
  for (const [field, value] of [
    ["checkedOutCommit", "0".repeat(40)],
    ["tagObject", "0".repeat(40)],
    ["tagTarget", "0".repeat(40)],
    ["releaseStatus", "?? releases/v0.5.0/untracked.json"],
  ]) {
    assert.throws(
      () => assertSourceIdentity({ ...identity, [field]: value }),
      /publication mismatch/u,
      field,
    );
  }
});

test("rejects symlinks in the PATH release inventory", async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inshell-path-release-"));
  const copiedRelease = path.join(temporaryRoot, "v0.5.0");
  t.after(() => fs.rm(temporaryRoot, { force: true, recursive: true }));
  await fs.cp(pathReleaseDirectory, copiedRelease, { recursive: true });
  await fs.symlink("manifest.json", path.join(copiedRelease, "unexpected-link.json"));
  await assert.rejects(
    verifyRelease(copiedRelease),
    /release contains unsupported entry: unexpected-link\.json/u,
  );
});

test("authenticates PATH checksum inventories byte-for-byte", async (t) => {
  await t.test("checksums.json", async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inshell-path-release-"));
    const copiedRelease = path.join(temporaryRoot, "v0.5.0");
    await fs.cp(pathReleaseDirectory, copiedRelease, { recursive: true });
    await fs.appendFile(path.join(copiedRelease, "checksums.json"), " \n");
    await assert.rejects(verifyRelease(copiedRelease), /checksums\.json digest mismatch/u);
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  });
  await t.test("SHA256SUMS.txt", async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "inshell-path-release-"));
    const copiedRelease = path.join(temporaryRoot, "v0.5.0");
    await fs.cp(pathReleaseDirectory, copiedRelease, { recursive: true });
    await fs.appendFile(
      path.join(copiedRelease, "SHA256SUMS.txt"),
      `${"a".repeat(64)}  manifest.json\n`,
    );
    await assert.rejects(verifyRelease(copiedRelease), /SHA256SUMS\.txt digest mismatch/u);
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  });
  const line = `${"a".repeat(64)}  manifest.json`;
  assert.throws(
    () => parseSha256Sums(`${line}\n${line}\n`),
    /duplicate PATH SHA256SUMS path/u,
  );
});

test("required build and deploy jobs execute the full upstream gates", async () => {
  const readWorkflow = async (fileName) => {
    const source = await fs.readFile(path.join(root, ".github/workflows", fileName), "utf8");
    const workflow = yaml.load(source);
    assert.ok(workflow && typeof workflow === "object", `${fileName} must parse as YAML`);
    return workflow;
  };
  const stepsFor = (workflow, jobName) => {
    const steps = workflow.jobs?.[jobName]?.steps;
    assert.ok(Array.isArray(steps), `${jobName} must define executable steps`);
    return steps;
  };
  const runCommands = (workflow, jobName) => {
    return stepsFor(workflow, jobName)
      .flatMap((step) => typeof step?.run === "string" ? [step.run.trim()] : []);
  };
  const assertRuntimeGates = (workflow, jobName, homeTestCommand) => {
    const steps = stepsFor(workflow, jobName);
    const commands = runCommands(workflow, jobName);
    const foundry = steps.find((step) => step?.name === "Install Foundry");
    assert.equal(
      foundry?.uses,
      "foundry-rs/foundry-toolchain@908c540300062bd5a7e473851cdb4282204cee09",
      `${jobName} must pin the reviewed Foundry action commit`,
    );
    assert.equal(foundry?.with?.version, "v1.5.1", `${jobName} must pin Foundry v1.5.1`);
    assert.ok(commands.includes("anvil --version"), `${jobName} must verify Anvil`);
    assert.ok(commands.includes(homeTestCommand), `${jobName} must run full Home test discovery`);
    assert.ok(
      commands.includes("pnpm run test:thought-runtime"),
      `${jobName} must run THOUGHT runtime and Anvil persistence tests`,
    );
  };
  const assertFullGates = (workflow, jobName) => {
    const commands = runCommands(workflow, jobName);
    assert.ok(
      commands.includes("pnpm run check:upstream-releases"),
      `${jobName} must execute the full upstream freshness gate`,
    );
    assert.ok(
      commands.includes("pnpm run check:path-contract-release"),
      `${jobName} must execute the PATH release verifier`,
    );
    assert.doesNotMatch(commands.join("\n"), /check:upstream-releases\s+--only/u);
  };

  const testWorkflow = await readWorkflow("test.yml");
  const deployWorkflow = await readWorkflow("deploy-pages.yml");
  assertFullGates(testWorkflow, "build");
  assertFullGates(deployWorkflow, "deploy-home");
  assertFullGates(deployWorkflow, "deploy-thought");
  assertRuntimeGates(testWorkflow, "build", "pnpm run test:presepolia");
  assertRuntimeGates(deployWorkflow, "deploy-home", "pnpm run test:presepolia");
  assertRuntimeGates(deployWorkflow, "deploy-thought", "pnpm run test:unit");

  assert.ok(
    runCommands(testWorkflow, "build").includes("pnpm run test:presepolia"),
    "the required build job must retain the independent pre-Sepolia test suite",
  );
  const packageJson = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const homePackageJson = JSON.parse(
    await fs.readFile(path.join(root, "apps/home/package.json"), "utf8"),
  );
  assert.equal(homePackageJson.scripts?.["test:presepolia"], "pnpm run test:unit");
  assert.equal(homePackageJson.scripts?.["test:unit"], "jest --runInBand");
  assert.match(
    packageJson.scripts?.["test:presepolia"] ?? "",
    /pnpm run test:upstream-release-check/u,
    "the independent pre-Sepolia suite must retain the workflow gate regression",
  );
});

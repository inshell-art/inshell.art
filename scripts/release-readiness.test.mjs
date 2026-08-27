import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { load } from "js-yaml";
import { checkReleaseEvidence, EVIDENCE_PATH, validateReleaseEvidence } from "./check-release-evidence.mjs";
import { dependencySecurityErrors } from "./check-dependency-security.mjs";

const commit = "a".repeat(40);
const hash = `sha256:${"b".repeat(64)}`;
// Synthetic metadata ONLY for validator tests. Never release evidence.
function evidence() {
  return {
    schema: "inshell.thought.release-evidence.v1", candidateCommit: commit,
    reviewedBy: "test-reviewer", reviewedAt: "2026-08-26T01:00:00.000Z",
    cells: ["mac-a", "mac-b"].flatMap((machine) => ["codex", "claude"].map((agent) => ({
      machine, agent, testedCommit: commit, mode: "real-canary", execution: "desktop-deep-link",
      surface: agent === "claude" ? "code" : "codex", state: "returned", runId: `tar_${machine}_${agent}`,
      taskSha256: hash, receiptSha256: `sha256:${(machine === "mac-a" ? (agent === "codex" ? "1" : "2") : (agent === "codex" ? "3" : "4")).repeat(64)}`, agentLineSha256: hash,
      osVersion: "macOS test", appVersion: "test-version", browserVersion: "Chrome test",
      model: agent === "codex" ? "gpt-5.6" : "claude-opus-5",
      launchObserved: true, previewObserved: true, completedAt: "2026-08-26T00:00:00.000Z",
      origin: "https://preview.inshell.art",
    }))),
  };
}

test("four reviewed cells pass validation; an unqualified template never does", () => {
  assert.deepEqual(validateReleaseEvidence(evidence()), []);
  assert.ok(validateReleaseEvidence({ schema: "inshell.thought.release-evidence.v1", cells: [] }).length);
});

for (const [name, mutate] of Object.entries({
  "missing cell": (e) => e.cells.pop(),
  "duplicate cell": (e) => { e.cells[3] = e.cells[0]; },
  "reused run": (e) => { e.cells[1].runId = e.cells[0].runId; },
  "reused receipt": (e) => { e.cells[1].receiptSha256 = e.cells[0].receiptSha256; },
  "wrong candidate": (e) => { e.cells[0].testedCommit = "c".repeat(40); },
  "simulated run": (e) => { e.cells[0].mode = "deterministic"; },
  "timeout": (e) => { e.cells[0].state = "timeout"; },
  "missing receipt": (e) => { e.cells[0].receiptSha256 = null; },
  "fixture model": (e) => { e.cells[0].model = "gpt-5-lab"; },
  "unknown app version": (e) => { e.cells[0].appVersion = "unknown"; },
  "Cowork": (e) => { e.cells[1].surface = "cowork"; },
  "CLI without browser evidence": (e) => { e.cells[0].execution = "cli"; e.cells[0].launchObserved = false; },
  "no visible artwork": (e) => { e.cells[0].previewObserved = false; },
  "localhost only": (e) => { e.cells[0].origin = "http://127.0.0.1:5177"; },
  "credential URL": (e) => { e.cells[0].origin = "https://example:example@preview.inshell.art"; },
  "session field": (e) => { e.cells[0].browserToken = "fixture"; },
  "no review": (e) => { e.reviewedBy = null; },
  "review before completion": (e) => { e.reviewedAt = "2026-08-25T00:00:00Z"; },
  "future completion": (e) => { e.cells[0].completedAt = "2999-01-01T00:00:00Z"; },
  "malformed cell": (e) => { e.cells[0] = null; },
})) {
  test(`release gate rejects ${name}`, () => {
    const value = evidence(); mutate(value);
    assert.ok(validateReleaseEvidence(value).length > 0);
  });
}

test("CLI protocol evidence remains valid with separately recorded launch/preview observations", () => {
  const value = evidence(); value.cells[0].execution = "cli";
  assert.deepEqual(validateReleaseEvidence(value), []);
});

test("git gate permits evidence-only commits and content-identical promotions, rejects drift and missing history", () => {
  const root = mkdtempSync(join(tmpdir(), "inshell-release-gate-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid");
    git("config", "commit.gpgsign", "false");
    writeFileSync(join(root, "app.txt"), "candidate"); git("add", "app.txt"); git("commit", "-m", "candidate");
    const candidate = git("rev-parse", "HEAD");
    const value = evidence(); value.candidateCommit = candidate;
    value.cells.forEach((cell) => { cell.testedCommit = candidate; });
    mkdirSync(join(root, "release-evidence"));
    const save = () => writeFileSync(join(root, EVIDENCE_PATH), JSON.stringify(value));
    save(); git("add", EVIDENCE_PATH); git("commit", "-m", "evidence only");
    assert.deepEqual(checkReleaseEvidence(root), []);
    writeFileSync(join(root, "app.txt"), "drift");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    git("add", "app.txt"); git("commit", "-m", "source drift");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    writeFileSync(join(root, "app.txt"), "candidate"); git("add", "app.txt"); git("commit", "-m", "restore source");
    writeFileSync(join(root, "new-code.txt"), "untracked");
    assert.match(checkReleaseEvidence(root).join(), /differs/);
    rmSync(join(root, "new-code.txt"));
    git("checkout", "--orphan", "squash-promotion"); git("commit", "-m", "same tested source, different ancestry");
    assert.deepEqual(checkReleaseEvidence(root), []);
    value.candidateCommit = commit; value.cells.forEach((cell) => { cell.testedCommit = commit; }); save();
    assert.match(checkReleaseEvidence(root).join(), /unavailable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const lock = (keys) => ({ lockfileVersion: "9.0", packages: Object.fromEntries(keys.map((k) => [k, {}])), snapshots: {} });
test("dependency floors accept current resolved lock, not merely root overrides", () => {
  const actual = load(readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"));
  assert.deepEqual(dependencySecurityErrors(actual), []);
  assert.deepEqual(dependencySecurityErrors(lock(["nanoid@3.3.18", "nanoid@5.1.6", "postcss@8.5.23", "js-yaml@4.3.1"])), []);
});
for (const version of ["nanoid@3.3.16", "nanoid@5.1.5", "nanoid@4.0.0", "postcss@8.5.22", "js-yaml@4.3.0", "extract-zip@2.0.1", "nanoid@3.3.18-rc.1"]) {
  test(`dependency guard rejects ${version}, including transitive snapshots`, () => {
    assert.equal(dependencySecurityErrors(lock([version])).length, 1);
    const value = lock(["postcss@8.5.23"]); value.snapshots[version] = {};
    assert.equal(dependencySecurityErrors(value).length, 1);
  });
}
test("dependency guard fails closed for an incomplete lock", () => {
  assert.ok(dependencySecurityErrors({}).length);
});

test("production CI and both publish jobs require release evidence; staging can collect it", () => {
  const ci = load(readFileSync(new URL("../.github/workflows/test.yml", import.meta.url), "utf8"));
  const step = ci.jobs.build.steps.find((s) => s.run === "pnpm run check:release-evidence");
  assert.ok(step); assert.match(step.if, /main/); assert.match(step.if, /base\.ref/);
  const deploy = load(readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"));
  for (const name of ["deploy-home", "deploy-thought"]) {
    const steps = deploy.jobs[name].steps;
    const gate = steps.findIndex((s) => s.run === "pnpm run check:release-evidence");
    assert.ok(gate >= 0);
    assert.equal(steps[gate].if, "${{ github.event.inputs.branch == 'main' }}");
    assert.equal(steps.find((s) => s.uses?.startsWith("actions/checkout@")).with["fetch-depth"], 0);
    assert.ok(gate < steps.findIndex((s) => /wrangler@[^ ]+ pages deploy/.test(s.run ?? "")));
  }
});

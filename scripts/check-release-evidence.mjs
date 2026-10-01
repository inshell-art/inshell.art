#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const EVIDENCE_PATH = "release-evidence/thought-canaries.json";
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const requiredCells = ["mac-a/codex", "mac-a/claude"];
const allowedCells = [...requiredCells, "mac-b/codex", "mac-b/claude"];
const text = (value) => typeof value === "string" && value.trim().length > 0;
const date = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const cellFields = new Set(["machine", "agent", "testedCommit", "mode", "execution", "surface", "state", "runId", "taskSha256", "receiptSha256", "agentLineSha256", "osVersion", "appVersion", "browserVersion", "metadataSource", "model", "launchObserved", "previewObserved", "completedAt", "origin"]);
const observations = ["returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved"];
const plainHashes = ["briefSha256", "acknowledgementSha256", "recordSha256", "promptLineSha256", "agentLineSha256", "savedRecordSha256", "loadedRecordSha256"];
const transports = ["plain-http"];

// One operator-reviewed exception, not a class of reusable UI/path exceptions.
// Keep the original run/source intact. The complete binary diff is checked in
// Git below; changes outside these exact historical trees cannot inherit it.
export const CODEX57_CARRY_FORWARD = Object.freeze({
  id: "codex57-action-row-20261001",
  baseCommit: "3968b7c09c689e090ac851173ab351358f4692c2",
  candidateCommit: "cb4c287a0c841dd222e13a37e7018dac44a58fab",
  diffSha256: "sha256:cf7157242ba901601bb3714417c8e4949480145877ed34c00973f1cb13324508",
});
const codex57Run = "plain_8f798ee8-9a50-442a-8032-cdec312e21b6";
// Direct operator approval in Applications, 2026-10-01. This admits ONLY the
// two reviewed historical runs plus separately checked candidate UI. It does
// not assert their browser version, Claude's initiating build, or a model.
export const COMPOSITE57 = Object.freeze({
  id: "codex57-claude57-composite-20261001",
  candidateCommit: CODEX57_CARRY_FORWARD.candidateCommit,
  finalUiCommit: CODEX57_CARRY_FORWARD.candidateCommit,
  finalUiHtmlSha256: "sha256:58430d41faa46ff808a35b8f87181cce19463d674cc9379a8f1c463ef26a7abe",
  claudeNormalizedHandoffSha256: "sha256:5848a22deed0e4854493144f8615525cb08310223cf6d8408bec5d3636536040",
  modelSourceSha256: "sha256:1685fbadbf4c317ccdfbfd749bb6372c91ace20a5eabb7ee04839d644882bd12",
  handlerSourceSha256: "sha256:5eb4844e1d630c5e0360f1eaf1036cc5966ccc652cee79344ac85fc66172399d",
});
export const COMPOSITE57_RUNS = Object.freeze({
  codex: Object.freeze({
    runId: codex57Run, testedCommit: CODEX57_CARRY_FORWARD.baseCommit,
    appVersion: "Codex Desktop runtime 0.159.2", acceptedAt: "2026-10-01T09:53:54.192Z",
    acknowledgementSha256: "sha256:8a9d92920f15d89ac2dbe4c47ffed328886f6b0beb3bf42274355d923440aa0c",
    briefSha256: "sha256:01febe1fb00e4b85e060443cd739ffc2074c3d48981902d5d9ac9fba95bc1fc5",
    recordSha256: "sha256:f961b0643e039bdcad4211ae2748f53967d60104d92bc8b20044edb4c7daeb2c",
    promptLineSha256: "sha256:5eb6fad0b1ac43d875c9cc0c456cb47b7bd5b09145b4ecd1cd11ada7fbc67020",
    agentLineSha256: "sha256:42e1c158bf9a6b13c5f70c7a99f9b9ec07257850e6f52172cbc13c5a6af497bd",
  }),
  claude: Object.freeze({
    runId: "plain_5db719cc-e68f-484f-9753-dd4f2c74a115", testedCommit: null,
    appVersion: "Claude Code 2.1.285", acceptedAt: "2026-10-01T10:34:51.728Z",
    acknowledgementSha256: "sha256:d659bf8da1559afd96790ab59b98ff244d777822a429e41ff1dba8f1e8b80886",
    briefSha256: "sha256:5547adb406008ed61892324169e0e877f0df3ff689c5ad029a127b7b5f64786d",
    recordSha256: "sha256:e6c686729e2bcb086151227190a5a7c478016debf5cb9a65f7613d62a7d40ce8",
    promptLineSha256: "sha256:6e55732b2b87bd4beef8ccec632163a42d26d5af3ceeb4c4fc447417108acd7c",
    agentLineSha256: "sha256:cfb227b12c2646570adb53b862cab0d6e4b59250dbb286f6828b0cca8dd9f7e1",
  }),
});
// These internal correction files ALSO need exact reviewed byte digests. A
// matching path alone never permits a difference, including in this checker.
export const QUALIFICATION_FILES = Object.freeze([
  ".github/workflows/deploy-pages.yml",
  ".github/workflows/test.yml",
  "scripts/smoke-cloudflare-api-routes.mjs",
  "scripts/check-release-evidence.mjs",
  "scripts/release-readiness.test.mjs",
  "apps/home/public/docs/agent-index.json",
  "apps/home/public/docs/source-lock.json",
  "release-evidence/history/thought-canaries-20260924.json",
  "release-evidence/plain-20261001-observations.json",
]);
const hashBytes = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
function exactCarryForward(evidence) {
  const approval = evidence.carryForward;
  return evidence.schema === "inshell.thought.release-evidence.v2" &&
    evidence.candidateCommit === CODEX57_CARRY_FORWARD.candidateCommit &&
    approval && Object.keys(approval).sort().join() === [...Object.keys(CODEX57_CARRY_FORWARD), "qualificationFiles"].sort().join() &&
    Object.entries(CODEX57_CARRY_FORWARD).every(([key, value]) => approval[key] === value) &&
    approval.qualificationFiles && Object.keys(approval.qualificationFiles).sort().join() === [...QUALIFICATION_FILES].sort().join() &&
    QUALIFICATION_FILES.every(path => digest.test(approval.qualificationFiles[path] ?? ""));
}
function exactComposite(evidence) {
  const proof = evidence.composite;
  return exactCarryForward(evidence) && proof &&
    Object.keys(proof).sort().join() === Object.keys(COMPOSITE57).sort().join() &&
    Object.entries(COMPOSITE57).every(([key, value]) => proof[key] === value);
}
function exactCompositeCell(evidence, cell) {
  const expected = COMPOSITE57_RUNS[cell.agent];
  return exactComposite(evidence) && expected && cell.machine === "mac-a" &&
    cell.transport === "plain-http" && cell.browserVersion === "unknown" &&
    cell.osVersion === "macOS 26.7 (25G229)" &&
    Object.entries(expected).every(([key, value]) => cell[key] === value);
}

// This validates reviewed observations, not provider attestation or operator
// authorization to promote. Never manufacture observations from a fixture run.
export function validateReleaseEvidence(evidence, now = Date.now()) {
  const errors = [];
  if (!evidence || typeof evidence !== "object") return ["Release evidence is missing."];
  if (Object.keys(evidence).some((key) => !["schema", "candidateCommit", "reviewedBy", "reviewedAt", "cells", "carryForward", "composite"].includes(key))) errors.push("Unexpected evidence fields; do not include raw sessions or credentials.");
  if (Object.hasOwn(evidence, "composite") && !exactComposite(evidence)) errors.push("Composite qualification must bind the exact reviewed candidate, handoff and separate UI proof.");
  if (Object.hasOwn(evidence, "carryForward") && !exactCarryForward(evidence)) errors.push("Carry-forward must bind the exact reviewed Codex-57 base, candidate, diff and qualification bytes.");
  const v2 = evidence.schema === "inshell.thought.release-evidence.v2";
  if (!v2 && evidence.schema !== "inshell.thought.release-evidence.v1") errors.push("Unsupported evidence schema.");
  if (!sha.test(evidence.candidateCommit ?? "")) errors.push("Freeze and record the full candidate commit.");
  if (!text(evidence.reviewedBy) || !date(evidence.reviewedAt)) errors.push("Operator evidence review is missing.");
  if (Date.parse(evidence.reviewedAt) > now) errors.push("Evidence review cannot be in the future.");
  const cells = Array.isArray(evidence.cells) ? evidence.cells : [];
  if (cells.length < 2 || cells.length > 4) errors.push("Codex and Claude on the operator Mac are required; second-Mac coverage is optional.");
  const seen = new Set();
  const runs = new Set();
  const receipts = new Set();
  for (const cell of cells) {
    if (!cell || typeof cell !== "object") { errors.push("Malformed cell."); continue; }
    const plain = v2 && cell.transport === "plain-http";
    const fields = new Set(cellFields);
    if (v2) for (const field of ["transport", ...observations, "conflict"]) fields.add(field);
    if (plain) {
      fields.delete("taskSha256"); fields.delete("receiptSha256"); fields.delete("model");
      for (const field of [...plainHashes, "acceptedAt", "integrityChecked"]) fields.add(field);
    }
    if (Object.keys(cell).some((key) => !fields.has(key))) errors.push("Unexpected cell fields; retain only sanitized qualification metadata.");
    const machineAgent = `${cell.machine}/${cell.agent}`;
    const key = v2 ? `${cell.transport}/${machineAgent}` : machineAgent;
    if (!allowedCells.includes(machineAgent) || seen.has(key)) errors.push(`Unexpected or duplicate cell: ${key}.`);
    if (v2) {
      if (!transports.includes(cell.transport)) errors.push(`${key}: unsupported transport.`);
      for (const field of observations) if (cell[field] !== true) errors.push(`${key}: missing ${field}.`);
      if (cell.conflict !== false) errors.push(`${key}: conflicting or uninspected return.`);
    }
    seen.add(key);
    const carried = plain && exactCarryForward(evidence) && machineAgent === "mac-a/codex" &&
      cell.runId === codex57Run && cell.testedCommit === CODEX57_CARRY_FORWARD.baseCommit;
    const composite = plain && exactCompositeCell(evidence, cell);
    if (evidence.composite && requiredCells.includes(machineAgent) && !composite) errors.push(`${key}: preserve exact composite run evidence and explicit historical unknowns.`);
    if (cell.testedCommit !== evidence.candidateCommit && !carried && !composite) errors.push(`${key}: wrong candidate commit.`);
    if (evidence.carryForward && cell.runId === codex57Run && !carried) errors.push(`${key}: preserve Codex-57's original tested source.`);
    if (cell.mode !== "real-canary") errors.push(`${key}: simulated checks cannot qualify a release.`);
    if (!["desktop-deep-link", "cli"].includes(cell.execution)) errors.push(`${key}: record execution method.`);
    if (cell.agent === "claude" && cell.surface !== "code") errors.push(`${key}: Claude Code is required, not Cowork.`);
    if (cell.agent === "codex" && cell.surface !== "codex") errors.push(`${key}: Codex is required; ordinary ChatGPT does not qualify.`);
    if (cell.state !== "returned") errors.push(`${key}: no accepted return.`);
    if (!(plain ? /^plain_[a-zA-Z0-9-]{8,64}$/ : /^tar_[A-Za-z0-9_-]+$/).test(cell.runId ?? "") || runs.has(cell.runId)) errors.push(`${key}: missing or reused run ID.`);
    runs.add(cell.runId);
    const receipt = plain ? cell.acknowledgementSha256 : cell.receiptSha256;
    if (receipts.has(receipt)) errors.push(`${key}: reused receipt.`);
    receipts.add(receipt);
    for (const field of plain ? plainHashes : ["taskSha256", "receiptSha256", "agentLineSha256"]) {
      if (!digest.test(cell[field] ?? "")) errors.push(`${key}: invalid ${field}.`);
    }
    if (plain) {
      if (cell.integrityChecked !== true || cell.recordSha256 !== cell.savedRecordSha256 || cell.recordSha256 !== cell.loadedRecordSha256) errors.push(`${key}: accepted, saved and reloaded exact records must agree.`);
      if (!date(cell.acceptedAt) || Date.parse(cell.acceptedAt) > Date.parse(cell.completedAt)) errors.push(`${key}: invalid acceptance chronology.`);
      if (cell.metadataSource !== "unknown") errors.push(`${key}: plain records do not establish a model.`);
    }
    for (const field of ["osVersion", "appVersion", "browserVersion"]) {
      if (composite && field === "browserVersion") continue;
      if (!text(cell[field]) || /^(unknown|not-recorded|n\/a)$/i.test(cell[field]) || /fixture|simulated|\blab\b/i.test(cell[field])) errors.push(`${key}: record actual ${field}.`);
    }
    // Preserve the accepted run's provenance, never substitute a model-picker
    // setting. Unknown qualifies Studio Preview creation, not model attestation
    // or App-attested mint eligibility. Absence must be explicit, not inferred.
    if (cell.metadataSource === "unknown") {
      if (Object.hasOwn(cell, "model")) errors.push(`${key}: unknown metadata must omit model.`);
    } else if (cell.metadataSource === "reported") {
      if (!text(cell.model) || /^(unknown|not-recorded|n\/a)$/i.test(cell.model) || /fixture|simulated|\blab\b/i.test(cell.model)) errors.push(`${key}: record actual reported model.`);
    } else {
      errors.push(`${key}: record metadataSource as reported or unknown from the accepted run.`);
    }
    // CLI cells can qualify the handshake, but also need independently recorded
    // browser/OS launch evidence. A successful CLI cannot prove a deep link works.
    if (cell.launchObserved !== true || cell.previewObserved !== true) errors.push(`${key}: real desktop launch and browser preview observations are required.`);
    if (!date(cell.completedAt) || Date.parse(cell.completedAt) > now || Date.parse(cell.completedAt) > Date.parse(evidence.reviewedAt)) errors.push(`${key}: invalid completion/review chronology.`);
    try {
      const origin = new URL(cell.origin);
      if (origin.origin !== cell.origin || origin.protocol !== "https:" || origin.hostname !== "preview.inshell.art") throw new Error();
    } catch { errors.push(`${key}: production qualification must test https://preview.inshell.art.`); }
  }
  for (const key of v2 ? transports.flatMap(transport => requiredCells.map(cell => `${transport}/${cell}`)) : requiredCells) if (!seen.has(key)) errors.push(`Missing cell: ${key}.`);
  return errors;
}

export function checkReleaseEvidence(root) {
  const evidence = JSON.parse(readFileSync(resolve(root, EVIDENCE_PATH), "utf8"));
  const errors = validateReleaseEvidence(evidence);
  // Keep v1 readable as historical evidence. It cannot qualify the new default
  // or the retired creation API. Existing-run compatibility is regression-tested.
  if (evidence.schema !== "inshell.thought.release-evidence.v2") errors.push("This candidate requires v2 qualification for plain-http; historical evidence is not current qualification.");
  if (errors.length) return errors;
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("cat-file", "-e", `${evidence.candidateCommit}^{commit}`);
    const approval = evidence.carryForward;
    if (approval) {
      const diff = execFileSync("git", ["diff", "--no-ext-diff", "--no-textconv", "--binary", "--full-index", approval.baseCommit, approval.candidateCommit], { cwd: root });
      if (hashBytes(diff) !== approval.diffSha256) errors.push("Reviewed UI difference does not match its exact digest.");
      for (const path of QUALIFICATION_FILES) {
        if (hashBytes(readFileSync(resolve(root, path))) !== approval.qualificationFiles[path]) errors.push(`Qualification bytes differ from review: ${path}.`);
      }
    }
    // Evidence may be committed after the tested source SHA, without creating a
    // self-referential hash. Every other file must match the tested candidate.
    const exclusions = [EVIDENCE_PATH, ...(approval ? QUALIFICATION_FILES : [])].map(path => `:(exclude)${path}`);
    const changes = git("diff", "--name-only", evidence.candidateCommit, "--", ".", ...exclusions);
    const untracked = git("ls-files", "--others", "--exclude-standard", "--", ".", ...exclusions);
    if (changes || untracked) errors.push("Candidate differs from the tested source. Freeze the combined candidate and requalify; do not rewrite evidence to clear this gate.");
  } catch {
    errors.push("Candidate history or a reviewed qualification file is unavailable; verify the exact source and evidence files.");
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const errors = checkReleaseEvidence(resolve(fileURLToPath(new URL("..", import.meta.url))));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Release evidence: 2/2 required real-Agent cells on one operator Mac qualify this candidate, preserving original tested sources and any exact reviewed carry-forward; optional cells are also validated. OPS live checks and explicit operator promotion approval remain required.");
  } catch (error) {
    console.error(`Production qualification BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}

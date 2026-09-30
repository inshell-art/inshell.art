#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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

// This validates reviewed observations, not provider attestation or operator
// authorization to promote. Never manufacture observations from a fixture run.
export function validateReleaseEvidence(evidence, now = Date.now()) {
  const errors = [];
  if (!evidence || typeof evidence !== "object") return ["Release evidence is missing."];
  if (Object.keys(evidence).some((key) => !["schema", "candidateCommit", "reviewedBy", "reviewedAt", "cells"].includes(key))) errors.push("Unexpected evidence fields; do not include raw sessions or credentials.");
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
    if (cell.testedCommit !== evidence.candidateCommit) errors.push(`${key}: wrong candidate commit.`);
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
    // Evidence may be committed after the tested source SHA, without creating a
    // self-referential hash. Every other file must match the tested candidate.
    const changes = git("diff", "--name-only", evidence.candidateCommit, "--", ".", `:(exclude)${EVIDENCE_PATH}`);
    const untracked = git("ls-files", "--others", "--exclude-standard", "--", ".", `:(exclude)${EVIDENCE_PATH}`);
    if (changes || untracked) errors.push("Candidate differs from the tested source. Freeze the combined candidate and requalify; do not rewrite evidence to clear this gate.");
  } catch {
    errors.push("Candidate commit is unavailable; fetch full history and verify the tested source SHA.");
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const errors = checkReleaseEvidence(resolve(fileURLToPath(new URL("..", import.meta.url))));
    if (errors.length) throw new Error(errors.join("\n"));
    console.log("Release evidence: 2/2 required real-Agent cells on one operator Mac match this candidate; optional cells are also validated. OPS live checks and explicit operator promotion approval remain required.");
  } catch (error) {
    console.error(`Production qualification BLOCKED: ${error.message}`);
    process.exitCode = 1;
  }
}

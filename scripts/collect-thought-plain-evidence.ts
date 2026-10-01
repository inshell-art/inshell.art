import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { acknowledge, digest, validateWork, type PlainWork } from "../apps/thought/src/plain-return/model";
import type { WorkExport } from "../apps/thought/src/plain-return/client";

const observationFields = ["machine", "agent", "testedCommit", "mode", "execution", "surface", "osVersion", "appVersion", "browserVersion", "launchObserved", "previewObserved", "returnObserved", "reviewObserved", "saveObserved", "reloadObserved", "loadObserved", "completedAt", "origin"];
const hash = (value: unknown) => `sha256:${digest(JSON.stringify(value)).slice(2)}`;

// Local, offline sanitization only. The operator must supply actual observations,
// the actual HTTP acknowledgement and accepted/saved/reloaded browser records.
// This never drives an Agent, reads browser credentials or blesses a candidate.
export function collectPlainEvidence(input: {
  work: PlainWork; acknowledgement: unknown; savedWork: PlainWork; loadedWork: PlainWork;
  conflict: boolean; observations: Record<string, unknown>;
}) {
  if (Object.keys(input).some(key => !["work", "acknowledgement", "savedWork", "loadedWork", "conflict", "observations"].includes(key))) throw Error("Unexpected private input fields");
  if (input.conflict !== false) throw Error("Missing/conflicting return observation");
  const work = validateWork(input.work);
  const ack = acknowledge(work);
  if (!isDeepStrictEqual(input.acknowledgement, ack)) throw Error("Actual acknowledgement does not match the accepted record");
  for (const record of [input.savedWork, input.loadedWork]) {
    if (!isDeepStrictEqual(validateWork(record), work)) throw Error("Accepted, saved and loaded records differ");
  }
  const observed = input.observations;
  if (!observed || Object.keys(observed).some(key => !observationFields.includes(key)) || observationFields.some(key => !Object.hasOwn(observed, key))) throw Error("Supply only the complete sanitized observation fields");
  for (const field of observationFields.filter(key => key.endsWith("Observed"))) {
    if (observed[field] !== true) throw Error(`Missing ${field}`);
  }
  return { ...observed, transport: "plain-http", state: "returned", runId: work.runId,
    metadataSource: "unknown", conflict: false, integrityChecked: true, acceptedAt: work.acceptedAt,
    briefSha256: `sha256:${work.briefSha256.slice(2)}`, acknowledgementSha256: hash(ack),
    recordSha256: hash(work), promptLineSha256: `sha256:${digest(work.promptLine).slice(2)}`,
    agentLineSha256: `sha256:${work.responseSha256.slice(2)}`,
    savedRecordSha256: hash(input.savedWork), loadedRecordSha256: hash(input.loadedWork) };
}

// Consume the three explicit UI downloads directly, not a hand-assembled
// browser-storage dump. HTTP acknowledgement still comes from the real sender's
// response body. Neither exports nor hashes attest the native host or reload.
export function collectPlainExports(accepted: WorkExport, saved: WorkExport, loaded: WorkExport, acknowledgement: unknown, observations: Record<string, unknown>) {
  for (const [record, stage] of [[accepted, "accepted"], [saved, "saved"], [loaded, "loaded"]] as const) {
    if (!record || record.schema !== "inshell.thought.plain-work-export.v1" || record.stage !== stage ||
      Object.keys(record).sort().join() !== ["schema", "stage", "work", "conflict", "reviewed"].sort().join() ||
      record.conflict !== false || typeof record.reviewed !== "boolean" || (stage !== "accepted" && !record.reviewed)) throw Error("Missing exact UI export stage");
  }
  return collectPlainEvidence({ work: accepted.work, savedWork: saved.work, loadedWork: loaded.work,
    acknowledgement, observations, conflict: false });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
    const args = process.argv.slice(2);
    const result = args.length === 6 && args[0] === "--exports"
      ? collectPlainExports(read(args[1]), read(args[2]), read(args[3]), read(args[4]), read(args[5]))
      : args.length === 1 ? collectPlainEvidence(read(args[0])) : null;
    if (!result) throw Error("Supply --exports accepted.json saved.json loaded.json acknowledgement.json observations.json");
    console.log(JSON.stringify(result, null, 2));
  } catch {
    // Never echo private artistic bytes, bearer values or an input parse error.
    console.error("Evidence collection failed: check exact records, acknowledgement and complete observations. No qualification was issued.");
    process.exitCode = 1;
  }
}

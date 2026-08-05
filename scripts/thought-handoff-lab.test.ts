import assert from "node:assert/strict";
import test from "node:test";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  buildCodexDeepLink,
  thoughtCodexCanonicalCandidate,
} from "./lib/thought-handoff-lab";

test("the Codex handoff matrix has stable unique case IDs", () => {
  const ids = THOUGHT_CODEX_HANDOFF_CASES.map((entry) => entry.id);
  assert.deepEqual(ids, [
    "happy-path",
    "maximum-output",
    "quoted-transport",
    "malformed-claim",
    "runtime-capability-unavailable",
    "malformed-ready",
    "runtime-metadata-unavailable",
    "malformed-creative-release",
    "result-rejected",
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test("the candidate handoff runs control first and continues automatically", () => {
  const task = thoughtCodexCanonicalCandidate();
  const controlIndex = task.indexOf("Operation 1 — Claim control:");
  const creativeIndex = task.indexOf("Operation 3 — Open one creative turn:");
  assert.ok(controlIndex >= 0);
  assert.ok(creativeIndex > controlIndex);
  assert.match(
    task,
    /If verification passes, continue immediately and create exactly one answer in this same turn\./,
  );
  assert.match(task, /do not stop or ask the creator to continue\./);
  assert.doesNotMatch(task, /reply CREATE/i);
  assert.doesNotMatch(task, /exact CREATE/i);
});

test("the candidate handoff keeps creative input sealed and forbids setup work", () => {
  const task = thoughtCodexCanonicalCandidate();
  assert.match(task, /The creative prompt is absent until \/start succeeds\./);
  assert.match(task, /Never ask the creator to install, configure, or learn anything\./);
  assert.match(task, /Before any turn exchanges data with the App—including every RETRY turn—request only the narrow network permission/);
  assert.match(task, /loopback connection refusal without active permission is not evidence that the App stopped/);
  assert.match(task, /On an exact RETRY, first request the same narrow App network permission for the new turn/);
  assert.match(task, /RETRY never opens the creative prompt\./);
  assert.doesNotMatch(task, /\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//);
  assert.doesNotMatch(task, /\{"/);
  assert.match(task, /<run_id> = tar_handoff_candidate/);
  assert.match(task, /<app_endpoint> = https:\/\/handoff-lab\.invalid\/runs\/<run_id>/);
  assert.match(task, /POST <app_endpoint>\/claim/);
  assert.match(task, /PUT <app_endpoint>\/result/);
  assert.match(task, /bridge\.bridgeId = inshell-thought-agent-direct/);
  assert.match(task, /bridge\.bridgeVersion = 0\.0\.3\+direct/);
  assert.match(task, /adapter\.adapterId = codex/);
  assert.match(task, /control\.schema = <control_schema>/);
  assert.match(task, /output\.agentLineSha256 = hash of output\.agentLine/);
  assert.doesNotMatch(task, /bridge = id /);
  assert.equal(task.split("tar_handoff_candidate").length - 1, 1);
  assert.ok(Buffer.byteLength(task) <= 8_000);
  assert.doesNotMatch(task, /Can a verified path remain simple\?/);
});

test("the Codex deep link round-trips the sealed handoff", () => {
  const task = thoughtCodexCanonicalCandidate();
  const link = buildCodexDeepLink(task, "http://127.0.0.1:5177/thought/");
  const parsed = new URL(link);
  assert.equal(parsed.protocol, "codex:");
  assert.equal(parsed.searchParams.get("prompt"), task);
  assert.equal(
    parsed.searchParams.get("originUrl"),
    "http://127.0.0.1:5177/thought/",
  );
});

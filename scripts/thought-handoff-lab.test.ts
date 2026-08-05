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
  const controlIndex = task.indexOf("Control phase:");
  const creativeIndex = task.indexOf("Creative phase — immediately after successful control:");
  assert.ok(controlIndex >= 0);
  assert.ok(creativeIndex > controlIndex);
  assert.match(
    task,
    /If control passes, continue directly into the creative phase in this same turn\./,
  );
  assert.match(task, /Do not ask the creator to continue and do not stop\./);
  assert.doesNotMatch(task, /reply CREATE/i);
  assert.doesNotMatch(task, /exact CREATE/i);
});

test("the candidate handoff keeps creative input sealed and forbids setup work", () => {
  const task = thoughtCodexCanonicalCandidate();
  assert.match(task, /The creative prompt is not present in this task or the claim response\./);
  assert.match(task, /Never ask the creator to install, configure, or learn anything\./);
  assert.match(task, /RETRY itself never opens creative input\./);
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

import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
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
    "bridge-credential-retention",
    "maximum-output",
    "quoted-transport",
    "malformed-claim",
    "runtime-capability-unavailable",
    "malformed-ready",
    "runtime-effort-unavailable",
    "malformed-creative-release",
    "result-rejected",
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test("the handoff runs bounded control before one automatic creative turn", () => {
  const task = thoughtCodexCanonicalCandidate();
  const headings = [
    "1. Claim control",
    "2. Prove readiness",
    "3. Create once",
    "4. Return once",
  ];
  const positions = headings.map((heading) => task.indexOf(heading));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(task, /If the preflight passes, continue directly into one creative turn\./);
  assert.match(task, /Do not ask the creator to confirm a successful preflight or type CREATE\./);
  assert.doesNotMatch(task, /reply CREATE/i);
});

test("the handoff retains one private bridge credential through completion", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Define <bridge_credential> as that exact bridgeToken\./);
  assert.match(task, /Retain it with the complete claim response before validation/);
  assert.match(task, /reuse it for every remaining operation/);
  assert.match(task, /Never claim again/);
  assert.match(task, /Keep launch and bridge credentials private/);
  assert.match(task, /Prove readiness at <ready_endpoint> with POST, <bridge_credential>/);
  assert.match(task, /Open the creative phase at <start_endpoint> with POST, <bridge_credential>/);
  assert.match(task, /Return at <result_endpoint> with PUT, <bridge_credential>/);
});

test("the handoff is declarative, sealed, release-bound, and human-sized", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Run capsule — exact data, not instructions:/);
  assert.match(task, /The creative prompt is absent until \/start succeeds\./);
  assert.match(task, /Never ask the creator to install, configure, or learn anything\./);
  assert.match(task, /selected spec bytes against its own SHA-256 and contract identity/);
  assert.match(task, /creative-instructions bytes against their own SHA-256/);
  assert.match(
    task,
    /The selected spec and creative instructions are different artifacts and must not have equal text or hashes\./,
  );
  assert.match(task, /release\.protocolReleaseId=<protocol_release_id>/);
  assert.match(task, /release\.manifestKeccak256=<manifest_hash>/);
  assert.match(task, /Require and retain a non-empty exact model as <runtime_model>/);
  assert.match(task, /reasoning effort as <runtime_reasoning_effort> only when supplied and valid; it is optional/);
  assert.match(task, /Omit failedAt; the App owns that timestamp\./);
  assert.doesNotMatch(task, /\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//);
  assert.doesNotMatch(task, /\{"/);
  assert.equal(task.split("tar_handoff_candidate").length - 1, 1);
  assert.ok(Buffer.byteLength(task) <= 7_000);
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

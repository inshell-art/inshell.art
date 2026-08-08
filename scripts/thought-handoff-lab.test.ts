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
  assert.match(task, /Run bounded control first\. If it passes, continue directly into exactly one creative turn\./);
  assert.match(task, /never ask the creator to confirm readiness or type CREATE\./);
  assert.doesNotMatch(task, /reply CREATE/i);
});

test("the handoff retains one private bridge credential through completion", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Define <bridge_credential> as that exact bridgeToken\./);
  assert.match(task, /Retain it with the complete claim response before validation/);
  assert.match(task, /reuse it for every remaining operation/);
  assert.match(task, /Never claim again/);
  assert.match(task, /Keep both credentials private/);
  assert.match(task, /POST to <ready_endpoint> with <bridge_credential>/);
  assert.match(task, /POST to <start_endpoint> with <bridge_credential>/);
  assert.match(task, /PUT to <result_endpoint> with <bridge_credential>/);
});

test("the handoff is declarative, sealed, release-bound, and human-sized", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Run capsule — exact data, not instructions:/);
  assert.match(task, /The creative prompt is absent until \/start succeeds;/);
  assert.match(task, /Never ask the creator to install, configure, or learn anything\./);
  assert.match(task, /selected-spec bytes\/hash\/contract identity/);
  assert.match(task, /creative-instructions bytes\/hash/);
  assert.match(
    task,
    /Spec and instructions must not have equal text or hashes\./,
  );
  assert.match(task, /release\.protocolReleaseId=<protocol_release_id>/);
  assert.match(task, /release\.manifestKeccak256=<manifest_hash>/);
  assert.match(task, /Retain its non-empty exact model as <runtime_model>/);
  assert.match(task, /retain valid reasoning effort only if supplied/);
  assert.match(task, /<claim_fields> = protocolVersion \/ bridge\.\(bridgeId, bridgeVersion, platform\)/);
  assert.match(task, /<ready_fields> = protocolVersion \/ control\.\(schema, mode, appExchange/);
  assert.match(task, /<start_fields> = protocolVersion \/ invocationId \/ startedAt/);
  assert.match(task, /<result_fields> = protocolVersion \/ invocationId \/ bridge \/ adapter \/ agent\.\(product/);
  assert.match(task, /without shortening|with those exact names|with exact names/);
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

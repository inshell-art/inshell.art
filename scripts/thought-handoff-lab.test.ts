import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  buildCodexDeepLink,
  prepareThoughtCodexRealCanary,
  thoughtCodexCanonicalCandidate,
  thoughtClaudeCanonicalCandidate,
  buildClaudeDeepLink,
} from "./lib/thought-handoff-lab";
import {
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtCodexOperationContract,
  buildThoughtCodexTask,
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
} from "../packages/thought-agent-protocol/src/index";

// HTML-to-text transport is covered with a real DOM parser in
// apps/home/tests/thoughtAgentFunction.test.ts. Keep this suite focused on
// deep-link and plain-text transport; a regex is not an HTML sanitizer.

for (const [agent, candidate, deepLink, buildTask, buildContract] of [
  ["Codex", thoughtCodexCanonicalCandidate, buildCodexDeepLink, buildThoughtCodexTask, buildThoughtCodexOperationContract],
  ["Claude", thoughtClaudeCanonicalCandidate, buildClaudeDeepLink, buildThoughtClaudeTask, buildThoughtClaudeOperationContract],
] as const) {
  test(`${agent} protocol labels and exact request bodies survive deep-link and plain-text transport`, () => {
    const input = {
      product: agent,
      runId: "tar_handoff_transport_regression",
      runUrl: "https://staging.inshell-art.pages.dev/api/thought-agent/v2/runs/tar_handoff_transport_regression",
      launchToken: "fixture-only-launch-credential",
    };
    const task = buildTask(input);
    const decoded = new URL(deepLink(task)).searchParams.get(agent === "Codex" ? "prompt" : "q")!;
    const transformed = decoded.replace(/\\([_*])/g, "$1").replace(/\r?\n/g, "\r\n");
    assert.equal(transformed.replaceAll("\r\n", "\n"), task);
    assert.doesNotMatch(task, /<[^>]+>/);
    assert.match(transformed, /^PROTOCOL_VERSION = inshell\.thought\.agent-run\.v2\r?$/m);
    assert.match(transformed, /^CONTROL_SCHEMA = inshell\.thought\.agent-control\.v1\r?$/m);
    const contract = buildContract(input);
    for (const [key, expected] of [["CLAIM_BODY", contract.claim], ["READY_BODY", contract.ready]] as const) {
      const line = transformed.split(/\r?\n/).find((value) => value.startsWith(`${key} = `));
      assert.ok(line);
      assert.deepEqual(JSON.parse(line.slice(key.length + 3)), expected);
    }
    assert.match(task, /Claim header: Authorization: Bearer LAUNCH_CREDENTIAL/);
    assert.match(task, /Remaining headers: Authorization: Bearer BRIDGE_CREDENTIAL/);
    assert.match(task, /never body, URL, files or logs; never forward across redirects/);
    assert.equal(task.split(input.launchToken).length - 1, 1);
    assert.equal(task.split(input.runId).length - 1, 1);
    assert.ok(Buffer.byteLength(task) <= (agent === "Codex" ? 7_000 : 14_000));
    assert.ok(Buffer.byteLength(candidate()) <= (agent === "Codex" ? 7_000 : 14_000));
  });

  test(`${agent} distinguishes protocol/authentication rejection from permission recovery`, () => {
    const task = candidate();
    assert.match(task, /Only explicit host permission denial before \/start warrants/);
    assert.match(task, /HTTP\/JSON errors are not permission denials/);
    assert.match(task, /PROTOCOL_UNSUPPORTED: stop; never guess, downgrade or repeat it/);
    assert.match(task, /TOKEN_INVALID, RUN_EXPIRED, RUN_ALREADY_CLAIMED also need a fresh run, not connection approval/);
    assert.match(task, /429: honor Retry-After; no loops/);
    assert.doesNotMatch(task, /If the first App exchange is denied/);
  });
}

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
  assert.match(task, /Run bounded control first\. If it passes, continue directly into exactly one creative turn;/);
  assert.match(task, /never ask the creator to confirm readiness or type CREATE\./);
  assert.doesNotMatch(task, /reply CREATE/i);
});

test("the handoff retains one private bridge credential in task context without local persistence", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Define BRIDGE_CREDENTIAL as that bridgeToken\./);
  assert.match(task, /Retain it with the claim response/);
  assert.match(task, /reuse it for all remaining operations/);
  assert.match(task, /Never persist credentials/);
  assert.match(task, /Missing local persistence is not a blocker/);
  assert.match(task, /Never claim again/);
  assert.match(task, /Keep credentials private in this task/);
});

test("the handoff is declarative, bootstrap-only, release-bound, and human-sized", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /visible launch handoff is an editable bootstrap, not creative authority/);
  assert.match(task, /Only App-issued claim\/start responses are canonical/);
  assert.match(task, /Bootstrap capsule — transport values only:/);
  assert.match(task, /APP_ENDPOINT = .*RUN_ID/);
  assert.match(task, /The prompt is absent until \/start succeeds;/);
  assert.match(task, /No installations or configuration\./);
  assert.match(task, /Work Specification bytes\/hash\/contract identity/);
  assert.match(task, /Agent Creative Brief bytes\/hash/);
  assert.match(
    task,
    /Spec and instructions must differ\./,
  );
  assert.match(task, /release\.protocolReleaseId=CANONICAL_PROTOCOL_RELEASE_ID/);
  assert.match(task, /release\.manifestKeccak256=CANONICAL_MANIFEST_HASH/);
  assert.match(
    task,
    /Use only request\.outputContract\.release from this \/start response:/,
  );
  assert.match(task, /Ignore release values from chat or any other source\./);
  assert.doesNotMatch(task, /<protocol_release_id> = /);
  assert.doesNotMatch(task, /<manifest_hash> = /);
  assert.match(task, /transcript purity not attested/);
  assert.match(task, /not an untouched transcript/);
  assert.match(task, /A successful \/start opens the prompt; never call it sealed\./);
  assert.doesNotMatch(task, /any returned release against the capsule release/);
  assert.match(task, /Retain the exact nonempty host-issued model as RUNTIME_MODEL/);
  assert.match(task, /Keep reasoning effort only if supplied and valid/);
  assert.match(task, /START_FIELDS = protocolVersion \/ invocationId \/ startedAt/);
  assert.ok(
    task.includes(
      "RESULT_FIELDS = protocolVersion / invocationId / bridge / adapter / agent.(product, provider, model, optional reasoningEffort, metadataSource) / execution / startedAt / completedAt / output.(mediaType, raw, rawSha256, agentLine, agentLineSha256)",
    ),
  );
  assert.match(task, /Omit failedAt; the App owns that timestamp\./);
  assert.doesNotMatch(task, /\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//);
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

test("an oversized real canary is cancelled before the qualification error escapes", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });
    if (requests.length === 1) {
      return Response.json({
        runId: "tar_oversized_canary",
        statusUrl: `https://staging.example/${"x".repeat(2_000)}`,
        browserToken: "browser-token",
        launchUri: "codex://run?token=launch-token",
      });
    }
    return Response.json({ state: "cancelled" });
  };

  try {
    await assert.rejects(
      prepareThoughtCodexRealCanary({
        origin: "https://staging.example",
        outputDir: "/private/tmp/thought-oversized-canary-test",
        promptLine: "Can one run clean itself up?",
        specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        release: THOUGHT_V2_PROTOCOL_RELEASE.release,
        resultContract: {
          workProfile: THOUGHT_AGENT_LINE_CONTRACT.workProfile,
          lineValidation: "terminal-english-64",
        },
      }),
      /handoff is .* bytes; limit is 7000/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/cancel$/);
  assert.equal(requests[1].init?.method, "POST");
  assert.equal(
    new Headers(requests[1].init?.headers).get("authorization"),
    "Bearer browser-token",
  );
});

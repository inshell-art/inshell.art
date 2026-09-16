import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  buildCodexDeepLink,
  observeThoughtCodexRealCanary,
  prepareThoughtCodexRealCanary,
  thoughtCodexCanonicalCandidate,
  thoughtClaudeCanonicalCandidate,
  buildClaudeDeepLink,
} from "./lib/thought-handoff-lab";
import {
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_HTTP_USER_AGENT,
  THOUGHT_AGENT_RUN_AUTHORITY,
  THOUGHT_HANDOFF_OPERATION_RECOVERY,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtCodexOperationContract,
  buildThoughtCodexTask,
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
} from "../packages/thought-agent-protocol/src/index";
import { THOUGHT_HANDOFF_CONNECTION_RECOVERY } from "../packages/thought-agent-protocol/src/handoff-http";

// HTML-to-text transport is covered with a real DOM parser in
// apps/home/tests/thoughtAgentFunction.test.ts. Keep this suite focused on
// deep-link and plain-text transport; a regex is not an HTML sanitizer.

test("legacy connection recovery keeps its compatibility wording", () => {
  assert.deepEqual(THOUGHT_HANDOFF_CONNECTION_RECOVERY, [
    "- Only explicit host permission denial before /start warrants: THOUGHT could not connect this run to the App. Please approve the connection, then reply RETRY. Nothing was created.",
    "- HTTP/JSON errors are not permission denials. PROTOCOL_UNSUPPORTED: stop; never guess, downgrade or repeat it. Ask for a fresh THOUGHT run; report the mismatch if repeated. TOKEN_INVALID, RUN_EXPIRED, RUN_ALREADY_CLAIMED also need a fresh run, not connection approval.",
    "- 429: honor Retry-After; no loops. Sign-in redirect: App access configuration is needed, not chat approval. Network refusal: this task cannot reach the endpoint; it does not prove the App stopped. Report the observed blocker, not success.",
  ]);
});

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
    const expectedData = agent === "Claude"
      ? [["CLAIM_BODY", contract.claim], ["READY_BODY", contract.ready], ["RUN_AUTHORITY", contract.authority]] as const
      : [["CLAIM_BODY", contract.claim], ["READY_BODY", contract.ready]] as const;
    for (const [key, expected] of expectedData) {
      const line = transformed.split(/\r?\n/).find((value) => value.startsWith(`${key} = `));
      assert.ok(line);
      assert.deepEqual(JSON.parse(line.slice(key.length + 3)), expected);
    }
    if (agent === "Claude") {
      assert.deepEqual(contract.authority, THOUGHT_AGENT_RUN_AUTHORITY);
    }
    assert.match(task, /Claim header: Authorization: Bearer LAUNCH_CREDENTIAL/);
    assert.match(task, /Remaining headers: Authorization: Bearer BRIDGE_CREDENTIAL/);
    assert.equal(THOUGHT_AGENT_HTTP_USER_AGENT, "Inshell-THOUGHT-Agent/2");
    assert.ok(transformed.includes(`All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}. Identifies THOUGHT protocol;`));
    assert.match(task, /never impersonate a browser or model/);
    assert.match(task, /never body, URL, files or logs; never forward across redirects/);
    assert.equal(task.split(input.launchToken).length - 1, 1);
    assert.equal(task.split(input.runId).length - 1, 1);
    assert.ok(Buffer.byteLength(task) <= (agent === "Codex" ? 7_000 : 14_000));
    assert.ok(Buffer.byteLength(candidate()) <= (agent === "Codex" ? 7_000 : 14_000));
  });

  test(`${agent} keeps protocol/authentication recovery bounded`, () => {
    const task = candidate();
    for (const line of THOUGHT_HANDOFF_OPERATION_RECOVERY) {
      assert.equal(task.split(line).length - 1, 1, `${agent} must include shared recovery line`);
    }
    assert.match(task, /R=trusted App rejection proving no commit/);
    assert.match(task, /U=uncertain after dispatch \(gateway\/proxy\/malformed\/timeout; body alone proves nothing\)/);
    assert.match(task, /claim—stop\/reconcile in THOUGHT \(credential spent; token returned once; never reclaim\)/);
    assert.match(task, /ready—replay exact READY_BODY\+bridge once \(only ready replays control\)/);
    assert.match(task, /start—stop\/reconcile \(never restart\/generate; running cannot replay input\)/);
    assert.match(task, /result—replay frozen request once \(same invocation\/key\/raw\/hashes/);
    assert.match(task, /same invocation\/key\/raw\/hashes; no reserialize\/hash repair\/art change\/regeneration/);
    assert.match(task, /fail—stop\/reconcile \(never repeat; terminal cannot overwrite success\)/);
    assert.doesNotMatch(task, /RETRY repeats only the failed operation|After permission\/network recovery/);
    if (agent === "Codex") {
      assert.match(task, /Only explicit host permission denial before \/start warrants/);
    } else {
      assert.match(task, /Sign-in redirect or network refusal: report the observed response and stop/);
      assert.doesNotMatch(task, /permission denial|connection approval|host permission|chat approval/i);
    }
    assert.match(task, /With proven App provenance, PROTOCOL_UNSUPPORTED\/TOKEN_INVALID\/RUN_EXPIRED\/RUN_ALREADY_CLAIMED are R/);
    assert.match(task, /Retry 429 once only with usable Retry-After and proven no commit; else U/);
    assert.doesNotMatch(task, /If the first App exchange is denied/);
  });
}

test("Codex handoff fits real run and credential lengths on staging origins", () => {
  // The API emits 18 random bytes for run IDs and 32 for launch credentials,
  // encoded as unpadded base64url (24 and 43 characters respectively).
  const runId = `tar_${"x".repeat(24)}`;
  for (const origin of ["https://preview.inshell.art", "https://staging.inshell-art.pages.dev"]) {
    const task = buildThoughtCodexTask({
      product: "Codex",
      runId,
      runUrl: `${origin}/api/thought-agent/v2/runs/${runId}`,
      launchToken: "x".repeat(43),
    });
    assert.ok(Buffer.byteLength(task) <= 7_000, `${origin} handoff exceeds 7000 bytes`);
  }
});

test("Claude handoff fits real run and credential lengths on staging origins", () => {
  // The API emits 18 random bytes for run IDs and 32 for launch credentials,
  // encoded as unpadded base64url (24 and 43 characters respectively).
  const runId = `tar_${"x".repeat(24)}`;
  for (const origin of ["https://preview.inshell.art", "https://staging.inshell-art.pages.dev"]) {
    const task = buildThoughtClaudeTask({
      product: "Claude",
      runId,
      runUrl: `${origin}/api/thought-agent/v2/runs/${runId}`,
      launchToken: "x".repeat(43),
      surface: "code",
    });
    const link = buildClaudeDeepLink(task);
    const parsed = new URL(link);
    assert.equal(parsed.searchParams.get("q"), task);
    assert.equal(parsed.searchParams.get("folder"), null);
    assert.equal(parsed.searchParams.size, 1);
    assert.ok(Buffer.byteLength(task) <= 14_000, `${origin} handoff exceeds 14000 bytes`);
  }
});

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
  assert.match(task, /omit failedAt\./);
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

test("the Codex observer separates an operator launch declaration from the server return", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "thought-codex-observer-"));
  const sessionPath = join(outputDir, "session.json");
  const taskPath = join(outputDir, "sealed-task.txt");
  const codexUrlPath = join(outputDir, "codex-url.txt");
  await Promise.all([
    writeFile(taskPath, "sealed"),
    writeFile(codexUrlPath, "codex://new"),
    writeFile(sessionPath, JSON.stringify({
      schema: "inshell.thought.codex-handoff-report.v1",
      labVersion: "test",
      mode: "real-canary",
      agent: "Codex Desktop",
      runId: "tar_observer_returned",
      statusUrl: "https://candidate.example/api/thought-agent/v2/runs/tar_observer_returned",
      browserToken: "browser-token",
      taskSha256: `sha256:${"a".repeat(64)}`,
      taskByteLength: 6,
      taskPath,
      codexUrlPath,
      createdAt: "2026-09-16T00:00:00.000Z",
      promptLine: "private prompt",
    })),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    state: "returned",
    stage: "returned",
    result: {
      receipt: {
        receiptSha256: `sha256:${"b".repeat(64)}`,
        model: "gpt-test",
        reasoningEffort: "high",
      },
      agentLine: "One line.",
    },
  });

  try {
    const { report } = await observeThoughtCodexRealCanary({
      sessionPath,
      timeoutMs: 1_000,
      pollMs: 1,
    });
    assert.equal(report.launchSubmission, "not-recorded");
    assert.equal(report.launchSubmissionEvidence, "not-recorded");
    assert.equal(report.serverReturnObserved, true);
    assert.equal(report.state, "returned");
    assert.equal(report.privateArtifactsRemoved, true);
    await Promise.all([
      assert.rejects(access(sessionPath), { code: "ENOENT" }),
      assert.rejects(access(taskPath), { code: "ENOENT" }),
      assert.rejects(access(codexUrlPath), { code: "ENOENT" }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("the Codex observer labels a declared launch without converting it into server evidence", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "thought-codex-observer-declared-"));
  const sessionPath = join(outputDir, "session.json");
  const taskPath = join(outputDir, "sealed-task.txt");
  const codexUrlPath = join(outputDir, "codex-url.txt");
  await Promise.all([
    writeFile(taskPath, "sealed"),
    writeFile(codexUrlPath, "codex://new"),
    writeFile(sessionPath, JSON.stringify({
      schema: "inshell.thought.codex-handoff-report.v1",
      labVersion: "test",
      mode: "real-canary",
      agent: "Codex Desktop",
      runId: "tar_observer_declared_return",
      statusUrl: "https://candidate.example/api/thought-agent/v2/runs/tar_observer_declared_return",
      browserToken: "browser-token",
      taskSha256: `sha256:${"d".repeat(64)}`,
      taskByteLength: 6,
      taskPath,
      codexUrlPath,
      createdAt: "2026-09-16T00:00:00.000Z",
      promptLine: "private prompt",
    })),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    state: "returned",
    stage: "returned",
    result: {
      receipt: { receiptSha256: `sha256:${"e".repeat(64)}` },
      agentLine: "One line.",
    },
  });

  try {
    const { report } = await observeThoughtCodexRealCanary({
      sessionPath,
      timeoutMs: 1_000,
      pollMs: 1,
      launchSubmissionDeclaration: "creator-clicked-submit",
    });
    assert.equal(report.launchSubmission, "creator-clicked-submit");
    assert.equal(report.launchSubmissionEvidence, "operator-reported");
    assert.equal(report.serverReturnObserved, true);
    assert.equal(report.privateArtifactsRemoved, true);
    await Promise.all([
      assert.rejects(access(sessionPath), { code: "ENOENT" }),
      assert.rejects(access(taskPath), { code: "ENOENT" }),
      assert.rejects(access(codexUrlPath), { code: "ENOENT" }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("a timed-out Codex observation preserves private artifacts for a later poll", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "thought-codex-observer-timeout-"));
  const sessionPath = join(outputDir, "session.json");
  const taskPath = join(outputDir, "sealed-task.txt");
  const codexUrlPath = join(outputDir, "codex-url.txt");
  await Promise.all([
    writeFile(taskPath, "sealed"),
    writeFile(codexUrlPath, "codex://new"),
    writeFile(sessionPath, JSON.stringify({
      schema: "inshell.thought.codex-handoff-report.v1",
      labVersion: "test",
      mode: "real-canary",
      agent: "Codex Desktop",
      runId: "tar_observer_timeout",
      statusUrl: "https://candidate.example/api/thought-agent/v2/runs/tar_observer_timeout",
      browserToken: "browser-token",
      taskSha256: `sha256:${"c".repeat(64)}`,
      taskByteLength: 6,
      taskPath,
      codexUrlPath,
      createdAt: "2026-09-16T00:00:00.000Z",
      promptLine: "private prompt",
    })),
  ]);

  try {
    const { report } = await observeThoughtCodexRealCanary({
      sessionPath,
      timeoutMs: 0,
      launchSubmissionDeclaration: "creator-clicked-submit",
    });
    assert.equal(report.launchSubmission, "creator-clicked-submit");
    assert.equal(report.launchSubmissionEvidence, "operator-reported");
    assert.equal(report.serverReturnObserved, false);
    assert.equal(report.state, "timeout");
    assert.equal(report.privateArtifactsRemoved, false);
    await Promise.all([access(sessionPath), access(taskPath), access(codexUrlPath)]);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

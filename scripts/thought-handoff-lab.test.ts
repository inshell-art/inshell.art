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
  validateThoughtLabReadyResponse,
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
import {
  buildThoughtHandoffResponseChecks,
  THOUGHT_HANDOFF_CLAIM_RESPONSE_CHECK,
  THOUGHT_HANDOFF_CONNECTION_RECOVERY,
  THOUGHT_HANDOFF_FAIL_RESPONSE_CHECK,
  THOUGHT_HANDOFF_READY_RESPONSE_CHECK,
  THOUGHT_HANDOFF_RESPONSE_PATHS,
  THOUGHT_HANDOFF_RESULT_RESPONSE_CHECK,
  THOUGHT_HANDOFF_START_RESPONSE_CHECK,
} from "../packages/thought-agent-protocol/src/handoff-http";

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
    assert.match(transformed, /^CONTROL_SCHEMA = inshell\.thought\.agent-control\.v2\r?$/m);
    const contract = buildContract(input);
    const expectedData = [["CLAIM_BODY", contract.claim], ["READY_BODY_REPORTED", contract.ready], ["RUN_AUTHORITY", contract.authority]] as const;
    for (const [key, expected] of expectedData) {
      const line = transformed.split(/\r?\n/).find((value) => value.startsWith(`${key} = `));
      assert.ok(line);
      assert.deepEqual(JSON.parse(line.slice(key.length + 3)), expected);
    }
    assert.ok(transformed.includes('READY_BODY_UNKNOWN = READY_BODY_REPORTED with only control.runtimeModel changed to "unknown"'));
    assert.deepEqual(
      { ...contract.ready, control: { ...contract.ready.control, runtimeModel: "unknown" } },
      contract.readyUnknown,
    );
    assert.deepEqual(contract.authority, THOUGHT_AGENT_RUN_AUTHORITY);
    for (const check of [
      THOUGHT_HANDOFF_CLAIM_RESPONSE_CHECK,
      THOUGHT_HANDOFF_READY_RESPONSE_CHECK,
      THOUGHT_HANDOFF_START_RESPONSE_CHECK,
      THOUGHT_HANDOFF_RESULT_RESPONSE_CHECK,
      THOUGHT_HANDOFF_FAIL_RESPONSE_CHECK,
    ]) {
      assert.equal(task.split(check).length - 1, 1);
    }
    assert.equal(task.split(THOUGHT_HANDOFF_READY_RESPONSE_CHECK).length - 1, 1);
    assert.doesNotMatch(task, /exact evidence echo/);
    assert.match(task, /Authorization: Bearer LAUNCH_CREDENTIAL for claim/);
    assert.match(task, /BRIDGE_CREDENTIAL later/);
    assert.equal(THOUGHT_AGENT_HTTP_USER_AGENT, "Inshell-THOUGHT-Agent/2");
    assert.ok(transformed.includes(`All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT`));
    assert.match(task, /never a browser\/model/);
    assert.match(task, /Credentials only in Authorization—never body\/URL\/files\/logs\/redirects/);
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
    assert.match(task, /claim stop\/reconcile \(credential spent\/token once\/no reclaim\)/);
    assert.match(task, /ready replay exact READY_BODY\+bridge once \(sole control replay\)/);
    assert.match(task, /start stop\/reconcile \(no restart\/generate\/input replay\)/);
    assert.match(task, /result replay frozen request once \(same invocation\/key\/raw\/hashes/);
    assert.match(task, /same invocation\/key\/raw\/hashes; no reserialize\/hash repair\/art change\/regeneration/);
    assert.match(task, /fail stop\/reconcile \(no repeat\/success overwrite\)/);
    assert.doesNotMatch(task, /RETRY repeats only the failed operation|After permission\/network recovery/);
    if (agent === "Codex") {
      assert.match(task, /Only explicit host permission denial before \/start warrants/);
    } else {
      assert.match(task, /Sign-in redirect or network refusal: report the observed response and stop/);
      assert.doesNotMatch(task, /permission denial|connection approval|host permission|chat approval/i);
    }
    assert.match(task, /Proven-App PROTOCOL_UNSUPPORTED\/TOKEN_INVALID\/RUN_EXPIRED\/RUN_ALREADY_CLAIMED=R/);
    assert.match(task, /429: retry once only with usable Retry-After\+proven no commit; else U/);
    assert.doesNotMatch(task, /If the first App exchange is denied/);
  });
}

const readFixturePath = (value: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);

test("handoff response mappings reject the known missing and misplaced field shapes", () => {
  const paths = THOUGHT_HANDOFF_RESPONSE_PATHS;
  const specSha256 = `sha256:${"a".repeat(64)}`;
  const briefSha256 = `sha256:${"e".repeat(64)}`;
  const promptSha256 = `sha256:${"f".repeat(64)}`;
  const contractHash = `0x${"b".repeat(64)}`;
  const release = {
    protocolReleaseId: `0x${"c".repeat(64)}`,
    manifestKeccak256: `0x${"d".repeat(64)}`,
  };
  const claim = {
    runId: "tar_fixture",
    state: "claimed",
    bridgeToken: "bridge-fixture",
    request: {
      authority: THOUGHT_AGENT_RUN_AUTHORITY,
      intent: "prepare-thought-creation",
      controlPolicy: { mode: "bounded-preflight" },
      evidenceContract: { schema: "inshell.thought.agent-control.v2" },
    },
  };
  const claimIsValid = (value: unknown) =>
    readFixturePath(value, paths.claim.bridgeToken) === "bridge-fixture" &&
    JSON.stringify(readFixturePath(value, paths.claim.authority)) === JSON.stringify(THOUGHT_AGENT_RUN_AUTHORITY) &&
    readFixturePath(value, paths.claim.intent) === "prepare-thought-creation" &&
    readFixturePath(value, paths.claim.controlMode) === "bounded-preflight" &&
    readFixturePath(value, paths.claim.controlSchema) === "inshell.thought.agent-control.v2" &&
    readFixturePath(value, "control") === undefined &&
    readFixturePath(value, "request.control") === undefined;
  assert.equal(claimIsValid(claim), true);
  for (const invalid of [
    { ...claim, control: { schema: "inshell.thought.agent-control.v2" }, request: { ...claim.request, evidenceContract: undefined } },
    { ...claim, request: { ...claim.request, control: { schema: "inshell.thought.agent-control.v2" }, evidenceContract: undefined } },
    { ...claim, request: { ...claim.request, evidenceContract: undefined } },
    { ...claim, bridgeToken: "" },
    { ...claim, request: { ...claim.request, intent: "generate-thought-candidate" } },
    { ...claim, request: { ...claim.request, controlPolicy: { mode: "creative" } } },
  ]) assert.equal(claimIsValid(invalid), false);

  const ready = { control: { schema: "inshell.thought.agent-control.v2" } };
  assert.deepEqual(readFixturePath(ready, paths.ready.control), ready.control);
  assert.equal(readFixturePath({ request: ready }, paths.ready.control), undefined);

  const start = {
    runId: "tar_fixture",
    state: "running",
    request: {
      authority: THOUGHT_AGENT_RUN_AUTHORITY,
      intent: "generate-thought-candidate",
      spec: { id: "7", contractSpecId: "7", contractSpecHash: contractHash, text: "spec", sha256: specSha256 },
      instructions: { id: "brief", artifactId: "brief.json", text: "brief", sha256: briefSha256 },
      promptLine: { text: "prompt", sha256: promptSha256 },
      agentInput: { text: "prompt", sha256: promptSha256 },
      outputContract: { release, agentLine: { workProfile: "inshell.thought.work.v2.terminal-english-64" } },
    },
  };
  const startIsMapped = (value: unknown) =>
    readFixturePath(value, paths.start.intent) === "generate-thought-candidate" &&
    typeof readFixturePath(value, paths.start.promptText) === "string" &&
    readFixturePath(value, paths.start.promptText) === readFixturePath(value, paths.start.agentInputText) &&
    readFixturePath(value, paths.start.promptSha256) === readFixturePath(value, paths.start.agentInputSha256) &&
    readFixturePath(value, "request.spec.id") === readFixturePath(value, "request.spec.contractSpecId") &&
    readFixturePath(value, "request.spec.contractSpecHash") === contractHash &&
    readFixturePath(value, paths.start.workProfile) === "inshell.thought.work.v2.terminal-english-64" &&
    readFixturePath(value, paths.start.release) === release;
  assert.equal(startIsMapped(start), true);
  for (const invalid of [
    { ...start, request: { ...start.request, intent: "prepare-thought-creation" } },
    { ...start, request: { ...start.request, promptLine: "prompt" } },
    { ...start, request: { ...start.request, agentInput: "prompt" } },
    { ...start, request: { ...start.request, spec: { ...start.request.spec, contractSpecId: undefined } } },
    { ...start, request: { ...start.request, outputContract: { release, workProfile: "inshell.thought.work.v2.terminal-english-64" } } },
  ]) assert.equal(startIsMapped(invalid), false);

  const result = { result: { receipt: { receiptSha256: specSha256 } } };
  assert.equal(readFixturePath(result, paths.result.receiptSha256), specSha256);
  assert.equal(readFixturePath({ receiptSha256: specSha256 }, paths.result.receiptSha256), undefined);
  assert.equal(String(readFixturePath(result, paths.result.receiptSha256)).startsWith("sha256:"), true);
  assert.equal(String(readFixturePath({ result: { receipt: { receiptSha256: "a".repeat(64) } } }, paths.result.receiptSha256)).startsWith("sha256:"), false);

  const failure = { error: { code: "AGENT_START_FAILED", message: "fixture" } };
  assert.equal(readFixturePath(failure, paths.fail.code), "AGENT_START_FAILED");
  assert.equal(readFixturePath(failure, paths.fail.message), "fixture");
  assert.equal(readFixturePath({ request: failure }, paths.fail.code), undefined);

  const coworkChecks = buildThoughtHandoffResponseChecks({
    runId: "<run_id>", authority: "<run_authority>", controlSchema: "<control_schema>", workProfile: "<work_profile>",
  });
  assert.match(coworkChecks.claim, /request\.evidenceContract\.schema=<control_schema>/);
  assert.match(coworkChecks.start, /Under request require:[^\n]*outputContract\.agentLine\.workProfile=<work_profile>/);
});

for (const runtimeModel of ["reported", "unknown"] as const) {
  test(`readiness compares only control structurally (${runtimeModel}, simulated)`, () => {
    const runId = "tar_readiness_echo_fixture";
    const contract = buildThoughtCodexOperationContract({
      product: "Codex", runId,
      runUrl: `https://preview.inshell.art/api/thought-agent/v2/runs/${runId}`,
      launchToken: "fixture-only-launch-credential",
    });
    const request = runtimeModel === "reported" ? contract.ready : contract.readyUnknown;
    const response = {
      protocolVersion: request.protocolVersion,
      runId, state: "ready", stage: "control-verified",
      control: Object.fromEntries(Object.entries(request.control).reverse()),
    };
    assert.notEqual(JSON.stringify(response.control), JSON.stringify(request.control));
    assert.deepEqual(response.control, request.control);
    assert.equal(validateThoughtLabReadyResponse(response, runId, runtimeModel), response);
    // The incident checked a serialization of the *whole* request in the response.
    // Even sorting keys does not turn the response envelope into that request.
    const keys = [...new Set([...Object.keys(request), ...Object.keys(response), ...Object.keys(request.control)])].sort();
    assert.equal(JSON.stringify(response, keys).includes(JSON.stringify(request, keys)), false);
    for (const control of [
      request,
      { ...request.control, runtimeModel: runtimeModel === "reported" ? "unknown" : "reported" },
      { ...request.control, installationsRequired: 0 },
      { ...request.control, creativeInputOpened: "false" },
      { ...request.control, extra: false },
      null,
      JSON.stringify(request.control),
      ...Object.keys(request.control).map((missing) =>
        Object.fromEntries(Object.entries(request.control).filter(([key]) => key !== missing))),
    ]) {
      assert.throws(() => validateThoughtLabReadyResponse({ ...response, control }, runId, runtimeModel), /Readiness contract drifted/);
    }
    for (const invalid of [
      request,
      { ...response, protocolVersion: "incorrect" },
      { ...response, runId: "another-run" },
      { ...response, state: "claimed" },
      { ...response, stage: "unverified" },
      { ...response, creatorAction: { command: "CREATE" } },
      { ...response, creatorAction: null },
    ]) {
      assert.throws(() => validateThoughtLabReadyResponse(invalid, runId, runtimeModel), /Readiness contract drifted/);
    }
  });
}

test("Codex and ChatGPT handoffs fit real run and credential lengths on staging origins", () => {
  // The API emits 18 random bytes for run IDs and 32 for launch credentials,
  // encoded as unpadded base64url (24 and 43 characters respectively).
  const runId = `tar_${"x".repeat(24)}`;
  for (const product of ["Codex", "ChatGPT"] as const) {
    for (const origin of ["https://preview.inshell.art", "https://staging.inshell-art.pages.dev"]) {
      const task = buildThoughtCodexTask({
        product,
        runId,
        runUrl: `${origin}/api/thought-agent/v2/runs/${runId}`,
        launchToken: "x".repeat(43),
      });
      const bytes = Buffer.byteLength(task);
      assert.ok(bytes <= 7_000, `${product} ${origin} handoff is ${bytes} bytes`);
    }
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
  assert.match(task, /Run control\+one creative turn;/);
  assert.match(task, /no readiness\/CREATE confirmation\./);
  assert.doesNotMatch(task, /reply CREATE/i);
});

test("the handoff retains one private bridge credential in task context without local persistence", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /BRIDGE_CREDENTIAL=bridgeToken/);
  assert.match(task, /retain\/reuse in worker/);
  assert.match(task, /Credentials only in Authorization/);
  assert.match(task, /Same worker owns token\/all ops\/candidate/);
  assert.match(task, /never reclaim/);
});

test("the handoff is declarative, bootstrap-only, release-bound, and human-sized", () => {
  const task = thoughtCodexCanonicalCandidate();

  assert.match(task, /Transport capsule:/);
  assert.match(task, /APP_ENDPOINT = .*RUN_ID/);
  assert.match(task, /Prompt=\/start only;/);
  assert.match(task, /No setup\./);
  assert.match(task, /Under request require: spec\.\{id,text,sha256,contractSpecId,contractSpecHash\}/);
  assert.match(task, /Under request require:[^\n]*instructions\.\{id,artifactId,text,sha256\}/);
  assert.match(task, /spec\/instructions differ\./);
  assert.match(task, /protocolReleaseId=CANONICAL_PROTOCOL_RELEASE_ID/);
  assert.match(task, /manifestKeccak256=CANONICAL_MANIFEST_HASH/);
  assert.match(
    task,
    /request\.outputContract\.release\.protocolReleaseId=>CANONICAL_PROTOCOL_RELEASE_ID/,
  );
  assert.match(task, /Chat ignored/);
  assert.doesNotMatch(task, /<protocol_release_id> = /);
  assert.doesNotMatch(task, /<manifest_hash> = /);
  assert.match(task, /not transcript purity/);
  const authorityLine = task.split("\n").find((line) => line.startsWith("RUN_AUTHORITY = "));
  assert.ok(authorityLine);
  assert.deepEqual(
    JSON.parse(authorityLine.slice("RUN_AUTHORITY = ".length)),
    THOUGHT_AGENT_RUN_AUTHORITY,
  );
  assert.match(task, /request\.authority=RUN_AUTHORITY/);
  assert.ok(task.split("runId=RUN_ID").length - 1 >= 3);
  assert.match(task, /workProfile=WORK_PROFILE/);
  assert.match(task, /No post-start clarification or follow-up/);
  assert.match(task, /protocolVersion=PROTOCOL_VERSION,invocationId=INVOCATION_ID/);
  assert.match(task, /exact startedAt; UTC completedAt; output\.\{mediaType=application\/json/);
  assert.match(task, /visibleTurns:/);
  assert.match(task, /agentInvocations:/);
  assert.match(task, /workspacePolicy:/);
  assert.match(task, /sandboxPolicy:/);
  assert.match(task, /approvalPolicy:/);
  assert.match(task, /userConfigPolicy:/);
  assert.match(task, /\/start opens prompt\./);
  assert.doesNotMatch(task, /any returned release against the capsule release/);
  assert.match(task, /Exact nonempty model\+valid optional effort/);
  assert.match(task, /None => omit both/);
  assert.match(task, /source=unknown/);
  assert.match(task, /no guess\/config/);
  assert.match(task, /source=unknown\/READY_BODY_UNKNOWN/);
  assert.match(task, /POST only protocolVersion=PROTOCOL_VERSION,invocationId=INVOCATION_ID/);
  assert.ok(
    task.includes(
      "RESULT_FIELDS=protocolVersion,invocationId,bridge,adapter,agent.{product,provider,model?,reasoningEffort?,metadataSource},execution,startedAt,completedAt,output.{mediaType,raw,rawSha256,agentLine,agentLineSha256}",
    ),
  );
  assert.match(task, /no failedAt\./);
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

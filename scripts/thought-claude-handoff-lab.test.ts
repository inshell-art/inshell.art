import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { THOUGHT_HANDOFF_READY_RESPONSE_CHECK } from "../packages/thought-agent-protocol/src/handoff-http";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  buildClaudeDeepLink,
  observeThoughtClaudeRealCanary,
  thoughtClaudeCanonicalCandidate,
} from "./lib/thought-handoff-lab";
import {
  THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION,
  THOUGHT_AGENT_HTTP_USER_AGENT,
  THOUGHT_AGENT_RUN_AUTHORITY,
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
  isThoughtClaudeCoworkPublicHttpsOrigin,
} from "../packages/thought-agent-protocol/src/index";
import {
  onRequestOptions,
  type ThoughtAgentRouteContext,
} from "../functions/api/thought-agent/v1/shared";
import {
  onRequestGet as onConnectivityGet,
  onRequestOptions as onConnectivityOptions,
} from "../functions/api/thought-agent/v2/connectivity";

const thoughtMainSource = readFileSync(
  new URL("../apps/thought/src/main.ts", import.meta.url),
  "utf8",
);
const deployWorkflowSource = readFileSync(
  new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
  "utf8",
);

test("the Claude handoff uses the complete shared ten-case matrix", () => {
  assert.equal(THOUGHT_CODEX_HANDOFF_CASES.length, 10);
  assert.equal(new Set(THOUGHT_CODEX_HANDOFF_CASES.map((entry) => entry.id)).size, 10);
});

test("the canonical Claude Code handoff is an ordinary purpose-first task with exact run data", () => {
  const task = thoughtClaudeCanonicalCandidate();
  const exactHashInstruction = [
    "Serialize the compact candidate once and set that exact string as output.raw.",
    "Do not sort keys or apply JCS/canonical JSON.",
    "Set output.rawSha256 to sha256: followed by 64 lowercase hex digits over the exact UTF-8 bytes of the decoded output.raw string.",
    "Set output.agentLineSha256 the same way over the exact UTF-8 bytes of the decoded output.agentLine string, not its JSON-escaped literal.",
    "After choosing those final strings, do not alter or re-serialize them; rehash both immediately before PUT.",
  ].join(" ");
  assert.deepEqual(task.split("\n").slice(0, 4), [
    "Please complete one THOUGHT run with Claude.",
    "Receive the creative input from THOUGHT, make one short text artwork, and return it to the same App origin shown in the capsule endpoints below.",
    "No repository files are needed. Do not read, change, or execute them for this task.",
    "The creative prompt is not included. Retrieve it only from a successful /start response after the claim and readiness checks below.",
  ]);
  assert.equal(task.split("No repository files are needed. Do not read, change, or execute them for this task.").length - 1, 1);
  const authorityLine = task.split("\n").find((line) => line.startsWith("RUN_AUTHORITY = "));
  assert.ok(authorityLine);
  assert.deepEqual(
    JSON.parse(authorityLine.slice("RUN_AUTHORITY = ".length)),
    THOUGHT_AGENT_RUN_AUTHORITY,
  );
  assert.match(task, /request\.authority=RUN_AUTHORITY/);
  assert.match(task, /AGENT_SURFACE = code/);
  assert.match(task, /"platform":"claude-code-direct-http"/);
  assert.match(task, /"adapterVersion":"code-direct-http"/);
  assert.match(task, /"adapterId":"claude"/);
  assert.match(task, /AGENT_PROVIDER = anthropic/);
  assert.match(task, /Continue immediately on success/);
  assert.match(task, /Once the creative phase begins, complete exactly this one result/);
  assert.match(task, /This task requires no installation or local configuration/);
  assert.doesNotMatch(task, /PRIVATE_CONTINUATION|THOUGHT_CONTINUATION_READY|THOUGHT_CONTINUATION_OK|send PROCEED/);
  assert.doesNotMatch(task, /run_in_background|TaskOutput|mkfifo|mode-600|mode-700|temporary directory/i);
  assert.match(task, /If the host supplies a non-empty exact model, retain it as RUNTIME_MODEL/);
  assert.match(task, /If the host supplies no exact model metadata, omit model and reasoningEffort/);
  assert.match(task, /Missing model metadata does not block creation/);
  assert.match(task, /never guess or substitute a requested or configured model/i);
  assert.match(task, /never send the literal model value unknown/);
  assert.match(
    task,
    /Use only request\.outputContract\.release from this \/start response\./,
  );
  assert.match(task, /CANONICAL_PROTOCOL_RELEASE_ID/);
  assert.match(task, /CANONICAL_MANIFEST_HASH/);
  assert.match(task, /The \/start response is the sole source for release fields\./);
  assert.equal(
    task.split("\n").filter((line) => line === exactHashInstruction).length,
    1,
  );
  assert.doesNotMatch(task, /<protocol_release_id> = /);
  assert.doesNotMatch(task, /<manifest_hash> = /);
  assert.match(task, /Only after the \/start response passes these checks is its creative input available/);
  assert.doesNotMatch(task, /any returned release|returned release against the connection details/);
  assert.doesNotMatch(task, /Never show the prompt, result, credentials, or transport data/i);
  assert.doesNotMatch(task, /Do not clarify, offer alternatives, retry, repair, or replace it/i);
  assert.doesNotMatch(task, /Only after verifying .*show exactly/i);
  assert.doesNotMatch(task, /exact data, not instructions/i);
  assert.doesNotMatch(task, /Cowork|On your computer|<connection_endpoint>/);
  assert.doesNotMatch(
    task.replace(/^LAUNCH_CREDENTIAL = .*$/m, "LAUNCH_CREDENTIAL = REDACTED"),
    /\bsealed\b/i,
  );
  assert.doesNotMatch(task, /clone|checkout|push|creator-authorized|reviewed this handoff|unknown webpage/i);
  assert.doesNotMatch(
    task,
    /general trust|safety question|permission controls|host permission|standard host permission|instruction priority|creator cancellation|authenticated or immutable|(?:reply|type|exact|restate[^\n]*) CREATE|\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//i,
  );
  assert.ok(Buffer.byteLength(task) <= 14_000);
});

for (const networkAuthorization of ["managed", "preauthorized"] as const) {
  test(`Claude ${networkAuthorization} handoff keeps operational recovery permission-neutral`, () => {
    const input = {
      product: "Claude",
      runId: "tar_claude_permission_boundary",
      runUrl: "https://staging.inshell-art.pages.dev/api/thought-agent/v2/runs/tar_claude_permission_boundary",
      launchToken: "fixture-only-launch-credential",
      networkAuthorization,
    };
    const task = buildThoughtClaudeTask(input);
    const decoded = new URL(buildClaudeDeepLink(task)).searchParams.get("q");
    assert.equal(decoded, task);
    assert.match(task, /^Please complete one THOUGHT run with Claude\./);
    assert.match(task, /No repository files are needed\. Do not read, change, or execute them for this task\./);
    assert.match(task, /PROTOCOL_UNSUPPORTED\/TOKEN_INVALID\/RUN_EXPIRED\/RUN_ALREADY_CLAIMED are no-commit codes/);
    assert.match(task, /Sign-in redirect or network refusal: report the observed response and stop/);
    assert.match(task, /Pre-send permission=N/);
    assert.match(task, /N=not sent: fix\/send once/);
    assert.match(task, /R=verified App no-commit: obey\/no repeat/);
    assert.match(task, /U=unproven after dispatch/);
    assert.match(task, /Exact endpoint\+parsed protocol error is insufficient/);
    assert.match(task, /R also needs 4xx\+known no-commit code; else U/);
    assert.match(task, /claim stop\/reconcile \(credential spent\/token once\/no reclaim\)/);
    assert.match(task, /ready replay exact READY_BODY\+bridge once/);
    assert.match(task, /start stop\/reconcile \(no restart\/generate/);
    assert.match(task, /result replay frozen request once/);
    assert.match(task, /no reserialize\/hash repair\/art change\/regeneration/);
    assert.match(task, /fail stop\/reconcile \(no repeat\/success overwrite\)/);
    assert.doesNotMatch(task, /RETRY repeats only the failed operation|After permission\/network recovery/);
    assert.doesNotMatch(
      task,
      /general trust|safety question|permission controls|host permission|standard host permission|does not grant permission|instruction priority|creator cancellation|creator-authorized|do not request permission|(?:reply|type|exact|restate[^\n]*) CREATE/i,
    );
    assert.equal(task.split(input.launchToken).length - 1, 1);
    assert.match(task, /Credentials only in Authorization—never body\/URL\/files\/logs\/redirects/);
    assert.match(task, /Use only the five capsule endpoints/);
    assert.match(task, /Never claim again/);
    assert.match(task, /Never submit a conflicting result/);
    assert.match(task, /The creative prompt is absent until \/start succeeds/);
    assert.match(task, /Never guess or substitute a requested or configured model/i);
    const contract = buildThoughtClaudeOperationContract(input);
    assert.equal(contract.networkAuthorization, networkAuthorization);
    const authority = task.split("\n").find((line) => line.startsWith("RUN_AUTHORITY = "));
    assert.ok(authority);
    assert.deepEqual(JSON.parse(authority.slice("RUN_AUTHORITY = ".length)), contract.authority);
    assert.ok(Buffer.byteLength(task) <= 14_000);
  });
}

test("the legacy Cowork connectivity preflight is read-only and contains no run data", async () => {
  const response = onConnectivityGet();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    schema: "inshell.thought.agent-connectivity.v1",
    status: "reachable",
    protocolVersion: "inshell.thought.agent-run.v2",
  });

  const options = onConnectivityOptions();
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-methods"), "GET, OPTIONS");
});

test("the public Agent API grants CORS only to approved THOUGHT origins", () => {
  const buildContext = (origin: string): ThoughtAgentRouteContext => ({
    request: new Request("https://inshell.art/api/thought-agent/v2/runs", {
      method: "OPTIONS",
      headers: { origin },
    }),
    env: {},
  });

  const local = onRequestOptions(buildContext("http://127.0.0.1:5177"));
  assert.equal(local.status, 204);
  assert.equal(local.headers.get("access-control-allow-origin"), "http://127.0.0.1:5177");
  assert.equal(local.headers.get("vary"), "Origin");

  const production = onRequestOptions(buildContext("https://inshell.art"));
  assert.equal(production.headers.get("access-control-allow-origin"), "https://inshell.art");

  const previewContext: ThoughtAgentRouteContext = {
    request: new Request("https://staging.thought-inshell-art.pages.dev/api/thought-agent/v2/runs", {
      method: "OPTIONS",
      headers: { origin: "https://preview.inshell.art" },
    }),
    env: { CF_PAGES_BRANCH: "staging" },
  };
  const preview = onRequestOptions(previewContext);
  assert.equal(
    preview.headers.get("access-control-allow-origin"),
    "https://preview.inshell.art",
  );
  assert.equal(preview.headers.get("vary"), "Origin");

  const unknown = onRequestOptions(buildContext("https://untrusted.example"));
  assert.equal(unknown.headers.get("access-control-allow-origin"), null);
});

test("the App resolves Agent API URLs from the complete build-injected environment", () => {
  assert.match(
    thoughtMainSource,
    /const runtimeEnv: Record<string, unknown> = \{[\s\S]*?globalThis\.__INSHELL_VITE_ENV__[\s\S]*?\.\.\.import\.meta\.env/,
  );
  assert.match(
    thoughtMainSource,
    /const readConfiguredUrl = \(name: string\) => \{\s*const value = runtimeEnv\[name\]/,
  );
  assert.doesNotMatch(
    thoughtMainSource,
    /const readConfiguredUrl = \(name: string\) => \{\s*const value = \(import\.meta\.env as Record<string, unknown>\)\[name\]/,
  );
});

test("canonical preview uses scoped custom-domain Agent access without changing production or compatibility origins", () => {
  assert.equal(
    deployWorkflowSource.match(/^\s+VITE_THOUGHT_AGENT_API_BASE:/gm)?.length,
    2,
  );
  assert.equal(
    deployWorkflowSource.match(/^\s+VITE_THOUGHT_AGENT_PUBLIC_API_BASE:/gm)?.length,
    2,
  );
  assert.equal(
    deployWorkflowSource.match(/test -n "\$VITE_THOUGHT_AGENT_API_BASE"/g)?.length,
    2,
  );
  assert.equal(
    deployWorkflowSource.match(/test -n "\$VITE_THOUGHT_AGENT_PUBLIC_API_BASE"/g)?.length,
    2,
  );
  assert.equal(
    deployWorkflowSource.match(/github\.event\.inputs\.branch == 'staging' && '\/api\/thought-agent\/v2'/g)?.length,
    2,
  );
  assert.match(
    deployWorkflowSource,
    /VITE_THOUGHT_AGENT_PUBLIC_API_BASE: \$\{\{ github\.event\.inputs\.branch == 'staging' && 'https:\/\/preview\.inshell\.art\/api\/thought-agent\/v2' \|\| vars\.VITE_THOUGHT_AGENT_PUBLIC_API_BASE \|\| '\/api\/thought-agent\/v2' \}\}/,
  );
  assert.match(
    deployWorkflowSource,
    /github\.event\.inputs\.branch == 'staging' && 'https:\/\/staging\.thought-inshell-art\.pages\.dev\/api\/thought-agent\/v2'/,
  );
  assert.doesNotMatch(
    deployWorkflowSource,
    /VITE_THOUGHT_AGENT_PUBLIC_API_BASE:.*staging\.inshell-art\.pages\.dev/,
  );
});

test("legacy Cowork accepts only public HTTPS managed runs", () => {
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("https://thought.inshell.art"), true);
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("http://127.0.0.1:5177"), false);
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("http://192.168.0.104:5177"), false);
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("https://localhost:5177"), false);
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("https://[::1]:5177"), false);

  assert.throws(
    () => buildThoughtClaudeTask({
      product: "Claude",
      runId: "tar_claude_cowork_lan",
      runUrl: "http://192.168.0.104:5177/api/thought-agent/v2/runs/tar_claude_cowork_lan",
      launchToken: "private-launch-token",
      surface: "cowork",
    }),
    /publicly reachable HTTPS THOUGHT App origin/,
  );
});

test("the default Claude deep link opens Code and round-trips the exact bootstrap task", () => {
  const task = thoughtClaudeCanonicalCandidate();
  const parsed = new URL(buildClaudeDeepLink(task));
  assert.equal(parsed.protocol, "claude:");
  assert.equal(parsed.hostname, "code");
  assert.equal(parsed.pathname, "/new");
  assert.equal(parsed.searchParams.get("q"), task);
  assert.equal(parsed.searchParams.get("folder"), null);
  assert.equal(parsed.searchParams.size, 1);
});

test("Cowork remains an explicit legacy deep-link surface", () => {
  const task = buildThoughtClaudeTask({
    product: "Claude",
    runId: "tar_claude_cowork_legacy",
    runUrl: "https://thought.inshell.art/api/thought-agent/v2/runs/tar_claude_cowork_legacy",
    launchToken: "private-launch-token",
    surface: "cowork",
  });
  const parsed = new URL(buildClaudeDeepLink(task, "cowork"));
  assert.equal(parsed.hostname, "cowork");
  assert.equal(THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION, "inshell.thought.claude-cowork-handoff.v5");
  assert.match(task, new RegExp(`<handoff_revision> = ${THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION.replaceAll(".", "\\.")}`));
  assert.equal(task.split(THOUGHT_HANDOFF_READY_RESPONSE_CHECK).length - 1, 1);
  assert.doesNotMatch(task, /exact evidence echo/);
  assert.match(task, /request\.authority=<run_authority>/);
  assert.match(task, /request\.intent=prepare-thought-creation/);
  assert.match(task, /request\.controlPolicy\.mode=bounded-preflight/);
  assert.match(task, /request\.evidenceContract\.schema=<control_schema>/);
  assert.match(task, /request\.intent=generate-thought-candidate/);
  assert.match(task, /Under request require: spec\.\{id,text,sha256,contractSpecId,contractSpecHash\}/);
  assert.match(task, /Under request require:[^\n]*promptLine\/agentInput objects with text,sha256/);
  assert.match(task, /Under request require:[^\n]*outputContract\.agentLine\.workProfile=<work_profile>/);
  assert.match(task, /result\.receipt\.receiptSha256 begins sha256:/);
  assert.match(task, /root error\.code and error\.message/);
  assert.match(task, /<agent_surface> = cowork/);
  assert.match(task, /Run this task set to On your computer/);
  assert.ok(task.includes(`All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}; identifies THOUGHT`));
  assert.match(task, /never a browser\/model/);
  assert.ok(task.indexOf("All requests: User-Agent:") < task.indexOf("1. Check the connection"));
  assert.ok(Buffer.byteLength(task) <= 14_000);
});

test("Claude Code is the canonical surface with the same Claude adapter identity", () => {
  const input = {
    product: "Claude",
    runId: "tar_claude_code_recovery",
    runUrl: "http://127.0.0.1:5177/api/thought-agent/v2/runs/tar_claude_code_recovery",
    launchToken: "private-launch-token",
    surface: "code" as const,
  };
  const contract = buildThoughtClaudeOperationContract(input);
  const task = buildThoughtClaudeTask(input);
  const parsed = new URL(buildClaudeDeepLink(task, "code"));

  assert.equal(contract.adapter.adapterId, "claude");
  assert.equal(contract.adapter.adapterVersion, "code-direct-http");
  assert.equal(contract.bridge.platform, "claude-code-direct-http");
  assert.equal(contract.agentSurface, "code");
  assert.match(task, /AGENT_SURFACE = code/);
  assert.equal(parsed.hostname, "code");
  assert.equal(parsed.searchParams.get("q"), task);
});

const createClaudeObserverFixture = async (runId: string) => {
  const outputDir = await mkdtemp(join(tmpdir(), "thought-claude-observer-"));
  const sessionPath = join(outputDir, "session.json");
  const taskPath = join(outputDir, "sealed-task.txt");
  const claudeUrlPath = join(outputDir, "claude-url.txt");
  await Promise.all([
    writeFile(taskPath, "sealed"),
    writeFile(claudeUrlPath, "claude://code/new"),
    writeFile(sessionPath, JSON.stringify({
      schema: "inshell.thought.claude-handoff-report.v1",
      labVersion: "test",
      mode: "real-canary",
      agent: "Claude Desktop",
      surface: "code",
      origin: "https://candidate.example",
      handoffRevision: null,
      runId,
      statusUrl: `https://candidate.example/api/thought-agent/v2/runs/${runId}`,
      browserToken: "browser-token",
      taskSha256: `sha256:${"a".repeat(64)}`,
      taskByteLength: 6,
      taskPath,
      claudeUrlPath,
      createdAt: "2026-09-16T00:00:00.000Z",
      promptLine: "private prompt",
    })),
  ]);
  return { outputDir, sessionPath, taskPath, claudeUrlPath };
};

const claudeReturnedResponse = () => Response.json({
  state: "returned",
  stage: "returned",
  result: {
    receipt: {
      receiptSha256: `sha256:${"b".repeat(64)}`,
      model: "claude-test",
      reasoningEffort: "high",
    },
    agentLine: "One line.",
  },
});

test("the Claude observer records a server return without inventing a launch submission", async () => {
  const fixture = await createClaudeObserverFixture("tar_claude_observer_returned");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => claudeReturnedResponse();

  try {
    const { report } = await observeThoughtClaudeRealCanary({
      sessionPath: fixture.sessionPath,
      timeoutMs: 1_000,
      pollMs: 1,
    });
    assert.equal(report.launchSubmission, "not-recorded");
    assert.equal(report.launchSubmissionEvidence, "not-recorded");
    assert.equal(report.serverReturnObserved, true);
    assert.equal(report.qualificationEligible, false);
    assert.equal(report.privateArtifactsRemoved, true);
    await Promise.all([
      assert.rejects(access(fixture.sessionPath), { code: "ENOENT" }),
      assert.rejects(access(fixture.taskPath), { code: "ENOENT" }),
      assert.rejects(access(fixture.claudeUrlPath), { code: "ENOENT" }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(fixture.outputDir, { recursive: true, force: true });
  }
});

test("the Claude observer keeps declared launch evidence narrower than qualification", async () => {
  const fixture = await createClaudeObserverFixture("tar_claude_observer_declared_return");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => claudeReturnedResponse();

  try {
    const { report } = await observeThoughtClaudeRealCanary({
      sessionPath: fixture.sessionPath,
      timeoutMs: 1_000,
      pollMs: 1,
      launchSubmissionDeclaration: "creator-clicked-submit",
    });
    assert.equal(report.launchSubmission, "creator-clicked-submit");
    assert.equal(report.launchSubmissionEvidence, "operator-reported");
    assert.equal(report.serverReturnObserved, true);
    assert.equal(report.qualificationEligible, false);
    assert.equal(report.privateArtifactsRemoved, true);
    await Promise.all([
      assert.rejects(access(fixture.sessionPath), { code: "ENOENT" }),
      assert.rejects(access(fixture.taskPath), { code: "ENOENT" }),
      assert.rejects(access(fixture.claudeUrlPath), { code: "ENOENT" }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(fixture.outputDir, { recursive: true, force: true });
  }
});

test("a timed-out Claude observation preserves private artifacts for a later poll", async () => {
  const fixture = await createClaudeObserverFixture("tar_claude_observer_timeout");

  try {
    const { report } = await observeThoughtClaudeRealCanary({
      sessionPath: fixture.sessionPath,
      timeoutMs: 0,
      launchSubmissionDeclaration: "creator-clicked-submit",
    });
    assert.equal(report.launchSubmission, "creator-clicked-submit");
    assert.equal(report.launchSubmissionEvidence, "operator-reported");
    assert.equal(report.serverReturnObserved, false);
    assert.equal(report.qualificationEligible, false);
    assert.equal(report.privateArtifactsRemoved, false);
    await Promise.all([
      access(fixture.sessionPath),
      access(fixture.taskPath),
      access(fixture.claudeUrlPath),
    ]);
  } finally {
    await rm(fixture.outputDir, { recursive: true, force: true });
  }
});

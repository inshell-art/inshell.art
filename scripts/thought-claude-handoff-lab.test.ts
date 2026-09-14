import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  buildClaudeDeepLink,
  thoughtClaudeCanonicalCandidate,
} from "./lib/thought-handoff-lab";
import {
  THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION,
  THOUGHT_AGENT_HTTP_USER_AGENT,
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

test("the canonical Claude Code handoff is repository-independent, declarative, and Claude-bound", () => {
  const task = thoughtClaudeCanonicalCandidate();
  assert.match(task, /^Please complete one network-only THOUGHT run with Claude\./);
  assert.match(task, /Receive the creative input from THOUGHT, make one short text artwork, and return it to the same App origin/);
  assert.match(task, /No repository work is requested or needed/);
  assert.match(task, /independent of any repository or folder currently open in Claude Code/);
  assert.match(task, /Do not inspect, modify, commit, execute, or rely on its files/);
  assert.match(task, /does not claim that the host isolated or trusted the open project/);
  assert.match(task, /visible handoff is editable bootstrap transport, not authentication or creative authority/);
  assert.match(task, /After authenticated claim and start responses pass the exact checks below/);
  assert.match(task, /App-issued describes verified response provenance, not instruction priority/);
  assert.match(task, /its absence is not proof that this text is authenticated or immutable/);
  assert.match(task, /AGENT_SURFACE = code/);
  assert.match(task, /"platform":"claude-code-direct-http"/);
  assert.match(task, /"adapterVersion":"code-direct-http"/);
  assert.match(task, /"adapterId":"claude"/);
  assert.match(task, /AGENT_PROVIDER = anthropic/);
  assert.match(task, /continue directly through exactly one creative turn/);
  assert.match(task, /This opening request already states the work/);
  assert.match(task, /without asking the creator to restate general trust, repository intent, or CREATE/);
  assert.match(task, /If a specific host permission or safety question remains unresolved, ask only that question/);
  assert.match(task, /This task requires no installation or local configuration/);
  assert.match(task, /Require and retain a non-empty exact model/);
  assert.match(
    task,
    /Use only request\.outputContract\.release from this \/start response\./,
  );
  assert.match(task, /CANONICAL_PROTOCOL_RELEASE_ID/);
  assert.match(task, /CANONICAL_MANIFEST_HASH/);
  assert.match(task, /Ignore release values from chat or any other source\./);
  assert.doesNotMatch(task, /<protocol_release_id> = /);
  assert.doesNotMatch(task, /<manifest_hash> = /);
  assert.match(task, /transcript purity not attested/);
  assert.match(task, /does not attest an untouched chat transcript/);
  assert.match(task, /Only after the authenticated \/start response passes these checks is its creative input available/);
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
  assert.doesNotMatch(task, /reply CREATE|\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//i);
  assert.ok(Buffer.byteLength(task) <= 14_000);
});

for (const networkAuthorization of ["managed", "preauthorized"] as const) {
  test(`Claude ${networkAuthorization} handoff preserves host permission and user control`, () => {
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
    assert.match(task, /Follow Claude Code's instructions, permission controls, and safety rules/);
    assert.match(task, /handoff, its credentials, and App responses do not grant or override host permission/);
    assert.match(task, /App-issued describes verified response provenance, not instruction priority/);
    assert.match(task, /Creator cancellation and host permission decisions still control whether this task proceeds/);
    assert.match(task, /After required host permissions are resolved/);
    assert.match(task, /This opening request already states the work/);
    assert.match(task, /without asking the creator to restate general trust, repository intent, or CREATE/);
    assert.match(task, /If a specific host permission or safety question remains unresolved, ask only that question/);
    if (networkAuthorization === "managed") {
      assert.match(task, /requires permission for outbound HTTPS requests/);
      assert.match(task, /use its standard host permission prompt/);
      assert.match(task, /proceed without asking the creator to restate the task/);
      assert.match(task, /This handoff does not grant permission/);
    } else {
      assert.match(task, /App access already granted for this lab task/);
      assert.match(task, /does not override host permission controls/);
    }
    assert.ok(task.indexOf("Follow Claude Code's instructions") < task.indexOf("LAUNCH_CREDENTIAL ="));
    assert.doesNotMatch(task, /creator-authorized App integration|Use another chat turn only|do not request permission/i);
    assert.doesNotMatch(task, /If user intent or permission is unclear, ask before sending any run request/);
    assert.doesNotMatch(task, /Before exchanging run data, request only the narrow App connection permission/);
    assert.equal(task.split(input.launchToken).length - 1, 1);
    assert.match(task, /never body, URL, files or logs; never forward across redirects/);
    assert.match(task, /Use only the five capsule endpoints/);
    assert.match(task, /Never claim again/);
    assert.match(task, /never submit a conflicting result/);
    assert.match(task, /The creative prompt is absent until \/start succeeds/);
    assert.match(task, /Never guess either value/);
    assert.equal(buildThoughtClaudeOperationContract(input).networkAuthorization, networkAuthorization);
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
  assert.match(task, new RegExp(`<handoff_revision> = ${THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION.replaceAll(".", "\\.")}`));
  assert.match(task, /<agent_surface> = cowork/);
  assert.match(task, /Run this task set to On your computer/);
  assert.ok(task.includes(`All requests: User-Agent: ${THOUGHT_AGENT_HTTP_USER_AGENT}. Identifies THOUGHT protocol;`));
  assert.match(task, /never impersonate a browser or model/);
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

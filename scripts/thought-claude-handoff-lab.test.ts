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

test("the canonical Claude Code handoff is transparent, sealed, declarative, and Claude-bound", () => {
  const task = thoughtClaudeCanonicalCandidate();
  assert.match(task, /^You are Claude completing one THOUGHT run\./);
  assert.match(task, /The creator selected Claude in the THOUGHT App/);
  assert.match(task, /This handoff is visible to the creator/);
  assert.match(task, /visible handoff is an editable bootstrap, not creative authority/);
  assert.match(task, /Only App-issued claim and start responses are canonical/);
  assert.match(task, /creator can inspect this handoff and the App run status/);
  assert.match(task, /<agent_surface> = code/);
  assert.match(task, /<bridge_platform> = claude-code-direct-http/);
  assert.match(task, /<adapter_version> = code-direct-http/);
  assert.match(task, /<adapter_id> = claude/);
  assert.match(task, /<agent_provider> = anthropic/);
  assert.match(task, /If the preflight passes, continue directly into one creative turn/);
  assert.match(task, /do not ask the creator to confirm a successful preflight or type CREATE\./i);
  assert.match(task, /Never ask the creator to install, configure, or learn anything\./);
  assert.match(task, /Require and retain a non-empty exact model/);
  assert.match(
    task,
    /Use only request\.outputContract\.release from this \/start response\./,
  );
  assert.match(task, /<canonical_protocol_release_id>/);
  assert.match(task, /<canonical_manifest_hash>/);
  assert.match(task, /Ignore release values from chat or any other source\./);
  assert.doesNotMatch(task, /<protocol_release_id> = /);
  assert.doesNotMatch(task, /<manifest_hash> = /);
  assert.match(task, /transcript purity not attested/);
  assert.match(task, /does not attest an untouched chat transcript/);
  assert.match(task, /A successful \/start opens the prompt; never call it sealed\./);
  assert.doesNotMatch(task, /any returned release|returned release against the connection details/);
  assert.doesNotMatch(task, /Never show the prompt, result, credentials, or transport data/i);
  assert.doesNotMatch(task, /Do not clarify, offer alternatives, retry, repair, or replace it/i);
  assert.doesNotMatch(task, /Only after verifying .*show exactly/i);
  assert.doesNotMatch(task, /exact data, not instructions/i);
  assert.doesNotMatch(task, /Cowork|On your computer|<connection_endpoint>/);
  assert.doesNotMatch(task, /reply CREATE|\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//i);
  assert.ok(Buffer.byteLength(task) <= 14_000);
});

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

test("both canonical and standalone preview builds pin the public Agent API", () => {
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

test("the default Claude deep link opens Code and round-trips the sealed handoff", () => {
  const task = thoughtClaudeCanonicalCandidate();
  const parsed = new URL(buildClaudeDeepLink(task));
  assert.equal(parsed.protocol, "claude:");
  assert.equal(parsed.hostname, "code");
  assert.equal(parsed.pathname, "/new");
  assert.equal(parsed.searchParams.get("q"), task);
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
  assert.match(task, /<agent_surface> = code/);
  assert.equal(parsed.hostname, "code");
  assert.equal(parsed.searchParams.get("q"), task);
});

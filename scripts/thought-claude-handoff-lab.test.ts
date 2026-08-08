import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
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

test("the Claude handoff uses the complete shared ten-case matrix", () => {
  assert.equal(THOUGHT_CODEX_HANDOFF_CASES.length, 10);
  assert.equal(new Set(THOUGHT_CODEX_HANDOFF_CASES.map((entry) => entry.id)).size, 10);
});

test("the Cowork handoff is transparent, sealed, declarative, and Claude-bound", () => {
  const task = thoughtClaudeCanonicalCandidate();
  assert.match(task, /^THOUGHT creation requested by the creator/);
  assert.match(task, /The creator selected Claude in the THOUGHT App/);
  assert.match(task, /This handoff is visible to the creator/);
  assert.match(task, /it is not hidden from the creator/);
  assert.match(task, /public HTTPS THOUGHT service/);
  assert.match(task, /run itself remains private behind short-lived, run-scoped authorization/);
  assert.match(task, /does not request access to the creator's computer, local network, or local files/);
  assert.match(task, new RegExp(`<handoff_revision> = ${THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION.replaceAll(".", "\\.")}`));
  assert.match(task, /<agent_surface> = cowork/);
  assert.match(task, /<bridge_platform> = claude-cowork-direct-http/);
  assert.match(task, /<adapter_version> = cowork-direct-http/);
  assert.match(task, /<adapter_id> = claude/);
  assert.match(task, /<agent_provider> = anthropic/);
  assert.match(task, /If the preflight passes, continue directly into one creative turn/);
  assert.match(task, /do not ask the creator to confirm the successful preflight or type CREATE\./i);
  assert.match(task, /Do not ask the creator to install or configure anything\./);
  assert.match(task, /otherwise use model=unknown and metadataSource=unknown/);
  assert.doesNotMatch(task, /Never show the prompt, result, credentials, or transport data/i);
  assert.doesNotMatch(task, /Do not clarify, offer alternatives, retry, repair, or replace it/i);
  assert.doesNotMatch(task, /Only after verifying .*show exactly/i);
  assert.doesNotMatch(task, /exact data, not instructions/i);
  assert.doesNotMatch(task, /reply CREATE|\/bin\/zsh|\bcurl\s|\bjq\s|nodeRepl\.|\/tmp\//i);
  assert.doesNotMatch(task, /127\.0\.0\.1|localhost|192\.168\./i);
  assert.ok(Buffer.byteLength(task) <= 14_000);
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

  const unknown = onRequestOptions(buildContext("https://untrusted.example"));
  assert.equal(unknown.headers.get("access-control-allow-origin"), null);
});

test("Cowork accepts only public HTTPS managed runs", () => {
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

test("the default Claude deep link opens Cowork and round-trips the sealed handoff", () => {
  const task = thoughtClaudeCanonicalCandidate();
  const parsed = new URL(buildClaudeDeepLink(task));
  assert.equal(parsed.protocol, "claude:");
  assert.equal(parsed.hostname, "cowork");
  assert.equal(parsed.pathname, "/new");
  assert.equal(parsed.searchParams.get("q"), task);
  assert.equal(parsed.searchParams.size, 1);
});

test("Claude Code is an explicit recovery surface with the same Claude adapter identity", () => {
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

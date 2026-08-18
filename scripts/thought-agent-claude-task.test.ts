import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
  isThoughtClaudeCoworkPublicHttpsOrigin,
} from "../packages/thought-agent-protocol/src/index";

const input = {
  product: "Claude",
  runId: "tar_qualified_canary",
  runUrl: "https://preview.inshell.art/api/thought-agent/v2/runs/tar_qualified_canary",
  launchToken: "run-scoped-test-credential",
  surface: "code" as const,
  release: {
    protocolReleaseId: `0x${"1".repeat(64)}` as `0x${string}`,
    manifestKeccak256: `0x${"2".repeat(64)}` as `0x${string}`,
  },
  resultContract: {
    workProfile: "inshell.thought.work.v2.terminal-english-64",
    lineValidation: "terminal-english-64" as const,
  },
};

test("builds the recovered Claude Code direct profile", () => {
  const operation = buildThoughtClaudeOperationContract(input);
  assert.equal(operation.adapter.adapterId, "claude");
  assert.equal(operation.adapter.adapterVersion, "code-direct-http");
  assert.equal(operation.bridge.platform, "claude-code-direct-http");
  assert.equal(operation.agentProvider, "anthropic");
  assert.equal(operation.agentSurface, "code");
  assert.equal(operation.endpoints.ready, `${input.runUrl}/ready`);

  const task = buildThoughtClaudeTask(input);
  assert.match(task, /You are Claude completing one THOUGHT run/);
  assert.match(task, /<agent_provider> = anthropic/);
  assert.match(task, /<agent_surface> = code/);
  assert.match(task, /<bridge_platform> = claude-code-direct-http/);
  assert.match(task, /creative prompt is absent until \/start succeeds/);
  assert.doesNotMatch(task, /Claude Cowork|On your computer|connection_endpoint/);
});

test("keeps legacy Cowork restricted to public HTTPS", () => {
  assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin("https://preview.inshell.art"), true);
  for (const origin of [
    "http://127.0.0.1:5173",
    "http://192.168.0.103:5177",
    "https://localhost",
    "not a URL",
  ]) {
    assert.equal(isThoughtClaudeCoworkPublicHttpsOrigin(origin), false);
  }
  assert.throws(
    () => buildThoughtClaudeTask({
      ...input,
      runUrl: "http://192.168.0.103:5177/api/thought-agent/v2/runs/tar_qualified_canary",
      surface: "cowork",
    }),
    /publicly reachable HTTPS THOUGHT App origin/,
  );
});

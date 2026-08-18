import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/thought-agent-canaries.yml", import.meta.url),
  "utf8",
);
const claudeCanary = await readFile(
  new URL("./test-thought-agent-claude-live.ts", import.meta.url),
  "utf8",
);
const codexCanary = await readFile(
  new URL("./test-thought-agent-codex-live.ts", import.meta.url),
  "utf8",
);
const claudeManualCanary = await readFile(
  new URL("./test-thought-agent-claude-manual.ts", import.meta.url),
  "utf8",
);

test("keeps paid Agent canaries manual and off pull-request runners", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+(?:pull_request|push|schedule):/m);
  assert.match(workflow, /confirm_paid_agent_calls/);
  assert.match(workflow, /runs-on: \[self-hosted, macOS, inshell-agent-canary, mac-a\]/);
  assert.match(workflow, /runs-on: \[self-hosted, macOS, inshell-agent-canary, mac-b\]/);
  assert.doesNotMatch(workflow, /secrets\./);
});

test("binds every cell to exact staging preview evidence", () => {
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /THOUGHT_LIVE_COMMIT_SHA/g);
  assert.match(workflow, /scripts\/check-thought-agent-live-target\.ts/g);
  assert.match(codexCanary, /validateCurrentThoughtAgentCandidateCheckout/);
  assert.match(claudeCanary, /validateCurrentThoughtAgentCandidateCheckout/);
  assert.match(workflow, /--runners mac-a,mac-b/);
  assert.match(workflow, /steps\.matrix\.outcome/);
});

test("binds explicit operator authority inside the strict Claude native sandbox", () => {
  assert.match(claudeCanary, /--safe-mode/);
  assert.doesNotMatch(claudeCanary, /--bare/);
  assert.match(claudeCanary, /--allowedTools[\s\S]*"Bash"/);
  assert.match(claudeCanary, /permissions:[\s\S]*allow: \["Bash"\]/);
  assert.match(claudeCanary, /autoAllowBashIfSandboxed: true/);
  assert.match(claudeCanary, /operator manually started this paid compatibility canary/);
  assert.match(claudeCanary, /explicitly approved its exact staging App exchange/);
  assert.match(claudeCanary, /--permission-mode[\s\S]*"auto"/);
  assert.match(claudeCanary, /failIfUnavailable: true/);
  assert.match(claudeCanary, /allowUnsandboxedCommands: false/);
  assert.match(claudeCanary, /denyRead: \["~\/"\]/);
  assert.match(claudeCanary, /strictAllowlist: true/);
  assert.doesNotMatch(claudeCanary, /bypassPermissions|dangerously-skip-permissions/);
});

test("binds Codex model evidence to the installed CLI runtime", () => {
  assert.match(codexCanary, /codex doctor --json/);
  assert.match(codexCanary, /checks\.config\.load/);
  assert.match(codexCanary, /details\.model provider/);
  assert.doesNotMatch(codexCanary, /THOUGHT_CODEX_MODEL/);
});

test("keeps the manual Claude handoff off stdout and cleans its transient authority", () => {
  assert.match(claudeManualCanary, /runProcess\("pbcopy", \[\], task\)/);
  assert.doesNotMatch(claudeManualCanary, /stdout\.write\(task\)/);
  assert.match(claudeManualCanary, /open\(statePath, "wx", 0o600\)/);
  assert.match(claudeManualCanary, /clearClipboardIfUnchanged/);
  assert.match(claudeManualCanary, /await unlink\(statePath\)/);
  assert.match(claudeManualCanary, /networkAuthorization: "managed"/);
});

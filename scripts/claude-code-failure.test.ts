import assert from "node:assert/strict";
import test from "node:test";

import { classifyClaudeCodeFailure } from "./lib/claude-code-failure";

test("classifies bounded Claude Code failures without returning raw output", () => {
  const secret = "Bearer launch-secret-must-not-escape";
  const cases = [
    [JSON.stringify({
      permission_denials: [{
        tool_name: "Bash",
        tool_input: { command: 'curl https://example.test -H "Authorization: Bearer secret"' },
      }],
    }), "", "CLAUDE_PERMISSION_DENIED_BASH_CURL"],
    ['{"permission_denials":[{"tool_name":"Bash","tool_input":{"command":"python3 -c pass"}}]}', "", "CLAUDE_PERMISSION_DENIED_BASH_PYTHON"],
    ['{"permission_denials":[{"tool_name":"Read"}]}', "", "CLAUDE_PERMISSION_DENIED_OTHER_TOOL"],
    ['{"subtype":"error_max_turns"}', "", "CLAUDE_MAX_TURNS"],
    ['{"is_error":true,"result":"Sandbox failed to start"}', "", "CLAUDE_SANDBOX_UNAVAILABLE"],
    ["", `OAuth login required ${secret}`, "CLAUDE_AUTH_REQUIRED"],
    ['{"is_error":true,"result":"Permission required"}', "", "CLAUDE_MODEL_REPORTED_PERMISSION"],
    ["", "Operation denied by host policy", "CLAUDE_HOST_PERMISSION_DENIED"],
    ['{"is_error":true,"result":"Rate limit reached"}', "", "CLAUDE_RATE_LIMITED"],
    [`{"is_error":true,"result":"unknown ${secret}"}`, secret, "CLAUDE_EXIT_NONZERO"],
  ] as const;

  for (const [stdout, stderr, expected] of cases) {
    const result = classifyClaudeCodeFailure(stdout, stderr);
    assert.equal(result, expected);
    assert.doesNotMatch(result, /secret|Bearer/i);
  }
});

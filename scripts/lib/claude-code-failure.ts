type ClaudeFailurePayload = {
  subtype?: unknown;
  is_error?: unknown;
  result?: unknown;
  permission_denials?: unknown;
};

type PermissionDenial = {
  tool_name?: unknown;
  tool_input?: unknown;
};

const textContains = (value: unknown, pattern: RegExp) =>
  typeof value === "string" && pattern.test(value);

export function classifyClaudeCodeFailure(stdout: string, stderr: string): string {
  let payload: ClaudeFailurePayload | undefined;
  try {
    const parsed = JSON.parse(stdout) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      payload = parsed as ClaudeFailurePayload;
    }
  } catch {
    payload = undefined;
  }

  if (Array.isArray(payload?.permission_denials) && payload.permission_denials.length > 0) {
    const denials = payload.permission_denials as PermissionDenial[];
    const bashCommands = denials.flatMap((denial) => {
      if (denial?.tool_name !== "Bash" || !denial.tool_input || typeof denial.tool_input !== "object") {
        return [];
      }
      const command = (denial.tool_input as { command?: unknown }).command;
      return typeof command === "string" ? [command] : [];
    });
    if (bashCommands.some((command) => /(?:^|[\s;&|])curl(?:\s|$)/.test(command))) {
      return "CLAUDE_PERMISSION_DENIED_BASH_CURL";
    }
    if (bashCommands.some((command) => /(?:^|[\s;&|])(?:python|python3)(?:\s|$)/.test(command))) {
      return "CLAUDE_PERMISSION_DENIED_BASH_PYTHON";
    }
    if (bashCommands.some((command) => /(?:^|[\s;&|])node(?:\s|$)/.test(command))) {
      return "CLAUDE_PERMISSION_DENIED_BASH_NODE";
    }
    if (bashCommands.length > 0) return "CLAUDE_PERMISSION_DENIED_BASH_OTHER";
    return "CLAUDE_PERMISSION_DENIED_OTHER_TOOL";
  }
  const subtype = typeof payload?.subtype === "string" ? payload.subtype : "";
  if (/max[_ -]?turn/i.test(subtype)) return "CLAUDE_MAX_TURNS";
  if (/budget|spend/i.test(subtype)) return "CLAUDE_BUDGET_EXCEEDED";

  if (textContains(payload?.result, /permission|not allowed|denied/i)) {
    return "CLAUDE_MODEL_REPORTED_PERMISSION";
  }
  if (textContains(stderr, /permission|not allowed|denied/i)) {
    return "CLAUDE_HOST_PERMISSION_DENIED";
  }
  const safeText = [payload?.result, stderr];
  if (safeText.some((value) => textContains(value, /sandbox/i))) {
    return "CLAUDE_SANDBOX_UNAVAILABLE";
  }
  if (safeText.some((value) => textContains(value, /auth(?:entication)?|oauth|login/i))) {
    return "CLAUDE_AUTH_REQUIRED";
  }
  if (safeText.some((value) => textContains(value, /rate.?limit|overloaded/i))) {
    return "CLAUDE_RATE_LIMITED";
  }
  if (safeText.some((value) => textContains(value, /budget|spend limit/i))) {
    return "CLAUDE_BUDGET_EXCEEDED";
  }
  return "CLAUDE_EXIT_NONZERO";
}

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { isThoughtSha256 } from "../../packages/thought-agent-protocol/src/index";

export const THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION =
  "inshell.thought.agent-compatibility-report.v1" as const;

const SAFE_TEXT = /^[A-Za-z0-9][A-Za-z0-9 ._+:/-]{0,127}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const FORBIDDEN_TEXT = /https?:\/\/|\bbearer\b|\btoken\b|credential|prompt|raw.?output/i;
const REPORT_KEYS = [
  "schema",
  "recordedAt",
  "agent",
  "host",
  "target",
  "result",
] as const;

export type ThoughtAgentCompatibilityReport = {
  schema: typeof THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION;
  recordedAt: string;
  agent: {
    adapter: "codex" | "claude";
    surface: "codex-cli" | "claude-code-cli";
    toolVersion: string;
    model?: string;
    reasoningEffort?: string;
  };
  host: {
    runnerId: string;
    os: string;
    arch: string;
    nodeVersion: string;
  };
  target: {
    environment: "local" | "lan" | "preview" | "production" | "custom";
    commitSha: string;
    protocolVersion: string;
  };
  result: {
    status: "passed" | "failed";
    stage: "preflight" | "create" | "agent" | "poll" | "complete";
    runState: string;
    durationMs: number;
    receiptSha256?: string;
    errorCode?: string;
  };
};

export function classifyThoughtAgentTargetEnvironment(
  origin: string,
): ThoughtAgentCompatibilityReport["target"]["environment"] {
  const hostname = new URL(origin).hostname.toLowerCase();
  if (hostname === "127.0.0.1" || hostname === "localhost") return "local";
  if (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) return "lan";
  if (hostname === "preview.inshell.art" || hostname.endsWith(".pages.dev")) {
    return "preview";
  }
  if (hostname === "inshell.art") return "production";
  return "custom";
}

const exactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) => {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || keys.some((key) => !actual.includes(key))) {
    throw new Error(`Invalid ${label} fields.`);
  }
};

const asObject = (value: unknown, label: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value as Record<string, unknown>;
};

const safeText = (value: unknown, label: string) => {
  if (
    typeof value !== "string" ||
    !SAFE_TEXT.test(value) ||
    FORBIDDEN_TEXT.test(value)
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

const optionalSafeText = (value: unknown, label: string) =>
  value === undefined ? undefined : safeText(value, label);

export function parseThoughtAgentCompatibilityReport(
  value: unknown,
): ThoughtAgentCompatibilityReport {
  const report = asObject(value, "compatibility report");
  exactKeys(report, REPORT_KEYS, "compatibility report");
  if (report.schema !== THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION) {
    throw new Error("Invalid compatibility report schema.");
  }
  if (
    typeof report.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(report.recordedAt))
  ) {
    throw new Error("Invalid compatibility report timestamp.");
  }

  const agent = asObject(report.agent, "agent");
  const agentKeys = ["adapter", "surface", "toolVersion"];
  if (agent.model !== undefined) agentKeys.push("model");
  if (agent.reasoningEffort !== undefined) agentKeys.push("reasoningEffort");
  exactKeys(agent, agentKeys, "agent");
  if (agent.adapter !== "codex" && agent.adapter !== "claude") {
    throw new Error("Invalid agent adapter.");
  }
  if (agent.surface !== "codex-cli" && agent.surface !== "claude-code-cli") {
    throw new Error("Invalid agent surface.");
  }

  const host = asObject(report.host, "host");
  exactKeys(host, ["runnerId", "os", "arch", "nodeVersion"], "host");
  const target = asObject(report.target, "target");
  exactKeys(target, ["environment", "commitSha", "protocolVersion"], "target");
  if (
    target.environment !== "local" &&
    target.environment !== "lan" &&
    target.environment !== "preview" &&
    target.environment !== "production" &&
    target.environment !== "custom"
  ) {
    throw new Error("Invalid target environment.");
  }
  if (
    typeof target.commitSha !== "string" ||
    !/^[a-f0-9]{40}$/.test(target.commitSha)
  ) {
    throw new Error("Invalid target commit SHA.");
  }

  const result = asObject(report.result, "result");
  const resultKeys = ["status", "stage", "runState", "durationMs"];
  if (result.receiptSha256 !== undefined) resultKeys.push("receiptSha256");
  if (result.errorCode !== undefined) resultKeys.push("errorCode");
  exactKeys(result, resultKeys, "result");
  if (result.status !== "passed" && result.status !== "failed") {
    throw new Error("Invalid result status.");
  }
  if (
    result.stage !== "preflight" &&
    result.stage !== "create" &&
    result.stage !== "agent" &&
    result.stage !== "poll" &&
    result.stage !== "complete"
  ) {
    throw new Error("Invalid result stage.");
  }
  if (
    typeof result.durationMs !== "number" ||
    !Number.isSafeInteger(result.durationMs) ||
    result.durationMs < 0
  ) {
    throw new Error("Invalid result duration.");
  }
  if (
    result.receiptSha256 !== undefined &&
    !isThoughtSha256(result.receiptSha256)
  ) {
    throw new Error("Invalid result receipt hash.");
  }
  if (
    result.errorCode !== undefined &&
    (typeof result.errorCode !== "string" || !SAFE_CODE.test(result.errorCode))
  ) {
    throw new Error("Invalid result error code.");
  }

  return {
    schema: THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
    recordedAt: report.recordedAt,
    agent: {
      adapter: agent.adapter,
      surface: agent.surface,
      toolVersion: safeText(agent.toolVersion, "agent toolVersion"),
      ...(optionalSafeText(agent.model, "agent model")
        ? { model: String(agent.model) }
        : {}),
      ...(optionalSafeText(agent.reasoningEffort, "agent reasoningEffort")
        ? { reasoningEffort: String(agent.reasoningEffort) }
        : {}),
    },
    host: {
      runnerId: safeText(host.runnerId, "host runnerId"),
      os: safeText(host.os, "host os"),
      arch: safeText(host.arch, "host arch"),
      nodeVersion: safeText(host.nodeVersion, "host nodeVersion"),
    },
    target: {
      environment: target.environment,
      commitSha: target.commitSha,
      protocolVersion: safeText(
        target.protocolVersion,
        "target protocolVersion",
      ),
    },
    result: {
      status: result.status,
      stage: result.stage,
      runState: safeText(result.runState, "result runState"),
      durationMs: result.durationMs,
      ...(result.receiptSha256
        ? { receiptSha256: String(result.receiptSha256) }
        : {}),
      ...(result.errorCode ? { errorCode: String(result.errorCode) } : {}),
    },
  };
}

export const serializeThoughtAgentCompatibilityReport = (value: unknown) =>
  `${JSON.stringify(parseThoughtAgentCompatibilityReport(value), null, 2)}\n`;

export async function emitThoughtAgentCompatibilityReport(
  value: unknown,
  reportPath = process.env.THOUGHT_COMPATIBILITY_REPORT_FILE?.trim(),
) {
  const serialized = serializeThoughtAgentCompatibilityReport(value);
  if (reportPath) {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, serialized, { encoding: "utf8", mode: 0o600 });
  }
  process.stdout.write(serialized);
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { arch, homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtClaudeTask,
} from "../packages/thought-agent-protocol/src/index";
import {
  THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  emitThoughtAgentCompatibilityReport,
  type ThoughtAgentCompatibilityReport,
} from "./lib/thought-agent-compatibility-report";
import {
  isClaudeCodeAuthenticated,
  resolveClaudeCodeBinary,
} from "./lib/claude-code-binary";
import { classifyClaudeCodeFailure } from "./lib/claude-code-failure";
import {
  ThoughtAgentCanaryError,
  requiredThoughtAgentLiveTarget,
  validateCurrentThoughtAgentCandidateCheckout,
  validateThoughtAgentLiveTarget,
} from "./lib/thought-agent-live-target";

type CanaryStage = ThoughtAgentCompatibilityReport["result"]["stage"];

const liveTarget = requiredThoughtAgentLiveTarget();
const origin = liveTarget.origin;
const apiBase = `${origin}/api/thought-agent/v2`;
const claudeBin = await resolveClaudeCodeBinary({
  explicitPath: process.env.THOUGHT_CLAUDE_BIN,
  pathValue: process.env.PATH,
  homeDirectory: homedir(),
});
const maxBudgetUsd = process.env.THOUGHT_CLAUDE_MAX_BUDGET_USD?.trim() || "5.00";
const promptLine = "What remains after a signal returns?";
const startedClock = Date.now();
let stage: CanaryStage = "preflight";
let toolVersion = "unknown";
let runState = "not-created";
let browserToken = "";
let runUrl = "";
let receiptSha256: string | undefined;
let model: string | undefined;
let reasoningEffort: string | undefined;

const agentEnvironment = Object.fromEntries(
  ["CLAUDE_CONFIG_DIR", "HOME", "PATH", "SHELL", "TMPDIR", "USER", "LANG", "LC_ALL"]
    .flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []),
) as typeof process.env;

const runProcess = async (
  command: string,
  args: string[],
  options?: {
    input?: string;
    cwd?: string;
    timeoutMs?: number;
    env?: typeof process.env;
  },
) => {
  const child = spawn(command, args, {
    cwd: options?.cwd,
    env: options?.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.stdin.end(options?.input ?? "");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const exitCode = await Promise.race([
      new Promise<number | null>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new ThoughtAgentCanaryError("AGENT_TIMEOUT", "Claude Code canary timed out."));
        }, options?.timeoutMs ?? 30_000);
      }),
    ]);
    return { exitCode, stdout, stderr };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: T & { error?: { code?: string } };
  try {
    payload = JSON.parse(text) as T & { error?: { code?: string } };
  } catch {
    throw new ThoughtAgentCanaryError("NON_JSON_RESPONSE", "THOUGHT returned a non-JSON response.");
  }
  if (!response.ok) {
    throw new ThoughtAgentCanaryError(
      payload.error?.code || `HTTP_${response.status}`,
      "THOUGHT rejected the canary request.",
    );
  }
  return payload;
};

const report = (
  status: "passed" | "failed",
  errorCode?: string,
) => ({
  schema: THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  recordedAt: new Date().toISOString(),
  agent: {
    adapter: "claude",
    surface: "claude-code-cli",
    toolVersion,
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  },
  host: {
    runnerId: liveTarget.runnerId,
    os: platform(),
    arch: arch(),
    nodeVersion: process.version,
  },
  target: {
    environment: "preview",
    commitSha: liveTarget.expectedCommitSha,
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
  },
  result: {
    status,
    stage: status === "passed" ? "complete" : stage,
    runState,
    durationMs: Date.now() - startedClock,
    ...(receiptSha256 ? { receiptSha256 } : {}),
    ...(errorCode ? { errorCode } : {}),
  },
});

let terminal = false;
let testRoot = "";

try {
  await validateCurrentThoughtAgentCandidateCheckout(liveTarget);
  await validateThoughtAgentLiveTarget(liveTarget);
  if (!claudeBin) {
    throw new ThoughtAgentCanaryError(
      "CLAUDE_NOT_AVAILABLE",
      "Claude Code was not found on PATH or in Claude Desktop's managed native installation.",
    );
  }
  let versionResult: Awaited<ReturnType<typeof runProcess>>;
  try {
    versionResult = await runProcess(claudeBin, ["--version"], {
      env: agentEnvironment,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new ThoughtAgentCanaryError(
        "CLAUDE_NOT_AVAILABLE",
        "Claude Code is not installed on this host.",
      );
    }
    throw error;
  }
  if (versionResult.exitCode !== 0) {
    throw new ThoughtAgentCanaryError("CLAUDE_NOT_AVAILABLE", "Claude Code is not available.");
  }
  toolVersion = versionResult.stdout.match(/\d+\.\d+\.\d+/)?.[0] || "unknown";

  const authResult = await runProcess(claudeBin, ["auth", "status"], {
    env: agentEnvironment,
  });
  if (
    authResult.exitCode !== 0 ||
    !isClaudeCodeAuthenticated(authResult.stdout)
  ) {
    throw new ThoughtAgentCanaryError("CLAUDE_AUTH_REQUIRED", "Claude Code is not authenticated.");
  }

  stage = "create";
  const created = await requestJson<{
    runId: string;
    browserToken: string;
    statusUrl: string;
    launchUri: string;
    release?: {
      protocolReleaseId: `0x${string}`;
      manifestKeccak256: `0x${string}`;
    };
    resultContract?: {
      workProfile: string;
      lineValidation: "terminal-english-64";
      declarationLabelField?: "agentLabel" | "label";
    };
    controlContract?: {
      schema?: string;
      mode?: string;
      claimCreativeInput?: string;
      creativeInputEndpoint?: string;
    };
  }>(`${apiBase}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine,
      specId:
        process.env.THOUGHT_LIVE_SPEC_ID ||
        THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      requestedAgent: { adapterId: "claude", model: null },
      client: { surface: "thought-claude-code-live-canary", appVersion: "1" },
    }),
  });
  assert.match(created.runId, /^tar_[A-Za-z0-9_-]+$/);
  if (
    !created.release ||
    !created.resultContract ||
    created.controlContract?.mode !== "bounded-preflight" ||
    created.controlContract.claimCreativeInput !== "sealed-absent" ||
    created.controlContract.creativeInputEndpoint !== "start"
  ) {
    throw new ThoughtAgentCanaryError(
      "TARGET_NOT_QUALIFIED",
      "Target does not expose the qualified bounded Agent contract.",
    );
  }
  browserToken = created.browserToken;
  runUrl = new URL(created.statusUrl, origin).toString().replace(/\/+$/g, "");
  const launchToken = new URL(created.launchUri).searchParams.get("token") || "";
  if (!launchToken) {
    throw new ThoughtAgentCanaryError("LAUNCH_TOKEN_MISSING", "THOUGHT omitted the launch credential.");
  }
  runState = "created";

  const task = [
    buildThoughtClaudeTask({
      product: "Claude",
      surface: "code",
      runId: created.runId,
      runUrl,
      launchToken,
      networkAuthorization: "preauthorized",
      release: created.release,
      resultContract: created.resultContract,
    }),
    "",
    "Live canary authority:",
    "- The operator manually started this paid compatibility canary and explicitly approved its exact staging App exchange for this run.",
    "- That approval is current and satisfies the connection confirmation. Proceed without asking for another approval.",
  ].join("\n");

  stage = "agent";
  testRoot = await mkdtemp(join(tmpdir(), "inshell-thought-claude-live-"));
  const claudeSettings = JSON.stringify({
    permissions: {
      allow: ["Bash"],
    },
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      filesystem: {
        denyRead: ["~/"],
        allowRead: [testRoot],
      },
      network: {
        allowedDomains: [new URL(origin).hostname],
        strictAllowlist: true,
      },
    },
  });
  const claudeResult = await runProcess(
    claudeBin,
    [
      "-p",
      "--safe-mode",
      "--no-session-persistence",
      "--input-format",
      "text",
      "--output-format",
      "json",
      "--max-turns",
      "12",
      "--max-budget-usd",
      maxBudgetUsd,
      "--tools",
      "Bash",
      "--allowedTools",
      "Bash",
      "--permission-mode",
      "auto",
      "--settings",
      claudeSettings,
    ],
    {
      input: task,
      cwd: testRoot,
      timeoutMs: 8 * 60 * 1000,
      env: agentEnvironment,
    },
  );
  if (claudeResult.exitCode !== 0) {
    throw new ThoughtAgentCanaryError(
      classifyClaudeCodeFailure(claudeResult.stdout, claudeResult.stderr),
      "Claude Code did not finish the run.",
    );
  }

  stage = "poll";
  const status = await requestJson<{
    state: string;
    result?: {
      receipt?: {
        receiptSha256?: string;
        model?: string | null;
        reasoningEffort?: string | null;
      };
    };
    error?: { code?: string };
  }>(runUrl, {
    headers: { authorization: `Bearer ${browserToken}` },
  });
  runState = status.state;
  if (status.state !== "returned") {
    throw new ThoughtAgentCanaryError(
      status.error?.code || "RUN_NOT_RETURNED",
      "Claude Code did not return a THOUGHT result.",
    );
  }
  receiptSha256 = status.result?.receipt?.receiptSha256;
  if (!receiptSha256) {
    throw new ThoughtAgentCanaryError("RECEIPT_MISSING", "THOUGHT omitted the returned receipt.");
  }
  model = status.result?.receipt?.model || undefined;
  reasoningEffort = status.result?.receipt?.reasoningEffort || undefined;
  terminal = true;
  await emitThoughtAgentCompatibilityReport(report("passed"));
} catch (error) {
  if (runUrl && browserToken && !terminal) {
    await fetch(`${runUrl}/cancel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${browserToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION }),
    }).catch(() => undefined);
  }
  const errorCode = error instanceof ThoughtAgentCanaryError ? error.code : "CANARY_FAILED";
  await emitThoughtAgentCompatibilityReport(report("failed", errorCode));
  process.exitCode = 1;
} finally {
  if (testRoot) await rm(testRoot, { recursive: true, force: true });
}

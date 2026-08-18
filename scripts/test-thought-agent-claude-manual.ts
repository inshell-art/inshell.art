import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { open, readFile, unlink } from "node:fs/promises";
import { arch, homedir, platform } from "node:os";
import { isAbsolute } from "node:path";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtClaudeTask,
} from "../packages/thought-agent-protocol/src/index";
import {
  THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  emitThoughtAgentCompatibilityReport,
} from "./lib/thought-agent-compatibility-report";
import {
  isClaudeCodeAuthenticated,
  resolveClaudeCodeBinary,
} from "./lib/claude-code-binary";
import {
  ThoughtAgentCanaryError,
  requiredThoughtAgentLiveTarget,
  validateCurrentThoughtAgentCandidateCheckout,
  validateThoughtAgentLiveTarget,
} from "./lib/thought-agent-live-target";

const MANUAL_STATE_SCHEMA = "inshell.thought.claude-manual-canary-state.v1";
const MAX_STATE_AGE_MS = 30 * 60 * 1000;
const mode = process.argv[2];
const statePath = process.env.THOUGHT_CLAUDE_MANUAL_STATE_FILE?.trim();
if (!statePath || !isAbsolute(statePath)) {
  throw new Error("THOUGHT_CLAUDE_MANUAL_STATE_FILE must be an absolute path.");
}
if (mode !== "prepare" && mode !== "collect" && mode !== "cancel") {
  throw new Error("Usage: test-thought-agent-claude-manual.ts <prepare|collect|cancel>");
}

const target = requiredThoughtAgentLiveTarget();
const origin = target.origin;
const apiBase = `${origin}/api/thought-agent/v2`;

type ManualState = {
  schema: typeof MANUAL_STATE_SCHEMA;
  createdAt: string;
  origin: string;
  expectedCommitSha: string;
  runnerId: string;
  runUrl: string;
  browserToken: string;
  clipboardSha256: string;
  toolVersion: string;
};

const runProcess = async (command: string, args: string[], input = "") => {
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stdin.end(input);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { exitCode, stdout };
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
      "THOUGHT rejected the manual canary request.",
    );
  }
  return payload;
};

const readState = async () => {
  const parsed = JSON.parse(await readFile(statePath, "utf8")) as ManualState;
  if (
    parsed.schema !== MANUAL_STATE_SCHEMA ||
    parsed.origin !== origin ||
    parsed.expectedCommitSha !== target.expectedCommitSha ||
    parsed.runnerId !== target.runnerId ||
    !parsed.runUrl.startsWith(`${origin}/api/thought-agent/v2/runs/`) ||
    !parsed.browserToken ||
    !/^[a-f0-9]{64}$/.test(parsed.clipboardSha256) ||
    Date.now() - Date.parse(parsed.createdAt) > MAX_STATE_AGE_MS
  ) {
    throw new ThoughtAgentCanaryError("MANUAL_STATE_INVALID", "Manual Claude canary state is invalid or expired.");
  }
  return parsed;
};

const clearClipboardIfUnchanged = async (state: ManualState) => {
  const clipboard = await runProcess("pbpaste", []);
  if (
    clipboard.exitCode === 0 &&
    createHash("sha256").update(clipboard.stdout).digest("hex") === state.clipboardSha256
  ) {
    await runProcess("pbcopy", [], "");
  }
};

if (mode === "prepare") {
  await validateCurrentThoughtAgentCandidateCheckout(target);
  await validateThoughtAgentLiveTarget(target);
  const claudeBin = await resolveClaudeCodeBinary({
    explicitPath: process.env.THOUGHT_CLAUDE_BIN,
    pathValue: process.env.PATH,
    homeDirectory: homedir(),
  });
  if (!claudeBin) throw new ThoughtAgentCanaryError("CLAUDE_NOT_AVAILABLE", "Claude Code is not installed.");
  const version = await runProcess(claudeBin, ["--version"]);
  const auth = await runProcess(claudeBin, ["auth", "status"]);
  if (version.exitCode !== 0 || auth.exitCode !== 0 || !isClaudeCodeAuthenticated(auth.stdout)) {
    throw new ThoughtAgentCanaryError("CLAUDE_AUTH_REQUIRED", "Claude Code is not authenticated.");
  }
  const toolVersion = version.stdout.match(/\d+\.\d+\.\d+/)?.[0] || "unknown";
  const created = await requestJson<{
    runId: string;
    browserToken: string;
    statusUrl: string;
    launchUri: string;
    release?: { protocolReleaseId: `0x${string}`; manifestKeccak256: `0x${string}` };
    resultContract?: {
      workProfile: string;
      lineValidation: "terminal-english-64";
      declarationLabelField?: "agentLabel" | "label";
    };
    controlContract?: { mode?: string; claimCreativeInput?: string; creativeInputEndpoint?: string };
  }>(`${apiBase}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine: "What remains after a signal returns?",
      specId: process.env.THOUGHT_LIVE_SPEC_ID || THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      requestedAgent: { adapterId: "claude", model: null },
      client: { surface: "thought-claude-code-manual-canary", appVersion: "1" },
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
    throw new ThoughtAgentCanaryError("TARGET_NOT_QUALIFIED", "Target lacks the qualified bounded Agent contract.");
  }
  const launchToken = new URL(created.launchUri).searchParams.get("token") || "";
  if (!launchToken) throw new ThoughtAgentCanaryError("LAUNCH_TOKEN_MISSING", "THOUGHT omitted the launch credential.");
  const runUrl = new URL(created.statusUrl, origin).toString().replace(/\/+$/g, "");
  const task = buildThoughtClaudeTask({
    product: "Claude",
    surface: "code",
    runId: created.runId,
    runUrl,
    launchToken,
    networkAuthorization: "managed",
    release: created.release,
    resultContract: created.resultContract,
  });
  const copied = await runProcess("pbcopy", [], task);
  if (copied.exitCode !== 0) throw new Error("Could not copy the manual canary handoff.");
  const state: ManualState = {
    schema: MANUAL_STATE_SCHEMA,
    createdAt: new Date().toISOString(),
    origin,
    expectedCommitSha: target.expectedCommitSha,
    runnerId: target.runnerId,
    runUrl,
    browserToken: created.browserToken,
    clipboardSha256: createHash("sha256").update(task).digest("hex"),
    toolVersion,
  };
  const handle = await open(statePath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  process.stdout.write(`${JSON.stringify({
    status: "prepared",
    runnerId: target.runnerId,
    toolVersion,
    expiresInMinutes: MAX_STATE_AGE_MS / 60_000,
    next: "Open Claude Code, paste the clipboard handoff, approve only the staging connection, and wait for its receipt.",
  }, null, 2)}\n`);
} else {
  const state = await readState();
  if (mode === "cancel") {
    await fetch(`${state.runUrl}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${state.browserToken}`, "content-type": "application/json" },
      body: JSON.stringify({ protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION }),
    }).catch(() => undefined);
    await clearClipboardIfUnchanged(state);
    await unlink(statePath);
    process.stdout.write('{"status":"cancelled"}\n');
  } else {
    await validateCurrentThoughtAgentCandidateCheckout(target);
    await validateThoughtAgentLiveTarget(target);
    const status = await requestJson<{
      state: string;
      result?: { receipt?: { receiptSha256?: string; model?: string | null; reasoningEffort?: string | null } };
      error?: { code?: string };
    }>(state.runUrl, { headers: { authorization: `Bearer ${state.browserToken}` } });
    if (status.state !== "returned") {
      throw new ThoughtAgentCanaryError(
        status.error?.code || "MANUAL_CANARY_PENDING",
        `Manual Claude canary is ${status.state}; leave the state file in place and collect after Claude finishes.`,
      );
    }
    const receiptSha256 = status.result?.receipt?.receiptSha256;
    if (!receiptSha256) throw new ThoughtAgentCanaryError("RECEIPT_MISSING", "THOUGHT omitted the receipt.");
    await emitThoughtAgentCompatibilityReport({
      schema: THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
      recordedAt: new Date().toISOString(),
      agent: {
        adapter: "claude",
        surface: "claude-code-cli",
        toolVersion: state.toolVersion,
        ...(status.result?.receipt?.model ? { model: status.result.receipt.model } : {}),
        ...(status.result?.receipt?.reasoningEffort
          ? { reasoningEffort: status.result.receipt.reasoningEffort }
          : {}),
      },
      host: {
        runnerId: target.runnerId,
        os: platform(),
        arch: arch(),
        nodeVersion: process.version,
      },
      target: {
        environment: "preview",
        commitSha: target.expectedCommitSha,
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      },
      result: {
        status: "passed",
        stage: "complete",
        runState: "returned",
        durationMs: Date.now() - Date.parse(state.createdAt),
        receiptSha256,
      },
    });
    await clearClipboardIfUnchanged(state);
    await unlink(statePath);
  }
}

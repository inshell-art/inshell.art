import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  buildThoughtCodexTask,
} from "../packages/thought-agent-protocol/src/index";
import {
  buildThoughtV2LocalRelease,
  type ThoughtV2LocalRuntimeAddresses,
} from "../apps/thought/src/thought-v2-local-release";

const origin = (process.env.THOUGHT_LIVE_ORIGIN || "http://127.0.0.1:5173").replace(/\/+$/g, "");
const apiBase = `${origin}/api/thought-agent/v2`;
const promptLine = "Who are you?";
const codexNetworkMode =
  process.env.THOUGHT_CODEX_LIVE_NETWORK_MODE === "managed"
    ? "managed"
    : "preauthorized";
const localRuntime = JSON.parse(await readFile(
  new URL("../apps/thought/evm/addresses.anvil.json", import.meta.url),
  "utf8",
)) as ThoughtV2LocalRuntimeAddresses;
const liveRelease = buildThoughtV2LocalRelease(localRuntime);

const requestJson = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const payload = await response.json() as T & { error?: { code?: string; message?: string } };
  assert.equal(
    response.ok,
    true,
    `${response.status} ${payload.error?.code ?? "HTTP_ERROR"}: ${payload.error?.message ?? "request failed"}`,
  );
  return payload;
};

const created = await requestJson<{
  runId: string;
  browserToken: string;
  statusUrl: string;
  launchUri: string;
}>(`${apiBase}/runs`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin,
  },
  body: JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    promptLine,
    specId: liveRelease.spec.evmSpecId,
    requestedAgent: { adapterId: "codex", model: null },
    client: { surface: "thought-codex-live-test", appVersion: "test" },
    devAutoRun: false,
  }),
});

assert.match(created.runId, /^tar_[A-Za-z0-9_-]+$/);
const launchToken = new URL(created.launchUri).searchParams.get("token") ?? "";
assert.notEqual(launchToken, "");
const runUrl = new URL(created.statusUrl, origin).toString().replace(/\/+$/g, "");
const task = buildThoughtCodexTask({
  product: "Codex",
  runId: created.runId,
  promptLine,
  runUrl,
  launchToken,
  networkAuthorization:
    codexNetworkMode === "preauthorized" ? "preauthorized" : "managed",
  release: {
    protocolReleaseId: liveRelease.protocol.protocolReleaseId,
    manifestKeccak256: liveRelease.protocol.manifestKeccak256,
  },
  resultContract: {
    workProfile: liveRelease.protocol.workProfile.id,
    lineValidation: "terminal-english-64",
  },
});

const testRoot = await mkdtemp(join(tmpdir(), "inshell-thought-codex-live-"));
const finalMessageFile = join(testRoot, "final.txt");
let stdout = "";
let stderr = "";

try {
  const codexArgs = [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--sandbox",
    "workspace-write",
    "-C",
    testRoot,
    "--output-last-message",
    finalMessageFile,
    "-",
  ];
  if (codexNetworkMode === "preauthorized") {
    codexArgs.splice(
      codexArgs.indexOf("-C"),
      0,
      "-c",
      "sandbox_workspace_write.network_access=true",
    );
  }
  const child = spawn("codex", codexArgs, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(task);
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const exitCode = await Promise.race([
    new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    }),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Live Codex task test timed out."));
      }, 8 * 60 * 1000);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });

  const redact = (value: string) => value
    .replaceAll(launchToken, "<redacted-launch-token>")
    .replace(/Bearer [A-Za-z0-9_-]+/g, "Bearer <redacted>");
  assert.equal(exitCode, 0, redact(stderr || stdout));
  const finalMessage = await readFile(finalMessageFile, "utf8");
  assert.match(
    finalMessage,
    /^Return to the THOUGHT browser tab\. It is polling this run and will show the preview automatically\.\nReceipt: sha256:[a-f0-9]{64}\s*$/,
  );

  const status = await requestJson<{
    state: string;
    result?: {
      agentLine?: string;
      receipt?: {
        receiptSha256?: string;
        model?: string | null;
        reasoningEffort?: string | null;
        metadataSource?: string | null;
      };
    };
  }>(runUrl, {
    headers: { Authorization: `Bearer ${created.browserToken}` },
  });
  assert.equal(status.state, "returned");
  assert.equal(typeof status.result?.agentLine, "string");
  assert.match(status.result?.receipt?.receiptSha256 ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(status.result?.receipt?.model, "unknown");
  assert.match(status.result?.receipt?.model ?? "", /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  assert.match(
    status.result?.receipt?.reasoningEffort ?? "",
    /^(none|minimal|low|medium|high|xhigh|max|ultra)$/,
  );
  assert.equal(status.result?.receipt?.metadataSource, "reported");

  console.log(JSON.stringify({
    runId: created.runId,
    state: status.state,
    receipt: status.result?.receipt?.receiptSha256,
    model: status.result?.receipt?.model,
    reasoningEffort: status.result?.receipt?.reasoningEffort,
    metadataSource: status.result?.receipt?.metadataSource,
    taskTransport: "direct-json-curl",
    downloadedCodeExecuted: false,
    codexNetworkMode,
  }, null, 2));
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

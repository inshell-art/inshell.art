import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_V2_PROTOCOL_RELEASE,
} from "../packages/thought-agent-protocol/src/index";

const origin = (process.env.THOUGHT_LIVE_ORIGIN || "http://127.0.0.1:5173").replace(/\/+$/g, "");
const apiBase = `${origin}/api/thought-agent/v2`;

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
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    promptLine: "live client handshake",
    specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
    requestedAgent: { adapterId: "codex", model: null },
    client: { surface: "thought-client-live-test", appVersion: "test" },
    devAutoRun: false,
  }),
});

assert.match(created.runId, /^tar_/);
const runUrl = new URL(created.statusUrl, origin).toString();
const launchToken = new URL(created.launchUri).searchParams.get("token") ?? "";
assert.notEqual(launchToken, "");
const clientResponse = await fetch(`${apiBase}/client`);
assert.equal(clientResponse.status, 200);
assert.match(clientResponse.headers.get("content-type") ?? "", /^text\/plain/);
const clientScript = await clientResponse.text();
assert(clientScript.includes("THOUGHT_INPUT_READY"));
assert(clientScript.includes("THOUGHT_RESULT_OK"));

const child = spawn("/bin/zsh", ["-c", clientScript], {
  env: { ...process.env, THOUGHT_RUN_URL: runUrl, THOUGHT_LAUNCH_TOKEN: launchToken },
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let candidateSent = false;

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
  if (!candidateSent && stdout.includes("THOUGHT_INPUT_READY")) {
    candidateSent = true;
    child.stdin.write(`${JSON.stringify({
      schema: THOUGHT_AGENT_RESULT_VERSION,
      agentLine: "live handshake returned",
    })}\n`);
  }
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
      reject(new Error("Live THOUGHT client test timed out."));
    }, 15_000);
  }),
]).finally(() => {
  if (timeout) clearTimeout(timeout);
});

assert.equal(exitCode, 0, stderr || stdout);
assert.equal(candidateSent, true);
assert(stdout.includes("THOUGHT_RESULT_OK"));
assert.match(stdout, /Receipt: sha256:[a-f0-9]{64}/);

const finalStatus = await requestJson<{
  state: string;
  result?: { agentLine?: string; receipt?: { receiptSha256?: string } };
}>(runUrl, {
  headers: { Authorization: `Bearer ${created.browserToken}` },
});
assert.equal(finalStatus.state, "returned");
assert.equal(finalStatus.result?.agentLine, "live handshake returned");
assert.match(finalStatus.result?.receipt?.receiptSha256 ?? "", /^sha256:[a-f0-9]{64}$/);

console.log(`THOUGHT live client handshake passed for ${created.runId}.`);

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import {
  THOUGHT_AGENT_CLAIM_TTL_MS,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  sha256Hex,
} from "../packages/thought-agent-protocol/src/index";
import { buildThoughtV2LocalAgentResult } from "../apps/thought/src/thought-v2-local-agent";
import {
  buildThoughtV2LocalRelease,
  type ThoughtV2LocalRuntimeAddresses,
} from "../apps/thought/src/thought-v2-local-release";

const origin = (process.env.THOUGHT_LIVE_ORIGIN || "http://127.0.0.1:5173").replace(/\/+$/g, "");
const apiBase = `${origin}/api/thought-agent/v2`;
const promptLine = `Who are you? / App & Agent`;
const agentLine = "I am Codex.";
const reviewDelayMs = Number(process.env.THOUGHT_LIVE_REVIEW_DELAY_MS || 0);
const creativeSpecText = await readFile(
  new URL("../apps/thought/spec/THOUGHT.v2.md", import.meta.url),
  "utf8",
);
const creativeSpecLock = JSON.parse(await readFile(
  new URL("../apps/thought/spec/THOUGHT.v2.lock.json", import.meta.url),
  "utf8",
)) as {
  artifactId: string;
  artifact: {
    name: string;
    sha256: string;
    thoughtSpecHash: string;
    thoughtSpecId: string;
  };
};
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
  client: {
    url: string;
    sha256: string;
  };
  createdAt: string;
  claimExpiresAt: string;
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
    client: { surface: "thought-client-live-test", appVersion: "test" },
    devAutoRun: false,
  }),
});

assert.match(created.runId, /^tar_/);
const issuedClaimWindowMs =
  Date.parse(created.claimExpiresAt) - Date.parse(created.createdAt);
assert(
  issuedClaimWindowMs >= THOUGHT_AGENT_CLAIM_TTL_MS,
  `Claim window ${issuedClaimWindowMs}ms is shorter than the reviewed-client policy.`,
);
const runUrl = new URL(created.statusUrl, origin).toString();
const launchToken = new URL(created.launchUri).searchParams.get("token") ?? "";
assert.notEqual(launchToken, "");
assert.equal(new URL(created.client.url).origin, new URL(origin).origin);
assert.equal(new URL(created.client.url).pathname, "/api/thought-agent/v2/client");
const clientResponse = await fetch(created.client.url, { cache: "no-store" });
assert.equal(clientResponse.status, 200);
assert.match(clientResponse.headers.get("content-type") ?? "", /^text\/plain/);
const clientScript = await clientResponse.text();
assert.equal(await sha256Hex(clientScript), created.client.sha256);
assert(clientScript.includes("THOUGHT_INPUT_READY"));
assert(clientScript.includes("THOUGHT_RESULT_OK"));

if (reviewDelayMs > 0) {
  await new Promise((resolve) => setTimeout(resolve, reviewDelayMs));
}

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
    child.stdin.write(`${JSON.stringify(
      buildThoughtV2LocalAgentResult(agentLine, "Codex", liveRelease),
    )}\n`);
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
assert(stdout.includes(`THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN\n${creativeSpecText}\nTHOUGHT_VERIFIED_INSTRUCTIONS_END`));
assert(stdout.includes(`THOUGHT_VERIFIED_PROMPT_BEGIN\n${promptLine}\nTHOUGHT_VERIFIED_PROMPT_END`));
assert(stdout.includes(
  `Agent line work profile: ${liveRelease.protocol.workProfile.id}`,
));
assert(stdout.includes("Agent line UTF-8 bytes: 1-64"));
assert(stdout.includes("Agent line characters: closed 76-character Terminal English repertoire."));
assert(stdout.includes("Agent line spacing: single internal U+0020 spaces only."));
assert(stdout.includes("THOUGHT_RESULT_OK"));
assert.match(stdout, /Receipt: sha256:[a-f0-9]{64}/);

const finalStatus = await requestJson<{
  state: string;
  request?: {
    promptLine?: { text?: string; sha256?: string };
    agentInput?: { mediaType?: string; text?: string; sha256?: string };
    thoughtSpec?: {
      id?: string;
      ref?: string;
      sha256?: string;
      contractSpecHash?: string;
    };
  };
  result?: { agentLine?: string; receipt?: { receiptSha256?: string } };
}>(runUrl, {
  headers: { Authorization: `Bearer ${created.browserToken}` },
});
assert.equal(finalStatus.state, "returned");
assert.equal(finalStatus.request?.promptLine?.text, promptLine);
assert.equal(finalStatus.request?.promptLine?.sha256, await sha256Hex(promptLine));
assert.deepEqual(finalStatus.request?.agentInput, {
  mediaType: "text/plain; charset=utf-8",
  text: promptLine,
  sha256: await sha256Hex(promptLine),
});
assert.deepEqual(finalStatus.request?.thoughtSpec, {
  id: creativeSpecLock.artifact.thoughtSpecId,
  ref: `app://thought/creative-spec/${creativeSpecLock.artifactId}/${creativeSpecLock.artifact.name}`,
  sha256: `sha256:${creativeSpecLock.artifact.sha256}`,
  contractSpecHash: creativeSpecLock.artifact.thoughtSpecHash,
});
assert.equal(finalStatus.result?.agentLine, agentLine);
assert.match(finalStatus.result?.receipt?.receiptSha256 ?? "", /^sha256:[a-f0-9]{64}$/);

console.log(JSON.stringify({
  runId: created.runId,
  promptLine,
  agentLine,
  thoughtSpecHash: creativeSpecLock.artifact.thoughtSpecHash,
  protocolReleaseId: liveRelease.protocol.protocolReleaseId,
  manifestKeccak256: liveRelease.protocol.manifestKeccak256,
  receipt: finalStatus.result?.receipt?.receiptSha256,
  reviewDelayMs,
  issuedClaimWindowMs,
  state: finalStatus.state,
}, null, 2));

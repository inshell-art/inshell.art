import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

import {
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  buildThoughtCodexClientScript,
  buildThoughtCodexTask,
  type ThoughtCodexReleaseBinding,
} from "../packages/thought-agent-protocol/src/index";

const launchToken = "test-launch-token-must-stay-private";
const bridgeToken = "test-bridge-token-must-stay-private";
const receiptSha256 = `sha256:${"a".repeat(64)}`;
const requestOrder: string[] = [];
let invocationId = "";
let startedAt = "";
let rejectResult = false;
let reportedFailure: Record<string, unknown> | null = null;
let activeRelease: ThoughtCodexReleaseBinding | undefined;
let activeCandidate: Record<string, unknown> = {
  schema: THOUGHT_AGENT_RESULT_VERSION,
  agentLine: "quiet signal",
};

const sha256 = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const readRequestBody = async (request: import("node:http").IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (response: import("node:http").ServerResponse, statusCode: number, body: unknown) => {
  response.statusCode = statusCode;
  response.setHeader("connection", "close");
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
};

const server = createServer(async (request, response) => {
  const body = await readRequestBody(request);
  const authorization = String(request.headers.authorization ?? "");

  if (request.url === "/run/claim" && request.method === "POST") {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.equal(authorization, `Bearer ${launchToken}`);
    requestOrder.push("claim");

    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "claimed",
      bridgeToken,
      request: {
        instructions: { text: "Return one exact agent line." },
        promptLine: { text: "hello world?" },
        outputContract: {
          agentLine: {
            workProfile: THOUGHT_AGENT_LINE_CONTRACT.workProfile,
            minUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes,
            maxUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes,
            normalization: THOUGHT_AGENT_LINE_CONTRACT.normalization,
            displayUnitsAreAcceptanceLimits:
              THOUGHT_AGENT_LINE_CONTRACT.displayUnitsAreAcceptanceLimits,
          },
          ...(activeRelease ? { release: activeRelease } : {}),
        },
      },
    });
    return;
  }

  if (request.url === "/run/start" && request.method === "POST") {
    requestOrder.push("start");
    assert.equal(authorization, `Bearer ${bridgeToken}`);
    const parsed = JSON.parse(body) as { protocolVersion: string; invocationId: string; startedAt: string };
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.match(parsed.invocationId, /^tai_[a-f0-9]{24}$/);
    assert.match(parsed.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    invocationId = parsed.invocationId;
    startedAt = parsed.startedAt;
    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "running",
      invocationId,
      startedAt,
    });
    return;
  }

  if (request.url === "/run/result" && request.method === "PUT") {
    requestOrder.push("result");
    assert.equal(authorization, `Bearer ${bridgeToken}`);
    assert.equal(request.headers["idempotency-key"], invocationId);
    const parsed = JSON.parse(body) as {
      protocolVersion: string;
      invocationId: string;
      startedAt: string;
      output: {
        raw: string;
        rawSha256: string;
        agentLine: string;
        agentLineSha256: string;
      };
    };
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.equal(parsed.invocationId, invocationId);
    assert.equal(parsed.startedAt, startedAt);
    assert.equal(parsed.output.raw, JSON.stringify(activeCandidate));
    assert.equal(parsed.output.rawSha256, sha256(parsed.output.raw));
    assert.equal(parsed.output.agentLine, activeCandidate.agentLine);
    assert.equal(parsed.output.agentLineSha256, sha256(parsed.output.agentLine));
    if (rejectResult) {
      sendJson(response, 400, {
        error: {
          code: "AGENT_OUTPUT_SCHEMA_INVALID",
          message: "Agent line exceeds the 64-byte limit.",
        },
      });
      return;
    }
    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "returned",
      result: {
        agentLine: parsed.output.agentLine,
        receipt: { receiptSha256 },
      },
    });
    return;
  }

  if (request.url === "/run/fail" && request.method === "POST") {
    requestOrder.push("fail");
    assert.equal(authorization, `Bearer ${bridgeToken}`);
    const parsed = JSON.parse(body) as Record<string, unknown>;
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.equal(parsed.invocationId, invocationId);
    assert.deepEqual(parsed.error, {
      code: "AGENT_OUTPUT_SCHEMA_INVALID",
      message: "HTTP 400 AGENT_OUTPUT_SCHEMA_INVALID: Agent line exceeds the 64-byte limit.",
    });
    reportedFailure = parsed;
    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "failed",
      error: parsed.error,
    });
    return;
  }

  sendJson(response, 404, { error: { code: "NOT_FOUND", message: "not found" } });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const runUrl = `http://127.0.0.1:${address.port}/run`;
const clientUrl = `http://127.0.0.1:${address.port}/client`;

const task = buildThoughtCodexTask({
  product: "Codex",
  runId: "tar_test_run",
  promptLine: "hello world?",
  runUrl,
  clientUrl,
  launchToken,
});
assert(task.includes(`THOUGHT_RUN_URL='${runUrl}' THOUGHT_LAUNCH_TOKEN='${launchToken}' /bin/zsh -c "$(curl -fsS '${clientUrl}')"`));
assert(task.includes("same shell session"));
assert(task.includes("THOUGHT_INPUT_READY"));
assert(task.includes("THOUGHT_RESULT_OK"));
assert(task.includes("UTF-8 bytes"));
assert(task.includes("Display units are renderer measurements only, not an acceptance limit."));
assert(task.includes("old 162-display-unit limit"));
assert(!task.includes("approval code"));
assert(!task.includes("bridgeToken"));

const localRelease: ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${"1".repeat(64)}`,
  manifestKeccak256: `0x${"2".repeat(64)}`,
};
const localCandidate = {
  schema: THOUGHT_AGENT_RESULT_VERSION,
  release: localRelease,
  agentLine: "release-bound signal",
};
const localTask = buildThoughtCodexTask({
  product: "Codex",
  runId: "tar_local_v2",
  promptLine: "hello local V2?",
  runUrl,
  clientUrl,
  launchToken,
  release: localRelease,
});
assert(localTask.includes(localRelease.protocolReleaseId));
assert(localTask.includes(localRelease.manifestKeccak256));
assert(localTask.includes("inshell.thought.agent-declaration.v1"));

const runClient = async (options?: {
  release?: ThoughtCodexReleaseBinding;
  candidate?: Record<string, unknown>;
}) => {
  activeRelease = options?.release;
  activeCandidate = options?.candidate ?? {
    schema: THOUGHT_AGENT_RESULT_VERSION,
    agentLine: "quiet signal",
  };
  const child = spawn("/bin/zsh", ["-c", buildThoughtCodexClientScript(
    activeRelease ? { release: activeRelease } : undefined,
  )], {
    env: {
      ...process.env,
      THOUGHT_RUN_URL: runUrl,
      THOUGHT_LAUNCH_TOKEN: launchToken,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let sentCandidate = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
    if (!sentCandidate && stdout.includes("THOUGHT_INPUT_READY")) {
      sentCandidate = true;
      child.stdin.write(`${JSON.stringify(activeCandidate)}\n`);
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
        reject(new Error("THOUGHT Codex client test timed out."));
      }, 10_000);
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });

  return { exitCode, sentCandidate, stderr, stdout };
};

const success = await runClient();

assert.equal(success.exitCode, 0, success.stderr || success.stdout);
assert.equal(success.sentCandidate, true);
assert.deepEqual(requestOrder, ["claim", "start", "result"]);
assert(success.stdout.includes("THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN"));
assert(success.stdout.includes("Return one exact agent line."));
assert(success.stdout.includes("THOUGHT_VERIFIED_PROMPT_BEGIN"));
assert(success.stdout.includes("hello world?"));
assert(success.stdout.includes("THOUGHT_INPUT_READY"));
assert(success.stdout.includes("THOUGHT_RESULT_OK"));
assert(success.stdout.includes(`Receipt: ${receiptSha256}`));
assert(!success.stdout.includes(launchToken));
assert(!success.stdout.includes(bridgeToken));
assert(!success.stderr.includes(launchToken));
assert(!success.stderr.includes(bridgeToken));

requestOrder.length = 0;
reportedFailure = null;
rejectResult = true;
invocationId = "";
startedAt = "";

const rejected = await runClient();

assert.equal(rejected.exitCode, 1);
assert.equal(rejected.sentCandidate, true);
assert.deepEqual(requestOrder, ["claim", "start", "result", "fail"]);
assert(reportedFailure);
assert(rejected.stderr.includes("THOUGHT_CLIENT_ERROR HTTP 400 AGENT_OUTPUT_SCHEMA_INVALID"));
assert(!rejected.stdout.includes("THOUGHT_RESULT_OK"));
assert(!rejected.stdout.includes(launchToken));
assert(!rejected.stdout.includes(bridgeToken));
assert(!rejected.stderr.includes(launchToken));
assert(!rejected.stderr.includes(bridgeToken));

requestOrder.length = 0;
reportedFailure = null;
rejectResult = false;
invocationId = "";
startedAt = "";

const localSuccess = await runClient({
  release: localRelease,
  candidate: localCandidate,
});

assert.equal(localSuccess.exitCode, 0, localSuccess.stderr || localSuccess.stdout);
assert.equal(localSuccess.sentCandidate, true);
assert.deepEqual(requestOrder, ["claim", "start", "result"]);
assert(localSuccess.stdout.includes("THOUGHT_RESULT_OK"));
assert(!localSuccess.stdout.includes(launchToken));
assert(!localSuccess.stdout.includes(bridgeToken));
assert(!localSuccess.stderr.includes(launchToken));
assert(!localSuccess.stderr.includes(bridgeToken));

await new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

console.log("THOUGHT Codex client stable and release-bound handshakes passed.");

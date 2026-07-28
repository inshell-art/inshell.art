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
  type ThoughtCodexResultContractBinding,
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
let activeResultContract: ThoughtCodexResultContractBinding | undefined;
let activeClaimMutation: ((claim: Record<string, any>) => void) | undefined;
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
    const workProfile = activeResultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile;

    const instructionsText = "Return one exact agent line.";
    const promptText = "hello world?";
    const claimResponse: Record<string, any> = {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "claimed",
      bridgeToken,
      request: {
        spec: {
          text: instructionsText,
          sha256: sha256(instructionsText),
        },
        instructions: {
          text: instructionsText,
          sha256: sha256(instructionsText),
        },
        promptLine: {
          text: promptText,
          sha256: sha256(promptText),
        },
        agentInput: {
          text: promptText,
          sha256: sha256(promptText),
        },
        outputContract: {
          agentLine: {
            workProfile,
            minUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes,
            maxUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes,
            normalization: THOUGHT_AGENT_LINE_CONTRACT.normalization,
            displayUnitsAreAcceptanceLimits:
              THOUGHT_AGENT_LINE_CONTRACT.displayUnitsAreAcceptanceLimits,
          },
          ...(activeRelease ? { release: activeRelease } : {}),
        },
      },
    };
    activeClaimMutation?.(claimResponse);
    sendJson(response, 200, claimResponse);
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
    if (invocationId) {
      assert.equal(parsed.invocationId, invocationId);
    } else {
      assert.equal(Object.hasOwn(parsed, "invocationId"), false);
    }
    assert.equal(typeof (parsed.error as Record<string, unknown> | undefined)?.code, "string");
    assert.equal(typeof (parsed.error as Record<string, unknown> | undefined)?.message, "string");
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
assert(task.includes("completing one THOUGHT run"));
assert(task.includes("This run may span multiple chat turns for approval or recovery."));
assert(task.includes("Do not ask the operator to run the command, paste client output, or relay a receipt."));
assert(task.includes("Terminal errors or exit without both mean the run is incomplete"));
assert(!task.includes("one THOUGHT round"));
assert(!task.includes("approval code"));
assert(!task.includes("bridgeToken"));

const localRelease: ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${"1".repeat(64)}`,
  manifestKeccak256: `0x${"2".repeat(64)}`,
};
const localResultContract: ThoughtCodexResultContractBinding = {
  workProfile: "inshell.thought.work.v2.terminal-english-64",
  declarationLabelField: "label",
  lineValidation: "terminal-english-64",
};
const localCandidate = {
  schema: THOUGHT_AGENT_RESULT_VERSION,
  release: localRelease,
  agentLine: "release-bound signal",
  declaration: {
    schema: "inshell.thought.agent-declaration.v1",
    status: "declared-unverified",
    label: "Codex",
    declaredOneCreativeResult: true,
  },
};
const localTask = buildThoughtCodexTask({
  product: "Codex",
  runId: "tar_local_v2",
  promptLine: "hello local V2?",
  runUrl,
  clientUrl,
  launchToken,
  release: localRelease,
  resultContract: localResultContract,
});
assert(localTask.includes(localRelease.protocolReleaseId));
assert(localTask.includes(localRelease.manifestKeccak256));
assert(localTask.includes("inshell.thought.agent-declaration.v1"));
assert(localTask.includes('"label":"Codex"'));

const runClient = async (options?: {
  release?: ThoughtCodexReleaseBinding;
  resultContract?: ThoughtCodexResultContractBinding;
  candidate?: Record<string, unknown>;
  claimMutation?: (claim: Record<string, any>) => void;
}) => {
  activeRelease = options?.release;
  activeResultContract = options?.resultContract;
  activeClaimMutation = options?.claimMutation;
  activeCandidate = options?.candidate ?? {
    schema: THOUGHT_AGENT_RESULT_VERSION,
    agentLine: "quiet signal",
  };
  const child = spawn("/bin/zsh", ["-c", buildThoughtCodexClientScript(
    activeRelease || activeResultContract
      ? { release: activeRelease, resultContract: activeResultContract }
      : undefined,
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
assert.deepEqual((reportedFailure.error as Record<string, unknown>), {
  code: "AGENT_OUTPUT_SCHEMA_INVALID",
  message: "HTTP 400 AGENT_OUTPUT_SCHEMA_INVALID: Agent line exceeds the 64-byte limit.",
});
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
  resultContract: localResultContract,
  candidate: localCandidate,
});

assert.equal(localSuccess.exitCode, 0, localSuccess.stderr || localSuccess.stdout);
assert.equal(localSuccess.sentCandidate, true);
assert.deepEqual(requestOrder, ["claim", "start", "result"]);
assert(localSuccess.stdout.includes("Agent line characters: closed 76-character Terminal English repertoire."));
assert(localSuccess.stdout.includes("Agent line spacing: single internal U+0020 spaces only."));
assert(localSuccess.stdout.includes("THOUGHT_RESULT_OK"));
assert(!localSuccess.stdout.includes(launchToken));
assert(!localSuccess.stdout.includes(bridgeToken));
assert(!localSuccess.stderr.includes(launchToken));
assert(!localSuccess.stderr.includes(bridgeToken));

const resetRunState = () => {
  requestOrder.length = 0;
  reportedFailure = null;
  rejectResult = false;
  invocationId = "";
  startedAt = "";
};

for (const agentLine of [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  `A .,?!:;'"-()/& Z`,
]) {
  resetRunState();
  const valid = await runClient({
    release: localRelease,
    resultContract: localResultContract,
    candidate: {
      ...localCandidate,
      agentLine,
    },
  });
  assert.equal(valid.exitCode, 0, valid.stderr || valid.stdout);
  assert.deepEqual(requestOrder, ["claim", "start", "result"]);
  assert(valid.stdout.includes("THOUGHT_RESULT_OK"));
}

for (const [label, claimMutation, expectedCode] of [
  [
    "instructions hash",
    (claim: Record<string, any>) => {
      claim.request.instructions.text = "Tampered instructions.";
    },
    "AGENT_INPUT_HASH_MISMATCH",
  ],
  [
    "prompt hash",
    (claim: Record<string, any>) => {
      claim.request.promptLine.text = "tampered prompt";
    },
    "PROMPT_HASH_MISMATCH",
  ],
  [
    "Agent input parity",
    (claim: Record<string, any>) => {
      claim.request.agentInput.text = "different Agent input";
      claim.request.agentInput.sha256 = sha256(claim.request.agentInput.text);
    },
    "AGENT_INPUT_HASH_MISMATCH",
  ],
  [
    "prompt work profile",
    (claim: Record<string, any>) => {
      claim.request.promptLine.text = "invalid_prompt";
      claim.request.promptLine.sha256 = sha256(claim.request.promptLine.text);
      claim.request.agentInput.text = claim.request.promptLine.text;
      claim.request.agentInput.sha256 = claim.request.promptLine.sha256;
    },
    "AGENT_OUTPUT_SCHEMA_INVALID",
  ],
  [
    "release binding",
    (claim: Record<string, any>) => {
      claim.request.outputContract.release.protocolReleaseId = `0x${"f".repeat(64)}`;
    },
    "AGENT_OUTPUT_SCHEMA_INVALID",
  ],
] as const) {
  resetRunState();
  const failedClaim = await runClient({
    release: localRelease,
    resultContract: localResultContract,
    candidate: localCandidate,
    claimMutation,
  });
  assert.equal(failedClaim.exitCode, 1, `${label} must fail`);
  assert.equal(failedClaim.sentCandidate, false, `${label} must fail before THOUGHT_INPUT_READY`);
  assert.deepEqual(requestOrder, ["claim", "fail"], `${label} request order`);
  assert.equal(
    (reportedFailure?.error as Record<string, unknown> | undefined)?.code,
    expectedCode,
    `${label} failure code`,
  );
  assert(!failedClaim.stdout.includes("THOUGHT_INPUT_READY"));
  assert(!failedClaim.stdout.includes("THOUGHT_RESULT_OK"));
}

for (const agentLine of [
  "quiet  signal",
  " quiet signal",
  "quiet signal ",
  "quiet_signal",
  "quiet 你好",
  "A".repeat(65),
]) {
  resetRunState();
  const invalidCandidate = {
    ...localCandidate,
    agentLine,
  };
  const invalid = await runClient({
    release: localRelease,
    resultContract: localResultContract,
    candidate: invalidCandidate,
  });
  assert.equal(invalid.exitCode, 1, `${JSON.stringify(agentLine)} must fail`);
  assert.equal(invalid.sentCandidate, true);
  assert.deepEqual(requestOrder, ["claim", "start", "fail"]);
  assert.equal(
    (reportedFailure?.error as Record<string, unknown> | undefined)?.code,
    "AGENT_OUTPUT_SCHEMA_INVALID",
  );
  assert(!invalid.stdout.includes("THOUGHT_RESULT_OK"));
}

await new Promise<void>((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

console.log("THOUGHT Codex client stable and release-bound handshakes passed.");

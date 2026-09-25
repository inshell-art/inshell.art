import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

import {
  THOUGHT_AGENT_CREATIVE_BRIEF,
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RUN_AUTHORITY,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtCodexClientScript,
  buildThoughtCodexOperationContract,
  buildThoughtCodexTask,
  buildThoughtCodexTransportWorkerCommand,
  buildThoughtClaudeTask,
  assertThoughtAgentMetadataMatchesControl,
  parseAgentInfo,
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
let activeClientScript = buildThoughtCodexClientScript();
let activeCandidate: Record<string, unknown> = {
  schema: THOUGHT_AGENT_RESULT_VERSION,
  release: THOUGHT_V2_PROTOCOL_RELEASE.release,
  agentLine: "quiet signal",
};
let submittedAgent: Record<string, unknown> | null = null;
let useBoundedControl = true;

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

  if (request.url === "/client" && request.method === "GET") {
    response.statusCode = 200;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end(activeClientScript);
    return;
  }

  if (request.url === "/run/claim" && request.method === "POST") {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.equal(authorization, `Bearer ${launchToken}`);
    requestOrder.push("claim");
    const workProfile = activeResultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile;

    const release = activeRelease ?? THOUGHT_V2_PROTOCOL_RELEASE.release;
    const creativeRequest = {
      intent: "generate-thought-candidate",
      spec: {
        id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        contractSpecId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        contractSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
        text: THOUGHT_V2_PROTOCOL_RELEASE.spec.text,
        sha256: `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`,
      },
      instructions: {
        id: THOUGHT_AGENT_CREATIVE_BRIEF.id,
        artifactId: THOUGHT_AGENT_CREATIVE_BRIEF.artifactId,
        text: THOUGHT_AGENT_CREATIVE_BRIEF.text,
        sha256: `sha256:${THOUGHT_AGENT_CREATIVE_BRIEF.sha256}`,
      },
      promptLine: {
        text: "hello world?",
        sha256: sha256("hello world?"),
      },
      agentInput: {
        text: "hello world?",
        sha256: sha256("hello world?"),
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
        release,
      },
    };
    const claimResponse: Record<string, any> = {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      runId: "tar_test_run",
      state: "claimed",
      bridgeToken,
      request: useBoundedControl
        ? {
            intent: "prepare-thought-creation",
            requestedAgent: { adapterId: "codex", model: null },
            controlPolicy: {
              mode: "bounded-preflight",
              allowMultipleControlTurns: true,
              continueOnSuccess: true,
              recoverySignal: "RETRY",
              requireAgentProductBeforeCreativeInput: true,
              runtimeModelPolicy: "reported-or-unknown",
              installationsAllowed: false,
              creativeInputState: "sealed",
            },
            evidenceContract: {
              schema: "inshell.thought.agent-control.v2",
              appExchange: "verified",
              agentProduct: "declared",
              runtimeModel: "reported-or-unknown",
              localPreparation: "verified",
              installationsRequired: false,
              creativeInputOpened: false,
            },
          }
        : creativeRequest,
    };
    activeClaimMutation?.(claimResponse);
    sendJson(response, 200, claimResponse);
    return;
  }

  if (request.url === "/run/ready" && request.method === "POST") {
    requestOrder.push("ready");
    assert.equal(authorization, `Bearer ${bridgeToken}`);
    const parsed = JSON.parse(body) as Record<string, any>;
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.deepEqual(parsed.control, {
      schema: "inshell.thought.agent-control.v2",
      mode: "bounded-preflight",
      appExchange: "verified",
      agentProduct: "declared",
      runtimeModel: "reported",
      localPreparation: "verified",
      installationsRequired: false,
      creativeInputOpened: false,
    });
    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      runId: "tar_test_run",
      state: "ready",
      stage: "control-verified",
      control: parsed.control,
    });
    return;
  }

  if (request.url === "/run/start" && request.method === "POST") {
    requestOrder.push("start");
    assert.equal(authorization, `Bearer ${bridgeToken}`);
    const parsed = JSON.parse(body) as { protocolVersion: string; invocationId: string; startedAt: string };
    assert.equal(parsed.protocolVersion, THOUGHT_AGENT_PROTOCOL_VERSION);
    assert.match(parsed.invocationId, /^tai_[A-Za-z0-9_-]{8,}$/);
    assert.match(parsed.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    invocationId = parsed.invocationId;
    startedAt = parsed.startedAt;
    const promptText = "hello world?";
    const workProfile = activeResultContract?.workProfile ?? THOUGHT_AGENT_LINE_CONTRACT.workProfile;
    const release = activeRelease ?? THOUGHT_V2_PROTOCOL_RELEASE.release;
    const creativeResponse: Record<string, any> = {
      intent: "generate-thought-candidate",
      spec: {
        id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        contractSpecId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        contractSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
        text: THOUGHT_V2_PROTOCOL_RELEASE.spec.text,
        sha256: `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`,
      },
      instructions: {
        id: THOUGHT_AGENT_CREATIVE_BRIEF.id,
        artifactId: THOUGHT_AGENT_CREATIVE_BRIEF.artifactId,
        text: THOUGHT_AGENT_CREATIVE_BRIEF.text,
        sha256: `sha256:${THOUGHT_AGENT_CREATIVE_BRIEF.sha256}`,
      },
      promptLine: { text: promptText, sha256: sha256(promptText) },
      agentInput: { text: promptText, sha256: sha256(promptText) },
      outputContract: {
        agentLine: {
          workProfile,
          minUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes,
          maxUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes,
          normalization: THOUGHT_AGENT_LINE_CONTRACT.normalization,
          displayUnitsAreAcceptanceLimits:
            THOUGHT_AGENT_LINE_CONTRACT.displayUnitsAreAcceptanceLimits,
        },
        release,
      },
    };
    sendJson(response, 200, {
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      runId: "tar_test_run",
      state: "running",
      invocationId,
      startedAt,
      ...(useBoundedControl ? { request: creativeResponse } : {}),
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
      agent: Record<string, unknown>;
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
    submittedAgent = parsed.agent;
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
      runId: "tar_test_run",
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
try {
const address = server.address();
assert(address && typeof address === "object");
const runUrl = `http://127.0.0.1:${address.port}/run`;
const clientUrl = `http://127.0.0.1:${address.port}/client`;
const defaultClientSha256 = sha256(buildThoughtCodexClientScript());
const bootstrap = {
  url: `${runUrl}/bootstrap`,
  workerSha256: THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  configSha256: `sha256:${"b".repeat(64)}` as const,
};

const task = buildThoughtCodexTask({
  product: "Codex",
  runId: "tar_test_run",
  runUrl,
  launchToken,
  bootstrap,
});
assert(!task.includes("/bin/zsh"));
assert(!task.includes("curl "));
assert(!task.includes("jq "));
assert(!task.includes("nodeRepl."));
assert(!task.includes("/tmp/"));
assert(task.includes("fixed worker"));
assert(!task.includes("Reply CREATE"));
assert(task.includes("exec_command(tty:true)"));
assert(task.includes("Host network permission is required before start"));
assert(task.includes("Do not first run it in a restricted sandbox"));
assert(task.includes("ECHO_READY"));
assert(task.includes("ECHO_OK"));
assert(task.includes("nonce must be absent onscreen"));
assert(task.includes("OK:preflight+CREDENTIAL_READY"));
assert(task.includes("read host model/effort once; never guess"));
assert(task.includes("exact echoProbe"));
assert(task.includes("metadataSource=reported"));
assert(task.includes("or unknown without model/effort"));
assert(task.includes("OK:start+THOUGHT_INPUT_READY"));
assert(task.includes("displayed verified input"));
assert(task.includes("LINE\\nTHOUGHT_END\\n"));
assert(task.includes("No CR/extra line/JSON/trim/repair/retry/replacement"));
assert(task.includes("Only OK:result+Receipt succeeds"));
assert(task.includes("never reclaim/restart/manual replay"));
assert(task.includes("exact-replay ready/frozen result once"));
assert(task.includes("unproven 429=U"));
assert(!task.includes("run_in_background"));
assert(!task.includes("mkfifo"));
assert(!task.includes(clientUrl));
assert(!task.includes(defaultClientSha256));
assert(!task.includes("THOUGHT_CLIENT_HASH_OK"));
assert(task.includes("THOUGHT Codex"));
assert(!task.includes("hello world?"));
assert(!task.includes(".launch-token"));
assert.equal(task.split(launchToken).length - 1, 1);
assert(Buffer.byteLength(task) <= 7_000);
const operation = buildThoughtCodexOperationContract({
  product: "Codex",
  runId: "tar_test_run",
  runUrl,
  launchToken,
});
const workerCommand = buildThoughtCodexTransportWorkerCommand(bootstrap);
assert(task.includes(workerCommand));
assert(!workerCommand.includes(launchToken));

const readyBodies = (handoff: string) => {
  const read = (name: string) => JSON.parse(
    handoff.split("\n").find((line) => line.startsWith(`${name} = `))!
      .slice(name.length + 3),
  );
  const reported = read("READY_BODY_REPORTED");
  const unknownLine = handoff.split("\n").find((line) => line.startsWith("READY_BODY_UNKNOWN = "))!;
  const unknown = unknownLine.endsWith('control.runtimeModel changed to "unknown"')
    ? { ...reported, control: { ...reported.control, runtimeModel: "unknown" } }
    : JSON.parse(unknownLine.slice("READY_BODY_UNKNOWN = ".length));
  assert.equal(reported.control.runtimeModel, "reported");
  assert.equal(unknown.control.runtimeModel, "unknown");
  assert.equal(reported.control.schema, "inshell.thought.agent-control.v2");
  assert.equal(unknown.control.schema, "inshell.thought.agent-control.v2");
};

readyBodies(buildThoughtClaudeTask({
  product: "Claude",
  runId: "tar_test_run",
  runUrl,
  launchToken,
  surface: "code",
}));
readyBodies(buildThoughtClaudeTask({
  product: "Claude",
  runId: "tar_test_run",
  runUrl: "https://preview.inshell.art/api/thought-agent/v2/runs/tar_test_run",
  launchToken,
  surface: "cowork",
}));

assert.deepEqual(parseAgentInfo({
  product: "Codex",
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  metadataSource: "reported",
}), {
  product: "Codex",
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  metadataSource: "reported",
});
assert.deepEqual(parseAgentInfo({
  product: "Codex",
  provider: "openai",
  metadataSource: "unknown",
}), {
  product: "Codex",
  provider: "openai",
  metadataSource: "unknown",
});
for (const malformed of [
  { product: "Codex", model: "unknown", metadataSource: "unknown" },
  { product: "Codex", model: "gpt-5.6-sol", metadataSource: "unknown" },
  { product: "Codex", model: "unknown", metadataSource: "reported" },
  { product: "Codex", model: "UNKNOWN", metadataSource: "reported" },
  { product: "Codex", model: " gpt-5.6-sol ", metadataSource: "reported" },
  { product: "Codex", model: "gpt-5.6-sol", reasoningEffort: "extreme", metadataSource: "reported" },
  { product: "Codex", metadataSource: "reported" },
]) {
  assert.throws(() => parseAgentInfo(malformed));
}
const reportedControl = buildThoughtCodexOperationContract({
  product: "Codex",
  runId: "tar_test_run",
  runUrl,
  launchToken,
}).ready.control;
const unknownControl = buildThoughtCodexOperationContract({
  product: "Codex",
  runId: "tar_test_run",
  runUrl,
  launchToken,
}).readyUnknown.control;
const reportedAgent = parseAgentInfo({
  product: "Codex",
  model: "gpt-5.6-sol",
  metadataSource: "reported",
});
const unknownAgent = parseAgentInfo({
  product: "Codex",
  metadataSource: "unknown",
});
assert.doesNotThrow(() => assertThoughtAgentMetadataMatchesControl(reportedControl, reportedAgent));
assert.doesNotThrow(() => assertThoughtAgentMetadataMatchesControl(unknownControl, unknownAgent));
assert.throws(
  () => assertThoughtAgentMetadataMatchesControl(unknownControl, reportedAgent),
  /does not match readiness evidence/i,
);

requestOrder.length = 0;
invocationId = "";
startedAt = "";

const localRelease: ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${"1".repeat(64)}`,
  manifestKeccak256: `0x${"2".repeat(64)}`,
};
const localResultContract: ThoughtCodexResultContractBinding = {
  workProfile: "inshell.thought.work.v2.terminal-english-64",
  lineValidation: "terminal-english-64",
};
const localCandidate = {
  schema: THOUGHT_AGENT_RESULT_VERSION,
  release: localRelease,
  agentLine: "release-bound signal",
};
const localTaskInput = {
  product: "Codex",
  runId: "tar_local_v2",
  runUrl,
  launchToken,
  release: localRelease,
  resultContract: localResultContract,
  bootstrap,
} as const;
const localTask = buildThoughtCodexTask(localTaskInput);
const localOperationContract = buildThoughtCodexOperationContract(localTaskInput);
assert(!localTask.includes(localRelease.protocolReleaseId));
assert(!localTask.includes(localRelease.manifestKeccak256));
assert(localTask.includes(bootstrap.url));
assert(localTask.includes(bootstrap.workerSha256));
assert(localTask.includes(bootstrap.configSha256));
assert(!localTask.includes("hello local V2?"));
assert(localTask.includes("fixed worker"));
assert.deepEqual(localOperationContract.authority, THOUGHT_AGENT_RUN_AUTHORITY);
const localTaskCandidate = { ...localOperationContract.candidateTemplate } as Record<string, any>;
localTaskCandidate.agentLine = localCandidate.agentLine;
assert.deepEqual(localTaskCandidate.release, localRelease);
assert.deepEqual(localTaskCandidate.declaration, {
  schema: "inshell.thought.agent-declaration.v1",
  status: "declared-unverified",
  label: "Codex",
  declaredOneCreativeResult: true,
});

// The downloadable shell client is retained only as a legacy transport test.
// The interactive V2 path above is the bounded control-first protocol.
useBoundedControl = false;

const runClient = async (options?: {
  release?: ThoughtCodexReleaseBinding;
  resultContract?: ThoughtCodexResultContractBinding;
  candidate?: Record<string, unknown>;
  claimMutation?: (claim: Record<string, any>) => void;
  clientSha256?: string;
}) => {
  activeRelease = options?.release;
  activeResultContract = options?.resultContract;
  activeClaimMutation = options?.claimMutation;
  activeCandidate = options?.candidate ?? {
    schema: THOUGHT_AGENT_RESULT_VERSION,
    release: THOUGHT_V2_PROTOCOL_RELEASE.release,
    agentLine: "quiet signal",
  };
  activeClientScript = buildThoughtCodexClientScript(
    activeRelease || activeResultContract
      ? { release: activeRelease, resultContract: activeResultContract }
      : undefined,
  );
  const expectedClientSha256 = options?.clientSha256 ?? sha256(activeClientScript);
  const child = spawn("/bin/zsh", ["-df"], {
    env: {
      ...process.env,
      THOUGHT_RUN_URL: runUrl,
      THOUGHT_LAUNCH_TOKEN: launchToken,
      THOUGHT_CLIENT_URL: clientUrl,
      THOUGHT_CLIENT_SHA256: expectedClientSha256,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.write([
    "umask 077",
    'THOUGHT_CLIENT_FILE="$(mktemp /tmp/inshell-thought-client.XXXXXX)" || exit 1',
    'trap \'rm -f -- "$THOUGHT_CLIENT_FILE"\' EXIT',
    "trap 'exit 129' HUP",
    "trap 'exit 130' INT",
    "trap 'exit 143' TERM",
    'curl --disable -fsS "$THOUGHT_CLIENT_URL" --output "$THOUGHT_CLIENT_FILE"',
    'THOUGHT_CLIENT_ACTUAL_SHA256="sha256:$(shasum -a 256 "$THOUGHT_CLIENT_FILE" | awk \'{print $1}\')"',
    '[[ "$THOUGHT_CLIENT_ACTUAL_SHA256" == "$THOUGHT_CLIENT_SHA256" ]] || { print -u2 -r -- "THOUGHT_CLIENT_HASH_MISMATCH expected=$THOUGHT_CLIENT_SHA256 actual=$THOUGHT_CLIENT_ACTUAL_SHA256"; exit 1; }',
    'chmod 0400 "$THOUGHT_CLIENT_FILE"',
    'print -r -- "THOUGHT_CLIENT_HASH_OK $THOUGHT_CLIENT_ACTUAL_SHA256"',
    'THOUGHT_CLIENT_CONTROL_BYTES="$(LC_ALL=C tr -d \'\\011\\012\\015\\040-\\176\' < "$THOUGHT_CLIENT_FILE" | wc -c | tr -d \'[:space:]\')"',
    '[[ "$THOUGHT_CLIENT_CONTROL_BYTES" == "0" ]] || exit 1',
    '/bin/zsh -dfn "$THOUGHT_CLIENT_FILE" || exit 1',
    'THOUGHT_CLIENT_ACTUAL_SHA256="sha256:$(shasum -a 256 "$THOUGHT_CLIENT_FILE" | awk \'{print $1}\')"',
    '[[ "$THOUGHT_CLIENT_ACTUAL_SHA256" == "$THOUGHT_CLIENT_SHA256" ]] || exit 1',
    '/bin/zsh -df "$THOUGHT_CLIENT_FILE"; THOUGHT_CLIENT_STATUS=$?; exit "$THOUGHT_CLIENT_STATUS"',
  ].join("\n") + "\n");

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

const hashMismatch = await runClient({
  clientSha256: `sha256:${"0".repeat(64)}`,
});
assert.equal(hashMismatch.exitCode, 1);
assert.equal(hashMismatch.sentCandidate, false);
assert.deepEqual(requestOrder, []);
assert(hashMismatch.stderr.includes("THOUGHT_CLIENT_HASH_MISMATCH"));
assert(!hashMismatch.stdout.includes("THOUGHT_INPUT_READY"));

const success = await runClient();

assert.equal(success.exitCode, 0, success.stderr || success.stdout);
assert.equal(success.sentCandidate, true);
assert.deepEqual(requestOrder, ["claim", "start", "result"]);
assert(success.stdout.includes("THOUGHT_VERIFIED_INSTRUCTIONS_BEGIN"));
assert(success.stdout.includes("Create exactly one Agent response to the exact human prompt."));
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
  candidate: localTaskCandidate,
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

} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

console.log("THOUGHT Codex client stable and release-bound handshakes passed.");

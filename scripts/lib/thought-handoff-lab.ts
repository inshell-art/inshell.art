import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, join, resolve } from "node:path";

import {
  THOUGHT_AGENT_CONTROL_VERSION,
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  buildThoughtCodexTask,
  type ThoughtCodexReleaseBinding,
  type ThoughtCodexResultContractBinding,
} from "../../packages/thought-agent-protocol/src/index";

export const THOUGHT_CODEX_HANDOFF_LAB_VERSION =
  "inshell.thought.codex-handoff-lab.v1" as const;
export const THOUGHT_CODEX_HANDOFF_REPORT_VERSION =
  "inshell.thought.codex-handoff-report.v1" as const;

const CONTROL_CAPABILITY_VERSION =
  "inshell.thought.agent-control-capability.v1";
const FIXTURE_RELEASE: ThoughtCodexReleaseBinding = {
  protocolReleaseId: `0x${"1".repeat(64)}`,
  manifestKeccak256: `0x${"2".repeat(64)}`,
};
const FIXTURE_RESULT_CONTRACT: ThoughtCodexResultContractBinding = {
  workProfile: THOUGHT_AGENT_LINE_CONTRACT.workProfile,
  lineValidation: "terminal-english-64",
};
const TERMINAL_STATES = new Set(["returned", "failed", "cancelled", "expired"]);
const CREATOR_JARGON = [
  "api",
  "json",
  "metadata",
  "sandbox",
  "hash",
  "token",
];

export type ThoughtCodexLabCaseId =
  | "happy-path"
  | "maximum-output"
  | "quoted-transport"
  | "malformed-claim"
  | "runtime-capability-unavailable"
  | "malformed-ready"
  | "runtime-metadata-unavailable"
  | "malformed-creative-release"
  | "result-rejected";

export type ThoughtCodexLabFault =
  | "none"
  | "malformed-claim"
  | "runtime-capability-unavailable"
  | "malformed-ready"
  | "runtime-metadata-unavailable"
  | "malformed-creative-release"
  | "result-rejected";

export type ThoughtCodexLabExpectedOutcome =
  | "returned"
  | "failed"
  | "fail-closed";

export type ThoughtCodexLabCaseDefinition = {
  id: ThoughtCodexLabCaseId;
  title: string;
  purpose: string;
  fault: ThoughtCodexLabFault;
  promptLine: string;
  agentLine: string;
  quotedTokens?: boolean;
  expectedOutcome: ThoughtCodexLabExpectedOutcome;
  expectedOperations: readonly string[];
};

export const THOUGHT_CODEX_HANDOFF_CASES: readonly ThoughtCodexLabCaseDefinition[] = [
  {
    id: "happy-path",
    title: "Automatic two-phase happy path",
    purpose: "Preflight and one creative result complete without a creator gate.",
    fault: "none",
    promptLine: "Can a quiet signal remain clear?",
    agentLine: "A quiet signal can remain clear.",
    expectedOutcome: "returned",
    expectedOperations: ["claim", "ready", "start", "result"],
  },
  {
    id: "maximum-output",
    title: "Maximum valid Agent line",
    purpose: "The exact 64-byte Terminal English boundary remains valid.",
    fault: "none",
    promptLine: "What remains at the exact boundary?",
    agentLine: "A".repeat(64),
    expectedOutcome: "returned",
    expectedOperations: ["claim", "ready", "start", "result"],
  },
  {
    id: "quoted-transport",
    title: "Quoted transport values",
    purpose: "Shell quoting preserves valid apostrophes in sealed transport values.",
    fault: "none",
    promptLine: "Can 'quotes' and / paths coexist?",
    agentLine: "Quotes and paths can coexist.",
    quotedTokens: true,
    expectedOutcome: "returned",
    expectedOperations: ["claim", "ready", "start", "result"],
  },
  {
    id: "malformed-claim",
    title: "Malformed control claim",
    purpose: "Creative start stays closed when the control policy drifts.",
    fault: "malformed-claim",
    promptLine: "Should a drifting claim open creation?",
    agentLine: "A drifting claim must remain closed.",
    expectedOutcome: "fail-closed",
    expectedOperations: ["claim"],
  },
  {
    id: "runtime-capability-unavailable",
    title: "Runtime capability unavailable",
    purpose: "The Agent records a terminal failure without opening creative input.",
    fault: "runtime-capability-unavailable",
    promptLine: "Should creation begin without run identity?",
    agentLine: "Creation must wait for run identity.",
    expectedOutcome: "failed",
    expectedOperations: ["claim", "fail"],
  },
  {
    id: "malformed-ready",
    title: "Malformed readiness response",
    purpose: "A stale creator-gated readiness response fails closed.",
    fault: "malformed-ready",
    promptLine: "Can stale readiness release the prompt?",
    agentLine: "Stale readiness cannot release it.",
    expectedOutcome: "fail-closed",
    expectedOperations: ["claim", "ready"],
  },
  {
    id: "runtime-metadata-unavailable",
    title: "Active-turn runtime metadata unavailable",
    purpose: "Creative start is never called when active-turn identity is absent.",
    fault: "runtime-metadata-unavailable",
    promptLine: "Should an unknown runtime author a work?",
    agentLine: "An unknown runtime must not author it.",
    expectedOutcome: "fail-closed",
    expectedOperations: ["claim", "ready"],
  },
  {
    id: "malformed-creative-release",
    title: "Malformed creative release",
    purpose: "Prompt/spec parity failure stops before a result is generated.",
    fault: "malformed-creative-release",
    promptLine: "Should changed creative bytes be accepted?",
    agentLine: "Changed creative bytes must be rejected.",
    expectedOutcome: "fail-closed",
    expectedOperations: ["claim", "ready", "start"],
  },
  {
    id: "result-rejected",
    title: "Rejected result submission",
    purpose: "A rejected result never produces a success receipt.",
    fault: "result-rejected",
    promptLine: "Is submission success the same as acceptance?",
    agentLine: "Acceptance requires a verified receipt.",
    expectedOutcome: "fail-closed",
    expectedOperations: ["claim", "ready", "start", "result"],
  },
] as const;

export type ThoughtCodexLabAssertion = {
  id: string;
  passed: boolean;
  evidence: string;
};

export type ThoughtCodexLabEvent = {
  index: number;
  at: string;
  operation: string;
  method: string;
  requestSha256: string;
  requestContainsCreativeInput: boolean;
  responseStatus: number;
  responseContainsCreativeInput: boolean;
};

export type ThoughtCodexLabCommandResult = {
  step: string;
  exitCode: number | null;
  expectedExit: "zero" | "nonzero";
  stdoutMarkers: string[];
  stderrSha256: string;
};

export type ThoughtCodexLabCaseReport = {
  schema: typeof THOUGHT_CODEX_HANDOFF_REPORT_VERSION;
  labVersion: typeof THOUGHT_CODEX_HANDOFF_LAB_VERSION;
  caseId: ThoughtCodexLabCaseId;
  title: string;
  purpose: string;
  expectedOutcome: ThoughtCodexLabExpectedOutcome;
  observedOutcome: ThoughtCodexLabExpectedOutcome;
  passed: boolean;
  handoffSha256: string;
  handoffByteLength: number;
  assertions: ThoughtCodexLabAssertion[];
  commands: ThoughtCodexLabCommandResult[];
  events: ThoughtCodexLabEvent[];
  startedAt: string;
  completedAt: string;
};

export type ThoughtCodexLabBatchReport = {
  schema: typeof THOUGHT_CODEX_HANDOFF_REPORT_VERSION;
  labVersion: typeof THOUGHT_CODEX_HANDOFF_LAB_VERSION;
  agent: "Codex";
  mode: "deterministic";
  batchId: string;
  candidate: {
    canonicalTaskSha256: string;
    canonicalTaskByteLength: number;
    generatorSha256: string;
    sourceCommit: string;
    sourceDirty: boolean;
  };
  matrix: {
    caseCount: number;
    passed: number;
    failed: number;
  };
  cases: ThoughtCodexLabCaseReport[];
  startedAt: string;
  completedAt: string;
};

type FixtureRun = {
  definition: ThoughtCodexLabCaseDefinition;
  runId: string;
  launchToken: string;
  bridgeToken: string;
  receiptSha256: string;
  state: string;
  invocationId: string;
  startedAt: string;
  events: ThoughtCodexLabEvent[];
};

type CommandExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

const sha256 = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const byteLength = (value: string) => Buffer.byteLength(value, "utf8");

const readRequestBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  value: unknown,
) => {
  response.statusCode = statusCode;
  response.setHeader("connection", "close");
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
};

const responseContainsCreativeInput = (value: unknown) => {
  const text = JSON.stringify(value);
  return text.includes('"promptLine"') || text.includes('"instructions"');
};

const requestContainsCreativeInput = (value: string) =>
  value.includes('"promptLine"') ||
  value.includes('"agentInput"') ||
  value.includes('"instructions"');

const controlRequest = () => ({
  intent: "prepare-thought-creation",
  requestedAgent: { adapterId: "codex", model: null },
  controlPolicy: {
    mode: "bounded-preflight",
    allowMultipleControlTurns: true,
    continueOnSuccess: true,
    recoverySignal: "RETRY",
    requireRuntimeIdentityBeforeCreativeInput: true,
    installationsAllowed: false,
    creativeInputState: "sealed",
  },
  evidenceContract: {
    schema: THOUGHT_AGENT_CONTROL_VERSION,
    appExchange: "verified",
    runtimeIdentity: "available",
    localPreparation: "verified",
    installationsRequired: false,
    creativeInputOpened: false,
  },
});

const controlEvidence = () => ({
  schema: THOUGHT_AGENT_CONTROL_VERSION,
  mode: "bounded-preflight",
  appExchange: "verified",
  runtimeIdentity: "available",
  localPreparation: "verified",
  installationsRequired: false,
  creativeInputOpened: false,
});

const creativeRequest = (run: FixtureRun) => {
  const instructions = "Return one exact Agent line under the verified output contract.";
  const promptHash = sha256(run.definition.promptLine);
  const malformed = run.definition.fault === "malformed-creative-release";
  return {
    intent: "generate-thought-candidate",
    spec: { text: instructions, sha256: sha256(instructions) },
    instructions: { text: instructions, sha256: sha256(instructions) },
    promptLine: {
      text: run.definition.promptLine,
      sha256: malformed ? sha256(`${run.definition.promptLine}!`) : promptHash,
    },
    agentInput: {
      text: run.definition.promptLine,
      sha256: malformed ? sha256(`${run.definition.promptLine}!`) : promptHash,
    },
    outputContract: {
      release: FIXTURE_RELEASE,
      resultSchema: THOUGHT_AGENT_RESULT_VERSION,
      agentLine: {
        workProfile: FIXTURE_RESULT_CONTRACT.workProfile,
        minUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes,
        maxUtf8Bytes: THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes,
        normalization: THOUGHT_AGENT_LINE_CONTRACT.normalization,
        displayUnitsAreAcceptanceLimits:
          THOUGHT_AGENT_LINE_CONTRACT.displayUnitsAreAcceptanceLimits,
      },
    },
  };
};

class ThoughtCodexFixtureServer {
  private readonly runs = new Map<string, FixtureRun>();
  private readonly server: Server;
  origin = "";

  constructor() {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch((error: unknown) => {
        sendJson(response, 500, {
          error: {
            code: "LAB_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Fixture server failed.",
          },
        });
      });
    });
  }

  async start() {
    await new Promise<void>((resolveStart, rejectStart) => {
      this.server.once("error", rejectStart);
      this.server.listen(0, "127.0.0.1", () => {
        this.server.off("error", rejectStart);
        resolveStart();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Codex handoff fixture server did not bind a TCP port.");
    }
    this.origin = `http://127.0.0.1:${address.port}`;
  }

  register(definition: ThoughtCodexLabCaseDefinition) {
    const suffix = definition.id.replaceAll(/[^A-Za-z0-9_-]/g, "-");
    const runId = `tar_lab_${suffix}`;
    const quoted = definition.quotedTokens ? "'quoted" : "";
    const run: FixtureRun = {
      definition,
      runId,
      launchToken: `lab-launch-${suffix}${quoted}`,
      bridgeToken: `lab-bridge-${suffix}${quoted}`,
      receiptSha256: sha256(`receipt:${definition.id}`),
      state: "created",
      invocationId: "",
      startedAt: "",
      events: [],
    };
    this.runs.set(runId, run);
    return run;
  }

  async close() {
    await new Promise<void>((resolveClose, rejectClose) => {
      this.server.close((error) => error ? rejectClose(error) : resolveClose());
    });
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    const match = /^\/runs\/([^/]+)\/(claim|ready|start|result|fail)$/.exec(
      request.url ?? "",
    );
    if (!match) {
      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "not found" } });
      return;
    }
    const [, encodedRunId, operation] = match;
    const run = this.runs.get(decodeURIComponent(encodedRunId));
    if (!run) {
      sendJson(response, 404, { error: { code: "RUN_NOT_FOUND", message: "run not found" } });
      return;
    }
    const body = await readRequestBody(request);
    const expectedToken = operation === "claim" ? run.launchToken : run.bridgeToken;
    if (String(request.headers.authorization ?? "") !== `Bearer ${expectedToken}`) {
      this.respondAndRecord(run, request, response, operation, body, 401, {
        error: { code: "TOKEN_INVALID", message: "Invalid token." },
      });
      return;
    }
    let status = 200;
    let payload: unknown;
    if (operation === "claim") {
      run.state = "claimed";
      const requestValue = controlRequest();
      if (run.definition.fault === "malformed-claim") {
        requestValue.controlPolicy.continueOnSuccess = false;
      }
      payload = {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        runId: run.runId,
        state: "claimed",
        bridgeToken: run.bridgeToken,
        request: requestValue,
      };
    } else if (operation === "ready") {
      run.state = "ready";
      payload = run.definition.fault === "malformed-ready"
        ? {
            protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
            runId: run.runId,
            state: "ready",
            stage: "waiting-for-creator",
            control: controlEvidence(),
            creatorAction: { command: "CREATE" },
          }
        : {
            protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
            runId: run.runId,
            state: "ready",
            stage: "control-verified",
            control: controlEvidence(),
          };
    } else if (operation === "start") {
      const parsed = JSON.parse(body) as {
        invocationId?: string;
        startedAt?: string;
      };
      run.invocationId = parsed.invocationId ?? "";
      run.startedAt = parsed.startedAt ?? "";
      run.state = "running";
      payload = {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        runId: run.runId,
        state: "running",
        invocationId: run.invocationId,
        startedAt: run.startedAt,
        request: creativeRequest(run),
      };
    } else if (operation === "result") {
      if (run.definition.fault === "result-rejected") {
        status = 400;
        payload = {
          error: {
            code: "AGENT_OUTPUT_SCHEMA_INVALID",
            message: "Lab fixture rejected the result.",
          },
        };
      } else {
        const parsed = JSON.parse(body) as {
          output?: { agentLine?: string };
        };
        run.state = "returned";
        payload = {
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          runId: run.runId,
          state: "returned",
          result: {
            agentLine: parsed.output?.agentLine,
            receipt: { receiptSha256: run.receiptSha256 },
          },
        };
      }
    } else {
      run.state = "failed";
      const parsed = JSON.parse(body) as { error?: unknown };
      payload = {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        runId: run.runId,
        state: "failed",
        error: parsed.error,
      };
    }
    this.respondAndRecord(run, request, response, operation, body, status, payload);
  }

  private respondAndRecord(
    run: FixtureRun,
    request: IncomingMessage,
    response: ServerResponse,
    operation: string,
    requestBody: string,
    status: number,
    payload: unknown,
  ) {
    run.events.push({
      index: run.events.length + 1,
      at: new Date().toISOString(),
      operation,
      method: request.method ?? "",
      requestSha256: sha256(requestBody),
      requestContainsCreativeInput: requestContainsCreativeInput(requestBody),
      responseStatus: status,
      responseContainsCreativeInput: responseContainsCreativeInput(payload),
    });
    sendJson(response, status, payload);
  }
}

const exactTaskCommandAfter = (task: string, label: string) => {
  const lines = task.split("\n");
  const labelIndex = lines.findIndex((line) => line.startsWith(label));
  if (labelIndex < 0 || !lines[labelIndex + 1]) {
    throw new Error(`Codex handoff step not found: ${label}`);
  }
  return lines[labelIndex + 1];
};

const runShellCommand = async (command: string): Promise<CommandExecution> => {
  const child = spawn("/bin/zsh", ["-dfc", command], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
    child.once("error", rejectExit);
    child.once("close", resolveExit);
  });
  return { exitCode, stdout, stderr };
};

const resultMarkers = (value: string) => [
  "THOUGHT_CLAIM_VERIFIED",
  "THOUGHT_READY_REQUEST_PREPARED",
  "THOUGHT_CONTROL_READY",
  "THOUGHT_CONTROL_FAILURE_RECORDED",
  "THOUGHT_CREATIVE_START_PREPARED",
  "THOUGHT_INPUT_READY",
  "THOUGHT_RESULT_REQUEST_READY",
  "THOUGHT_RESULT_OK",
].filter((marker) => value.includes(marker));

const commandReport = (
  step: string,
  expectedExit: "zero" | "nonzero",
  result: CommandExecution,
): ThoughtCodexLabCommandResult => ({
  step,
  exitCode: result.exitCode,
  expectedExit,
  stdoutMarkers: resultMarkers(result.stdout),
  stderrSha256: sha256(result.stderr),
});

const pushAssertion = (
  assertions: ThoughtCodexLabAssertion[],
  id: string,
  passed: boolean,
  evidence: string,
) => assertions.push({ id, passed, evidence });

const tempFilesForRun = (runId: string) => [
  "claim.json",
  "bridge-header",
  "control-evidence.json",
  "ready-request.json",
  "ready-response.json",
  "control-failure-request.json",
  "control-failure-response.json",
  "started-at",
  "start-request.json",
  "start-response.json",
  "candidate.json",
  "runtime-metadata.json",
  "result-request.json",
  "result-response.json",
].map((suffix) => join("/tmp", `inshell-thought-${runId}.${suffix}`));

const cleanRunFiles = async (runId: string) => {
  await Promise.all(tempFilesForRun(runId).map((path) => rm(path, { force: true })));
};

const runExpected = async (
  commands: ThoughtCodexLabCommandResult[],
  step: string,
  command: string,
  expectedExit: "zero" | "nonzero" = "zero",
) => {
  const result = await runShellCommand(command);
  commands.push(commandReport(step, expectedExit, result));
  const passed = expectedExit === "zero" ? result.exitCode === 0 : result.exitCode !== 0;
  if (!passed) {
    throw new Error(
      `${step} expected ${expectedExit} exit, got ${String(result.exitCode)}: ${result.stderr || result.stdout}`,
    );
  }
  return result;
};

const writePrivateJson = async (path: string, value: unknown) => {
  await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  await chmod(path, 0o600);
};

const staticHandoffAssertions = (
  task: string,
  promptLine: string,
): ThoughtCodexLabAssertion[] => {
  const assertions: ThoughtCodexLabAssertion[] = [];
  pushAssertion(
    assertions,
    "automatic-continuation",
    task.includes("If control passes, continue directly into the creative phase in this same turn.") &&
      task.includes("Do not ask the creator to continue and do not stop."),
    "Successful preflight must continue in the same Agent turn.",
  );
  pushAssertion(
    assertions,
    "no-create-gate",
    !task.includes("Reply CREATE") && !task.includes("exact CREATE"),
    "The handoff must not introduce a creator CREATE gate.",
  );
  pushAssertion(
    assertions,
    "prompt-sealed-in-handoff",
    !task.includes(promptLine),
    "The creative prompt must not be embedded in the launch handoff.",
  );
  pushAssertion(
    assertions,
    "no-installation-request",
    task.includes("Never ask the creator to install, configure, or learn anything") &&
      task.includes("Do not install anything."),
    "Missing capability remains a platform failure, not a creator setup task.",
  );
  pushAssertion(
    assertions,
    "bounded-recovery",
    task.includes("then reply RETRY") &&
      task.includes("RETRY itself never opens creative input"),
    "Only evidenced control failures may request RETRY.",
  );
  const creatorMessages = task
    .split("\n")
    .filter((line) => line.includes("show exactly:"))
    .map((line) => line.slice(line.indexOf("show exactly:") + "show exactly:".length).toLowerCase());
  const jargon = creatorMessages.flatMap((line) =>
    CREATOR_JARGON.filter((term) => new RegExp(`\\b${term}s?\\b`, "i").test(line)),
  );
  pushAssertion(
    assertions,
    "plain-creator-recovery",
    jargon.length === 0,
    jargon.length === 0
      ? "Exact creator-facing recovery messages contain no implementation jargon."
      : `Creator-facing recovery contains: ${[...new Set(jargon)].join(", ")}`,
  );
  return assertions;
};

const runDeterministicCase = async (
  server: ThoughtCodexFixtureServer,
  definition: ThoughtCodexLabCaseDefinition,
): Promise<ThoughtCodexLabCaseReport> => {
  const startedAt = new Date().toISOString();
  const run = server.register(definition);
  await cleanRunFiles(run.runId);
  const runUrl = `${server.origin}/runs/${encodeURIComponent(run.runId)}`;
  const task = buildThoughtCodexTask({
    product: "Codex",
    runId: run.runId,
    runUrl,
    launchToken: run.launchToken,
    networkAuthorization: "preauthorized",
    release: FIXTURE_RELEASE,
    resultContract: FIXTURE_RESULT_CONTRACT,
  });
  const commands: ThoughtCodexLabCommandResult[] = [];
  const assertions = staticHandoffAssertions(task, definition.promptLine);
  const claim = exactTaskCommandAfter(task, "1. Run this exact App-exchange command through");
  const validateClaim = exactTaskCommandAfter(task, "2. Run this exact local-only validation command.");
  const prepareReady = exactTaskCommandAfter(
    task,
    "4. Run this exact local-only command to prepare closed readiness evidence",
  );
  const postReady = exactTaskCommandAfter(task, "5. Run this exact static App-exchange command");
  const validateReady = exactTaskCommandAfter(
    task,
    "6. Run this exact local-only readiness validation command",
  );
  const prepareFailure = exactTaskCommandAfter(
    task,
    "Failure-reporting step A — prepare the terminal state locally:",
  );
  const postFailure = exactTaskCommandAfter(
    task,
    "Failure-reporting step B — send it with the same narrow App permission:",
  );
  const validateFailure = exactTaskCommandAfter(
    task,
    "Failure-reporting step C — verify it and clear this run's temporary files:",
  );
  const prepareStart = exactTaskCommandAfter(task, "9. Run this exact local-only command.");
  const postStart = exactTaskCommandAfter(task, "10. Run this exact static App-exchange command");
  const validateCreative = exactTaskCommandAfter(task, "11. Run this exact local-only command.");
  const prepareResult = exactTaskCommandAfter(task, "15. Run this exact local-only command.");
  const postResult = exactTaskCommandAfter(task, "16. Run this exact static App-exchange command");
  const validateReceipt = exactTaskCommandAfter(
    task,
    "17. Run this exact local-only command to verify acceptance",
  );

  try {
    await runExpected(commands, "claim", claim);
    if (definition.fault === "malformed-claim") {
      await runExpected(commands, "validate-claim", validateClaim, "nonzero");
    } else {
      await runExpected(commands, "validate-claim", validateClaim);
      if (definition.fault === "runtime-capability-unavailable") {
        await runExpected(commands, "prepare-failure", prepareFailure);
        await runExpected(commands, "post-failure", postFailure);
        await runExpected(commands, "validate-failure", validateFailure);
      } else {
        await writePrivateJson(
          join("/tmp", `inshell-thought-${run.runId}.control-evidence.json`),
          { schema: CONTROL_CAPABILITY_VERSION, runtimeIdentity: "available" },
        );
        await runExpected(commands, "prepare-ready", prepareReady);
        await runExpected(commands, "post-ready", postReady);
        if (definition.fault === "malformed-ready") {
          await runExpected(commands, "validate-ready", validateReady, "nonzero");
        } else {
          await runExpected(commands, "validate-ready", validateReady);
          if (definition.fault === "runtime-metadata-unavailable") {
            await runExpected(commands, "prepare-start", prepareStart, "nonzero");
          } else {
            await writePrivateJson(
              join("/tmp", `inshell-thought-${run.runId}.runtime-metadata.json`),
              { model: "gpt-5-lab", reasoningEffort: "high" },
            );
            await runExpected(commands, "prepare-start", prepareStart);
            await runExpected(commands, "post-start", postStart);
            if (definition.fault === "malformed-creative-release") {
              await runExpected(commands, "validate-creative", validateCreative, "nonzero");
            } else {
              await runExpected(commands, "validate-creative", validateCreative);
              await writePrivateJson(
                join("/tmp", `inshell-thought-${run.runId}.candidate.json`),
                {
                  schema: THOUGHT_AGENT_RESULT_VERSION,
                  release: FIXTURE_RELEASE,
                  agentLine: definition.agentLine,
                },
              );
              await runExpected(commands, "prepare-result", prepareResult);
              if (definition.fault === "result-rejected") {
                await runExpected(commands, "post-result", postResult, "nonzero");
              } else {
                await runExpected(commands, "post-result", postResult);
                await runExpected(commands, "validate-receipt", validateReceipt);
              }
            }
          }
        }
      }
    }
  } finally {
    await cleanRunFiles(run.runId);
  }

  const operations = run.events.map((event) => event.operation);
  pushAssertion(
    assertions,
    "expected-operation-order",
    JSON.stringify(operations) === JSON.stringify(definition.expectedOperations),
    `Observed ${operations.join(" → ") || "no operations"}.`,
  );
  const claimEvent = run.events.find((event) => event.operation === "claim");
  pushAssertion(
    assertions,
    "claim-is-control-only",
    Boolean(claimEvent) && claimEvent?.responseContainsCreativeInput === false,
    "Claim response must not contain prompt or creative instructions.",
  );
  const startIndex = operations.indexOf("start");
  const readyIndex = operations.indexOf("ready");
  pushAssertion(
    assertions,
    "start-after-ready",
    startIndex < 0 || (readyIndex >= 0 && readyIndex < startIndex),
    startIndex < 0
      ? "Creative start was not reached."
      : `Readiness index ${readyIndex}; start index ${startIndex}.`,
  );
  const resultCount = operations.filter((operation) => operation === "result").length;
  pushAssertion(
    assertions,
    "at-most-one-creative-result",
    resultCount <= 1,
    `Observed ${resultCount} result submission${resultCount === 1 ? "" : "s"}.`,
  );
  const combinedOutput = commands.map((command) => JSON.stringify(command)).join("\n");
  pushAssertion(
    assertions,
    "transport-secrets-redacted",
    !combinedOutput.includes(run.launchToken) && !combinedOutput.includes(run.bridgeToken),
    "Command reports contain hashes and markers, never transport credentials.",
  );
  const successMarker = commands.some((command) =>
    command.stdoutMarkers.includes("THOUGHT_RESULT_OK"),
  );
  pushAssertion(
    assertions,
    "success-marker-parity",
    definition.expectedOutcome === "returned" ? successMarker : !successMarker,
    successMarker ? "THOUGHT_RESULT_OK observed." : "No success marker observed.",
  );
  const observedOutcome: ThoughtCodexLabExpectedOutcome = run.state === "returned"
    ? "returned"
    : run.state === "failed"
    ? "failed"
    : "fail-closed";
  pushAssertion(
    assertions,
    "expected-terminal-outcome",
    observedOutcome === definition.expectedOutcome,
    `Expected ${definition.expectedOutcome}; observed ${observedOutcome}.`,
  );
  const passed = assertions.every((assertion) => assertion.passed) &&
    commands.every((command) =>
      command.expectedExit === "zero" ? command.exitCode === 0 : command.exitCode !== 0,
    );
  return {
    schema: THOUGHT_CODEX_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CODEX_HANDOFF_LAB_VERSION,
    caseId: definition.id,
    title: definition.title,
    purpose: definition.purpose,
    expectedOutcome: definition.expectedOutcome,
    observedOutcome,
    passed,
    handoffSha256: sha256(task),
    handoffByteLength: byteLength(task),
    assertions,
    commands,
    events: run.events,
    startedAt,
    completedAt: new Date().toISOString(),
  };
};

const canonicalCandidateTask = () => buildThoughtCodexTask({
  product: "Codex",
  runId: "tar_handoff_candidate",
  runUrl: "https://handoff-lab.invalid/runs/tar_handoff_candidate",
  launchToken: "sealed-launch-token-placeholder",
  networkAuthorization: "managed",
  release: FIXTURE_RELEASE,
  resultContract: FIXTURE_RESULT_CONTRACT,
});

export const renderThoughtCodexLabMarkdown = (
  report: ThoughtCodexLabBatchReport,
) => {
  const lines = [
    "# Codex Handoff Lab Report",
    "",
    `- Batch: \`${report.batchId}\``,
    `- Lab: \`${report.labVersion}\``,
    `- Agent: ${report.agent}`,
    `- Mode: ${report.mode}`,
    `- Candidate task: \`${report.candidate.canonicalTaskSha256}\` (${report.candidate.canonicalTaskByteLength} bytes)`,
    `- Generator: \`${report.candidate.generatorSha256}\``,
    `- Source: \`${report.candidate.sourceCommit}\`${report.candidate.sourceDirty ? " (dirty)" : ""}`,
    `- Result: ${report.matrix.passed}/${report.matrix.caseCount} passed`,
    "",
    "## Matrix",
    "",
    "| Case | Outcome | Assertions |",
    "| --- | --- | --- |",
    ...report.cases.map((entry) =>
      `| ${entry.caseId} | ${entry.passed ? "PASS" : "FAIL"} (${entry.observedOutcome}) | ${entry.assertions.filter((assertion) => assertion.passed).length}/${entry.assertions.length} |`
    ),
    "",
  ];
  for (const entry of report.cases) {
    lines.push(
      `## ${entry.caseId}`,
      "",
      entry.purpose,
      "",
      `- Result: ${entry.passed ? "PASS" : "FAIL"}`,
      `- Expected/observed: ${entry.expectedOutcome} / ${entry.observedOutcome}`,
      `- Task: \`${entry.handoffSha256}\` (${entry.handoffByteLength} bytes)`,
      `- Operations: ${entry.events.map((event) => event.operation).join(" → ") || "none"}`,
      "",
      ...entry.assertions.map((assertion) =>
        `- [${assertion.passed ? "x" : " "}] \`${assertion.id}\`: ${assertion.evidence}`
      ),
      "",
    );
  }
  return `${lines.join("\n")}\n`;
};

export const runThoughtCodexDeterministicLab = async (options: {
  outputDir: string;
  caseIds?: readonly ThoughtCodexLabCaseId[];
  sourceCommit: string;
  sourceDirty: boolean;
  generatorPath: string;
}) => {
  const startedAt = new Date().toISOString();
  const batchId = `codex-handoff-${startedAt.replaceAll(/[:.]/g, "-")}`;
  const selected = options.caseIds?.length
    ? THOUGHT_CODEX_HANDOFF_CASES.filter((entry) => options.caseIds?.includes(entry.id))
    : [...THOUGHT_CODEX_HANDOFF_CASES];
  if (selected.length === 0) {
    throw new Error("No Codex handoff lab cases selected.");
  }
  const server = new ThoughtCodexFixtureServer();
  await server.start();
  const cases: ThoughtCodexLabCaseReport[] = [];
  try {
    for (const definition of selected) {
      cases.push(await runDeterministicCase(server, definition));
    }
  } finally {
    await server.close();
  }
  const canonicalTask = canonicalCandidateTask();
  const generatorBytes = await readFile(options.generatorPath, "utf8");
  const report: ThoughtCodexLabBatchReport = {
    schema: THOUGHT_CODEX_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CODEX_HANDOFF_LAB_VERSION,
    agent: "Codex",
    mode: "deterministic",
    batchId,
    candidate: {
      canonicalTaskSha256: sha256(canonicalTask),
      canonicalTaskByteLength: byteLength(canonicalTask),
      generatorSha256: sha256(generatorBytes),
      sourceCommit: options.sourceCommit,
      sourceDirty: options.sourceDirty,
    },
    matrix: {
      caseCount: cases.length,
      passed: cases.filter((entry) => entry.passed).length,
      failed: cases.filter((entry) => !entry.passed).length,
    },
    cases,
    startedAt,
    completedAt: new Date().toISOString(),
  };
  const outputDir = resolve(options.outputDir, batchId);
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(outputDir, "report.md"), renderThoughtCodexLabMarkdown(report));
  return { outputDir, report };
};

export type ThoughtCodexRealCanarySession = {
  schema: typeof THOUGHT_CODEX_HANDOFF_REPORT_VERSION;
  labVersion: typeof THOUGHT_CODEX_HANDOFF_LAB_VERSION;
  mode: "real-canary";
  agent: "Codex Desktop";
  runId: string;
  statusUrl: string;
  browserToken: string;
  taskSha256: string;
  taskByteLength: number;
  taskPath: string;
  codexUrlPath: string;
  createdAt: string;
  promptLine: string;
};

export const buildCodexDeepLink = (task: string, originUrl: string) => {
  const parameters = new URLSearchParams({ prompt: task, originUrl });
  return `codex://new?${parameters.toString()}`;
};

export const prepareThoughtCodexRealCanary = async (options: {
  origin: string;
  outputDir: string;
  promptLine: string;
  specId: string;
  release: ThoughtCodexReleaseBinding;
  resultContract: ThoughtCodexResultContractBinding;
}) => {
  const origin = options.origin.replace(/\/+$/g, "");
  const response = await fetch(`${origin}/api/thought-agent/v2/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine: options.promptLine,
      specId: options.specId,
      requestedAgent: { adapterId: "codex", model: null },
      client: { surface: "thought-codex-handoff-lab", appVersion: "v1" },
      devAutoRun: false,
    }),
  });
  const payload = await response.json() as {
    runId?: string;
    statusUrl?: string;
    browserToken?: string;
    launchUri?: string;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.runId || !payload.statusUrl || !payload.browserToken || !payload.launchUri) {
    throw new Error(
      `${response.status} ${payload.error?.code ?? "CANARY_CREATE_FAILED"}: ${payload.error?.message ?? "Could not create Codex canary."}`,
    );
  }
  const launchToken = new URL(payload.launchUri).searchParams.get("token") ?? "";
  if (!launchToken) throw new Error("Codex canary launch token missing.");
  const statusUrl = new URL(payload.statusUrl, origin).toString().replace(/\/+$/g, "");
  const task = buildThoughtCodexTask({
    product: "Codex",
    runId: payload.runId,
    runUrl: statusUrl,
    launchToken,
    networkAuthorization: "managed",
    release: options.release,
    resultContract: options.resultContract,
  });
  const sessionDir = resolve(options.outputDir, payload.runId);
  await mkdir(sessionDir, { recursive: true });
  const taskPath = join(sessionDir, "sealed-task.txt");
  const codexUrlPath = join(sessionDir, "codex-url.txt");
  const sessionPath = join(sessionDir, "session.json");
  const codexUrl = buildCodexDeepLink(task, `${origin}/thought/`);
  await writeFile(taskPath, task, { mode: 0o600 });
  await writeFile(codexUrlPath, codexUrl, { mode: 0o600 });
  const session: ThoughtCodexRealCanarySession = {
    schema: THOUGHT_CODEX_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CODEX_HANDOFF_LAB_VERSION,
    mode: "real-canary",
    agent: "Codex Desktop",
    runId: payload.runId,
    statusUrl,
    browserToken: payload.browserToken,
    taskSha256: sha256(task),
    taskByteLength: byteLength(task),
    taskPath,
    codexUrlPath,
    createdAt: new Date().toISOString(),
    promptLine: options.promptLine,
  };
  await writePrivateJson(sessionPath, session);
  return { codexUrl, session, sessionDir, sessionPath };
};

export const observeThoughtCodexRealCanary = async (options: {
  sessionPath: string;
  timeoutMs: number;
  pollMs?: number;
  creatorActions?: string;
}) => {
  const session = JSON.parse(await readFile(options.sessionPath, "utf8")) as
    ThoughtCodexRealCanarySession;
  const startedAt = new Date().toISOString();
  const deadline = Date.now() + options.timeoutMs;
  let payload: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    const response = await fetch(session.statusUrl, {
      headers: { authorization: `Bearer ${session.browserToken}` },
      cache: "no-store",
    });
    payload = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(`Canary status failed with HTTP ${response.status}.`);
    }
    if (TERMINAL_STATES.has(String(payload.state ?? ""))) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, options.pollMs ?? 1_000));
  }
  const terminal = TERMINAL_STATES.has(String(payload.state ?? ""));
  const result = payload.result as {
    receipt?: { receiptSha256?: string; model?: string; reasoningEffort?: string };
    agentLine?: string;
  } | undefined;
  const report = {
    schema: THOUGHT_CODEX_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CODEX_HANDOFF_LAB_VERSION,
    mode: "real-canary",
    agent: "Codex Desktop",
    runId: session.runId,
    taskSha256: session.taskSha256,
    taskByteLength: session.taskByteLength,
    terminal,
    state: payload.state ?? "timeout",
    stage: payload.stage ?? null,
    receiptSha256: result?.receipt?.receiptSha256 ?? null,
    model: result?.receipt?.model ?? null,
    reasoningEffort: result?.receipt?.reasoningEffort ?? null,
    launchSubmission: "creator-clicked-submit",
    controlActions: options.creatorActions ?? "not-recorded",
    agentLineSha256: result?.agentLine ? sha256(result.agentLine) : null,
    privateArtifactsRemoved: terminal,
    startedAt,
    completedAt: new Date().toISOString(),
  };
  const reportPath = join(dirname(options.sessionPath), "real-canary-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (terminal) {
    await Promise.all([
      options.sessionPath,
      session.taskPath,
      session.codexUrlPath,
    ].map((path) => rm(path, { force: true })));
  }
  return { report, reportPath };
};

export const thoughtCodexCanonicalCandidate = canonicalCandidateTask;

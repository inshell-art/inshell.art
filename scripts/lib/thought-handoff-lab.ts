import { Buffer } from "node:buffer";
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
  THOUGHT_AGENT_CREATIVE_BRIEF,
  THOUGHT_AGENT_CONTROL_VERSION,
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
  buildThoughtCodexOperationContract,
  buildThoughtCodexTask,
  isThoughtClaudeCoworkPublicHttpsOrigin,
  type ThoughtClaudeSurface,
  type ThoughtCodexReleaseBinding,
  type ThoughtCodexResultContractBinding,
} from "../../packages/thought-agent-protocol/src/index";

export const THOUGHT_CODEX_HANDOFF_LAB_VERSION =
  "inshell.thought.codex-handoff-lab.v1" as const;
export const THOUGHT_CODEX_HANDOFF_REPORT_VERSION =
  "inshell.thought.codex-handoff-report.v1" as const;
const THOUGHT_CODEX_HANDOFF_MAX_BYTES = 7_000;
const THOUGHT_CLAUDE_HANDOFF_MAX_BYTES = 14_000;

export const THOUGHT_CLAUDE_HANDOFF_LAB_VERSION =
  "inshell.thought.claude-handoff-lab.v2" as const;
export const THOUGHT_CLAUDE_HANDOFF_REPORT_VERSION =
  "inshell.thought.claude-handoff-report.v2" as const;

type ThoughtHandoffLabProfile = {
  id: "codex" | "claude";
  agent: "Codex" | "Claude";
  desktopAgent: "Codex Desktop" | "Claude Desktop";
  model: "gpt-5-lab" | "claude-lab";
  provider: "codex" | "anthropic";
  surface: "codex" | "cowork";
  bridgeVersion: "0.0.3+direct" | "0.0.4+cowork";
  bridgePlatform:
    | "codex-direct-http"
    | "claude-cowork-direct-http"
    | "claude-code-direct-http";
  adapterVersion: "direct-http" | "cowork-direct-http";
  labVersion: string;
  reportVersion: string;
  handoffMaxBytes: number;
  buildOperationContract: typeof buildThoughtCodexOperationContract;
  buildTask: typeof buildThoughtCodexTask;
};

const CODEX_LAB_PROFILE: ThoughtHandoffLabProfile = {
  id: "codex",
  agent: "Codex",
  desktopAgent: "Codex Desktop",
  model: "gpt-5-lab",
  provider: "codex",
  surface: "codex",
  bridgeVersion: "0.0.3+direct",
  bridgePlatform: "codex-direct-http",
  adapterVersion: "direct-http",
  labVersion: THOUGHT_CODEX_HANDOFF_LAB_VERSION,
  reportVersion: THOUGHT_CODEX_HANDOFF_REPORT_VERSION,
  handoffMaxBytes: THOUGHT_CODEX_HANDOFF_MAX_BYTES,
  buildOperationContract: buildThoughtCodexOperationContract,
  buildTask: buildThoughtCodexTask,
};

const CLAUDE_LAB_PROFILE: ThoughtHandoffLabProfile = {
  id: "claude",
  agent: "Claude",
  desktopAgent: "Claude Desktop",
  model: "claude-lab",
  provider: "anthropic",
  surface: "cowork",
  bridgeVersion: "0.0.4+cowork",
  bridgePlatform: "claude-cowork-direct-http",
  adapterVersion: "cowork-direct-http",
  labVersion: THOUGHT_CLAUDE_HANDOFF_LAB_VERSION,
  reportVersion: THOUGHT_CLAUDE_HANDOFF_REPORT_VERSION,
  handoffMaxBytes: THOUGHT_CLAUDE_HANDOFF_MAX_BYTES,
  buildOperationContract: buildThoughtClaudeOperationContract,
  buildTask: buildThoughtClaudeTask,
};


const FIXTURE_RELEASE: ThoughtCodexReleaseBinding =
  THOUGHT_V2_PROTOCOL_RELEASE.release;
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
  | "bridge-credential-retention"
  | "maximum-output"
  | "quoted-transport"
  | "malformed-claim"
  | "runtime-capability-unavailable"
  | "malformed-ready"
  | "runtime-effort-unavailable"
  | "malformed-creative-release"
  | "result-rejected";

export type ThoughtCodexLabFault =
  | "none"
  | "malformed-claim"
  | "runtime-capability-unavailable"
  | "malformed-ready"
  | "runtime-effort-unavailable"
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
    id: "bridge-credential-retention",
    title: "One-time bridge credential retention",
    purpose: "The top-level bridgeToken from one claim authorizes every later operation without reclaiming.",
    fault: "none",
    promptLine: "Can one claim carry the whole return?",
    agentLine: "One retained claim can carry the return.",
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
    purpose: "Declarative transport preserves apostrophes without shell-specific quoting.",
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
    id: "runtime-effort-unavailable",
    title: "Optional reasoning effort unavailable",
    purpose: "An exact host model can complete the run when the host omits reasoning effort.",
    fault: "runtime-effort-unavailable",
    promptLine: "Can known authorship omit one detail?",
    agentLine: "Known authorship can omit that detail.",
    expectedOutcome: "returned",
    expectedOperations: ["claim", "ready", "start", "result"],
  },
  {
    id: "malformed-creative-release",
    title: "Malformed creative release",
    purpose: "A mismatched protocol release stops before a result is generated.",
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
  schema: string;
  labVersion: string;
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
  schema: string;
  labVersion: string;
  agent: "Codex" | "Claude";
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

const controlRequest = (profile: ThoughtHandoffLabProfile) => ({
  intent: "prepare-thought-creation",
  requestedAgent: { adapterId: profile.id, model: null },
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
  const promptHash = sha256(run.definition.promptLine);
  const malformed = run.definition.fault === "malformed-creative-release";
  return {
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
      text: run.definition.promptLine,
      sha256: promptHash,
    },
    agentInput: {
      text: run.definition.promptLine,
      sha256: promptHash,
    },
    outputContract: {
      release: malformed
        ? { ...FIXTURE_RELEASE, manifestKeccak256: `0x${"f".repeat(64)}` }
        : FIXTURE_RELEASE,
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

  constructor(private readonly profile: ThoughtHandoffLabProfile) {
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
      if (run.state !== "created") {
        this.respondAndRecord(run, request, response, operation, body, 409, {
          error: { code: "RUN_ALREADY_CLAIMED", message: "Run was already claimed." },
        });
        return;
      }
      run.state = "claimed";
      const requestValue = controlRequest(this.profile);
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
          agent?: { reasoningEffort?: unknown };
          output?: { agentLine?: string };
        };
        if (
          run.definition.fault === "runtime-effort-unavailable" &&
          parsed.agent?.reasoningEffort !== undefined
        ) {
          status = 400;
          payload = {
            error: {
              code: "OPTIONAL_RUNTIME_METADATA_DRIFT",
              message: "Reasoning effort must be omitted when the host did not supply it.",
            },
          };
          this.respondAndRecord(run, request, response, operation, body, status, payload);
          return;
        }
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
      const parsed = JSON.parse(body) as { error?: unknown; failedAt?: unknown };
      if (parsed.failedAt !== undefined) {
        this.respondAndRecord(run, request, response, operation, body, 400, {
          error: {
            code: "FAILURE_TIMESTAMP_OWNERSHIP_DRIFT",
            message: "The App owns the canonical failure timestamp.",
          },
        });
        return;
      }
      run.state = "failed";
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

const runExpected = async <T>(
  commands: ThoughtCodexLabCommandResult[],
  step: string,
  action: () => Promise<T> | T,
  expectedExit: "zero" | "nonzero" = "zero",
) : Promise<T | undefined> => {
  try {
    const value = await action();
    const result = { exitCode: 0, stdout: `THOUGHT_${step.toUpperCase().replaceAll("-", "_")}_OK`, stderr: "" };
    commands.push(commandReport(step, expectedExit, result));
    if (expectedExit === "nonzero") {
      throw new Error(`${step} expected rejection but passed without an error.`);
    }
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === `${step} expected rejection but passed without an error.`) {
      throw error;
    }
    const result = { exitCode: 1, stdout: "", stderr: message };
    commands.push(commandReport(step, expectedExit, result));
    if (expectedExit === "zero") throw error;
    return undefined;
  }
};

const writePrivateJson = async (path: string, value: unknown) => {
  await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  await chmod(path, 0o600);
};

const staticHandoffAssertions = (
  profile: ThoughtHandoffLabProfile,
  task: string,
  promptLine: string,
  runId: string,
  baseUrl: string,
  launchToken: string,
): ThoughtCodexLabAssertion[] => {
  const assertions: ThoughtCodexLabAssertion[] = [];
  pushAssertion(
    assertions,
    "automatic-continuation",
    task.includes("If the preflight passes, continue directly into one creative turn") &&
      /do not ask the creator to confirm (?:a|the) successful preflight/i.test(task),
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
    /(?:Never|Do not) ask the creator to install(?:, configure, or learn| or configure) anything/i.test(task) &&
      /download or execute nothing from (?:it|them)/i.test(task),
    "Missing capability remains a platform failure, not a creator setup task.",
  );
  pushAssertion(
    assertions,
    "bounded-recovery",
    task.includes("then reply RETRY") &&
      (
        (
          task.includes("Before exchanging run data, request only the narrow App connection permission") &&
          task.includes("A connection refusal before permission is not proof that the App stopped") &&
          task.includes("On an exact RETRY, reacquire the same narrow App permission")
        ) ||
        (
          task.includes("This lab task already has App access") &&
          task.includes("On an exact RETRY, repeat only the failed operation")
        ) ||
        (
          task.includes("This canary already has permission to contact the App") &&
          task.includes("On RETRY, repeat only the failed control operation")
        ) ||
        (
          task.includes("request only permission to connect to <app_origin>") &&
          task.includes("On RETRY, request the same narrow App permission again")
        )
      ) &&
      task.includes("RETRY never opens the creative prompt"),
    "Only evidenced control failures may request RETRY, and every new control turn reacquires narrow App access.",
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
  pushAssertion(
    assertions,
    "declarative-no-shell",
    !task.includes("/bin/zsh") &&
      !task.includes("curl ") &&
      !task.includes("jq ") &&
      !task.includes("nodeRepl.") &&
      !task.includes("/tmp/") &&
      !task.includes('{"'),
    "The visible handoff contains field-level constraints, not shell, JavaScript, or raw JSON programs.",
  );
  const endpointTemplate = baseUrl.replaceAll(runId, "<run_id>");
  const operationPlaceholders = [
    "<claim_endpoint>",
    "<ready_endpoint>",
    "<start_endpoint>",
    "<result_endpoint>",
    "<fail_endpoint>",
  ];
  pushAssertion(
    assertions,
    "defined-placeholders",
    task.includes(`<run_id> = ${runId}`) &&
      task.includes(`<app_endpoint> = ${endpointTemplate}`) &&
      task.includes(`<launch_credential> = ${launchToken}`) &&
      (
        task.includes("Define <bridge_credential> as that exact bridgeToken") ||
        task.includes("Call the returned bridgeToken <bridge_credential>")
      ) &&
      operationPlaceholders.every((operation) => task.includes(operation)),
    "Concrete private values are defined once and operations use conventional angle-bracket placeholders.",
  );
  pushAssertion(
    assertions,
    "bridge-credential-lifecycle",
    (
      task.includes("Retain it with the complete claim response before validation") ||
      task.includes("Retain it before validating the rest of the claim")
    ) &&
      /reuse it for (?:every|the) remaining operations?/i.test(task) &&
      (
        task.includes("Never claim again") ||
        task.includes("do not claim this run twice")
      ) &&
      (
        task.includes("Keep launch and bridge credentials private") ||
        /bearer values are one-run authorization values/i.test(task) ||
        task.includes("The bearer values protect this one run")
      ) &&
      (
        profile.id === "codex"
          ? task.includes("Prove readiness at <ready_endpoint> with POST, <bridge_credential>") &&
            task.includes("Open the creative phase at <start_endpoint> with POST, <bridge_credential>") &&
            task.includes("Return at <result_endpoint> with PUT, <bridge_credential>") &&
            task.includes("report AGENT_START_FAILED at <fail_endpoint> with POST, <bridge_credential>")
          : task.includes("At <ready_endpoint>, submit one POST using <bridge_credential>") &&
            task.includes("At <start_endpoint>, submit one POST using <bridge_credential>") &&
            task.includes("At <result_endpoint>, submit one PUT using <bridge_credential>")
      ),
    "The one-time top-level bridgeToken is retained before secondary validation and reused privately through terminal delivery.",
  );
  pushAssertion(
    assertions,
    "exact-nested-field-paths",
    task.includes("<bridge_id> = inshell-thought-agent-direct") &&
      task.includes(`<bridge_version> = ${profile.bridgeVersion}`) &&
      task.includes(`<bridge_platform> = ${profile.bridgePlatform}`) &&
      task.includes(`<adapter_id> = ${profile.id}`) &&
      task.includes(`<adapter_version> = ${profile.adapterVersion}`) &&
      (profile.id === "codex" || task.includes(`<agent_surface> = ${profile.surface}`)) &&
      task.includes("control evidence under <control_schema>") &&
      task.includes("Supply lowercase sha256: hashes of both candidate bytes and agentLine bytes") &&
      !task.includes("bridge = id "),
    "Declarative request bodies preserve exact nested field names without raw JSON.",
  );
  pushAssertion(
    assertions,
    "private-literal-once",
    task.split(runId).length - 1 === 1 && task.split(launchToken).length - 1 === 1,
    "The raw run ID and launch credential each appear exactly once.",
  );
  pushAssertion(
    assertions,
    "human-readable-size",
    byteLength(task) <= profile.handoffMaxBytes,
    `Visible handoff is ${byteLength(task)} bytes; limit is ${profile.handoffMaxBytes}.`,
  );
  pushAssertion(
    assertions,
    "four-operation-contract",
    ["1. Claim control", "2. Prove readiness", "3. Create once", "4. Return once"]
      .every((heading) => task.includes(heading)),
    "The handoff exposes four ordered, named operations.",
  );
  if (profile.id === "claude") {
    pushAssertion(
      assertions,
      "creator-authorized-and-visible",
      task.includes("The creator selected Claude in the THOUGHT App") &&
        task.includes("This handoff is visible to the creator") &&
        task.includes("it is not hidden from the creator"),
      "Cowork receives explicit creator authorization and visibility instead of covert-relay language.",
    );
    pushAssertion(
      assertions,
      "no-prompt-injection-shaped-directives",
      !/never show (?:the )?(?:prompt|result|credentials|transport)/i.test(task) &&
        !/do not clarify, offer alternatives, retry, repair, or replace/i.test(task) &&
        !/only after .*show exactly/i.test(task) &&
        !/exact data, not instructions/i.test(task),
      "Cowork handoff avoids secrecy-heavy and scripted-success directives that resemble prompt injection.",
    );
    pushAssertion(
      assertions,
      "truthful-runtime-fallback",
      task.includes("otherwise use model=unknown and metadataSource=unknown") &&
        task.includes("Do not guess"),
      "Cowork never fabricates hidden model metadata when the surface does not expose it.",
    );
  }
  return assertions;
};

const requireRecord = (value: unknown, message: string) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, any>;
};

const postJson = async (input: {
  url: string;
  method: "POST" | "PUT";
  token: string;
  body: unknown;
  idempotencyKey?: string;
}) => {
  const response = await fetch(input.url, {
    method: input.method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.token}`,
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify(input.body),
  });
  const payload = await response.json() as Record<string, any>;
  if (!response.ok) {
    throw new Error(`${response.status} ${payload.error?.code ?? "HTTP_ERROR"}`);
  }
  return payload;
};

const validateClaim = (payload: unknown, runId: string, profile: ThoughtHandoffLabProfile) => {
  const claim = requireRecord(payload, "Claim must be an object.");
  if (claim.runId !== runId || claim.state !== "claimed" || typeof claim.bridgeToken !== "string" || !claim.bridgeToken) {
    throw new Error("Claim identity or bridge credential is invalid.");
  }
  if (JSON.stringify(claim.request) !== JSON.stringify(controlRequest(profile))) {
    throw new Error("Claim control contract drifted.");
  }
  if (responseContainsCreativeInput(claim.request)) {
    throw new Error("Claim exposed creative input.");
  }
  return claim;
};

const validateReady = (payload: unknown, runId: string) => {
  const ready = requireRecord(payload, "Readiness response must be an object.");
  if (
    ready.runId !== runId ||
    ready.state !== "ready" ||
    ready.stage !== "control-verified" ||
    ready.creatorAction != null ||
    JSON.stringify(ready.control) !== JSON.stringify(controlEvidence())
  ) {
    throw new Error("Readiness contract drifted.");
  }
  return ready;
};

const validateCreative = (payload: unknown, runId: string, invocationId: string) => {
  const running = requireRecord(payload, "Creative response must be an object.");
  const request = requireRecord(running.request, "Creative request is missing.");
  if (
    running.runId !== runId ||
    running.state !== "running" ||
    running.invocationId !== invocationId ||
    request.intent !== "generate-thought-candidate"
  ) {
    throw new Error("Creative response identity drifted.");
  }
  const instructions = requireRecord(request.instructions, "Instructions are missing.");
  const spec = requireRecord(request.spec, "Spec is missing.");
  const prompt = requireRecord(request.promptLine, "Prompt is missing.");
  const agentInput = requireRecord(request.agentInput, "Agent input is missing.");
  if (
    spec.id !== THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId ||
    spec.contractSpecId !== THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId ||
    spec.contractSpecHash !== THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash ||
    spec.text !== THOUGHT_V2_PROTOCOL_RELEASE.spec.text ||
    spec.sha256 !== `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}` ||
    spec.sha256 !== sha256(String(spec.text)) ||
    instructions.id !== THOUGHT_AGENT_CREATIVE_BRIEF.id ||
    instructions.artifactId !== THOUGHT_AGENT_CREATIVE_BRIEF.artifactId ||
    instructions.text !== THOUGHT_AGENT_CREATIVE_BRIEF.text ||
    instructions.sha256 !== `sha256:${THOUGHT_AGENT_CREATIVE_BRIEF.sha256}` ||
    instructions.sha256 !== sha256(String(instructions.text)) ||
    instructions.text === spec.text ||
    instructions.sha256 === spec.sha256 ||
    prompt.text !== agentInput.text ||
    prompt.sha256 !== agentInput.sha256 ||
    prompt.sha256 !== sha256(String(prompt.text))
  ) {
    throw new Error("Creative byte or hash parity failed.");
  }
  const outputContract = requireRecord(request.outputContract, "Output contract is missing.");
  const agentLine = requireRecord(outputContract.agentLine, "Agent line contract is missing.");
  if (
    JSON.stringify(outputContract.release) !== JSON.stringify(FIXTURE_RELEASE) ||
    agentLine.workProfile !== FIXTURE_RESULT_CONTRACT.workProfile ||
    agentLine.minUtf8Bytes !== THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes ||
    agentLine.maxUtf8Bytes !== THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes ||
    agentLine.normalization !== THOUGHT_AGENT_LINE_CONTRACT.normalization ||
    agentLine.displayUnitsAreAcceptanceLimits !== false
  ) {
    throw new Error("Creative output contract drifted.");
  }
  return running;
};

const runDeterministicCase = async (
  profile: ThoughtHandoffLabProfile,
  server: ThoughtCodexFixtureServer,
  definition: ThoughtCodexLabCaseDefinition,
): Promise<ThoughtCodexLabCaseReport> => {
  const startedAt = new Date().toISOString();
  const run = server.register(definition);
  const runUrl = `${server.origin}/runs/${encodeURIComponent(run.runId)}`;
  const taskInput = {
    product: profile.agent,
    runId: run.runId,
    runUrl,
    launchToken: run.launchToken,
    networkAuthorization: "preauthorized",
    release: FIXTURE_RELEASE,
    resultContract: FIXTURE_RESULT_CONTRACT,
  } as const;
  const contract = profile.buildOperationContract(taskInput);
  const task = profile.buildTask(taskInput);
  const commands: ThoughtCodexLabCommandResult[] = [];
  const assertions = staticHandoffAssertions(
    profile,
    task,
    definition.promptLine,
    run.runId,
    runUrl,
    run.launchToken,
  );
  const { bridge, adapter, execution, invocationId } = contract;

  const claimPayload = await runExpected(commands, "claim", () => postJson({
    url: contract.endpoints.claim,
    method: "POST",
    token: run.launchToken,
    body: contract.claim,
  }));
  if (!claimPayload) throw new Error("Claim request did not return a payload.");
  const validatedClaim = await runExpected(
    commands,
    "validate-claim",
    () => validateClaim(claimPayload, run.runId, profile),
    definition.fault === "malformed-claim" ? "nonzero" : "zero",
  );
  if (definition.fault !== "malformed-claim") {
    if (!validatedClaim) throw new Error("Claim validation did not return a payload.");
    const bridgeToken = String(validatedClaim.bridgeToken);
    if (definition.fault === "runtime-capability-unavailable") {
      const failurePayload = await runExpected(commands, "post-failure", () => postJson({
        url: contract.endpoints.fail,
        method: "POST",
        token: bridgeToken,
        body: {
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          error: {
            code: "AGENT_START_FAILED",
            message: `${profile.agent} could not prepare this run. Return to THOUGHT and choose ${profile.agent} again.`,
          },
        },
      }));
      await runExpected(commands, "validate-failure", () => {
        if (failurePayload?.runId !== run.runId || failurePayload.state !== "failed" || failurePayload.error?.code !== "AGENT_START_FAILED") {
          throw new Error("Failure response drifted.");
        }
      });
    } else {
      const readyPayload = await runExpected(commands, "post-ready", () => postJson({
        url: contract.endpoints.ready,
        method: "POST",
        token: bridgeToken,
        body: contract.ready,
      }));
      if (!readyPayload) throw new Error("Readiness request did not return a payload.");
      const validatedReady = await runExpected(
        commands,
        "validate-ready",
        () => validateReady(readyPayload, run.runId),
        definition.fault === "malformed-ready" ? "nonzero" : "zero",
      );
      if (definition.fault !== "malformed-ready") {
        if (!validatedReady) throw new Error("Readiness validation did not return a payload.");
        const startedAtValue = new Date().toISOString();
        const startPayload = await runExpected(commands, "post-start", () => postJson({
          url: contract.endpoints.start,
          method: "POST",
          token: bridgeToken,
          body: {
            protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
            invocationId,
            startedAt: startedAtValue,
          },
        }));
        if (!startPayload) throw new Error("Creative start did not return a payload.");
        const validatedCreative = await runExpected(
          commands,
          "validate-creative",
          () => validateCreative(startPayload, run.runId, invocationId),
          definition.fault === "malformed-creative-release" ? "nonzero" : "zero",
        );
        if (definition.fault !== "malformed-creative-release") {
          if (!validatedCreative) throw new Error("Creative validation did not return a payload.");
          const candidate = {
            ...contract.candidateTemplate,
            agentLine: definition.agentLine,
          };
          const raw = JSON.stringify(candidate);
          const resultBody = {
            protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
            invocationId,
            bridge,
            adapter,
            agent: {
              product: profile.agent,
              productVersion: "unknown",
              provider: profile.provider,
              model: profile.model,
              ...(definition.fault === "runtime-effort-unavailable"
                ? {}
                : { reasoningEffort: "high" }),
              metadataSource: "reported",
            },
            execution,
            startedAt: startedAtValue,
            completedAt: new Date().toISOString(),
            output: {
              mediaType: "application/json",
              raw,
              rawSha256: sha256(raw),
              agentLine: definition.agentLine,
              agentLineSha256: sha256(definition.agentLine),
            },
          };
          const resultPayload = await runExpected(
            commands,
            "post-result",
            () => postJson({
              url: contract.endpoints.result,
              method: "PUT",
              token: bridgeToken,
              idempotencyKey: invocationId,
              body: resultBody,
            }),
            definition.fault === "result-rejected" ? "nonzero" : "zero",
          );
          if (definition.fault !== "result-rejected") {
            await runExpected(commands, "validate-receipt", () => {
              if (
                resultPayload?.runId !== run.runId ||
                resultPayload.state !== "returned" ||
                typeof resultPayload.result?.receipt?.receiptSha256 !== "string" ||
                !resultPayload.result.receipt.receiptSha256.startsWith("sha256:")
              ) {
                throw new Error("Result receipt drifted.");
              }
              return "THOUGHT_RESULT_OK";
            });
          }
        }
      }
    }
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
  const claimCount = operations.filter((operation) => operation === "claim").length;
  pushAssertion(
    assertions,
    "single-claim",
    claimCount === 1,
    `Observed ${claimCount} claim request${claimCount === 1 ? "" : "s"}.`,
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
  const successMarker = run.state === "returned" && commands.some((command) => command.step === "validate-receipt" && command.exitCode === 0);
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
    schema: profile.reportVersion,
    labVersion: profile.labVersion,
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

const canonicalCandidateTask = (profile: ThoughtHandoffLabProfile) =>
  profile.buildTask({
    product: profile.agent,
    runId: "tar_handoff_candidate",
    runUrl: "https://handoff-lab.invalid/runs/tar_handoff_candidate",
    launchToken: "sealed-launch-token-placeholder",
    networkAuthorization: "managed",
    release: FIXTURE_RELEASE,
    resultContract: FIXTURE_RESULT_CONTRACT,
  });

export const renderThoughtAgentLabMarkdown = (
  report: ThoughtCodexLabBatchReport,
) => {
  const lines = [
    `# ${report.agent} Handoff Lab Report`,
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

export const renderThoughtCodexLabMarkdown = renderThoughtAgentLabMarkdown;

type ThoughtDeterministicLabOptions = {
  outputDir: string;
  caseIds?: readonly ThoughtCodexLabCaseId[];
  sourceCommit: string;
  sourceDirty: boolean;
  generatorPath: string;
};

const runThoughtDeterministicLab = async (
  profile: ThoughtHandoffLabProfile,
  options: ThoughtDeterministicLabOptions,
) => {
  const startedAt = new Date().toISOString();
  const batchId = `${profile.id}-handoff-${startedAt.replaceAll(/[:.]/g, "-")}`;
  const selected = options.caseIds?.length
    ? THOUGHT_CODEX_HANDOFF_CASES.filter((entry) => options.caseIds?.includes(entry.id))
    : [...THOUGHT_CODEX_HANDOFF_CASES];
  if (selected.length === 0) {
    throw new Error(`No ${profile.agent} handoff lab cases selected.`);
  }
  const server = new ThoughtCodexFixtureServer(profile);
  await server.start();
  const cases: ThoughtCodexLabCaseReport[] = [];
  try {
    for (const definition of selected) {
      cases.push(await runDeterministicCase(profile, server, definition));
    }
  } finally {
    await server.close();
  }
  const canonicalTask = canonicalCandidateTask(profile);
  const generatorBytes = await readFile(options.generatorPath, "utf8");
  const report: ThoughtCodexLabBatchReport = {
    schema: profile.reportVersion,
    labVersion: profile.labVersion,
    agent: profile.agent,
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
  await writeFile(join(outputDir, "report.md"), renderThoughtAgentLabMarkdown(report));
  return { outputDir, report };
};

export const runThoughtCodexDeterministicLab = (options: ThoughtDeterministicLabOptions) =>
  runThoughtDeterministicLab(CODEX_LAB_PROFILE, options);

export const runThoughtClaudeDeterministicLab = (options: ThoughtDeterministicLabOptions) =>
  runThoughtDeterministicLab(CLAUDE_LAB_PROFILE, options);

export type ThoughtCodexRealCanarySession = {
  schema: string;
  labVersion: string;
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
    product: CODEX_LAB_PROFILE.agent,
    runId: payload.runId,
    runUrl: statusUrl,
    launchToken,
    networkAuthorization: "managed",
    release: options.release,
    resultContract: options.resultContract,
  });
  if (byteLength(task) > THOUGHT_CODEX_HANDOFF_MAX_BYTES) {
    throw new Error(
      `Codex canary handoff is ${byteLength(task)} bytes; limit is ${THOUGHT_CODEX_HANDOFF_MAX_BYTES}.`,
    );
  }
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


export type ThoughtClaudeRealCanarySession = {
  schema: string;
  labVersion: string;
  mode: "real-canary";
  agent: "Claude Desktop";
  surface: ThoughtClaudeSurface;
  origin: string;
  handoffRevision: typeof THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION;
  runId: string;
  statusUrl: string;
  browserToken: string;
  taskSha256: string;
  taskByteLength: number;
  taskPath: string;
  claudeUrlPath: string;
  createdAt: string;
  promptLine: string;
};

export const buildClaudeDeepLink = (
  task: string,
  surface: ThoughtClaudeSurface = "cowork",
) => {
  const parameters = new URLSearchParams({ q: task });
  return `claude://${surface}/new?${parameters.toString()}`;
};

export const prepareThoughtClaudeRealCanary = async (options: {
  origin: string;
  outputDir: string;
  promptLine: string;
  specId: string;
  release: ThoughtCodexReleaseBinding;
  resultContract: ThoughtCodexResultContractBinding;
  surface?: ThoughtClaudeSurface;
}) => {
  const origin = options.origin.replace(/\/+$/g, "");
  const surface = options.surface ?? "cowork";
  if (surface === "cowork" && !isThoughtClaudeCoworkPublicHttpsOrigin(origin)) {
    throw new Error(
      "Claude Cowork canary requires an explicit publicly reachable HTTPS --origin. Localhost and LAN origins are structurally unreachable from Cowork; use --surface code for local testing.",
    );
  }
  const response = await fetch(`${origin}/api/thought-agent/v2/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine: options.promptLine,
      specId: options.specId,
      requestedAgent: { adapterId: "claude", model: null },
      client: { surface: "thought-claude-handoff-lab", appVersion: "v1" },
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
      `${response.status} ${payload.error?.code ?? "CANARY_CREATE_FAILED"}: ${payload.error?.message ?? "Could not create Claude canary."}`,
    );
  }
  const launchToken = new URL(payload.launchUri).searchParams.get("token") ?? "";
  if (!launchToken) throw new Error("Claude canary launch token missing.");
  const statusUrl = new URL(payload.statusUrl, origin).toString().replace(/\/+$/g, "");
  const task = buildThoughtClaudeTask({
    product: "Claude",
    runId: payload.runId,
    runUrl: statusUrl,
    launchToken,
    networkAuthorization: "managed",
    surface,
    release: options.release,
    resultContract: options.resultContract,
  });
  if (byteLength(task) > THOUGHT_CLAUDE_HANDOFF_MAX_BYTES) {
    throw new Error(
      `Claude canary handoff is ${byteLength(task)} bytes; limit is ${THOUGHT_CLAUDE_HANDOFF_MAX_BYTES}.`,
    );
  }
  const sessionDir = resolve(options.outputDir, payload.runId);
  await mkdir(sessionDir, { recursive: true });
  const taskPath = join(sessionDir, "sealed-task.txt");
  const claudeUrlPath = join(sessionDir, "claude-url.txt");
  const sessionPath = join(sessionDir, "session.json");
  const claudeUrl = buildClaudeDeepLink(task, surface);
  await writeFile(taskPath, task, { mode: 0o600 });
  await writeFile(claudeUrlPath, claudeUrl, { mode: 0o600 });
  const session: ThoughtClaudeRealCanarySession = {
    schema: THOUGHT_CLAUDE_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CLAUDE_HANDOFF_LAB_VERSION,
    mode: "real-canary",
    agent: "Claude Desktop",
    surface,
    origin,
    handoffRevision: THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION,
    runId: payload.runId,
    statusUrl,
    browserToken: payload.browserToken,
    taskSha256: sha256(task),
    taskByteLength: byteLength(task),
    taskPath,
    claudeUrlPath,
    createdAt: new Date().toISOString(),
    promptLine: options.promptLine,
  };
  await writePrivateJson(sessionPath, session);
  return { claudeUrl, session, sessionDir, sessionPath };
};

export const observeThoughtClaudeRealCanary = async (options: {
  sessionPath: string;
  timeoutMs: number;
  pollMs?: number;
  creatorActions?: string;
}) => {
  const session = JSON.parse(await readFile(options.sessionPath, "utf8")) as
    ThoughtClaudeRealCanarySession;
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
  const receiptSha256 = result?.receipt?.receiptSha256 ?? null;
  const qualificationEligible = session.surface === "cowork" &&
    session.handoffRevision === THOUGHT_CLAUDE_COWORK_HANDOFF_REVISION &&
    isThoughtClaudeCoworkPublicHttpsOrigin(session.origin) &&
    terminal &&
    payload.state === "returned" &&
    typeof receiptSha256 === "string" &&
    receiptSha256.startsWith("sha256:");
  const report = {
    schema: THOUGHT_CLAUDE_HANDOFF_REPORT_VERSION,
    labVersion: THOUGHT_CLAUDE_HANDOFF_LAB_VERSION,
    mode: "real-canary",
    agent: "Claude Desktop",
    surface: session.surface,
    origin: session.origin,
    handoffRevision: session.handoffRevision,
    runId: session.runId,
    taskSha256: session.taskSha256,
    taskByteLength: session.taskByteLength,
    terminal,
    state: payload.state ?? "timeout",
    stage: payload.stage ?? null,
    receiptSha256,
    model: result?.receipt?.model ?? null,
    reasoningEffort: result?.receipt?.reasoningEffort ?? null,
    launchSubmission: "creator-clicked-submit",
    controlActions: options.creatorActions ?? "not-recorded",
    agentLineSha256: result?.agentLine ? sha256(result.agentLine) : null,
    privateArtifactsRemoved: terminal,
    qualificationEligible,
    startedAt,
    completedAt: new Date().toISOString(),
  };
  const reportPath = join(dirname(options.sessionPath), "real-canary-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (terminal) {
    await Promise.all([
      options.sessionPath,
      session.taskPath,
      session.claudeUrlPath,
    ].map((path) => rm(path, { force: true })));
  }
  return { report, reportPath };
};

export const thoughtCodexCanonicalCandidate = () => canonicalCandidateTask(CODEX_LAB_PROFILE);
export const thoughtClaudeCanonicalCandidate = () => canonicalCandidateTask(CLAUDE_LAB_PROFILE);

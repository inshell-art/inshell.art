import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { URL } from "node:url";
import {
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_OUTPUT_SCHEMA,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RECEIPT_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_AGENT_ERROR_CODES,
  THOUGHT_V2_PROTOCOL_RELEASE,
  ThoughtAgentProtocolError,
  assertThoughtLine,
  assertProtocolVersion,
  buildThoughtCodexClientScript,
  buildThoughtAgentInput,
  buildThoughtAgentReceipt,
  isThoughtSha256,
  parseAdapterInfo,
  parseAgentOutput,
  parseBridgeInfo,
  parseResultRequest,
  sha256Hex,
  type ThoughtAgentAdapterInfo,
  type ThoughtAgentBridgeInfo,
  type ThoughtAgentExecutionInfo,
  type ThoughtAgentInfo,
  type ThoughtAgentState,
  type ThoughtSha256,
} from "../../packages/thought-agent-protocol/src/index";
import type { RollupLog, RollupLogHandler } from "rollup";

function ignoreKnownRollupWarnings(warning: RollupLog, warn: RollupLogHandler) {
  if (
    warning.code === "INVALID_ANNOTATION" &&
    warning.message.includes("contains an annotation that Rollup cannot interpret")
  ) {
    return;
  }
  warn(warning);
}

function readDevApiOrigin() {
  return process.env.INSHELL_THOUGHT_DEV_API_ORIGIN?.trim() || "https://thought.inshell.art";
}

function normalizeViteBase(value: string | undefined) {
  const raw = value?.trim();
  if (!raw || raw === "/") return "/";
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function readOutDir(rootDir: string) {
  const configured = process.env.INSHELL_THOUGHT_OUT_DIR?.trim();
  return path.resolve(rootDir, configured || "../../dist/thought");
}

function existingRealPaths(paths: string[]) {
  return paths.flatMap((candidate) => {
    if (!fs.existsSync(candidate)) return [];
    return [fs.realpathSync(candidate)];
  });
}

type DevThoughtAgentRun = {
  runId: string;
  state: ThoughtAgentState;
  webOrigin: string;
  requestedAdapterId: string;
  requestedModel: string | null;
  specId: string;
  specRef: string;
  specSha256: ThoughtSha256;
  contractSpecHash: string | null;
  specText: string;
  promptText: string;
  promptSha256: ThoughtSha256;
  agentInputText: string;
  agentInputSha256: ThoughtSha256;
  browserToken: string;
  launchToken: string | null;
  claimAuthorization: DevThoughtClaimAuthorization | null;
  bridgeToken: string | null;
  bridge: ThoughtAgentBridgeInfo | null;
  adapter: ThoughtAgentAdapterInfo | null;
  agent: ThoughtAgentInfo | null;
  execution: ThoughtAgentExecutionInfo | null;
  invocationId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rawResult: string | null;
  rawResultSha256: ThoughtSha256 | null;
  agentLine: string | null;
  agentLineSha256: ThoughtSha256 | null;
  receiptJson: string | null;
  receiptSha256: ThoughtSha256 | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  claimExpiresAt: string;
  runExpiresAt: string;
};

type DevThoughtClaimAuthorization = {
  claimRequestId: string;
  claimRequestToken: string;
  state: "pending" | "authorized" | "consumed";
  verificationCode: string;
  bridge: ThoughtAgentBridgeInfo;
  adapter: ThoughtAgentAdapterInfo;
  createdAt: string;
  expiresAt: string;
  authorizedAt: string | null;
};

const DEV_AGENT_API_PREFIXES = ["/api/thought-agent/v1", "/api/thought-agent/v2"] as const;
const DEV_AGENT_SPEC_ID = THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId;
const DEV_AGENT_SPEC_REF = THOUGHT_V2_PROTOCOL_RELEASE.spec.ref;
const DEV_AGENT_CLAIM_TTL_MS = 5 * 60 * 1000;
const DEV_AGENT_CLAIM_AUTHORIZATION_TTL_MS = 2 * 60 * 1000;
const DEV_AGENT_RUN_TTL_MS = 10 * 60 * 1000;
const DEV_AGENT_BRIDGE_ID = "inshell-thought-bridge-dev";
const DEV_AGENT_BRIDGE_VERSION = "0.1.0-dev";
const DEV_AGENT_ADAPTER_VERSION = "codex-cli";
const DEV_AGENT_CODEX_BIN = process.env.THOUGHT_BRIDGE_CODEX_BIN || "codex";
const DEV_AGENT_CODEX_TIMEOUT_MS = Number(process.env.THOUGHT_BRIDGE_CODEX_TIMEOUT_MS || 180000);
const DEV_AGENT_CODEX_AUTORUN = process.env.INSHELL_THOUGHT_DEV_CODEX_AUTORUN === "1";
const DEV_AGENT_FAKE_WORK = process.env.THOUGHT_BRIDGE_FAKE_WORK || "";
const DEV_AGENT_MAX_REQUEST_BYTES = 32 * 1024;

function expireDevAgentRun(run: DevThoughtAgentRun) {
  if (["returned", "failed", "cancelled", "expired"].includes(run.state)) return;
  const expiresAt = run.state === "created" ? run.claimExpiresAt : run.runExpiresAt;
  const deadline = Date.parse(expiresAt);
  if (Number.isFinite(deadline) && Date.now() >= deadline) {
    run.state = "expired";
    run.launchToken = null;
    run.updatedAt = new Date().toISOString();
  }
}

function randomToken(byteLength = 24) {
  return crypto.randomBytes(byteLength).toString("base64url");
}

function runId() {
  return `tar_${randomToken(18)}`;
}

function verificationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function protocolJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  res.end(JSON.stringify({ protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION, ...body }));
}

function protocolError(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
) {
  protocolJson(res, status, { error: { code, message } });
}

function normalizeDevAgentFailureMessage(message: string) {
  const trimmed = message.trim();
  if (/failed to fetch|network|connection refused|could not connect|econnrefused/i.test(trimmed)) {
    return "Codex could not reach the THOUGHT Agent API. Retry the protocol HTTP calls with curl against the local URL.";
  }
  return trimmed || "The agent run failed.";
}

function bearerToken(req: IncomingMessage) {
  const value = String(req.headers.authorization ?? "");
  return /^Bearer\s+(.+)$/i.exec(value.trim())?.[1] ?? null;
}

function verifyBearer(req: IncomingMessage, token: string | null) {
  return Boolean(token && bearerToken(req) === token);
}

function readBody(req: IncomingMessage, maxBytes = DEV_AGENT_MAX_REQUEST_BYTES) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let byteLength = 0;
    let settled = false;
    req.on("data", (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      byteLength += buffer.byteLength;
      if (byteLength > maxBytes) {
        settled = true;
        reject(new ThoughtAgentProtocolError("RESULT_TOO_LARGE", "Request body is too large."));
        return;
      }
      chunks.push(buffer);
    });
    req.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks).toString("utf8"));
      }
    });
  });
}

async function readJson(req: IncomingMessage, maxBytes = DEV_AGENT_MAX_REQUEST_BYTES) {
  const raw = await readBody(req, maxBytes);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON body must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new ThoughtAgentProtocolError("AGENT_OUTPUT_UNPARSEABLE", "Invalid JSON body.");
  }
}

function requireIsoLikeDev(value: unknown, field: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ThoughtAgentProtocolError("AGENT_OUTPUT_SCHEMA_INVALID", `Invalid ${field}.`);
  }
  return value;
}

function devFailureCode(value: unknown): string {
  return typeof value === "string" && THOUGHT_AGENT_ERROR_CODES.includes(value as never)
    ? value
    : "AGENT_START_FAILED";
}

function requestOrigin(req: IncomingMessage) {
  const headerOrigin = String(req.headers.origin ?? "").trim();
  if (headerOrigin) return headerOrigin;
  const host = String(req.headers.host ?? "127.0.0.1:5174");
  return `http://${host}`;
}

function stageForState(state: ThoughtAgentState) {
  switch (state) {
    case "created":
      return "waiting-for-bridge";
    case "claimed":
      return "bridge-claimed";
    case "running":
      return "agent-running";
    default:
      return state;
  }
}

function statusPayload(run: DevThoughtAgentRun) {
  const base: Record<string, unknown> = {
    runId: run.runId,
    state: run.state,
    stage: stageForState(run.state),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    expiresAt: run.state === "created" ? run.claimExpiresAt : run.runExpiresAt,
    request: {
      promptLine: {
        text: run.promptText,
        sha256: run.promptSha256,
      },
      requestedAgent: {
        adapterId: run.requestedAdapterId,
        model: run.requestedModel,
      },
      thoughtSpec: {
        id: run.specId,
        ref: run.specRef,
        sha256: run.specSha256,
        contractSpecHash: run.contractSpecHash,
      },
      agentInput: {
        mediaType: "text/plain; charset=utf-8",
        text: run.agentInputText,
        sha256: run.agentInputSha256,
      },
    },
  };
  if (run.state === "returned") {
    base.result = {
      raw: run.rawResult,
      agentLine: run.agentLine,
      receipt: {
        receiptVersion: THOUGHT_AGENT_RECEIPT_VERSION,
        receiptSha256: run.receiptSha256,
        adapterId: run.requestedAdapterId,
        model: run.agent?.model ?? "unknown",
        providerAttested: false,
      },
    };
    base.validation = {
      status: "pending",
      canonicalText: null,
      error: null,
    };
  }
  if (run.state === "failed") {
    base.error = {
      code: run.errorCode,
      message: run.errorMessage,
    };
  }
  if (
    run.state === "created" &&
    run.claimAuthorization &&
    run.claimAuthorization.state !== "consumed" &&
    Date.parse(run.claimAuthorization.expiresAt) > Date.now()
  ) {
    base.claimAuthorization = {
      state: run.claimAuthorization.state,
      claimRequestId: run.claimAuthorization.claimRequestId,
      verificationCode: run.claimAuthorization.verificationCode,
      bridge: {
        bridgeId: run.claimAuthorization.bridge.bridgeId,
        platform: run.claimAuthorization.bridge.platform,
      },
      adapter: {
        adapterId: run.claimAuthorization.adapter.adapterId,
        adapterVersion: run.claimAuthorization.adapter.adapterVersion,
      },
      requestedAt: run.claimAuthorization.createdAt,
      expiresAt: run.claimAuthorization.expiresAt,
      authorizedAt: run.claimAuthorization.authorizedAt,
    };
  }
  return base;
}

function claimRequestPayload(run: DevThoughtAgentRun) {
  return {
    intent: "generate-thought-candidate",
    requestedAgent: {
      adapterId: run.requestedAdapterId,
      model: run.requestedModel,
    },
    roundPolicy: {
      maxAgentInvocations: 1,
      maxVisibleTurns: 1,
      allowClarification: false,
      allowFollowUp: false,
      allowAutomaticAgentRetry: false,
    },
    spec: {
      id: run.specId,
      ref: run.specRef,
      contractSpecId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      mediaType: "text/markdown; charset=utf-8",
      text: run.specText,
      sha256: run.specSha256,
      contractSpecHash: run.contractSpecHash,
    },
    instructions: {
      mediaType: "text/markdown; charset=utf-8",
      text: run.specText,
      sha256: run.specSha256,
    },
    promptLine: {
      text: run.promptText,
      sha256: run.promptSha256,
    },
    agentInput: {
      mediaType: "text/plain; charset=utf-8",
      text: run.agentInputText,
      sha256: run.agentInputSha256,
    },
    outputContract: {
      mediaType: "application/json",
      maxRawBytes: 16 * 1024,
      resultSchema: THOUGHT_AGENT_RESULT_VERSION,
      agentLine: THOUGHT_AGENT_LINE_CONTRACT,
      schema: THOUGHT_AGENT_OUTPUT_SCHEMA,
    },
  };
}

function devBridgeInfo(): ThoughtAgentBridgeInfo {
  return {
    bridgeId: DEV_AGENT_BRIDGE_ID,
    bridgeVersion: DEV_AGENT_BRIDGE_VERSION,
    platform: `${process.platform}-${process.arch}`,
  };
}

function devAdapterInfo(): ThoughtAgentAdapterInfo {
  return {
    adapterId: "codex",
    adapterVersion: DEV_AGENT_ADAPTER_VERSION,
  };
}

function devAgentInfo(): ThoughtAgentInfo {
  if (DEV_AGENT_FAKE_WORK) {
    return {
      product: "THOUGHT Bridge dev fake",
      provider: "codex",
      model: "fake-dev",
      metadataSource: "configured",
    };
  }

  return {
    product: "Codex CLI",
    provider: "codex",
    model: "codex",
    metadataSource: "configured",
  };
}

function devExecutionInfo(): ThoughtAgentExecutionInfo {
  return {
    visibleTurns: 1,
    agentInvocations: 1,
    workspacePolicy: DEV_AGENT_FAKE_WORK ? "fake-dev-run" : "empty-temp-dir",
    sandboxPolicy: DEV_AGENT_FAKE_WORK ? "none" : "read-only",
    approvalPolicy: DEV_AGENT_FAKE_WORK ? "none" : "never",
    userConfigPolicy: DEV_AGENT_FAKE_WORK ? "not-used" : "ignored",
  };
}

async function runDevCodex(promptLine: string, specText: string) {
  if (DEV_AGENT_FAKE_WORK) {
    return parseAgentOutput(JSON.stringify({
      schema: THOUGHT_AGENT_RESULT_VERSION,
      agentLine: DEV_AGENT_FAKE_WORK,
    }));
  }

  const runDir = await mkdtemp(path.join(tmpdir(), "thought-bridge-codex-"));
  const schemaPath = path.join(runDir, "output.schema.json");
  const finalPath = path.join(runDir, "final.json");
  const instructionsPath = path.join(runDir, "AGENTS.md");
  await writeFile(schemaPath, JSON.stringify(THOUGHT_AGENT_OUTPUT_SCHEMA, null, 2));
  await writeFile(instructionsPath, specText);

  const args = [
    "--ask-for-approval",
    "never",
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--sandbox",
    "read-only",
    "--skip-git-repo-check",
    "--cd",
    runDir,
    "--output-schema",
    schemaPath,
    "--output-last-message",
    finalPath,
    "--color",
    "never",
    "-",
  ];

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(DEV_AGENT_CODEX_BIN, args, {
        cwd: runDir,
        env: {
          ...process.env,
          NO_COLOR: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Codex run timed out."));
      }, DEV_AGENT_CODEX_TIMEOUT_MS);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
          return;
        }
        const detail = stderr.trim() || stdout.trim() || `exit ${code}`;
        reject(new Error(normalizeDevAgentFailureMessage(`Codex exec failed: ${detail.slice(0, 800)}`)));
      });
      child.stdin.end(promptLine);
    });

    return parseAgentOutput(await readFile(finalPath, "utf8"));
  } finally {
    await rm(runDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function autoRunDevCodex(run: DevThoughtAgentRun) {
  if (run.state !== "created") {
    return;
  }

  run.bridge = devBridgeInfo();
  run.adapter = devAdapterInfo();
  run.bridgeToken = randomToken(32);
  run.claimAuthorization = null;
  run.state = "claimed";
  run.updatedAt = new Date().toISOString();

  run.invocationId = `tai_${crypto.randomUUID().replace(/-/g, "")}`;
  run.startedAt = new Date().toISOString();
  run.state = "running";
  run.updatedAt = run.startedAt;

  try {
    const parsedOutput = await runDevCodex(run.promptText, run.specText);
    run.agent = devAgentInfo();
    run.execution = devExecutionInfo();
    run.completedAt = new Date().toISOString();
    const receipt = await buildThoughtAgentReceipt({
      runId: run.runId,
      origin: run.webOrigin,
      spec: {
        id: run.specId,
        sha256: run.specSha256,
        contractSpecHash: run.contractSpecHash,
      },
      promptSha256: run.promptSha256,
      agentInputSha256: run.agentInputSha256,
      adapter: run.adapter,
      agent: run.agent,
      bridge: run.bridge,
      round: {
        visibleTurns: run.execution.visibleTurns,
        agentInvocations: run.execution.agentInvocations,
        automaticRetry: false,
      },
      output: {
        rawSha256: parsedOutput.rawSha256,
        agentLineSha256: parsedOutput.agentLineSha256,
      },
      timing: {
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      },
    });
    run.rawResult = parsedOutput.raw;
    run.rawResultSha256 = parsedOutput.rawSha256;
    run.agentLine = parsedOutput.agentLine;
    run.agentLineSha256 = parsedOutput.agentLineSha256;
    run.receiptJson = receipt.json;
    run.receiptSha256 = receipt.sha256;
    run.state = "returned";
    run.updatedAt = run.completedAt;
  } catch (error) {
    run.completedAt = new Date().toISOString();
    run.errorCode = "AGENT_START_FAILED";
    run.errorMessage = normalizeDevAgentFailureMessage(error instanceof Error ? error.message : "Codex run failed.");
    run.state = "failed";
    run.updatedAt = run.completedAt;
  }
}

function createThoughtAgentDevApiPlugin() {
  const runs = new Map<string, DevThoughtAgentRun>();
  const specText = THOUGHT_V2_PROTOCOL_RELEASE.spec.text;

  return {
    name: "thought-agent-dev-api",
    enforce: "pre" as const,
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
          const apiPrefix = DEV_AGENT_API_PREFIXES.find((prefix) =>
            requestUrl.pathname === prefix || requestUrl.pathname.startsWith(`${prefix}/`)
          );
          if (!apiPrefix) {
            next();
            return;
          }

          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.setHeader("access-control-allow-origin", "*");
            res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
            res.setHeader("access-control-allow-headers", "authorization, content-type, idempotency-key");
            res.end();
            return;
          }

          const createPath = `${apiPrefix}/runs`;
          const clientPath = `${apiPrefix}/client`;
          const runMatch = new RegExp(`^${apiPrefix}/runs/([^/]+)(?:/([^/]+))?$`).exec(requestUrl.pathname);

          if (requestUrl.pathname === clientPath && req.method === "GET") {
            res.statusCode = 200;
            res.setHeader("access-control-allow-origin", "*");
            res.setHeader("cache-control", "no-store");
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.setHeader("x-content-type-options", "nosniff");
            res.end(buildThoughtCodexClientScript());
            return;
          }

          if (requestUrl.pathname === createPath && req.method === "POST") {
            const body = await readJson(req);
            const requestedAgent = body.requestedAgent as { adapterId?: unknown; model?: unknown } | undefined;
            const devAutoRun = body.devAutoRun === false ? false : DEV_AGENT_CODEX_AUTORUN;
            if (body.protocolVersion !== THOUGHT_AGENT_PROTOCOL_VERSION) {
              protocolError(res, 400, "PROTOCOL_UNSUPPORTED", "Unsupported THOUGHT Agent protocol version.");
              return;
            }
            if (body.specId !== DEV_AGENT_SPEC_ID) {
              protocolError(res, 404, "SPEC_NOT_FOUND", "THOUGHT spec not found.");
              return;
            }
            if (requestedAgent?.adapterId !== "codex") {
              protocolError(res, 400, "ADAPTER_NOT_INSTALLED", "Requested adapter is not supported.");
              return;
            }
            const prompt = typeof body.promptLine === "string" ? body.promptLine : "";
            assertThoughtLine(prompt, "prompt");

            const now = new Date();
            const id = runId();
            const browserToken = randomToken(32);
            const launchToken = randomToken(32);
            const specSha256 = await sha256Hex(specText);
            if (specSha256 !== `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`) {
              protocolError(res, 500, "SPEC_HASH_MISMATCH", "Registered THOUGHT spec source mismatch.");
              return;
            }
            const promptSha256 = await sha256Hex(prompt);
            const agentInput = await buildThoughtAgentInput({ promptLine: prompt });
            const createdAt = now.toISOString();
            const claimExpiresAt = new Date(now.getTime() + DEV_AGENT_CLAIM_TTL_MS).toISOString();
            const runExpiresAt = new Date(now.getTime() + DEV_AGENT_RUN_TTL_MS).toISOString();
            const webOrigin = requestOrigin(req);
            const run: DevThoughtAgentRun = {
              runId: id,
              state: "created",
              webOrigin,
              requestedAdapterId: "codex",
              requestedModel: typeof requestedAgent.model === "string" ? requestedAgent.model : null,
              specId: DEV_AGENT_SPEC_ID,
              specRef: DEV_AGENT_SPEC_REF,
              specSha256,
              contractSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
              specText,
              promptText: prompt,
              promptSha256,
              agentInputText: agentInput.text,
              agentInputSha256: agentInput.sha256,
              browserToken,
              launchToken,
              claimAuthorization: null,
              bridgeToken: null,
              bridge: null,
              adapter: null,
              agent: null,
              execution: null,
              invocationId: null,
              startedAt: null,
              completedAt: null,
              rawResult: null,
              rawResultSha256: null,
              agentLine: null,
              agentLineSha256: null,
              receiptJson: null,
              receiptSha256: null,
              errorCode: null,
              errorMessage: null,
              createdAt,
              updatedAt: createdAt,
              claimExpiresAt,
              runExpiresAt,
            };
            runs.set(id, run);

            protocolJson(res, 201, {
              runId: id,
              state: "created",
              launchUri: `thought://agent/run?run_id=${encodeURIComponent(id)}&token=${encodeURIComponent(launchToken)}&api_origin=${encodeURIComponent(webOrigin)}`,
              browserToken,
              statusUrl: `${apiPrefix}/runs/${id}`,
              createdAt,
              claimExpiresAt,
              devRuntime: "vite-memory",
              devAutoRun,
            });
            if (devAutoRun) {
              void autoRunDevCodex(run);
            }
            return;
          }

          if (!runMatch) {
            protocolError(res, 404, "RUN_NOT_FOUND", "THOUGHT Agent route not found.");
            return;
          }

          const [, id, action = ""] = runMatch;
          const run = runs.get(id);
          if (!run) {
            protocolError(res, 404, "RUN_NOT_FOUND", "THOUGHT Agent run not found.");
            return;
          }
          expireDevAgentRun(run);

          if (!action && req.method === "GET") {
            if (!verifyBearer(req, run.browserToken)) {
              protocolError(res, 401, "TOKEN_INVALID", "Invalid token.");
              return;
            }
            protocolJson(res, 200, statusPayload(run));
            return;
          }

          if (action === "claim" && req.method === "POST") {
            if (run.state !== "created") {
              protocolError(
                res,
                run.state === "expired" ? 410 : 409,
                run.state === "expired" ? "RUN_EXPIRED" : "RUN_ALREADY_CLAIMED",
                run.state === "expired" ? "THOUGHT Agent run expired." : "THOUGHT Agent run is already claimed.",
              );
              return;
            }
            const body = await readJson(req);
            assertProtocolVersion(body.protocolVersion);
            const bridge = parseBridgeInfo(body.bridge);
            const adapter = parseAdapterInfo(body.adapter);
            if (adapter?.adapterId !== run.requestedAdapterId) {
              protocolError(res, 409, "ADAPTER_MISMATCH", "Bridge adapter does not match requested adapter.");
              return;
            }
            if (!verifyBearer(req, run.launchToken)) {
              protocolError(res, 401, "TOKEN_INVALID", "Invalid launch token.");
              return;
            }
            run.bridge = bridge;
            run.adapter = adapter;
            run.bridgeToken = randomToken(32);
            run.launchToken = null;
            run.state = "claimed";
            run.updatedAt = new Date().toISOString();
            protocolJson(res, 200, {
              runId: run.runId,
              state: run.state,
              bridgeToken: run.bridgeToken,
              runExpiresAt: run.runExpiresAt,
              request: claimRequestPayload(run),
            });
            return;
          }

          if (action === "claim-authorization" && req.method === "POST") {
            if (run.state !== "created" || !verifyBearer(req, run.browserToken)) {
              protocolError(res, run.state === "created" ? 401 : 409, run.state === "created" ? "TOKEN_INVALID" : "RUN_STATE_CONFLICT", run.state === "created" ? "Invalid token." : "THOUGHT Agent run is not in the required state.");
              return;
            }
            const body = await readJson(req);
            assertProtocolVersion(body.protocolVersion);
            const claimRequestId = String(body.claimRequestId ?? "");
            const authorization = run.claimAuthorization;
            if (!authorization || authorization.claimRequestId !== claimRequestId) {
              protocolError(res, 404, "RUN_NOT_FOUND", "Claim authorization not found.");
              return;
            }
            if (Date.parse(authorization.expiresAt) <= Date.now()) {
              protocolError(res, 410, "TOKEN_EXPIRED", "Claim authorization expired.");
              return;
            }
            if (authorization.state === "consumed") {
              protocolError(res, 409, "RUN_ALREADY_CLAIMED", "Claim authorization was already used.");
              return;
            }
            authorization.state = "authorized";
            authorization.authorizedAt ??= new Date().toISOString();
            run.updatedAt = authorization.authorizedAt;
            protocolJson(res, 200, {
              runId: run.runId,
              state: "authorized",
              claimAuthorization: (statusPayload(run).claimAuthorization as Record<string, unknown> | undefined) ?? null,
            });
            return;
          }

          if (action === "start" && req.method === "POST") {
            if (run.state !== "claimed" || !verifyBearer(req, run.bridgeToken)) {
              protocolError(res, 409, "RUN_STATE_CONFLICT", "THOUGHT Agent run is not in the required state.");
              return;
            }
            const body = await readJson(req);
            assertProtocolVersion(body.protocolVersion);
            const invocationId = String(body.invocationId ?? "");
            if (!/^tai_[A-Za-z0-9_-]{8,}$/.test(invocationId)) {
              throw new ThoughtAgentProtocolError("AGENT_OUTPUT_SCHEMA_INVALID", "Invalid invocationId.");
            }
            const startedAt = requireIsoLikeDev(body.startedAt, "startedAt");
            run.invocationId = invocationId;
            run.startedAt = startedAt;
            run.state = "running";
            run.updatedAt = new Date().toISOString();
            protocolJson(res, 200, {
              runId: run.runId,
              state: run.state,
              invocationId: run.invocationId,
              startedAt: run.startedAt,
            });
            return;
          }

          if (action === "result" && req.method === "PUT") {
            if ((run.state !== "running" && run.state !== "returned") || !verifyBearer(req, run.bridgeToken)) {
              protocolError(res, 409, "RUN_STATE_CONFLICT", "THOUGHT Agent run is not in the required state.");
              return;
            }
            const body = parseResultRequest(await readJson(req));
            const startedAt = requireIsoLikeDev(body.startedAt, "startedAt");
            const completedAt = requireIsoLikeDev(body.completedAt, "completedAt");
            if (Date.parse(completedAt) < Date.parse(startedAt)) {
              throw new ThoughtAgentProtocolError("AGENT_OUTPUT_SCHEMA_INVALID", "completedAt must not precede startedAt.");
            }
            if (run.startedAt && Date.parse(run.startedAt) !== Date.parse(startedAt)) {
              protocolError(res, 409, "RESULT_CONFLICT", "Result startedAt does not match the running invocation.");
              return;
            }
            const idempotencyKey = String(req.headers["idempotency-key"] ?? "");
            if (idempotencyKey && idempotencyKey !== body.invocationId) {
              protocolError(res, 409, "RESULT_CONFLICT", "Idempotency key does not match invocation ID.");
              return;
            }
            if (String(body.invocationId ?? "") !== run.invocationId) {
              protocolError(res, 409, "RESULT_CONFLICT", "Result invocation ID does not match the running invocation.");
              return;
            }
            const parsedOutput = await parseAgentOutput(body.output.raw);
            if (
              !isThoughtSha256(body.output.rawSha256) ||
              !isThoughtSha256(body.output.agentLineSha256) ||
              body.output.raw !== parsedOutput.raw ||
              body.output.agentLine !== parsedOutput.agentLine ||
              body.output.rawSha256 !== parsedOutput.rawSha256 ||
              body.output.agentLineSha256 !== parsedOutput.agentLineSha256
            ) {
              protocolError(res, 409, "RESULT_HASH_MISMATCH", "Submitted result hashes do not match exact bytes.");
              return;
            }
            if (run.state === "returned") {
              if (run.rawResultSha256 === parsedOutput.rawSha256) {
                protocolJson(res, 200, statusPayload(run));
                return;
              }
              protocolError(res, 409, "RESULT_CONFLICT", "A conflicting result was already accepted for this run.");
              return;
            }
            if (body.adapter.adapterId !== run.requestedAdapterId) {
              protocolError(res, 409, "ADAPTER_MISMATCH", "Result adapter does not match requested adapter.");
              return;
            }
            run.bridge = body.bridge;
            run.adapter = body.adapter;
            run.agent = body.agent;
            run.execution = body.execution;
            run.completedAt = completedAt;
            const receipt = await buildThoughtAgentReceipt({
              runId: run.runId,
              origin: run.webOrigin,
              spec: {
                id: run.specId,
                sha256: run.specSha256,
                contractSpecHash: run.contractSpecHash,
              },
              promptSha256: run.promptSha256,
              agentInputSha256: run.agentInputSha256,
              adapter: run.adapter,
              agent: run.agent,
              bridge: run.bridge,
              round: {
                visibleTurns: run.execution.visibleTurns,
                agentInvocations: run.execution.agentInvocations,
                automaticRetry: false,
              },
              output: {
                rawSha256: parsedOutput.rawSha256,
                agentLineSha256: parsedOutput.agentLineSha256,
              },
              timing: {
                startedAt,
                completedAt: run.completedAt,
              },
            });
            run.rawResult = parsedOutput.raw;
            run.rawResultSha256 = parsedOutput.rawSha256;
            run.agentLine = parsedOutput.agentLine;
            run.agentLineSha256 = parsedOutput.agentLineSha256;
            run.receiptJson = receipt.json;
            run.receiptSha256 = receipt.sha256;
            run.state = "returned";
            run.updatedAt = new Date().toISOString();
            protocolJson(res, 200, statusPayload(run));
            return;
          }

          if (action === "fail" && req.method === "POST") {
            if (!verifyBearer(req, run.bridgeToken)) {
              protocolError(res, 401, "TOKEN_INVALID", "Invalid token.");
              return;
            }
            if (run.state === "expired") {
              protocolError(res, 410, "RUN_EXPIRED", "THOUGHT Agent run expired.");
              return;
            }
            if (run.state !== "claimed" && run.state !== "running") {
              protocolError(res, 409, "RUN_STATE_CONFLICT", "THOUGHT Agent run is not in the required state.");
              return;
            }
            const body = await readJson(req);
            assertProtocolVersion(body.protocolVersion);
            const error = body.error as { code?: unknown; message?: unknown } | undefined;
            const invocationId = body.invocationId === undefined ? null : String(body.invocationId);
            if (invocationId && !/^tai_[A-Za-z0-9_-]{8,}$/.test(invocationId)) {
              throw new ThoughtAgentProtocolError("AGENT_OUTPUT_SCHEMA_INVALID", "Invalid invocationId.");
            }
            if (run.invocationId && invocationId && run.invocationId !== invocationId) {
              protocolError(res, 409, "RESULT_CONFLICT", "Failure invocation ID does not match the running invocation.");
              return;
            }
            run.invocationId = run.invocationId ?? invocationId;
            run.completedAt = body.failedAt === undefined
              ? new Date().toISOString()
              : requireIsoLikeDev(body.failedAt, "failedAt");
            run.errorCode = devFailureCode(error?.code);
            run.errorMessage = normalizeDevAgentFailureMessage(String(error?.message ?? "The agent run failed."));
            run.state = "failed";
            run.updatedAt = new Date().toISOString();
            protocolJson(res, 200, statusPayload(run));
            return;
          }

          if (action === "cancel" && req.method === "POST") {
            if (!verifyBearer(req, run.browserToken)) {
              protocolError(res, 401, "TOKEN_INVALID", "Invalid token.");
              return;
            }
            if (["returned", "failed", "cancelled", "expired"].includes(run.state)) {
              protocolJson(res, 200, statusPayload(run));
              return;
            }
            run.state = "cancelled";
            run.updatedAt = new Date().toISOString();
            protocolJson(res, 200, statusPayload(run));
            return;
          }

          protocolError(res, 405, "RUN_STATE_CONFLICT", "Method not allowed.");
        } catch (error) {
          if (error instanceof ThoughtAgentProtocolError) {
            protocolError(res, 400, error.code, error.message);
            return;
          }
          protocolError(
            res,
            500,
            "SERVER_UNAVAILABLE",
            error instanceof Error ? error.message : "THOUGHT Agent dev API failed.",
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir = process.cwd();
  const workspaceRoot = path.resolve(rootDir, "../..");
  const routeBase = normalizeViteBase(process.env.VITE_THOUGHT_ROUTE_BASE);
  const publicEnv = {
    ...loadEnv(mode, rootDir, "VITE_"),
    ...(mode === "sepolia" ? { VITE_NETWORK: "sepolia" } : {}),
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.startsWith("VITE_"))
    ),
  };

  return {
    root: rootDir,
    base: routeBase,
    plugins: [createThoughtAgentDevApiPlugin(), react()],
    build: {
      outDir: readOutDir(rootDir),
      emptyOutDir: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        onwarn: ignoreKnownRollupWarnings,
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: readDevApiOrigin(),
          changeOrigin: true,
          secure: true,
        },
      },
      fs: {
        allow: [
          workspaceRoot,
          ...existingRealPaths([
            path.resolve(rootDir, "node_modules"),
            path.resolve(workspaceRoot, "node_modules"),
            path.resolve(workspaceRoot, "node_modules/node_modules"),
          ]),
        ],
      },
    },
    envDir: rootDir,
    define: {
      "globalThis.__INSHELL_VITE_ENV__": JSON.stringify(publicEnv),
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});

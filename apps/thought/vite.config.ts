import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { Contract, JsonRpcProvider, toUtf8Bytes } from "ethers";
import {
  THOUGHT_AGENT_CLAIM_TTL_MS,
  THOUGHT_AGENT_RUN_TTL_MS,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RECEIPT_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_AGENT_ERROR_CODES,
  ThoughtAgentProtocolError,
  assertProtocolVersion,
  buildThoughtCodexClientScript,
  buildThoughtAgentReceipt,
  formatThoughtAgentModelLabel,
  isThoughtSha256,
  parseAdapterInfo,
  parseBridgeInfo,
  parseResultRequest,
  sha256Hex,
  thoughtAgentModelIdentifier,
  type ThoughtAgentAdapterInfo,
  type ThoughtAgentBridgeInfo,
  type ThoughtAgentExecutionInfo,
  type ThoughtAgentInfo,
  type ThoughtAgentState,
  type ThoughtSha256,
} from "../../packages/thought-agent-protocol/src/index";
import type { RollupLog, RollupLogHandler } from "rollup";
import {
  buildThoughtV2LocalAgentOutputSchema,
  buildThoughtV2LocalAgentResult,
  parseThoughtV2LocalAgentResult,
} from "./src/thought-v2-local-agent";
import thoughtCreativeSpecLock from "./spec/THOUGHT.v2.lock.json";
import { assertThoughtV2Line } from "./src/thought-v2-local-mint";
import {
  THOUGHT_V2_LOCAL_RELEASE,
  buildThoughtV2LocalRelease,
  type ThoughtV2LocalRelease,
} from "./src/thought-v2-local-release";
import {
  assertThoughtV2AnvilRuntime,
  type ThoughtV2AnvilRuntime,
} from "./src/thought-v2-contract-client";
import { buildThoughtV2PathAcquisitionBrowserAddresses } from "./src/thought-v2-path-acquisition-runtime";
import type { ThoughtV2ProcessEvidence } from "./src/thought-v2-provenance";
import { buildBackendOnlyMockThoughtV2Mint } from "./scripts/mock-thought-v2-anvil-signer";
import {
  loadReturnedDevRuns,
  persistReturnedDevRuns,
} from "./scripts/thought-agent-dev-run-store";

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

function readCurrentThoughtContractRuntime(
  workspaceRoot: string,
  command: "build" | "serve",
  mode: string,
) {
  if (
    command !== "serve" ||
    mode === "sepolia" ||
    process.env.INSHELL_THOUGHT_USE_CONTRACT_RUNTIME === "0"
  ) {
    return null;
  }
  const configuredDescriptor = process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim();
  const descriptorPath = configuredDescriptor
    ? path.resolve(workspaceRoot, configuredDescriptor)
    : path.join(workspaceRoot, "apps/thought/evm/addresses.anvil.json");
  if (!fs.existsSync(descriptorPath)) {
    return null;
  }
  const runtime = assertThoughtV2AnvilRuntime(
    JSON.parse(fs.readFileSync(descriptorPath, "utf8")),
  );
  if (
    runtime.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime.status !== "ready" ||
    runtime.chainId !== 31337
  ) {
    throw new Error(`Incompatible THOUGHT Contract runtime descriptor: ${descriptorPath}`);
  }
  const selectedSpecPath = path.join(workspaceRoot, "apps/thought/spec/THOUGHT.v2.md");
  const selectedSpecBytes = fs.readFileSync(selectedSpecPath);
  const selectedSpecSha256 = crypto.createHash("sha256").update(selectedSpecBytes).digest("hex");
  if (
    runtime.selectedSpec?.name !== thoughtCreativeSpecLock.artifact.name ||
    runtime.selectedSpec?.id?.toLowerCase() !==
      thoughtCreativeSpecLock.artifact.thoughtSpecId.toLowerCase() ||
    runtime.selectedSpec?.hash?.toLowerCase() !==
      thoughtCreativeSpecLock.artifact.thoughtSpecHash.toLowerCase() ||
    selectedSpecBytes.length !== thoughtCreativeSpecLock.artifact.byteLength ||
    selectedSpecSha256 !== thoughtCreativeSpecLock.artifact.sha256
  ) {
    throw new Error(`THOUGHT runtime does not bind the App creative spec: ${descriptorPath}`);
  }
  return {
    descriptorPath,
    raw: runtime,
    evmAddresses: {
      schema: "inshell.thought.app-current-contract-anvil-runtime.v1",
      rpcUrl: runtime.rpcUrl,
      chainId: runtime.chainId,
      path: { address: runtime.contracts.pathNft },
      pathNft: { address: runtime.contracts.pathNft },
      ...buildThoughtV2PathAcquisitionBrowserAddresses(runtime),
      thoughtSpecRegistry: { address: runtime.contracts.thoughtSpecRegistry },
      protocolRegistry: { address: runtime.contracts.protocolRegistry },
      thoughtRenderer: { address: runtime.contracts.thoughtRenderer },
      creationAttestationVerifier: { address: runtime.contracts.creationAttestationVerifier },
      thought: { address: runtime.contracts.thoughtNft },
      thoughtNft: { address: runtime.contracts.thoughtNft },
      protocolRelease: {
        id: runtime.protocolRelease.id,
        manifestHash: runtime.protocolRelease.manifestHash,
        manifestURI: runtime.protocolRelease.manifestUri,
        status: runtime.protocolRelease.status,
        rendererIdHash: runtime.protocolRelease.manifest.identifiers.rendererHash,
        workProfileIdHash: runtime.protocolRelease.manifest.identifiers.workProfileHash,
        contextProfileIdHash: runtime.protocolRelease.manifest.identifiers.contextProfileHash,
        metadataProfileIdHash: runtime.protocolRelease.manifest.identifiers.metadataProfileHash,
        creationAttestationProfileIdHash: runtime.attestation.profileId,
      },
      thoughtSpecs: [{
        specName: runtime.selectedSpec.name,
        specId: runtime.selectedSpec.id,
        specHash: runtime.selectedSpec.hash,
        ref: runtime.selectedSpec.ref,
        byteLength: selectedSpecBytes.length,
        sha256: selectedSpecSha256,
      }],
      recommendedThoughtSpecName: runtime.selectedSpec.name,
      recommendedThoughtSpecId: runtime.selectedSpec.id,
      recommendedThoughtSpecHash: runtime.selectedSpec.hash,
      thoughtSpec: {
        specName: runtime.selectedSpec.name,
        id: runtime.selectedSpec.id,
        hash: runtime.selectedSpec.hash,
        ref: runtime.selectedSpec.ref,
      },
      localContractIntegration: {
        acceptanceOnly: true,
        deploymentAuthorized: THOUGHT_V2_LOCAL_RELEASE.artifact.deploymentAuthorized,
        id: THOUGHT_V2_LOCAL_RELEASE.artifact.id,
        productionConsumable: THOUGHT_V2_LOCAL_RELEASE.artifact.productionConsumable,
        runtimeDescriptorPath: descriptorPath,
      },
    },
  };
}

function serializeForInlineScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createThoughtDevRuntimeBootstrapPlugin({
  contractRuntime,
  evmAddresses,
  publicEnv,
}: {
  contractRuntime: Record<string, unknown> | null;
  evmAddresses: Record<string, unknown> | null;
  publicEnv: Record<string, string>;
}): Plugin {
  const bootstrap = [
    `globalThis.__INSHELL_VITE_ENV__ = ${serializeForInlineScript(publicEnv)};`,
    `globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__ = ${serializeForInlineScript(contractRuntime)};`,
    `globalThis.__INSHELL_THOUGHT_EVM_ADDRESSES__ = ${serializeForInlineScript(evmAddresses)};`,
  ].join("\n");

  return {
    name: "inshell-thought-dev-runtime-bootstrap",
    apply: "serve",
    transformIndexHtml() {
      return [{
        tag: "script",
        children: bootstrap,
        injectTo: "head-prepend",
      }];
    },
  };
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
const DEV_AGENT_SPEC_ID = thoughtCreativeSpecLock.artifact.thoughtSpecId;
const DEV_AGENT_SPEC_REF =
  `app://thought/creative-spec/${thoughtCreativeSpecLock.artifactId}/${thoughtCreativeSpecLock.artifact.name}`;
const DEV_AGENT_SPEC_TEXT = fs.readFileSync(
  new URL("./spec/THOUGHT.v2.md", import.meta.url),
  "utf8",
);
const DEV_AGENT_SPEC_SHA256 = thoughtCreativeSpecLock.artifact.sha256;
const DEV_AGENT_SPEC_HASH = thoughtCreativeSpecLock.artifact.thoughtSpecHash;
const devAgentLineContract = (release: ThoughtV2LocalRelease) => ({
  workProfile: release.protocol.workProfile.id,
  minUtf8Bytes: 1,
  maxUtf8Bytes: 64,
  normalization: "none",
  displayUnitsAreAcceptanceLimits: false,
} as const);
const DEV_AGENT_CLAIM_AUTHORIZATION_TTL_MS = 2 * 60 * 1000;
const DEV_AGENT_BRIDGE_ID = "inshell-thought-bridge-dev";
const DEV_AGENT_BRIDGE_VERSION = "0.1.0-dev";
const DEV_AGENT_ADAPTER_VERSION = "codex-cli";
const DEV_AGENT_CODEX_BIN = process.env.THOUGHT_BRIDGE_CODEX_BIN || "codex";
const DEV_AGENT_CODEX_TIMEOUT_MS = Number(process.env.THOUGHT_BRIDGE_CODEX_TIMEOUT_MS || 180000);
const DEV_AGENT_RETURNED_RUN_STORE_PATH = fileURLToPath(
  new URL("../../.local/thought-agent-dev-returned-runs.json", import.meta.url),
);
const DEV_AGENT_CODEX_AUTORUN = process.env.INSHELL_THOUGHT_DEV_CODEX_AUTORUN === "1";
const DEV_AGENT_FAKE_WORK = process.env.THOUGHT_BRIDGE_FAKE_WORK || "";
const DEV_AGENT_MAX_REQUEST_BYTES = 32 * 1024;

const parseDevAgentOutput = async (raw: string, release: ThoughtV2LocalRelease) => {
  if (Buffer.byteLength(raw, "utf8") > 16 * 1024) {
    throw new ThoughtAgentProtocolError("RESULT_TOO_LARGE", "Agent raw result is too large.");
  }
  let result;
  try {
    result = parseThoughtV2LocalAgentResult(raw, release);
  } catch (error) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      error instanceof Error ? error.message : "Agent result schema mismatch.",
    );
  }
  return {
    raw,
    rawSha256: await sha256Hex(raw),
    agentLine: result.agentLine,
    agentLineSha256: await sha256Hex(result.agentLine),
    declaration: result.declaration,
  };
};

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
      rawSha256: run.rawResultSha256,
      agentLine: run.agentLine,
      receipt: {
        receiptVersion: THOUGHT_AGENT_RECEIPT_VERSION,
        receiptSha256: run.receiptSha256,
        adapterId: run.requestedAdapterId,
        model: run.agent?.model ?? "unknown",
        reasoningEffort: run.agent?.reasoningEffort ?? null,
        metadataSource: run.agent?.metadataSource ?? "unknown",
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

function claimRequestPayload(run: DevThoughtAgentRun, release: ThoughtV2LocalRelease) {
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
      contractSpecId: run.specId,
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
      release: {
        protocolReleaseId: release.protocol.protocolReleaseId,
        manifestKeccak256: release.protocol.manifestKeccak256,
      },
      agentLine: devAgentLineContract(release),
      schema: buildThoughtV2LocalAgentOutputSchema(release),
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

async function runDevCodex(
  promptLine: string,
  specText: string,
  release: ThoughtV2LocalRelease,
) {
  if (DEV_AGENT_FAKE_WORK) {
    return parseDevAgentOutput(
      JSON.stringify(
        buildThoughtV2LocalAgentResult(
          DEV_AGENT_FAKE_WORK,
          "THOUGHT Bridge dev fake",
          release,
        ),
      ),
      release,
    );
  }

  const runDir = await mkdtemp(path.join(tmpdir(), "thought-bridge-codex-"));
  const schemaPath = path.join(runDir, "output.schema.json");
  const finalPath = path.join(runDir, "final.json");
  const instructionsPath = path.join(runDir, "AGENTS.md");
  await writeFile(
    schemaPath,
    JSON.stringify(buildThoughtV2LocalAgentOutputSchema(release), null, 2),
  );
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

    return parseDevAgentOutput(await readFile(finalPath, "utf8"), release);
  } finally {
    await rm(runDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function autoRunDevCodex(
  run: DevThoughtAgentRun,
  release: ThoughtV2LocalRelease,
) {
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
    const parsedOutput = await runDevCodex(run.promptText, run.specText, release);
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

function createThoughtAgentDevApiPlugin(
  contractRuntime: ThoughtV2AnvilRuntime | null,
  activeRelease: ThoughtV2LocalRelease,
) {
  const clientScript = buildThoughtCodexClientScript({
    release: {
      protocolReleaseId: activeRelease.protocol.protocolReleaseId,
      manifestKeccak256: activeRelease.protocol.manifestKeccak256,
    },
    resultContract: {
      workProfile: activeRelease.protocol.workProfile.id,
      declarationLabelField: "label",
      lineValidation: "terminal-english-64",
    },
  });
  const clientScriptSha256 =
    `sha256:${crypto.createHash("sha256").update(clientScript, "utf8").digest("hex")}` as ThoughtSha256;
  const validateStoredReturnedRun = (candidate: unknown): DevThoughtAgentRun | null => {
    if (!candidate || typeof candidate !== "object") return null;
    const run = candidate as Partial<DevThoughtAgentRun>;
    if (
      run.state !== "returned" ||
      typeof run.runId !== "string" ||
      typeof run.updatedAt !== "string" ||
      typeof run.rawResult !== "string" ||
      typeof run.agentLine !== "string" ||
      typeof run.browserToken !== "string" ||
      !run.adapter ||
      !run.agent
    ) {
      return null;
    }
    try {
      const result = parseThoughtV2LocalAgentResult(run.rawResult, activeRelease);
      if (
        result.agentLine !== run.agentLine ||
        run.specId !== DEV_AGENT_SPEC_ID ||
        run.contractSpecHash?.toLowerCase() !== DEV_AGENT_SPEC_HASH.toLowerCase()
      ) {
        return null;
      }
    } catch {
      return null;
    }
    return run as DevThoughtAgentRun;
  };
  const runs = loadReturnedDevRuns(
    DEV_AGENT_RETURNED_RUN_STORE_PATH,
    validateStoredReturnedRun,
  );
  const persistRuns = () => {
    persistReturnedDevRuns(DEV_AGENT_RETURNED_RUN_STORE_PATH, runs.values());
  };
  const specText = DEV_AGENT_SPEC_TEXT;

  return {
    name: "thought-agent-dev-api",
    enforce: "pre" as const,
    configureServer(server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
          if (
            requestUrl.pathname === "/api/thought-contract/v1/mock-attestation" &&
            req.method === "POST"
          ) {
            if (!contractRuntime) {
              protocolError(res, 503, "SERVER_UNAVAILABLE", "Current THOUGHT Contract runtime is unavailable.");
              return;
            }
            const runtime = assertThoughtV2AnvilRuntime(contractRuntime);
            const body = await readJson(req);
            const process = body.process as ThoughtV2ProcessEvidence | undefined;
            const runReference = process?.kind === "agent-run"
              ? process.run.reference
              : "";
            const authoritativeRun = runReference ? runs.get(runReference) : undefined;
            if (
              !authoritativeRun ||
              authoritativeRun.state !== "returned" ||
              !authoritativeRun.rawResult ||
              !authoritativeRun.agentLine ||
              !authoritativeRun.adapter ||
              !authoritativeRun.agent
            ) {
              protocolError(
                res,
                409,
                "RUN_STATE_CONFLICT",
                "App attestation requires a returned Agent run held by this dev backend.",
              );
              return;
            }
            const resultEnvelope = parseThoughtV2LocalAgentResult(
              authoritativeRun.rawResult,
              activeRelease,
            );
            const selectedAgent =
              authoritativeRun.requestedAdapterId === "codex"
                ? "Codex"
                : authoritativeRun.requestedAdapterId;
            const resultAgent = resultEnvelope.declaration?.label;
            if (resultAgent && resultAgent !== selectedAgent) {
              protocolError(
                res,
                409,
                "AGENT_METADATA_CONFLICT",
                "The Agent result label does not match the Agent selected by the App.",
              );
              return;
            }
            const reportedModel = authoritativeRun.agent.model?.trim() || "";
            const modelIdentifier = thoughtAgentModelIdentifier(
              reportedModel,
              authoritativeRun.agent.reasoningEffort,
            );
            const authoritativeModel = formatThoughtAgentModelLabel(
              reportedModel,
              authoritativeRun.agent.reasoningEffort,
            );
            if (authoritativeModel === "unknown") {
              protocolError(
                res,
                409,
                "MODEL_METADATA_UNAVAILABLE",
                "The Agent run did not return exact model metadata. Run the work again.",
              );
              return;
            }
            if (authoritativeRun.agent.metadataSource !== "reported") {
              protocolError(
                res,
                409,
                "MODEL_METADATA_UNAVAILABLE",
                "The Agent runtime did not report exact model metadata. Run the work again.",
              );
              return;
            }
            const authoritativeProcess: ThoughtV2ProcessEvidence = {
              kind: "agent-run",
              agent: {
                identifier: authoritativeRun.adapter.adapterId,
                label: selectedAgent,
                source: "producer-selected",
              },
              model: {
                label: authoritativeModel,
                source: "runtime-reported",
                ...(modelIdentifier ? { identifier: modelIdentifier } : {}),
              },
              run: {
                adapter: authoritativeRun.adapter.adapterId,
                route: "inshell.thought.agent-run",
                reference: authoritativeRun.runId,
                resultEnvelope,
              },
            };
            const processMatchesRun =
              authoritativeRun.promptText === String(body.promptLine ?? "") &&
              authoritativeRun.agentLine === String(body.agentLine ?? "") &&
              authoritativeRun.specId.toLowerCase() === runtime.selectedSpec.id.toLowerCase() &&
              authoritativeRun.contractSpecHash?.toLowerCase() === runtime.selectedSpec.hash.toLowerCase() &&
              process.kind === "agent-run" &&
              process.agent.label === selectedAgent &&
              process.model.label === authoritativeModel &&
              process.run.adapter === authoritativeRun.adapter.adapterId &&
              process.run.route === "inshell.thought.agent-run" &&
              process.run.reference === authoritativeRun.runId &&
              JSON.stringify(process.run.resultEnvelope) === JSON.stringify(resultEnvelope);
            if (!processMatchesRun) {
              protocolError(
                res,
                409,
                "RESULT_CONFLICT",
                "App attestation evidence does not match the authoritative Agent run.",
              );
              return;
            }
            const provider = new JsonRpcProvider(runtime.rpcUrl, runtime.chainId);
            try {
              const registry = new Contract(runtime.contracts.thoughtSpecRegistry, [
                "function thoughtSpecText(bytes32 specId) view returns (string)",
              ], provider);
              const selectedSpecText = await registry.thoughtSpecText(runtime.selectedSpec.id) as string;
              const path = body.path as {
                pathId?: unknown;
                deadline?: unknown;
                pathSignature?: unknown;
              } | undefined;
              const mint = await buildBackendOnlyMockThoughtV2Mint(runtime, {
                chainId: BigInt(runtime.chainId),
                thoughtNft: runtime.contracts.thoughtNft.toLowerCase() as `0x${string}`,
                intendedMinter: String(body.intendedMinter ?? "").toLowerCase() as `0x${string}`,
                promptLine: String(body.promptLine ?? ""),
                agentLine: String(body.agentLine ?? ""),
                process: authoritativeProcess,
                protocol: {
                  manifestKeccak256: runtime.protocolRelease.manifestHash.toLowerCase() as `0x${string}`,
                  protocolReleaseId: runtime.protocolRelease.id.toLowerCase() as `0x${string}`,
                  thoughtSpecHash: runtime.selectedSpec.hash.toLowerCase() as `0x${string}`,
                  thoughtSpecId: runtime.selectedSpec.id.toLowerCase() as `0x${string}`,
                },
                selectedSpec: {
                  exactSpecBytes: toUtf8Bytes(selectedSpecText),
                  specName: runtime.selectedSpec.name,
                },
                path: {
                  pathId: BigInt(String(path?.pathId ?? "0")),
                  deadline: BigInt(String(path?.deadline ?? "0")),
                  pathSignature: String(path?.pathSignature ?? "") as `0x${string}`,
                },
              }, {
                provider,
                attestationDeadline: BigInt(String(body.attestationDeadline ?? "0")),
              });
              protocolJson(res, 200, {
                ...mint,
                pathId: mint.pathId.toString(),
                deadline: mint.deadline.toString(),
                creationAttestation: {
                  ...mint.creationAttestation,
                  deadline: mint.creationAttestation.deadline.toString(),
                  authorityEpoch: mint.creationAttestation.authorityEpoch.toString(),
                },
                mock: {
                  environment: "disposable-anvil",
                  productionAuthorized: false,
                },
              });
            } finally {
              await provider.destroy();
            }
            return;
          }
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
            res.end(clientScript);
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
            assertThoughtV2Line(prompt, "prompt");

            const now = new Date();
            const id = runId();
            const browserToken = randomToken(32);
            const launchToken = randomToken(32);
            const specSha256 = await sha256Hex(specText);
            if (specSha256 !== `sha256:${DEV_AGENT_SPEC_SHA256}`) {
              protocolError(res, 500, "SPEC_HASH_MISMATCH", "Locked THOUGHT generation spec source mismatch.");
              return;
            }
            const promptSha256 = await sha256Hex(prompt);
            const agentInput = {
              text: prompt,
              sha256: promptSha256,
            };
            const createdAt = now.toISOString();
            const claimExpiresAt = new Date(
              now.getTime() + THOUGHT_AGENT_CLAIM_TTL_MS,
            ).toISOString();
            const runExpiresAt = new Date(
              now.getTime() + THOUGHT_AGENT_RUN_TTL_MS,
            ).toISOString();
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
              contractSpecHash: DEV_AGENT_SPEC_HASH,
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
              client: {
                url: new URL(clientPath, webOrigin).toString(),
                sha256: clientScriptSha256,
              },
              createdAt,
              claimExpiresAt,
              devRuntime: "vite-local-returned-run-store",
              devAutoRun,
            });
            if (devAutoRun) {
              void autoRunDevCodex(run, activeRelease).finally(() => {
                if (run.state === "returned") persistRuns();
              });
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
            const claimedAt = new Date();
            run.updatedAt = claimedAt.toISOString();
            run.runExpiresAt = new Date(
              claimedAt.getTime() + THOUGHT_AGENT_RUN_TTL_MS,
            ).toISOString();
            protocolJson(res, 200, {
              runId: run.runId,
              state: run.state,
              bridgeToken: run.bridgeToken,
              runExpiresAt: run.runExpiresAt,
              request: claimRequestPayload(run, activeRelease),
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
            const parsedOutput = await parseDevAgentOutput(body.output.raw, activeRelease);
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
            persistRuns();
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

export default defineConfig(({ command, mode }) => {
  const rootDir = process.cwd();
  const workspaceRoot = path.resolve(rootDir, "../..");
  const currentContractRuntime = readCurrentThoughtContractRuntime(workspaceRoot, command, mode);
  const activeLocalRelease = currentContractRuntime?.evmAddresses
    ? buildThoughtV2LocalRelease(currentContractRuntime.evmAddresses)
    : THOUGHT_V2_LOCAL_RELEASE;
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
    plugins: [
      createThoughtDevRuntimeBootstrapPlugin({
        contractRuntime: currentContractRuntime?.raw ?? null,
        evmAddresses: currentContractRuntime?.evmAddresses ?? null,
        publicEnv,
      }),
      createThoughtAgentDevApiPlugin(
        currentContractRuntime?.raw
          ? assertThoughtV2AnvilRuntime(currentContractRuntime.raw)
          : null,
        activeLocalRelease,
      ),
      react(),
    ],
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
      "globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__": JSON.stringify(
        currentContractRuntime?.raw ?? null,
      ),
      "globalThis.__INSHELL_THOUGHT_EVM_ADDRESSES__": JSON.stringify(
        currentContractRuntime?.evmAddresses ?? null,
      ),
      "import.meta.env.MODE": JSON.stringify(mode),
    },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
    },
  };
});

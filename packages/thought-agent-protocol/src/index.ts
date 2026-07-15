import {
  measureThoughtLine as measureReleasedThoughtLine,
  type ThoughtLineKind,
  type ThoughtLineMeasure,
} from "@inshell/shared";
import { THOUGHT_V2_PROTOCOL_RELEASE } from "./release.generated";

export { THOUGHT_V2_PROTOCOL_RELEASE } from "./release.generated";
export {
  THOUGHT_CODEX_CLIENT_ROUTE,
  buildThoughtCodexClientScript,
  buildThoughtCodexTask,
  type ThoughtCodexTaskInput,
} from "./codex-client";

export const THOUGHT_AGENT_PROTOCOL_VERSION =
  THOUGHT_V2_PROTOCOL_RELEASE.agentRunId;
export const THOUGHT_AGENT_INPUT_VERSION =
  "inshell.thought.agent-input.v2" as const;
export const THOUGHT_AGENT_RECEIPT_VERSION =
  "inshell.thought.agent-receipt.v2" as const;
export const THOUGHT_AGENT_RESULT_VERSION =
  THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult;
export const THOUGHT_AGENT_DECLARATION_VERSION =
  THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentDeclaration;
export const THOUGHT_SHA256_PREFIX = "sha256:" as const;

export const THOUGHT_AGENT_LINE_CONTRACT = {
  workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
  minUtf8Bytes: 1,
  maxUtf8Bytes: THOUGHT_V2_PROTOCOL_RELEASE.limits.agentMaxBytes,
  normalization: THOUGHT_V2_PROTOCOL_RELEASE.limits.normalization,
  displayUnitsAreAcceptanceLimits:
    THOUGHT_V2_PROTOCOL_RELEASE.limits.displayUnitsAreAcceptanceLimits,
} as const;

export const THOUGHT_AGENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    schema: {
      const: THOUGHT_AGENT_RESULT_VERSION,
    },
    agentLine: {
      type: "string",
      minLength: 1,
      "x-thought-line-profile": THOUGHT_AGENT_LINE_CONTRACT.workProfile,
      "x-thought-utf8-min-bytes": THOUGHT_AGENT_LINE_CONTRACT.minUtf8Bytes,
      "x-thought-utf8-max-bytes": THOUGHT_AGENT_LINE_CONTRACT.maxUtf8Bytes,
      "x-thought-normalization": THOUGHT_AGENT_LINE_CONTRACT.normalization,
    },
    declaration: THOUGHT_V2_PROTOCOL_RELEASE.declarationSchema,
  },
  required: ["schema", "agentLine"],
  additionalProperties: false,
} as const;

export const THOUGHT_AGENT_STATES = [
  "created",
  "claimed",
  "running",
  "returned",
  "failed",
  "cancelled",
  "expired",
] as const;

export type ThoughtAgentState = (typeof THOUGHT_AGENT_STATES)[number];

export const THOUGHT_AGENT_TERMINAL_STATES = [
  "returned",
  "failed",
  "cancelled",
  "expired",
] as const satisfies readonly ThoughtAgentState[];

export type ThoughtAgentTerminalState =
  (typeof THOUGHT_AGENT_TERMINAL_STATES)[number];

export const THOUGHT_AGENT_ERROR_CODES = [
  "RUN_NOT_FOUND",
  "RUN_EXPIRED",
  "RUN_ALREADY_CLAIMED",
  "RUN_STATE_CONFLICT",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "ORIGIN_NOT_ALLOWED",
  "PROTOCOL_UNSUPPORTED",
  "SPEC_NOT_FOUND",
  "SPEC_HASH_MISMATCH",
  "PROMPT_HASH_MISMATCH",
  "AGENT_INPUT_HASH_MISMATCH",
  "ADAPTER_MISMATCH",
  "ADAPTER_NOT_INSTALLED",
  "ADAPTER_VERSION_UNSUPPORTED",
  "AGENT_AUTH_REQUIRED",
  "AGENT_START_FAILED",
  "AGENT_TIMEOUT",
  "AGENT_CANCELLED",
  "AGENT_OUTPUT_MISSING",
  "AGENT_OUTPUT_UNPARSEABLE",
  "AGENT_OUTPUT_SCHEMA_INVALID",
  "RESULT_TOO_LARGE",
  "RESULT_HASH_MISMATCH",
  "RESULT_CONFLICT",
  "RATE_LIMITED",
  "SERVER_UNAVAILABLE",
] as const;

export type ThoughtAgentErrorCode = (typeof THOUGHT_AGENT_ERROR_CODES)[number];

export type ThoughtSha256 = `${typeof THOUGHT_SHA256_PREFIX}${string}`;

export type RequestedThoughtAgent = {
  adapterId: string;
  model: string | null;
};

export type ThoughtAgentClientInfo = {
  surface?: string;
  appVersion?: string;
};

export type ThoughtAgentCreateRunRequest = {
  protocolVersion: typeof THOUGHT_AGENT_PROTOCOL_VERSION;
  promptLine: string;
  specId: string;
  requestedAgent: RequestedThoughtAgent;
  client?: ThoughtAgentClientInfo;
};

export type ThoughtAgentBridgeInfo = {
  bridgeId: string;
  bridgeVersion: string;
  installationId?: string;
  platform?: string;
};

export type ThoughtAgentAdapterInfo = {
  adapterId: string;
  adapterVersion: string;
};

export type ThoughtAgentInfo = {
  product: string;
  productVersion?: string;
  provider?: string;
  model?: string;
  metadataSource: "reported" | "configured" | "unknown";
};

export type ThoughtAgentExecutionInfo = {
  visibleTurns: number;
  agentInvocations: number;
  workspacePolicy: string;
  sandboxPolicy: string;
  approvalPolicy: string;
  userConfigPolicy: string;
};

export type ThoughtAgentOutput = {
  mediaType: "application/json";
  raw: string;
  rawSha256: ThoughtSha256;
  agentLine: string;
  agentLineSha256: ThoughtSha256;
};

export type ThoughtAgentResultRequest = {
  protocolVersion: typeof THOUGHT_AGENT_PROTOCOL_VERSION;
  invocationId: string;
  bridge: ThoughtAgentBridgeInfo;
  adapter: ThoughtAgentAdapterInfo;
  agent: ThoughtAgentInfo;
  execution: ThoughtAgentExecutionInfo;
  startedAt: string;
  completedAt: string;
  output: ThoughtAgentOutput;
};

export type ThoughtAgentReceiptInput = {
  runId: string;
  origin: string;
  spec: {
    id: string;
    sha256: ThoughtSha256;
    contractSpecHash?: string | null;
  };
  promptSha256: ThoughtSha256;
  agentInputSha256: ThoughtSha256;
  adapter: ThoughtAgentAdapterInfo;
  agent: ThoughtAgentInfo;
  bridge: ThoughtAgentBridgeInfo;
  round: {
    visibleTurns: number;
    agentInvocations: number;
    automaticRetry: false;
  };
  output: {
    rawSha256: ThoughtSha256;
    agentLineSha256: ThoughtSha256;
  };
  timing: {
    startedAt: string;
    completedAt: string;
  };
};

export type ThoughtAgentReceipt = {
  receiptVersion: typeof THOUGHT_AGENT_RECEIPT_VERSION;
  protocolVersion: typeof THOUGHT_AGENT_PROTOCOL_VERSION;
  runId: string;
  origin: string;
  spec: {
    id: string;
    sha256: ThoughtSha256;
    contractSpecHash?: string | null;
  };
  promptSha256: ThoughtSha256;
  agentInputSha256: ThoughtSha256;
  adapter: {
    id: string;
    version: string;
  };
  agent: ThoughtAgentInfo;
  bridge: {
    id: string;
    version: string;
    platform?: string;
  };
  round: {
    visibleTurns: number;
    agentInvocations: number;
    automaticRetry: false;
  };
  output: {
    rawSha256: ThoughtSha256;
    agentLineSha256: ThoughtSha256;
  };
  timing: {
    startedAt: string;
    completedAt: string;
  };
  trust: {
    transportVerified: true;
    bridgeDeclared: true;
    providerAttested: false;
  };
};

export type BuiltThoughtAgentInput = {
  text: string;
  sha256: ThoughtSha256;
  mediaType: "text/plain; charset=utf-8";
};

export type ParsedThoughtAgentOutput = {
  raw: string;
  rawSha256: ThoughtSha256;
  agentLine: string;
  agentLineSha256: ThoughtSha256;
  declaration?: ThoughtAgentDeclaration;
};

export type ThoughtAgentDeclaration = {
  schema: typeof THOUGHT_AGENT_DECLARATION_VERSION;
  agentLabel: string;
  specId: string;
  specHash: string;
  declaredOneCreativeResult: true;
};

export type BuiltThoughtAgentReceipt = {
  receipt: ThoughtAgentReceipt;
  json: string;
  sha256: ThoughtSha256;
};

export class ThoughtAgentProtocolError extends Error {
  readonly code: ThoughtAgentErrorCode;

  constructor(code: ThoughtAgentErrorCode, message: string) {
    super(message);
    this.name = "ThoughtAgentProtocolError";
    this.code = code;
  }
}

const allowedTransitions: Record<ThoughtAgentState, readonly ThoughtAgentState[]> =
  {
    created: ["claimed", "cancelled", "expired"],
    claimed: ["running", "failed", "cancelled", "expired"],
    running: ["returned", "failed", "cancelled", "expired"],
    returned: [],
    failed: [],
    cancelled: [],
    expired: [],
  };

export function isThoughtAgentState(value: unknown): value is ThoughtAgentState {
  return (
    typeof value === "string" &&
    THOUGHT_AGENT_STATES.includes(value as ThoughtAgentState)
  );
}

export function isTerminalThoughtAgentState(
  state: ThoughtAgentState,
): state is ThoughtAgentTerminalState {
  return THOUGHT_AGENT_TERMINAL_STATES.includes(
    state as ThoughtAgentTerminalState,
  );
}

export function canTransitionThoughtAgentState(
  from: ThoughtAgentState,
  to: ThoughtAgentState,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertThoughtAgentTransition(
  from: ThoughtAgentState,
  to: ThoughtAgentState,
): void {
  if (!canTransitionThoughtAgentState(from, to)) {
    throw new ThoughtAgentProtocolError(
      "RUN_STATE_CONFLICT",
      `Invalid THOUGHT Agent state transition ${from} -> ${to}.`,
    );
  }
}

export function byteLengthUtf8(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function measureThoughtLine(
  value: string,
  kind: ThoughtLineKind,
): ThoughtLineMeasure {
  return measureReleasedThoughtLine(value, kind);
}

export type { ThoughtLineKind, ThoughtLineMeasure };

export function assertThoughtLine(
  value: string,
  kind: ThoughtLineKind,
): ThoughtLineMeasure {
  const measure = measureThoughtLine(value, kind);
  if (measure.errors.length > 0) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      measure.errors.join("; "),
    );
  }
  return measure;
}

export function isThoughtSha256(value: unknown): value is ThoughtSha256 {
  return (
    typeof value === "string" &&
    value.startsWith(THOUGHT_SHA256_PREFIX) &&
    /^[0-9a-f]{64}$/.test(value.slice(THOUGHT_SHA256_PREFIX.length))
  );
}

export async function sha256Hex(value: string): Promise<ThoughtSha256> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${THOUGHT_SHA256_PREFIX}${hex}`;
}

export function assertProtocolVersion(value: unknown): void {
  if (value !== THOUGHT_AGENT_PROTOCOL_VERSION) {
    throw new ThoughtAgentProtocolError(
      "PROTOCOL_UNSUPPORTED",
      "Unsupported THOUGHT Agent protocol version.",
    );
  }
}

export function parseCreateRunRequest(
  value: unknown,
): ThoughtAgentCreateRunRequest {
  const object = asObject(value, "create run request");
  assertProtocolVersion(object.protocolVersion);
  const promptLine = requireString(object.promptLine, "promptLine");
  assertThoughtLine(promptLine, "prompt");
  const specId = requireString(object.specId, "specId");
  const requestedAgent = asObject(object.requestedAgent, "requestedAgent");
  const adapterId = requireString(requestedAgent.adapterId, "adapterId");
  const model =
    requestedAgent.model === null
      ? null
      : requestedAgent.model === undefined
        ? null
        : requireString(requestedAgent.model, "model");

  const client =
    object.client === undefined
      ? undefined
      : parseClientInfo(object.client);

  return {
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    promptLine,
    specId,
    requestedAgent: {
      adapterId,
      model,
    },
    ...(client ? { client } : {}),
  };
}

export function parseBridgeInfo(value: unknown): ThoughtAgentBridgeInfo {
  const object = asObject(value, "bridge");
  const bridgeId = requireString(object.bridgeId, "bridgeId");
  const bridgeVersion = requireString(object.bridgeVersion, "bridgeVersion");
  const installationId =
    object.installationId === undefined
      ? undefined
      : requireString(object.installationId, "installationId");
  const platform =
    object.platform === undefined
      ? undefined
      : requireString(object.platform, "platform");
  return {
    bridgeId,
    bridgeVersion,
    ...(installationId ? { installationId } : {}),
    ...(platform ? { platform } : {}),
  };
}

export function parseAdapterInfo(value: unknown): ThoughtAgentAdapterInfo {
  const object = asObject(value, "adapter");
  return {
    adapterId: requireString(object.adapterId, "adapterId"),
    adapterVersion: requireString(object.adapterVersion, "adapterVersion"),
  };
}

export function parseAgentInfo(value: unknown): ThoughtAgentInfo {
  const object = asObject(value, "agent");
  const metadataSource = object.metadataSource;
  if (
    metadataSource !== "reported" &&
    metadataSource !== "configured" &&
    metadataSource !== "unknown"
  ) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      "Invalid agent metadataSource.",
    );
  }
  return {
    product: requireString(object.product, "agent.product"),
    ...(optionalString(object.productVersion)
      ? { productVersion: String(object.productVersion) }
      : {}),
    ...(optionalString(object.provider) ? { provider: String(object.provider) } : {}),
    ...(optionalString(object.model) ? { model: String(object.model) } : {}),
    metadataSource,
  };
}

export function parseExecutionInfo(value: unknown): ThoughtAgentExecutionInfo {
  const object = asObject(value, "execution");
  return {
    visibleTurns: requirePositiveInteger(object.visibleTurns, "visibleTurns"),
    agentInvocations: requirePositiveInteger(
      object.agentInvocations,
      "agentInvocations",
    ),
    workspacePolicy: requireString(object.workspacePolicy, "workspacePolicy"),
    sandboxPolicy: requireString(object.sandboxPolicy, "sandboxPolicy"),
    approvalPolicy: requireString(object.approvalPolicy, "approvalPolicy"),
    userConfigPolicy: requireString(
      object.userConfigPolicy,
      "userConfigPolicy",
    ),
  };
}

export async function parseAgentOutput(
  raw: string,
  maxRawBytes = 16 * 1024,
): Promise<ParsedThoughtAgentOutput> {
  if (byteLengthUtf8(raw) > maxRawBytes) {
    throw new ThoughtAgentProtocolError(
      "RESULT_TOO_LARGE",
      "Agent raw result is too large.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_UNPARSEABLE",
      "The agent final response was not valid JSON.",
    );
  }

  const object = asObject(parsed, "agent output");
  const keys = Object.keys(object);
  const allowedKeys = new Set(["schema", "agentLine", "declaration"]);
  if (
    keys.some((key) => !allowedKeys.has(key)) ||
    object.schema !== THOUGHT_AGENT_RESULT_VERSION ||
    typeof object.agentLine !== "string"
  ) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      "The agent final response did not match the required schema.",
    );
  }
  assertThoughtLine(object.agentLine, "agent");
  const declaration =
    object.declaration === undefined
      ? undefined
      : parseAgentDeclaration(object.declaration);

  return {
    raw,
    rawSha256: await sha256Hex(raw),
    agentLine: object.agentLine,
    agentLineSha256: await sha256Hex(object.agentLine),
    ...(declaration ? { declaration } : {}),
  };
}

export async function buildThoughtAgentInput(input: {
  promptLine: string;
}): Promise<BuiltThoughtAgentInput> {
  assertThoughtLine(input.promptLine, "prompt");
  const text = input.promptLine;

  return {
    text,
    sha256: await sha256Hex(text),
    mediaType: "text/plain; charset=utf-8",
  };
}

export function parseAgentDeclaration(value: unknown): ThoughtAgentDeclaration {
  const object = asObject(value, "agent declaration");
  const keys = Object.keys(object);
  const requiredKeys = [
    "schema",
    "agentLabel",
    "specId",
    "specHash",
    "declaredOneCreativeResult",
  ];
  if (
    keys.length !== requiredKeys.length ||
    requiredKeys.some((key) => !keys.includes(key)) ||
    object.schema !== THOUGHT_AGENT_DECLARATION_VERSION ||
    object.declaredOneCreativeResult !== true
  ) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      "The Agent declaration did not match the required schema.",
    );
  }
  const agentLabel = requireString(object.agentLabel, "declaration.agentLabel");
  const specId = requireString(object.specId, "declaration.specId");
  const specHash = requireString(object.specHash, "declaration.specHash");
  if (
    byteLengthUtf8(agentLabel) > 128 ||
    !/^0x[0-9a-f]{64}$/.test(specId) ||
    !/^0x[0-9a-f]{64}$/.test(specHash)
  ) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      "The Agent declaration contains invalid fields.",
    );
  }
  return {
    schema: THOUGHT_AGENT_DECLARATION_VERSION,
    agentLabel,
    specId,
    specHash,
    declaredOneCreativeResult: true,
  };
}

export async function buildThoughtAgentReceipt(
  input: ThoughtAgentReceiptInput,
): Promise<BuiltThoughtAgentReceipt> {
  const receipt: ThoughtAgentReceipt = {
    receiptVersion: THOUGHT_AGENT_RECEIPT_VERSION,
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    runId: input.runId,
    origin: input.origin,
    spec: input.spec,
    promptSha256: input.promptSha256,
    agentInputSha256: input.agentInputSha256,
    adapter: {
      id: input.adapter.adapterId,
      version: input.adapter.adapterVersion,
    },
    agent: input.agent,
    bridge: {
      id: input.bridge.bridgeId,
      version: input.bridge.bridgeVersion,
      ...(input.bridge.platform ? { platform: input.bridge.platform } : {}),
    },
    round: input.round,
    output: input.output,
    timing: input.timing,
    trust: {
      transportVerified: true,
      bridgeDeclared: true,
      providerAttested: false,
    },
  };
  const json = JSON.stringify(receipt);
  return {
    receipt,
    json,
    sha256: await sha256Hex(json),
  };
}

export function parseResultRequest(
  value: unknown,
): Omit<ThoughtAgentResultRequest, "output"> & {
  output: Omit<ThoughtAgentOutput, "rawSha256" | "agentLineSha256"> & {
    rawSha256: string;
    agentLineSha256: string;
  };
} {
  const object = asObject(value, "result request");
  assertProtocolVersion(object.protocolVersion);
  const output = asObject(object.output, "output");
  return {
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    invocationId: requireString(object.invocationId, "invocationId"),
    bridge: parseBridgeInfo(object.bridge),
    adapter: parseAdapterInfo(object.adapter),
    agent: parseAgentInfo(object.agent),
    execution: parseExecutionInfo(object.execution),
    startedAt: requireString(object.startedAt, "startedAt"),
    completedAt: requireString(object.completedAt, "completedAt"),
    output: {
      mediaType: "application/json",
      raw: requireString(output.raw, "output.raw"),
      rawSha256: requireString(output.rawSha256, "output.rawSha256"),
      agentLine: requireString(output.agentLine, "output.agentLine"),
      agentLineSha256: requireString(
        output.agentLineSha256,
        "output.agentLineSha256",
      ),
    },
  };
}

function parseClientInfo(value: unknown): ThoughtAgentClientInfo {
  const object = asObject(value, "client");
  return {
    ...(optionalString(object.surface) ? { surface: String(object.surface) } : {}),
    ...(optionalString(object.appVersion)
      ? { appVersion: String(object.appVersion) }
      : {}),
  };
}

function optionalString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      `Invalid or missing ${field}.`,
    );
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      `Invalid or missing ${field}.`,
    );
  }
  return value;
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new ThoughtAgentProtocolError(
      "AGENT_OUTPUT_SCHEMA_INVALID",
      `Invalid ${field}.`,
    );
  }
  return value as Record<string, unknown>;
}

import { id, keccak256, toUtf8Bytes } from "ethers";

import {
  canonicalJsonStringify,
  type CanonicalJson,
} from "./thought-v2-canonical-json";
import { assertThoughtV2Context } from "./thought-v2-context-profile";
import {
  assertThoughtV2Line,
  deriveThoughtV2WorkHashes,
  type ThoughtV2WorkHashes,
} from "./thought-v2-terminal-work-profile";

export const THOUGHT_V2_PROVENANCE_SCHEMA = "inshell.thought.provenance.v2" as const;
export const THOUGHT_V2_MAX_PROVENANCE_BYTES = 20_000;

export type ThoughtV2AgentRunSource =
  | "agent_declared"
  | "connector_observed"
  | "runtime_configured"
  | "unknown";

export type ThoughtV2Declaration = {
  label: string;
  source: ThoughtV2AgentRunSource | "manual";
  status: "declared-unverified";
};

export type ThoughtV2ProtocolBinding = {
  manifestKeccak256: `0x${string}`;
  protocolReleaseId: `0x${string}`;
  thoughtSpecHash: `0x${string}`;
  thoughtSpecId: `0x${string}`;
};

export type ThoughtV2SelectedSpecEvidence = {
  exactSpecBytes: Uint8Array;
  specName: string;
};

export type ThoughtV2MintContext = {
  chainId: string;
  intendedMinter: `0x${string}`;
  thoughtNft: `0x${string}`;
};

export type ThoughtV2ManualProcess = {
  agentDeclaration: ThoughtV2Declaration & { source: "manual" };
  kind: "manual";
  modelDeclaration: ThoughtV2Declaration & { source: "manual"; identifier?: string };
};

export type ThoughtV2AgentRunProcess = {
  agentDeclaration: ThoughtV2Declaration & { source: ThoughtV2AgentRunSource };
  kind: "agent-run";
  modelDeclaration: ThoughtV2Declaration & {
    source: ThoughtV2AgentRunSource;
    identifier?: string;
  };
  transport: {
    adapter?: string;
    provider?: string;
    resultEnvelopeKeccak256: `0x${string}`;
    route?: string;
    runIdHash: `0x${string}`;
  };
};

export type ThoughtV2Process = ThoughtV2ManualProcess | ThoughtV2AgentRunProcess;

export type ThoughtV2ProcessEvidence =
  | ThoughtV2ManualProcess
  | Omit<ThoughtV2AgentRunProcess, "transport"> & {
    transport: {
      adapter?: string;
      provider?: string;
      resultEnvelope: CanonicalJson;
      route?: string;
      runReference: string;
    };
  };

export type ThoughtV2Provenance = {
  mintContext: ThoughtV2MintContext;
  process: ThoughtV2Process;
  protocol: ThoughtV2ProtocolBinding;
  schema: typeof THOUGHT_V2_PROVENANCE_SCHEMA;
  work: ThoughtV2WorkHashes & {
    agentLine: string;
    promptLine: string;
  };
};

export type ThoughtV2ProvenanceInput = {
  agentLine: string;
  mintContext: ThoughtV2MintContext;
  process: ThoughtV2ProcessEvidence;
  promptLine: string;
  protocol: ThoughtV2ProtocolBinding;
  selectedSpec: ThoughtV2SelectedSpecEvidence;
};

export type ThoughtV2ProvenanceExpectedFacts = {
  agentLine?: string;
  attestationClaim?: ThoughtV2ProvenanceAttestationFacts;
  chainId?: string;
  agent?: string;
  model?: string;
  intendedMinter?: `0x${string}`;
  manifestKeccak256?: `0x${string}`;
  promptLine?: string;
  protocolReleaseId?: `0x${string}`;
  provenanceHash?: `0x${string}`;
  thoughtNft?: `0x${string}`;
  thoughtSpecHash?: `0x${string}`;
  thoughtSpecId?: `0x${string}`;
  workHash?: `0x${string}`;
};

export type ThoughtV2ProvenanceAttestationFacts = {
  chainId: string;
  agentHash: `0x${string}`;
  modelHash: `0x${string}`;
  intendedMinter: `0x${string}`;
  protocolReleaseId: `0x${string}`;
  provenanceHash: `0x${string}`;
  runIdHash: `0x${string}`;
  thoughtNft: `0x${string}`;
  thoughtSpecHash: `0x${string}`;
  thoughtSpecId: `0x${string}`;
  workHash: `0x${string}`;
};

export type ThoughtV2ProvenanceIssue = {
  code: string;
  message: string;
  path: string;
};

export type ThoughtV2ProvenanceVerification = {
  conforming: boolean;
  exactBytes: Uint8Array;
  issues: ThoughtV2ProvenanceIssue[];
  parsed?: ThoughtV2Provenance;
  provenanceHash: `0x${string}`;
};

export type VerifiedCanonicalThoughtV2Provenance = {
  canonicalJson: string;
  exactBytes: Uint8Array;
  provenance: ThoughtV2Provenance;
  provenanceHash: `0x${string}`;
  verification: ThoughtV2ProvenanceVerification;
};

type JsonObject = Record<string, unknown>;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const bytes32Pattern = /^0x[0-9a-f]{64}$/;
const addressPattern = /^(?!0x0{40}$)0x[0-9a-f]{40}$/;
const chainIdPattern = /^[1-9][0-9]*$/;
const publicIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@+\-]*$/;
const specNamePattern = /^THOUGHT\.v[1-9][0-9]*\.md$/;
const zeroBytes32 = `0x${"00".repeat(32)}`;
const agentRunSources: readonly ThoughtV2AgentRunSource[] = [
  "agent_declared",
  "connector_observed",
  "runtime_configured",
  "unknown",
];

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addIssue = (
  issues: ThoughtV2ProvenanceIssue[],
  code: string,
  path: string,
  message: string,
): void => {
  issues.push({ code, message, path });
};

const inspectObject = (
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[],
  issues: ThoughtV2ProvenanceIssue[],
): JsonObject | undefined => {
  if (!isObject(value)) {
    addIssue(issues, "schema.object", path, `${path} must be an object`);
    return undefined;
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      addIssue(issues, "schema.missing", `${path}.${key}`, `missing ${path}.${key}`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, "schema.additional", `${path}.${key}`, `unexpected ${path}.${key}`);
    }
  }
  return value;
};

const validateBytes32 = (
  value: unknown,
  path: string,
  issues: ThoughtV2ProvenanceIssue[],
  nonzero = false,
): value is `0x${string}` => {
  const valid = typeof value === "string" && bytes32Pattern.test(value)
    && (!nonzero || value !== zeroBytes32);
  if (!valid) addIssue(issues, "schema.bytes32", path, `${path} must be lowercase ${nonzero ? "nonzero " : ""}bytes32`);
  return valid;
};

const validateAddress = (
  value: unknown,
  path: string,
  issues: ThoughtV2ProvenanceIssue[],
): value is `0x${string}` => {
  const valid = typeof value === "string" && addressPattern.test(value);
  if (!valid) addIssue(issues, "schema.address", path, `${path} must be a lowercase nonzero address`);
  return valid;
};

const validatePublicIdentifier = (
  value: unknown,
  path: string,
  issues: ThoughtV2ProvenanceIssue[],
): value is string => {
  const bytes = typeof value === "string" ? encoder.encode(value).length : 0;
  const valid = typeof value === "string" && bytes >= 1 && bytes <= 128
    && publicIdentifierPattern.test(value);
  if (!valid) addIssue(issues, "schema.public_identifier", path, `${path} is not a public identifier`);
  return valid;
};

const validatePublicString = (
  value: unknown,
  path: string,
  issues: ThoughtV2ProvenanceIssue[],
): value is string => {
  const bytes = typeof value === "string" ? encoder.encode(value).length : 0;
  const valid = typeof value === "string" && bytes >= 1 && bytes <= 256
    && !value.startsWith(" ") && !value.endsWith(" ");
  if (!valid) addIssue(issues, "schema.public_string", path, `${path} is not a bounded public string`);
  return valid;
};

const validateDeclaration = (
  value: unknown,
  path: string,
  kind: "manual" | "agent-run",
  model: boolean,
  issues: ThoughtV2ProvenanceIssue[],
): JsonObject | undefined => {
  const object = inspectObject(value, path, ["label", "source", "status"], model ? ["identifier"] : [], issues);
  if (!object) return undefined;
  try {
    assertThoughtV2Context(String(object.label ?? ""), model ? "model" : "agent");
  } catch (error) {
    addIssue(issues, "profile.context", `${path}.label`, String(error));
  }
  if (object.status !== "declared-unverified") {
    addIssue(issues, "schema.const", `${path}.status`, "declaration status must be declared-unverified");
  }
  const validSource = kind === "manual"
    ? object.source === "manual"
    : agentRunSources.includes(object.source as ThoughtV2AgentRunSource);
  if (!validSource) addIssue(issues, "schema.source", `${path}.source`, `invalid ${kind} declaration source`);
  if (object.identifier !== undefined) validatePublicString(object.identifier, `${path}.identifier`, issues);
  return object;
};

const validateProcess = (
  value: unknown,
  issues: ThoughtV2ProvenanceIssue[],
): ThoughtV2Process | undefined => {
  if (!isObject(value) || (value.kind !== "manual" && value.kind !== "agent-run")) {
    addIssue(issues, "schema.process", "process", "process.kind must be manual or agent-run");
    return undefined;
  }
  const kind = value.kind;
  const object = inspectObject(
    value,
    "process",
    kind === "manual"
      ? ["agentDeclaration", "kind", "modelDeclaration"]
      : ["agentDeclaration", "kind", "modelDeclaration", "transport"],
    [],
    issues,
  );
  if (!object) return undefined;
  validateDeclaration(object.agentDeclaration, "process.agentDeclaration", kind, false, issues);
  validateDeclaration(object.modelDeclaration, "process.modelDeclaration", kind, true, issues);
  if (kind === "agent-run") {
    const transport = inspectObject(
      object.transport,
      "process.transport",
      ["resultEnvelopeKeccak256", "runIdHash"],
      ["adapter", "provider", "route"],
      issues,
    );
    if (transport) {
      validateBytes32(transport.resultEnvelopeKeccak256, "process.transport.resultEnvelopeKeccak256", issues, true);
      validateBytes32(transport.runIdHash, "process.transport.runIdHash", issues, true);
      for (const field of ["adapter", "provider", "route"] as const) {
        if (transport[field] !== undefined) validatePublicIdentifier(transport[field], `process.transport.${field}`, issues);
      }
    }
  }
  return value as unknown as ThoughtV2Process;
};

const validateSelectedSpec = (
  selectedSpec: ThoughtV2SelectedSpecEvidence,
  protocol: ThoughtV2ProtocolBinding,
  issues: ThoughtV2ProvenanceIssue[],
): void => {
  if (!specNamePattern.test(selectedSpec.specName)) {
    addIssue(issues, "selected_spec.name", "selectedSpec.specName", "invalid THOUGHT spec name");
  }
  const expectedId = id(selectedSpec.specName);
  const expectedHash = keccak256(selectedSpec.exactSpecBytes);
  if (protocol.thoughtSpecId !== expectedId) {
    addIssue(issues, "selected_spec.id", "protocol.thoughtSpecId", "selected spec ID mismatch");
  }
  if (protocol.thoughtSpecHash !== expectedHash) {
    addIssue(issues, "selected_spec.hash", "protocol.thoughtSpecHash", "selected spec exact-byte hash mismatch");
  }
};

const buildProcess = (evidence: ThoughtV2ProcessEvidence): ThoughtV2Process => {
  if (evidence.kind === "manual") return structuredClone(evidence);
  const { resultEnvelope, runReference, ...transportFields } = evidence.transport;
  const issues: ThoughtV2ProvenanceIssue[] = [];
  validatePublicString(runReference, "process.transport.runReference", issues);
  for (const field of ["adapter", "provider", "route"] as const) {
    const value = transportFields[field];
    if (value !== undefined) validatePublicIdentifier(value, `process.transport.${field}`, issues);
  }
  if (issues.length > 0) throw new Error(issues.map(({ message }) => message).join("; "));
  const resultEnvelopeJson = canonicalJsonStringify(resultEnvelope);
  return {
    agentDeclaration: { ...evidence.agentDeclaration },
    kind: "agent-run",
    modelDeclaration: { ...evidence.modelDeclaration },
    transport: {
      ...transportFields,
      resultEnvelopeKeccak256: keccak256(toUtf8Bytes(resultEnvelopeJson)) as `0x${string}`,
      runIdHash: keccak256(toUtf8Bytes(runReference)) as `0x${string}`,
    },
  };
};

export const verifyThoughtV2Provenance = (
  exactBytes: Uint8Array,
  expected: ThoughtV2ProvenanceExpectedFacts = {},
  selectedSpec?: ThoughtV2SelectedSpecEvidence,
): ThoughtV2ProvenanceVerification => {
  const issues: ThoughtV2ProvenanceIssue[] = [];
  const provenanceHash = keccak256(exactBytes) as `0x${string}`;
  if (exactBytes.length === 0 || exactBytes.length > THOUGHT_V2_MAX_PROVENANCE_BYTES) {
    addIssue(issues, "bytes.size", "provenance", `provenance must be 1 through ${THOUGHT_V2_MAX_PROVENANCE_BYTES} bytes`);
  }
  if (exactBytes.length >= 3 && exactBytes[0] === 0xef && exactBytes[1] === 0xbb && exactBytes[2] === 0xbf) {
    addIssue(issues, "bytes.bom", "provenance", "provenance must not contain a UTF-8 BOM");
  }

  let text = "";
  try {
    text = decoder.decode(exactBytes);
  } catch {
    addIssue(issues, "bytes.utf8", "provenance", "provenance must be valid UTF-8");
    return { conforming: false, exactBytes, issues, provenanceHash };
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(text);
  } catch {
    addIssue(issues, "json.parse", "provenance", "provenance must be JSON");
    return { conforming: false, exactBytes, issues, provenanceHash };
  }
  try {
    if (canonicalJsonStringify(parsedValue as CanonicalJson) !== text) {
      addIssue(issues, "json.jcs", "provenance", "provenance bytes are not canonical JCS");
    }
  } catch {
    addIssue(issues, "json.jcs", "provenance", "provenance cannot be canonicalized");
  }

  const root = inspectObject(parsedValue, "provenance", ["mintContext", "process", "protocol", "schema", "work"], [], issues);
  if (!root) return { conforming: false, exactBytes, issues, provenanceHash };
  if (root.schema !== THOUGHT_V2_PROVENANCE_SCHEMA) {
    addIssue(issues, "schema.const", "provenance.schema", "provenance schema mismatch");
  }

  const mintContext = inspectObject(root.mintContext, "mintContext", ["chainId", "intendedMinter", "thoughtNft"], [], issues);
  if (mintContext) {
    if (typeof mintContext.chainId !== "string" || !chainIdPattern.test(mintContext.chainId)) {
      addIssue(issues, "schema.chain_id", "mintContext.chainId", "chainId must be a positive decimal string");
    }
    validateAddress(mintContext.intendedMinter, "mintContext.intendedMinter", issues);
    validateAddress(mintContext.thoughtNft, "mintContext.thoughtNft", issues);
  }

  const process = validateProcess(root.process, issues);
  const protocol = inspectObject(root.protocol, "protocol", ["manifestKeccak256", "protocolReleaseId", "thoughtSpecHash", "thoughtSpecId"], [], issues);
  if (protocol) {
    for (const field of ["manifestKeccak256", "protocolReleaseId", "thoughtSpecHash", "thoughtSpecId"] as const) {
      validateBytes32(protocol[field], `protocol.${field}`, issues, true);
    }
  }

  const work = inspectObject(
    root.work,
    "work",
    ["agentLine", "agentLineKeccak256", "conversationIdentityHash", "promptLine", "promptLineKeccak256", "workHash"],
    [],
    issues,
  );
  if (work) {
    try {
      assertThoughtV2Line(String(work.promptLine ?? ""), "prompt");
    } catch (error) {
      addIssue(issues, "profile.work", "work.promptLine", String(error));
    }
    try {
      assertThoughtV2Line(String(work.agentLine ?? ""), "agent");
    } catch (error) {
      addIssue(issues, "profile.work", "work.agentLine", String(error));
    }
    for (const field of ["agentLineKeccak256", "conversationIdentityHash", "promptLineKeccak256", "workHash"] as const) {
      validateBytes32(work[field], `work.${field}`, issues);
    }
    if (typeof work.promptLine === "string" && typeof work.agentLine === "string") {
      try {
        const hashes = deriveThoughtV2WorkHashes(work.promptLine, work.agentLine);
        for (const field of Object.keys(hashes) as (keyof ThoughtV2WorkHashes)[]) {
          if (work[field] !== hashes[field]) {
            addIssue(issues, "commitment.work", `work.${field}`, `${field} does not match the exact lines`);
          }
        }
      } catch {
        // Profile issues above are authoritative and already precise.
      }
    }
  }

  if (protocol && selectedSpec) validateSelectedSpec(selectedSpec, protocol as ThoughtV2ProtocolBinding, issues);

  const parity: [keyof ThoughtV2ProvenanceExpectedFacts, unknown, string][] = [
    ["agentLine", work?.agentLine, "work.agentLine"],
    ["promptLine", work?.promptLine, "work.promptLine"],
    ["workHash", work?.workHash, "work.workHash"],
    ["agent", process?.agentDeclaration.label, "process.agentDeclaration.label"],
    ["model", process?.modelDeclaration.label, "process.modelDeclaration.label"],
    ["chainId", mintContext?.chainId, "mintContext.chainId"],
    ["intendedMinter", mintContext?.intendedMinter, "mintContext.intendedMinter"],
    ["thoughtNft", mintContext?.thoughtNft, "mintContext.thoughtNft"],
    ["manifestKeccak256", protocol?.manifestKeccak256, "protocol.manifestKeccak256"],
    ["protocolReleaseId", protocol?.protocolReleaseId, "protocol.protocolReleaseId"],
    ["thoughtSpecHash", protocol?.thoughtSpecHash, "protocol.thoughtSpecHash"],
    ["thoughtSpecId", protocol?.thoughtSpecId, "protocol.thoughtSpecId"],
    ["provenanceHash", provenanceHash, "provenance"],
  ];
  for (const [field, actual, path] of parity) {
    if (expected[field] !== undefined && expected[field] !== actual) {
      addIssue(issues, "parity.typed", path, `${String(field)} does not match typed state`);
    }
  }

  const attestation = expected.attestationClaim;
  if (attestation) {
    if (process?.kind !== "agent-run") {
      addIssue(
        issues,
        "attestation.process_kind",
        "process.kind",
        "creation attestation requires canonical Agent-run provenance",
      );
    }
    const attestationParity: [keyof ThoughtV2ProvenanceAttestationFacts, unknown, string][] = [
      ["chainId", mintContext?.chainId, "mintContext.chainId"],
      [
        "agentHash",
        process ? keccak256(toUtf8Bytes(process.agentDeclaration.label)) : undefined,
        "process.agentDeclaration.label",
      ],
      [
        "modelHash",
        process ? keccak256(toUtf8Bytes(process.modelDeclaration.label)) : undefined,
        "process.modelDeclaration.label",
      ],
      ["intendedMinter", mintContext?.intendedMinter, "mintContext.intendedMinter"],
      ["protocolReleaseId", protocol?.protocolReleaseId, "protocol.protocolReleaseId"],
      ["provenanceHash", provenanceHash, "provenance"],
      [
        "runIdHash",
        process?.kind === "agent-run" ? process.transport.runIdHash : undefined,
        "process.transport.runIdHash",
      ],
      ["thoughtNft", mintContext?.thoughtNft, "mintContext.thoughtNft"],
      ["thoughtSpecHash", protocol?.thoughtSpecHash, "protocol.thoughtSpecHash"],
      ["thoughtSpecId", protocol?.thoughtSpecId, "protocol.thoughtSpecId"],
      ["workHash", work?.workHash, "work.workHash"],
    ];
    for (const [field, actual, path] of attestationParity) {
      if (attestation[field] !== actual) {
        addIssue(
          issues,
          "attestation.mismatch",
          path,
          `attestation ${String(field)} does not match canonical provenance`,
        );
      }
    }
  }

  const parsed = root as unknown as ThoughtV2Provenance;
  return { conforming: issues.length === 0, exactBytes, issues, parsed, provenanceHash };
};

export const buildVerifiedCanonicalThoughtV2Provenance = (
  input: ThoughtV2ProvenanceInput,
): VerifiedCanonicalThoughtV2Provenance => {
  assertThoughtV2Line(input.promptLine, "prompt");
  assertThoughtV2Line(input.agentLine, "agent");
  assertThoughtV2Context(input.process.agentDeclaration.label, "agent");
  assertThoughtV2Context(input.process.modelDeclaration.label, "model");

  const provenance: ThoughtV2Provenance = {
    mintContext: { ...input.mintContext },
    process: buildProcess(input.process),
    protocol: { ...input.protocol },
    schema: THOUGHT_V2_PROVENANCE_SCHEMA,
    work: {
      agentLine: input.agentLine,
      promptLine: input.promptLine,
      ...deriveThoughtV2WorkHashes(input.promptLine, input.agentLine),
    },
  };
  const canonicalJson = canonicalJsonStringify(provenance as unknown as CanonicalJson);
  const exactBytes = encoder.encode(canonicalJson);
  const provenanceHash = keccak256(exactBytes) as `0x${string}`;
  const verification = verifyThoughtV2Provenance(
    exactBytes,
    {
      agentLine: input.agentLine,
      chainId: input.mintContext.chainId,
      agent: input.process.agentDeclaration.label,
      model: input.process.modelDeclaration.label,
      intendedMinter: input.mintContext.intendedMinter,
      manifestKeccak256: input.protocol.manifestKeccak256,
      promptLine: input.promptLine,
      protocolReleaseId: input.protocol.protocolReleaseId,
      provenanceHash,
      thoughtNft: input.mintContext.thoughtNft,
      thoughtSpecHash: input.protocol.thoughtSpecHash,
      thoughtSpecId: input.protocol.thoughtSpecId,
      workHash: provenance.work.workHash as `0x${string}`,
    },
    input.selectedSpec,
  );
  if (!verification.conforming) {
    throw new Error(`built provenance failed verification: ${verification.issues.map(({ message }) => message).join("; ")}`);
  }
  return { canonicalJson, exactBytes, provenance, provenanceHash, verification };
};

import { getBytes, keccak256, toUtf8Bytes } from "ethers";

import {
  canonicalJsonStringify,
  MAX_PROVENANCE_BYTES,
  THOUGHT_PROVENANCE_ID,
  thoughtWorkHashes,
  type CanonicalJson,
} from "./thought-v2-protocol";

export type ThoughtProtocolAnchor = {
  id: string;
  keccak256: string;
  ref: string;
};

export type ThoughtAgentDeclaration = {
  schema: "inshell.thought.agent-declaration.v1";
  agentLabel: string;
  specId: string;
  specHash: string;
  declaredOneCreativeResult: true;
};

export type ThoughtTransport =
  | { kind: "manual" }
  | { kind: "run"; runId: string; rawResponseSha256: string };

export type ThoughtProvenanceV2 = {
  schema: typeof THOUGHT_PROVENANCE_ID;
  protocol: ThoughtProtocolAnchor;
  spec: ThoughtProtocolAnchor;
  workProfile: ThoughtProtocolAnchor;
  renderer: ThoughtProtocolAnchor;
  promptLine: string;
  agentLine: string;
  promptLineKeccak256: string;
  agentLineKeccak256: string;
  agentIdentityHash: string;
  workHash: string;
  binaryFieldPacked: string;
  binaryFieldKeccak256: string;
  declaration?: ThoughtAgentDeclaration;
  transport: ThoughtTransport;
  preMint?: { [key: string]: CanonicalJson };
};

export type ThoughtProvenanceBuildInput = {
  protocol: ThoughtProtocolAnchor;
  spec: ThoughtProtocolAnchor;
  workProfile: ThoughtProtocolAnchor;
  renderer: ThoughtProtocolAnchor;
  promptLine: string;
  agentLine: string;
  declaration?: ThoughtAgentDeclaration;
  transport: ThoughtTransport;
  preMint?: { [key: string]: CanonicalJson };
};

const bytes32Pattern = /^0x[0-9a-f]{64}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

const assertAnchor = (anchor: ThoughtProtocolAnchor, label: string): void => {
  if (!anchor.id || !anchor.ref || !bytes32Pattern.test(anchor.keccak256)) {
    throw new Error(`${label} anchor is invalid`);
  }
};

export const buildThoughtProvenance = (input: ThoughtProvenanceBuildInput): ThoughtProvenanceV2 => {
  assertAnchor(input.protocol, "protocol");
  assertAnchor(input.spec, "spec");
  assertAnchor(input.workProfile, "work profile");
  assertAnchor(input.renderer, "renderer");
  if (input.transport.kind === "run") {
    if (!input.transport.runId || !sha256Pattern.test(input.transport.rawResponseSha256)) {
      throw new Error("run transport is invalid");
    }
  }
  const hashes = thoughtWorkHashes(input.promptLine, input.agentLine);
  return {
    schema: THOUGHT_PROVENANCE_ID,
    protocol: input.protocol,
    spec: input.spec,
    workProfile: input.workProfile,
    renderer: input.renderer,
    promptLine: input.promptLine,
    agentLine: input.agentLine,
    promptLineKeccak256: hashes.promptLineKeccak256,
    agentLineKeccak256: hashes.agentLineKeccak256,
    agentIdentityHash: hashes.agentIdentityHash,
    workHash: hashes.workHash,
    binaryFieldPacked: hashes.binaryFieldPacked,
    binaryFieldKeccak256: hashes.binaryFieldKeccak256,
    ...(input.declaration ? { declaration: input.declaration } : {}),
    transport: input.transport,
    ...(input.preMint ? { preMint: input.preMint } : {}),
  };
};

export const serializeThoughtProvenance = (provenance: ThoughtProvenanceV2): string => {
  const serialized = canonicalJsonStringify(provenance as unknown as CanonicalJson);
  const size = toUtf8Bytes(serialized).length;
  if (size > MAX_PROVENANCE_BYTES) throw new Error(`provenance is ${size}/${MAX_PROVENANCE_BYTES} bytes`);
  return serialized;
};

export const thoughtProvenanceKeccak256 = (serialized: string): string =>
  keccak256(toUtf8Bytes(serialized));

export const verifyThoughtProvenance = (provenance: ThoughtProvenanceV2): string[] => {
  const errors: string[] = [];
  if (provenance.schema !== THOUGHT_PROVENANCE_ID) errors.push("schema mismatch");
  try {
    assertAnchor(provenance.protocol, "protocol");
    assertAnchor(provenance.spec, "spec");
    assertAnchor(provenance.workProfile, "work profile");
    assertAnchor(provenance.renderer, "renderer");
    const expected = thoughtWorkHashes(provenance.promptLine, provenance.agentLine);
    for (const key of [
      "promptLineKeccak256",
      "agentLineKeccak256",
      "agentIdentityHash",
      "workHash",
      "binaryFieldPacked",
      "binaryFieldKeccak256",
    ] as const) {
      if (provenance[key] !== expected[key]) errors.push(`${key} mismatch`);
    }
    if (provenance.transport.kind === "run") {
      if (!provenance.transport.runId || !sha256Pattern.test(provenance.transport.rawResponseSha256)) {
        errors.push("run transport mismatch");
      }
    }
    serializeThoughtProvenance(provenance);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
};

export const packedFieldBytes = (provenance: ThoughtProvenanceV2): Uint8Array =>
  getBytes(provenance.binaryFieldPacked);

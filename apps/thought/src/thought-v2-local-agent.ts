import { assertThoughtLine } from "@inshell/shared";

import { THOUGHT_V2_LOCAL_RELEASE } from "./thought-v2-local-release";
import type { ThoughtV2LocalProcess } from "./thought-v2-local-mint";

export type ThoughtV2LocalAgentDeclaration = {
  schema: "inshell.thought.agent-declaration.v1";
  status: "declared-unverified";
  agentLabel: string;
  declaredOneCreativeResult: true;
};

export type ThoughtV2LocalAgentResult = {
  schema: "inshell.thought.agent-result.v2";
  release: {
    protocolReleaseId: `0x${string}`;
    manifestKeccak256: `0x${string}`;
  };
  agentLine: string;
  declaration?: ThoughtV2LocalAgentDeclaration;
};

export type ThoughtV2LocalAgentEvidence = {
  result: ThoughtV2LocalAgentResult;
  runId: string;
  adapter: string;
  rawResponseSha256: string;
};

export const THOUGHT_V2_LOCAL_AGENT_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schema", "release", "agentLine"],
  properties: {
    schema: { const: "inshell.thought.agent-result.v2" },
    release: {
      type: "object",
      additionalProperties: false,
      required: ["protocolReleaseId", "manifestKeccak256"],
      properties: {
        protocolReleaseId: { const: THOUGHT_V2_LOCAL_RELEASE.protocol.protocolReleaseId },
        manifestKeccak256: { const: THOUGHT_V2_LOCAL_RELEASE.protocol.manifestKeccak256 },
      },
    },
    agentLine: {
      type: "string",
      minLength: 1,
      "x-thought-line-profile": THOUGHT_V2_LOCAL_RELEASE.protocol.workProfile.id,
      "x-thought-utf8-max-bytes": 64,
    },
    declaration: {
      type: "object",
      additionalProperties: false,
      required: ["schema", "status", "agentLabel", "declaredOneCreativeResult"],
      properties: {
        schema: { const: "inshell.thought.agent-declaration.v1" },
        status: { const: "declared-unverified" },
        agentLabel: { type: "string", minLength: 1, maxLength: 100 },
        declaredOneCreativeResult: { const: true },
      },
    },
  },
} as const;

const exactKeys = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key))
  );
};

export const buildThoughtV2LocalAgentResult = (
  agentLine: string,
  agentLabel: string,
): ThoughtV2LocalAgentResult => {
  assertThoughtLine(agentLine, "agent");
  if (!agentLabel || agentLabel.length > 100) {
    throw new Error("Agent label is invalid.");
  }
  return {
    schema: "inshell.thought.agent-result.v2",
    release: {
      protocolReleaseId: THOUGHT_V2_LOCAL_RELEASE.protocol.protocolReleaseId,
      manifestKeccak256: THOUGHT_V2_LOCAL_RELEASE.protocol.manifestKeccak256,
    },
    agentLine,
    declaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      agentLabel,
      declaredOneCreativeResult: true,
    },
  };
};

export const parseThoughtV2LocalAgentResult = (raw: string): ThoughtV2LocalAgentResult => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Agent result is not valid JSON.");
  }
  if (!exactKeys(value, ["schema", "release", "agentLine"], ["declaration"])) {
    throw new Error("Agent result shape mismatch.");
  }

  const result = value as ThoughtV2LocalAgentResult;
  if (result.schema !== "inshell.thought.agent-result.v2") {
    throw new Error("Agent result schema mismatch.");
  }
  if (!exactKeys(result.release, ["protocolReleaseId", "manifestKeccak256"])) {
    throw new Error("Agent result release shape mismatch.");
  }
  if (
    result.release.protocolReleaseId !== THOUGHT_V2_LOCAL_RELEASE.protocol.protocolReleaseId ||
    result.release.manifestKeccak256 !== THOUGHT_V2_LOCAL_RELEASE.protocol.manifestKeccak256
  ) {
    throw new Error("Agent result release mismatch.");
  }
  assertThoughtLine(result.agentLine, "agent");
  if (result.declaration !== undefined) {
    if (!exactKeys(result.declaration, ["schema", "status", "agentLabel", "declaredOneCreativeResult"])) {
      throw new Error("Agent declaration shape mismatch.");
    }
    if (
      result.declaration.schema !== "inshell.thought.agent-declaration.v1" ||
      result.declaration.status !== "declared-unverified" ||
      typeof result.declaration.agentLabel !== "string" ||
      result.declaration.agentLabel.length < 1 ||
      result.declaration.agentLabel.length > 100 ||
      result.declaration.declaredOneCreativeResult !== true
    ) {
      throw new Error("Agent declaration mismatch.");
    }
  }
  return result;
};

export const buildThoughtV2LocalAgentProcess = (
  evidence: ThoughtV2LocalAgentEvidence,
  agentLine: string,
): ThoughtV2LocalProcess => {
  const result = parseThoughtV2LocalAgentResult(JSON.stringify(evidence.result));
  if (!result.declaration) {
    throw new Error("A validated Agent declaration is required to mint this local THOUGHT V2 work.");
  }
  if (result.agentLine !== agentLine) {
    throw new Error("The validated Agent result does not match the current work.");
  }
  if (
    !evidence.runId ||
    !evidence.adapter ||
    !/^[0-9a-f]{64}$/.test(evidence.rawResponseSha256)
  ) {
    throw new Error("THOUGHT V2 Agent transport evidence is incomplete.");
  }
  return {
    kind: "agent-run",
    agentDeclaration: result.declaration,
    transport: {
      adapter: evidence.adapter,
      runId: evidence.runId,
      rawResponseSha256: evidence.rawResponseSha256,
    },
  };
};

import { assertThoughtV2TerminalLine as assertThoughtV2Line } from "@inshell/shared";
import {
  formatThoughtAgentModelLabel,
  thoughtAgentModelIdentifier,
  type ThoughtAgentMetadataSource,
  type ThoughtAgentReasoningEffort,
} from "@inshell/thought-agent-protocol";

import { assertThoughtV2Context } from "../contract-integration/current/reference/thought-v2-context-profile";
import {
  THOUGHT_V2_LOCAL_RELEASE,
  type ThoughtV2LocalRelease,
} from "./thought-v2-local-release";
import type { ThoughtV2LocalProcess } from "./thought-v2-local-mint";

export type ThoughtV2LocalAgentDeclaration = {
  schema: "inshell.thought.agent-declaration.v1";
  status: "declared-unverified";
  label: string;
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
  model?: string;
  reasoningEffort?: ThoughtAgentReasoningEffort;
  metadataSource?: ThoughtAgentMetadataSource;
};

export const buildThoughtV2LocalAgentOutputSchema = (
  release: ThoughtV2LocalRelease = THOUGHT_V2_LOCAL_RELEASE,
) => ({
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
        protocolReleaseId: { const: release.protocol.protocolReleaseId },
        manifestKeccak256: { const: release.protocol.manifestKeccak256 },
      },
    },
    agentLine: {
      type: "string",
      minLength: 1,
      "x-thought-line-profile": release.protocol.workProfile.id,
      "x-thought-utf8-max-bytes": 64,
    },
    declaration: {
      type: "object",
      additionalProperties: false,
      required: ["schema", "status", "label", "declaredOneCreativeResult"],
      properties: {
        schema: { const: "inshell.thought.agent-declaration.v1" },
        status: { const: "declared-unverified" },
        label: {
          type: "string",
          minLength: 1,
          "x-thought-context-profile": release.protocol.contextProfile.id,
          "x-thought-utf8-max-bytes": 64,
        },
        declaredOneCreativeResult: { const: true },
      },
    },
  },
} as const);

export const THOUGHT_V2_LOCAL_AGENT_OUTPUT_SCHEMA =
  buildThoughtV2LocalAgentOutputSchema();

const exactKeys = (value: unknown, required: readonly string[], optional: readonly string[] = []) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
};

export const buildThoughtV2LocalAgentResult = (
  agentLine: string,
  agentLabel: string,
  release: ThoughtV2LocalRelease = THOUGHT_V2_LOCAL_RELEASE,
): ThoughtV2LocalAgentResult => {
  assertThoughtV2Line(agentLine, "agent");
  assertThoughtV2Context(agentLabel, "agent");
  return {
    schema: "inshell.thought.agent-result.v2",
    release: {
      protocolReleaseId: release.protocol.protocolReleaseId,
      manifestKeccak256: release.protocol.manifestKeccak256,
    },
    agentLine,
    declaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      label: agentLabel,
      declaredOneCreativeResult: true,
    },
  };
};

export const parseThoughtV2LocalAgentResult = (
  raw: string,
  release: ThoughtV2LocalRelease = THOUGHT_V2_LOCAL_RELEASE,
): ThoughtV2LocalAgentResult => {
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
  if (result.schema !== "inshell.thought.agent-result.v2") throw new Error("Agent result schema mismatch.");
  if (!exactKeys(result.release, ["protocolReleaseId", "manifestKeccak256"])) {
    throw new Error("Agent result release shape mismatch.");
  }
  if (
    result.release.protocolReleaseId !== release.protocol.protocolReleaseId ||
    result.release.manifestKeccak256 !== release.protocol.manifestKeccak256
  ) {
    throw new Error("Agent result release mismatch.");
  }
  assertThoughtV2Line(result.agentLine, "agent");
  if (result.declaration !== undefined) {
    if (!exactKeys(result.declaration, ["schema", "status", "label", "declaredOneCreativeResult"])) {
      throw new Error("Agent declaration shape mismatch.");
    }
    if (
      result.declaration.schema !== "inshell.thought.agent-declaration.v1" ||
      result.declaration.status !== "declared-unverified" ||
      result.declaration.declaredOneCreativeResult !== true
    ) {
      throw new Error("Agent declaration mismatch.");
    }
    assertThoughtV2Context(result.declaration.label, "agent");
  }
  return result;
};

export const buildThoughtV2LocalAgentProcess = (
  evidence: ThoughtV2LocalAgentEvidence,
  agentLine: string,
): ThoughtV2LocalProcess => {
  const result = parseThoughtV2LocalAgentResult(JSON.stringify(evidence.result));
  if (result.agentLine !== agentLine) {
    throw new Error("The validated Agent result does not match the current work.");
  }
  const selectedAgent =
    evidence.adapter === "codex"
      ? "Codex"
      : evidence.adapter === "claude"
        ? "Claude"
        : "";
  if (!selectedAgent) {
    throw new Error("The selected Agent adapter is not supported.");
  }
  if (result.declaration && result.declaration.label !== selectedAgent) {
    throw new Error(
      "The Agent result label does not match the Agent selected by the App.",
    );
  }
  const modelLabel = formatThoughtAgentModelLabel(
    evidence.model,
    evidence.reasoningEffort,
  );
  const modelIdentifier = thoughtAgentModelIdentifier(
    evidence.model,
    evidence.reasoningEffort,
  );
  if (modelLabel === "unknown") {
    throw new Error(
      "This Agent run has no exact model metadata. Run the work again before minting.",
    );
  }
  if (evidence.metadataSource !== "reported") {
    throw new Error(
      "This Agent run did not report exact model metadata. Run the work again before minting.",
    );
  }
  assertThoughtV2Context(modelLabel, "model");
  if (!evidence.runId || !evidence.adapter || !/^[0-9a-f]{64}$/.test(evidence.rawResponseSha256)) {
    throw new Error("THOUGHT V2 Agent transport evidence is incomplete.");
  }
  return {
    kind: "agent-run",
    agent: {
      identifier: evidence.adapter,
      label: selectedAgent,
      source: "producer-selected",
    },
    model: {
      label: modelLabel,
      source: "runtime-reported",
      ...(modelIdentifier ? { identifier: modelIdentifier } : {}),
    },
    run: {
      adapter: evidence.adapter,
      route: "inshell.thought.agent-run",
      reference: evidence.runId,
      resultEnvelope: result,
    },
  };
};

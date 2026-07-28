import { AbiCoder, id, keccak256, toUtf8Bytes } from "ethers";

export const THOUGHT_V2_WORK_PROFILE_ID = "inshell.thought.work.v2.terminal-english-64" as const;
export const THOUGHT_V2_RENDERER_ID =
  "inshell.thought.svg.v2.terminal-chat-path-glyphs" as const;
export const THOUGHT_V2_MAX_LINE_BYTES = 64;
export const THOUGHT_V2_PUNCTUATION = `.,?!:;'"-()/&`;
export const THOUGHT_V2_ALLOWED_CHARACTERS =
  ` ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789${THOUGHT_V2_PUNCTUATION}`;
export const THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN_TEXT =
  "INSHELL_THOUGHT_V2_CONVERSATION_IDENTITY" as const;
export const THOUGHT_V2_WORK_DOMAIN_TEXT = "INSHELL_THOUGHT_V2_WORK" as const;

export const THOUGHT_V2_WORK_PROFILE_ID_HASH = id(THOUGHT_V2_WORK_PROFILE_ID);
export const THOUGHT_V2_RENDERER_ID_HASH = id(THOUGHT_V2_RENDERER_ID);
export const THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN = id(
  THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN_TEXT,
);
export const THOUGHT_V2_WORK_DOMAIN = id(THOUGHT_V2_WORK_DOMAIN_TEXT);

export type ThoughtV2LineKind = "prompt" | "agent";

export type ThoughtV2LineMeasure = {
  byteLength: number;
  errors: string[];
};

export type ThoughtV2WorkHashes = {
  promptLineKeccak256: string;
  agentLineKeccak256: string;
  conversationIdentityHash: string;
  workHash: string;
};

export type ThoughtV2WorkMeasure = ThoughtV2WorkHashes & {
  prompt: ThoughtV2LineMeasure;
  agent: ThoughtV2LineMeasure;
  pairIdentityKey: string;
};

const allowedCharacters = new Set(THOUGHT_V2_ALLOWED_CHARACTERS);
const encoder = new TextEncoder();
const abiCoder = AbiCoder.defaultAbiCoder();

if (THOUGHT_V2_ALLOWED_CHARACTERS.length !== 76 || allowedCharacters.size !== 76) {
  throw new Error("THOUGHT V2 terminal repertoire must contain exactly 76 unique characters");
}

const codepointLabel = (value: string): string => {
  const codepoint = value.codePointAt(0);
  return codepoint === undefined
    ? "unknown"
    : `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
};

export const measureThoughtV2Line = (
  value: string,
  kind: ThoughtV2LineKind,
): ThoughtV2LineMeasure => {
  const byteLength = encoder.encode(value).length;
  const errors: string[] = [];

  if (byteLength === 0) errors.push(`${kind} line is empty`);
  if (byteLength > THOUGHT_V2_MAX_LINE_BYTES) {
    errors.push(`${kind} line is ${byteLength}/${THOUGHT_V2_MAX_LINE_BYTES} bytes`);
  }
  if (value.startsWith(" ") || value.endsWith(" ")) {
    errors.push(`${kind} line has an outer space`);
  }
  if (value.includes("  ")) {
    errors.push(`${kind} line has repeated internal spaces`);
  }

  for (const character of value) {
    if (!allowedCharacters.has(character)) {
      errors.push(`${kind} line contains unsupported ${codepointLabel(character)}`);
    }
  }

  return { byteLength, errors };
};

export const assertThoughtV2Line = (
  value: string,
  kind: ThoughtV2LineKind,
): ThoughtV2LineMeasure => {
  const measurement = measureThoughtV2Line(value, kind);
  if (measurement.errors.length > 0) throw new Error(measurement.errors.join("; "));
  return measurement;
};

export const thoughtV2ConversationIdentityHash = (
  promptLineKeccak256: string,
  agentLineKeccak256: string,
): string => keccak256(abiCoder.encode(
  ["bytes32", "bytes32", "bytes32"],
  [THOUGHT_V2_CONVERSATION_IDENTITY_DOMAIN, promptLineKeccak256, agentLineKeccak256],
));

export const thoughtV2WorkHash = (
  promptLineKeccak256: string,
  agentLineKeccak256: string,
): string => keccak256(abiCoder.encode(
  ["bytes32", "bytes32", "bytes32", "bytes32"],
  [THOUGHT_V2_WORK_DOMAIN, THOUGHT_V2_RENDERER_ID_HASH, promptLineKeccak256, agentLineKeccak256],
));

export const deriveThoughtV2WorkHashes = (
  promptLine: string,
  agentLine: string,
): ThoughtV2WorkHashes => {
  assertThoughtV2Line(promptLine, "prompt");
  assertThoughtV2Line(agentLine, "agent");
  const promptLineKeccak256 = keccak256(toUtf8Bytes(promptLine));
  const agentLineKeccak256 = keccak256(toUtf8Bytes(agentLine));
  return {
    promptLineKeccak256,
    agentLineKeccak256,
    conversationIdentityHash: thoughtV2ConversationIdentityHash(
      promptLineKeccak256,
      agentLineKeccak256,
    ),
    workHash: thoughtV2WorkHash(promptLineKeccak256, agentLineKeccak256),
  };
};

export const thoughtV2ConversationIdentityHashForLines = (
  promptLine: string,
  agentLine: string,
): string => deriveThoughtV2WorkHashes(promptLine, agentLine).conversationIdentityHash;

export const assertThoughtV2Work = (
  promptLine: string,
  agentLine: string,
): ThoughtV2WorkMeasure => {
  const prompt = assertThoughtV2Line(promptLine, "prompt");
  const agent = assertThoughtV2Line(agentLine, "agent");
  const hashes = deriveThoughtV2WorkHashes(promptLine, agentLine);
  return {
    prompt,
    agent,
    ...hashes,
    pairIdentityKey: hashes.conversationIdentityHash,
  };
};

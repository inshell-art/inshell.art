import { AbiCoder, getBytes, hexlify, id, keccak256, toUtf8Bytes } from "ethers";

export type ThoughtLineKind = "prompt" | "agent";

export type ThoughtLineMeasure = {
  byteLength: number;
  displayUnits: number;
  errors: string[];
};

export type ThoughtWorkHashes = {
  promptLineKeccak256: string;
  agentLineKeccak256: string;
  agentIdentityHash: string;
  binaryFieldPacked: string;
  binaryFieldKeccak256: string;
  workHash: string;
};

export const THOUGHT_PROTOCOL_ID = "inshell.thought.protocol.v2" as const;
export const THOUGHT_WORK_PROFILE_ID = "inshell.thought.work.v2" as const;
export const THOUGHT_AGENT_RESULT_ID = "inshell.thought.agent-result.v2" as const;
export const THOUGHT_AGENT_DECLARATION_ID = "inshell.thought.agent-declaration.v1" as const;
export const THOUGHT_RENDERER_ID = "inshell.thought.svg.v2.binary-interleave-32" as const;
export const THOUGHT_PROVENANCE_ID = "inshell.thought.provenance.v2" as const;
export const THOUGHT_AGENT_RUN_ID = "inshell.thought.agent-run.v2" as const;

export const AGENT_IDENTITY_DOMAIN_TEXT = "INSHELL_THOUGHT_V2_AGENT_IDENTITY" as const;
export const WORK_DOMAIN_TEXT = "INSHELL_THOUGHT_V2_WORK" as const;
export const AGENT_IDENTITY_DOMAIN = id(AGENT_IDENTITY_DOMAIN_TEXT);
export const WORK_DOMAIN = id(WORK_DOMAIN_TEXT);
export const RENDERER_ID_HASH = id(THOUGHT_RENDERER_ID);

export const MAX_PROMPT_LINE_BYTES = 320;
export const MAX_AGENT_LINE_BYTES = 180;
export const MAX_PROMPT_LINE_DISPLAY_UNITS = 433;
export const MAX_AGENT_LINE_DISPLAY_UNITS = 162;
export const MAX_PROVENANCE_BYTES = 20_000;
export const BINARY_FIELD_BITS = 1024;
export const BINARY_FIELD_BYTES = 128;

const encoder = new TextEncoder();
const abiCoder = AbiCoder.defaultAbiCoder();

const isRejectedSpace = (codepoint: number): boolean =>
  codepoint === 0x00a0 ||
  codepoint === 0x1680 ||
  codepoint === 0x180e ||
  (codepoint >= 0x2000 && codepoint <= 0x200a) ||
  codepoint === 0x2028 ||
  codepoint === 0x2029 ||
  codepoint === 0x202f ||
  codepoint === 0x205f ||
  codepoint === 0x3000;

const isInvisibleControl = (codepoint: number): boolean =>
  (codepoint >= 0x200b && codepoint <= 0x200f) ||
  (codepoint >= 0x202a && codepoint <= 0x202e) ||
  (codepoint >= 0x2060 && codepoint <= 0x206f) ||
  codepoint === 0xfeff;

const displayUnitsOf = (codepoint: number): number => {
  if (codepoint >= 0x21 && codepoint <= 0x7e) return 6;
  if (
    (codepoint >= 0x1100 && codepoint <= 0x11ff) ||
    (codepoint >= 0x2e80 && codepoint <= 0xa4cf) ||
    (codepoint >= 0xac00 && codepoint <= 0xd7af) ||
    (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
    (codepoint >= 0xfe10 && codepoint <= 0xfe6f) ||
    (codepoint >= 0xff00 && codepoint <= 0xffef) ||
    (codepoint >= 0x20000 && codepoint <= 0x3fffd)
  ) {
    return 10;
  }
  return 8;
};

export const measureThoughtLine = (value: string, kind: ThoughtLineKind): ThoughtLineMeasure => {
  const errors: string[] = [];
  const byteLength = encoder.encode(value).length;
  const maxBytes = kind === "prompt" ? MAX_PROMPT_LINE_BYTES : MAX_AGENT_LINE_BYTES;
  const maxUnits = kind === "prompt" ? MAX_PROMPT_LINE_DISPLAY_UNITS : MAX_AGENT_LINE_DISPLAY_UNITS;

  if (byteLength === 0) errors.push(`${kind} line is empty`);
  if (byteLength > maxBytes) errors.push(`${kind} line is ${byteLength}/${maxBytes} bytes`);

  let displayUnits = 0;
  let utf16Index = 0;
  let previousWasSpace = false;
  for (const char of value) {
    const codepoint = char.codePointAt(0);
    if (codepoint === undefined) continue;

    if (codepoint >= 0xd800 && codepoint <= 0xdfff) {
      errors.push(`${kind} line contains an invalid surrogate`);
      utf16Index += char.length;
      continue;
    }

    if (codepoint === 0x20) {
      if (utf16Index === 0 || utf16Index + char.length === value.length || previousWasSpace) {
        errors.push(`${kind} line has invalid spacing`);
      }
      previousWasSpace = true;
      displayUnits += 4;
      utf16Index += char.length;
      continue;
    }

    previousWasSpace = false;
    if (codepoint <= 0x1f || codepoint === 0x7f || (codepoint >= 0x80 && codepoint <= 0x9f)) {
      errors.push(`${kind} line contains a control character U+${codepoint.toString(16).toUpperCase()}`);
    }
    if (isRejectedSpace(codepoint) || isInvisibleControl(codepoint)) {
      errors.push(`${kind} line contains disallowed character U+${codepoint.toString(16).toUpperCase()}`);
    }
    displayUnits += displayUnitsOf(codepoint);
    utf16Index += char.length;
  }

  if (displayUnits > maxUnits) errors.push(`${kind} line is ${displayUnits}/${maxUnits} display units`);
  return { byteLength, displayUnits, errors };
};

export const assertThoughtLine = (value: string, kind: ThoughtLineKind): ThoughtLineMeasure => {
  const measure = measureThoughtLine(value, kind);
  if (measure.errors.length > 0) throw new Error(measure.errors.join("; "));
  return measure;
};

const bitAt = (bytes: Uint8Array, index: number): number => {
  const byte = bytes[Math.floor(index / 8)];
  if (byte === undefined) throw new Error("binary source is empty");
  return (byte >> (7 - (index % 8))) & 1;
};

export const binarySourceBits = (value: string): string =>
  Array.from(encoder.encode(value), (byte) => byte.toString(2).padStart(8, "0")).join("");

export const fitBinarySource512 = (value: string): string => {
  const bytes = encoder.encode(value);
  if (bytes.length === 0) throw new Error("binary source is empty");
  const length = bytes.length * 8;
  return Array.from({ length: 512 }, (_, index) => String(bitAt(bytes, index % length))).join("");
};

export const binaryFieldBits = (promptLine: string, agentLine: string): string => {
  assertThoughtLine(promptLine, "prompt");
  assertThoughtLine(agentLine, "agent");
  const prompt = fitBinarySource512(promptLine);
  const agent = fitBinarySource512(agentLine);
  let result = "";
  for (let index = 0; index < 512; index += 1) result += `${prompt[index]}${agent[index]}`;
  return result;
};

export const binaryFieldPacked = (promptLine: string, agentLine: string): Uint8Array => {
  const bits = binaryFieldBits(promptLine, agentLine);
  const packed = new Uint8Array(BINARY_FIELD_BYTES);
  for (let index = 0; index < BINARY_FIELD_BITS; index += 1) {
    if (bits[index] === "1") packed[Math.floor(index / 8)]! |= 1 << (7 - (index % 8));
  }
  return packed;
};

export const binaryFieldPackedHex = (promptLine: string, agentLine: string): string =>
  hexlify(binaryFieldPacked(promptLine, agentLine));

export const thoughtWorkHashes = (promptLine: string, agentLine: string): ThoughtWorkHashes => {
  assertThoughtLine(promptLine, "prompt");
  assertThoughtLine(agentLine, "agent");
  const promptLineKeccak256 = keccak256(toUtf8Bytes(promptLine));
  const agentLineKeccak256 = keccak256(toUtf8Bytes(agentLine));
  const agentIdentityHash = keccak256(
    abiCoder.encode(["bytes32", "bytes32"], [AGENT_IDENTITY_DOMAIN, agentLineKeccak256]),
  );
  const binaryFieldPackedValue = binaryFieldPackedHex(promptLine, agentLine);
  const binaryFieldKeccak256 = keccak256(binaryFieldPackedValue);
  const workHash = keccak256(
    abiCoder.encode(
      ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [WORK_DOMAIN, RENDERER_ID_HASH, promptLineKeccak256, agentLineKeccak256, binaryFieldKeccak256],
    ),
  );
  return {
    promptLineKeccak256,
    agentLineKeccak256,
    agentIdentityHash,
    binaryFieldPacked: binaryFieldPackedValue,
    binaryFieldKeccak256,
    workHash,
  };
};

type JsonPrimitive = null | boolean | number | string;
export type CanonicalJson = JsonPrimitive | CanonicalJson[] | { [key: string]: CanonicalJson };

const normalizeCanonicalJson = (value: CanonicalJson): CanonicalJson => {
  if (Array.isArray(value)) return value.map(normalizeCanonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeCanonicalJson(value[key]!)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite JSON number");
  return value;
};

export const canonicalJsonStringify = (value: CanonicalJson): string =>
  JSON.stringify(normalizeCanonicalJson(value));

export const verifyPackedField = (promptLine: string, agentLine: string, packedHex: string): boolean => {
  if (!/^0x[0-9a-f]{256}$/.test(packedHex)) return false;
  return hexlify(getBytes(packedHex)) === binaryFieldPackedHex(promptLine, agentLine);
};

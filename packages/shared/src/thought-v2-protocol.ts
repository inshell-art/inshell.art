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
export const THOUGHT_RENDERER_ID = "inshell.thought.svg.v2.binary-weave-32" as const;
export const THOUGHT_PROVENANCE_ID = "inshell.thought.provenance.v2" as const;
export const THOUGHT_AGENT_RUN_ID = "inshell.thought.agent-run.v2" as const;

export const AGENT_IDENTITY_DOMAIN_TEXT = "INSHELL_THOUGHT_V2_AGENT_IDENTITY" as const;
export const WORK_DOMAIN_TEXT = "INSHELL_THOUGHT_V2_WORK" as const;
export const AGENT_IDENTITY_DOMAIN = id(AGENT_IDENTITY_DOMAIN_TEXT);
export const WORK_DOMAIN = id(WORK_DOMAIN_TEXT);
export const RENDERER_ID_HASH = id(THOUGHT_RENDERER_ID);

export const MAX_PROMPT_LINE_BYTES = 64;
export const MAX_AGENT_LINE_BYTES = 64;
export const MAX_PROVENANCE_BYTES = 20_000;
export const BINARY_FIELD_BITS = 1024;
export const BINARY_FIELD_BYTES = 128;

const encoder = new TextEncoder();
const abiCoder = AbiCoder.defaultAbiCoder();

const isRejectedWhitespace = (codepoint: number): boolean =>
  (codepoint >= 0x0009 && codepoint <= 0x000d) ||
  codepoint === 0x0085 ||
  codepoint === 0x00a0 ||
  codepoint === 0x1680 ||
  (codepoint >= 0x2000 && codepoint <= 0x200a) ||
  codepoint === 0x2028 ||
  codepoint === 0x2029 ||
  codepoint === 0x202f ||
  codepoint === 0x205f ||
  codepoint === 0x3000;

const isDefaultIgnorable = (codepoint: number): boolean =>
  codepoint === 0x00ad ||
  codepoint === 0x034f ||
  codepoint === 0x061c ||
  (codepoint >= 0x115f && codepoint <= 0x1160) ||
  (codepoint >= 0x17b4 && codepoint <= 0x17b5) ||
  (codepoint >= 0x180b && codepoint <= 0x180f) ||
  (codepoint >= 0x200b && codepoint <= 0x200f) ||
  (codepoint >= 0x202a && codepoint <= 0x202e) ||
  (codepoint >= 0x2060 && codepoint <= 0x206f) ||
  codepoint === 0x3164 ||
  (codepoint >= 0xfe00 && codepoint <= 0xfe0f) ||
  codepoint === 0xfeff ||
  codepoint === 0xffa0 ||
  (codepoint >= 0xfff0 && codepoint <= 0xfff8) ||
  (codepoint >= 0x1bca0 && codepoint <= 0x1bca3) ||
  (codepoint >= 0x1d173 && codepoint <= 0x1d17a) ||
  (codepoint >= 0xe0000 && codepoint <= 0xe0fff);

const isNoncharacter = (codepoint: number): boolean =>
  (codepoint >= 0xfdd0 && codepoint <= 0xfdef) ||
  (codepoint & 0xffff) === 0xfffe ||
  (codepoint & 0xffff) === 0xffff;

const isXmlCharacter = (codepoint: number): boolean =>
  codepoint === 0x0009 ||
  codepoint === 0x000a ||
  codepoint === 0x000d ||
  (codepoint >= 0x0020 && codepoint <= 0xd7ff) ||
  (codepoint >= 0xe000 && codepoint <= 0xfffd) ||
  (codepoint >= 0x10000 && codepoint <= 0x10ffff);

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

const decodeUtf8 = (bytes: Uint8Array): { codepoints: number[]; errorOffset?: number } => {
  const codepoints: number[] = [];
  for (let offset = 0; offset < bytes.length;) {
    const first = bytes[offset]!;
    if (first <= 0x7f) {
      codepoints.push(first);
      offset += 1;
      continue;
    }

    let width = 0;
    let codepoint = 0;
    let secondMin = 0x80;
    let secondMax = 0xbf;
    if (first >= 0xc2 && first <= 0xdf) {
      width = 2;
      codepoint = first & 0x1f;
    } else if (first >= 0xe0 && first <= 0xef) {
      width = 3;
      codepoint = first & 0x0f;
      if (first === 0xe0) secondMin = 0xa0;
      if (first === 0xed) secondMax = 0x9f;
    } else if (first >= 0xf0 && first <= 0xf4) {
      width = 4;
      codepoint = first & 0x07;
      if (first === 0xf0) secondMin = 0x90;
      if (first === 0xf4) secondMax = 0x8f;
    } else {
      return { codepoints, errorOffset: offset };
    }

    if (offset + width > bytes.length) return { codepoints, errorOffset: offset };
    const second = bytes[offset + 1]!;
    if (second < secondMin || second > secondMax) return { codepoints, errorOffset: offset };
    codepoint = (codepoint << 6) | (second & 0x3f);
    for (let index = 2; index < width; index += 1) {
      const continuation = bytes[offset + index]!;
      if (continuation < 0x80 || continuation > 0xbf) return { codepoints, errorOffset: offset };
      codepoint = (codepoint << 6) | (continuation & 0x3f);
    }
    codepoints.push(codepoint);
    offset += width;
  }
  return { codepoints };
};

const hasUnpairedSurrogate = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (index + 1 >= value.length) return true;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }
  return false;
};

const strictUtf8Bytes = (value: string): Uint8Array => {
  if (hasUnpairedSurrogate(value)) throw new Error("line contains an invalid surrogate");
  return encoder.encode(value);
};

export const measureThoughtLineBytes = (
  bytes: Uint8Array,
  kind: ThoughtLineKind,
): ThoughtLineMeasure => {
  const errors: string[] = [];
  const byteLength = bytes.length;
  const maxBytes = 64;

  if (byteLength === 0) {
    return { byteLength, displayUnits: 0, errors: [`${kind} line is empty`] };
  }
  if (byteLength > maxBytes) {
    return {
      byteLength,
      displayUnits: 0,
      errors: [`${kind} line is ${byteLength}/${maxBytes} bytes`],
    };
  }

  const decoded = decodeUtf8(bytes);
  if (decoded.errorOffset !== undefined) {
    errors.push(`${kind} line contains malformed UTF-8 at byte ${decoded.errorOffset}`);
    return { byteLength, displayUnits: 0, errors };
  }

  let displayUnits = 0;
  decoded.codepoints.forEach((codepoint, index) => {
    if (codepoint === 0x20) {
      if (index === 0 || index === decoded.codepoints.length - 1) {
        errors.push(`${kind} line has invalid spacing`);
      }
      displayUnits += 4;
      return;
    }

    if (codepoint <= 0x1f || codepoint === 0x7f || (codepoint >= 0x80 && codepoint <= 0x9f)) {
      errors.push(`${kind} line contains a control character U+${codepoint.toString(16).toUpperCase()}`);
    }
    if (
      !isXmlCharacter(codepoint) ||
      isRejectedWhitespace(codepoint) ||
      isDefaultIgnorable(codepoint) ||
      isNoncharacter(codepoint)
    ) {
      errors.push(`${kind} line contains disallowed character U+${codepoint.toString(16).toUpperCase()}`);
    }
    displayUnits += displayUnitsOf(codepoint);
  });

  return { byteLength, displayUnits, errors };
};

export const measureThoughtLine = (value: string, kind: ThoughtLineKind): ThoughtLineMeasure => {
  if (hasUnpairedSurrogate(value)) {
    return {
      byteLength: 0,
      displayUnits: 0,
      errors: [`${kind} line contains an invalid surrogate`],
    };
  }
  return measureThoughtLineBytes(strictUtf8Bytes(value), kind);
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
  Array.from(strictUtf8Bytes(value), (byte) => byte.toString(2).padStart(8, "0")).join("");

export const fitBinarySource64 = (value: string): Uint8Array => {
  const bytes = strictUtf8Bytes(value);
  if (bytes.length === 0) throw new Error("binary source is empty");
  return Uint8Array.from({ length: 64 }, (_, index) => bytes[index % bytes.length]!);
};

export const fitBinarySource512 = (value: string): string => {
  const bytes = fitBinarySource64(value);
  return Array.from({ length: 512 }, (_, index) => String(bitAt(bytes, index))).join("");
};

export const binaryFieldBits = (promptLine: string, agentLine: string): string => {
  assertThoughtLine(promptLine, "prompt");
  assertThoughtLine(agentLine, "agent");
  const prompt = fitBinarySource512(promptLine);
  const agent = fitBinarySource512(agentLine);
  let result = "";
  for (let row = 0; row < 32; row += 1) {
    for (let column = 0; column < 32; column += 1) {
      if ((row + column) % 2 === 0) {
        result += prompt[row * 16 + Math.floor(column / 2)];
      } else {
        result += agent[column * 16 + Math.floor(row / 2)];
      }
    }
  }
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

import { id } from "ethers";

export const THOUGHT_V2_CONTEXT_PROFILE_ID =
  "inshell.thought.context.v2.visible-utf8-64" as const;
export const THOUGHT_V2_CONTEXT_PROFILE_ID_HASH = id(THOUGHT_V2_CONTEXT_PROFILE_ID);
export const THOUGHT_V2_MAX_CONTEXT_BYTES = 64;

export type ThoughtV2ContextKind = "declaredAgent" | "declaredModel";

export type ThoughtV2ContextMeasure = {
  byteLength: number;
  errors: string[];
};

const encoder = new TextEncoder();

const codepointLabel = (codepoint: number): string =>
  `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;

const isXmlCharacter = (codepoint: number): boolean =>
  (codepoint >= 0x20 && codepoint <= 0xd7ff) ||
  (codepoint >= 0xe000 && codepoint <= 0xfffd) ||
  (codepoint >= 0x10000 && codepoint <= 0x10ffff);

const isRejectedWhitespace = (codepoint: number): boolean =>
  codepoint === 0x85 ||
  codepoint === 0xa0 ||
  codepoint === 0x1680 ||
  (codepoint >= 0x2000 && codepoint <= 0x200a) ||
  codepoint === 0x2028 ||
  codepoint === 0x2029 ||
  codepoint === 0x202f ||
  codepoint === 0x205f ||
  codepoint === 0x3000;

const isDefaultIgnorable = (codepoint: number): boolean =>
  codepoint === 0xad ||
  codepoint === 0x34f ||
  codepoint === 0x61c ||
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

const isNoncharacter = (codepoint: number): boolean => {
  const low = codepoint & 0xffff;
  return (codepoint >= 0xfdd0 && codepoint <= 0xfdef) || low === 0xfffe || low === 0xffff;
};

export const measureThoughtV2Context = (
  value: string,
  kind: ThoughtV2ContextKind,
): ThoughtV2ContextMeasure => {
  const byteLength = encoder.encode(value).length;
  const errors: string[] = [];

  if (value.length === 0) errors.push(`${kind} is empty`);
  if (byteLength > THOUGHT_V2_MAX_CONTEXT_BYTES) {
    errors.push(`${kind} is ${byteLength}/${THOUGHT_V2_MAX_CONTEXT_BYTES} bytes`);
  }
  if (value.startsWith(" ") || value.endsWith(" ")) {
    errors.push(`${kind} has an outer space`);
  }

  for (const character of value) {
    const codepoint = character.codePointAt(0)!;
    if (
      !isXmlCharacter(codepoint) ||
      (codepoint >= 0x7f && codepoint <= 0x9f) ||
      isRejectedWhitespace(codepoint) ||
      isDefaultIgnorable(codepoint) ||
      isNoncharacter(codepoint)
    ) {
      errors.push(`${kind} contains unsupported ${codepointLabel(codepoint)}`);
    }
  }

  return { byteLength, errors };
};

export const assertThoughtV2Context = (
  value: string,
  kind: ThoughtV2ContextKind,
): ThoughtV2ContextMeasure => {
  const measurement = measureThoughtV2Context(value, kind);
  if (measurement.errors.length > 0) throw new Error(measurement.errors.join("; "));
  return measurement;
};

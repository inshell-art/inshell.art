import type { ThoughtV2LineKind } from "./thought-v2-renderer";

type ThoughtTextMeasure = {
  byteLength: number;
  errors: string[];
};

export type ThoughtTextPolicyLine = ThoughtV2LineKind | "agent output";

export type ThoughtTextPolicyIssue = {
  title: string;
  detail: string;
  nextStep?: string;
};

const THOUGHT_TEXT_REPERTOIRE =
  `[space] A-Z a-z 0-9 . , ? ! : ; ' " - ( ) / &`;

const codePointPosition = (value: string, target: number) => {
  const index = Array.from(value).findIndex(
    (character) => character.codePointAt(0) === target,
  );
  return index < 0 ? undefined : index + 1;
};

const invalidSurrogatePosition = (value: string) => {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return index + 1;
      index += 1;
      continue;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return index + 1;
  }
  return undefined;
};

const isAgentOutput = (line: ThoughtTextPolicyLine) => line === "agent output";
const displayLine = (line: ThoughtTextPolicyLine) => isAgentOutput(line) ? "Agent output" : line;
const sentenceLine = (line: ThoughtTextPolicyLine) =>
  line === "prompt" ? "The prompt" : "The Agent output";

const editNextStep = (line: ThoughtTextPolicyLine, promptStep: string) =>
  isAgentOutput(line)
    ? "reset and run the Agent again; output is never auto-corrected"
    : promptStep;

const repeatedSpacePosition = (value: string) => {
  const match = / {2,}/.exec(value);
  return match?.index === undefined ? undefined : match.index + 2;
};

const describedCodePoint = (codePoint: number) => {
  if (codePoint === 0x0009) return "tab";
  if (codePoint === 0x000a) return "line feed";
  if (codePoint === 0x000d) return "carriage return";
  if (codePoint === 0x00a0) return "no-break space";
  if (codePoint === 0x200b) return "zero-width space";
  if (codePoint === 0xfeff) return "zero-width no-break space";
  return "character";
};

const isWhitespaceCodePoint = (codePoint: number) =>
  (codePoint >= 0x0009 && codePoint <= 0x000d) ||
  codePoint === 0x0085 ||
  codePoint === 0x00a0 ||
  codePoint === 0x1680 ||
  (codePoint >= 0x2000 && codePoint <= 0x200a) ||
  codePoint === 0x2028 ||
  codePoint === 0x2029 ||
  codePoint === 0x202f ||
  codePoint === 0x205f ||
  codePoint === 0x3000;

const isInvisibleCodePoint = (codePoint: number) =>
  codePoint === 0x00ad ||
  codePoint === 0x034f ||
  codePoint === 0x061c ||
  (codePoint >= 0x115f && codePoint <= 0x1160) ||
  (codePoint >= 0x17b4 && codePoint <= 0x17b5) ||
  (codePoint >= 0x180b && codePoint <= 0x180f) ||
  (codePoint >= 0x200b && codePoint <= 0x200f) ||
  (codePoint >= 0x202a && codePoint <= 0x202e) ||
  (codePoint >= 0x2060 && codePoint <= 0x206f) ||
  codePoint === 0x3164 ||
  (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
  codePoint === 0xfeff ||
  codePoint === 0xffa0 ||
  (codePoint >= 0xfff0 && codePoint <= 0xfff8) ||
  (codePoint >= 0x1bca0 && codePoint <= 0x1bca3) ||
  (codePoint >= 0x1d173 && codePoint <= 0x1d17a) ||
  (codePoint >= 0xe0000 && codePoint <= 0xe0fff);

const visibleCodePoint = (codePoint: number) => {
  const character = String.fromCodePoint(codePoint);
  return /[\p{C}\p{Z}]/u.test(character)
    ? null
    : JSON.stringify(character);
};

const issueForCodePoint = (
  value: string,
  line: ThoughtTextPolicyLine,
  error: string,
): ThoughtTextPolicyIssue | null => {
  const match = error.match(/U\+([0-9A-F]+)/i);
  if (!match) return null;
  const codePoint = Number.parseInt(match[1]!, 16);
  const position = codePointPosition(value, codePoint);
  const location = position ? ` at character ${position}` : "";
  const described = describedCodePoint(codePoint);
  const subject = sentenceLine(line);

  if (codePoint === 0x0009) {
    return {
      title: "tab not allowed",
      detail: `${subject} contains a tab${location}.`,
      nextStep: editNextStep(line, `replace the tab${location} with one regular space`),
    };
  }
  if (
    codePoint === 0x000a ||
    codePoint === 0x000d ||
    codePoint === 0x2028 ||
    codePoint === 0x2029
  ) {
    return {
      title: "line break not allowed",
      detail: `${subject} contains a line break${location}.`,
      nextStep: editNextStep(line, `delete the line break${location}`),
    };
  }
  if (isWhitespaceCodePoint(codePoint)) {
    return {
      title: "unsupported space",
      detail: `${subject} contains ${described === "character" ? "an unsupported space" : `a ${described}`}${location}.`,
      nextStep: editNextStep(
        line,
        `replace the unsupported space${location} with one regular space or delete it`,
      ),
    };
  }
  if (isInvisibleCodePoint(codePoint)) {
    return {
      title: "invisible character",
      detail: `${subject} contains an invisible character${location}.`,
      nextStep: editNextStep(line, `delete the invisible character${location}`),
    };
  }
  if (/control character/i.test(error)) {
    return {
      title: "control character",
      detail: `${subject} contains a control character${location}.`,
      nextStep: editNextStep(line, `delete the control character${location}`),
    };
  }
  const character = visibleCodePoint(codePoint);
  if (character) {
    const detail =
      `The ${character}${location} isn't supported in THOUGHT text`;
    if (!isAgentOutput(line)) {
      return {
        title: `${character} can't be used`,
        detail: `${detail}.\nAllowed: ${THOUGHT_TEXT_REPERTOIRE}`,
      };
    }
    return {
      title: `${character} can't be used`,
      detail,
      nextStep: editNextStep(line, ""),
    };
  }
  return {
    title: "unsupported character",
    detail: `${subject} contains an unsupported character${location}.`,
    nextStep: editNextStep(line, `delete or replace the character${location}`),
  };
};

export const describeThoughtTextPolicyIssue = ({
  value,
  line,
  measure,
  maxBytes,
}: {
  value: string;
  line: ThoughtTextPolicyLine;
  measure: ThoughtTextMeasure;
  maxBytes: number;
}): ThoughtTextPolicyIssue | null => {
  if (measure.errors.length === 0) return null;
  const label = displayLine(line);

  if (measure.byteLength > maxBytes) {
    const percentage = Math.round((measure.byteLength / maxBytes) * 100);
    return {
      title: "text too long",
      detail: `${label}: ${percentage}% used · ${measure.byteLength} / ${maxBytes} UTF-8 bytes`,
      nextStep: editNextStep(line, `reduce ${line} to ${maxBytes} UTF-8 bytes or less`),
    };
  }

  if (measure.errors.some((error) => /line is empty/.test(error))) {
    return {
      title: line === "prompt" ? "prompt empty" : "Agent output empty",
      detail: `${sentenceLine(line)} is empty.`,
      nextStep: editNextStep(line, `enter a ${line}`),
    };
  }

  const startsWithSpace = value.startsWith(" ");
  const endsWithSpace = value.endsWith(" ");
  if (startsWithSpace || endsWithSpace) {
    const title = startsWithSpace && endsWithSpace
      ? "outer spaces"
      : startsWithSpace
        ? "leading space"
        : "trailing space";
    const detail = startsWithSpace && endsWithSpace
      ? `${sentenceLine(line)} starts and ends with a space.`
      : startsWithSpace
        ? `${sentenceLine(line)} starts with a space.`
        : `${sentenceLine(line)} ends with a space.`;
    const promptStep = startsWithSpace && endsWithSpace
      ? "delete the outer spaces"
      : startsWithSpace
        ? "delete the first space"
        : "delete the final space";
    return {
      title,
      detail,
      nextStep: editNextStep(line, promptStep),
    };
  }

  if (measure.errors.some((error) => /repeated internal spaces/i.test(error))) {
    const position = repeatedSpacePosition(value);
    const location = position ? ` at character ${position}` : "";
    return {
      title: "extra spaces",
      detail: `${sentenceLine(line)} has more than one space together${location}.`,
      nextStep: editNextStep(line, `delete the extra space${location}`),
    };
  }

  if (measure.errors.some((error) => /invalid surrogate/.test(error))) {
    const position = invalidSurrogatePosition(value);
    const location = position ? ` at character ${position}` : "";
    return {
      title: "broken character",
      detail: `${sentenceLine(line)} contains a broken character${location}.`,
      nextStep: editNextStep(line, `delete or replace the broken character${location}`),
    };
  }

  for (const error of measure.errors) {
    const issue = issueForCodePoint(value, line, error);
    if (issue) return issue;
  }

  return {
    title: line === "prompt" ? "prompt not accepted" : "Agent output not accepted",
    detail: `${sentenceLine(line)} does not match THOUGHT text rules.`,
    nextStep: editNextStep(line, `check the ${line} for extra spaces or unsupported characters`),
  };
};

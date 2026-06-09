import {
  createSurfaceShell,
  parseInput,
  type SurfaceParseResult,
  type SurfaceShell,
} from "surface-shell/packages/surface-shell-core/src/index.ts";

import { getThoughtShellCompletions } from "./thoughtCompletions";
import { thoughtCommandTree } from "./thoughtCommandTree";
import { redactThoughtShellInput, shouldRecordThoughtShellInput, THOUGHT_SHELL_REDACTION_RULES } from "./thoughtRedaction";
import { surfaceReturnToCliLines, thoughtMyBrainWaitingLines, thoughtUnknownCommandLines } from "./thoughtShellReturns";
import { defaultThoughtShellState, type ThoughtShellState } from "./thoughtShellState";

export type ThoughtShellParsedCommand = {
  raw: string;
  trimmed: string;
  isBlank: boolean;
  kind: SurfaceParseResult["kind"];
  commandText: string;
  commandPath: string[];
  canonicalPath: string[];
  legacyHead: string;
  rest: string;
  args: string[];
};

export type ThoughtSurfaceShellAdapter = {
  parse(input: string): SurfaceParseResult;
  resolve(input: string): ThoughtShellParsedCommand;
  getBranchHelpLines(input: string): Promise<string[]>;
  getCompletions(input: string): string[];
  isAllowedWhileMyBrainWaiting(parsed: ThoughtShellParsedCommand): boolean;
  redactForEcho(input: string): string;
  shouldRecord(input: string): boolean;
};

const createCoreShell = (getState: () => ThoughtShellState): SurfaceShell<ThoughtShellState> =>
  createSurfaceShell<ThoughtShellState>({
    shellId: "thought-cli",
    displayName: "THOUGHT CLI",
    mode: "command-first",
    commandPrefix: null,
    getPrompt: ({ state }) => (state.myBrainWaiting ? "my-brain>" : "thought>"),
    caseInsensitiveCommands: true,
    argumentMode: "raw-remainder",
    historyLimit: 80,
    transcriptLimit: 80,
    inFlightBehavior: "ignore",
    root: thoughtCommandTree,
    redactionRules: THOUGHT_SHELL_REDACTION_RULES,
    getState,
  });

const normalizeLegacyHead = (head: string) => {
  const lowerHead = head.toLowerCase();
  if (lowerHead === "?" || lowerHead === "--help") {
    return "help";
  }
  if (lowerHead === "mybrain") {
    return "my-brain";
  }
  if (lowerHead === "font") {
    return "color-font";
  }
  if (lowerHead === "output") {
    return "work";
  }
  return lowerHead;
};

const splitLegacyInput = (trimmed: string) => {
  const match = trimmed.match(/^(\S+)(?:\s+([\s\S]*))?$/);
  const rawHead = match?.[1] ?? "";
  const rest = match?.[2]?.trim() ?? "";
  return {
    legacyHead: normalizeLegacyHead(rawHead),
    rest,
    args: rest ? rest.split(/\s+/) : [],
  };
};

export const parseThoughtShellInput = (input: string): ThoughtShellParsedCommand => {
  const parsed = parseInput(input, {
    mode: "command-first",
    commandPrefix: null,
    root: thoughtCommandTree,
    caseInsensitiveCommands: true,
  });
  const trimmed = input.trim();
  const legacy = splitLegacyInput(trimmed);
  const commandPath = parsed.kind === "command" || parsed.kind === "unknown" ? parsed.commandPath : [];

  return {
    raw: input,
    trimmed,
    isBlank: parsed.kind === "blank",
    kind: parsed.kind,
    commandText: parsed.kind === "command" || parsed.kind === "unknown" ? parsed.commandText : "",
    commandPath,
    canonicalPath: commandPath,
    legacyHead: legacy.legacyHead,
    rest: legacy.rest,
    args: legacy.args,
  };
};

export const createThoughtSurfaceShellAdapter = (
  getState: () => ThoughtShellState = defaultThoughtShellState,
): ThoughtSurfaceShellAdapter => {
  const coreShell = createCoreShell(getState);

  return {
    parse(input) {
      return coreShell.parse(input);
    },
    resolve(input) {
      return parseThoughtShellInput(input);
    },
    async getBranchHelpLines(input) {
      return surfaceReturnToCliLines(await coreShell.dispatch(input));
    },
    getCompletions(input) {
      return getThoughtShellCompletions(input).map((completion) => completion.value);
    },
    isAllowedWhileMyBrainWaiting(parsed) {
      if (!getState().myBrainWaiting) {
        return true;
      }
      return parsed.legacyHead === "return" || parsed.legacyHead === "cancel";
    },
    redactForEcho(input) {
      return redactThoughtShellInput(input);
    },
    shouldRecord(input) {
      return shouldRecordThoughtShellInput(input);
    },
  };
};

export { redactThoughtShellInput, shouldRecordThoughtShellInput, thoughtMyBrainWaitingLines, thoughtUnknownCommandLines };

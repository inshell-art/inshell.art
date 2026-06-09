import {
  applyRedaction,
  type SurfaceRedactionRule,
} from "surface-shell/packages/surface-shell-core/src/index.ts";

const SECRET_MASK = "********";

type SecretCommandRule = {
  id: string;
  prefix: string[];
};

const SECRET_COMMAND_RULES: SecretCommandRule[] = [
  { id: "key", prefix: ["key"] },
  { id: "config-key", prefix: ["config", "key"] },
  { id: "config-direct-key", prefix: ["config", "direct", "key"] },
];

export const THOUGHT_SHELL_REDACTION_RULES: SurfaceRedactionRule[] = SECRET_COMMAND_RULES.map((rule) => ({
  id: rule.id,
  description: "Mask THOUGHT CLI API key commands before echo/history/transcript storage.",
  pattern: new RegExp(`^(${rule.prefix.join("\\s+")})\\s+(.+)$`, "i"),
  replacement: `$1 ${SECRET_MASK}`,
  suppressHistory: true,
  suppressTranscript: true,
  phases: ["echo", "history", "transcript", "event"],
}));

const normalizeSecretRest = (rest: string) => rest.trim().toLowerCase();

const isAllowedSecretRest = (rest: string) => {
  const normalized = normalizeSecretRest(rest);
  return normalized === "" || normalized === "clear" || normalized === "help";
};

const matchSecretCommand = (input: string) => {
  const trimmed = input.trim();
  const tokens = trimmed.split(/\s+/);

  for (const rule of SECRET_COMMAND_RULES) {
    const prefixMatches = rule.prefix.every((segment, index) => tokens[index]?.toLowerCase() === segment);
    if (!prefixMatches) {
      continue;
    }

    const restTokens = tokens.slice(rule.prefix.length);
    if (restTokens.length === 0) {
      return null;
    }

    const prefix = tokens.slice(0, rule.prefix.length).join(" ");
    const rest = restTokens.join(" ");
    return {
      prefix,
      rest,
    };
  }

  return null;
};

export const redactThoughtShellInput = (input: string) => {
  const secret = matchSecretCommand(input);
  if (!secret || isAllowedSecretRest(secret.rest)) {
    return applyRedaction(input, THOUGHT_SHELL_REDACTION_RULES, "echo").text;
  }

  return `${secret.prefix} ${SECRET_MASK}`;
};

export const shouldRecordThoughtShellInput = (input: string) => {
  const secret = matchSecretCommand(input);
  return !secret || isAllowedSecretRest(secret.rest);
};

import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  THOUGHT_CODEX_HANDOFF_CASES,
  observeThoughtCodexRealCanary,
  prepareThoughtCodexRealCanary,
  runThoughtCodexDeterministicLab,
  thoughtCodexCanonicalCandidate,
  type ThoughtCodexLabCaseId,
} from "./lib/thought-handoff-lab";
import { buildThoughtV2LocalAgentTaskBinding } from
  "../apps/thought/src/thought-v2-local-agent";
import { THOUGHT_V2_LOCAL_RELEASE } from
  "../apps/thought/src/thought-v2-local-release";

type ParsedArguments = {
  command: string;
  values: Map<string, string[]>;
  flags: Set<string>;
};

const parseArguments = (values: string[]): ParsedArguments => {
  const args = [...values];
  const command = args[0] === "--help"
    ? (args.shift(), "help")
    : args[0]?.startsWith("-")
    ? "deterministic"
    : (args.shift() ?? "deterministic");
  const parsed: ParsedArguments = {
    command,
    values: new Map(),
    flags: new Set(),
  };
  while (args.length > 0) {
    const name = args.shift() ?? "";
    if (!name.startsWith("--")) {
      throw new Error(`Unexpected argument: ${name}`);
    }
    if (args[0] && !args[0].startsWith("--")) {
      const value = args.shift() ?? "";
      parsed.values.set(name, [...(parsed.values.get(name) ?? []), value]);
    } else {
      parsed.flags.add(name);
    }
  }
  return parsed;
};

const firstValue = (
  parsed: ParsedArguments,
  name: string,
  fallback?: string,
) => parsed.values.get(name)?.at(-1) ?? fallback;

const requireValue = (parsed: ParsedArguments, name: string) => {
  const value = firstValue(parsed, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const gitText = (args: string[]) => execFileSync("git", args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
}).trim();

const outputJson = (value: unknown) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const parseCaseIds = (parsed: ParsedArguments) => {
  const requested = (parsed.values.get("--case") ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (requested.length === 0) return undefined;
  const valid = new Set(THOUGHT_CODEX_HANDOFF_CASES.map((entry) => entry.id));
  for (const value of requested) {
    if (!valid.has(value as ThoughtCodexLabCaseId)) {
      throw new Error(`Unknown Codex handoff case: ${value}`);
    }
  }
  return requested as ThoughtCodexLabCaseId[];
};

const runDeterministic = async (parsed: ParsedArguments) => {
  const generatorPath = fileURLToPath(new URL(
    "../packages/thought-agent-protocol/src/codex-client.ts",
    import.meta.url,
  ));
  const result = await runThoughtCodexDeterministicLab({
    outputDir: firstValue(parsed, "--out", "tmp/thought-handoff-lab") ??
      "tmp/thought-handoff-lab",
    caseIds: parseCaseIds(parsed),
    sourceCommit: gitText(["rev-parse", "HEAD"]),
    sourceDirty: gitText(["status", "--porcelain"]).length > 0,
    generatorPath,
  });
  outputJson({
    mode: result.report.mode,
    batchId: result.report.batchId,
    passed: result.report.matrix.passed,
    failed: result.report.matrix.failed,
    reportDirectory: result.outputDir,
  });
  if (result.report.matrix.failed > 0) process.exitCode = 1;
};

const runRealPrepare = async (parsed: ParsedArguments) => {
  const origin = firstValue(
    parsed,
    "--origin",
    process.env.THOUGHT_LIVE_ORIGIN ?? "http://127.0.0.1:5177",
  ) ?? "http://127.0.0.1:5177";
  const binding = buildThoughtV2LocalAgentTaskBinding();
  const result = await prepareThoughtCodexRealCanary({
    origin,
    outputDir: firstValue(parsed, "--out", "tmp/thought-handoff-lab/real") ??
      "tmp/thought-handoff-lab/real",
    promptLine: firstValue(
      parsed,
      "--prompt",
      "Can a verified path remain simple?",
    ) ?? "Can a verified path remain simple?",
    specId: THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId,
    release: binding.release,
    resultContract: binding.resultContract,
  });
  if (parsed.flags.has("--open")) {
    const child = spawn("open", [result.codexUrl], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }
  outputJson({
    mode: "real-canary",
    runId: result.session.runId,
    taskSha256: result.session.taskSha256,
    taskByteLength: result.session.taskByteLength,
    openedInCodex: parsed.flags.has("--open"),
    sessionPath: result.sessionPath,
    sealedTaskPath: result.session.taskPath,
    codexUrlPath: result.session.codexUrlPath,
    creatorActionRequired: "Click Submit once in the prefilled Codex task.",
    next: `pnpm handoff:lab:codex real-observe --session ${JSON.stringify(result.sessionPath)}`,
  });
};

const runRealObserve = async (parsed: ParsedArguments) => {
  const timeoutText = firstValue(parsed, "--timeout-ms", "600000") ?? "600000";
  const timeoutMs = Number.parseInt(timeoutText, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new Error("--timeout-ms must be a non-negative integer.");
  }
  const result = await observeThoughtCodexRealCanary({
    sessionPath: requireValue(parsed, "--session"),
    timeoutMs,
    creatorActions: firstValue(
      parsed,
      "--control-actions",
      firstValue(parsed, "--creator-actions", "none"),
    ),
  });
  outputJson({ ...result.report, reportPath: result.reportPath });
  if (!result.report.terminal || result.report.state !== "returned") {
    process.exitCode = 1;
  }
};

const showList = () => outputJson({
  agent: "Codex",
  candidateTaskSha256: `sha256:${createHash("sha256")
    .update(thoughtCodexCanonicalCandidate())
    .digest("hex")}`,
  cases: THOUGHT_CODEX_HANDOFF_CASES.map((entry) => ({
    id: entry.id,
    title: entry.title,
    fault: entry.fault,
    expectedOutcome: entry.expectedOutcome,
  })),
});

const showHelp = () => {
  process.stdout.write(`Codex-only THOUGHT handoff lab\n\n` +
    `  pnpm handoff:lab:codex deterministic [--case ID[,ID]] [--out DIR]\n` +
    `  pnpm handoff:lab:codex list\n` +
    `  pnpm handoff:lab:codex real-prepare [--origin URL] [--prompt LINE] [--out DIR] [--open]\n` +
    `  pnpm handoff:lab:codex real-observe --session FILE [--timeout-ms N] [--control-actions TEXT]\n`);
};

const main = async () => {
  const parsed = parseArguments(process.argv.slice(2));
  if (parsed.command === "deterministic") return runDeterministic(parsed);
  if (parsed.command === "list") return showList();
  if (parsed.command === "real-prepare") return runRealPrepare(parsed);
  if (parsed.command === "real-observe") return runRealObserve(parsed);
  if (parsed.command === "help") return showHelp();
  throw new Error(`Unknown Codex handoff lab command: ${parsed.command}`);
};

await main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

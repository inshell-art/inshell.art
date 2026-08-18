import { writeFile } from "node:fs/promises";

import {
  collectThoughtAgentCanaryMatrix,
  formatThoughtAgentCanaryMatrixSummary,
} from "./lib/thought-agent-canary-matrix";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const reportsRoot = argument("--reports");
const expectedCommitSha = argument("--commit")?.toLowerCase();
const runnerInput = argument("--runners");
const outputPath = argument("--output");
const summaryPath = argument("--summary");
if (!reportsRoot || !expectedCommitSha || !runnerInput || !outputPath || !summaryPath) {
  throw new Error(
    "Usage: --reports <dir> --commit <sha> --runners <id,id> --output <json> --summary <md>",
  );
}

const matrix = await collectThoughtAgentCanaryMatrix({
  reportsRoot,
  expectedCommitSha,
  expectedRunnerIds: runnerInput.split(",").map((value) => value.trim()).filter(Boolean),
});
await writeFile(outputPath, `${JSON.stringify(matrix, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
await writeFile(summaryPath, formatThoughtAgentCanaryMatrixSummary(matrix), {
  encoding: "utf8",
  mode: 0o600,
});

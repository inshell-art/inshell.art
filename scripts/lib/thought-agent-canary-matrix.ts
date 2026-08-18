import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  parseThoughtAgentCompatibilityReport,
  type ThoughtAgentCompatibilityReport,
} from "./thought-agent-compatibility-report";

export const THOUGHT_AGENT_CANARY_MATRIX_VERSION =
  "inshell.thought.agent-canary-matrix.v1" as const;

export type ThoughtAgentCanaryMatrix = {
  schema: typeof THOUGHT_AGENT_CANARY_MATRIX_VERSION;
  generatedAt: string;
  candidateCommitSha: string;
  protocolVersion: string;
  status: "passed";
  cells: ThoughtAgentCompatibilityReport[];
};

const collectJsonPaths = async (root: string): Promise<string[]> => {
  const paths: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) paths.push(...await collectJsonPaths(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) paths.push(path);
  }
  return paths;
};

export async function collectThoughtAgentCanaryMatrix({
  reportsRoot,
  expectedCommitSha,
  expectedRunnerIds,
  now = Date.now(),
  maxAgeMs = 2 * 60 * 60 * 1000,
}: {
  reportsRoot: string;
  expectedCommitSha: string;
  expectedRunnerIds: string[];
  now?: number;
  maxAgeMs?: number;
}): Promise<ThoughtAgentCanaryMatrix> {
  if (!/^[a-f0-9]{40}$/.test(expectedCommitSha)) {
    throw new Error("Expected candidate commit SHA is invalid.");
  }
  const expectedCells = new Set(
    expectedRunnerIds.flatMap((runnerId) => [
      `${runnerId}:codex`,
      `${runnerId}:claude`,
    ]),
  );
  const reports = await Promise.all((await collectJsonPaths(reportsRoot)).map(
    async (path) => parseThoughtAgentCompatibilityReport(
      JSON.parse(await readFile(path, "utf8")),
    ),
  ));
  if (reports.length !== expectedCells.size) {
    throw new Error(
      `Expected ${expectedCells.size} compatibility reports, received ${reports.length}.`,
    );
  }

  const actualCells = new Set<string>();
  for (const report of reports) {
    const cell = `${report.host.runnerId}:${report.agent.adapter}`;
    if (!expectedCells.has(cell)) throw new Error(`Unexpected canary cell ${cell}.`);
    if (actualCells.has(cell)) throw new Error(`Duplicate canary cell ${cell}.`);
    actualCells.add(cell);
    if (
      report.target.environment !== "preview" ||
      report.target.commitSha !== expectedCommitSha
    ) {
      throw new Error(`Canary cell ${cell} targeted the wrong candidate.`);
    }
    if (
      report.result.status !== "passed" ||
      report.result.stage !== "complete" ||
      report.result.runState !== "returned" ||
      !report.result.receiptSha256
    ) {
      throw new Error(`Canary cell ${cell} did not complete successfully.`);
    }
    const recordedAt = Date.parse(report.recordedAt);
    if (
      !Number.isFinite(recordedAt) ||
      recordedAt > now + 5 * 60 * 1000 ||
      now - recordedAt > maxAgeMs
    ) {
      throw new Error(`Canary cell ${cell} is outside the freshness window.`);
    }
  }
  for (const cell of expectedCells) {
    if (!actualCells.has(cell)) throw new Error(`Missing canary cell ${cell}.`);
  }
  const protocolVersions = new Set(reports.map(
    (report) => report.target.protocolVersion,
  ));
  if (protocolVersions.size !== 1) {
    throw new Error("Canary cells reported different protocol versions.");
  }

  return {
    schema: THOUGHT_AGENT_CANARY_MATRIX_VERSION,
    generatedAt: new Date(now).toISOString(),
    candidateCommitSha: expectedCommitSha,
    protocolVersion: reports[0].target.protocolVersion,
    status: "passed",
    cells: reports.sort((left, right) =>
      `${left.host.runnerId}:${left.agent.adapter}`.localeCompare(
        `${right.host.runnerId}:${right.agent.adapter}`,
      )),
  };
}

export function formatThoughtAgentCanaryMatrixSummary(
  matrix: ThoughtAgentCanaryMatrix,
) {
  const lines = [
    "# THOUGHT Agent compatibility matrix",
    "",
    `Candidate: \`${matrix.candidateCommitSha}\``,
    `Protocol: \`${matrix.protocolVersion}\``,
    `Status: **${matrix.status}**`,
    "",
    "| Runner | Agent | Version | Model | Result | Receipt |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const report of matrix.cells) {
    lines.push(
      `| ${report.host.runnerId} | ${report.agent.adapter} | ${report.agent.toolVersion} | ${report.agent.model ?? "not reported"} | ${report.result.status} | \`${report.result.receiptSha256}\` |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

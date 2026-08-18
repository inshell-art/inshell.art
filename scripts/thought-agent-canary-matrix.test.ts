import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  collectThoughtAgentCanaryMatrix,
  formatThoughtAgentCanaryMatrixSummary,
} from "./lib/thought-agent-canary-matrix";
import { THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION } from "./lib/thought-agent-compatibility-report";

const now = Date.parse("2026-08-18T12:00:00.000Z");
const commitSha = "a".repeat(40);

const report = (runnerId: string, adapter: "codex" | "claude") => ({
  schema: THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  recordedAt: "2026-08-18T11:55:00.000Z",
  agent: {
    adapter,
    surface: adapter === "codex" ? "codex-cli" : "claude-code-cli",
    toolVersion: adapter === "codex" ? "0.147.0" : "2.1.229",
  },
  host: {
    runnerId,
    os: "darwin",
    arch: "arm64",
    nodeVersion: "v22.16.0",
  },
  target: {
    environment: "preview",
    commitSha,
    protocolVersion: "inshell.thought.agent-run.v2",
  },
  result: {
    status: "passed",
    stage: "complete",
    runState: "returned",
    durationMs: 12_000,
    receiptSha256: `sha256:${adapter === "codex" ? "a" : "b"}`.padEnd(71, adapter === "codex" ? "a" : "b"),
  },
});

const withReports = async (
  callback: (root: string) => Promise<void>,
) => {
  const root = await mkdtemp(join(tmpdir(), "inshell-agent-matrix-"));
  try {
    for (const runnerId of ["mac-a", "mac-b"]) {
      await mkdir(join(root, runnerId), { recursive: true });
      for (const adapter of ["codex", "claude"] as const) {
        await writeFile(
          join(root, runnerId, `${adapter}.json`),
          JSON.stringify(report(runnerId, adapter)),
        );
      }
    }
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("collects exactly two Agents on each of two Macs", async () => {
  await withReports(async (root) => {
    const matrix = await collectThoughtAgentCanaryMatrix({
      reportsRoot: root,
      expectedCommitSha: commitSha,
      expectedRunnerIds: ["mac-a", "mac-b"],
      now,
    });
    assert.equal(matrix.status, "passed");
    assert.equal(matrix.cells.length, 4);
    assert.match(formatThoughtAgentCanaryMatrixSummary(matrix), /mac-b.*claude/);
  });
});

test("rejects a wrong-candidate cell", async () => {
  await withReports(async (root) => {
    const path = join(root, "mac-b", "claude.json");
    await writeFile(path, JSON.stringify({
      ...report("mac-b", "claude"),
      target: {
        ...report("mac-b", "claude").target,
        commitSha: "b".repeat(40),
      },
    }));
    await assert.rejects(
      () => collectThoughtAgentCanaryMatrix({
        reportsRoot: root,
        expectedCommitSha: commitSha,
        expectedRunnerIds: ["mac-a", "mac-b"],
        now,
      }),
      /targeted the wrong candidate/,
    );
  });
});

test("rejects failed, stale, duplicated, missing, and mixed-protocol cells", async () => {
  const cases: Array<{
    name: string;
    mutate(root: string): Promise<void>;
    error: RegExp;
  }> = [
    {
      name: "failed",
      async mutate(root) {
        const current = report("mac-a", "codex");
        await writeFile(join(root, "mac-a", "codex.json"), JSON.stringify({
          ...current,
          result: {
            status: "failed",
            stage: "agent",
            runState: "created",
            durationMs: 100,
            errorCode: "AGENT_TIMEOUT",
          },
        }));
      },
      error: /did not complete successfully/,
    },
    {
      name: "stale",
      async mutate(root) {
        await writeFile(join(root, "mac-a", "codex.json"), JSON.stringify({
          ...report("mac-a", "codex"),
          recordedAt: "2026-08-18T01:00:00.000Z",
        }));
      },
      error: /outside the freshness window/,
    },
    {
      name: "duplicated",
      async mutate(root) {
        await writeFile(
          join(root, "mac-b", "claude.json"),
          JSON.stringify(report("mac-a", "codex")),
        );
      },
      error: /Duplicate canary cell/,
    },
    {
      name: "missing",
      async mutate(root) {
        await rm(join(root, "mac-b", "claude.json"));
      },
      error: /Expected 4 compatibility reports, received 3/,
    },
    {
      name: "mixed protocol",
      async mutate(root) {
        const current = report("mac-b", "claude");
        await writeFile(join(root, "mac-b", "claude.json"), JSON.stringify({
          ...current,
          target: {
            ...current.target,
            protocolVersion: "inshell.thought.agent-run.v3",
          },
        }));
      },
      error: /different protocol versions/,
    },
  ];

  for (const scenario of cases) {
    await withReports(async (root) => {
      await scenario.mutate(root);
      await assert.rejects(
        () => collectThoughtAgentCanaryMatrix({
          reportsRoot: root,
          expectedCommitSha: commitSha,
          expectedRunnerIds: ["mac-a", "mac-b"],
          now,
        }),
        scenario.error,
        scenario.name,
      );
    });
  }
});

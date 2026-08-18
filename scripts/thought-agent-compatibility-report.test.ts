import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  classifyThoughtAgentTargetEnvironment,
  emitThoughtAgentCompatibilityReport,
  parseThoughtAgentCompatibilityReport,
  serializeThoughtAgentCompatibilityReport,
} from "./lib/thought-agent-compatibility-report";

const validReport = () => ({
  schema: THOUGHT_AGENT_COMPATIBILITY_REPORT_VERSION,
  recordedAt: "2026-08-18T00:00:00.000Z",
  agent: {
    adapter: "claude",
    surface: "claude-code-cli",
    toolVersion: "2.1.224",
    model: "claude-opus-5",
  },
  host: {
    runnerId: "mac-a",
    os: "darwin",
    arch: "arm64",
    nodeVersion: "v24.0.0",
  },
  target: {
    environment: "preview",
    commitSha: "a".repeat(40),
    protocolVersion: "inshell.thought.agent-run.v2",
  },
  result: {
    status: "passed",
    stage: "complete",
    runState: "returned",
    durationMs: 1234,
    receiptSha256: `sha256:${"a".repeat(64)}`,
  },
});

test("accepts the bounded redacted compatibility schema", () => {
  const parsed = parseThoughtAgentCompatibilityReport(validReport());
  assert.equal(parsed.agent.adapter, "claude");
  assert.equal(parsed.result.runState, "returned");
  assert.doesNotMatch(serializeThoughtAgentCompatibilityReport(parsed), /https?:\/\//);
});

test("classifies targets without retaining their URLs", () => {
  assert.equal(classifyThoughtAgentTargetEnvironment("http://127.0.0.1:5173"), "local");
  assert.equal(classifyThoughtAgentTargetEnvironment("http://192.168.0.103:5177"), "lan");
  assert.equal(classifyThoughtAgentTargetEnvironment("https://preview.inshell.art"), "preview");
  assert.equal(classifyThoughtAgentTargetEnvironment("https://branch.inshell-art.pages.dev"), "preview");
  assert.equal(classifyThoughtAgentTargetEnvironment("https://inshell.art"), "production");
  assert.equal(classifyThoughtAgentTargetEnvironment("https://example.test"), "custom");
});

test("rejects report fields that could carry credentials or creative payloads", () => {
  for (const [field, value] of [
    ["origin", "https://preview.inshell.art"],
    ["launchToken", "secret"],
    ["prompt", "Who are you?"],
    ["rawOutput", "candidate bytes"],
  ] as const) {
    assert.throws(
      () => parseThoughtAgentCompatibilityReport({ ...validReport(), [field]: value }),
      /Invalid compatibility report fields/,
    );
  }
});

test("writes only a validated redacted report to an explicit artifact path", async () => {
  const root = await mkdtemp(join(tmpdir(), "inshell-agent-report-"));
  const output = join(root, "report.json");
  const write = process.stdout.write;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    await emitThoughtAgentCompatibilityReport(validReport(), output);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), validReport());
    assert.equal((await stat(output)).mode & 0o777, 0o600);
  } finally {
    process.stdout.write = write;
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects secret-like values inside allow-listed text fields", () => {
  assert.throws(
    () => parseThoughtAgentCompatibilityReport({
      ...validReport(),
      agent: {
        ...validReport().agent,
        toolVersion: "Bearer secret-token",
      },
    }),
    /Invalid agent toolVersion/,
  );
  assert.throws(
    () => parseThoughtAgentCompatibilityReport({
      ...validReport(),
      target: {
        ...validReport().target,
        protocolVersion: "https://example.com/run?token=secret",
      },
    }),
    /Invalid target protocolVersion/,
  );
});

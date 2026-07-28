import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadReturnedDevRuns,
  persistReturnedDevRuns,
} from "./thought-agent-dev-run-store";

type FixtureRun = {
  runId: string;
  state: string;
  updatedAt: string;
  agentLine: string;
};

const validateFixtureRun = (candidate: unknown): FixtureRun | null => {
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<FixtureRun>;
  return typeof value.runId === "string" &&
    typeof value.state === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.agentLine === "string"
    ? value as FixtureRun
    : null;
};

test("returned Agent runs survive a dev backend restart", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thought-agent-runs-"));
  const storePath = path.join(directory, "runs.json");
  const returned: FixtureRun = {
    runId: "tar_returned",
    state: "returned",
    updatedAt: "2026-07-26T00:00:00.000Z",
    agentLine: "still here",
  };
  const failed: FixtureRun = {
    runId: "tar_failed",
    state: "failed",
    updatedAt: "2026-07-26T00:00:01.000Z",
    agentLine: "",
  };

  persistReturnedDevRuns(storePath, [returned, failed]);

  const restored = loadReturnedDevRuns(storePath, validateFixtureRun);
  assert.deepEqual(Array.from(restored.keys()), ["tar_returned"]);
  assert.equal(restored.get("tar_returned")?.agentLine, "still here");
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});

test("an invalid dev run store fails closed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thought-agent-runs-"));
  const storePath = path.join(directory, "runs.json");
  fs.writeFileSync(storePath, "{not-json");

  assert.equal(loadReturnedDevRuns(storePath, validateFixtureRun).size, 0);
});

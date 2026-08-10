import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadDevRuns,
  persistDevRuns,
  retainLiveDevRuns,
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

test("active and returned Agent runs survive a same-runtime dev backend restart", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thought-agent-runs-"));
  const storePath = path.join(directory, "runs.json");
  const runtimeKey = "runtime-a";
  const returned: FixtureRun = {
    runId: "tar_returned",
    state: "returned",
    updatedAt: "2026-07-26T00:00:00.000Z",
    agentLine: "still here",
  };
  const running: FixtureRun = {
    runId: "tar_running",
    state: "running",
    updatedAt: "2026-07-26T00:00:01.000Z",
    agentLine: "",
  };

  persistDevRuns(storePath, runtimeKey, [returned, running]);

  const restored = loadDevRuns(storePath, runtimeKey, validateFixtureRun);
  assert.deepEqual(Array.from(restored.keys()), ["tar_returned", "tar_running"]);
  assert.equal(restored.get("tar_returned")?.agentLine, "still here");
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});

test("a changed runtime restores returned history but rejects active runs", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thought-agent-runs-"));
  const storePath = path.join(directory, "runs.json");
  persistDevRuns(storePath, "runtime-before", [
    {
      runId: "tar_returned",
      state: "returned",
      updatedAt: "2026-07-26T00:00:00.000Z",
      agentLine: "still here",
    },
    {
      runId: "tar_running",
      state: "running",
      updatedAt: "2026-07-26T00:00:01.000Z",
      agentLine: "",
    },
  ]);

  const restored = loadDevRuns(storePath, "runtime-after", validateFixtureRun);
  assert.deepEqual(Array.from(restored.keys()), ["tar_returned"]);
});

test("an invalid dev run store fails closed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thought-agent-runs-"));
  const storePath = path.join(directory, "runs.json");
  fs.writeFileSync(storePath, "{not-json");

  assert.equal(loadDevRuns(storePath, "runtime-a", validateFixtureRun).size, 0);
});

test("the live Agent map is reused across a same-runtime hot reload", () => {
  const runtimeKey = `thought-runtime-${Date.now()}-${Math.random()}`;
  const initial = new Map<string, FixtureRun>();
  const retained = retainLiveDevRuns(runtimeKey, initial);
  retained.set("tar_active", {
    runId: "tar_active",
    state: "ready",
    updatedAt: "2026-08-08T14:00:00.000Z",
    agentLine: "",
  });

  const reloaded = retainLiveDevRuns(runtimeKey, new Map());
  assert.equal(reloaded, retained);
  assert.equal(reloaded.get("tar_active")?.state, "ready");
});

test("active Agent runs are discarded when the contract runtime changes", () => {
  const prefix = `thought-runtime-change-${Date.now()}-${Math.random()}`;
  const previous = retainLiveDevRuns(`${prefix}:before`, new Map<string, FixtureRun>());
  previous.set("tar_stale", {
    runId: "tar_stale",
    state: "ready",
    updatedAt: "2026-08-08T14:00:00.000Z",
    agentLine: "",
  });

  const current = retainLiveDevRuns(`${prefix}:after`, new Map());
  assert.notEqual(current, previous);
  assert.equal(current.has("tar_stale"), false);
});

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const LEGACY_DEV_RUN_STORE_SCHEMA = "inshell.thought.agent-dev-returned-runs.v1";
const DEV_RUN_STORE_SCHEMA = "inshell.thought.agent-dev-runs.v2";
const LIVE_RUN_STORE_GLOBAL = "__INSHELL_THOUGHT_AGENT_DEV_LIVE_RUN_STORE__";

type StoredRun = {
  runId: string;
  state: string;
  updatedAt: string;
};

type StoredRunEnvelope = {
  schema: typeof DEV_RUN_STORE_SCHEMA | typeof LEGACY_DEV_RUN_STORE_SCHEMA;
  updatedAt: string;
  runtimeKey?: string;
  runs: unknown[];
};

type LiveRunStore = {
  runtimeKey: string;
  runs: Map<string, unknown>;
};

type LiveRunStoreGlobal = typeof globalThis & {
  [LIVE_RUN_STORE_GLOBAL]?: LiveRunStore;
};

export function retainLiveDevRuns<T>(
  runtimeKey: string,
  seed: ReadonlyMap<string, T>,
): Map<string, T> {
  if (!runtimeKey) {
    throw new Error("THOUGHT Agent dev live-run runtime key is required.");
  }
  const scope = globalThis as LiveRunStoreGlobal;
  const existing = scope[LIVE_RUN_STORE_GLOBAL];
  if (existing?.runtimeKey === runtimeKey) {
    return existing.runs as Map<string, T>;
  }
  const runs = new Map(seed);
  scope[LIVE_RUN_STORE_GLOBAL] = {
    runtimeKey,
    runs: runs as Map<string, unknown>,
  };
  return runs;
}

export function loadDevRuns<T extends StoredRun>(
  storePath: string,
  runtimeKey: string,
  validate: (candidate: unknown) => T | null,
): Map<string, T> {
  if (!fs.existsSync(storePath)) return new Map();
  try {
    const envelope = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<StoredRunEnvelope>;
    if (
      (envelope.schema !== DEV_RUN_STORE_SCHEMA &&
        envelope.schema !== LEGACY_DEV_RUN_STORE_SCHEMA) ||
      !Array.isArray(envelope.runs)
    ) {
      return new Map();
    }
    const sameRuntime = envelope.schema === DEV_RUN_STORE_SCHEMA &&
      envelope.runtimeKey === runtimeKey;
    const runs = new Map<string, T>();
    for (const candidate of envelope.runs) {
      const run = validate(candidate);
      if (run && (run.state === "returned" || sameRuntime)) {
        runs.set(run.runId, run);
      }
    }
    return runs;
  } catch {
    return new Map();
  }
}

export function persistDevRuns<T extends StoredRun>(
  storePath: string,
  runtimeKey: string,
  runs: Iterable<T>,
  serialize: (run: T) => unknown = (run) => run,
) {
  const storedRuns = Array.from(runs)
    .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
    .map(serialize);
  const envelope: StoredRunEnvelope = {
    schema: DEV_RUN_STORE_SCHEMA,
    updatedAt: new Date().toISOString(),
    runtimeKey,
    runs: storedRuns,
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, storePath);
}

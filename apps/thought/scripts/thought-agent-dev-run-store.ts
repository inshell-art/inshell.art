import fs from "node:fs";
import path from "node:path";

const DEV_RUN_STORE_SCHEMA = "inshell.thought.agent-dev-returned-runs.v1";

type StoredRun = {
  runId: string;
  state: string;
  updatedAt: string;
};

type StoredRunEnvelope = {
  schema: typeof DEV_RUN_STORE_SCHEMA;
  updatedAt: string;
  runs: unknown[];
};

export function loadReturnedDevRuns<T extends StoredRun>(
  storePath: string,
  validate: (candidate: unknown) => T | null,
): Map<string, T> {
  if (!fs.existsSync(storePath)) return new Map();
  try {
    const envelope = JSON.parse(fs.readFileSync(storePath, "utf8")) as Partial<StoredRunEnvelope>;
    if (envelope.schema !== DEV_RUN_STORE_SCHEMA || !Array.isArray(envelope.runs)) {
      return new Map();
    }
    const runs = new Map<string, T>();
    for (const candidate of envelope.runs) {
      const run = validate(candidate);
      if (run?.state === "returned") {
        runs.set(run.runId, run);
      }
    }
    return runs;
  } catch {
    return new Map();
  }
}

export function persistReturnedDevRuns<T extends StoredRun>(
  storePath: string,
  runs: Iterable<T>,
) {
  const returnedRuns = Array.from(runs)
    .filter((run) => run.state === "returned")
    .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt));
  const envelope: StoredRunEnvelope = {
    schema: DEV_RUN_STORE_SCHEMA,
    updatedAt: new Date().toISOString(),
    runs: returnedRuns,
  };
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, storePath);
}

import { assertThoughtLine, THOUGHT_AGENT_RUN_ID } from "./thought-v2-protocol";

export type ThoughtAgentRunState =
  | "created"
  | "claimed"
  | "running"
  | "returned"
  | "failed"
  | "cancelled"
  | "expired";

export type ThoughtAgentRun = {
  schema: typeof THOUGHT_AGENT_RUN_ID;
  runId: string;
  state: ThoughtAgentRunState;
  promptLine: string;
  spec: { id: string; hash: string; ref: string };
  expiresAt: number;
  resultBytes?: string;
};

export type ThoughtRunCredentials = {
  viewCredential: string;
  writeCredential: string;
};

export const createThoughtAgentRun = (input: {
  runId: string;
  promptLine: string;
  spec: ThoughtAgentRun["spec"];
  expiresAt: number;
}): ThoughtAgentRun => {
  assertThoughtLine(input.promptLine, "prompt");
  return {
    schema: THOUGHT_AGENT_RUN_ID,
    runId: input.runId,
    state: "created",
    promptLine: input.promptLine,
    spec: input.spec,
    expiresAt: input.expiresAt,
  };
};

const assertActive = (run: ThoughtAgentRun, now: number): void => {
  if (now >= run.expiresAt) throw new Error("run expired");
  if (run.state === "cancelled" || run.state === "expired" || run.state === "failed") {
    throw new Error(`run is ${run.state}`);
  }
};

export const claimThoughtAgentRun = (run: ThoughtAgentRun, now: number): ThoughtAgentRun => {
  assertActive(run, now);
  if (run.state !== "created") throw new Error(`cannot claim from ${run.state}`);
  return { ...run, state: "claimed" };
};

export const startThoughtAgentRun = (run: ThoughtAgentRun, now: number): ThoughtAgentRun => {
  assertActive(run, now);
  if (run.state !== "claimed") throw new Error(`cannot start from ${run.state}`);
  return { ...run, state: "running" };
};

export const submitThoughtAgentResult = (
  run: ThoughtAgentRun,
  exactResultBytes: string,
  now: number,
): ThoughtAgentRun => {
  if (run.state === "returned") {
    if (run.resultBytes === exactResultBytes) return run;
    throw new Error("conflicting result");
  }
  assertActive(run, now);
  if (run.state !== "claimed" && run.state !== "running") {
    throw new Error(`cannot return from ${run.state}`);
  }
  return { ...run, state: "returned", resultBytes: exactResultBytes };
};

export const cancelThoughtAgentRun = (run: ThoughtAgentRun): ThoughtAgentRun => {
  if (run.state === "returned") throw new Error("returned run is final");
  return { ...run, state: "cancelled" };
};

export const failThoughtAgentRun = (run: ThoughtAgentRun, now: number): ThoughtAgentRun => {
  assertActive(run, now);
  if (run.state === "returned") throw new Error("returned run is final");
  return { ...run, state: "failed" };
};

export const expireThoughtAgentRun = (run: ThoughtAgentRun, now: number): ThoughtAgentRun =>
  now >= run.expiresAt && run.state !== "returned" ? { ...run, state: "expired" } : run;

export const authorizeThoughtRunRead = (provided: string, credentials: ThoughtRunCredentials): boolean =>
  provided === credentials.viewCredential || provided === credentials.writeCredential;

export const authorizeThoughtRunWrite = (provided: string, credentials: ThoughtRunCredentials): boolean =>
  provided === credentials.writeCredential;

export const thoughtRunPublicUrl = (origin: string, runId: string, viewCredential?: string): string => {
  const base = `${origin.replace(/\/$/, "")}/thought/runs/${encodeURIComponent(runId)}`;
  return viewCredential ? `${base}#view=${encodeURIComponent(viewCredential)}` : base;
};

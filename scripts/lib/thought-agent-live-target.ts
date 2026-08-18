import { execFile } from "node:child_process";
import { hostname } from "node:os";
import { promisify } from "node:util";

import {
  classifyThoughtAgentTargetEnvironment,
  type ThoughtAgentCompatibilityReport,
} from "./thought-agent-compatibility-report";

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const execFileAsync = promisify(execFile);

export class ThoughtAgentCanaryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ThoughtAgentCanaryError";
    this.code = code;
  }
}

export function requiredThoughtAgentLiveTarget(environment = process.env) {
  const originInput = environment.THOUGHT_LIVE_ORIGIN?.trim();
  if (!originInput) {
    throw new ThoughtAgentCanaryError(
      "TARGET_ORIGIN_REQUIRED",
      "THOUGHT_LIVE_ORIGIN is required.",
    );
  }
  const origin = new URL(originInput).origin;
  if (classifyThoughtAgentTargetEnvironment(origin) !== "preview") {
    throw new ThoughtAgentCanaryError(
      "TARGET_NOT_PREVIEW",
      "Live release canaries require an explicit preview origin.",
    );
  }
  const expectedCommitSha = environment.THOUGHT_LIVE_COMMIT_SHA?.trim().toLowerCase();
  if (!expectedCommitSha || !COMMIT_SHA.test(expectedCommitSha)) {
    throw new ThoughtAgentCanaryError(
      "TARGET_COMMIT_REQUIRED",
      "THOUGHT_LIVE_COMMIT_SHA must be an exact 40-character commit SHA.",
    );
  }
  const rawRunnerId = environment.THOUGHT_CANARY_RUNNER_ID?.trim() || hostname();
  const runnerId = rawRunnerId
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!runnerId) {
    throw new ThoughtAgentCanaryError(
      "RUNNER_ID_INVALID",
      "THOUGHT_CANARY_RUNNER_ID is invalid.",
    );
  }
  return { origin, expectedCommitSha, runnerId };
}

export function validateThoughtAgentCandidateCheckout(
  target: ReturnType<typeof requiredThoughtAgentLiveTarget>,
  checkout: { headSha: string; porcelain: string },
) {
  if (checkout.headSha.trim().toLowerCase() !== target.expectedCommitSha) {
    throw new ThoughtAgentCanaryError(
      "TARGET_CHECKOUT_MISMATCH",
      "The checked-out source is not the requested staging candidate.",
    );
  }
  if (checkout.porcelain.trim()) {
    throw new ThoughtAgentCanaryError(
      "TARGET_CHECKOUT_DIRTY",
      "Release canaries require a clean candidate checkout.",
    );
  }
}

export async function validateCurrentThoughtAgentCandidateCheckout(
  target: ReturnType<typeof requiredThoughtAgentLiveTarget>,
  cwd = process.cwd(),
) {
  const [{ stdout: headSha }, { stdout: porcelain }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }),
    execFileAsync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd, encoding: "utf8" },
    ),
  ]);
  validateThoughtAgentCandidateCheckout(target, { headSha, porcelain });
}

type OpsStatusPayload = {
  ok?: boolean;
  host?: {
    branch?: string | null;
    commitSha?: string | null;
  };
  routes?: {
    thoughtAgent?: {
      baseRoute?: string;
    };
  };
};

export async function validateThoughtAgentLiveTarget(
  target: ReturnType<typeof requiredThoughtAgentLiveTarget>,
  fetchImpl: typeof fetch = fetch,
): Promise<ThoughtAgentCompatibilityReport["target"]> {
  let response: Response;
  try {
    response = await fetchImpl(`${target.origin}/api/ops/status`, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new ThoughtAgentCanaryError(
      "TARGET_UNREACHABLE",
      "Qualified preview status could not be reached.",
    );
  }
  if (!response.ok) {
    throw new ThoughtAgentCanaryError(
      `TARGET_HTTP_${response.status}`,
      "Qualified preview status was rejected.",
    );
  }
  const payload = await response.json() as OpsStatusPayload;
  const actualCommitSha = payload.host?.commitSha?.toLowerCase() ?? "";
  if (actualCommitSha !== target.expectedCommitSha) {
    throw new ThoughtAgentCanaryError(
      "TARGET_COMMIT_MISMATCH",
      "Qualified preview does not serve the requested candidate commit.",
    );
  }
  if (
    payload.ok !== true ||
    payload.host?.branch !== "staging" ||
    payload.routes?.thoughtAgent?.baseRoute !== "/api/thought-agent/v2"
  ) {
    throw new ThoughtAgentCanaryError(
      "TARGET_NOT_QUALIFIED",
      "Preview does not expose the qualified staging Agent contract.",
    );
  }
  const connectivityResponse = await fetchImpl(
    `${target.origin}/api/thought-agent/v2/connectivity`,
    { headers: { accept: "application/json" } },
  );
  if (!connectivityResponse.ok) {
    throw new ThoughtAgentCanaryError(
      `TARGET_CONNECTIVITY_HTTP_${connectivityResponse.status}`,
      "Qualified preview Agent connectivity was rejected.",
    );
  }
  const connectivity = await connectivityResponse.json() as {
    schema?: string;
    status?: string;
    protocolVersion?: string;
  };
  if (
    connectivity.schema !== "inshell.thought.agent-connectivity.v1" ||
    connectivity.status !== "reachable" ||
    connectivity.protocolVersion !== "inshell.thought.agent-run.v2"
  ) {
    throw new ThoughtAgentCanaryError(
      "TARGET_CONNECTIVITY_INVALID",
      "Preview does not expose the qualified Agent connectivity contract.",
    );
  }
  return {
    environment: "preview",
    commitSha: actualCommitSha,
    protocolVersion: "inshell.thought.agent-run.v2",
  };
}

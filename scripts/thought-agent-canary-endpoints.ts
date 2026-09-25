import {
  THOUGHT_CODEX_TRANSPORT_WORKER_LOADER,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
} from "../packages/thought-agent-protocol/src/index";

const requireTransport = (condition: unknown, message: string): void => {
  // Never include transport values in failures: the capsule carries credentials.
  if (!condition) throw new Error(message);
};

export const inspectThoughtCodexFixedWorkerHandoff = (handoff: string) => {
  const credentialLines = handoff.split(/\r?\n/).filter((line) => line.startsWith("Credential="));
  requireTransport(credentialLines.length === 1, "Codex handoff must contain exactly one launch credential.");
  const launchToken = credentialLines[0].slice("Credential=".length);
  requireTransport(launchToken.length > 0, "Codex handoff launch credential is missing.");
  requireTransport(
    !/^(?:RUN_ID|LAUNCH_CREDENTIAL|APP_ENDPOINT|CLAIM_ENDPOINT|READY_ENDPOINT|START_ENDPOINT|RESULT_ENDPOINT|FAIL_ENDPOINT) = /m.test(handoff),
    "Codex handoff contains an unexpected legacy transport binding.",
  );
  const commandLines = handoff.split(/\r?\n/).filter((line) => line.startsWith("node -e "));
  requireTransport(commandLines.length === 1, "Codex handoff must contain exactly one worker command.");
  const match = commandLines[0].match(/^node -e '([^']*)' -- '([^']*)' '([^']*)' '([^']*)'$/);
  requireTransport(match?.length === 5, "Codex handoff worker command is invalid.");
  const [, loader, bootstrapUrl, workerHash, configHash] = match!;
  requireTransport(loader === THOUGHT_CODEX_TRANSPORT_WORKER_LOADER, "Codex handoff worker loader differs from the fixed release.");
  requireTransport(
    workerHash === THOUGHT_CODEX_TRANSPORT_WORKER_SHA256 &&
      /^sha256:[0-9a-f]{64}$/.test(configHash),
    "Codex handoff bootstrap integrity binding differs from the fixed release.",
  );
  return {
    bootstrap: { url: bootstrapUrl, workerSha256: workerHash, configSha256: configHash },
    launchToken,
  };
};

const parseTransportUrl = (value: string): URL => {
  try {
    return new URL(value);
  } catch {
    throw new Error("Agent transport URL is invalid.");
  }
};

export const thoughtAgentCapsuleValue = (handoff: string, key: string): string => {
  const matches = handoff.split(/\r?\n/).filter((line) => line.startsWith(`${key} = `));
  requireTransport(matches.length === 1, `Agent handoff must contain exactly one ${key}.`);
  return matches[0].slice(key.length + 3).trim();
};

export const validateThoughtAgentCanaryRunUrl = (
  value: string,
  runId: string,
  expectedApiOrigin: string,
): string => {
  requireTransport(/^tar_[A-Za-z0-9_-]+$/.test(runId), "Agent run ID is invalid.");
  const expected = parseTransportUrl(expectedApiOrigin);
  requireTransport(
    expected.href === `${expected.origin}/` &&
      (expected.protocol === "https:" ||
        (expected.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(expected.hostname))),
    "Expected Agent API origin must be HTTPS or loopback HTTP, without credentials, a path, query or fragment.",
  );
  const url = parseTransportUrl(value);
  requireTransport(
    value === `${expected.origin}/api/thought-agent/v2/runs/${runId}` &&
      url.origin === expected.origin && !url.username && !url.password && !url.search && !url.hash,
    "Agent endpoint must match the expected API origin, v2 run path and created run ID, without credentials, query or fragment.",
  );
  return value;
};

export const thoughtAgentCanaryLaunchTransport = (
  launchUri: string,
  runId: string,
  expectedApiOrigin: string,
) => {
  const launch = parseTransportUrl(launchUri);
  requireTransport(
    launch.protocol === "thought:" && launch.host === "agent" && launch.pathname === "/run" &&
      launch.searchParams.getAll("run_id").length === 1 && launch.searchParams.get("run_id") === runId &&
      launch.searchParams.getAll("api_origin").length === 1 &&
      launch.searchParams.getAll("token").length === 1,
    "Agent launch URI must identify the created run and contain one API origin and launch credential.",
  );
  const launchToken = launch.searchParams.get("token") || "";
  requireTransport(launchToken.length > 0, "Agent launch credential is missing.");
  const apiOrigin = launch.searchParams.get("api_origin") || "";
  const runUrl = validateThoughtAgentCanaryRunUrl(
    `${apiOrigin}/api/thought-agent/v2/runs/${runId}`, runId, expectedApiOrigin,
  );
  return { runUrl, launchToken };
};

export const thoughtAgentCanaryHandoffTransport = (input: {
  handoff: string;
  runId: string;
  launchToken: string;
  expectedApiOrigin: string;
  explicitEndpoints: boolean;
}) => {
  const { handoff, runId, launchToken, expectedApiOrigin } = input;
  if (handoff.startsWith("THOUGHT ") && handoff.includes(": fixed worker.\n")) {
    requireTransport(!input.explicitEndpoints, "Codex fixed-worker handoff cannot use explicit operation endpoints.");
    const delivered = inspectThoughtCodexFixedWorkerHandoff(handoff);
    requireTransport(
      delivered.launchToken === launchToken,
      "Agent handoff launch credential differs from creation.",
    );
    requireTransport(
      delivered.bootstrap.url.endsWith("/bootstrap"),
      "Codex handoff bootstrap URL is invalid.",
    );
    const runUrl = validateThoughtAgentCanaryRunUrl(
      delivered.bootstrap.url.slice(0, -"/bootstrap".length),
      runId,
      expectedApiOrigin,
    );
    return {
      runUrl,
      launchToken: delivered.launchToken,
      endpoints: Object.fromEntries(
        (["claim", "ready", "start", "result", "fail"] as const)
          .map((action) => [action, `${runUrl}/${action}`]),
      ) as Record<"claim" | "ready" | "start" | "result" | "fail", string>,
    };
  }
  requireTransport(thoughtAgentCapsuleValue(handoff, "RUN_ID") === runId, "Agent handoff run ID differs from creation.");
  const deliveredToken = thoughtAgentCapsuleValue(handoff, "LAUNCH_CREDENTIAL");
  requireTransport(deliveredToken.length > 0 && deliveredToken === launchToken, "Agent handoff launch credential differs from creation.");
  const runUrl = validateThoughtAgentCanaryRunUrl(
    thoughtAgentCapsuleValue(handoff, "APP_ENDPOINT").replaceAll("RUN_ID", runId), runId, expectedApiOrigin,
  );
  const endpoints = {} as Record<"claim" | "ready" | "start" | "result" | "fail", string>;
  for (const action of ["claim", "ready", "start", "result", "fail"] as const) {
    const key = `${action.toUpperCase()}_ENDPOINT`;
    const hasExplicitEndpoint = handoff.split(/\r?\n/).some((line) => line.startsWith(`${key} = `));
    const endpoint = input.explicitEndpoints || hasExplicitEndpoint
      ? thoughtAgentCapsuleValue(handoff, key).replaceAll("RUN_ID", runId)
      : `${runUrl}/${action}`;
    requireTransport(endpoint === `${runUrl}/${action}`, `Agent ${action} endpoint differs from APP_ENDPOINT and the created run.`);
    endpoints[action] = endpoint;
  }
  return { runUrl, launchToken: deliveredToken, endpoints };
};

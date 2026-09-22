const requireTransport = (condition: unknown, message: string): void => {
  // Never include transport values in failures: the capsule carries credentials.
  if (!condition) throw new Error(message);
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

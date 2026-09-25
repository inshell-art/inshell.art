import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { brotliDecompressSync } from "node:zlib";

import {
  THOUGHT_CODEX_TRANSPORT_WORKER_BROTLI_BASE64,
  THOUGHT_CODEX_TRANSPORT_WORKER_LOADER,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE,
} from "../packages/thought-agent-protocol/src/index";

const requireTransport = (condition: unknown, message: string): void => {
  // Never include transport values in failures: the capsule carries credentials.
  if (!condition) throw new Error(message);
};

type CodexWorkerConfig = {
  i: string;
  l: "agentLabel" | "label";
  p: string;
  r: [string, string];
  u: string;
  v: [string, string, string];
  w: string;
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
  const [, loader, payload, workerHash, configJson] = match!;
  requireTransport(loader === THOUGHT_CODEX_TRANSPORT_WORKER_LOADER, "Codex handoff worker loader differs from the fixed release.");
  requireTransport(
    payload === THOUGHT_CODEX_TRANSPORT_WORKER_BROTLI_BASE64 &&
      workerHash === THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
    "Codex handoff worker artifact differs from the fixed release.",
  );
  let source: Buffer;
  try {
    source = brotliDecompressSync(Buffer.from(payload, "base64"));
  } catch {
    throw new Error("Codex handoff worker artifact is invalid.");
  }
  requireTransport(
    source.toString("utf8") === THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE &&
      `sha256:${createHash("sha256").update(source).digest("hex")}` === workerHash,
    "Codex handoff worker artifact failed integrity verification.",
  );
  let config: CodexWorkerConfig;
  try {
    config = JSON.parse(configJson) as CodexWorkerConfig;
  } catch {
    throw new Error("Codex handoff worker configuration is invalid.");
  }
  requireTransport(
    config && typeof config === "object" && !Array.isArray(config) &&
      Object.keys(config).sort().join(",") === "i,l,p,r,u,v,w" &&
      typeof config.i === "string" && typeof config.u === "string" &&
      typeof config.p === "string" && typeof config.w === "string" &&
      (config.l === "label" || config.l === "agentLabel") &&
      Array.isArray(config.v) && config.v.length === 3 && config.v.every((value) => typeof value === "string") &&
      Array.isArray(config.r) && config.r.length === 2 && config.r.every((value) => typeof value === "string"),
    "Codex handoff worker configuration is invalid.",
  );
  return { config, launchToken };
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
    requireTransport(delivered.config.i === runId, "Agent handoff run ID differs from creation.");
    requireTransport(
      delivered.launchToken === launchToken,
      "Agent handoff launch credential differs from creation.",
    );
    const runUrl = validateThoughtAgentCanaryRunUrl(
      delivered.config.u,
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

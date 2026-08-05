import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
} from "../packages/thought-agent-protocol/src/index";
import {
  buildThoughtV2LocalRelease,
  type ThoughtV2LocalRuntimeAddresses,
} from "../apps/thought/src/thought-v2-local-release";

const origin = (process.env.THOUGHT_LIVE_ORIGIN || "http://127.0.0.1:5173").replace(/\/+$/g, "");
const apiBase = `${origin}/api/thought-agent/v2`;
const localRuntime = JSON.parse(await readFile(
  new URL("../apps/thought/evm/addresses.anvil.json", import.meta.url),
  "utf8",
)) as ThoughtV2LocalRuntimeAddresses;
const liveRelease = buildThoughtV2LocalRelease(localRuntime);

const responseJson = async <T>(url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const payload = await response.json() as T;
  return { response, payload };
};

const createdResult = await responseJson<{
  runId: string;
  browserToken: string;
  statusUrl: string;
  launchUri: string;
  client?: unknown;
}>(`${apiBase}/runs`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin,
  },
  body: JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    promptLine: "Who are you?",
    specId: liveRelease.spec.evmSpecId,
    requestedAgent: { adapterId: "codex", model: null },
    client: { surface: "thought-retired-client-live-test", appVersion: "test" },
    devAutoRun: false,
  }),
});

assert.equal(createdResult.response.status, 201);
assert.match(createdResult.payload.runId, /^tar_[A-Za-z0-9_-]+$/);
assert.equal(createdResult.payload.client, undefined);
assert.notEqual(new URL(createdResult.payload.launchUri).searchParams.get("token"), null);

const retired = await responseJson<{
  error?: { code?: string; message?: string };
}>(`${apiBase}/client`, { cache: "no-store" });
assert.equal(retired.response.status, 410);
assert.equal(retired.response.headers.get("content-type"), "application/json; charset=utf-8");
assert.deepEqual(retired.payload, {
  error: {
    code: "PROTOCOL_UNSUPPORTED",
    message: "This compatibility client is retired. Open the Agent task from THOUGHT.",
  },
});

const statusUrl = new URL(createdResult.payload.statusUrl, origin).toString();
const cancelled = await responseJson<{ state?: string }>(`${statusUrl}/cancel`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${createdResult.payload.browserToken}`,
    "content-type": "application/json",
  },
  body: "{}",
});
assert.equal(cancelled.response.status, 200);
assert.equal(cancelled.payload.state, "cancelled");

console.log(JSON.stringify({
  runId: createdResult.payload.runId,
  compatibilityClient: "retired",
  directAgentTaskRequired: true,
  state: cancelled.payload.state,
}, null, 2));

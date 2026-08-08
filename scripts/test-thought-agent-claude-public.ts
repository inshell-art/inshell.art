import assert from "node:assert/strict";

import {
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtClaudeOperationContract,
  buildThoughtClaudeTask,
  sha256Hex,
} from "../packages/thought-agent-protocol/src/index";

const origin = (process.env.THOUGHT_LIVE_ORIGIN || "https://inshell.art")
  .replace(/\/+$/g, "");
const apiBase = `${origin}/api/thought-agent/v2`;
const promptLine = "Can a public path remain private?";

type ProtocolErrorPayload = {
  error?: { code?: string; message?: string };
};

const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload: T & ProtocolErrorPayload;
  try {
    payload = JSON.parse(text) as T & ProtocolErrorPayload;
  } catch {
    throw new Error(
      `${response.status} NON_JSON_RESPONSE: ${text.slice(0, 160).replace(/\s+/g, " ")}`,
    );
  }
  assert.equal(
    response.ok,
    true,
    `${response.status} ${payload.error?.code ?? "HTTP_ERROR"}: ${payload.error?.message ?? "request failed"}`,
  );
  return payload;
};

let created: {
  runId: string;
  browserToken: string;
  statusUrl: string;
  launchUri: string;
} | null = null;
let terminal = false;

try {
  created = await requestJson(`${apiBase}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      promptLine,
      specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
      requestedAgent: { adapterId: "claude", model: null },
      client: { surface: "thought-claude-public-transport-canary", appVersion: "test" },
    }),
  });

  assert.match(created.runId, /^tar_[A-Za-z0-9_-]+$/);
  const launchToken = new URL(created.launchUri).searchParams.get("token") ?? "";
  assert.notEqual(launchToken, "");
  const runUrl = new URL(created.statusUrl, origin).toString().replace(/\/+$/g, "");
  assert.equal(new URL(runUrl).origin, new URL(origin).origin);

  const input = {
    product: "Claude",
    runId: created.runId,
    runUrl,
    launchToken,
    surface: "cowork" as const,
  };
  const operation = buildThoughtClaudeOperationContract(input);
  const handoff = buildThoughtClaudeTask(input);
  assert.match(handoff, /public HTTPS THOUGHT service/);
  assert.doesNotMatch(handoff, /127\.0\.0\.1|localhost|192\.168\./i);
  assert.equal(operation.adapter.adapterId, "claude");
  assert.equal(operation.agentSurface, "cowork");

  const claim = await requestJson<{
    runId: string;
    state: string;
    bridgeToken: string;
    request?: { intent?: string; controlPolicy?: { creativeInputState?: string } };
  }>(operation.endpoints.claim, {
    method: "POST",
    headers: {
      authorization: `Bearer ${launchToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation.claim),
  });
  assert.equal(claim.runId, created.runId);
  assert.equal(claim.state, "claimed");
  assert.notEqual(claim.bridgeToken, "");
  assert.equal(claim.request?.intent, "prepare-thought-creation");
  assert.equal(claim.request?.controlPolicy?.creativeInputState, "sealed");

  const ready = await requestJson<{
    runId: string;
    state: string;
    stage: string;
    control: unknown;
  }>(operation.endpoints.ready, {
    method: "POST",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation.ready),
  });
  assert.equal(ready.runId, created.runId);
  assert.equal(ready.state, "ready");
  assert.equal(ready.stage, "control-verified");
  assert.deepEqual(ready.control, operation.ready.control);

  const startedAt = new Date().toISOString();
  const started = await requestJson<{
    runId: string;
    state: string;
    invocationId: string;
    startedAt: string;
    request?: {
      intent?: string;
      promptLine?: { text?: string };
      agentInput?: { text?: string };
    };
  }>(operation.endpoints.start, {
    method: "POST",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      protocolVersion: operation.protocolVersion,
      invocationId: operation.invocationId,
      startedAt,
    }),
  });
  assert.equal(started.runId, created.runId);
  assert.equal(started.state, "running");
  assert.equal(started.invocationId, operation.invocationId);
  assert.equal(started.startedAt, startedAt);
  assert.equal(started.request?.intent, "generate-thought-candidate");
  assert.equal(started.request?.promptLine?.text, promptLine);
  assert.equal(started.request?.agentInput?.text, promptLine);

  const agentLine = "A public path can still remain private.";
  const candidate = {
    schema: THOUGHT_AGENT_RESULT_VERSION,
    release: THOUGHT_V2_PROTOCOL_RELEASE.release,
    agentLine,
    declaration: {
      schema: "inshell.thought.agent-declaration.v1",
      status: "declared-unverified",
      label: "Claude",
      declaredOneCreativeResult: true,
    },
  } as const;
  const raw = JSON.stringify(candidate);
  const completedAt = new Date(Math.max(Date.now(), Date.parse(startedAt))).toISOString();
  const returned = await requestJson<{
    runId: string;
    state: string;
    result?: { agentLine?: string; receipt?: { receiptSha256?: string } };
  }>(operation.endpoints.result, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${claim.bridgeToken}`,
      "content-type": "application/json",
      "idempotency-key": operation.invocationId,
    },
    body: JSON.stringify({
      protocolVersion: operation.protocolVersion,
      invocationId: operation.invocationId,
      bridge: operation.bridge,
      adapter: operation.adapter,
      agent: {
        product: "Claude",
        provider: "anthropic",
        model: "unknown",
        metadataSource: "unknown",
      },
      execution: operation.execution,
      startedAt,
      completedAt,
      output: {
        mediaType: "application/json",
        raw,
        rawSha256: await sha256Hex(raw),
        agentLine,
        agentLineSha256: await sha256Hex(agentLine),
      },
    }),
  });
  assert.equal(returned.runId, created.runId);
  assert.equal(returned.state, "returned");
  assert.equal(returned.result?.agentLine, agentLine);
  assert.match(returned.result?.receipt?.receiptSha256 ?? "", /^sha256:[a-f0-9]{64}$/);
  terminal = true;

  const status = await requestJson<{
    runId: string;
    state: string;
    result?: { agentLine?: string; receipt?: { metadataSource?: string } };
  }>(runUrl, {
    headers: { authorization: `Bearer ${created.browserToken}` },
  });
  assert.equal(status.state, "returned");
  assert.equal(status.result?.agentLine, agentLine);
  assert.equal(status.result?.receipt?.metadataSource, "unknown");

  console.log(JSON.stringify({
    runId: created.runId,
    state: status.state,
    adapter: operation.adapter,
    bridge: operation.bridge,
    transport: "public-https",
    liveClaudeQualified: false,
    note: "Transport simulation passed; a real Cowork submission is still required.",
  }, null, 2));
} finally {
  if (created && !terminal) {
    const runUrl = new URL(created.statusUrl, origin).toString().replace(/\/+$/g, "");
    await fetch(`${runUrl}/cancel`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${created.browserToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION }),
    }).catch(() => undefined);
  }
}

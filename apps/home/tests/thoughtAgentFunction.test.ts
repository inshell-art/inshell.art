import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { webcrypto, randomFillSync } from "node:crypto";
import { onRequestPost as onCreateRun } from "../../../functions/api/thought-agent/v1/runs";
import { onRequestGet as onGetCodexClient } from "../../../functions/api/thought-agent/v2/client";
import { onRequestPost as onCreateRunV2 } from "../../../functions/api/thought-agent/v2/runs";
import { onRequestGet as onGetRun } from "../../../functions/api/thought-agent/v1/runs/[runId]";
import { onRequestPost as onCancelRun } from "../../../functions/api/thought-agent/v1/runs/[runId]/cancel";
import { onRequestPost as onClaimRun } from "../../../functions/api/thought-agent/v1/runs/[runId]/claim";
import { onRequestPost as onFailRun } from "../../../functions/api/thought-agent/v1/runs/[runId]/fail";
import { onRequestPut as onSubmitResult } from "../../../functions/api/thought-agent/v1/runs/[runId]/result";
import { onRequestPost as onStartRun } from "../../../functions/api/thought-agent/v1/runs/[runId]/start";
import {
  THOUGHT_AGENT_CLAIM_TTL_MS,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RESULT_VERSION,
  THOUGHT_AGENT_RUN_TTL_MS,
  THOUGHT_V2_PROTOCOL_RELEASE,
  sha256Hex,
} from "../../../packages/thought-agent-protocol/src/index";

type Row = Record<string, unknown>;

const originalCrypto = globalThis.crypto;
const originalResponse = globalThis.Response;
const originalHeaders = globalThis.Headers;

class TestHeaders {
  values = new Map<string, string>();

  constructor(init?: Record<string, string> | TestHeaders) {
    const entries =
      init instanceof TestHeaders ? [...init.values.entries()] : Object.entries(init ?? {});
    for (const [key, value] of entries) this.set(key, value);
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }
}

class TestResponse {
  status: number;
  headers: TestHeaders;
  private readonly bodyText: string;

  constructor(body?: unknown, init?: { status?: number; headers?: unknown }) {
    this.status = init?.status ?? 200;
    this.headers =
      init?.headers instanceof TestHeaders
        ? new TestHeaders(init.headers)
        : new TestHeaders(init?.headers as Record<string, string> | undefined);
    this.bodyText = typeof body === "string" ? body : "";
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  async json(): Promise<any> {
    return JSON.parse(this.bodyText);
  }

  async text(): Promise<string> {
    return this.bodyText;
  }
}

class TestRequest {
  url: string;
  headers: TestHeaders;
  private readonly bodyText: string;

  constructor(url: string, init?: { headers?: Record<string, string>; body?: unknown }) {
    this.url = url;
    this.headers = new TestHeaders(init?.headers);
    this.bodyText =
      typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
  }

  async text(): Promise<string> {
    return this.bodyText;
  }
}

function createD1Mock() {
  const rows = new Map<string, Row>();
  const claimRows = new Map<string, Row>();
  const exec = jest.fn(async () => undefined);
  const prepare = jest.fn((query: string) => {
    let bound: unknown[] = [];
    const statement = {
      bind: (...values: unknown[]) => {
        bound = values;
        return statement;
      },
      first: jest.fn(async () => {
        if (/select\s+\*\s+from\s+thought_agent_runs/i.test(query)) {
          return rows.get(String(bound[0])) ?? null;
        }
        if (/select\s+\*\s+from\s+thought_agent_claim_authorizations/i.test(query)) {
          const runId = String(bound[0]);
          if (/claim_token_hash\s*=\s*\?2/i.test(query)) {
            return [...claimRows.values()].find(
              (row) => row.run_id === runId && row.claim_token_hash === bound[1],
            ) ?? null;
          }
          if (/claim_request_id\s*=\s*\?2/i.test(query)) {
            return [...claimRows.values()].find(
              (row) => row.run_id === runId && row.claim_request_id === bound[1],
            ) ?? null;
          }
          return [...claimRows.values()].find(
            (row) =>
              row.run_id === runId &&
              ["pending", "authorized"].includes(String(row.state)) &&
              String(row.expires_at) > String(bound[1]),
          ) ?? null;
        }
        if (/select\s+count\(\*\)\s+as\s+active_count/i.test(query)) {
          const visitorHash = String(bound[0]);
          const active_count = [...rows.values()].filter(
            (row) =>
              row.visitor_hash === visitorHash &&
              ["created", "claimed", "running"].includes(String(row.state)),
          ).length;
          return { active_count };
        }
        return null;
      }),
      run: jest.fn(async () => {
        if (/insert\s+into\s+thought_agent_runs/i.test(query)) {
          const columns = query
            .match(/\(([^)]+)\)\s+values/i)?.[1]
            ?.split(",")
            .map((column) => column.trim());
          if (!columns) throw new Error("bad insert");
          const row = Object.fromEntries(columns.map((column, index) => [column, bound[index]]));
          rows.set(String(row.run_id), row);
          return { meta: { changes: 1 } };
        }
        if (/insert\s+into\s+thought_agent_claim_authorizations/i.test(query)) {
          const columns = query
            .match(/\(([^)]+)\)\s+values/i)?.[1]
            ?.split(",")
            .map((column) => column.trim());
          if (!columns) throw new Error("bad claim authorization insert");
          const row = Object.fromEntries(columns.map((column, index) => [column, bound[index]]));
          claimRows.set(String(row.claim_request_id), row);
          return { meta: { changes: 1 } };
        }
        if (/update\s+thought_agent_claim_authorizations\s+set\s+state\s*=\s*'authorized'/i.test(query)) {
          const row = claimRows.get(String(bound[0]));
          const changes = row?.run_id === bound[1] && row.state === "pending" ? 1 : 0;
          if (row && changes) {
            row.state = "authorized";
            row.authorized_at = bound[2];
          }
          return { meta: { changes } };
        }
        if (/update\s+thought_agent_claim_authorizations\s+set\s+state\s*=\s*'consumed'/i.test(query)) {
          const row = claimRows.get(String(bound[0]));
          const changes = row?.state === "authorized" ? 1 : 0;
          if (row && changes) {
            row.state = "consumed";
            row.consumed_at = bound[1];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'claimed'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes =
            row?.state === "created" &&
            row.launch_token_hash === bound[1] &&
            row.bridge_token_hash == null
              ? 1
              : 0;
          if (row && changes) {
            row.state = "claimed";
            row.launch_token_hash = null;
            row.bridge_token_hash = bound[2];
            row.bridge_metadata_json = bound[3];
            row.adapter_metadata_json = bound[4];
            row.updated_at = bound[5];
            row.run_expires_at = bound[6];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'running'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes =
            row?.state === "claimed" &&
            row.bridge_token_hash === bound[4] &&
            row.invocation_id == null
              ? 1
              : 0;
          if (row && changes) {
            row.state = "running";
            row.invocation_id = bound[1];
            row.started_at = bound[2];
            row.updated_at = bound[3];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'returned'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes =
            row?.state === "running" &&
            row.bridge_token_hash === bound[13] &&
            row.invocation_id === bound[14] &&
            row.raw_result_sha256 == null
              ? 1
              : 0;
          if (row && changes) {
            row.state = "returned";
            row.bridge_metadata_json = bound[1];
            row.adapter_metadata_json = bound[2];
            row.agent_metadata_json = bound[3];
            row.execution_metadata_json = bound[4];
            row.completed_at = bound[5];
            row.raw_result = bound[6];
            row.raw_result_sha256 = bound[7];
            row.work_text = bound[8];
            row.work_sha256 = bound[9];
            row.receipt_json = bound[10];
            row.receipt_sha256 = bound[11];
            row.updated_at = bound[12];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'failed'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes =
            row &&
            ["claimed", "running"].includes(String(row.state)) &&
            row.bridge_token_hash === bound[6]
              ? 1
              : 0;
          if (row && changes) {
            row.state = "failed";
            row.invocation_id ??= bound[1];
            row.completed_at = bound[2];
            row.error_code = bound[3];
            row.error_message = bound[4];
            row.updated_at = bound[5];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'cancelled'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes =
            row &&
            row.browser_token_hash === bound[1] &&
            ["created", "claimed", "running"].includes(String(row.state))
              ? 1
              : 0;
          if (row && changes) {
            row.state = "cancelled";
            row.updated_at = bound[2];
          }
          return { meta: { changes } };
        }
        if (/set\s+state\s*=\s*'expired'/i.test(query)) {
          const row = rows.get(String(bound[0]));
          const changes = row?.state === bound[1] ? 1 : 0;
          if (row && changes) {
            row.state = "expired";
            row.updated_at = bound[2];
          }
          return { meta: { changes } };
        }
        return { meta: { changes: 0 } };
      }),
    };
    return statement;
  });
  return { rows, claimRows, db: { exec, prepare } };
}

function request(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new TestRequest(url, { body, headers }) as unknown as Request;
}

function auth(token: string, extra: Record<string, string> = {}) {
  return {
    authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function createRun(env: any, prompt = "make a quiet sky") {
  const response = await onCreateRun({
    request: request(
      "https://thought.inshell.art/api/thought-agent/v1/runs",
      {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        promptLine: prompt,
        specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
        requestedAgent: {
          adapterId: "codex",
          model: null,
        },
        client: {
          surface: "thought-web",
          appVersion: "test",
        },
      },
      {
        origin: "https://thought.inshell.art",
        cookie: "inshell_anon_visitor=visitor-1",
      },
    ),
    env,
  });
  const payload = await response.json();
  return { response, payload };
}

const claimBody = {
  protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
  bridge: {
    bridgeId: "thought-bridge",
    bridgeVersion: "0.1.0",
    installationId: "tb_i_test",
    platform: "darwin-arm64",
  },
  adapter: {
    adapterId: "codex",
    adapterVersion: "0.1.0",
  },
};

async function claimRun(env: any, runId: string, launchToken: string) {
  const response = await onClaimRun({
    request: request(
      `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}/claim`,
      claimBody,
      auth(launchToken),
    ),
    env,
    params: { runId },
  });
  const payload = await response.json();
  return { response, payload };
}

async function startRun(env: any, runId: string, bridgeToken: string, invocationId: string) {
  return onStartRun({
    request: request(
      `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}/start`,
      {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        invocationId,
        startedAt: "2026-06-25T00:00:10.000Z",
      },
      auth(bridgeToken),
    ),
    env,
    params: { runId },
  });
}

async function submitResult(
  env: any,
  runId: string,
  bridgeToken: string,
  invocationId: string,
  agentLine = "QUIET SKY",
) {
  const raw = JSON.stringify({
    schema: THOUGHT_AGENT_RESULT_VERSION,
    agentLine,
  });
  const response = await onSubmitResult({
    request: request(
      `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}/result`,
      {
        protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
        invocationId,
        bridge: {
          bridgeId: "thought-bridge",
          bridgeVersion: "0.1.0",
          installationId: "tb_i_test",
          platform: "darwin-arm64",
        },
        adapter: {
          adapterId: "codex",
          adapterVersion: "0.1.0",
        },
        agent: {
          product: "codex-cli",
          productVersion: "unknown",
          provider: "openai",
          model: "unknown",
          metadataSource: "unknown",
        },
        execution: {
          visibleTurns: 1,
          agentInvocations: 1,
          workspacePolicy: "bridge-owned-empty-temp",
          sandboxPolicy: "read-only",
          approvalPolicy: "never",
          userConfigPolicy: "ignored-where-supported",
        },
        startedAt: "2026-06-25T00:00:10.000Z",
        completedAt: "2026-06-25T00:00:25.000Z",
        output: {
          mediaType: "application/json",
          raw,
          rawSha256: await sha256Hex(raw),
          agentLine,
          agentLineSha256: await sha256Hex(agentLine),
        },
      },
      auth(bridgeToken, { "idempotency-key": invocationId }),
    ),
    env,
    params: { runId },
  });
  const payload = await response.json();
  return { response, payload };
}

describe("THOUGHT Agent Pages API", () => {
  beforeEach(() => {
    globalThis.Response = TestResponse as unknown as typeof Response;
    globalThis.Headers = TestHeaders as unknown as typeof Headers;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: webcrypto.subtle,
        getRandomValues: <T extends ArrayBufferView>(array: T) => randomFillSync(array),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.Response = originalResponse;
    globalThis.Headers = originalHeaders;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    jest.restoreAllMocks();
  });

  test("runs create -> claim -> start -> result -> poll", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const created = await createRun(env);

    expect(created.response.status).toBe(201);
    expect(created.payload.state).toBe("created");
    expect(created.payload.browserToken).toEqual(expect.any(String));
    const launchUrl = new globalThis.URL(created.payload.launchUri);
    const runId = launchUrl.searchParams.get("run_id") ?? "";
    const launchToken = launchUrl.searchParams.get("token") ?? "";
    expect(launchToken).not.toBe("");
    expect(created.payload).not.toHaveProperty("launchToken");

    const claimed = await claimRun(env, runId, launchToken);
    expect(claimed.response.status).toBe(200);
    expect(claimed.payload.request.spec.sha256).toBe(
      `sha256:${THOUGHT_V2_PROTOCOL_RELEASE.spec.sha256}`,
    );
    expect(claimed.payload.request.spec.text).toBe(THOUGHT_V2_PROTOCOL_RELEASE.spec.text);
    expect(claimed.payload.request.agentInput.text).toBe("make a quiet sky");

    const started = await startRun(env, runId, claimed.payload.bridgeToken, "tai_test_run_1");
    expect(started.status).toBe(200);

    const returned = await submitResult(
      env,
      runId,
      claimed.payload.bridgeToken,
      "tai_test_run_1",
      "QUIET SKY",
    );
    expect(returned.response.status).toBe(200);
    expect(returned.payload.state).toBe("returned");
    expect(returned.payload.result.agentLine).toBe("QUIET SKY");
    expect(returned.payload.result.receipt.providerAttested).toBe(false);

    const polled = await onGetRun({
      request: request(
        `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}`,
        {},
        auth(created.payload.browserToken),
      ),
      env,
      params: { runId },
    });
    await expect(polled.json()).resolves.toMatchObject({
      state: "returned",
      request: {
        promptLine: {
          text: "make a quiet sky",
        },
        requestedAgent: {
          adapterId: "codex",
        },
        thoughtSpec: {
          id: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
          contractSpecHash: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecHash,
        },
        agentInput: {
          mediaType: "text/plain; charset=utf-8",
        },
      },
      result: {
        agentLine: "QUIET SKY",
      },
      validation: {
        status: "pending",
      },
    });
  });

  test("survives reviewed-client delay and rebases execution time on claim", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-30T00:00:00.000Z"));
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const created = await createRun(env, "review this client first");
    const launchUrl = new globalThis.URL(created.payload.launchUri);
    const runId = launchUrl.searchParams.get("run_id") ?? "";
    const launchToken = launchUrl.searchParams.get("token") ?? "";

    expect(
      Date.parse(created.payload.claimExpiresAt) - Date.parse(created.payload.createdAt),
    ).toBe(THOUGHT_AGENT_CLAIM_TTL_MS);

    jest.advanceTimersByTime(6 * 60 * 1000);
    const claimedAt = Date.now();
    const claimed = await claimRun(env, runId, launchToken);
    expect(claimed.response.status).toBe(200);
    expect(Date.parse(claimed.payload.runExpiresAt) - claimedAt).toBe(
      THOUGHT_AGENT_RUN_TTL_MS,
    );

    jest.advanceTimersByTime(5 * 60 * 1000);
    const started = await startRun(
      env,
      runId,
      claimed.payload.bridgeToken,
      "tai_delayed_review_run",
    );
    expect(started.status).toBe(200);
  });

  test("expires an unclaimed bearer link and exposes the terminal state to the browser", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const created = await createRun(env, "expire this link");
    const launchUrl = new globalThis.URL(created.payload.launchUri);
    const runId = launchUrl.searchParams.get("run_id") ?? "";
    const launchToken = launchUrl.searchParams.get("token") ?? "";
    const row = d1.rows.get(runId);
    expect(row).toBeDefined();
    row!.claim_expires_at = "2000-01-01T00:00:00.000Z";

    const polled = await onGetRun({
      request: request(
        `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}`,
        {},
        auth(created.payload.browserToken),
      ),
      env,
      params: { runId },
    });
    expect(polled.status).toBe(200);
    await expect(polled.json()).resolves.toMatchObject({
      state: "expired",
      stage: "expired",
    });

    const claim = await onClaimRun({
      request: request(
        `https://thought.inshell.art/api/thought-agent/v1/runs/${runId}/claim`,
        claimBody,
        auth(launchToken),
      ),
      env,
      params: { runId },
    });
    expect(claim.status).toBe(410);
    await expect(claim.json()).resolves.toMatchObject({
      error: { code: "RUN_EXPIRED" },
    });
  });

  test("supports the v2 run route namespace", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const response = await onCreateRunV2({
      request: request(
        "https://thought.inshell.art/api/thought-agent/v2/runs",
        {
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          promptLine: "make a quiet sky",
          specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
          requestedAgent: {
            adapterId: "codex",
            model: null,
          },
          client: {
            surface: "thought-web",
            appVersion: "test",
          },
        },
        {
          origin: "https://thought.inshell.art",
          cookie: "inshell_anon_visitor=visitor-2",
        },
      ),
      env,
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toMatchObject({
      statusUrl: expect.stringMatching(/^\/api\/thought-agent\/v2\/runs\/tar_/),
      client: {
        url: "https://thought.inshell.art/api/thought-agent/v2/client",
        sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
    });
    const clientResponse = onGetCodexClient() as unknown as TestResponse;
    const clientScript = await clientResponse.text();
    expect(await sha256Hex(clientScript)).toBe(payload.client.sha256);
  });

  test("serves the maintained Codex protocol client", async () => {
    const response = onGetCodexClient() as unknown as TestResponse;
    const script = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(script).toContain("THOUGHT_LAUNCH_TOKEN");
    expect(script).toContain("THOUGHT_INPUT_READY");
    expect(script).toContain("THOUGHT_RESULT_OK");
    expect(script).toContain("Idempotency-Key");
    expect(script).not.toContain("test-claim-token");
    expect(script).not.toContain("test-bridge-token");
  });

  test("keeps result submission idempotent and rejects conflicting bytes", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const created = await createRun(env);
    const launchUrl = new globalThis.URL(created.payload.launchUri);
    const runId = launchUrl.searchParams.get("run_id") ?? "";
    const launchToken = launchUrl.searchParams.get("token") ?? "";
    const claimed = await claimRun(env, runId, launchToken);
    await startRun(env, runId, claimed.payload.bridgeToken, "tai_test_run_2");

    const first = await submitResult(env, runId, claimed.payload.bridgeToken, "tai_test_run_2");
    const repeated = await submitResult(env, runId, claimed.payload.bridgeToken, "tai_test_run_2");
    const conflict = await submitResult(
      env,
      runId,
      claimed.payload.bridgeToken,
      "tai_test_run_2",
      "LOUD SKY",
    );

    expect(first.response.status).toBe(200);
    expect(repeated.response.status).toBe(200);
    expect(conflict.response.status).toBe(409);
    expect(conflict.payload.error.code).toBe("RESULT_CONFLICT");
  });

  test("supports cancel and fail terminal states", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const cancelCreated = await createRun(env, "cancel this");
    const cancelRunId = new globalThis.URL(cancelCreated.payload.launchUri).searchParams.get("run_id") ?? "";
    const cancelled = await onCancelRun({
      request: request(
        `https://thought.inshell.art/api/thought-agent/v1/runs/${cancelRunId}/cancel`,
        { protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION },
        auth(cancelCreated.payload.browserToken),
      ),
      env,
      params: { runId: cancelRunId },
    });
    await expect(cancelled.json()).resolves.toMatchObject({ state: "cancelled" });

    const failCreated = await createRun(env, "fail this");
    const failLaunch = new globalThis.URL(failCreated.payload.launchUri);
    const failRunId = failLaunch.searchParams.get("run_id") ?? "";
    const launchToken = failLaunch.searchParams.get("token") ?? "";
    const claimed = await claimRun(env, failRunId, launchToken);
    const failed = await onFailRun({
      request: request(
        `https://thought.inshell.art/api/thought-agent/v1/runs/${failRunId}/fail`,
        {
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          invocationId: "tai_fail_run",
          failedAt: "2026-06-25T00:00:25.000Z",
          error: {
            code: "AGENT_OUTPUT_UNPARSEABLE",
            message: "The agent final response did not match the required schema.",
            retryableTransport: false,
            agentWasInvoked: true,
          },
        },
        auth(claimed.payload.bridgeToken),
      ),
      env,
      params: { runId: failRunId },
    });
    await expect(failed.json()).resolves.toMatchObject({
      state: "failed",
      error: {
        code: "AGENT_OUTPUT_UNPARSEABLE",
      },
    });
  });

  test("rejects unexpected origins before storing a run", async () => {
    const d1 = createD1Mock();
    const env = { INSHELL_CHAIN_DATA_DB: d1.db };
    const response = await onCreateRun({
      request: request(
        "https://thought.inshell.art/api/thought-agent/v1/runs",
        {
          protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
          promptLine: "hello",
          specId: THOUGHT_V2_PROTOCOL_RELEASE.spec.evmSpecId,
          requestedAgent: {
            adapterId: "codex",
            model: null,
          },
        },
        { origin: "https://evil.example" },
      ),
      env,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "ORIGIN_NOT_ALLOWED",
      },
    });
    expect(d1.rows.size).toBe(0);
  });
});

import {
  THOUGHT_AGENT_LINE_CONTRACT,
  THOUGHT_AGENT_OUTPUT_SCHEMA,
  THOUGHT_AGENT_CLAIM_TTL_MS,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_AGENT_RECEIPT_VERSION,
  THOUGHT_AGENT_RUN_TTL_MS,
  THOUGHT_V2_PROTOCOL_RELEASE,
  ThoughtAgentProtocolError,
  assertThoughtLine,
  assertProtocolVersion,
  buildThoughtAgentInput,
  buildThoughtAgentReceipt,
  byteLengthUtf8,
  isTerminalThoughtAgentState,
  isThoughtAgentState,
  isThoughtSha256,
  parseAdapterInfo,
  parseAgentOutput,
  parseBridgeInfo,
  parseCreateRunRequest,
  parseResultRequest,
  sha256Hex,
  type ParsedThoughtAgentOutput,
  type ThoughtAgentAdapterInfo,
  type ThoughtAgentBridgeInfo,
  type ThoughtAgentErrorCode,
  type ThoughtAgentState,
  type ThoughtSha256,
} from "../../../../packages/thought-agent-protocol/src/index";
import { THOUGHT_CODEX_CLIENT_SCRIPT } from "../v2/client-script";
import type { ChainCacheEnv } from "../../chain-cache";
import {
  THOUGHT_AGENT_CONTRACT_SPEC_HASH,
  THOUGHT_AGENT_CONTRACT_SPEC_ID,
  THOUGHT_AGENT_REGISTERED_SPEC_ID,
  THOUGHT_AGENT_REGISTERED_SPEC_REF,
  THOUGHT_AGENT_SPEC_BYTE_LENGTH,
  THOUGHT_AGENT_SPEC_SHA256_HEX,
  THOUGHT_AGENT_SPEC_TEXT,
} from "./thought-spec-source";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  exec?: (query: string) => Promise<unknown>;
  prepare: (query: string) => D1Statement;
};

type ThoughtAgentEnv = ChainCacheEnv & {
  INSHELL_CHAIN_DATA_DB?: D1Database;
  THOUGHT_AGENT_ALLOWED_ORIGINS?: string;
  CF_PAGES_BRANCH?: string;
};

export type ThoughtAgentRouteContext = {
  request: Request;
  env: ThoughtAgentEnv;
  params?: {
    runId?: string;
  };
};

type ThoughtAgentRow = {
  run_id: string;
  protocol_version: string;
  state: ThoughtAgentState;
  web_origin: string;
  visitor_hash: string | null;
  requested_adapter_id: string;
  requested_model: string | null;
  spec_id: string;
  spec_sha256: ThoughtSha256;
  contract_spec_hash: string | null;
  spec_text: string;
  prompt_text: string;
  prompt_sha256: ThoughtSha256;
  agent_input_text: string;
  agent_input_sha256: ThoughtSha256;
  browser_token_hash: ThoughtSha256;
  launch_token_hash: ThoughtSha256 | null;
  bridge_token_hash: ThoughtSha256 | null;
  bridge_metadata_json: string | null;
  adapter_metadata_json: string | null;
  agent_metadata_json: string | null;
  execution_metadata_json: string | null;
  invocation_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  raw_result: string | null;
  raw_result_sha256: ThoughtSha256 | null;
  work_text: string | null;
  work_sha256: ThoughtSha256 | null;
  receipt_json: string | null;
  receipt_sha256: ThoughtSha256 | null;
  error_code: ThoughtAgentErrorCode | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  claim_expires_at: string;
  run_expires_at: string;
  delete_after: string;
};

type ThoughtAgentClaimAuthorizationState = "pending" | "authorized" | "consumed";

type ThoughtAgentClaimAuthorizationRow = {
  claim_request_id: string;
  run_id: string;
  claim_token_hash: ThoughtSha256;
  state: ThoughtAgentClaimAuthorizationState;
  verification_code: string;
  bridge_metadata_json: string;
  adapter_metadata_json: string;
  created_at: string;
  expires_at: string;
  authorized_at: string | null;
  consumed_at: string | null;
};

const CREATE_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS thought_agent_runs (run_id TEXT PRIMARY KEY, protocol_version TEXT NOT NULL, state TEXT NOT NULL, web_origin TEXT NOT NULL, visitor_hash TEXT, requested_adapter_id TEXT NOT NULL, requested_model TEXT, spec_id TEXT NOT NULL, spec_sha256 TEXT NOT NULL, contract_spec_hash TEXT, spec_text TEXT NOT NULL, prompt_text TEXT NOT NULL, prompt_sha256 TEXT NOT NULL, agent_input_text TEXT NOT NULL, agent_input_sha256 TEXT NOT NULL, browser_token_hash TEXT NOT NULL, launch_token_hash TEXT, bridge_token_hash TEXT, bridge_metadata_json TEXT, adapter_metadata_json TEXT, agent_metadata_json TEXT, execution_metadata_json TEXT, invocation_id TEXT, started_at TEXT, completed_at TEXT, raw_result TEXT, raw_result_sha256 TEXT, work_text TEXT, work_sha256 TEXT, receipt_json TEXT, receipt_sha256 TEXT, error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, claim_expires_at TEXT NOT NULL, run_expires_at TEXT NOT NULL, delete_after TEXT NOT NULL)";
const CREATE_STATE_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS thought_agent_runs_state_delete ON thought_agent_runs(state, delete_after)";
const CREATE_VISITOR_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS thought_agent_runs_visitor_created ON thought_agent_runs(visitor_hash, created_at)";
const CREATE_CLAIM_AUTHORIZATIONS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS thought_agent_claim_authorizations (claim_request_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, claim_token_hash TEXT NOT NULL, state TEXT NOT NULL, verification_code TEXT NOT NULL, bridge_metadata_json TEXT NOT NULL, adapter_metadata_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, authorized_at TEXT, consumed_at TEXT)";
const CREATE_CLAIM_AUTHORIZATIONS_RUN_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS thought_agent_claim_authorizations_run_state ON thought_agent_claim_authorizations(run_id, state, expires_at)";

const ensuredDbs = new WeakSet<object>();
const RAW_RESULT_MAX_BYTES = 16 * 1024;
const ACTIVE_RUN_LIMIT = 3;
const CLAIM_AUTHORIZATION_TTL_MS = 2 * 60 * 1000;
const DELETE_AFTER_MS = 24 * 60 * 60 * 1000;

const thoughtAgentApiBase = (request: Request) => {
  const pathname = new globalThis.URL(request.url).pathname;
  return /^\/api\/thought-agent\/v2(?:\/|$)/.test(pathname)
    ? "/api/thought-agent/v2"
    : "/api/thought-agent/v1";
};

export const THOUGHT_AGENT_STATUS = {
  protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
  resultSchema: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult,
  protocolReleaseId: THOUGHT_V2_PROTOCOL_RELEASE.releaseId,
  protocolReleaseCommit: THOUGHT_V2_PROTOCOL_RELEASE.commit,
  protocolReleaseKeccak256:
    THOUGHT_V2_PROTOCOL_RELEASE.protocolReleaseKeccak256,
  deploymentStatus: THOUGHT_V2_PROTOCOL_RELEASE.deployment.status,
  v2MintEnabled: THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled,
  enabled: true,
  runStore: "d1",
  cleanupStatus: "ok",
  supportedAdapters: ["codex"],
  statusError: null,
} as const;

export function onRequestOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, content-type, idempotency-key",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

export async function createRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const body = parseCreateRunRequest(await readJson(ctx.request, 12 * 1024));
    const origin = requireAllowedWebOrigin(ctx);
    const prompt = body.promptLine;
    assertThoughtLine(prompt, "prompt");
    if (body.specId !== THOUGHT_AGENT_REGISTERED_SPEC_ID) {
      throw new HttpProtocolError(404, "SPEC_NOT_FOUND", "THOUGHT spec not found.");
    }
    if (body.requestedAgent.adapterId !== "codex") {
      throw new HttpProtocolError(
        400,
        "ADAPTER_NOT_INSTALLED",
        "Requested adapter is not supported.",
      );
    }

    const specSha256 = await registeredSpecSha256();
    const expectedSpecSha256 = `sha256:${THOUGHT_AGENT_SPEC_SHA256_HEX}`;
    if (
      byteLengthUtf8(THOUGHT_AGENT_SPEC_TEXT) !== THOUGHT_AGENT_SPEC_BYTE_LENGTH ||
      specSha256 !== expectedSpecSha256
    ) {
      throw new HttpProtocolError(
        500,
        "SPEC_HASH_MISMATCH",
        "Registered THOUGHT spec source mismatch.",
      );
    }

    const visitorHash = await readAnonymousVisitorHash(ctx.request);
    if (visitorHash) {
      const activeCount = await activeRunCount(db, visitorHash);
      if (activeCount >= ACTIVE_RUN_LIMIT) {
        throw new HttpProtocolError(
          429,
          "RATE_LIMITED",
          "Too many active THOUGHT Agent runs.",
        );
      }
    }

    const now = new Date();
    const promptSha256 = await sha256Hex(prompt);
    const agentInput = await buildThoughtAgentInput({ promptLine: prompt });
    const runId = `tar_${randomToken(18)}`;
    const browserToken = randomToken(32);
    const launchToken = randomToken(32);
    const browserTokenHash = await sha256Hex(browserToken);
    const launchTokenHash = await sha256Hex(launchToken);
    const createdAt = now.toISOString();
    const claimExpiresAt = new Date(
      now.getTime() + THOUGHT_AGENT_CLAIM_TTL_MS,
    ).toISOString();
    const runExpiresAt = new Date(
      now.getTime() + THOUGHT_AGENT_RUN_TTL_MS,
    ).toISOString();
    const deleteAfter = new Date(now.getTime() + DELETE_AFTER_MS).toISOString();

    await insertRun(db, {
      run_id: runId,
      protocol_version: THOUGHT_AGENT_PROTOCOL_VERSION,
      state: "created",
      web_origin: origin,
      visitor_hash: visitorHash,
      requested_adapter_id: body.requestedAgent.adapterId,
      requested_model: body.requestedAgent.model,
      spec_id: THOUGHT_AGENT_REGISTERED_SPEC_ID,
      spec_sha256: specSha256,
      contract_spec_hash: THOUGHT_AGENT_CONTRACT_SPEC_HASH,
      spec_text: THOUGHT_AGENT_SPEC_TEXT,
      prompt_text: prompt,
      prompt_sha256: promptSha256,
      agent_input_text: agentInput.text,
      agent_input_sha256: agentInput.sha256,
      browser_token_hash: browserTokenHash,
      launch_token_hash: launchTokenHash,
      bridge_token_hash: null,
      bridge_metadata_json: null,
      adapter_metadata_json: null,
      agent_metadata_json: null,
      execution_metadata_json: null,
      invocation_id: null,
      started_at: null,
      completed_at: null,
      raw_result: null,
      raw_result_sha256: null,
      work_text: null,
      work_sha256: null,
      receipt_json: null,
      receipt_sha256: null,
      error_code: null,
      error_message: null,
      created_at: createdAt,
      updated_at: createdAt,
      claim_expires_at: claimExpiresAt,
      run_expires_at: runExpiresAt,
      delete_after: deleteAfter,
    });

    const launchUri = `thought://agent/run?run_id=${encodeURIComponent(
      runId,
    )}&token=${encodeURIComponent(launchToken)}&api_origin=${encodeURIComponent(origin)}`;
    const isV2Run = thoughtAgentApiBase(ctx.request) === "/api/thought-agent/v2";

    return protocolJson(ctx, 201, {
      runId,
      state: "created",
      launchUri,
      browserToken,
      statusUrl: `${thoughtAgentApiBase(ctx.request)}/runs/${runId}`,
      ...(isV2Run
        ? {
            client: {
              url: new globalThis.URL(
                "/api/thought-agent/v2/client",
                ctx.request.url,
              ).toString(),
              sha256: await sha256Hex(THOUGHT_CODEX_CLIENT_SCRIPT),
            },
          }
        : {}),
      createdAt,
      claimExpiresAt,
    });
  });
}

export async function getRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    await verifyToken(ctx.request, current.browser_token_hash);
    return protocolJson(ctx, 200, statusPayload(current));
  });
}

export async function claimRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    if (current.state !== "created") {
      throw new HttpProtocolError(
        current.state === "expired" ? 410 : 409,
        current.state === "expired" ? "RUN_EXPIRED" : "RUN_ALREADY_CLAIMED",
        current.state === "expired"
          ? "THOUGHT Agent run expired."
          : "THOUGHT Agent run is already claimed.",
      );
    }
    if (!current.launch_token_hash) {
      throw new HttpProtocolError(401, "TOKEN_INVALID", "Invalid launch token.");
    }
    await verifyToken(ctx.request, current.launch_token_hash);
    const body = asProtocolObject(await readJson(ctx.request, 8 * 1024));
    assertProtocolVersion(body.protocolVersion);
    const bridge = parseBridgeInfo(body.bridge);
    const adapter = parseAdapterInfo(body.adapter);
    if (adapter.adapterId !== current.requested_adapter_id) {
      throw new HttpProtocolError(
        409,
        "ADAPTER_MISMATCH",
        "Bridge adapter does not match requested adapter.",
      );
    }

    const bridgeToken = randomToken(32);
    const bridgeTokenHash = await sha256Hex(bridgeToken);
    const claimedAt = new Date();
    const updatedAt = claimedAt.toISOString();
    const runExpiresAt = new Date(
      claimedAt.getTime() + THOUGHT_AGENT_RUN_TTL_MS,
    ).toISOString();
    const changed = await updateClaimed(
      db,
      current.run_id,
      current.launch_token_hash,
      bridgeTokenHash,
      JSON.stringify(bridge),
      JSON.stringify(adapter),
      updatedAt,
      runExpiresAt,
    );
    if (!changed) {
      throw new HttpProtocolError(
        409,
        "RUN_ALREADY_CLAIMED",
        "THOUGHT Agent run is already claimed.",
      );
    }
    return protocolJson(ctx, 200, {
      runId: current.run_id,
      state: "claimed",
      bridgeToken,
      runExpiresAt,
      request: claimRequestPayload(current),
    });
  });
}

export async function authorizeClaimRun(
  ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    if (current.state !== "created") {
      throw stateConflict(current.state);
    }
    await verifyToken(ctx.request, current.browser_token_hash);
    const body = asProtocolObject(await readJson(ctx.request, 4 * 1024));
    assertProtocolVersion(body.protocolVersion);
    const claimRequestId = requireRunScopedId(body.claimRequestId, "tac_");
    const authorization = await claimAuthorizationById(
      db,
      current.run_id,
      claimRequestId,
    );
    if (!authorization) {
      throw new HttpProtocolError(404, "RUN_NOT_FOUND", "Claim authorization not found.");
    }
    if (Date.parse(authorization.expires_at) <= Date.now()) {
      throw new HttpProtocolError(410, "TOKEN_EXPIRED", "Claim authorization expired.");
    }
    if (authorization.state === "consumed") {
      throw new HttpProtocolError(409, "RUN_ALREADY_CLAIMED", "Claim authorization was already used.");
    }
    const authorizedAt = authorization.authorized_at ?? new Date().toISOString();
    if (authorization.state === "pending") {
      const changed = await approveClaimAuthorization(
        db,
        authorization.claim_request_id,
        current.run_id,
        authorizedAt,
      );
      if (!changed) {
        throw new HttpProtocolError(409, "RUN_STATE_CONFLICT", "Claim authorization changed.");
      }
    }
    return protocolJson(ctx, 200, {
      runId: current.run_id,
      state: "authorized",
      claimAuthorization: publicClaimAuthorizationPayload({
        ...authorization,
        state: "authorized",
        authorized_at: authorizedAt,
      }),
    });
  });
}

export async function startRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    await verifyBridgeToken(ctx.request, current);
    if (current.state !== "claimed") {
      throw stateConflict(current.state);
    }
    const body = asProtocolObject(await readJson(ctx.request, 4 * 1024));
    assertProtocolVersion(body.protocolVersion);
    const invocationId = requireRunScopedId(body.invocationId, "tai_");
    const startedAt = requireIsoLike(body.startedAt, "startedAt");
    const updatedAt = new Date().toISOString();
    const changed = await updateStarted(
      db,
      current.run_id,
      current.bridge_token_hash,
      invocationId,
      startedAt,
      updatedAt,
    );
    if (!changed) {
      throw stateConflict("running");
    }
    return protocolJson(ctx, 200, {
      runId: current.run_id,
      state: "running",
      invocationId,
      startedAt,
    });
  });
}

export async function submitResult(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    await verifyBridgeToken(ctx.request, current);
    const body = parseResultRequest(await readJson(ctx.request, 24 * 1024));
    const startedAt = requireIsoLike(body.startedAt, "startedAt");
    const completedAt = requireIsoLike(body.completedAt, "completedAt");
    if (Date.parse(completedAt) < Date.parse(startedAt)) {
      throw new HttpProtocolError(
        400,
        "AGENT_OUTPUT_SCHEMA_INVALID",
        "completedAt must not precede startedAt.",
      );
    }
    if (
      current.started_at &&
      Date.parse(current.started_at) !== Date.parse(startedAt)
    ) {
      throw new HttpProtocolError(
        409,
        "RESULT_CONFLICT",
        "Result startedAt does not match the running invocation.",
      );
    }
    const idempotencyKey = ctx.request.headers.get("idempotency-key");
    if (idempotencyKey && idempotencyKey !== body.invocationId) {
      throw new HttpProtocolError(
        409,
        "RESULT_CONFLICT",
        "Idempotency key does not match invocation ID.",
      );
    }

    if (current.state === "returned") {
      const repeatedOutput = await parseAgentOutput(
        body.output.raw,
        RAW_RESULT_MAX_BYTES,
      );
      verifySubmittedOutput(body.output, repeatedOutput);
      if (
        current.invocation_id === body.invocationId &&
        current.raw_result_sha256 === repeatedOutput.rawSha256
      ) {
        return protocolJson(ctx, 200, statusPayload(current));
      }
      throw new HttpProtocolError(
        409,
        "RESULT_CONFLICT",
        "A conflicting result was already accepted for this run.",
      );
    }
    if (current.state !== "running") {
      throw stateConflict(current.state);
    }
    if (current.invocation_id !== body.invocationId) {
      throw new HttpProtocolError(
        409,
        "RESULT_CONFLICT",
        "Result invocation ID does not match the running invocation.",
      );
    }
    if (body.adapter.adapterId !== current.requested_adapter_id) {
      throw new HttpProtocolError(
        409,
        "ADAPTER_MISMATCH",
        "Result adapter does not match requested adapter.",
      );
    }

    const parsedOutput = await parseAgentOutput(
      body.output.raw,
      RAW_RESULT_MAX_BYTES,
    );
    verifySubmittedOutput(body.output, parsedOutput);
    const receipt = await buildThoughtAgentReceipt({
      runId: current.run_id,
      origin: current.web_origin,
      spec: {
        id: current.spec_id,
        sha256: current.spec_sha256,
        contractSpecHash: current.contract_spec_hash,
      },
      promptSha256: current.prompt_sha256,
      agentInputSha256: current.agent_input_sha256,
      adapter: body.adapter,
      agent: body.agent,
      bridge: body.bridge,
      round: {
        visibleTurns: body.execution.visibleTurns,
        agentInvocations: body.execution.agentInvocations,
        automaticRetry: false,
      },
      output: {
        rawSha256: parsedOutput.rawSha256,
        agentLineSha256: parsedOutput.agentLineSha256,
      },
      timing: {
        startedAt,
        completedAt,
      },
    });

    const changed = await updateReturned(db, current.run_id, {
      bridgeTokenHash: current.bridge_token_hash,
      invocationId: body.invocationId,
      bridge: body.bridge,
      adapter: body.adapter,
      agentJson: JSON.stringify(body.agent),
      executionJson: JSON.stringify(body.execution),
      completedAt,
      output: parsedOutput,
      receiptJson: receipt.json,
      receiptSha256: receipt.sha256,
      updatedAt: new Date().toISOString(),
    });
    if (!changed) {
      const refreshed = await requireRun(db, current.run_id);
      if (
        refreshed.state === "returned" &&
        refreshed.invocation_id === body.invocationId &&
        refreshed.raw_result_sha256 === parsedOutput.rawSha256
      ) {
        return protocolJson(ctx, 200, statusPayload(refreshed));
      }
      throw new HttpProtocolError(
        409,
        "RESULT_CONFLICT",
        "A conflicting result was already accepted for this run.",
      );
    }

    const updated = await requireRun(db, current.run_id);
    return protocolJson(ctx, 200, statusPayload(updated));
  });
}

export async function failRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    await verifyBridgeToken(ctx.request, current);
    if (current.state !== "claimed" && current.state !== "running") {
      throw stateConflict(current.state);
    }
    const body = asProtocolObject(await readJson(ctx.request, 8 * 1024));
    assertProtocolVersion(body.protocolVersion);
    const error = asProtocolObject(body.error);
    const code = requireErrorCode(error.code);
    const message = safeMessage(error.message);
    const invocationId =
      body.invocationId === undefined
        ? current.invocation_id
        : requireRunScopedId(body.invocationId, "tai_");
    const failedAt =
      body.failedAt === undefined
        ? new Date().toISOString()
        : requireIsoLike(body.failedAt, "failedAt");
    const changed = await updateFailed(
      db,
      current.run_id,
      current.bridge_token_hash,
      invocationId,
      failedAt,
      code,
      message,
      new Date().toISOString(),
    );
    if (!changed) throw stateConflict(current.state);
    const updated = await requireRun(db, current.run_id);
    return protocolJson(ctx, 200, statusPayload(updated));
  });
}

export async function cancelRun(ctx: ThoughtAgentRouteContext): Promise<Response> {
  return withProtocolErrors(ctx, async () => {
    const db = await getDb(ctx);
    const row = await requireRun(db, runIdFromContext(ctx));
    const current = await expireIfNeeded(db, row);
    await verifyToken(ctx.request, current.browser_token_hash);
    if (isTerminalThoughtAgentState(current.state)) {
      return protocolJson(ctx, 200, statusPayload(current));
    }
    const changed = await updateCancelled(
      db,
      current.run_id,
      current.browser_token_hash,
      new Date().toISOString(),
    );
    if (!changed) throw stateConflict(current.state);
    const updated = await requireRun(db, current.run_id);
    return protocolJson(ctx, 200, statusPayload(updated));
  });
}

export async function cleanupExpiredThoughtAgentRuns(
  env: ThoughtAgentEnv,
  now = new Date(),
): Promise<{ ok: true; deletedBefore: string }> {
  if (!env.INSHELL_CHAIN_DATA_DB) {
    throw new HttpProtocolError(503, "SERVER_UNAVAILABLE", "D1 is not bound.");
  }
  const db = env.INSHELL_CHAIN_DATA_DB;
  await ensureSchema(db);
  const deletedBefore = now.toISOString();
  await db
    .prepare("DELETE FROM thought_agent_claim_authorizations WHERE expires_at < ?1")
    .bind(deletedBefore)
    .run();
  await db
    .prepare("DELETE FROM thought_agent_runs WHERE delete_after < ?1")
    .bind(deletedBefore)
    .run();
  return { ok: true, deletedBefore };
}

async function getDb(ctx: ThoughtAgentRouteContext): Promise<D1Database> {
  const db = ctx.env.INSHELL_CHAIN_DATA_DB;
  if (!db) {
    throw new HttpProtocolError(503, "SERVER_UNAVAILABLE", "D1 is not bound.");
  }
  await ensureSchema(db);
  return db;
}

async function ensureSchema(db: D1Database): Promise<void> {
  if (!db.exec || ensuredDbs.has(db)) return;
  await db.exec(CREATE_TABLE_SQL);
  await db.exec(CREATE_STATE_INDEX_SQL);
  await db.exec(CREATE_VISITOR_INDEX_SQL);
  await db.exec(CREATE_CLAIM_AUTHORIZATIONS_TABLE_SQL);
  await db.exec(CREATE_CLAIM_AUTHORIZATIONS_RUN_INDEX_SQL);
  ensuredDbs.add(db);
}

async function insertRun(db: D1Database, row: ThoughtAgentRow): Promise<void> {
  await db
    .prepare(
      "INSERT INTO thought_agent_runs (run_id, protocol_version, state, web_origin, visitor_hash, requested_adapter_id, requested_model, spec_id, spec_sha256, contract_spec_hash, spec_text, prompt_text, prompt_sha256, agent_input_text, agent_input_sha256, browser_token_hash, launch_token_hash, bridge_token_hash, bridge_metadata_json, adapter_metadata_json, agent_metadata_json, execution_metadata_json, invocation_id, started_at, completed_at, raw_result, raw_result_sha256, work_text, work_sha256, receipt_json, receipt_sha256, error_code, error_message, created_at, updated_at, claim_expires_at, run_expires_at, delete_after) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38)",
    )
    .bind(
      row.run_id,
      row.protocol_version,
      row.state,
      row.web_origin,
      row.visitor_hash,
      row.requested_adapter_id,
      row.requested_model,
      row.spec_id,
      row.spec_sha256,
      row.contract_spec_hash,
      row.spec_text,
      row.prompt_text,
      row.prompt_sha256,
      row.agent_input_text,
      row.agent_input_sha256,
      row.browser_token_hash,
      row.launch_token_hash,
      row.bridge_token_hash,
      row.bridge_metadata_json,
      row.adapter_metadata_json,
      row.agent_metadata_json,
      row.execution_metadata_json,
      row.invocation_id,
      row.started_at,
      row.completed_at,
      row.raw_result,
      row.raw_result_sha256,
      row.work_text,
      row.work_sha256,
      row.receipt_json,
      row.receipt_sha256,
      row.error_code,
      row.error_message,
      row.created_at,
      row.updated_at,
      row.claim_expires_at,
      row.run_expires_at,
      row.delete_after,
    )
    .run();
}

async function requireRun(db: D1Database, runId: string): Promise<ThoughtAgentRow> {
  const raw = await db
    .prepare("SELECT * FROM thought_agent_runs WHERE run_id = ?1")
    .bind(runId)
    .first<Record<string, unknown>>();
  if (!raw) {
    throw new HttpProtocolError(404, "RUN_NOT_FOUND", "THOUGHT Agent run not found.");
  }
  return normalizeRow(raw);
}

async function createClaimAuthorization(
  db: D1Database,
  runId: string,
  bridge: ThoughtAgentBridgeInfo,
  adapter: ThoughtAgentAdapterInfo,
): Promise<{ row: ThoughtAgentClaimAuthorizationRow; token: string }> {
  const now = new Date();
  const token = randomToken(32);
  const row: ThoughtAgentClaimAuthorizationRow = {
    claim_request_id: `tac_${randomToken(18)}`,
    run_id: runId,
    claim_token_hash: await sha256Hex(token),
    state: "pending",
    verification_code: randomVerificationCode(),
    bridge_metadata_json: JSON.stringify(bridge),
    adapter_metadata_json: JSON.stringify(adapter),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CLAIM_AUTHORIZATION_TTL_MS).toISOString(),
    authorized_at: null,
    consumed_at: null,
  };
  await db
    .prepare(
      "INSERT INTO thought_agent_claim_authorizations (claim_request_id, run_id, claim_token_hash, state, verification_code, bridge_metadata_json, adapter_metadata_json, created_at, expires_at, authorized_at, consumed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(
      row.claim_request_id,
      row.run_id,
      row.claim_token_hash,
      row.state,
      row.verification_code,
      row.bridge_metadata_json,
      row.adapter_metadata_json,
      row.created_at,
      row.expires_at,
      row.authorized_at,
      row.consumed_at,
    )
    .run();
  return { row, token };
}

async function activeClaimAuthorization(
  db: D1Database,
  runId: string,
): Promise<ThoughtAgentClaimAuthorizationRow | null> {
  const raw = await db
    .prepare(
      "SELECT * FROM thought_agent_claim_authorizations WHERE run_id = ?1 AND state IN ('pending', 'authorized') AND expires_at > ?2 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(runId, new Date().toISOString())
    .first<Record<string, unknown>>();
  return raw ? normalizeClaimAuthorizationRow(raw) : null;
}

async function claimAuthorizationByToken(
  db: D1Database,
  runId: string,
  claimTokenHash: ThoughtSha256,
): Promise<ThoughtAgentClaimAuthorizationRow | null> {
  const raw = await db
    .prepare(
      "SELECT * FROM thought_agent_claim_authorizations WHERE run_id = ?1 AND claim_token_hash = ?2 LIMIT 1",
    )
    .bind(runId, claimTokenHash)
    .first<Record<string, unknown>>();
  return raw ? normalizeClaimAuthorizationRow(raw) : null;
}

async function claimAuthorizationById(
  db: D1Database,
  runId: string,
  claimRequestId: string,
): Promise<ThoughtAgentClaimAuthorizationRow | null> {
  const raw = await db
    .prepare(
      "SELECT * FROM thought_agent_claim_authorizations WHERE run_id = ?1 AND claim_request_id = ?2 LIMIT 1",
    )
    .bind(runId, claimRequestId)
    .first<Record<string, unknown>>();
  return raw ? normalizeClaimAuthorizationRow(raw) : null;
}

async function approveClaimAuthorization(
  db: D1Database,
  claimRequestId: string,
  runId: string,
  authorizedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_claim_authorizations SET state = 'authorized', authorized_at = ?3 WHERE claim_request_id = ?1 AND run_id = ?2 AND state = 'pending'",
    )
    .bind(claimRequestId, runId, authorizedAt)
    .run();
  return changed(result);
}

async function consumeClaimAuthorization(
  db: D1Database,
  claimRequestId: string,
  consumedAt: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE thought_agent_claim_authorizations SET state = 'consumed', consumed_at = ?2 WHERE claim_request_id = ?1 AND state = 'authorized'",
    )
    .bind(claimRequestId, consumedAt)
    .run();
}

function claimMetadataMatches(
  authorization: ThoughtAgentClaimAuthorizationRow,
  bridge: ThoughtAgentBridgeInfo,
  adapter: ThoughtAgentAdapterInfo,
): boolean {
  return (
    authorization.bridge_metadata_json === JSON.stringify(bridge) &&
    authorization.adapter_metadata_json === JSON.stringify(adapter)
  );
}

function publicClaimAuthorizationPayload(
  authorization: ThoughtAgentClaimAuthorizationRow,
): Record<string, unknown> {
  const bridge = JSON.parse(authorization.bridge_metadata_json) as ThoughtAgentBridgeInfo;
  const adapter = JSON.parse(authorization.adapter_metadata_json) as ThoughtAgentAdapterInfo;
  return {
    state: authorization.state,
    claimRequestId: authorization.claim_request_id,
    verificationCode: authorization.verification_code,
    bridge: {
      bridgeId: bridge.bridgeId,
      platform: bridge.platform,
    },
    adapter: {
      adapterId: adapter.adapterId,
      adapterVersion: adapter.adapterVersion,
    },
    requestedAt: authorization.created_at,
    expiresAt: authorization.expires_at,
    authorizedAt: authorization.authorized_at,
  };
}

function normalizeClaimAuthorizationRow(
  raw: Record<string, unknown>,
): ThoughtAgentClaimAuthorizationRow {
  const state = raw.state;
  if (state !== "pending" && state !== "authorized" && state !== "consumed") {
    throw new HttpProtocolError(500, "SERVER_UNAVAILABLE", "Invalid claim authorization state.");
  }
  return {
    claim_request_id: stringField(raw.claim_request_id),
    run_id: stringField(raw.run_id),
    claim_token_hash: shaField(raw.claim_token_hash),
    state,
    verification_code: stringField(raw.verification_code),
    bridge_metadata_json: stringField(raw.bridge_metadata_json),
    adapter_metadata_json: stringField(raw.adapter_metadata_json),
    created_at: stringField(raw.created_at),
    expires_at: stringField(raw.expires_at),
    authorized_at: nullableString(raw.authorized_at),
    consumed_at: nullableString(raw.consumed_at),
  };
}

async function updateClaimed(
  db: D1Database,
  runId: string,
  launchTokenHash: ThoughtSha256,
  bridgeTokenHash: ThoughtSha256,
  bridgeMetadataJson: string,
  adapterMetadataJson: string,
  updatedAt: string,
  runExpiresAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'claimed', launch_token_hash = NULL, bridge_token_hash = ?3, bridge_metadata_json = ?4, adapter_metadata_json = ?5, updated_at = ?6, run_expires_at = ?7 WHERE run_id = ?1 AND state = 'created' AND launch_token_hash = ?2 AND bridge_token_hash IS NULL",
    )
    .bind(
      runId,
      launchTokenHash,
      bridgeTokenHash,
      bridgeMetadataJson,
      adapterMetadataJson,
      updatedAt,
      runExpiresAt,
    )
    .run();
  return changed(result);
}

async function updateStarted(
  db: D1Database,
  runId: string,
  bridgeTokenHash: ThoughtSha256 | null,
  invocationId: string,
  startedAt: string,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'running', invocation_id = ?2, started_at = ?3, updated_at = ?4 WHERE run_id = ?1 AND state = 'claimed' AND bridge_token_hash = ?5 AND invocation_id IS NULL",
    )
    .bind(runId, invocationId, startedAt, updatedAt, bridgeTokenHash)
    .run();
  return changed(result);
}

async function updateReturned(
  db: D1Database,
  runId: string,
  input: {
    bridgeTokenHash: ThoughtSha256 | null;
    invocationId: string;
    bridge: ThoughtAgentBridgeInfo;
    adapter: ThoughtAgentAdapterInfo;
    agentJson: string;
    executionJson: string;
    completedAt: string;
    output: ParsedThoughtAgentOutput;
    receiptJson: string;
    receiptSha256: ThoughtSha256;
    updatedAt: string;
  },
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'returned', bridge_metadata_json = ?2, adapter_metadata_json = ?3, agent_metadata_json = ?4, execution_metadata_json = ?5, completed_at = ?6, raw_result = ?7, raw_result_sha256 = ?8, work_text = ?9, work_sha256 = ?10, receipt_json = ?11, receipt_sha256 = ?12, updated_at = ?13 WHERE run_id = ?1 AND state = 'running' AND bridge_token_hash = ?14 AND invocation_id = ?15 AND raw_result_sha256 IS NULL",
    )
    .bind(
      runId,
      JSON.stringify(input.bridge),
      JSON.stringify(input.adapter),
      input.agentJson,
      input.executionJson,
      input.completedAt,
      input.output.raw,
      input.output.rawSha256,
      input.output.agentLine,
      input.output.agentLineSha256,
      input.receiptJson,
      input.receiptSha256,
      input.updatedAt,
      input.bridgeTokenHash,
      input.invocationId,
    )
    .run();
  return changed(result);
}

async function updateFailed(
  db: D1Database,
  runId: string,
  bridgeTokenHash: ThoughtSha256 | null,
  invocationId: string | null,
  failedAt: string,
  errorCode: ThoughtAgentErrorCode,
  errorMessage: string,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'failed', invocation_id = COALESCE(invocation_id, ?2), completed_at = ?3, error_code = ?4, error_message = ?5, updated_at = ?6 WHERE run_id = ?1 AND state IN ('claimed', 'running') AND bridge_token_hash = ?7",
    )
    .bind(
      runId,
      invocationId,
      failedAt,
      errorCode,
      errorMessage,
      updatedAt,
      bridgeTokenHash,
    )
    .run();
  return changed(result);
}

async function updateCancelled(
  db: D1Database,
  runId: string,
  browserTokenHash: ThoughtSha256,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'cancelled', updated_at = ?3 WHERE run_id = ?1 AND browser_token_hash = ?2 AND state IN ('created', 'claimed', 'running')",
    )
    .bind(runId, browserTokenHash, updatedAt)
    .run();
  return changed(result);
}

async function updateExpired(
  db: D1Database,
  runId: string,
  state: ThoughtAgentState,
  updatedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE thought_agent_runs SET state = 'expired', updated_at = ?3 WHERE run_id = ?1 AND state = ?2",
    )
    .bind(runId, state, updatedAt)
    .run();
  return changed(result);
}

async function activeRunCount(
  db: D1Database,
  visitorHash: ThoughtSha256,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS active_count FROM thought_agent_runs WHERE visitor_hash = ?1 AND state IN ('created', 'claimed', 'running')",
    )
    .bind(visitorHash)
    .first<{ active_count?: number }>();
  const value = Number(row?.active_count ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function expireIfNeeded(
  db: D1Database,
  row: ThoughtAgentRow,
): Promise<ThoughtAgentRow> {
  if (isTerminalThoughtAgentState(row.state)) return row;
  const nowMs = Date.now();
  const deadline =
    row.state === "created"
      ? Date.parse(row.claim_expires_at)
      : Date.parse(row.run_expires_at);
  if (Number.isFinite(deadline) && nowMs >= deadline) {
    await updateExpired(db, row.run_id, row.state, new Date(nowMs).toISOString());
    return {
      ...row,
      state: "expired",
      updated_at: new Date(nowMs).toISOString(),
    };
  }
  return row;
}

function statusPayload(row: ThoughtAgentRow): Record<string, unknown> {
  const base: Record<string, unknown> = {
    runId: row.run_id,
    state: row.state,
    stage: stageForState(row.state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.state === "created" ? row.claim_expires_at : row.run_expires_at,
    request: {
      promptLine: {
        text: row.prompt_text,
        sha256: row.prompt_sha256,
      },
      requestedAgent: {
        adapterId: row.requested_adapter_id,
        model: row.requested_model,
      },
      thoughtSpec: {
        id: row.spec_id,
        ref: THOUGHT_AGENT_REGISTERED_SPEC_REF,
        sha256: row.spec_sha256,
        contractSpecHash: row.contract_spec_hash,
      },
      agentInput: {
        mediaType: "text/plain; charset=utf-8",
        text: row.agent_input_text,
        sha256: row.agent_input_sha256,
      },
    },
  };
  if (row.state === "returned") {
    const agentMetadata = receiptAgentMetadata(row.agent_metadata_json);
    base.result = {
      raw: row.raw_result,
      agentLine: row.work_text,
      receipt: {
        receiptVersion: THOUGHT_AGENT_RECEIPT_VERSION,
        receiptSha256: row.receipt_sha256,
        adapterId: row.requested_adapter_id,
        model: agentMetadata.model,
        reasoningEffort: agentMetadata.reasoningEffort,
        metadataSource: agentMetadata.metadataSource,
        providerAttested: false,
      },
    };
    base.validation = {
      status: "pending",
      canonicalText: null,
      error: null,
    };
  }
  if (row.state === "failed") {
    base.error = {
      code: row.error_code,
      message: row.error_message,
    };
  }
  return base;
}

function claimRequestPayload(row: ThoughtAgentRow): Record<string, unknown> {
  return {
    intent: "generate-thought-candidate",
    requestedAgent: {
      adapterId: row.requested_adapter_id,
      model: row.requested_model,
    },
    roundPolicy: {
      maxAgentInvocations: 1,
      maxVisibleTurns: 1,
      allowClarification: false,
      allowFollowUp: false,
      allowAutomaticAgentRetry: false,
    },
    spec: {
      id: row.spec_id,
      ref: THOUGHT_AGENT_REGISTERED_SPEC_REF,
      contractSpecId: THOUGHT_AGENT_CONTRACT_SPEC_ID,
      mediaType: "text/markdown; charset=utf-8",
      text: row.spec_text,
      sha256: row.spec_sha256,
      contractSpecHash: row.contract_spec_hash,
    },
    instructions: {
      mediaType: "text/markdown; charset=utf-8",
      text: row.spec_text,
      sha256: row.spec_sha256,
    },
    promptLine: {
      text: row.prompt_text,
      sha256: row.prompt_sha256,
    },
    agentInput: {
      mediaType: "text/plain; charset=utf-8",
      text: row.agent_input_text,
      sha256: row.agent_input_sha256,
    },
    outputContract: {
      mediaType: "application/json",
      maxRawBytes: RAW_RESULT_MAX_BYTES,
      resultSchema: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult,
      agentLine: THOUGHT_AGENT_LINE_CONTRACT,
      schema: THOUGHT_AGENT_OUTPUT_SCHEMA,
    },
  };
}

function stageForState(state: ThoughtAgentState): string {
  switch (state) {
    case "created":
      return "waiting-for-bridge";
    case "claimed":
      return "bridge-claimed";
    case "running":
      return "agent-running";
    case "returned":
      return "returned";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
  }
}

function receiptAgentMetadata(agentJson: string | null): {
  model: string;
  reasoningEffort: string | null;
  metadataSource: string;
} {
  if (!agentJson) {
    return {
      model: "unknown",
      reasoningEffort: null,
      metadataSource: "unknown",
    };
  }
  try {
    const parsed = JSON.parse(agentJson) as {
      model?: unknown;
      reasoningEffort?: unknown;
      metadataSource?: unknown;
    };
    return {
      model:
        typeof parsed.model === "string" && parsed.model.length > 0
          ? parsed.model
          : "unknown",
      reasoningEffort:
        typeof parsed.reasoningEffort === "string" &&
        parsed.reasoningEffort.length > 0
          ? parsed.reasoningEffort
          : null,
      metadataSource:
        typeof parsed.metadataSource === "string" &&
        parsed.metadataSource.length > 0
          ? parsed.metadataSource
          : "unknown",
    };
  } catch {
    return {
      model: "unknown",
      reasoningEffort: null,
      metadataSource: "unknown",
    };
  }
}

function verifySubmittedOutput(
  submitted: {
    raw: string;
    rawSha256: string;
    agentLine: string;
    agentLineSha256: string;
  },
  parsed: ParsedThoughtAgentOutput,
): void {
  if (
    submitted.raw !== parsed.raw ||
    submitted.agentLine !== parsed.agentLine ||
    !isThoughtSha256(submitted.rawSha256) ||
    !isThoughtSha256(submitted.agentLineSha256) ||
    submitted.rawSha256 !== parsed.rawSha256 ||
    submitted.agentLineSha256 !== parsed.agentLineSha256
  ) {
    throw new HttpProtocolError(
      409,
      "RESULT_HASH_MISMATCH",
      "Submitted result hashes do not match exact bytes.",
    );
  }
}

async function verifyBridgeToken(
  request: Request,
  row: ThoughtAgentRow,
): Promise<void> {
  if (!row.bridge_token_hash) {
    throw new HttpProtocolError(401, "TOKEN_INVALID", "Invalid token.");
  }
  await verifyToken(request, row.bridge_token_hash);
}

async function verifyToken(
  request: Request,
  expectedHash: ThoughtSha256,
): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpProtocolError(401, "TOKEN_INVALID", "Missing bearer token.");
  }
  const actualHash = await sha256Hex(token);
  if (!constantTimeEqual(actualHash, expectedHash)) {
    throw new HttpProtocolError(401, "TOKEN_INVALID", "Invalid token.");
  }
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

function requireAllowedWebOrigin(ctx: ThoughtAgentRouteContext): string {
  const requestUrl = new globalThis.URL(ctx.request.url);
  const originHeader = ctx.request.headers.get("origin")?.trim();
  const origin = originHeader ? new globalThis.URL(originHeader).origin : requestUrl.origin;
  if (!isAllowedOrigin(origin, ctx.env)) {
    throw new HttpProtocolError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "THOUGHT Agent origin is not allowed.",
    );
  }
  return origin;
}

function isAllowedOrigin(origin: string, env: ThoughtAgentEnv): boolean {
  if (origin === "https://inshell.art") return true;
  if (origin === "https://thought.inshell.art") return true;
  if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return true;
  if (
    env.CF_PAGES_BRANCH &&
    env.CF_PAGES_BRANCH !== "main" &&
    (origin === "https://preview.inshell.art" ||
      origin === "https://thought.preview.inshell.art" ||
      origin === "https://staging.thought-inshell-art.pages.dev")
  ) {
    return true;
  }
  const configured = String(env.THOUGHT_AGENT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin);
}

async function readAnonymousVisitorHash(
  request: Request,
): Promise<ThoughtSha256 | null> {
  const cookie = readCookie(request, "inshell_anon_visitor");
  return cookie ? sha256Hex(`thought-agent-visitor:${cookie}`) : null;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const segment of header.split(";")) {
    const [key, ...rest] = segment.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function protocolJson(
  ctx: ThoughtAgentRouteContext,
  status: number,
  body: Record<string, unknown>,
): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  const origin = ctx.request.headers.get("origin");
  if (origin && isAllowedOrigin(new globalThis.URL(origin).origin, ctx.env)) {
    headers["Access-Control-Allow-Origin"] = new globalThis.URL(origin).origin;
    headers.Vary = "Origin";
  }
  return new Response(
    JSON.stringify({
      protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
      ...body,
    }),
    { status, headers },
  );
}

async function withProtocolErrors(
  ctx: ThoughtAgentRouteContext,
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpProtocolError) {
      return protocolJson(ctx, error.status, {
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    if (error instanceof ThoughtAgentProtocolError) {
      return protocolJson(ctx, 400, {
        error: {
          code: error.code,
          message: error.message,
        },
      });
    }
    return protocolJson(ctx, 500, {
      error: {
        code: "SERVER_UNAVAILABLE",
        message: "THOUGHT Agent API failed.",
      },
    });
  }
}

class HttpProtocolError extends Error {
  readonly status: number;
  readonly code: ThoughtAgentErrorCode;

  constructor(status: number, code: ThoughtAgentErrorCode, message: string) {
    super(message);
    this.name = "HttpProtocolError";
    this.status = status;
    this.code = code;
  }
}

function stateConflict(state: ThoughtAgentState): HttpProtocolError {
  return new HttpProtocolError(
    state === "expired" ? 410 : 409,
    state === "expired" ? "RUN_EXPIRED" : "RUN_STATE_CONFLICT",
    state === "expired"
      ? "THOUGHT Agent run expired."
      : "THOUGHT Agent run is not in the required state.",
  );
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const text = await request.text();
  if (byteLengthUtf8(text) > maxBytes) {
    throw new HttpProtocolError(413, "RESULT_TOO_LARGE", "Request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpProtocolError(400, "AGENT_OUTPUT_UNPARSEABLE", "Invalid JSON body.");
  }
}

function asProtocolObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpProtocolError(400, "AGENT_OUTPUT_SCHEMA_INVALID", "Invalid request.");
  }
  return value as Record<string, unknown>;
}

function requireRunScopedId(value: unknown, prefix: string): string {
  if (typeof value !== "string" || !new RegExp(`^${prefix}[A-Za-z0-9_-]{8,}$`).test(value)) {
    throw new HttpProtocolError(400, "AGENT_OUTPUT_SCHEMA_INVALID", "Invalid run-scoped ID.");
  }
  return value;
}

function requireIsoLike(value: unknown, field: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new HttpProtocolError(
      400,
      "AGENT_OUTPUT_SCHEMA_INVALID",
      `Invalid ${field}.`,
    );
  }
  return value;
}

function requireErrorCode(value: unknown): ThoughtAgentErrorCode {
  if (
    typeof value !== "string" ||
    ![
      "ADAPTER_NOT_INSTALLED",
      "ADAPTER_VERSION_UNSUPPORTED",
      "AGENT_AUTH_REQUIRED",
      "AGENT_START_FAILED",
      "AGENT_TIMEOUT",
      "AGENT_CANCELLED",
      "AGENT_OUTPUT_MISSING",
      "AGENT_OUTPUT_UNPARSEABLE",
      "AGENT_OUTPUT_SCHEMA_INVALID",
      "RESULT_TOO_LARGE",
      "RESULT_HASH_MISMATCH",
      "RESULT_CONFLICT",
    ].includes(value)
  ) {
    return "AGENT_START_FAILED";
  }
  return value as ThoughtAgentErrorCode;
}

function safeMessage(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "The agent run failed.";
  }
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

function runIdFromContext(ctx: ThoughtAgentRouteContext): string {
  const value = ctx.params?.runId;
  if (typeof value !== "string" || !/^tar_[A-Za-z0-9_-]{8,}$/.test(value)) {
    throw new HttpProtocolError(404, "RUN_NOT_FOUND", "THOUGHT Agent run not found.");
  }
  return value;
}

function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomVerificationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function changed(result: unknown): boolean {
  const maybe = result as { meta?: { changes?: unknown } };
  if (typeof maybe?.meta?.changes === "number") {
    return maybe.meta.changes > 0;
  }
  return true;
}

function normalizeRow(raw: Record<string, unknown>): ThoughtAgentRow {
  const state = raw.state;
  if (!isThoughtAgentState(state)) {
    throw new HttpProtocolError(500, "SERVER_UNAVAILABLE", "Invalid run state.");
  }
  return {
    run_id: stringField(raw.run_id),
    protocol_version: stringField(raw.protocol_version),
    state,
    web_origin: stringField(raw.web_origin),
    visitor_hash: nullableString(raw.visitor_hash),
    requested_adapter_id: stringField(raw.requested_adapter_id),
    requested_model: nullableString(raw.requested_model),
    spec_id: stringField(raw.spec_id),
    spec_sha256: shaField(raw.spec_sha256),
    contract_spec_hash: nullableString(raw.contract_spec_hash),
    spec_text: stringField(raw.spec_text),
    prompt_text: stringField(raw.prompt_text),
    prompt_sha256: shaField(raw.prompt_sha256),
    agent_input_text: stringField(raw.agent_input_text),
    agent_input_sha256: shaField(raw.agent_input_sha256),
    browser_token_hash: shaField(raw.browser_token_hash),
    launch_token_hash: nullableSha(raw.launch_token_hash),
    bridge_token_hash: nullableSha(raw.bridge_token_hash),
    bridge_metadata_json: nullableString(raw.bridge_metadata_json),
    adapter_metadata_json: nullableString(raw.adapter_metadata_json),
    agent_metadata_json: nullableString(raw.agent_metadata_json),
    execution_metadata_json: nullableString(raw.execution_metadata_json),
    invocation_id: nullableString(raw.invocation_id),
    started_at: nullableString(raw.started_at),
    completed_at: nullableString(raw.completed_at),
    raw_result: nullableString(raw.raw_result),
    raw_result_sha256: nullableSha(raw.raw_result_sha256),
    work_text: nullableString(raw.work_text),
    work_sha256: nullableSha(raw.work_sha256),
    receipt_json: nullableString(raw.receipt_json),
    receipt_sha256: nullableSha(raw.receipt_sha256),
    error_code: nullableErrorCode(raw.error_code),
    error_message: nullableString(raw.error_message),
    created_at: stringField(raw.created_at),
    updated_at: stringField(raw.updated_at),
    claim_expires_at: stringField(raw.claim_expires_at),
    run_expires_at: stringField(raw.run_expires_at),
    delete_after: stringField(raw.delete_after),
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function shaField(value: unknown): ThoughtSha256 {
  if (!isThoughtSha256(value)) {
    throw new HttpProtocolError(500, "SERVER_UNAVAILABLE", "Invalid stored hash.");
  }
  return value;
}

function nullableSha(value: unknown): ThoughtSha256 | null {
  return isThoughtSha256(value) ? value : null;
}

function nullableErrorCode(value: unknown): ThoughtAgentErrorCode | null {
  return typeof value === "string" ? (value as ThoughtAgentErrorCode) : null;
}

async function registeredSpecSha256(): Promise<ThoughtSha256> {
  return sha256Hex(THOUGHT_AGENT_SPEC_TEXT);
}

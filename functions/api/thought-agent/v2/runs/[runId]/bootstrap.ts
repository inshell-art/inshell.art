import {
  THOUGHT_AGENT_CONTROL_VERSION,
  THOUGHT_AGENT_PROTOCOL_VERSION,
  THOUGHT_CODEX_BOOTSTRAP_SCHEMA,
  THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
  THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE,
  THOUGHT_V2_PROTOCOL_RELEASE,
  buildThoughtCodexTransportWorkerConfigText,
  sha256Hex,
} from "../../../../../../packages/thought-agent-protocol/src/index";
import { onRequestOptions } from "../../../v1/shared";

type BootstrapContext = {
  request: Request;
  params?: { runId?: string | string[] };
};

const headers = (body: string) => ({
  "cache-control": "no-store",
  "content-length": new TextEncoder().encode(body).byteLength.toString(),
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
});

const errorResponse = (status: number, code: string, message: string) => {
  const body = JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    error: { code, message },
  });
  return new Response(body, { status, headers: headers(body) });
};

export async function onRequestGet(ctx: BootstrapContext) {
  const runId = Array.isArray(ctx.params?.runId)
    ? ctx.params?.runId[0]
    : ctx.params?.runId;
  if (!runId || !/^tar_[A-Za-z0-9_-]{8,}$/.test(runId)) {
    return errorResponse(404, "RUN_NOT_FOUND", "THOUGHT run not found.");
  }

  const requestUrl = new URL(ctx.request.url);
  const runUrl = `${requestUrl.origin}/api/thought-agent/v2/runs/${runId}`;
  const configText = buildThoughtCodexTransportWorkerConfigText({
    product: "Codex",
    runId,
    runUrl,
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    controlVersion: THOUGHT_AGENT_CONTROL_VERSION,
    resultVersion: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.agentResult,
    workProfile: THOUGHT_V2_PROTOCOL_RELEASE.identifiers.workProfile,
    declarationLabelField: "label",
    release: THOUGHT_V2_PROTOCOL_RELEASE.release,
  });
  const configSha256 = await sha256Hex(configText);
  const body = JSON.stringify({
    schema: THOUGHT_CODEX_BOOTSTRAP_SCHEMA,
    worker: {
      mediaType: "application/javascript",
      sha256: THOUGHT_CODEX_TRANSPORT_WORKER_SHA256,
      source: THOUGHT_CODEX_TRANSPORT_WORKER_SOURCE,
    },
    config: {
      mediaType: "application/json",
      sha256: configSha256,
      text: configText,
    },
  });
  return new Response(body, { status: 200, headers: headers(body) });
}

export { onRequestOptions };

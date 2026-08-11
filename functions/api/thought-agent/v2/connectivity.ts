import { THOUGHT_AGENT_STATUS } from "../v1/shared";

const headers = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function onRequestGet() {
  return new Response(JSON.stringify({
    schema: "inshell.thought.agent-connectivity.v1",
    status: "reachable",
    protocolVersion: THOUGHT_AGENT_STATUS.protocolVersion,
  }), {
    status: 200,
    headers,
  });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "cache-control": "no-store",
    },
  });
}

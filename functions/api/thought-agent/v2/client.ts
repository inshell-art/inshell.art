import { THOUGHT_CODEX_CLIENT_SCRIPT } from "./client-script";

const responseHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "text/plain; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function onRequestGet() {
  return new Response(THOUGHT_CODEX_CLIENT_SCRIPT, {
    status: 200,
    headers: responseHeaders,
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

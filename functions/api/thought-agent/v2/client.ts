import { buildThoughtCodexClientScript } from "../../../../packages/thought-agent-protocol/src/index";

const responseHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "text/plain; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function onRequestGet() {
  return new Response(buildThoughtCodexClientScript(), {
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

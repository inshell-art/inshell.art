const responseHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

export function onRequestGet() {
  return new Response(JSON.stringify({
    error: {
      code: "PROTOCOL_UNSUPPORTED",
      message: "This compatibility client is retired. Open the Agent task from THOUGHT.",
    },
  }), {
    status: 410,
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

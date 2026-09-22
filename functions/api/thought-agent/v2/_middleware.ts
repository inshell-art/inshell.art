import { THOUGHT_AGENT_PROTOCOL_VERSION } from "../../../../packages/thought-agent-protocol/src/index";

type RouteContext = {
  request: Request;
  next: () => Promise<Response>;
};

// Pages falls through to static assets when a function has no matching method.
// Keep this API namespace closed so an Access exception cannot expose the SPA.
// Match Pages' single optional trailing slash, without decoding path segments.
const routes: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/^\/api\/thought-agent\/v2\/(?:connectivity|client)\/?$/, ["GET", "OPTIONS"]],
  [/^\/api\/thought-agent\/v2\/runs\/?$/, ["POST", "OPTIONS"]],
  [/^\/api\/thought-agent\/v2\/runs\/tar_[A-Za-z0-9_-]{8,}\/?$/, ["GET", "OPTIONS"]],
  [/^\/api\/thought-agent\/v2\/runs\/tar_[A-Za-z0-9_-]{8,}\/(?:claim|ready|start|fail|cancel|claim-authorization)\/?$/, ["POST", "OPTIONS"]],
  [/^\/api\/thought-agent\/v2\/runs\/tar_[A-Za-z0-9_-]{8,}\/result\/?$/, ["PUT", "OPTIONS"]],
];

export function onRequest(ctx: RouteContext): Promise<Response> | Response {
  const pathname = new globalThis.URL(ctx.request.url).pathname;
  const route = routes.find(([pattern]) => pattern.test(pathname));
  if (route && route[1].includes(ctx.request.method)) return ctx.next();

  const status = route ? 405 : 404;
  return new Response(ctx.request.method === "HEAD" ? null : JSON.stringify({
    protocolVersion: THOUGHT_AGENT_PROTOCOL_VERSION,
    error: {
      code: route ? "METHOD_NOT_ALLOWED" : "ROUTE_NOT_FOUND",
      message: route ? "Method not allowed." : "THOUGHT Agent API route not found.",
    },
  }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(route ? { allow: route[1].join(", ") } : {}),
    },
  });
}

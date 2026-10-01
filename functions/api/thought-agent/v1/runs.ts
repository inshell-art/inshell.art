import {
  onRequestOptions,
  type ThoughtAgentRouteContext,
} from "./shared";

export { onRequestOptions };

export async function onRequestPost(
  _ctx: ThoughtAgentRouteContext,
): Promise<Response> {
  // Existing run handlers stay available under their existing authorization.
  // No new legacy row, task, bootstrap or credential may be issued.
  return new Response(JSON.stringify({ error: {
    code: "LEGACY_CREATION_RETIRED", message: "Open /thought to create a new work.",
  } }), { status: 410, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  } });
}

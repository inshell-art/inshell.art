import type { PagesContextLike } from "../chain-cache";
import {
  AnalyticsInputError,
  analyticsJson,
  analyticsOptions,
  readAnalyticsRequest,
  recordAnalyticsEvent,
} from "./store";

export const onRequestOptions = analyticsOptions;

export async function onRequestPost(ctx: PagesContextLike): Promise<Response> {
  try {
    const payload = await readAnalyticsRequest(ctx.request);
    const result = await recordAnalyticsEvent(ctx.env, ctx.request, payload);
    return analyticsJson(200, result);
  } catch (error) {
    if (error instanceof AnalyticsInputError) {
      return analyticsJson(error.status, {
        ok: false,
        error: error.message,
      });
    }
    return analyticsJson(503, {
      ok: false,
      error: safeErrorMessage(error),
    });
  }
}

export async function onRequestGet(): Promise<Response> {
  return analyticsJson(405, {
    ok: false,
    error: "Use POST for analytics events.",
  });
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/([?&](?:api[_-]?key|key|token)=)[^&\s]+/gi, "$1<redacted>")
    .slice(0, 180);
}

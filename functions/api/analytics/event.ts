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
    const { setCookies, ...body } = result;
    return analyticsJson(200, body, { setCookies });
  } catch (error) {
    if (error instanceof AnalyticsInputError) {
      return analyticsJson(error.status, {
        ok: false,
        error: error.message,
      });
    }
    return analyticsJson(503, {
      ok: false,
      error: "Analytics event ingest failed.",
    });
  }
}

export async function onRequestGet(): Promise<Response> {
  return analyticsJson(405, {
    ok: false,
    error: "Use POST for analytics events.",
  });
}

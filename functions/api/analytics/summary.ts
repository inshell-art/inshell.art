import type { PagesContextLike } from "../chain-cache";
import {
  analyticsHostScopeForHostname,
  analyticsJson,
  analyticsOptions,
  isAnalyticsReadAuthorized,
  readAnalyticsSummary,
} from "./store";

export const onRequestOptions = analyticsOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  if (!isAnalyticsReadAuthorized(ctx.request, ctx.env)) {
    return analyticsJson(401, {
      ok: false,
      error: "Unauthorized.",
    });
  }

  try {
    const url = new globalThis.URL(ctx.request.url);
    const days = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
    return analyticsJson(
      200,
      await readAnalyticsSummary(ctx.env, days, analyticsHostScopeForHostname(url.hostname)),
    );
  } catch {
    return analyticsJson(503, {
      ok: false,
      error: "Analytics summary unavailable.",
    });
  }
}

export async function onRequestPost(): Promise<Response> {
  return analyticsJson(405, {
    ok: false,
    error: "Use GET for analytics summary.",
  });
}

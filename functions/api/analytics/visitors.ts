import type { PagesContextLike } from "../chain-cache";
import {
  analyticsHostScopeForHostname,
  analyticsJson,
  analyticsOptions,
  isAnalyticsReadAuthorized,
  readAnalyticsVisitors,
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
    const days = Number.parseInt(url.searchParams.get("days") ?? "1", 10);
    const visitorRankRaw = url.searchParams.get("visitorRank");
    const visitorRank = visitorRankRaw == null ? undefined : Number.parseInt(visitorRankRaw, 10);
    return analyticsJson(
      200,
      await readAnalyticsVisitors(
        ctx.env,
        days,
        analyticsHostScopeForHostname(url.hostname),
        visitorRank,
      ),
    );
  } catch {
    return analyticsJson(503, {
      ok: false,
      error: "Analytics visitors unavailable.",
    });
  }
}

export async function onRequestPost(): Promise<Response> {
  return analyticsJson(405, {
    ok: false,
    error: "Use GET for analytics visitors.",
  });
}

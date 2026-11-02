import type { PagesContextLike } from "../chain-cache";
import { analyticsJson } from "./store.ts";

// Cached old clients get no cookies, IDs or D1 writes. Historical reads remain.
export async function onRequest(_ctx?: PagesContextLike): Promise<Response> {
  return analyticsJson(410, { ok: false, code: "ANALYTICS_RETIRED", stored: false });
}
export const onRequestGet = onRequest;
export const onRequestPost = onRequest;
export const onRequestOptions = onRequest;

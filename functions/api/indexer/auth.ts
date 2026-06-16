import type { PagesContextLike } from "../chain-cache";

export function isIndexerAuthorized(ctx: PagesContextLike) {
  const expected = ctx.env.INSHELL_INDEXER_REFRESH_TOKEN?.trim();
  if (!expected) return false;
  const auth = ctx.request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const header = ctx.request.headers.get("x-inshell-indexer-token")?.trim();
  return bearer === expected || header === expected;
}

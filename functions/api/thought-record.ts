import { onRequestGet as onThoughtGalleryGet } from "./thought-gallery";
import { json, onOptions, type PagesContextLike, type ThoughtGalleryApiItem } from "./chain-cache";

type ThoughtGalleryPayload = {
  thoughts?: ThoughtGalleryApiItem[];
};

export const onRequestOptions = onOptions;

export async function findThoughtRecord(ctx: PagesContextLike): Promise<ThoughtGalleryApiItem | Response> {
  const id = new globalThis.URL(ctx.request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(id)) {
    return json(400, { error: "invalid THOUGHT id" });
  }

  const galleryResponse = await onThoughtGalleryGet(ctx);
  if (!galleryResponse.ok) {
    return json(502, { error: "thought gallery unavailable" });
  }

  const payload = (await galleryResponse.json()) as ThoughtGalleryPayload;
  const thought = payload.thoughts?.find((item) => String(item.tokenId) === id) ?? null;
  if (!thought) {
    return json(404, { error: "THOUGHT not found", id });
  }
  return thought;
}

export function thoughtJsonResponse(body: unknown, cacheSeconds = 60) {
  return json(200, body, cacheSeconds);
}

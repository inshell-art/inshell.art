import { findThoughtRecord, onRequestOptions, thoughtJsonResponse } from "./thought-record";
import { json, type PagesContextLike } from "./chain-cache";

export { onRequestOptions };

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const thought = await findThoughtRecord(ctx);
  if (thought instanceof Response) return thought;
  if (!thought.provenanceJson) {
    return json(404, { error: "THOUGHT provenance unavailable", id: thought.tokenId });
  }

  try {
    return thoughtJsonResponse(JSON.parse(thought.provenanceJson) as unknown);
  } catch {
    return new Response(thought.provenanceJson, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=240",
      },
    });
  }
}

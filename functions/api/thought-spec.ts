import { findThoughtRecord, onRequestOptions, thoughtJsonResponse } from "./thought-record";
import type { PagesContextLike } from "./chain-cache";

export { onRequestOptions };

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const thought = await findThoughtRecord(ctx);
  if (thought instanceof Response) return thought;

  return thoughtJsonResponse({
    ref: "THOUGHT.v1.md",
    specId: thought.thoughtSpecId,
    specHash: thought.thoughtSpecHash,
  });
}

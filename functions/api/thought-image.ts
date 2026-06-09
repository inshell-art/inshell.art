import { findThoughtRecord, onRequestOptions } from "./thought-record";
import { parseImageRequest, svgFromImageSource, svgImageResponse } from "./image-response";
import { type PagesContextLike } from "./chain-cache";

export { onRequestOptions };

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const request = parseImageRequest(ctx.request.url);
  if (request instanceof Response) return request;

  const thought = await findThoughtRecord(ctx);
  if (thought instanceof Response) return thought;

  return svgImageResponse(
    svgFromImageSource(thought.image) ?? svgFromImageSource(thought.tokenUri),
    `inshell-thought-${request.id}.svg`,
  );
}

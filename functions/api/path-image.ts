import { onRequestGet as onPathTokensGet, onRequestOptions } from "./path-tokens";
import {
  json,
  tokenImage,
  type PagesContextLike,
  type PathTokenApiItem,
} from "./chain-cache";
import { parseImageRequest, svgFromImageSource, svgImageResponse } from "./image-response";

type PathTokensPayload = {
  items?: PathTokenApiItem[];
};

export { onRequestOptions };

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const request = parseImageRequest(ctx.request.url);
  if (request instanceof Response) return request;

  const tokensResponse = await onPathTokensGet(ctx);
  if (!tokensResponse.ok) {
    return json(502, { error: "PATH tokens unavailable" });
  }

  const payload = (await tokensResponse.json()) as PathTokensPayload;
  const token = payload.items?.find(
    (item) => item.tokenId === request.id || item.tokenIdLabel === request.id,
  );
  if (!token) {
    return json(404, { error: "PATH token not found", id: request.id });
  }

  const metadata = token.metadata ?? {};
  return svgImageResponse(
    svgFromImageSource(metadata.image_data) ??
      svgFromImageSource(metadata.image) ??
      svgFromImageSource(tokenImage(token.tokenUri, metadata)),
    `inshell-path-${request.id}.svg`,
  );
}

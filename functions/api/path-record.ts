import { onRequestGet as onPathTokensGet } from "./path-tokens";
import { json, onOptions, type PagesContextLike, type PathTokenApiItem } from "./chain-cache";

type PathTokensPayload = {
  cachedAt?: number;
  chainId?: number;
  contract?: string;
  fromBlock?: number;
  lastScannedBlock?: number;
  items?: PathTokenApiItem[];
};

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const id = new globalThis.URL(ctx.request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(id)) {
    return json(400, { error: "invalid $PATH id" });
  }

  const collectionResponse = await onPathTokensGet(ctx);
  if (!collectionResponse.ok) {
    return json(502, { error: "$PATH collection unavailable" });
  }

  const payload = (await collectionResponse.json()) as PathTokensPayload;
  const token = payload.items?.find((item) => item.tokenId === id) ?? null;
  if (!token) {
    return json(404, { error: "$PATH not found", id });
  }

  return json(
    200,
    {
      schema: "inshell.path.public-record.v1",
      authority: {
        kind: "chain-observation",
        chainId: payload.chainId ?? null,
        contract: payload.contract ?? null,
        observedAtBlock: payload.lastScannedBlock ?? token.blockNumber ?? null,
        cachedAt: payload.cachedAt ?? null,
      },
      token,
    },
    60,
  );
}

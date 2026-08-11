import { onRequestGet as onPathTokensGet } from "./path-tokens";
import {
  copyChainCacheDiagnosticHeaders,
  json,
  onOptions,
  type PagesContextLike,
  type PathTokenApiItem,
} from "./chain-cache";
import { createPublicRecord } from "./public-record";
import pathReleaseLock from "../../packages/contracts/src/path-release/consumer-lock.json";

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
    return copyChainCacheDiagnosticHeaders(
      collectionResponse,
      json(404, { error: "$PATH not found", id }),
    );
  }

  const response = json(
    200,
    createPublicRecord({
      schema: "inshell.path.public-record.v1",
      chainObservation: {
        kind: "chain-observation",
        chainId: payload.chainId ?? null,
        contract: payload.contract ?? null,
        observedAtBlock: payload.lastScannedBlock ?? token.blockNumber ?? null,
        transactionHash: token.txHash ?? null,
      },
      cache: {
        kind: "indexed-chain-cache",
        cachedAt: payload.cachedAt ?? null,
      },
      consumerRelease: {
        kind: "contract-release-consumer",
        deploymentRecordsCoupled: pathReleaseLock.deploymentRecordsCoupled,
        releaseTag: pathReleaseLock.releaseTag,
        manifestSha256: pathReleaseLock.manifestSha256,
      },
      token,
    }),
    60,
  );
  return copyChainCacheDiagnosticHeaders(collectionResponse, response);
}

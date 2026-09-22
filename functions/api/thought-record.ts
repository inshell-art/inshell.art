import { onRequestGet as onThoughtGalleryGet } from "./thought-gallery";
import {
  copyChainCacheDiagnosticHeaders,
  json,
  onOptions,
  type PagesContextLike,
  type ThoughtGalleryApiItem,
} from "./chain-cache";
import { createPublicRecord } from "./public-record";

type ThoughtGalleryPayload = {
  artifactId?: string;
  cachedAt?: number;
  chainId?: number;
  contract?: string;
  fromBlock?: number;
  lastScannedBlock?: number;
  manifestSha256?: string;
  thoughts?: ThoughtGalleryApiItem[];
};

type ThoughtRecordLookup = {
  galleryResponse: Response;
  payload: ThoughtGalleryPayload;
  thought: ThoughtGalleryApiItem;
};

export const onRequestOptions = onOptions;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const lookup = await loadThoughtRecord(ctx);
  if (lookup instanceof Response) return lookup;
  const { galleryResponse, payload, thought } = lookup;

  const response = thoughtJsonResponse(createPublicRecord({
    schema: "inshell.thought.public-record.v1",
    chainObservation: {
      kind: "chain-observation",
      chainId: payload.chainId ?? null,
      contract: payload.contract ?? null,
      observedAtBlock: payload.lastScannedBlock ?? thought.blockNumber ?? null,
      transactionHash: thought.txHash ?? null,
    },
    cache: {
      kind: "indexed-chain-cache",
      cachedAt: payload.cachedAt ?? null,
    },
    consumerRelease: {
      kind: "contract-release-consumer",
      deploymentRecordsCoupled: true,
      couplingSource: "production-deployment-lock",
      artifactId: payload.artifactId ?? null,
      manifestSha256: payload.manifestSha256 ?? null,
    },
    token: thought,
  }));
  return copyChainCacheDiagnosticHeaders(galleryResponse, response);
}

export async function findThoughtRecord(ctx: PagesContextLike): Promise<ThoughtGalleryApiItem | Response> {
  const lookup = await loadThoughtRecord(ctx);
  return lookup instanceof Response ? lookup : lookup.thought;
}

async function loadThoughtRecord(ctx: PagesContextLike): Promise<ThoughtRecordLookup | Response> {
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
    return copyChainCacheDiagnosticHeaders(
      galleryResponse,
      json(404, { error: "THOUGHT not found", id }),
    );
  }
  return { galleryResponse, payload, thought };
}

export function thoughtJsonResponse(body: unknown, cacheSeconds = 60) {
  return json(200, body, cacheSeconds);
}

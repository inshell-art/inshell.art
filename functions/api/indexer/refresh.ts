import {
  createChainCacheDiagnostics,
  createStats,
  emitUsage,
  isTxHash,
  json,
  onOptions,
  readSafeChainFailure,
  withChainCacheDiagnostics,
  type ChainCacheDiagnostics,
  type IndexedSnapshot,
  type PagesContextLike,
  type RefreshProgress,
} from "../chain-cache";
import { refreshPathTokensBounded } from "../path-tokens";
import { refreshPulseAuctionBounded, refreshPulseAuctionForTx } from "../pulse-auction";
import { refreshThoughtGalleryBounded } from "../thought-gallery";
import { isIndexerAuthorized } from "./auth";

type RefreshTarget = "pulse-auction" | "path-tokens" | "thought-gallery" | "all";

const ALL_TARGET_MAX_LOG_CHUNKS = 6;

type RefreshResult = {
  target: Exclude<RefreshTarget, "all">;
  cachedAt: number;
  lastScannedBlock: number;
  items: number;
  source: string;
  complete?: boolean;
  partial?: boolean;
  scannedFromBlock?: number;
  scannedToBlock?: number;
  latestBlock?: number;
  remainingBlocks?: number;
  maxBlocks?: number;
};

export const onRequestOptions = onOptions;

export async function onRequestPost(ctx: PagesContextLike): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  const body = await readJsonBody(ctx.request);
  const target = readString(body.target) || url.searchParams.get("target") || "all";
  const txHash = readString(body.tx) || url.searchParams.get("tx") || "";
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    return json(400, { error: "invalid refresh target" });
  }

  const targetedPublicRefresh =
    normalizedTarget === "pulse-auction" && isTxHash(txHash);
  const authorized = isIndexerAuthorized(ctx);
  if (!targetedPublicRefresh && !authorized) {
    return json(401, { error: "indexer refresh token required" });
  }

  const results: RefreshResult[] = [];
  const diagnostics: ChainCacheDiagnostics[] = [];
  const statsList: ReturnType<typeof createStats>[] = [];
  const snapshots: IndexedSnapshot<unknown>[] = [];
  const boundedOptions = normalizedTarget === "all"
    ? { maxLogChunks: ALL_TARGET_MAX_LOG_CHUNKS }
    : {};
  let activeTarget: Exclude<RefreshTarget, "all"> | null = null;
  let activeStats: ReturnType<typeof createStats> | null = null;
  try {
    if (normalizedTarget === "pulse-auction" || normalizedTarget === "all") {
      activeTarget = "pulse-auction";
      const currentDiagnostics = createChainCacheDiagnostics("pulse-auction:v1:sepolia");
      const stats = createStats("path", "indexer-refresh:pulse-auction", ctx.env);
      activeStats = stats;
      const outcome = targetedPublicRefresh
        ? {
          snapshot: await refreshPulseAuctionForTx(ctx, stats, currentDiagnostics, txHash),
          progress: undefined,
        }
        : await refreshPulseAuctionBounded(ctx, stats, currentDiagnostics, boundedOptions);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(outcome.snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("pulse-auction", outcome.snapshot, currentDiagnostics, outcome.progress));
    }

    if (normalizedTarget === "path-tokens" || normalizedTarget === "all") {
      activeTarget = "path-tokens";
      const currentDiagnostics = createChainCacheDiagnostics("path-tokens:v1:sepolia");
      const stats = createStats("path", "indexer-refresh:path-tokens", ctx.env);
      activeStats = stats;
      const outcome = await refreshPathTokensBounded(ctx, stats, currentDiagnostics, boundedOptions);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(outcome.snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("path-tokens", outcome.snapshot, currentDiagnostics, outcome.progress));
    }

    if (normalizedTarget === "thought-gallery" || normalizedTarget === "all") {
      activeTarget = "thought-gallery";
      const currentDiagnostics = createChainCacheDiagnostics("thought-gallery:v1:sepolia");
      const stats = createStats("thought", "indexer-refresh:thought-gallery", ctx.env);
      activeStats = stats;
      const outcome = await refreshThoughtGalleryBounded(ctx, stats, currentDiagnostics, boundedOptions);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(outcome.snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("thought-gallery", outcome.snapshot, currentDiagnostics, outcome.progress));
    }
  } catch (error) {
    for (const stats of statsList) emitUsage(ctx, stats);
    if (activeStats && !statsList.includes(activeStats)) emitUsage(ctx, activeStats);
    return json(500, {
      error: "indexer refresh failed",
      diagnostics: authorized
        ? readSafeChainFailure(error, {
          target: activeTarget ?? normalizedTarget,
          stage: "refresh",
          upstreamLabel: activeStats?.upstreamLabel,
        })
        : undefined,
    });
  }

  const response = json(200, {
    ok: true,
    target: normalizedTarget,
    tx: txHash || undefined,
    results,
  });
  const firstDiagnostics = diagnostics[0];
  if (!firstDiagnostics) return response;
  return withChainCacheDiagnostics(
    ctx,
    response,
    firstDiagnostics,
    statsList[0],
    snapshots[0],
  );
}

function normalizeTarget(value: string): RefreshTarget | null {
  if (
    value === "pulse-auction" ||
    value === "path-tokens" ||
    value === "thought-gallery" ||
    value === "all"
  ) {
    return value;
  }
  return null;
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) return {};
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resultFor<T>(
  target: Exclude<RefreshTarget, "all">,
  snapshot: IndexedSnapshot<T>,
  diagnostics: ChainCacheDiagnostics,
  progress?: RefreshProgress,
): RefreshResult {
  return {
    target,
    cachedAt: snapshot.cachedAt,
    lastScannedBlock: snapshot.lastScannedBlock,
    items: snapshot.items.length,
    source: diagnostics.source,
    complete: progress?.complete,
    partial: progress ? !progress.complete : undefined,
    scannedFromBlock: progress?.fromBlock,
    scannedToBlock: progress?.toBlock,
    latestBlock: progress?.latestBlock,
    remainingBlocks: progress?.remainingBlocks,
    maxBlocks: progress?.maxBlocks,
  };
}

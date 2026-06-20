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
} from "../chain-cache";
import { refreshPathTokens } from "../path-tokens";
import { refreshPulseAuction, refreshPulseAuctionForTx } from "../pulse-auction";
import { refreshThoughtGallery } from "../thought-gallery";
import { isIndexerAuthorized } from "./auth";

type RefreshTarget = "pulse-auction" | "path-tokens" | "thought-gallery" | "all";

type RefreshResult = {
  target: Exclude<RefreshTarget, "all">;
  cachedAt: number;
  lastScannedBlock: number;
  items: number;
  source: string;
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
  let activeTarget: Exclude<RefreshTarget, "all"> | null = null;
  let activeStats: ReturnType<typeof createStats> | null = null;
  try {
    if (normalizedTarget === "pulse-auction" || normalizedTarget === "all") {
      activeTarget = "pulse-auction";
      const currentDiagnostics = createChainCacheDiagnostics("pulse-auction:v1:sepolia");
      const stats = createStats("path", "indexer-refresh:pulse-auction", ctx.env);
      activeStats = stats;
      const snapshot = targetedPublicRefresh
        ? await refreshPulseAuctionForTx(ctx, stats, currentDiagnostics, txHash)
        : await refreshPulseAuction(ctx, stats, currentDiagnostics);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("pulse-auction", snapshot, currentDiagnostics));
    }

    if (normalizedTarget === "path-tokens" || normalizedTarget === "all") {
      activeTarget = "path-tokens";
      const currentDiagnostics = createChainCacheDiagnostics("path-tokens:v1:sepolia");
      const stats = createStats("path", "indexer-refresh:path-tokens", ctx.env);
      activeStats = stats;
      const snapshot = await refreshPathTokens(ctx, stats, currentDiagnostics);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("path-tokens", snapshot, currentDiagnostics));
    }

    if (normalizedTarget === "thought-gallery" || normalizedTarget === "all") {
      activeTarget = "thought-gallery";
      const currentDiagnostics = createChainCacheDiagnostics("thought-gallery:v1:sepolia");
      const stats = createStats("thought", "indexer-refresh:thought-gallery", ctx.env);
      activeStats = stats;
      const snapshot = await refreshThoughtGallery(ctx, stats, currentDiagnostics);
      emitUsage(ctx, stats);
      diagnostics.push(currentDiagnostics);
      statsList.push(stats);
      snapshots.push(snapshot as IndexedSnapshot<unknown>);
      results.push(resultFor("thought-gallery", snapshot, currentDiagnostics));
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
): RefreshResult {
  return {
    target,
    cachedAt: snapshot.cachedAt,
    lastScannedBlock: snapshot.lastScannedBlock,
    items: snapshot.items.length,
    source: diagnostics.source,
  };
}

import { useEffect, useRef, useState } from "react";
import type { EthereumBlockTag, ProviderInterface } from "@inshell/ethereum";
import { createCoreService } from "@/services/auction/coreService";
import type { AuctionSnapshot } from "@/types/types";

const AUCTION_CORE_CACHE_TTL_MS = 4_000;

type AuctionCoreCacheEntry = {
  cachedAt: number;
  data: AuctionSnapshot;
};

const auctionCoreCache = new Map<string, AuctionCoreCacheEntry>();

function auctionCoreCacheKey(opts?: {
  address?: string;
  provider?: ProviderInterface;
  blockId?: any;
}) {
  if (!opts?.address || opts.provider) {
    return "";
  }
  return [
    "auction-core",
    "v1",
    opts.address.toLowerCase(),
    String(opts.blockId ?? "latest").toLowerCase(),
  ].join(":");
}

function readAuctionCoreCache(key: string) {
  if (!key) return null;
  const cached = auctionCoreCache.get(key);
  if (!cached || Date.now() - cached.cachedAt > AUCTION_CORE_CACHE_TTL_MS) {
    if (cached) auctionCoreCache.delete(key);
    return null;
  }
  return cached.data;
}

function writeAuctionCoreCache(key: string, data: AuctionSnapshot) {
  if (!key) return;
  auctionCoreCache.set(key, {
    cachedAt: Date.now(),
    data,
  });
}

export function useAuctionCore(opts?: {
  address?: string;
  provider?: ProviderInterface;
  refreshMs?: number; // default 4000ms
  enabled?: boolean; // default true
  blockId?: any; // optional; if you expose block pinning
}) {
  const address = opts?.address;
  const provider = opts?.provider;
  const blockId = opts?.blockId;
  const refreshMs = opts?.refreshMs ?? 4000;
  const enabled = opts?.enabled ?? true;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [data, setData] = useState<AuctionSnapshot | null>(null);

  const serviceRef = useRef<ReturnType<typeof createCoreService> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const cacheKeyRef = useRef("");

  // Build the domain service once per config change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cacheKey = auctionCoreCacheKey({ address, provider, blockId });
        const cached = readAuctionCoreCache(cacheKey);
        cacheKeyRef.current = cacheKey;
        setReady(false);
        setError(null);
        if (cached) {
          setData(cached);
          setLoading(false);
        } else {
          setData(null);
          setLoading(true);
        }
        inFlightRef.current = null;
        serviceRef.current = createCoreService({
          address,
          provider,
          blockId: blockId as number | EthereumBlockTag | undefined,
        });
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      inFlightRef.current = null;
      serviceRef.current = null;
    };
  }, [address, provider, blockId]);

  // One-off fetch
  const fetchOnce = async () => {
    if (!serviceRef.current) return;
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    const service = serviceRef.current;
    const requestBody = async () => {
      setError(null);
      try {
        const snap = await service.snapshot();
        if (serviceRef.current === service) {
          writeAuctionCoreCache(cacheKeyRef.current, snap);
          setData(snap);
        }
      } catch (e) {
        if (serviceRef.current === service) {
          setError(e);
        }
      } finally {
        if (serviceRef.current === service) {
          setLoading(false);
        }
      }
    };
    const request = requestBody().finally(() => {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    });
    inFlightRef.current = request;
    return request;
  };

  // Poll
  useEffect(() => {
    if (!enabled || !ready) return;
    fetchOnce();

    if (refreshMs > 0) {
      const id = window.setInterval(fetchOnce, refreshMs);
      return () => {
        window.clearInterval(id);
      };
    }
  }, [enabled, ready, refreshMs]);

  return { data, loading, error, ready, refresh: fetchOnce };
}

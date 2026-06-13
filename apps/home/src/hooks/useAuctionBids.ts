import { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderInterface } from "@inshell/ethereum";
import {
  createBidsService,
  type NormalizedBid,
} from "@/services/auction/bidsService";

export function useAuctionBids(opts: {
  address: string;
  provider?: ProviderInterface;
  fromBlock?: number;
  refreshMs?: number; // default 4000ms if provided; no polling when undefined or 0
  enabled?: boolean; // default true
  maxBids?: number;
  chunkSize?: number;
  reorgDepth?: number;
  preferCacheApi?: boolean;
  allowDirectFallback?: boolean;
}) {
  const enabled = opts.enabled ?? true;
  const refreshMs = opts.refreshMs ?? 0;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [bids, setBids] = useState<NormalizedBid[]>([]);

  const serviceRef = useRef<ReturnType<typeof createBidsService> | null>(null);
  const inFlightRef = useRef<Promise<NormalizedBid[]> | null>(null);

  // Build the service on config change
  useEffect(() => {
    setError(null);
    setLoading(true);
    try {
      inFlightRef.current = null;
      serviceRef.current = createBidsService({
        address: opts.address,
        provider: opts.provider,
        fromBlock: opts.fromBlock,
        maxBids: opts.maxBids,
        chunkSize: opts.chunkSize,
        reorgDepth: opts.reorgDepth,
        preferCacheApi: opts.preferCacheApi,
        allowDirectFallback: opts.allowDirectFallback,
      });
      setReady(true);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
    return () => {
      inFlightRef.current = null;
      serviceRef.current = null;
    };
  }, [
    opts.address,
    opts.provider,
    opts.fromBlock,
    opts.maxBids,
    opts.chunkSize,
    opts.reorgDepth,
    opts.preferCacheApi,
    opts.allowDirectFallback,
  ]);

  // Subscribe to updates
  useEffect(() => {
    if (!serviceRef.current) return;
    const off = serviceRef.current.onBids((snapshot) => {
      // We trust service ordering; set snapshot for simplicity
      setBids(snapshot);
    });
    return () => {
      off?.();
    };
  }, [ready]);

  const pullOnce = useMemo(() => {
    return async () => {
      if (!serviceRef.current) return [] as NormalizedBid[];
      if (inFlightRef.current) return inFlightRef.current;
      const service = serviceRef.current;
      setError(null);
      const request = service
        .pullOnce()
        .then((out) => out)
        .catch((e) => {
          if (serviceRef.current === service) {
            setError(e);
          }
          return [] as NormalizedBid[];
        })
        .finally(() => {
          if (inFlightRef.current === request) {
            inFlightRef.current = null;
          }
        });
      inFlightRef.current = request;
      return request;
    };
  }, []);

  // Kick off an initial fetch when ready even if polling is disabled.
  useEffect(() => {
    if (!enabled || !ready || !serviceRef.current) return;
    let cancelled = false;
    setLoading(true);
    void pullOnce()
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, ready, pullOnce]);

  // Optional polling
  useEffect(() => {
    if (!enabled || !ready || !serviceRef.current || !refreshMs) return;
    const id = window.setInterval(
      () => void pullOnce(),
      refreshMs
    );
    return () => window.clearInterval(id);
  }, [enabled, ready, refreshMs, pullOnce]);

  return { bids, loading, error, ready, pullOnce };
}

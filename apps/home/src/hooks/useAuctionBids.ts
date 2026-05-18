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
}) {
  const enabled = opts.enabled ?? true;
  const refreshMs = opts.refreshMs ?? 0;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [bids, setBids] = useState<NormalizedBid[]>([]);

  const serviceRef = useRef<ReturnType<typeof createBidsService> | null>(null);

  // Build the service on config change
  useEffect(() => {
    setError(null);
    setLoading(true);
    try {
      serviceRef.current = createBidsService({
        address: opts.address,
        provider: opts.provider,
        fromBlock: opts.fromBlock,
        maxBids: opts.maxBids,
        chunkSize: opts.chunkSize,
        reorgDepth: opts.reorgDepth,
      });
      setReady(true);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
    return () => {
      serviceRef.current = null;
    };
  }, [
    opts.address,
    opts.provider,
    opts.fromBlock,
    opts.maxBids,
    opts.chunkSize,
    opts.reorgDepth,
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

  // Kick off an initial fetch when ready even if polling is disabled.
  useEffect(() => {
    if (!enabled || !ready || !serviceRef.current) return;
    let cancelled = false;
    setLoading(true);
    void serviceRef.current
      .pullOnce()
      .catch((e) => {
        if (!cancelled) setError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, ready]);

  const pullOnce = useMemo(() => {
    return async () => {
      if (!serviceRef.current) return [] as NormalizedBid[];
      try {
        setError(null);
        const out = await serviceRef.current.pullOnce();
        return out;
      } catch (e) {
        setError(e);
        return [] as NormalizedBid[];
      }
    };
  }, []);

  // Optional polling
  useEffect(() => {
    if (!enabled || !ready || !serviceRef.current || !refreshMs) return;
    const id = window.setInterval(
      () =>
        void serviceRef.current?.pullOnce().catch((e) => {
          setError(e);
        }),
      refreshMs
    );
    return () => window.clearInterval(id);
  }, [enabled, ready, refreshMs]);

  return { bids, loading, error, ready, pullOnce };
}

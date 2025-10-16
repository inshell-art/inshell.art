import { useEffect, useRef, useState } from "react";
import type { ProviderInterface } from "starknet";
import { createAuctionService } from "@/services/auctionService";
import { AbiSource } from "@/types/types";
import type { AuctionSnapshot } from "@/types/types";

export function useAuction(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
  refreshMs?: number; // default 4000ms
  enabled?: boolean; // default true
  blockId?: any; // optional; if you expose block pinning
}) {
  const refreshMs = opts?.refreshMs ?? 4000;
  const enabled = opts?.enabled ?? true;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [data, setData] = useState<AuctionSnapshot | null>(null);

  const serviceRef = useRef<ReturnType<typeof createAuctionService> | null>(
    null
  );

  // Build the domain service once per config change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        serviceRef.current = createAuctionService({
          address: opts?.address,
          provider: opts?.provider,
          blockId: opts?.blockId,
          abiSource: opts?.abiSource as AbiSource,
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
    };
  }, [opts?.address, opts?.provider, opts?.blockId, opts?.abiSource]);

  // One-off fetch
  const fetchOnce = async () => {
    if (!serviceRef.current) return;
    try {
      setError(null);
      const snap = await serviceRef.current.snapshot();
      setData(snap);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
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

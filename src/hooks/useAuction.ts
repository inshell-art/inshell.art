import { useEffect, useRef, useState } from "react";
import type { ProviderInterface } from "starknet";
import {
  createAuctionService,
  type AuctionSnapshot,
} from "@/services/auctionService";

export function useAuction(opts?: {
  provider?: ProviderInterface;
  address?: string;
  abiSource?: "artifact" | "node" | "auto";
  refreshMs?: number;
  enabled?: boolean;
}) {
  const refreshMs = opts?.refreshMs ?? 4000;
  const enabled = opts?.enabled ?? true;

  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AuctionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const serviceRef = useRef<Awaited<
    ReturnType<typeof createAuctionService>
  > | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        serviceRef.current = await createAuctionService({
          blockTag: "latest",
          provider: opts?.provider,
          address: opts?.address,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.provider, opts?.address, opts?.abiSource]);

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

  useEffect(() => {
    if (!enabled || !ready) return;
    fetchOnce();
    if (refreshMs > 0) {
      // @ts-ignore DOM typings
      timerRef.current = window.setInterval(fetchOnce, refreshMs);
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, refreshMs]);

  return { data, loading, error, refresh: fetchOnce, ready };
}

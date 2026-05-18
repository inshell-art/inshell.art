import { useEffect, useRef, useState } from "react";
import type { EthereumBlockTag, ProviderInterface } from "@inshell/ethereum";
import { createCoreService } from "@/services/auction/coreService";
import type { AuctionSnapshot } from "@/types/types";

export function useAuctionCore(opts?: {
  address?: string;
  provider?: ProviderInterface;
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

  const serviceRef = useRef<ReturnType<typeof createCoreService> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  // Build the domain service once per config change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setReady(false);
        setError(null);
        setLoading(true);
        inFlightRef.current = null;
        serviceRef.current = createCoreService({
          address: opts?.address,
          provider: opts?.provider,
          blockId: opts?.blockId as number | EthereumBlockTag | undefined,
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
  }, [opts?.address, opts?.provider, opts?.blockId]);

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

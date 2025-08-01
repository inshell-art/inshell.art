import { useQuery } from "@tanstack/react-query";
import * as pulseServices from "@/services/pulseAuction";
import { Sale } from "@/types/sale";

/* ---------- constants ---------- */
const POLL_FAST = 12_000; // 12 s   – live info (price, active, now)
const POLL_SLOW = 30_000; // 30 s   – one‑off deployment check

/* ---------- enum ---------- */
export enum AuctionStatus {
  PREDEPLOY = "PREDEPLOY",
  COUNTDOWN = "COUNTDOWN",
  GENESIS = "GENESIS",
  LIVE = "LIVE",
}

/* ---------- single‑responsibility hooks ---------- */

/** one‑time check: has the contract been declared & deployed? */
export const useIsDeployed = () =>
  useQuery({
    queryKey: ["isDeployed"],
    queryFn: async () => {
      const isDeployed = await pulseServices.isDeployed();
      return isDeployed;
    },
    refetchInterval: POLL_SLOW,
    staleTime: POLL_SLOW,
  });

/** immutable constructor params (k, open_time, genesis_price, floor₀) */
export const useInitParams = () =>
  useQuery({
    queryKey: ["initParams"],
    queryFn: pulseServices.fetchInitParams,
    enabled: useIsDeployed().data === true,
    staleTime: Infinity,
  });

/** chain‑time “now” (seconds since epoch) */
export const useNow = () =>
  useQuery({
    queryKey: ["now"],
    queryFn: pulseServices.fetchNow,
    enabled: useIsDeployed().data === true,
    refetchInterval: POLL_FAST,
  });

/** whether curve_active storage flag is true */
export const useCurveActive = () =>
  useQuery({
    queryKey: ["curveActive"],
    queryFn: pulseServices.fetchCurveActive,
    enabled: useIsDeployed().data === true,
    refetchInterval: POLL_FAST,
  });

/** current ask price (u256 → bigint) */
export const useCurrentPrice = () => {
  const deployed = useIsDeployed().data;
  const now = useNow().data;
  const openTime = useInitParams().data?.open_time ?? 0;
  return useQuery({
    queryKey: ["currentPrice"],
    queryFn: pulseServices.fetchCurrentPrice,
    enabled: deployed && (now ?? 0) >= openTime,
    refetchInterval: POLL_FAST,
  });
};

/* ---------- derived lifecycle status ---------- */

export const useAuctionStatus = (): AuctionStatus => {
  const isDeployed = useIsDeployed().data;
  const initParams = useInitParams().data;
  const now = useNow().data ?? 0;
  const curveActive = useCurveActive().data;

  if (!isDeployed) return AuctionStatus.PREDEPLOY;
  if (now < (initParams?.open_time ?? 0)) return AuctionStatus.COUNTDOWN;
  if (!curveActive) return AuctionStatus.GENESIS;
  return AuctionStatus.LIVE;
};

/* ---------- sales stream (already mapped to {timestamp, price}) ---------- */

export const usePulseSales = (limit = 100) =>
  useQuery({
    queryKey: ["sales", limit],
    queryFn: () => pulseServices.fetchSales(limit),
    enabled: useCurveActive().data === true,
    select: (events): Sale[] =>
      events.map((ev) => {
        const [lowHex, highHex, tsHex] = ev.data;
        const price = (BigInt(highHex) << 128n) + BigInt(lowHex);
        return {
          timestamp: parseInt(tsHex, 16),
          price,
        };
      }),
    refetchInterval: POLL_FAST,
  });

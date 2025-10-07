// src/components/AuctionBidsCurve.tsx
import  { useEffect, useMemo, useRef, useState } from "react";
import type { ProviderInterface } from "starknet";
import { hash, RpcProvider } from "starknet";
import { useAuction } from "@/hooks/useAuction";
import { resolveAddress } from "@/protocol/addressBook";

// visx
import { scaleLinear, scaleTime } from "@visx/scale";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { curveMonotoneX } from "@visx/curve";

type U256Like = { low: string | number | bigint; high: string | number | bigint };

// ---------- utils ----------
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };
const MASK128 = (1n << 128n) - 1n;

function toBig(x: string | number | bigint): bigint {
  if (typeof x === "bigint") return x;
  const s = String(x).trim();
  return s.startsWith("0x") || s.startsWith("0X") ? BigInt(s) : BigInt(s);
}
function readU256(v: any): U256Like {
  if (v == null) throw new Error("u256: null/undefined");
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    const b = toBig(v);
    return { low: b & MASK128, high: b >> 128n };
  }
  if (Array.isArray(v) && v.length >= 2) return { low: v[0], high: v[1] };
  if (typeof v === "object") {
    if ("low" in v && "high" in v) return { low: (v as any).low, high: (v as any).high };
    if ((0 in (v as any)) && (1 in (v as any))) return { low: (v as any)[0], high: (v as any)[1] };
    if ("price" in v) return readU256((v as any).price);
    if ("value" in v) return readU256((v as any).value);
  }
  throw new Error("u256: unknown shape");
}
function u256ToBig(u: U256Like): bigint {
  return (toBig(u.high) << 128n) + toBig(u.low);
}
function bigToFloatDec(n: bigint, decimals = 18): number {
  // return Number(n) / 10**decimals  (keep simple; safe for typical ERC-20 amounts)
  return Number(n) / Math.pow(10, decimals);
}

type BidPoint = {
  tsSec: number;            // unix seconds
  price: bigint;            // price as big integer base units
  bidder?: string;          // optional
  txHash?: string;          // optional
};

// ---------- events hook (fetch Sale/BidPlaced and decode) ----------
function useAuctionBids(opts: {
  address?: string;
  provider?: ProviderInterface;
  pollMs?: number;
}) {
  const { address: maybeAddr, provider: maybeProvider, pollMs = 3000 } = opts;
  const address = useMemo(() => resolveAddress("pulse_auction", maybeAddr), [maybeAddr]);
  const provider = useMemo<ProviderInterface>(() => {
    return (
      maybeProvider ??
      new RpcProvider({
        nodeUrl:
          (import.meta as any).env?.VITE_STARKNET_RPC ?? "http://127.0.0.1:5050/rpc",
      })
    );
  }, [maybeProvider]);

  const [bids, setBids] = useState<BidPoint[]>([]);
  const lastScanned = useRef<number | null>(null);

  // event selectors (try common names)
  const SALE_KEY = useMemo(() => hash.getSelectorFromName("Sale"), []);
  const BID_PLACED_KEY = useMemo(() => hash.getSelectorFromName("BidPlaced"), []);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        // range
        const latest = await (provider as any).getBlockNumber?.();
        const fromBlock =
          lastScanned.current == null ? Math.max((latest ?? 0) - 5000, 0) : lastScanned.current + 1;

        // fetch both keys to be safe (node expects keys: string[][])
        const resp1 = await (provider as any).getEvents({
          address,
          keys: [[SALE_KEY]],
          from_block: { block_number: fromBlock },
          to_block: "latest",
          chunk_size: 100,
        });
        const resp2 = await (provider as any).getEvents({
          address,
          keys: [[BID_PLACED_KEY]],
          from_block: { block_number: fromBlock },
          to_block: "latest",
          chunk_size: 100,
        });

        const rows: any[] = [
          ...(resp1?.events ?? resp1 ?? []),
          ...(resp2?.events ?? resp2 ?? []),
        ];

        if (!alive) return;

        if (rows.length) {
          const decoded: BidPoint[] = [];
          for (const ev of rows) {
            // Try shapes:
            // data = [bidder, price.low, price.high, ts]   // common
            // or     [price.low, price.high, ts]           // bidder omitted
            const d = ev.data ?? [];
            let idx = 0;
            let bidder: string | undefined = undefined;
            if (d.length >= 4) {
              // if first looks like address (long felt), treat as bidder
              bidder = String(d[0]);
              idx = 1;
            }
            if (d.length - idx >= 3) {
              const price = u256ToBig(readU256([d[idx], d[idx + 1]]));
              const tsSec = Number(d[idx + 2]);
              decoded.push({
                tsSec,
                price,
                bidder,
                txHash: ev.transaction_hash ?? ev.txHash,
              });
            }
          }

          if (decoded.length) {
            setBids((prev) => {
              const seen = new Set(prev.map((b) => `${b.txHash ?? ""}/${b.tsSec}/${b.price}`));
              const merged = [
                ...prev,
                ...decoded.filter((b) => !seen.has(`${b.txHash ?? ""}/${b.tsSec}/${b.price}`)),
              ];
              merged.sort((a, b) => a.tsSec - b.tsSec);
              return merged;
            });
          }
        }

        if (typeof latest === "number") lastScanned.current = latest;
      } catch {
        // ignore; render whatever we have
      } finally {
        if (alive) setTimeout(tick, pollMs);
      }
    }

    tick();
    return () => {
      alive = false;
    };
  }, [address, provider, SALE_KEY, BID_PLACED_KEY, pollMs]);

  return { bids, address, provider };
}

// ---------- component ----------
export default function AuctionBidsCurve(props: {
  address?: string;                 // optional override, else resolver uses addresses.json/env
  refreshMs?: number;               // polling for the snapshot hook below
  abiSource?: "artifact" | "node" | "auto";
  width?: number;
  height?: number;
  padding?: number;
  priceDecimals?: number;           // ERC-20 decimals (default 18)
}) {
  const width = props.width ?? 760;
  const height = props.height ?? 380;
  const padding = props.padding ?? 44;
  const priceDecimals = props.priceDecimals ?? 18;

  // existing snapshot (active/price/config) — for headers/legend and open_time
  const { data, loading, error, refresh, ready } = useAuction({
    address: props.address,
    refreshMs: props.refreshMs ?? 4000,
    abiSource: props.abiSource ?? "auto",
  });

  // bids stream
  const { bids } = useAuctionBids({
    address: props.address,
    pollMs: 3000,
  });

  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error) return <div style={{ ...mono, color: "crimson", whiteSpace: "pre-wrap" }}>error: {String(error)}</div>;
  if (!data) return <div style={mono}>no data</div>;

  const { active, price, config } = data;

  // domains
  const xDomain = useMemo<[Date, Date]>(() => {
    const minTs = Math.min(
      config.openTimeSec ?? Math.floor(Date.now() / 1000) - 60 * 60,
      ...(bids.length ? [bids[0].tsSec] : [Math.floor(Date.now() / 1000)])
    );
    const maxTs = Math.max(
      config.openTimeSec + 1,
      ...(bids.length ? [bids[bids.length - 1].tsSec] : [Math.floor(Date.now() / 1000)])
    );
    // pad ends slightly
    const pad = Math.max(15, Math.floor((maxTs - minTs) * 0.05));
    return [new Date((minTs - pad) * 1000), new Date((maxTs + pad) * 1000)];
  }, [bids, config.openTimeSec]);

  const yDomain = useMemo<[number, number]>(() => {
    const prices = bids.length
      ? bids.map((b) => bigToFloatDec(b.price, priceDecimals))
      : [bigToFloatDec(price.asBigInt, priceDecimals)];
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min || 1) * 0.1;
    return [Math.max(0, min - pad), max + pad];
  }, [bids, price.asBigInt, priceDecimals]);

  // scales
  const x = useMemo(
    () =>
      scaleTime<number>({
        domain: xDomain,
        range: [padding, width - padding],
      }),
    [xDomain, width, padding]
  );

  const y = useMemo(
    () =>
      scaleLinear<number>({
        domain: yDomain, // low..high
        range: [height - padding, padding],
        nice: true,
      }),
    [yDomain, height, padding]
  );

  // line from bids (time → price)
  const bidSeries = useMemo(
    () =>
      bids.map((b) => ({
        t: new Date(b.tsSec * 1000),
        p: bigToFloatDec(b.price, priceDecimals),
      })),
    [bids, priceDecimals]
  );

  return (
    <div style={{ ...mono, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, lineHeight: 1.4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Pulse Auction · Bids</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span>curve_active: {String(active)}</span>{" · "}
        <span>current_price: {price.asDec}</span>{" · "}
        <span>open_time: {config.openTimeSec} ({new Date(config.openTimeSec * 1000).toLocaleString()})</span>
      </div>

      <svg width={width} height={height} role="img" aria-label="Bids curve">
        <Group>
          <AxisBottom
            top={height - padding}
            left={0}
            scale={x}
            stroke="currentColor"
            tickStroke="currentColor"
            tickLabelProps={() => ({ fill: "currentColor", fontSize: 11, textAnchor: "middle" })}
          />
          <AxisLeft
            left={padding}
            top={0}
            scale={y}
            stroke="currentColor"
            tickStroke="currentColor"
            tickLabelProps={() => ({ fill: "currentColor", fontSize: 11, textAnchor: "end", dx: "-0.25em" })}
          />
        </Group>

        {/* line through bids */}
        {bidSeries.length >= 2 && (
          <LinePath
            data={bidSeries}
            x={(d) => x(d.t)}
            y={(d) => y(d.p)}
            stroke="currentColor"
            strokeWidth={2}
            curve={curveMonotoneX}
          />
        )}

        {/* points */}
        {bidSeries.map((d, i) => (
          <g key={i}>
            <circle cx={x(d.t)} cy={y(d.p)} r={3} fill="currentColor" />
          </g>
        ))}
      </svg>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
        <div>• X: bid time (sec) · Y: bid price (token units, {priceDecimals} decimals)</div>
        <div>• Points are accepted bids; line connects them in time order.</div>
      </div>
    </div>
  );
}

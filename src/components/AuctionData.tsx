import { useEffect, useMemo, useRef, useState } from "react";
import { toFixed, formatU256Dec, type U256Num } from "@/num";
import type { AbiSource } from "@/types/types";
import type { ProviderInterface } from "starknet";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { NormalizedBid as ServiceBid } from "@/services/auction/bidsService";

const mono = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  lineHeight: 1.45,
};

type Point = { t: number; y: number };

// ---- Bid types & helpers ----------------------------------------------------
type BidLite = {
  id?: number; // if your hook exposes an id/counter
  bidder?: string;
  amount: U256Num; // u256 wrapper from your num/
  tsSec?: number; // seconds since epoch, if available
  txHash?: string;
};

function bigintDec(n: U256Num) {
  return formatU256Dec(n);
}
function decimalStr(n: U256Num, decimals: number) {
  return toFixed(n, decimals);
}

// Build a stable de-dup key (prefer txHash, else id, else (bidder|amount|ts))
function bidKey(b: BidLite): string {
  if (b.txHash) return `tx:${b.txHash.toLowerCase()}`;
  if (typeof b.id === "number") return `id:${b.id}`;
  const amt = bigintDec(b.amount);
  const who = (b.bidder ?? "").toLowerCase();
  const ts = b.tsSec ? String(b.tsSec) : "";
  return `mix:${who}|${amt}|${ts}`;
}

function normalizeBid(b: BidLite): ServiceBid {
  const key = bidKey(b);
  const atMs =
    b.tsSec && Number.isFinite(b.tsSec) ? b.tsSec * 1000 : Date.now();
  return {
    key,
    atMs,
    bidder: b.bidder,
    amount: b.amount,
    txHash: b.txHash,
    id: b.id,
    blockNumber: undefined,
  };
}

export default function AuctionData(props: {
  address?: string;
  abiSource?: AbiSource;
  provider?: ProviderInterface;
  refreshMs?: number;
  decimals?: number; // token decimals for scaled display (default 18)
  maxPoints?: number; // cap for the sparkline buffer (default 120)
  width?: number; // svg width (default 760)
  height?: number; // svg height (default 280)
  maxBids?: number; // cap for the bids list (default 100)
}) {
  const { data, loading, error, ready, refresh } = useAuctionCore({
    address: props.address,
    refreshMs: props.refreshMs ?? 4000,
    abiSource: props.abiSource ?? "auto",
    provider: props.provider,
  });

  // Live bids via events (preferred when address provided)
  const bidsEnabled = Boolean(props.address);
  const {
    bids: liveBids,
    loading: bidsLoading,
    error: bidsError,
    ready: bidsReady,
  } = useAuctionBids({
    address: props.address ?? "0x0",
    refreshMs: props.refreshMs ?? 4000,
    enabled: bidsEnabled,
    maxBids: props.maxBids ?? 200,
  });

  const decimals = props.decimals ?? 18;
  const W = props.width ?? 760;
  const H = props.height ?? 280;
  const PAD = 36;
  const MAX = props.maxPoints ?? 120;
  const MAX_BIDS = props.maxBids ?? 100;

  // ---- Sparkline series (price over time) -----------------------------------
  const [series, setSeries] = useState<Point[]>([]);
  const lastPriceRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    const price: U256Num = data.price;

    const scaledStr = toFixed(price, decimals); // exact scaling as string
    if (scaledStr === lastPriceRef.current) return;

    const y = Number.parseFloat(scaledStr); // only for plotting
    if (!Number.isFinite(y)) return;

    lastPriceRef.current = scaledStr;
    setSeries((prev) => {
      const next = [...prev, { t: now, y }];
      if (next.length > MAX) next.shift();
      return next;
    });
  }, [data, decimals, MAX]);

  // ---- Bids list (append-only, de-duplicated) --------------------------------
  const [bids, setBids] = useState<ServiceBid[]>([]);
  const seen = useRef<Set<string>>(new Set());

  // (legacy helper removed; live bids feed sets the list directly)

  // Hydrate/append whenever hook data carries bids info
  // Prefer live bids when available; otherwise fall back to any bids-like data inside core snapshot
  useEffect(() => {
    if (bidsEnabled && bidsReady) {
      setBids(liveBids);
      // keep seen in sync
      seen.current = new Set(liveBids.map((b) => b.key));
      return;
    }
    if (!data) return;
    const arr =
      (data as any).bids ||
      (data as any).events?.bids ||
      (data as any).events?.BidPlaced ||
      [];
    if (Array.isArray(arr) && arr.length) {
      const normalized = arr
        .map((raw: any) =>
          normalizeBid({
            id: raw.id ?? raw.bidId ?? raw.index,
            bidder: raw.bidder ?? raw.from ?? raw.sender,
            amount: raw.amount ?? raw.value ?? raw.bid,
            tsSec:
              raw.tsSec ??
              raw.timestampSec ??
              raw.block_timestamp ??
              raw.blockTimestamp,
            txHash: raw.txHash ?? raw.transaction_hash ?? raw.tx,
          } as BidLite)
        )
        .filter((x) => !!x.key);
      setBids((prev) => {
        const next = [...prev];
        for (const nb of normalized) {
          if (!seen.current.has(nb.key)) {
            seen.current.add(nb.key);
            next.push(nb);
          }
        }
        next.sort((a, b) => a.atMs - b.atMs);
        return next.length > MAX_BIDS ? next.slice(-MAX_BIDS) : next;
      });
    }
  }, [bidsEnabled, bidsReady, liveBids, data, decimals, MAX_BIDS]);

  // ---- Path for sparkline ----------------------------------------------------
  const pathD = useMemo(() => {
    if (series.length === 0) return "";
    const xs = series.map((p) => p.t);
    const ys = series.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const xRange = maxX > minX ? maxX - minX : 1;
    const yRange = maxY > minY ? maxY - minY : 1;

    const xToPx = (t: number) => PAD + ((t - minX) / xRange) * (W - PAD * 2);
    const yToPx = (v: number) =>
      PAD + (H - PAD * 2) - ((v - minY) / yRange) * (H - PAD * 2);

    let d = `M ${xToPx(series[0].t)} ${yToPx(series[0].y)}`;
    for (let i = 1; i < series.length; i++) {
      d += ` L ${xToPx(series[i].t)} ${yToPx(series[i].y)}`;
    }
    return d;
  }, [series, W, H]);

  // ---- Early states ----------------------------------------------------------
  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error || bidsError) {
    return (
      <div style={{ ...mono, color: "crimson", whiteSpace: "pre-wrap" }}>
        error: {String(error ?? bidsError)}
      </div>
    );
  }
  if (!data) return <div style={mono}>no data</div>;

  const { config, active } = data;
  const price = data.price;

  // ---- UI --------------------------------------------------------------------
  return (
    <div
      style={{
        ...mono,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <strong>Pulse Auction · Data</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      {/* Essentials */}
      <div style={{ marginBottom: 8 }}>
        <div>
          <b>curve_active</b>: {String(active)}
        </div>
        <div>
          <b>current_price</b>: int={formatU256Dec(price)} · scaled=
          {toFixed(price, decimals)}
        </div>
        <div>
          <b>open_time</b>: {config.openTimeSec} (
          {new Date(config.openTimeSec * 1000).toISOString()})
        </div>
      </div>

      {/* Sparkline */}
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="current price sparkline"
        style={{ display: "block" }}
      >
        {/* axes */}
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="#e5e7eb"
        />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" />
        {/* path */}
        {pathD ? (
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} />
        ) : (
          <text x={PAD} y={H / 2} fill="#9ca3af">
            no samples yet
          </text>
        )}
      </svg>

      {/* Bids list */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Bids</div>
        {bids.length === 0 ? (
          <div style={{ color: "#6b7280" }}>no bids yet</div>
        ) : (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
              }}
            >
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    Time
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    Block
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    Bidder
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    Amount (int)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    Amount (scaled)
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    Tx Hash / ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.key} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 8px" }}>
                      {new Date(b.atMs)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {b.blockNumber ?? "—"}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {b.bidder
                        ? `${b.bidder.slice(0, 6)}…${b.bidder.slice(-4)}`
                        : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {bigintDec(b.amount)}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {decimalStr(b.amount, decimals)}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {b.txHash ? (
                        <span title={b.txHash}>
                          {`${b.txHash.slice(0, 8)}…${b.txHash.slice(-6)}`}
                        </span>
                      ) : (
                        b.id ?? "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        Sampling current_price every {props.refreshMs ?? 4000}ms · decimals=
        {decimals} · points={series.length} · bids={bids.length}
        {bidsEnabled && (
          <>
            {" "}
            · bids feed{" "}
            {bidsReady ? (bidsLoading ? "(loading)" : "ready") : "(init)"}
          </>
        )}
      </div>
    </div>
  );
}

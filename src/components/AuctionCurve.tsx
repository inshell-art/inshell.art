import  { useEffect, useMemo, useRef, useState } from "react";
import { useAuction } from "@/hooks/useAuction";
import { toFixed,formatU256Dec, type U256Num} from "@/num";
import type { AbiSource } from "@/types/types";

const mono = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  lineHeight: 1.45,
};

type Point = { t: number; y: number };

export default function AuctionCurve(props: {
  address?: string;
  refreshMs?: number;
  abiSource?: AbiSource;
  decimals?: number;         // token decimals for scaled display (default 18)
  maxPoints?: number;        // cap for the sparkline buffer (default 120)
  width?: number;            // svg width (default 760)
  height?: number;           // svg height (default 280)
}) {
  const { data, loading, error, ready, refresh } = useAuction({
    address: props.address,
    refreshMs: props.refreshMs ?? 4000,
    abiSource: props.abiSource ?? "auto",
  });

  const decimals = props.decimals ?? 18;
  const W = props.width ?? 760;
  const H = props.height ?? 280;
  const PAD = 36;
  const MAX = props.maxPoints ?? 120;

  // Local sampled series of current_price, scaled to float for plotting
  const [series, setSeries] = useState<Point[]>([]);

  // Append a new point whenever price changes
  const lastPriceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    const price: U256Num = data.price;

    // Use exact string scaling then parse to float just for plotting
    const scaledStr = toFixed(price, decimals);
    if (scaledStr === lastPriceRef.current) return;

    const y = Number.parseFloat(scaledStr);
    if (!Number.isFinite(y)) return;

    lastPriceRef.current = scaledStr;
    setSeries((prev) => {
      const next = [...prev, { t: now, y }];
      if (next.length > MAX) next.shift();
      return next;
    });
  }, [data, decimals, MAX]);

  // Compute path (no hooks inside conditionals)
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
      // y grows downward in SVG; invert so higher price appears higher
      PAD + (H - PAD * 2) - ((v - minY) / yRange) * (H - PAD * 2);

    let d = `M ${xToPx(series[0].t)} ${yToPx(series[0].y)}`;
    for (let i = 1; i < series.length; i++) {
      d += ` L ${xToPx(series[i].t)} ${yToPx(series[i].y)}`;
    }
    return d;
  }, [series, W, H]);

  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error) {
    return (
      <div style={{ ...mono, color: "crimson", whiteSpace: "pre-wrap" }}>
        error: {String(error)}
      </div>
    );
  }
  if (!data) return <div style={mono}>no data</div>;

  const { config, active } = data;
  const price = data.price;

  return (
    <div style={{ ...mono, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Pulse Auction · Curve (minimal)</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      {/* Plain essentials (from num/ helpers) */}
      <div style={{ marginBottom: 8 }}>
        <div><b>curve_active</b>: {String(active)}</div>
        <div><b>current_price</b>: int={formatU256Dec(price)} · scaled={toFixed(price, decimals)}</div>
        <div><b>open_time</b>: {config.openTimeSec} ({new Date(config.openTimeSec * 1000).toISOString()})</div>
      </div>

      {/* Sparkline */}
      <svg width={W} height={H} role="img" aria-label="current price sparkline" style={{ display: "block" }}>
        {/* axes (subtle) */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e5e7eb" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" />
        {/* path */}
        {pathD ? (
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} />
        ) : (
          <text x={PAD} y={H / 2} fill="#9ca3af">no samples yet</text>
        )}
      </svg>

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        Sampling current_price every {props.refreshMs ?? 4000}ms · decimals={decimals} · points={series.length}
      </div>
    </div>
  );
}

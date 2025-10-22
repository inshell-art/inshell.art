import { useMemo } from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";

const mono = {
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  lineHeight: 1.45,
};

type Point = { t: number; y: bigint };

export default function AuctionCurve(props: {
  address: string;
  refreshMs?: number; // polling for bids
  decimals?: number; // default 18
  maxPoints?: number; // points for the curve buffer
  width?: number;
  height?: number;
}) {
  // const decimals = props.decimals ?? 18; // not used in BigInt scaling path
  const W = props.width ?? 760;
  const H = props.height ?? 280;
  const PAD = 36;
  const MAX = props.maxPoints ?? 200;

  const { bids, loading, error, ready } = useAuctionBids({
    address: props.address,
    refreshMs: props.refreshMs ?? 2000,
    enabled: true,
  });

  const series: Point[] = useMemo(() => {
    // Use BigInt amounts to avoid overflow; convert to pixels later
    return bids
      .map((b) => ({ t: b.atMs, y: b.amount.value }))
      .sort((a, b) => a.t - b.t)
      .slice(-MAX);
  }, [bids, MAX]);

  const pathD = useMemo(() => {
    if (series.length === 0) return "";
    const xs = series.map((p) => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const xRange = maxX > minX ? maxX - minX : 1;
    const xToPx = (t: number) => PAD + ((t - minX) / xRange) * (W - PAD * 2);

    // BigInt y-scaling to prevent Number overflow
    const ys = series.map((p) => p.y);
    let minY = ys[0];
    let maxY = ys[0];
    for (let i = 1; i < ys.length; i++) {
      const v = ys[i];
      if (v < minY) minY = v;
      if (v > maxY) maxY = v;
    }
    const yRange = maxY - minY;
    const SCALE = 1_000_000n; // map to [0, 1_000_000]
    const innerH = H - PAD * 2;
    const yToPxBig = (v: bigint) => {
      if (yRange === 0n) return PAD + innerH / 2; // flat line
      const yScaled = ((v - minY) * SCALE) / yRange; // 0..SCALE
      const frac = Number(yScaled) / Number(SCALE); // safe: <= 1e6
      return PAD + innerH - frac * innerH;
    };

    let d = `M ${xToPx(series[0].t)} ${yToPxBig(series[0].y)}`;
    for (let i = 1; i < series.length; i++)
      d += ` L ${xToPx(series[i].t)} ${yToPxBig(series[i].y)}`;
    return d;
  }, [series, W, H]);

  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error)
    return (
      <div style={{ ...mono, color: "crimson" }}>error: {String(error)}</div>
    );
  if (series.length === 0) return <div style={mono}>no bids yet</div>;

  return (
    <div style={{ ...mono }}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="bids curve"
        style={{ display: "block" }}
      >
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="#e5e7eb"
        />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" />
        {pathD ? (
          <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} />
        ) : (
          <text x={PAD} y={H / 2} fill="#9ca3af">
            no samples yet
          </text>
        )}
      </svg>
    </div>
  );
}

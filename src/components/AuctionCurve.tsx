import { useMemo, useRef, useState } from "react";
import { priceAtMs, makeEpochParams } from "@/domain/pulseMath";
import Decimal from "decimal.js";
import { useAuctionBids } from "@/hooks/useAuctionBids";

const mono = {
  fontFamily:
    '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  lineHeight: 1.45,
};

type FloatPoint = {
  t: number; // seconds since genesis
  y: number; // sale price (fri)
  atMs: number; // absolute ms of the sale
  aMs?: number; // anchor from event (ms)
  b?: number; // floor from event (fri)
  // preserve original decimal strings for precise display/tooltip
  dec?: string; // amount.dec string (fri units)
  bDec?: string; // floor.dec string (fri units)
  epochIdx?: number; // epoch index from event/state
};

export default function AuctionCurve(props: {
  address: string;
  refreshMs?: number; // polling for bids
  decimals?: number; // default 18
  maxPoints?: number; // points for the curve buffer
  initialVisibleCount?: number; // initial number of latest points to show
  pageSize?: number; // how many more to load per click
}) {
  // const decimals = props.decimals ?? 18; // not used in BigInt scaling path
  const PAD = 36;
  const MAX = props.maxPoints ?? 200;

  // Responsive sizing based on container
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Free-canvas sizing: no container-driven resize logic needed.

  const { bids, epoch, loading, error, ready } = useAuctionBids({
    address: props.address,
    refreshMs: props.refreshMs ?? 2000,
    enabled: true,
  });

  // lightweight in-app debug overlay (per-render messages; no state updates during render)
  const dbgMsgs: string[] = [];

  // pagination removed: always show all filtered points

  // Strict 1:1 scaling (time unit == price unit in pixels)

  // Compute point() values as dots:
  // - x = seconds since first bid (fractional seconds to avoid collapsing into t=0)
  // - y = amount in base units (fri)
  const points: FloatPoint[] = useMemo(() => {
    if (bids.length === 0) return [];
    const genesis = bids.reduce(
      (min, b) => (b.atMs < min ? b.atMs : min),
      bids[0].atMs
    );
    const sorted = [...bids].sort((a, b) => a.atMs - b.atMs);
    const eps = 1e-3; // 1ms in seconds
    let lastT = -Infinity;
    let lastAtMs: number | undefined; // Initialize lastAtMs for fallback
    const out = sorted.map((row) => {
      let t = (row.atMs - genesis) / 1000; // fractional seconds
      if (t <= lastT) t = lastT + eps; // nudge forward minimally
      lastT = t;
      const aMs = row.anchorMs ?? lastAtMs; // fallback to previous sale time when missing
      const bFloor = row.floor ? Number(row.floor.dec) : Number(row.amount.dec); // fallback to current filled price
      const epochIdx =
        typeof row.epochIndex === "number" ? row.epochIndex : undefined;
      const obj: FloatPoint = {
        t,
        y: Number(row.amount.dec),
        atMs: row.atMs,
        aMs,
        b: bFloor,
        dec: String(row.amount.dec),
        bDec: row.floor ? String(row.floor.dec) : undefined,
        epochIdx,
      }; // base units (fri)
      lastAtMs = row.atMs; // update fallbacks for next iteration
      return obj;
    });
    return out.slice(-MAX);
  }, [bids, MAX]);

  // Epoch index range selector state
  const epochBounds = useMemo(() => {
    let min: number | undefined;
    let max: number | undefined;
    for (const p of points) {
      if (typeof p.epochIdx !== "number") continue;
      min = min === undefined ? p.epochIdx : Math.min(min, p.epochIdx);
      max = max === undefined ? p.epochIdx : Math.max(max, p.epochIdx);
    }
    return { min, max } as { min?: number; max?: number };
  }, [points]);
  const [epochMin, setEpochMin] = useState<number | undefined>(undefined);
  const [epochMax, setEpochMax] = useState<number | undefined>(undefined);
  const [useCurrentEpochPump, setUseCurrentEpochPump] = useState(false);

  // Build segments: each represents the curve from previous bid (s) to current bid (e).
  // Attribute the epoch index to the END bid (e.epochIdx) so pumped-start belongs to the new epoch.
  type Segment = { s: FloatPoint; e: FloatPoint; epochIdx?: number };
  const segments: Segment[] = useMemo(() => {
    if (points.length < 2) return [];
    const out: Segment[] = [];
    for (let i = 1; i < points.length; i++) {
      const s = points[i - 1];
      const e = points[i];
      out.push({ s, e, epochIdx: e.epochIdx });
    }
    return out;
  }, [points]);

  // Filter by epoch range on segments (by end epoch).
  const visibleSegments: Segment[] = useMemo(() => {
    if (segments.length === 0) return [];
    const lo = epochMin ?? epochBounds.min;
    const hi = epochMax ?? epochBounds.max;
    if (lo === undefined || hi === undefined) return segments;
    if (hi < lo) return segments;
    return segments.filter((seg) =>
      typeof seg.epochIdx === "number"
        ? seg.epochIdx >= lo && seg.epochIdx <= hi
        : true
    );
  }, [segments, epochMin, epochMax, epochBounds.min, epochBounds.max]);

  // End bid points in range (for green dots)
  const visibleEndPoints: FloatPoint[] = useMemo(() => {
    const set = new Set<FloatPoint>();
    for (const seg of visibleSegments) set.add(seg.e);
    return Array.from(set.values());
  }, [visibleSegments]);

  // Pull k from epoch (u256) as a high-precision decimal string to avoid precision loss
  const kStr: string | undefined = useMemo(() => {
    return epoch?.k?.dec;
  }, [epoch]);

  // Absolute start time for converting x seconds -> absolute ms
  const genesisMs = useMemo(() => {
    if (bids.length === 0) return 0;
    return bids.reduce((min, b) => (b.atMs < min ? b.atMs : min), bids[0].atMs);
  }, [bids]);

  // 1:1 coupling removed; no ratio computation needed

  // Unified scaling from points plus per-segment curve peaks
  // Fixed square canvas: use INDEPENDENT x and y scales (drop 1:1 price:time coupling).
  const {
    xToPx,
    yToPx,
    xDomain,
    yDomain,
    drawW,
    drawH,
    innerW,
    innerH,
    offsetX,
    offsetY,
  } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const seg of visibleSegments) {
      xs.push(seg.s.t, seg.e.t);
      ys.push(seg.s.y, seg.e.y);
    }
    if (xs.length === 0 || ys.length === 0)
      return {
        xToPx: (_t: number) => PAD,
        yToPx: (_v: number) => 200,
        xDomain: [0, 1] as [number, number],
        yDomain: [0, 1] as [number, number],
        drawW: 700,
        drawH: 700,
        innerW: 700 - PAD * 2,
        innerH: 700 - PAD * 2,
        offsetX: PAD,
        offsetY: PAD,
      };
    const rawMinX = Math.min(...xs);
    const rawMaxX = Math.max(...xs);
    let rawMinY = Math.min(...ys);
    let rawMaxY = Math.max(...ys);
    // Include per-segment sampled curve values (pump start -> curve -> next bid)
    // so the entity bounding box reflects the full curve geometry.
    if (kStr && visibleSegments.length > 0) {
      const kDecMs = new Decimal(kStr).times(1000);
      const SAMPLES = 120;
      for (let i = 0; i < visibleSegments.length; i++) {
        const { s, e } = visibleSegments[i];
        if (typeof s.b !== "number") continue;
        const aBase = typeof s.aMs === "number" ? s.aMs : s.atMs;
        const aEffRaw =
          useCurrentEpochPump && epoch?.aMs ? epoch.aMs : aBase;
        if (!Number.isFinite(aEffRaw)) continue;
        const aEff = Number(aEffRaw);
        const x0 = s.t;
        const x1 = e.t;
        if (!(x1 > x0)) continue;
        const dx = (x1 - x0) / (SAMPLES - 1 || 1);
        for (let j = 0; j < SAMPLES; j++) {
          const x = x0 + dx * j;
          const ms = genesisMs + x * 1000;
          try {
            const yDec = priceAtMs(ms, makeEpochParams(kDecMs, aEff, s.b));
            if (!yDec.isFinite()) continue;
            const y = yDec.toNumber();
            if (!Number.isFinite(y)) continue;
            rawMinY = Math.min(rawMinY, y);
            rawMaxY = Math.max(rawMaxY, y);
          } catch {
            // ignore sample errors
          }
        }
      }
      // Note: we intentionally do NOT include the exact pumped start point
      // in the bounding box to avoid an extreme singularity at x = sale time
      // from collapsing the rest of the curve shape.
    }

    // Start with padded domains (in original units)
    const PAD_FRAC = 0.05; // 5% headroom
    const xSpanRaw = Math.max(1e-6, rawMaxX - rawMinX);
    const ySpanRaw = Math.max(1e-6, rawMaxY - rawMinY);
    let minX0 = rawMinX - xSpanRaw * PAD_FRAC;
    let maxX0 = rawMaxX + xSpanRaw * PAD_FRAC;
    // keep x >= 0 when possible, but don't clip data; shift window if needed
    if (minX0 < 0) {
      const shift = -minX0;
      minX0 += shift;
      maxX0 += shift;
    }
    let minY0 = rawMinY - ySpanRaw * PAD_FRAC;
    let maxY0 = rawMaxY + ySpanRaw * PAD_FRAC;

    const xSpan = Math.max(1e-6, maxX0 - minX0);
    const ySpan = Math.max(1e-6, maxY0 - minY0);

    // Independent scales fill the available inner square in each dimension
    const CANVAS = 700;
    const MAX_INNER = Math.max(1, CANVAS - PAD * 2);
    const sx = MAX_INNER / xSpan;
    const sy = MAX_INNER / ySpan;
    const innerW = Math.round(MAX_INNER);
    const innerH = Math.round(MAX_INNER);
    const offsetX = PAD;
    const offsetY = PAD;

    const minX = minX0;
    const maxX = maxX0;
    const minY = minY0;
    const maxY = maxY0;

    const xToPx = (t: number) => offsetX + (t - minX) * sx;
    const yToPx = (v: number) => offsetY + innerH - (v - minY) * sy;
    return {
      xToPx,
      yToPx,
      xDomain: [minX, maxX] as [number, number],
      yDomain: [minY, maxY] as [number, number],
      drawW: 700,
      drawH: 700,
      innerW,
      innerH,
      offsetX,
      offsetY,
    };
  }, [visibleSegments, kStr, epoch]);

  // Tick helpers
  const niceStep = (range: number) => {
    const pow = Math.pow(10, Math.floor(Math.log10(range)));
    const n = range / pow;
    if (n <= 1) return 1 * pow;
    if (n <= 2) return 2 * pow;
    if (n <= 5) return 5 * pow;
    return 10 * pow;
  };
  const makeTicks = (domain: [number, number], count = 5) => {
    const [d0, d1] = domain;
    const span = Math.max(1e-9, d1 - d0);
    const step = niceStep(span / Math.max(1, count - 1));
    const start = Math.ceil(d0 / step) * step;
    const out: number[] = [];
    for (let v = start; v <= d1 + 1e-9; v += step) out.push(v);
    // Ensure domain min/max are represented to anchor labels near data
    const addIfMissing = (val: number) => {
      const near = out.find((x) => Math.abs(x - val) <= step / 2);
      if (near === undefined) out.push(val);
    };
    addIfMissing(d0);
    addIfMissing(d1);
    let sorted = out.sort((a, b) => a - b);
    // Drop 0 unless it's exactly at a domain bound
    const EPS = 1e-12;
    const isZeroBound = Math.abs(d0) <= EPS || Math.abs(d1) <= EPS;
    if (!isZeroBound) {
      sorted = sorted.filter((x) => Math.abs(x) > step * 0.49);
    }
    return sorted;
  };
  // Dynamic tick formatting to avoid rounding small mins to 0
  const tickStepFor = (domain: [number, number], count = 6) =>
    niceStep(Math.max(1e-9, (domain[1] - domain[0]) / Math.max(1, count - 1)));
  const xStep = useMemo(() => tickStepFor(xDomain, 6), [xDomain]);
  const yStep = useMemo(() => tickStepFor(yDomain, 6), [yDomain]);
  const decimalsFor = (step: number) => {
    if (!Number.isFinite(step) || step <= 0) return 2;
    const p = Math.max(0, -Math.floor(Math.log10(step)));
    return Math.min(8, p + 1); // one extra digit beyond step resolution
  };
  const fmtX = (v: number) =>
    v.toLocaleString("en-US", { maximumFractionDigits: decimalsFor(xStep) });
  const fmtY = (v: number) =>
    v.toLocaleString("en-US", { maximumFractionDigits: decimalsFor(yStep) });
  const xTicks = useMemo(() => makeTicks(xDomain, 6), [xDomain]);
  const yTicks = useMemo(() => makeTicks(yDomain, 6), [yDomain]);

  // token decimals unused in unscaled fri display

  // Hover tooltip state
  const [hover, setHover] = useState<{
    px: number;
    py: number;
    t: number;
    y: number;
    atMs?: number;
    epochIdx?: number;
    kind: "bid" | "init";
    dec?: string;
    bDec?: string;
  } | null>(null);

  // Simple integer formatter for large decimal strings (fri units)
  const formatIntString = (s: string): string =>
    s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Compute a safe "init ask" at the start of a segment.
  // If dtMs <= 0 (anchor equals sale time), evaluate at +1ms to avoid singularity.
  const initAskAtStart = (
    _s: FloatPoint,
    aEff: number,
    floorBase: Decimal.Value,
    kMs: Decimal
  ): { y: number; yDec: Decimal; ms: number } | null => {
    // Define the init ask exactly at aEff + 1ms to avoid singularity.
    const evalMs = aEff + 1;
    const denom = evalMs - aEff;
    if (!(denom > 0)) return null;
    try {
      const base = new Decimal(floorBase);
      const yDec = kMs.div(denom).plus(base);
      const y = yDec.toNumber();
      if (!Number.isFinite(y)) return null;
      return { y, yDec, ms: evalMs };
    } catch {
      return null;
    }
  };

  // No warning banner; visual feedback only
  // No warning banner or unused state
  const clearHover = () => setHover(null);
  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error)
    return (
      <div style={{ ...mono, color: "crimson" }}>error: {String(error)}</div>
    );
  if (visibleSegments.length === 0) return <div style={mono}>no points yet</div>;

  return (
    <div
      style={{ ...mono, position: "relative", width: "100%", overflow: "auto" }}
      ref={containerRef}
    >
      {/* Title outside canvas, aligned with frame */}
      <div
        style={{
          width: drawW + 24 /* frame border (12px) * 2 */,
          margin: "0 auto 8px auto",
          color: "#006100",
          fontWeight: 300,
          fontSize: 22,
          letterSpacing: 0.3,
        }}
      >
        $PATH
      </div>
      {/* Single bold frame with page-matching background */}
      <div
        style={{
          position: "relative",
          width: drawW,
          height: drawH,
          background: "var(--white)",
          border: "12px solid #cfcfcf",
          borderRadius: 0,
          boxShadow: "none",
          margin: "12px auto 0 auto",
        }}
      >
        <svg
          width={drawW}
          height={drawH}
          role="img"
          aria-label="bid points (t_s vs p_fri)"
          style={{ display: "block" }}
        >
          {/* no inner thin edge */}
          {/* Axes aligned to inner plot area */}
          <line
            x1={offsetX}
            y1={offsetY + innerH}
            x2={offsetX + innerW}
            y2={offsetY + innerH}
            stroke="#e5e7eb"
          />
          <line
            x1={offsetX}
            y1={offsetY}
            x2={offsetX}
            y2={offsetY + innerH}
            stroke="#e5e7eb"
          />

          {/* X axis ticks */}
          {xTicks.map((v, i) => {
            const x = xToPx(v);
            const baseY = offsetY + innerH;
            return (
              <g key={`xt-${i}`}>
                <line
                  x1={x}
                  y1={baseY}
                  x2={x}
                  y2={baseY + 4}
                  stroke="#cbd5e1"
                />
                <text
                  x={x}
                  y={baseY + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#64748b"
                >
                  {fmtX(v)}
                </text>
              </g>
            );
          })}

          {/* Y axis ticks */}
          {yTicks.map((v, i) => {
            const y = yToPx(v);
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={offsetX - 4}
                  y1={y}
                  x2={offsetX}
                  y2={y}
                  stroke="#cbd5e1"
                />
                <text
                  x={offsetX - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="#64748b"
                >
                  {fmtY(v)}
                </text>
              </g>
            );
          })}

          {/* Piecewise curve segments: for sale i, draw y = b_i + k/(ms - a_i) until sale i+1 */}
          {kStr && genesisMs > 0 && visibleSegments.length >= 1 && (
            <g>
              {visibleSegments.map(({ s, e }, i) => {
                // The curve between x_i and x_{i+1} uses the current sale's a,b per spec
                if (typeof s.b !== "number") return null;
                const anchorBase =
                  typeof s.aMs === "number" ? s.aMs : s.atMs;
                const bEffBase = s.b;
                // Optionally attribute pumped to current epoch's first ask
                const aEffRaw =
                  useCurrentEpochPump && epoch?.aMs
                    ? epoch.aMs
                    : anchorBase;
                if (!Number.isFinite(aEffRaw)) return null;
                const aEff = Number(aEffRaw);
                const bEff =
                  useCurrentEpochPump && epoch?.b
                    ? Number(epoch.b.dec)
                    : bEffBase;
                const x0 = s.t;
                const x1 = e.t;
                if (!(x1 > x0)) return null;
                const SAMPLES = 80;
                const dx = (x1 - x0) / (SAMPLES - 1 || 1);
                const path: string[] = [];
                let started = false;
                const kMs = new Decimal(kStr).times(1000); // convert sec -> ms
                const params = makeEpochParams(kMs, aEff, bEff);
                for (let j = 0; j < SAMPLES; j++) {
                  const x = x0 + dx * j;
                  const ms = genesisMs + x * 1000;
                  const yDec = priceAtMs(ms, params);
                  if (!yDec.isFinite()) continue;
                  const y = yDec.toNumber();
                  if (!Number.isFinite(y)) continue;
                  const px = xToPx(x);
                  // Force the segment to end exactly at the black dot price for visual alignment
                  if (j === SAMPLES - 1) {
                    const pyEnd = yToPx(e.y);
                    if (!started) {
                      path.push(`M${px.toFixed(2)},${pyEnd.toFixed(2)}`);
                      started = true;
                    } else {
                      path.push(`L${px.toFixed(2)},${pyEnd.toFixed(2)}`);
                    }
                    // Optional: lightweight debug if mismatch seems notable
                    const delta = Math.abs(y - e.y);
                    if (delta > 0.5) {
                      dbgMsgs.push(
                        `[curve-end-mismatch] i=${i} computed=${y.toFixed(
                          4
                        )} vs dot=${e.y.toFixed(4)} (Δ=${delta.toFixed(4)})`
                      );
                    }
                  } else {
                    const py = yToPx(y);
                    if (!started) {
                      path.push(`M${px.toFixed(2)},${py.toFixed(2)}`);
                      started = true;
                    } else {
                      path.push(`L${px.toFixed(2)},${py.toFixed(2)}`);
                    }
                  }
                }
                if (path.length < 2) return null;
                return (
                  <path
                    key={`seg-${i}`}
                    d={path.join(" ")}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={1.25}
                    strokeOpacity={0.9}
                  />
                );
              })}
            </g>
          )}

          {/* no vertical connectors: dots are endpoints of curves by construction */}

          {/* draw dots for each point() */}
          {visibleEndPoints.map((p, i) => {
            const cx = xToPx(p.t);
            const cy = yToPx(p.y);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={3}
                fill="#006100"
                onMouseEnter={() =>
                  setHover({
                    px: cx,
                    py: cy,
                    t: p.t,
                    y: p.y,
                    // pass decimal-string values for accurate formatting
                    dec: p.dec,
                    bDec: p.bDec,
                    atMs: p.atMs,
                    epochIdx: p.epochIdx,
                    kind: "bid",
                  })
                }
                onMouseLeave={clearHover}
              />
            );
          })}

          {/* pumped dots (start point of each curve): y = b + k/(atMs - aMs) */}
          {kStr && (
            <g>
              {visibleSegments.map((seg, i) => {
                const { s, epochIdx } = seg;
                if (typeof s.b !== "number") return null;
                const anchorBase =
                  typeof s.aMs === "number" ? s.aMs : s.atMs;
                const aEffRaw =
                  useCurrentEpochPump && epoch?.aMs
                    ? epoch.aMs
                    : anchorBase;
                if (!Number.isFinite(aEffRaw)) return null;
                const aEff = Number(aEffRaw);
                try {
                  const kMs = new Decimal(kStr).times(1000);
                  const base =
                    useCurrentEpochPump && epoch?.b?.dec
                      ? new Decimal(epoch.b.dec)
                      : s.bDec
                      ? new Decimal(s.bDec)
                      : new Decimal(s.b);
                  const init = initAskAtStart(s, aEff, base, kMs);
                  if (!init) return null;
                  const yStart = init.y;
                  const tInit = Math.max(0, s.t);
                  const cx = xToPx(tInit);
                  const cy = yToPx(yStart);
                  return (
                    <circle
                      key={`pump-${i}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#94a3b8"
                      stroke="#94a3b8"
                      onMouseEnter={() =>
                        setHover({
                          px: cx,
                          py: cy,
                          t: s.t,
                          y: yStart,
                          dec: init.yDec.toFixed(0),
                          bDec: s.bDec,
                          atMs: init.ms,
                          // Attribute to the END epoch of this segment
                          epochIdx: epochIdx,
                          kind: "init",
                        })
                      }
                      onMouseLeave={clearHover}
                    />
                  );
                } catch {
                  return null;
                }
              })}
            </g>
          )}

          {/* dashed connectors bid → init ask (diagonal if x differs) */}
          {kStr && (
            <g>
              {visibleSegments.map(({ s }, i) => {
                if (typeof s.b !== "number") return null;
                const anchorBase =
                  typeof s.aMs === "number" ? s.aMs : s.atMs;
                const aEffRaw =
                  useCurrentEpochPump && epoch?.aMs
                    ? epoch.aMs
                    : anchorBase;
                if (!Number.isFinite(aEffRaw)) {
                  dbgMsgs.push(
                    `[pump-miss] no anchor for seg=${i} atMs=${s.atMs}`
                  );
                  return null;
                }
                const aEff = Number(aEffRaw);
                try {
                  const kMs = new Decimal(kStr).times(1000);
                  const floorBase =
                    useCurrentEpochPump && epoch?.b?.dec
                      ? Number(epoch.b.dec)
                      : s.b;
                  const init = initAskAtStart(s, aEff, floorBase, kMs);
                  if (!init) return null;
                  const x1 = xToPx(s.t);
                  const y1 = yToPx(s.y);
                  const tInit = Math.max(0, s.t);
                  const x2 = xToPx(tInit);
                  const y2 = yToPx(init.y);
                  return (
                    <line
                      key={`conn-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#94a3b8"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.8}
                    />
                  );
                } catch {
                  return null;
                }
              })}
            </g>
          )}

          {/* out-of-range pumped edge markers */}
          {kStr && (
            <g>
              {visibleSegments.map(({ s }, i) => {
                if (typeof s.b !== "number") return null;
                const anchorBase =
                  typeof s.aMs === "number" ? s.aMs : s.atMs;
                const aEffRaw =
                  useCurrentEpochPump && epoch?.aMs
                    ? epoch.aMs
                    : anchorBase;
                if (!Number.isFinite(aEffRaw)) return null;
                const aEff = Number(aEffRaw);
                try {
                  const kMs = new Decimal(kStr).times(1000);
                  const floorBase =
                    useCurrentEpochPump && epoch?.b?.dec
                      ? Number(epoch.b.dec)
                      : s.b;
                  const init = initAskAtStart(s, aEff, floorBase, kMs);
                  if (!init) return null;
                  const yStart = init.y;
                  const tInit = Math.max(0, s.t);
                  const cx = xToPx(tInit);
                  // if pumped y outside domain, draw a small chevron at edge
                  if (yStart > yDomain[1]) {
                    const yEdge = yToPx(yDomain[1]);
                    return (
                      <g key={`edge-top-${i}`}>
                        <path
                          d={`M${cx - 4},${yEdge + 6} L${cx},${yEdge} L${
                            cx + 4
                          },${yEdge + 6}`}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  }
                  if (yStart < yDomain[0]) {
                    const yEdge = yToPx(yDomain[0]);
                    return (
                      <g key={`edge-bot-${i}`}>
                        <path
                          d={`M${cx - 4},${yEdge - 6} L${cx},${yEdge} L${
                            cx + 4
                          },${yEdge - 6}`}
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth={1}
                        />
                      </g>
                    );
                  }
                  return null;
                } catch {
                  return null;
                }
              })}
            </g>
          )}

          {/* HTML tooltip overlay (absolutely positioned) */}
          {hover && <></>}
        </svg>
        {hover && (
          <div
            style={{
              position: "absolute",
              left: `${Math.min(Math.max(hover.px + 8, 0), drawW - 160)}px`,
              top: `${Math.min(Math.max(hover.py - 8 - 44, 0), drawH - 60)}px`,
              width: 160,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: "white",
                border: "1px solid #CBD5E1",
                borderRadius: 6,
                boxShadow: "none",
                padding: "6px 8px",
                fontSize: 12,
                color: "#0f172a",
                lineHeight: 1.35,
              }}
            >
              <div style={{ color: "#64748b", marginBottom: 2 }}>
                {hover.kind === "bid" ? "bid" : "init ask"}
              </div>
              <div>
                <span style={{ color: "#64748b" }}>epoch_idx:</span>{" "}
                {hover.epochIdx ?? "-"}
              </div>
              <div>
                <span style={{ color: "#64748b" }}>time:</span>{" "}
                {hover.atMs ? new Date(hover.atMs).toLocaleString() : "-"}
              </div>
              <div>
                <span style={{ color: "#64748b" }}>p_fri:</span>{" "}
                {(() => {
                  const decStr = hover.dec ?? String(Math.floor(hover.y));
                  return /[^0-9]/.test(decStr)
                    ? decStr
                    : formatIntString(decStr);
                })()}
              </div>
              <div>
                <span style={{ color: "#64748b" }}>p_scaled:</span>{" "}
                {(() => {
                  try {
                    const decStr = hover.dec ?? String(Math.floor(hover.y));
                    const decimals = props.decimals ?? 18;
                    const val = new Decimal(decStr).div(
                      new Decimal(10).pow(decimals)
                    );
                    return val.toNumber().toLocaleString("en-US", {
                      maximumFractionDigits: 6,
                    });
                  } catch {
                    return "-";
                  }
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
      {dbgMsgs.length > 0 && (
        <div
          style={{
            position: "relative",
            width: drawW + 24,
            margin: "6px auto 0 auto",
            fontSize: 11,
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: "6px 8px",
            borderRadius: 4,
            maxHeight: 120,
            overflow: "auto",
          }}
        >
          {dbgMsgs.map((m, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap" }}>
              {m}
            </div>
          ))}
        </div>
      )}

      {/* Controls outside canvas: below frame, flat style */}
      <div
        style={{
          width: drawW + 24 /* match frame outer width */,
          margin: "10px auto 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="ctrl-wrap">
            <input
              type="number"
              value={epochMin ?? epochBounds.min ?? ""}
              min={epochBounds.min ?? undefined}
              max={epochBounds.max ?? undefined}
              onChange={(e) => {
                const raw =
                  e.target.value === "" ? undefined : Number(e.target.value);
                if (raw === undefined || !Number.isFinite(raw)) {
                  setEpochMin(undefined);
                  return;
                }
                const lo = epochBounds.min;
                const hi = epochBounds.max;
                let v = raw;
                let warn: string | null = null;
                if (lo !== undefined && v < lo) {
                  v = lo;
                  warn = `min clipped to ${lo}`;
                }
                if (hi !== undefined && v > hi) {
                  v = hi;
                  warn = `min clipped to ${hi}`;
                }
                // keep min <= max if both set
                if (epochMax !== undefined && v > epochMax) {
                  warn = `min cannot exceed max (${epochMax})`;
                  v = epochMax;
                }
                setEpochMin(v);
                // Visual response: add one-shot flash when clamped
                if (warn) {
                  const wrap = (e.target as HTMLInputElement).parentElement;
                  if (wrap) {
                    wrap.classList.remove("flash-once", "shake-once");
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    wrap.offsetWidth;
                    wrap.classList.add("flash-once", "shake-once");
                    // Also animate the input itself (border/background)
                    const el = e.target as HTMLInputElement;
                    el.classList.remove("flash-once", "shake-once");
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    el.offsetWidth;
                    el.classList.add("flash-once", "shake-once");
                    const handle = () => {
                      wrap.classList.remove("shake-once");
                      wrap?.removeEventListener("animationend", handle);
                    };
                    wrap.addEventListener("animationend", handle);
                  }
                }
              }}
              placeholder={
                epochBounds.min !== undefined ? String(epochBounds.min) : "min"
              }
              style={{
                width: 100,
                padding: "6px 8px",
                border: "1px solid #cfcfcf",
                borderRadius: 0,
                background: "#fff",
                fontWeight: 300,
              }}
            />
          </div>
          <span style={{ color: "#64748b", fontWeight: 300 }}>–</span>
          <div className="ctrl-wrap">
            <input
              type="number"
              value={epochMax ?? epochBounds.max ?? ""}
              min={epochBounds.min ?? undefined}
              max={epochBounds.max ?? undefined}
              onChange={(e) => {
                const raw =
                  e.target.value === "" ? undefined : Number(e.target.value);
                if (raw === undefined || !Number.isFinite(raw)) {
                  setEpochMax(undefined);
                  return;
                }
                const lo = epochBounds.min;
                const hi = epochBounds.max;
                let v = raw;
                let warn: string | null = null;
                if (lo !== undefined && v < lo) {
                  v = lo;
                  warn = `max raised to ${lo}`;
                }
                if (hi !== undefined && v > hi) {
                  v = hi;
                  warn = `max clipped to ${hi}`;
                }
                // keep max >= min if both set
                if (epochMin !== undefined && v < epochMin) {
                  warn = `max cannot be below min (${epochMin})`;
                  v = epochMin;
                }
                setEpochMax(v);
                if (warn) {
                  const wrap = (e.target as HTMLInputElement).parentElement;
                  if (wrap) {
                    wrap.classList.remove("flash-once", "shake-once");
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    wrap.offsetWidth;
                    wrap.classList.add("flash-once", "shake-once");
                    const el = e.target as HTMLInputElement;
                    el.classList.remove("flash-once", "shake-once");
                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    el.offsetWidth;
                    el.classList.add("flash-once", "shake-once");
                    const handle = () => {
                      wrap.classList.remove("shake-once");
                      wrap?.removeEventListener("animationend", handle);
                    };
                    wrap.addEventListener("animationend", handle);
                  }
                }
              }}
              placeholder={
                epochBounds.max !== undefined ? String(epochBounds.max) : "max"
              }
              style={{
                width: 100,
                padding: "6px 8px",
                border: "1px solid #cfcfcf",
                borderRadius: 0,
                background: "#fff",
                fontWeight: 300,
              }}
            />
          </div>
          {/* green legend line and label */}
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 22,
              height: 2,
              background: "#006100",
              marginLeft: 6,
            }}
          />
          <span style={{ color: "#006100", fontSize: 14, fontWeight: 300 }}>
            epochs
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            /* TODO: wire mint action */
          }}
          style={{
            background: "transparent",
            color: "#006100",
            border: "1px solid #006100",
            borderRadius: 0,
            padding: "6px 16px",
            fontWeight: 200,
            fontFamily:
              '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 18,
            letterSpacing: 0.2,
            boxShadow: "none",
          }}
        >
          mint
        </button>
      </div>
      {/* options */}
      <div
        style={{
          width: drawW + 24,
          margin: "8px auto 0 auto",
          display: "flex",
          gap: 12,
          alignItems: "center",
          color: "#334155",
          fontSize: 12,
        }}
      >
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={useCurrentEpochPump}
            onChange={(e) => setUseCurrentEpochPump(e.target.checked)}
          />
          attribute pumped to current epoch
        </label>
      </div>
      {/* warning banner omitted per request */}
      {/* Pagination removed */}
    </div>
  );
}

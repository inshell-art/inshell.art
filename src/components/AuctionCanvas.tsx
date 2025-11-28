import { useEffect, useMemo, useState } from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { ProviderInterface } from "starknet";
import { toFixed } from "@/num";
import type { AbiSource } from "@/types/types";
import type { NormalizedBid } from "@/services/auction/bidsService";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { Contract } from "starknet";
import { resolveAddress } from "@/protocol/addressBook";
import { getDefaultProvider } from "@/protocol/contracts";
import { readU256, toU256Num } from "@/num";
import PulseAuctionRaw from "@/abi/devnet/PulseAuction.json";

type Props = {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
  refreshMs?: number;
  decimals?: number;
  maxBids?: number;
};

function toNumberSafe(v: string | number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortAmount(val: string) {
  if (val.length > 8) {
    const n = Number(val);
    if (Number.isFinite(n)) return n.toFixed(2);
    return val.slice(0, 8) + "…";
  }
  return val;
}

type DotPoint = {
  x: number;
  y: number;
  key: string;
  screenX?: number;
  screenY?: number;
  bidder?: string;
  amount: string;
  atMs: number;
  block?: number;
  epoch?: number;
};

function toSafeNumber(val: string | number | bigint | undefined): number {
  if (val === undefined) return Number.NaN;
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const s = val.trim();
    const direct = Number(s);
    if (Number.isFinite(direct)) return direct;
    if (/^0x[0-9a-f]+$/i.test(s)) {
      try {
        return Number(BigInt(s));
      } catch {
        return Number.NaN;
      }
    }
    const f = Number.parseFloat(s);
    if (Number.isFinite(f)) return f;
    try {
      return Number(BigInt(s));
    } catch {
      return Number.NaN;
    }
  }
  return Number.NaN;
}

function pickNumber(
  ...vals: Array<string | number | bigint | undefined>
): number {
  for (const v of vals) {
    const n = toSafeNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

export default function AuctionCanvas({
  address,
  provider,
  abiSource,
  refreshMs = 4000,
  decimals = 18,
  maxBids = 800,
}: Props) {
  const { bids, ready, loading } = useAuctionBids({
    address: address ?? "0x0",
    provider,
    refreshMs,
    enabled: Boolean(address),
    maxBids,
  });
  const {
    data: core,
    ready: coreReady,
    loading: coreLoading,
    error: coreError,
    refresh: refreshCore,
  } = useAuctionCore({
    address,
    provider,
    refreshMs,
    abiSource,
  });

  const [hover, setHover] = useState<DotPoint | null>(null);
  const [view, setView] = useState<"curve" | "bids">("curve");
  const [fallbackConfig, setFallbackConfig] = useState<null | {
    openTimeSec: number;
    genesisPrice: { dec: string; value: bigint };
    genesisFloor: { dec: string; value: bigint };
    k: { dec: string; value: bigint };
    pts: string;
  }>(null);
  const [fallbackError, setFallbackError] = useState<unknown>(null);

  // If the core service is ready but data hasn't landed, trigger a fetch.
  useEffect(() => {
    if (coreReady && !core && !coreLoading) {
      void refreshCore();
    }
  }, [coreReady, core, coreLoading, refreshCore]);

  // Fallback: fetch config directly if the core hook never fills it.
  useEffect(() => {
    let cancelled = false;
    if (core?.config) {
      if (fallbackConfig) setFallbackConfig(null);
      return;
    }
    (async () => {
      try {
        setFallbackError(null);
        const addr = address ?? resolveAddress("pulse_auction");
        const prov = provider ?? (getDefaultProvider() as any);
        const res: any = await prov.callContract({
          contractAddress: addr,
          entrypoint: "get_config",
          calldata: [],
        });
        const out: any[] = res?.result ?? res;
        if (!Array.isArray(out) || out.length < 5) {
          throw new Error("unexpected get_config shape");
        }
        const r: any = {
          open_time: out[0],
          genesis_price: { low: out[1], high: out[2] },
          genesis_floor: { low: out[3], high: out[4] },
          k: { low: out[5], high: out[6] },
          pts: out[7],
        };
        if (cancelled) return;
        const open = Number(r.open_time);
        const gp = readU256(r.genesis_price);
        const gf = readU256(r.genesis_floor);
        const k = readU256(r.k);
        const pts = String(r.pts);
        setFallbackConfig({
          openTimeSec: open,
          genesisPrice: toU256Num(gp),
          genesisFloor: toU256Num(gf),
          k: toU256Num(k),
          pts,
        });
      } catch (e) {
        if (!cancelled) setFallbackError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [core, address, provider, abiSource, fallbackConfig]);

  const dots = useMemo(() => {
    if (!bids.length) return { points: [], label: "" };

    // Throttle density: sample when too many
    const step = Math.max(1, Math.ceil(bids.length / 400));
    const sampled: NormalizedBid[] = bids.filter(
      (_: NormalizedBid, idx: number) => idx % step === 0
    );

    const minX = Math.min(...sampled.map((b: NormalizedBid) => b.atMs));
    const maxX = Math.max(...sampled.map((b: NormalizedBid) => b.atMs));
    const minY = Math.min(
      ...sampled.map((b: NormalizedBid) =>
        toNumberSafe(toFixed(b.amount, decimals))
      )
    );
    const maxY = Math.max(
      ...sampled.map((b: NormalizedBid) =>
        toNumberSafe(toFixed(b.amount, decimals))
      )
    );

    const padY = (maxY - minY || 1) * 0.1;
    const viewYMin = minY - padY;
    const viewYMax = maxY + padY;
    const w = 100;
    const h = 60;

    const toSvg = (atMs: number, price: number) => {
      const xN = (atMs - minX) / (maxX - minX || 1);
      const yN = (price - viewYMin) / (viewYMax - viewYMin || 1);
      return { x: xN * w, y: h - yN * h };
    };

    const points: DotPoint[] = sampled.map((b: NormalizedBid) => {
      const p = toSvg(b.atMs, toNumberSafe(toFixed(b.amount, decimals)));
      return {
        ...p,
        key: b.key,
        bidder: b.bidder,
        amount: toFixed(b.amount, decimals),
        atMs: b.atMs,
        block: b.blockNumber,
        epoch: b.epochIndex,
      };
    });

    return { points, w, h };
  }, [bids, decimals]);

  const activeConfig = core?.config ?? fallbackConfig ?? null;

  const { curve, reason } = useMemo(() => {
    if (!activeConfig)
      return {
        curve: null,
        reason: coreLoading
          ? "loading"
          : fallbackError
          ? `fallback error: ${String(fallbackError)}`
          : "no config",
      };
    const kParsed = pickNumber(
      activeConfig.k?.dec,
      (activeConfig as any).k?.value
    );
    const ptsParsed = pickNumber(activeConfig.pts || "0");
    if (!Number.isFinite(kParsed) || !Number.isFinite(ptsParsed)) {
      return {
        curve: null,
        reason: "invalid k/pts",
      };
    }

    const baseFloor = pickNumber(
      activeConfig.genesisFloor?.dec,
      activeConfig.genesisPrice?.dec,
      (activeConfig as any).genesisFloor?.value,
      (activeConfig as any).genesisPrice?.value
    );

    if (!bids.length) {
      // no bids yet → seed with genesis price/floor for a flat baseline
      const k = kParsed;
      const pts = ptsParsed;
      if (pts <= 0) return { curve: null, reason: "pts<=0 (no bids)" };
      if (!Number.isFinite(baseFloor))
        return { curve: null, reason: "no floor (no bids)" };
      const nowSec = Date.now() / 1000;
      const startSec = activeConfig.openTimeSec;
      const ask = baseFloor + pts * Math.max(1, nowSec - startSec);
      return {
        curve: {
          points: [
            { x: startSec, y: ask },
            { x: nowSec, y: ask },
          ],
          ask,
          floor: baseFloor,
          startSec,
          endSec: nowSec,
        },
        reason: null,
      };
    }

    const last = bids[bids.length - 1];
    const prev = bids[bids.length - 2];

    const k = kParsed;
    const pts = ptsParsed;
    if (k <= 0 || pts <= 0) {
      return { curve: null, reason: "non-positive k/pts" };
    }

    const lastSec = last.atMs / 1000;
    const prevSec =
      (prev?.atMs ?? activeConfig.openTimeSec * 1000) / 1000 || lastSec;
    const dtSec = Math.max(1, lastSec - prevSec);

    const premium = pts * dtSec;
    if (!Number.isFinite(premium)) {
      return { curve: null, reason: "premium not finite" };
    }

    const floor = pickNumber(
      (last as any)?.floor?.dec,
      last.amount?.dec,
      last.amount?.value,
      baseFloor
    );
    if (!Number.isFinite(floor)) {
      return { curve: null, reason: "floor not finite" };
    }
    const ask = floor + premium;

    const anchor = lastSec - k / premium;
    const nowSec = Math.max(lastSec + 1, Date.now() / 1000);

    const samples = 120;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = lastSec + ((nowSec - lastSec) * i) / samples;
      const denom = t - anchor;
      if (denom <= 0) continue;
      const y = k / denom + floor;
      if (Number.isFinite(y)) points.push({ x: t, y });
    }

    if (!points.length) return { curve: null, reason: "no curve points" };

    return {
      curve: {
        points,
        ask,
        floor,
        startSec: lastSec,
        endSec: nowSec,
      },
      reason: null,
    };
  }, [bids, coreLoading, activeConfig, fallbackError]);

  const showBids = view === "bids";
  const showCurve = view === "curve";

  return (
    <div className="panel dotfield">
      <div className="dotfield__header">
        <div>
          <h1 className="headline dotfield__title thin">$PATH</h1>
        </div>
        <div className="dotfield__tabs">
          <button
            className={`dotfield__tab ${showCurve ? "is-active" : ""}`}
            onClick={() => setView("curve")}
          >
            mint
          </button>
          <button
            className={`dotfield__tab ${showBids ? "is-active" : ""}`}
            onClick={() => {
              setHover(null);
              setView("bids");
            }}
          >
            bids
          </button>
        </div>
      </div>
      {showCurve && (
        <>
          {!coreReady && coreLoading && (
            <div className="dotfield__canvas">
              <div className="muted">loading curve…</div>
            </div>
          )}
          {coreError && (
            <div className="dotfield__canvas">
              <div className="muted">
                error loading curve: {String(coreError)}
              </div>
            </div>
          )}
          {coreReady && curve && (
            <>
              <div className="dotfield__canvas">
                <svg
                  viewBox={`0 0 100 60`}
                  role="img"
                  aria-label="Pulse curve"
                >
                  {(() => {
                    const pts = curve.points;
                    if (!pts.length) return null;
                    const minX = Math.min(...pts.map((p) => p.x));
                    const maxX = Math.max(...pts.map((p) => p.x));
                    const ys = [
                      ...pts.map((p) => p.y),
                      curve.ask,
                      curve.floor,
                    ];
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const toSvg = (x: number, y: number) => {
                      const xN = (x - minX) / (maxX - minX || 1);
                      const yN = (y - minY) / (maxY - minY || 1);
                      return { x: xN * 100, y: 60 - yN * 60 };
                    };
                    const pathD = pts
                      .map((p, i) => {
                        const { x, y } = toSvg(p.x, p.y);
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ");
                    const askPt = toSvg(curve.startSec, curve.ask);
                    const floorPt = toSvg(curve.startSec, curve.floor);
                    return (
                      <>
                        <path
                          className="dotfield__curve"
                          d={pathD}
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={askPt.x}
                          cy={askPt.y}
                          r={0.9}
                          className="dotfield__ask"
                        />
                        <circle
                          cx={floorPt.x}
                          cy={floorPt.y}
                          r={0.7}
                          className="dotfield__dot"
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
              <div className="dotfield__axes muted small">
                <span>time →</span>
                <span>price ↑</span>
              </div>
            </>
          )}
          {coreReady && !curve && (
            <div className="dotfield__canvas">
              <div className="muted">
                waiting for bids…
                {reason ? <span className="small"> ({reason})</span> : null}
              </div>
            </div>
          )}
        </>
      )}

      {showBids && (
        <>
          {!ready && loading && (
            <div className="dotfield__canvas">
              <div className="muted">loading field…</div>
            </div>
          )}
          {ready && !dots.points.length && (
            <div className="dotfield__canvas">
              <div className="muted">no bids yet</div>
            </div>
          )}
          {ready && dots.points.length > 0 && (
            <>
              <div className="dotfield__canvas">
                <svg
                  viewBox={`0 0 ${dots.w} ${dots.h}`}
                  role="img"
                  aria-label="Pulse dots"
                >
                  {dots.points.map((p) => (
                    <g key={p.key} className="dotfield__point">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="0.5"
                        className="dotfield__dot"
                        onMouseMove={(e) => {
                          setHover({
                            ...p,
                            screenX: e.clientX + 8,
                            screenY: e.clientY + 8,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="0.65"
                        className="dotfield__halo"
                      />
                    </g>
                  ))}
                </svg>
                {hover && (
                  <div
                    className="dotfield__popover"
                    style={{ left: hover.screenX, top: hover.screenY }}
                  >
                    <div className="muted small">bid #{hover.epoch ?? "—"}</div>
                    <div className="dotfield__poprow">
                      <span>amount</span>
                      <span>{shortAmount(hover.amount)} STRK</span>
                    </div>
                    <div className="dotfield__poprow">
                      <span>bidder</span>
                      <span>{shortAddr(hover.bidder)}</span>
                    </div>
                    <div className="dotfield__poprow">
                      <span>time</span>
                      <span>
                        {new Date(hover.atMs)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="dotfield__axes muted small">
                <span>time →</span>
                <span>price ↑</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

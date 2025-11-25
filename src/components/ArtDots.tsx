import { useMemo, useState } from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { ProviderInterface } from "starknet";
import { toFixed } from "@/num";
import type { AbiSource } from "@/types/types";
import type { NormalizedBid } from "@/services/auction/bidsService";

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

export default function ArtDots({
  address,
  provider,
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
  const [hover, setHover] = useState<DotPoint | null>(null);

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

  if (!ready && loading) {
    return (
      <div className="panel">
        <div className="muted">loading field…</div>
      </div>
    );
  }

  if (!dots.points.length) {
    return (
      <div className="panel">
        <div className="muted">no dots yet</div>
      </div>
    );
  }

  return (
    <div className="panel dotfield">
      <div className="dotfield__header">
        <div>
          <h1 className="headline dotfield__title thin">$PATH</h1>
        </div>
        <button className="ghost cta-btn">mint</button>
      </div>
      <div className="dotfield__canvas">
        <svg
          viewBox={`0 0 ${dots.w} ${dots.h}`}
          role="img"
          aria-label="Pulse dots"
        >
          {dots.points.map((p) => (
            <circle
              key={p.key}
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
          ))}
        </svg>
        {hover && (
          <div
            className="dotfield__popover"
            style={{ left: hover.screenX, top: hover.screenY }}
          >
            <div className="muted small">bid · epoch {hover.epoch ?? "—"}</div>
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
              <span>{new Date(hover.atMs).toLocaleString()}</span>
            </div>
            <div className="dotfield__poprow">
              <span>block</span>
              <span>{hover.block ?? "—"}</span>
            </div>
          </div>
        )}
      </div>
      <div className="dotfield__axes muted small">
        <span>time →</span>
        <span>price ↑</span>
      </div>
    </div>
  );
}

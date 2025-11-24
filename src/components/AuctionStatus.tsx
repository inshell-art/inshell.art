import { useMemo, useState } from "react";
import type { ProviderInterface } from "starknet";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { formatU256Dec, toFixed, type U256Num } from "@/num";
import type { AbiSource } from "@/types/types";

type Props = {
  address?: string;
  abiSource?: AbiSource;
  provider?: ProviderInterface;
  refreshMs?: number;
  decimals?: number;
  maxBids?: number;
};

function fmtRelative(targetMs: number | undefined) {
  if (!targetMs) return "—";
  const diff = targetMs - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 1000 / 60);
  if (minutes === 0) return diff >= 0 ? "in moments" : "just now";
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const value = days > 0 ? days : hours > 0 ? hours : minutes;
  const unit = days > 0 ? "d" : hours > 0 ? "h" : "m";
  return diff >= 0 ? `in ${value}${unit}` : `${value}${unit} ago`;
}

function shorten(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function amountPair(amount: U256Num, decimals: number) {
  return {
    scaled: toFixed(amount, decimals),
  };
}

export default function AuctionStatus({
  address,
  abiSource,
  provider,
  refreshMs = 4000,
  decimals = 18,
  maxBids = 200,
}: Props) {
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const {
    data,
    loading,
    error,
    ready,
    refresh: refreshCore,
  } = useAuctionCore({
    address,
    abiSource,
    provider,
    refreshMs,
  });

  const {
    bids,
    loading: bidsLoading,
    error: bidsError,
    ready: bidsReady,
    pullOnce: refreshBids,
  } = useAuctionBids({
    address: address ?? "0x0",
    provider,
    refreshMs,
    enabled: Boolean(address),
    maxBids,
  });

  const topBids = useMemo(
    () => bids.slice(-12).reverse(),
    [bids]
  );

  const lastBid = topBids[0];
  const hasError = error || bidsError;

  const handleRefresh = async () => {
    await Promise.all([refreshCore(), refreshBids()]);
    setLastRefresh(Date.now());
  };

  if (!ready && loading) {
    return (
      <div className="panel">
        <div className="muted">Connecting to auction…</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="panel error">
        <div className="title">Auction status</div>
        <div className="muted">
          {String(error ?? bidsError)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel">
        <div className="title">Auction status</div>
        <div className="muted">No data yet.</div>
      </div>
    );
  }

  const { config, active } = data;
  const openMs = config.openTimeSec * 1000;
  const nowSec = Date.now() / 1000;
  const upcoming = nowSec < config.openTimeSec;
  const awaitingGenesis = !upcoming && !active;
  const statusLabel = upcoming
    ? "Upcoming"
    : active
    ? "Active"
    : "Awaiting genesis";
  const statusClass = upcoming
    ? "pill pill--pending"
    : active
    ? "pill pill--on"
    : "pill pill--open";
  const price = amountPair(data.price, decimals);
  const genesisPrice = amountPair(config.genesisPrice, decimals);
  const genesisFloor = amountPair(config.genesisFloor, decimals);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <div className="eyebrow">PULSE · price is belief unfolding in time</div>
          <h1 className="headline">PATH · pulse field</h1>
          <div className="muted">
            Live Decentralized Automatic Auction for PATH passes — each bid a
            beat on the belief curve.
          </div>
        </div>
        <div className="actions">
          <button className="ghost" onClick={handleRefresh}>Sync now</button>
          <div className={statusClass}>{statusLabel}</div>
        </div>
      </header>

      <section className="grid">
        <div className="card emphasis">
          <div className="card__label">Ask now</div>
          <div className="card__value">{price.scaled} STRK</div>
          <div className="card__meta">
            Live on-chain ask · current point on the pulse curve.
          </div>
        </div>

        <div className="card">
          <div className="card__label">Last beat</div>
          <div className="card__value">
            {lastBid ? `${toFixed(lastBid.amount, decimals)} STRK` : "—"}
          </div>
          <div className="card__meta">
            {lastBid
              ? `${shorten(lastBid.bidder)} · ${new Date(
                  lastBid.atMs
                ).toLocaleTimeString()}`
              : "Most recent step cleared · waiting for bids"}
          </div>
        </div>

        <div className="card">
          <div className="card__label">Opened</div>
          <div className="card__value">
            {new Date(openMs).toLocaleString()}
          </div>
          <div className="card__meta">
            {fmtRelative(openMs)}
            {awaitingGenesis && " · awaiting first beat"}
          </div>
        </div>

        <div className="card">
          <div className="card__label">Curve seed</div>
          <div className="card__value">{genesisPrice.scaled} STRK</div>
          <div className="card__meta">
            floor {genesisFloor.scaled} STRK · k {formatU256Dec(config.k)} · pts{" "}
            {config.pts}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">
          <div>
            <div className="title">Mathematical canvas</div>
            <div className="muted small">
              Hyperbola f(x) = k / (x − a) + b · updated with each beat.
            </div>
          </div>
        </div>
        <div className="muted">
          One constant (k), one floor (b), one anchor (a) — price is belief
          unfolding in time. Each bid resets a and b; waiting lets the ask
          descend along the curve.
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">
          <div>
            <div className="title">Crowd rhythm</div>
            <div className="muted small">
              Streaming from contract events · each bid sets the next beat ·
              showing {topBids.length} of {bids.length} moments
            </div>
          </div>
          <div className="muted small">
            {bidsReady
              ? bidsLoading
                ? "polling…"
                : "live"
              : "initializing…"}
          </div>
        </div>
        {topBids.length === 0 ? (
          <div className="muted">No bids yet.</div>
        ) : (
          <div className="bids">
            {topBids.map((bid) => (
              <div key={bid.key} className="bid">
                <div className="bid__amount">
                  {toFixed(bid.amount, decimals)} STRK
                </div>
                <div className="bid__meta">
                  <span>{new Date(bid.atMs).toLocaleString()}</span>
                  <span>{shorten(bid.bidder)}</span>
                  <span>block {bid.blockNumber ?? "—"} · beat</span>
                  <span className="muted">
                    {bid.txHash
                      ? `${bid.txHash.slice(0, 10)}…${bid.txHash.slice(-6)}`
                      : bid.id ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="muted small">
        {lastRefresh
          ? `Manual refresh ${fmtRelative(lastRefresh)}`
          : "Auto-refreshing every few seconds"}
        {address && ` · Auction ${shorten(address)}`}
      </footer>
    </div>
  );
}

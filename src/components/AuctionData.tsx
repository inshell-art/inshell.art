import { useEffect, useMemo, useRef, useState } from "react";
import { toFixed, formatU256Dec, type U256Num } from "@/num";
import Decimal from "decimal.js";
import { priceAtMs, makeEpochParams } from "@/domain/pulseMath";
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

// no chart/graph/curve in this component

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

function formatIntString(s: string): string {
  return /[^0-9]/.test(s) ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    epoch: bidsEpoch,
  } = useAuctionBids({
    address: props.address ?? "0x0",
    refreshMs: props.refreshMs ?? 4000,
    enabled: bidsEnabled,
    maxBids: props.maxBids ?? 200,
  });

  const decimals = props.decimals ?? 18;
  const MAX_BIDS = props.maxBids ?? 100;

  // no sparkline series: we keep this component to present data only

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

  // no sparkline path
  const sortedBids = useMemo(
    () => bids.slice().sort((a, b) => a.atMs - b.atMs),
    [bids]
  );

  const genesisMs = useMemo(() => {
    if (!sortedBids.length) return undefined;
    return sortedBids[0].atMs;
  }, [sortedBids]);

  const kMsDec = useMemo(() => {
    const kStr =
      bidsEpoch?.k?.dec ?? (data as any)?.config?.k?.dec ?? undefined;
    if (!kStr) return undefined;
    try {
      return new Decimal(kStr).times(1000);
    } catch {
      return undefined;
    }
  }, [bidsEpoch?.k?.dec, data]);

  const computeInitPoint = (
    idx: number
  ): { xSec: number; yFri: string } | null => {
    if (!kMsDec) return null;
    if (typeof genesisMs !== "number") return null;
    const bid = sortedBids[idx];
    if (!bid) return null;
    if (idx === 0) return null;
    const prev = sortedBids[idx - 1];
    const anchorMs =
      typeof bid.anchorMs === "number"
        ? bid.anchorMs
        : typeof prev.anchorMs === "number"
        ? prev.anchorMs
        : prev.atMs;
    const floorDec =
      bid.floor?.dec ??
      prev.floor?.dec ??
      bidsEpoch?.b?.dec ??
      prev.amount.dec;
    if (typeof anchorMs !== "number" || !floorDec) return null;
    try {
      const params = makeEpochParams(kMsDec, anchorMs, floorDec);
      const evalMs = anchorMs + 1;
      if (!(evalMs > anchorMs)) return null;
      const yDec = priceAtMs(evalMs, params);
      if (!yDec.isFinite()) return null;
      const prevSec = (prev.atMs - genesisMs) / 1000;
      const xSec = Math.max(0, Math.floor(prevSec));
      return { xSec, yFri: yDec.toFixed(0) };
    } catch {
      return null;
    }
  };

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
  const openMs = config.openTimeSec * 1000;
  // no separate pointsList; Points section is generated inline below

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

      {/* chart removed: this component only presents data */}

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
                    Amount (fri)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    Amount (scaled)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    a - open (ms)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    b (int)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    epoch
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    bid (t_s, p_fri)
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>
                    init ask (t_s, p_fri)
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>
                    Tx Hash / ID
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBids.map((b, idx) => (
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
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {typeof b.anchorMs === "number"
                        ? b.anchorMs - openMs
                        : ""}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {b.floor ? formatU256Dec(b.floor) : ""}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {typeof b.epochIndex === "number" ? b.epochIndex : ""}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {typeof genesisMs === "number"
                        ? `(${Math.floor(
                            (b.atMs - genesisMs) / 1000
                          )}, ${formatU256Dec(b.amount)})`
                        : ""}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                      {typeof genesisMs === "number"
                        ? (() => {
                            const init = computeInitPoint(idx);
                            return init
                              ? `(${init.xSec}, ${formatIntString(
                                  init.yFri
                                )})`
                              : "";
                          })()
                        : ""}
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

      {/* Points list: epoch n: init ask(x,y), bid(x,y) */}
      <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Points</div>
      {typeof genesisMs !== "number" || bids.length === 0 ? (
        <div style={{ color: "#6b7280" }}>no points yet</div>
      ) : (
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {sortedBids
            .map((b, idx) => {
              const epochIdx =
                typeof b.epochIndex === "number" ? b.epochIndex : "-";
              const bidX = Math.floor((b.atMs - genesisMs) / 1000);
              const bidY = formatU256Dec(b.amount);
              const init = computeInitPoint(idx);
              const initPair = init
                ? `(${init.xSec}, ${formatIntString(init.yFri)})`
                : "(—)";
              return `epoch ${epochIdx}: init ask${initPair}, bid(${bidX}, ${bidY})`;
            })
            .join("\n")}
        </pre>
      )}
      </div>

      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        decimals={decimals} · bids={bids.length}
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

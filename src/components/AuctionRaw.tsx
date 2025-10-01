import { useAuction } from "@/hooks/useAuction";

const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" };

export default function AuctionRaw(props: {
  address?: string;                 // optional override (else from env via protocol layer)
  refreshMs?: number;               // default 4000
  abiSource?: "artifact" | "node" | "auto";
}) {
  const { data, loading, error, refresh, ready } = useAuction({
    address: props.address,
    refreshMs: props.refreshMs ?? 4000,
    abiSource: props.abiSource ?? "auto",
  });

  if (!ready || loading) return <div style={mono}>loading…</div>;
  if (error) return <div style={{ ...mono, color: "crimson", whiteSpace: "pre-wrap" }}>error: {String(error)}</div>;
  if (!data) return <div style={mono}>no data</div>;

  const { active, price, config } = data;

  return (
    <div style={{ ...mono, border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, lineHeight: 1.4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong>Pulse Auction</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div>curve_active: {String(active)}</div>

      <div style={{ marginTop: 8 }}>
        <strong>current_price</strong>
        <div>u256.low:  {price.raw.low}</div>
        <div>u256.high: {price.raw.high}</div>
        <div>decimal:   {price.asDec}</div>
      </div>

      <div style={{ marginTop: 8 }}>
        <strong>config</strong>
        <div>open_time: {config.openTimeSec} ({new Date(config.openTimeSec * 1000).toISOString()})</div>
        <div>genesis_price: low={config.genesisPrice.raw.low} high={config.genesisPrice.raw.high} dec={config.genesisPrice.asDec}</div>
        <div>genesis_floor: low={config.genesisFloor.raw.low} high={config.genesisFloor.raw.high} dec={config.genesisFloor.asDec}</div>
        <div>k: low={config.k.raw.low} high={config.k.raw.high} dec={config.k.asDec}</div>
        <div>pts: {config.pts}</div>
      </div>
    </div>
  );
}

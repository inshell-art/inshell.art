import { addresses, rpcUrl } from "../config/env";
import { usePulseStatus } from "../hooks/usePulseStatus";

export default function PulseStatusPage() {
  const { data, error } = usePulseStatus(3000);

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h2>PATH · Pulse wiring (devnet)</h2>
      <div>RPC: <code>{rpcUrl}</code></div>
      <ul>
        <li>PULSE_AUCTION: <code>{addresses.PULSE_AUCTION}</code></li>
        <li>PATH_ADAPTER : <code>{addresses.PATH_ADAPTER}</code></li>
        <li>PATH_MINTER  : <code>{addresses.PATH_MINTER}</code></li>
        <li>PATH_NFT     : <code>{addresses.PATH_NFT}</code></li>
      </ul>

      <hr />

      {error && <div style={{ color: "crimson" }}><b>Error:</b> {error}</div>}

      {!data ? (
        <div>Loading…</div>
      ) : (
        <div>
          <p>
            NFT → Minter (MINTER_ROLE):{" "}
            <b style={{ color: data.nftMinterRole ? "green" : "crimson" }}>
              {data.nftMinterRole ? "OK" : "MISSING"}
            </b>
          </p>
          <p>
            Minter → Adapter (SALES_ROLE):{" "}
            <b style={{ color: data.minterSalesRole ? "green" : "crimson" }}>
              {data.minterSalesRole ? "OK" : "MISSING"}
            </b>
          </p>
          <p>
            Adapter.auction wired: <code>{data.details.adapterAuction}</code>{" "}
            {data.adapterAuctionOk ? "✅" : "❌"}
          </p>
          <p>
            Adapter.minter wired: <code>{data.details.adapterMinter}</code>{" "}
            {data.adapterMinterOk ? "✅" : "❌"}
          </p>

          <hr />
          <p>
            Overall:{" "}
            <b style={{ color: data.ok ? "green" : "crimson" }}>
              {data.ok ? "Healthy" : "Not healthy"}
            </b>
          </p>
        </div>
      )}
    </div>
  );
}

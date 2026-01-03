import { getAddresses } from "@inshell/contracts";

function short(value?: string) {
  if (!value) return "not set";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function App() {
  const addresses = getAddresses();
  const pulseAuction = addresses.pulse_auction;

  return (
    <div className="thought-shell">
      <div className="thought-card">
        <h1 className="thought-title">THOUGHT</h1>
        <p className="thought-subtitle">Coming soon</p>
        <p className="thought-note">
          Wallet ready · Pulse auction {short(pulseAuction)}
        </p>
        <p className="thought-note">
          This space will host the next movement layer for Inshell.
        </p>
      </div>
    </div>
  );
}

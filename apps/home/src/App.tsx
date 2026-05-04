import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import Movements from "@/components/Movements";
import Footer from "@/components/Footer/Footer";
import { maybeResolveAddress } from "@inshell/contracts";

export default function App() {
  const pulseAuction = maybeResolveAddress("pulse_auction");

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div style={{ padding: "20px", color: "red" }}>
          <h1>Something went wrong</h1>
          <p>{error.message}</p>
        </div>
      )}
    >
      <div className="shell">
        <div className="content">
          <AuctionCanvas address={pulseAuction} />
          <div className="hero">
            <Movements />
          </div>
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

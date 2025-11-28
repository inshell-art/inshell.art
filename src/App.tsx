import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import Movements from "@/components/Movements";
import Footer from "@/components/Footer/Footer";
import { resolveAddress } from "@/protocol/addressBook";

export default function App() {
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
          <AuctionCanvas address={resolveAddress("pulse_auction")} />
          <div className="hero">
            <Movements />
          </div>
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}

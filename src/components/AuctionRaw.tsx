import AuctionBidsCurve from "../components/auctionBidsCurve";

export default function AuctionPage() {
  // optional: pass a specific address; otherwise resolver uses VITE_/addresses.json
  return (
    <main style={{ padding: 16 }}>
      <h1>Auction · Bids Curve</h1>
      <AuctionBidsCurve refreshMs={4000} abiSource="auto" />
    </main>
  );
}

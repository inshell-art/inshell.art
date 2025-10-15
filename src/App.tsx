import { ErrorBoundary } from "react-error-boundary";
import AuctionCurve from "./components/AuctionCurve";

// Control ABI source selection via env vars for demo purposes
import { AbiSource } from "@/types/types";

const pickAbiSource = (env = import.meta.env): AbiSource => {
  const explicit = (env as any)?.VITE_DEFAULT_ABI_SOURCE as
    | AbiSource
    | undefined;
  console.log("Explicit ABI source:", explicit);
  if (explicit) return explicit;

  if (env?.VITE_STRICT_ABI === "true") {
    return "node";
  }
  if (env?.VITE_OFFLINE_MODE === "true") {
    return "artifact";
  }
  console.log("No ABI source specified, defaulting to 'auto'");

  return "auto";
};
//todo: check the way to compose env vars in .env files

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
      <AuctionCurve abiSource={pickAbiSource()} />
    </ErrorBoundary>
  );
}

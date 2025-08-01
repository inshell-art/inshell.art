import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";

// Initialize the Starknet provider for DEV mode
if (import.meta.env.DEV) {
  const { worker } = await import("@/mocks/browsers");
  await worker.start({ onUnhandledRequest: "warn", quiet: false });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

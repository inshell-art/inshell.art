import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@inshell/shared/design.css";
import "./main.css";
import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";
import { maybeInstallCloudflareWebAnalytics } from "@inshell/shared";
import { WalletProvider } from "@inshell/wallet";

(globalThis as any).__VITE_ENV__ = import.meta.env;
maybeInstallCloudflareWebAnalytics({ env: import.meta.env });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
);

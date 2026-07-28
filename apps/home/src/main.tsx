import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@inshell/shared/design.css";
import "./main.css";
import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";
import {
  installInshellAnonymousAnalytics,
  maybeInstallCloudflareWebAnalytics,
} from "@inshell/shared";
import { WalletProvider } from "@inshell/wallet";

const buildEnv =
  ((globalThis as any).__INSHELL_VITE_ENV__ as Record<string, unknown> | undefined) ?? {};
const runtimeEnv = {
  ...import.meta.env,
  ...buildEnv,
};

(globalThis as any).__VITE_ENV__ = runtimeEnv;
maybeInstallCloudflareWebAnalytics({ env: runtimeEnv });
installInshellAnonymousAnalytics({ env: runtimeEnv });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
);

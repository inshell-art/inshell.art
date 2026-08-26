import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@inshell/shared/design.css";
import "./main.css";
import "./components/docs/figures.css";
import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/600.css";
import {
  installInshellAnonymousAnalytics,
  maybeInstallCloudflareWebAnalytics,
} from "@inshell/shared";
import { WalletProvider } from "@inshell/wallet";
import { assertDeploymentOverrides } from "../../thought/src/thought-v2-production-deployment";

const runtimeEnv = {
  ...import.meta.env,
  VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
};

(globalThis as any).__VITE_ENV__ = runtimeEnv;
// Studio Preview uses the deployment reference in dev too. Preserve the
// separately configured Anvil test harness; DEV alone is not an exemption.
if (!import.meta.env.DEV || !globalThis.__INSHELL_PATH_CONTRACT_RUNTIME__) {
  assertDeploymentOverrides(runtimeEnv);
}
maybeInstallCloudflareWebAnalytics({ env: runtimeEnv });
installInshellAnonymousAnalytics({ env: runtimeEnv });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>
);

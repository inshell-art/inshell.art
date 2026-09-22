function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

export type AuctionStatus =
  | "before_deploy"
  | "loading"
  | "history_loading"
  | "before_open"
  | "open_not_active"
  | "active"
  | "error";

function normalizeAuctionStatus(value: unknown): AuctionStatus | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "auto") return null;
  if (
    raw === "before_deploy" ||
    raw === "before-deploy" ||
    raw === "beforedeploy" ||
    raw === "no_release" ||
    raw === "no-release" ||
    raw === "norelease" ||
    raw === "not_deployed" ||
    raw === "not-deployed" ||
    raw === "no_deployment" ||
    raw === "no-deployment"
  ) {
    return "before_deploy";
  }
  if (
    raw === "before_open" ||
    raw === "before-open" ||
    raw === "beforeopen" ||
    raw === "pre_open" ||
    raw === "pre-open" ||
    raw === "preopen"
  ) {
    return "before_open";
  }
  if (
    raw === "open_not_active" ||
    raw === "open-not-active" ||
    raw === "opennotactive" ||
    raw === "open_not_actived" ||
    raw === "open-not-actived" ||
    raw === "inactive" ||
    raw === "not_active" ||
    raw === "not-active" ||
    raw === "genesis_waiting" ||
    raw === "genesis-waiting" ||
    raw === "genesis" ||
    raw === "waiting"
  ) {
    return "open_not_active";
  }
  if (raw === "active") return "active";
  if (raw === "loading") return "loading";
  if (raw === "error") return "error";
  return null;
}

export function readAuctionStatusOverride(): AuctionStatus | null {
  if (typeof window === "undefined") return null;
  const query = window.location.search ?? "";
  const match = /(?:[?&])auction_status=([^&]+)/i.exec(query);
  if (match) {
    return normalizeAuctionStatus(decodeURIComponent(match[1]));
  }
  const env = getEnvValue("VITE_PULSE_STATUS");
  const envOverride = normalizeAuctionStatus(typeof env === "string" ? env : "");
  if (envOverride) return envOverride;
  const fromGlobal = (window as any).__PULSE_STATUS__;
  if (fromGlobal != null) return normalizeAuctionStatus(String(fromGlobal));
  try {
    const stored = window.localStorage.getItem("__PULSE_STATUS__");
    if (stored) return normalizeAuctionStatus(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  return null;
}

import { getPublicLaunchMode as readPublicLaunchMode } from "@inshell/shared";

export type { PublicLaunchMode, ReportBugContext, ReportBugLinkModel } from "@inshell/shared";
export {
  buildReportBugLink,
  buildReportBugUrl,
  getGithubUrl,
  getPublicLaunchMode,
  shouldShowReportBug,
} from "@inshell/shared";

type DebugPanelSetting = "off" | "private" | "on";

export const SEPOLIA_TESTNET_NOTICE = "Sepolia testnet only.";

function getEnvValue(name: string): unknown {
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function readEnvString(name: string): string | null {
  const value = getEnvValue(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getDebugPanelSetting(): DebugPanelSetting {
  const raw = readEnvString("VITE_DEBUG_PANEL") ?? "off";
  if (raw === "private" || raw === "on" || raw === "off") return raw;
  return "off";
}

function hasPrivateDebugGate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new globalThis.URLSearchParams(window.location.search);
    if (params.get("debug") === "1") return true;
  } catch {
    // Ignore malformed URLs in tests or embedded contexts.
  }
  try {
    return window.localStorage?.getItem("inshellDebug") === "1";
  } catch {
    return false;
  }
}

export function isSepoliaInviteMode(): boolean {
  return readPublicLaunchMode() === "sepolia_invite";
}

export function getPublicNetworkNotice(): string | null {
  return isSepoliaInviteMode() ? SEPOLIA_TESTNET_NOTICE : null;
}

export function shouldShowDebugPanel(): boolean {
  const mode = readPublicLaunchMode();
  const setting = getDebugPanelSetting();
  if (setting === "private") return hasPrivateDebugGate();
  if (setting === "on") return mode === "local";
  return false;
}

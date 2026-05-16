export type PublicLaunchMode = "local" | "sepolia_invite" | "production";

type DebugPanelSetting = "off" | "private" | "on";

export type ReportBugContext = {
  page?: string;
  network?: string;
  chainId?: string | number | bigint | null;
  wallet?: string | null;
  state?: string;
  address?: string | null;
  lastTx?: string | null;
  error?: string | null;
};

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

export function getPublicLaunchMode(): PublicLaunchMode {
  const raw = readEnvString("VITE_PUBLIC_LAUNCH_MODE") ?? "local";
  if (raw === "sepolia_invite" || raw === "production" || raw === "local") {
    return raw;
  }
  return "local";
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
  return getPublicLaunchMode() === "sepolia_invite";
}

export function getPublicNetworkNotice(): string | null {
  return isSepoliaInviteMode() ? SEPOLIA_TESTNET_NOTICE : null;
}

export function shouldShowDebugPanel(): boolean {
  const mode = getPublicLaunchMode();
  const setting = getDebugPanelSetting();
  if (setting === "private") return hasPrivateDebugGate();
  if (setting === "on") return mode === "local";
  return false;
}

export function getGithubUrl(): string {
  return readEnvString("VITE_GITHUB_URL") ?? "https://github.com/inshell-art/inshell.art";
}

function getReportBugBaseUrl(): string | null {
  return readEnvString("VITE_REPORT_BUG_URL");
}

export function shouldShowReportBug(): boolean {
  const mode = getPublicLaunchMode();
  return Boolean(getReportBugBaseUrl()) && (mode === "sepolia_invite" || mode === "production");
}

function shortPublicAddress(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{8,}$/.test(trimmed)) return sanitizeReportValue(trimmed, 64);
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function sanitizeReportValue(value: unknown, maxLength = 240): string {
  if (value == null) return "";
  return String(value)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .trim()
    .slice(0, maxLength);
}

function pagePath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function buildIssueBody(context: ReportBugContext): string {
  const mode = getPublicLaunchMode();
  const fields = [
    ["mode", mode],
    ["network", context.network ?? (isSepoliaInviteMode() ? "Sepolia" : "")],
    ["chainId", context.chainId == null ? "" : String(context.chainId)],
    ["wallet", context.wallet ?? ""],
    ["page", context.page ?? pagePath()],
    ["state", context.state ?? ""],
    ["address", shortPublicAddress(context.address)],
    ["last tx", sanitizeReportValue(context.lastTx, 96)],
    ["error", sanitizeReportValue(context.error, 300)],
  ];
  return [
    ...fields.map(([key, value]) => `${key}: ${value}`),
    "",
    "what happened:",
    "",
    "expected:",
    "",
    "screenshot:",
    "",
    "Remove anything private before submitting.",
  ].join("\n");
}

export function buildReportBugUrl(context: ReportBugContext = {}): string | null {
  const base = getReportBugBaseUrl();
  if (!base) return null;
  try {
    const url = new globalThis.URL(
      base,
      typeof window === "undefined" ? "https://inshell.art" : window.location.href,
    );
    const isGithubIssue =
      url.hostname.toLowerCase() === "github.com" && url.pathname.includes("/issues/new");
    if (isGithubIssue) {
      if (!url.searchParams.has("title")) {
        url.searchParams.set("title", "[Sepolia] PATH issue");
      }
      url.searchParams.set("body", buildIssueBody(context));
      return url.toString();
    }
    const params: Record<string, string> = {
      mode: getPublicLaunchMode(),
      page: context.page ?? pagePath(),
      network: context.network ?? (isSepoliaInviteMode() ? "Sepolia" : ""),
      state: context.state ?? "",
      wallet: context.wallet ?? "",
      chainId: context.chainId == null ? "" : String(context.chainId),
      address: shortPublicAddress(context.address),
      lastTx: sanitizeReportValue(context.lastTx, 96),
      error: sanitizeReportValue(context.error, 300),
    };
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  } catch {
    return base;
  }
}

export type SurfaceId = "path" | "thought";

export {
  installInshellAnonymousAnalytics,
  trackInshellAnonymousAnalytics,
} from "./anonymousAnalytics";
export type {
  AnonymousAnalyticsContentType,
  AnonymousAnalyticsEventType,
  AnonymousAnalyticsOptions,
  AnonymousAnalyticsTrackInput,
} from "./anonymousAnalytics";

export type PublicLaunchMode = "local" | "sepolia_invite" | "production";

export type DeploymentEnv = "local" | "preview" | "production";

export type DeploymentEnvOptions = {
  env?: Readonly<Record<string, unknown>>;
  deployEnv?: string | null;
  hostname?: string | null;
  locationHref?: string | null;
};

export type ContractStatusRow = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

export type ContractStatusSection = {
  id: string;
  title: string;
  rows: ContractStatusRow[];
};

export type ContractStatusInput = {
  chainId?: number;
  chainName?: string;
  pathNft?: string;
  thoughtNft?: string;
  pulseAuction?: string;
  colorFontV1?: string;
  thoughtSpecName?: string;
  thoughtSpecId?: string;
  thoughtSpecHash?: string;
  colorFontHash?: string;
};

export type ReportBugContext = {
  surface?: SurfaceId;
  page?: string;
  network?: string;
  chainId?: string | number | bigint | null;
  wallet?: string | null;
  state?: string;
  address?: string | null;
  lastTx?: string | null;
  error?: string | null;
};

export type ReportBugOptions = {
  env?: Readonly<Record<string, unknown>>;
  baseUrl?: string | null;
  githubUrl?: string | null;
  launchMode?: PublicLaunchMode;
  locationHref?: string;
  defaultOrigin?: string;
  label?: string;
  ariaLabel?: string;
};

export type ReportBugLinkModel = {
  href: string;
  label: string;
  ariaLabel: string;
  target: "_blank";
  rel: "noopener noreferrer";
  className: "inshell-report-bug-link";
};

export type WalletChainRpcOptions = {
  chainId?: string | number | bigint | null;
  readRpcUrl?: string | null;
  walletRpcUrl?: string | null;
  currentOrigin?: string | null;
  localFallbackRpcUrl?: string | null;
};

export type CloudflareWebAnalyticsOptions = {
  env?: Readonly<Record<string, unknown>>;
  hostname?: string | null;
  document?: globalThis.Document | null;
};

export const SURFACE_TERMINOLOGY = {
  ecosystem: "Inshell",
  pathDapp: "$PATH",
  pathDappLong: "$PATH auction",
  pathToken: "$PATH",
  pathTokenPlain: "PATH",
  thoughtDapp: "THOUGHT",
  thoughtToken: "THOUGHT",
  colorFont: "Color Font",
  verify: "verify",
} as const;

export const SURFACE_DEPLOYMENT_MANIFEST = {
  launchNetwork: {
    id: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
  },
  surfaces: {
    path: {
      id: "path",
      product: SURFACE_TERMINOLOGY.pathDapp,
      domain: "https://inshell.art",
      role: "$PATH auction, token inventory, and verification.",
      canonicalPath: "/",
    },
    thought: {
      id: "thought",
      product: SURFACE_TERMINOLOGY.thoughtDapp,
      domain: "https://thought.inshell.art",
      role: "THOUGHT creation, minting, and verification.",
      canonicalPath: "/",
    },
    gallery: {
      id: "gallery",
      product: "Gallery",
      domain: "https://gallery.inshell.art",
      role: "Public gallery for movement works.",
      canonicalPath: "/",
    },
  },
  contractIds: {
    path: ["path_nft", "pulse_auction", "path_pulse_adapter"],
    thought: ["thought_nft", "thought_spec_registry", "color_font_v1"],
  },
} as const;

export const SEPOLIA_CHAIN_ID = 11155111;
export type PublicNetworkConfig = {
  id: "sepolia";
  chainId: number;
  chainLabel: string;
  environmentLabel: string;
  compactLabel: string;
  notice: string;
  testnetEthRequirement: string;
  homeNote: string;
  verifyExplanation: string;
  notMainnetNote: string;
  switchNetworkNotice: string;
  currencyLabel: string;
  explorerBaseUrl: string;
};

export const PUBLIC_NETWORK_CONFIG = {
  id: "sepolia",
  chainId: SEPOLIA_CHAIN_ID,
  chainLabel: "Sepolia",
  environmentLabel: "Sepolia rehearsal",
  compactLabel: "Sepolia rehearsal · testnet ETH",
  notice: "Sepolia rehearsal.",
  testnetEthRequirement: "Sepolia testnet ETH.",
  homeNote: "Sepolia rehearsal · testnet ETH",
  verifyExplanation:
    "Inshell is currently live on Sepolia as a public rehearsal. Sepolia uses testnet ETH. Mainnet will be the future canonical record.",
  notMainnetNote: "Mainnet will be the canonical record later.",
  switchNetworkNotice: "Switch to Sepolia.",
  currencyLabel: "testnet ETH",
  explorerBaseUrl: "https://sepolia.etherscan.io",
} as const satisfies PublicNetworkConfig;
export const PUBLIC_SEPOLIA_WALLET_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
export const DEFAULT_REPORT_BUG_URL =
  "https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md";
export const PREVIEW_WATERMARK_LABEL = "preview";

function normalizeChainId(value: string | number | bigint | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === "bigint") return Number(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = trimmed.startsWith("0x")
    ? Number.parseInt(trimmed, 16)
    : Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isInshellReadOnlyRpcProxy(url: globalThis.URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return (
    ["/api/eth-rpc", "/api/path-rpc", "/api/thought-rpc"].includes(url.pathname) &&
    (hostname === "inshell.art" ||
      hostname === "thought.inshell.art" ||
      hostname.endsWith(".inshell.art"))
  );
}

function normalizeWalletRpcUrl(value: string | null | undefined, currentOrigin?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed.startsWith("/")) return "";

  try {
    const parsed = new globalThis.URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (isInshellReadOnlyRpcProxy(parsed)) return "";
    if (currentOrigin) {
      const origin = new globalThis.URL(currentOrigin);
      if (
        parsed.origin === origin.origin &&
        ["/api/eth-rpc", "/api/path-rpc", "/api/thought-rpc"].includes(parsed.pathname)
      ) return "";
    }
    return trimmed;
  } catch {
    return "";
  }
}

export function resolveWalletChainRpcUrls(options: WalletChainRpcOptions): string[] {
  const chainId = normalizeChainId(options.chainId);
  const walletRpcUrl = normalizeWalletRpcUrl(options.walletRpcUrl, options.currentOrigin);
  if (walletRpcUrl) return [walletRpcUrl];

  const readRpcUrl = normalizeWalletRpcUrl(options.readRpcUrl, options.currentOrigin);
  if (readRpcUrl) return [readRpcUrl];

  if (chainId === SEPOLIA_CHAIN_ID) return [PUBLIC_SEPOLIA_WALLET_RPC_URL];

  if (chainId === 31337 || chainId === 31338) {
    const fallback = normalizeWalletRpcUrl(
      options.localFallbackRpcUrl ?? "http://127.0.0.1:8546",
      options.currentOrigin,
    );
    return fallback ? [fallback] : [];
  }

  return [];
}

export function formatChainName(chainId: number | undefined) {
  if (chainId === SEPOLIA_CHAIN_ID) return "Sepolia";
  if (chainId === 31337 || chainId === 31338) return "Local Devnet";
  return chainId ? `Chain ${chainId}` : "not loaded";
}

export function displayStatusValue(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? value.toString()
      : "not loaded";
}

export function buildContractStatusSections(input: ContractStatusInput): ContractStatusSection[] {
  const chainName = input.chainName || formatChainName(input.chainId);
  const colorFontAuthority = input.colorFontV1
    ? `ColorFontV1 ${input.colorFontV1}`
    : input.thoughtNft
      ? `ThoughtNFT ${input.thoughtNft}`
      : "";

  return [
    {
      id: "domains",
      title: "official dapps",
      rows: [
        {
          id: "path-domain",
          label: SURFACE_TERMINOLOGY.pathDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain,
          href: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain,
        },
        {
          id: "thought-domain",
          label: SURFACE_TERMINOLOGY.thoughtDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.domain,
          href: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.domain,
        },
        {
          id: "gallery-domain",
          label: "Gallery",
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.gallery.domain,
          href: SURFACE_DEPLOYMENT_MANIFEST.surfaces.gallery.domain,
        },
      ],
    },
    {
      id: "deployment",
      title: "deployment manifest",
      rows: [
        {
          id: "network",
          label: "network",
          value: chainName,
        },
        {
          id: "chain-id",
          label: "chain id",
          value: displayStatusValue(input.chainId),
        },
        {
          id: "path-role",
          label: SURFACE_TERMINOLOGY.pathDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.role,
        },
        {
          id: "thought-role",
          label: SURFACE_TERMINOLOGY.thoughtDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.role,
        },
      ],
    },
    {
      id: "contracts",
      title: "contracts",
      rows: [
        {
          id: "path-nft",
          label: "PathNFT",
          value: displayStatusValue(input.pathNft),
        },
        {
          id: "thought-nft",
          label: "ThoughtNFT",
          value: displayStatusValue(input.thoughtNft),
        },
        {
          id: "pulse-auction",
          label: "PulseAuction",
          value: displayStatusValue(input.pulseAuction),
        },
      ],
    },
    {
      id: "thought-spec",
      title: "THOUGHT spec",
      rows: [
        {
          id: "thought-spec-name",
          label: "recommended spec",
          value: displayStatusValue(input.thoughtSpecName),
        },
        {
          id: "thought-spec-id",
          label: "spec id",
          value: displayStatusValue(input.thoughtSpecId),
        },
        {
          id: "thought-spec-hash",
          label: "spec hash",
          value: displayStatusValue(input.thoughtSpecHash),
        },
      ],
    },
    {
      id: "color-font",
      title: "color font",
      rows: [
        {
          id: "color-font-authority",
          label: "authority",
          value: displayStatusValue(colorFontAuthority),
        },
        {
          id: "color-font-loaded-from",
          label: "loaded from",
          value: input.colorFontV1
            ? "ColorFontV1.data()"
            : input.thoughtNft
              ? "ThoughtNFT.colorFontData()"
              : "not loaded",
        },
        {
          id: "color-font-hash",
          label: "hash",
          value: displayStatusValue(input.colorFontHash),
        },
      ],
    },
    {
      id: "wallet-actions",
      title: "wallet actions",
      rows: [
        {
          id: "connect-wallet",
          label: "connect wallet",
          value: "reads selected address and public ownership state.",
        },
        {
          id: "switch-network",
          label: "switch network",
          value: "asks wallet to switch to Sepolia.",
        },
        {
          id: "mint-path",
          label: `mint ${SURFACE_TERMINOLOGY.pathToken}`,
          value: "submits a wallet-confirmed transaction for the Pulse auction.",
        },
        {
          id: "mint-thought",
          label: `mint ${SURFACE_TERMINOLOGY.thoughtToken}`,
          value: `submits a wallet-confirmed transaction using a selected ${SURFACE_TERMINOLOGY.pathToken} permission.`,
        },
      ],
    },
  ];
}

export function findContractStatusRow(
  sections: readonly ContractStatusSection[],
  sectionId: string,
  rowId: string,
) {
  return sections.find((section) => section.id === sectionId)?.rows.find((row) => row.id === rowId);
}

export const CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID = "inshell-cloudflare-web-analytics";

export const CLOUDFLARE_WEB_ANALYTICS_ALLOWED_HOSTS = [
  "inshell.art",
  "thought.inshell.art",
  "gallery.inshell.art",
] as const;

function normalizeHostname(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\.$/, "") ?? "";
}

function getCurrentHostname(): string {
  if (typeof window === "undefined") return "";
  return normalizeHostname(window.location.hostname);
}

function isCloudflareWebAnalyticsHostAllowed(hostname: string): boolean {
  return CLOUDFLARE_WEB_ANALYTICS_ALLOWED_HOSTS.includes(
    hostname as (typeof CLOUDFLARE_WEB_ANALYTICS_ALLOWED_HOSTS)[number],
  );
}

function getSharedEnvValue(name: string, env?: Readonly<Record<string, unknown>>): unknown {
  const globalEnv: Record<string, unknown> | undefined = (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, unknown> | undefined = (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv: Record<string, unknown> | undefined = (globalThis as any)?.process?.env;
  return env?.[name] ?? globalEnv?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function readSharedEnvString(
  name: string,
  options?: { env?: Readonly<Record<string, unknown>> },
): string | null {
  const value = getSharedEnvValue(name, options?.env);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function maybeInstallCloudflareWebAnalytics(
  options: CloudflareWebAnalyticsOptions = {},
): boolean {
  const documentRef =
    options.document ?? (typeof document === "undefined" ? null : document);
  if (!documentRef) return false;

  const hostname = normalizeHostname(options.hostname ?? getCurrentHostname());
  if (!isCloudflareWebAnalyticsHostAllowed(hostname)) return false;

  const token = readSharedEnvString("VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN", options);
  if (!token) return false;

  if (documentRef.getElementById(CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID)) return false;

  const script = documentRef.createElement("script");
  script.id = CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID;
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute(
    "data-cf-beacon",
    JSON.stringify({ token, send: { to: "/cdn-cgi/rum" } }),
  );
  documentRef.head.appendChild(script);
  return true;
}

function normalizeDeploymentEnv(raw: string | null | undefined): DeploymentEnv | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value === "preview" || value === "staging") return "preview";
  if (value === "production" || value === "prod" || value === "main") return "production";
  if (value === "local" || value === "dev" || value === "development") return "local";
  return null;
}

function getDeploymentHostname(options: DeploymentEnvOptions): string {
  const configured = options.hostname?.trim().toLowerCase();
  if (configured) return configured;

  const href = options.locationHref?.trim();
  if (href) {
    try {
      return new globalThis.URL(href).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  if (typeof window !== "undefined") return window.location.hostname.toLowerCase();
  return "";
}

function isPreviewHostname(hostname: string): boolean {
  return (
    hostname === "preview.inshell.art" ||
    hostname === "thought.preview.inshell.art" ||
    hostname.endsWith(".preview.inshell.art") ||
    hostname === "staging.inshell-art.pages.dev" ||
    hostname === "staging.thought-inshell-art.pages.dev" ||
    (hostname.startsWith("staging.") && hostname.endsWith(".pages.dev"))
  );
}

export function getDeploymentEnv(options: DeploymentEnvOptions = {}): DeploymentEnv {
  const hostname = getDeploymentHostname(options);
  if (isPreviewHostname(hostname)) return "preview";

  const configured =
    normalizeDeploymentEnv(options.deployEnv) ??
    normalizeDeploymentEnv(readSharedEnvString("VITE_DEPLOY_ENV", options));
  if (configured) return configured;

  return "local";
}

export function shouldShowPreviewWatermark(options: DeploymentEnvOptions = {}): boolean {
  return getDeploymentEnv(options) === "preview";
}

export function getPublicLaunchMode(options: ReportBugOptions = {}): PublicLaunchMode {
  const raw = options.launchMode ?? readSharedEnvString("VITE_PUBLIC_LAUNCH_MODE", options) ?? "local";
  if (raw === "sepolia_invite" || raw === "production" || raw === "local") {
    return raw;
  }
  return "local";
}

export function getGithubUrl(options: ReportBugOptions = {}): string {
  return (
    options.githubUrl ||
    readSharedEnvString("VITE_GITHUB_URL", options) ||
    "https://github.com/inshell-art/"
  );
}

function getReportBugBaseUrl(options: ReportBugOptions = {}): string | null {
  const configured = options.baseUrl ?? readSharedEnvString("VITE_REPORT_BUG_URL", options);
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  const mode = getPublicLaunchMode(options);
  return mode === "sepolia_invite" || mode === "production" ? DEFAULT_REPORT_BUG_URL : null;
}

export function shouldShowReportBug(options: ReportBugOptions = {}): boolean {
  const mode = getPublicLaunchMode(options);
  return Boolean(getReportBugBaseUrl(options)) && (mode === "sepolia_invite" || mode === "production");
}

function reportSurfaceLabel(surface: SurfaceId | undefined): string {
  return surface === "thought" ? SURFACE_TERMINOLOGY.thoughtDapp : SURFACE_TERMINOLOGY.pathDapp;
}

function reportIssueTitle(context: ReportBugContext): string {
  return `[Sepolia] ${reportSurfaceLabel(context.surface).replace(/^\$/, "")} issue`;
}

function sanitizeReportValue(value: unknown, maxLength = 240): string {
  if (value == null) return "";
  return String(value)
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .trim()
    .slice(0, maxLength);
}

function shortPublicAddress(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{8,}$/.test(trimmed)) return sanitizeReportValue(trimmed, 64);
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function defaultPagePath(options: ReportBugOptions = {}): string {
  const origin = options.defaultOrigin ?? SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain;
  if (options.locationHref) {
    try {
      const url = new globalThis.URL(options.locationHref, origin);
      return `${url.pathname}${url.search}`;
    } catch {
      return "/";
    }
  }
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

function buildIssueBody(context: ReportBugContext, options: ReportBugOptions): string {
  const mode = getPublicLaunchMode(options);
  const fields = [
    ["mode", mode],
    ["surface", reportSurfaceLabel(context.surface)],
    ["network", context.network ?? (mode === "sepolia_invite" ? "Sepolia" : "")],
    ["chainId", context.chainId == null ? "" : String(context.chainId)],
    ["wallet", context.wallet ?? ""],
    ["page", context.page ?? defaultPagePath(options)],
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

export function buildReportBugUrl(
  context: ReportBugContext = {},
  options: ReportBugOptions = {},
): string | null {
  const base = getReportBugBaseUrl(options);
  if (!base) return null;
  try {
    const url = new globalThis.URL(
      base,
      options.defaultOrigin ?? SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain,
    );
    const isGithubIssue =
      url.hostname.toLowerCase() === "github.com" && url.pathname.includes("/issues/new");
    if (isGithubIssue) {
      if (!url.searchParams.has("title")) {
        url.searchParams.set("title", reportIssueTitle(context));
      }
      url.searchParams.set("body", buildIssueBody(context, options));
      return url.toString();
    }
    const mode = getPublicLaunchMode(options);
    const params: Record<string, string> = {
      mode,
      surface: reportSurfaceLabel(context.surface),
      page: context.page ?? defaultPagePath(options),
      network: context.network ?? (mode === "sepolia_invite" ? "Sepolia" : ""),
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

export function buildReportBugLink(
  context: ReportBugContext = {},
  options: ReportBugOptions = {},
): ReportBugLinkModel | null {
  const href = buildReportBugUrl(context, options);
  if (!href) return null;
  return {
    href,
    label: options.label ?? "report bug ↗",
    ariaLabel:
      options.ariaLabel ??
      (context.surface === "thought" ? "Report a THOUGHT bug" : "Report a Sepolia bug"),
    target: "_blank",
    rel: "noopener noreferrer",
    className: "inshell-report-bug-link",
  };
}

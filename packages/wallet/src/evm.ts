/* global CustomEvent, Event, EventListener */
import {
  OFFICIAL_DOMAINS,
  PUBLIC_SITE_METADATA,
  absolutePublicAssetUrl,
} from "@inshell/contracts";
import type { ProviderInterface } from "@inshell/ethereum";

export type Eip1193Provider = ProviderInterface & {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: Eip1193Provider[];
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
};

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
};

export type WalletConnectEthereumProvider = Eip1193Provider & {
  enable?: () => Promise<string[]>;
  disconnect?: () => Promise<void>;
};

export type WalletConnectorKind = "injected" | "walletconnect";

export type WalletConnector = {
  id: string;
  name: string;
  available: () => boolean;
  kind: WalletConnectorKind;
  detail?: Eip6963ProviderDetail;
};

export type WalletEnvReader = (name: string) => unknown;
export type WalletConnectRpcMap = Record<string, string>;
type WalletConnectProviderOptions = {
  projectId: string;
  chains: number[];
  optionalChains: number[];
  rpcMap: WalletConnectRpcMap;
  relayUrl: string;
  showQrModal: boolean;
  metadata: ReturnType<typeof walletConnectMetadata>;
};

export const EIP6963_ANNOUNCE_EVENT = "eip6963:announceProvider";
export const EIP6963_REQUEST_EVENT = "eip6963:requestProvider";
const PUBLIC_SEPOLIA_WALLET_RPC_URL =
  "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_WALLETCONNECT_RELAY_URL = "wss://relay.walletconnect.com";

export function normalizeProviderDetail(
  detail: unknown
): Eip6963ProviderDetail | null {
  const info = (detail as any)?.info;
  const provider = (detail as any)?.provider;
  if (!provider || typeof provider.request !== "function") return null;
  const uuid =
    typeof info?.uuid === "string" && info.uuid.trim()
      ? info.uuid.trim()
      : `anon:${typeof info?.name === "string" ? info.name : "provider"}`;
  const name =
    typeof info?.name === "string" && info.name.trim()
      ? info.name.trim()
      : "Injected";
  const rdns = typeof info?.rdns === "string" ? info.rdns.trim() : "";
  const icon = typeof info?.icon === "string" ? info.icon : "";
  const providerTyped = provider as Eip1193Provider;
  const normalizedInfo = { uuid, name, rdns, icon };
  if (isUnsupportedInjectedProvider(normalizedInfo, providerTyped)) return null;
  return {
    info: normalizedInfo,
    provider: providerTyped,
  };
}

export function providerDetailKey(detail: Eip6963ProviderDetail): string {
  const rdns = detail.info.rdns?.trim();
  if (rdns) return `rdns:${rdns.toLowerCase()}`;
  return `uuid:${detail.info.uuid.toLowerCase()}`;
}

export function isUnsupportedInjectedProvider(
  info: Eip6963ProviderInfo,
  provider?: Eip1193Provider
): boolean {
  const name = info.name.toLowerCase();
  const rdns = (info.rdns ?? "").toLowerCase();
  const p = provider as any;
  return (
    name.includes("temple") ||
    rdns.includes("temple") ||
    Boolean(p?.isTemple || p?.isTempleWallet)
  );
}

export function mergeProviderDetails(
  base: Eip6963ProviderDetail[],
  incoming: Eip6963ProviderDetail[]
): Eip6963ProviderDetail[] {
  const map = new Map<string, Eip6963ProviderDetail>();
  for (const item of [...base, ...incoming]) {
    map.set(providerDetailKey(item), item);
  }
  const rank = (detail: Eip6963ProviderDetail): number => {
    const name = detail.info.name.toLowerCase();
    const rdns = (detail.info.rdns ?? "").toLowerCase();
    if (rdns.includes("metamask") || name.includes("metamask")) return 0;
    if (rdns.includes("rabby") || name.includes("rabby")) return 10;
    if (rdns.includes("coinbase") || name.includes("coinbase")) return 20;
    if (rdns === "window.ethereum") return 100;
    return 50;
  };
  return Array.from(map.values()).sort((a, b) => {
    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.info.name.localeCompare(b.info.name);
  });
}

export function inferFallbackProviderInfo(
  provider: Eip1193Provider,
  index: number
): Eip6963ProviderInfo {
  const p = provider as any;
  if (p?.isMetaMask) {
    return {
      uuid: `fallback:metamask:${index}`,
      name: "MetaMask",
      rdns: "io.metamask",
    };
  }
  if (p?.isRabby) {
    return {
      uuid: `fallback:rabby:${index}`,
      name: "Rabby",
      rdns: "io.rabby",
    };
  }
  if (p?.isCoinbaseWallet) {
    return {
      uuid: `fallback:coinbase:${index}`,
      name: "Coinbase Wallet",
      rdns: "com.coinbase.wallet",
    };
  }
  return {
    uuid: `fallback:window-ethereum:${index}`,
    name: "Injected",
    rdns: index === 0 ? "window.ethereum" : `window.ethereum.${index}`,
  };
}

export function fallbackWindowEthereumProviders(): Eip6963ProviderDetail[] {
  if (typeof window === "undefined") return [];
  const injected = (window as any).ethereum as Eip1193Provider | undefined;
  if (!injected) return [];
  const rawProviders =
    Array.isArray(injected.providers) && injected.providers.length > 0
      ? injected.providers
      : [injected];
  const seen = new Set<Eip1193Provider>();
  const details: Eip6963ProviderDetail[] = [];
  rawProviders.forEach((provider, index) => {
    if (!provider || typeof provider.request !== "function" || seen.has(provider)) {
      return;
    }
    seen.add(provider);
    const info = inferFallbackProviderInfo(provider, index);
    if (isUnsupportedInjectedProvider(info, provider)) return;
    details.push({ info, provider });
  });
  return mergeProviderDetails([], details);
}

export async function discoverEip6963Providers(
  waitMs = 120
): Promise<Eip6963ProviderDetail[]> {
  if (typeof window === "undefined") return [];
  const discovered: Eip6963ProviderDetail[] = [];
  const seen = new Set<string>();
  const onAnnounce = (event: Event) => {
    const normalized = normalizeProviderDetail((event as CustomEvent).detail);
    if (!normalized) return;
    const key = providerDetailKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    discovered.push(normalized);
  };
  window.addEventListener(EIP6963_ANNOUNCE_EVENT, onAnnounce as EventListener);
  try {
    window.dispatchEvent(new Event(EIP6963_REQUEST_EVENT));
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
  } finally {
    window.removeEventListener(
      EIP6963_ANNOUNCE_EVENT,
      onAnnounce as EventListener
    );
  }
  const fallbacks = fallbackWindowEthereumProviders();
  if (fallbacks.length > 0 && discovered.length === 0) {
    return mergeProviderDetails(discovered, fallbacks);
  }
  return discovered;
}

export function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^0x[0-9a-f]+$/i.test(raw)) {
    const parsed = Number.parseInt(raw, 16);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function readEvmChainIds(getEnv: WalletEnvReader): number[] {
  const raw = getEnv("VITE_EVM_CHAIN_IDS") ?? getEnv("VITE_EVM_CHAIN_ID");
  if (typeof raw !== "string" || !raw.trim()) return [11155111];
  const parsed = raw
    .split(",")
    .map((item) => parseChainId(item))
    .filter((item): item is number => item != null && item > 0);
  return parsed.length ? parsed : [11155111];
}

export function chainLabel(chainId: number | null): { name: string; network: string } {
  if (chainId === 11155111) return { name: "Sepolia", network: "sepolia" };
  if (chainId === 31338) return { name: "PATH Local", network: "devnet" };
  if (chainId === 1) return { name: "Mainnet", network: "mainnet" };
  return { name: "Unknown", network: "unknown" };
}

export function walletAnalyticsErrorCategory(error: unknown) {
  const msg = String((error as any)?.message ?? error ?? "").toLowerCase();
  const code = Number((error as any)?.code);
  if (
    code === 4001 ||
    msg.includes("user rejected") ||
    msg.includes("user reject") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled")
  ) return "wallet_rejected";
  if (
    code === -32002 ||
    msg.includes("already processing") ||
    msg.includes("already pending")
  ) return "wallet_busy";
  if (
    msg.includes("no eip-1193 injected wallet found") ||
    msg.includes("missing vite_walletconnect_project_id") ||
    msg.includes("walletconnect v2 provider is unavailable")
  ) return "wallet_missing";
  if (msg.includes("expired")) return "timeout";
  if (msg.includes("rpc")) return "rpc";
  if (msg.includes("network")) return "network";
  return "unknown";
}

export function readWalletConnectProjectId(getEnv: WalletEnvReader): string {
  const raw = getEnv("VITE_WALLETCONNECT_PROJECT_ID");
  return typeof raw === "string" ? raw.trim() : "";
}

export function walletConnectEnabled(getEnv: WalletEnvReader): boolean {
  return readWalletConnectProjectId(getEnv).length > 0;
}

export function readWalletConnectRelayUrl(getEnv: WalletEnvReader): string {
  const raw = getEnv("VITE_WALLETCONNECT_RELAY_URL");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (/^wss:\/\/[a-z0-9.-]+/i.test(trimmed)) return trimmed;
  return DEFAULT_WALLETCONNECT_RELAY_URL;
}

export function walletConnectMetadata(surfaceOverride?: "home" | "thought") {
  const hostname =
    typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const documentTitle =
    typeof document === "undefined"
      ? ""
      : document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "";
  const surface =
    surfaceOverride ??
    (hostname === "thought.inshell.art" ||
    documentTitle === PUBLIC_SITE_METADATA.thought.title
      ? "thought"
      : "home");
  const metadata = PUBLIC_SITE_METADATA[surface];
  const currentOrigin =
    typeof window === "undefined" ? "" : window.location.origin;
  const currentProtocol =
    typeof window === "undefined" ? "" : window.location.protocol;
  const metadataUrl =
    currentOrigin && currentProtocol === "https:"
      ? currentOrigin
      : OFFICIAL_DOMAINS[surface];
  return {
    name: metadata.title,
    description: metadata.description,
    url: metadataUrl,
    icons: [absolutePublicAssetUrl(surface, metadata.iconPath)],
  };
}

export function walletConnectRpcMap(
  chains: number[],
  getEnv: WalletEnvReader
): WalletConnectRpcMap {
  const readRpcUrl =
    getEnv("VITE_THOUGHT_RPC_URL") ??
    getEnv("VITE_PATH_RPC_URL") ??
    getEnv("VITE_ETH_RPC");
  const walletRpcUrl = getEnv("VITE_WALLET_CHAIN_RPC_URL");
  const currentOrigin =
    typeof window === "undefined" ? "" : window.location.origin;
  const rpcMap: WalletConnectRpcMap = {};
  for (const chainId of chains) {
    const urls = resolveWalletConnectRpcUrls({
      chainId,
      readRpcUrl: typeof readRpcUrl === "string" ? readRpcUrl : "",
      walletRpcUrl: typeof walletRpcUrl === "string" ? walletRpcUrl : "",
      currentOrigin,
      localFallbackRpcUrl: "http://127.0.0.1:8546",
    });
    if (urls[0]) rpcMap[String(chainId)] = urls[0];
  }
  return rpcMap;
}

function resolveWalletConnectRpcUrls(options: {
  chainId: number;
  readRpcUrl: string;
  walletRpcUrl: string;
  currentOrigin: string;
  localFallbackRpcUrl: string;
}): string[] {
  const walletRpcUrl = normalizeWalletConnectRpcUrl(
    options.walletRpcUrl,
    options.currentOrigin
  );
  if (walletRpcUrl) return [walletRpcUrl];

  const readRpcUrl = normalizeWalletConnectRpcUrl(
    options.readRpcUrl,
    options.currentOrigin
  );
  if (readRpcUrl) return [readRpcUrl];

  if (options.chainId === 11155111) return [PUBLIC_SEPOLIA_WALLET_RPC_URL];

  if (options.chainId === 31337 || options.chainId === 31338) {
    const fallback = normalizeWalletConnectRpcUrl(
      options.localFallbackRpcUrl,
      options.currentOrigin
    );
    return fallback ? [fallback] : [];
  }

  return [];
}

function normalizeWalletConnectRpcUrl(
  value: string | null | undefined,
  currentOrigin?: string | null
) {
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
        ["/api/eth-rpc", "/api/path-rpc", "/api/thought-rpc"].includes(
          parsed.pathname
        )
      ) {
        return "";
      }
    }
    return trimmed;
  } catch {
    return "";
  }
}

function isInshellReadOnlyRpcProxy(url: globalThis.URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    ["/api/eth-rpc", "/api/path-rpc", "/api/thought-rpc"].includes(
      url.pathname
    ) &&
    (hostname === "inshell.art" ||
      hostname === "thought.inshell.art" ||
      hostname.endsWith(".inshell.art"))
  );
}

export async function connectEip1193Provider(detail: Eip6963ProviderDetail) {
  const accountsRaw = await detail.provider.request({
    method: "eth_requestAccounts",
  });
  const accounts = Array.isArray(accountsRaw)
    ? accountsRaw.map((item) => String(item))
    : [];
  const chainIdRaw = await detail.provider.request({ method: "eth_chainId" });
  return {
    address: accounts[0] ?? null,
    chainId: parseChainId(chainIdRaw),
  };
}

export async function createWalletConnectEthereumProvider(args: {
  projectId: string;
  chains: number[];
  metadata?: ReturnType<typeof walletConnectMetadata>;
  rpcMap?: WalletConnectRpcMap;
  relayUrl?: string;
  showQrModal?: boolean;
}) {
  const mod = (await import("@walletconnect/ethereum-provider")) as any;
  const EthereumProviderCtor =
    mod?.EthereumProvider ?? mod?.default?.EthereumProvider;
  if (typeof EthereumProviderCtor?.init !== "function") {
    throw new Error("WalletConnect v2 provider is unavailable.");
  }
  const requiredChain = args.chains[0] ?? 11155111;
  const providerOptions: WalletConnectProviderOptions = {
    projectId: args.projectId,
    chains: [requiredChain],
    optionalChains: args.chains.filter((chainId) => chainId !== requiredChain),
    rpcMap: args.rpcMap ?? {},
    relayUrl: args.relayUrl ?? DEFAULT_WALLETCONNECT_RELAY_URL,
    showQrModal: args.showQrModal ?? true,
    metadata: args.metadata ?? walletConnectMetadata(),
  };
  return (await EthereumProviderCtor.init(providerOptions)) as WalletConnectEthereumProvider;
}

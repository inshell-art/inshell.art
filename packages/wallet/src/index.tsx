/* eslint-disable react-refresh/only-export-components */
/* global CustomEvent, Event, EventListener */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  encodeExecuteData,
  getDefaultProvider,
  sendTransaction,
  waitForTransaction,
  type ProviderInterface,
} from "@inshell/ethereum";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

export type WalletAsset = {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  icon?: string;
};

type Eip1193Provider = ProviderInterface & {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
};

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
};

type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: Eip1193Provider;
};

type WalletConnectEthereumProvider = Eip1193Provider & {
  enable?: () => Promise<string[]>;
  disconnect?: () => Promise<void>;
};

type WalletAccount = {
  address: string;
  execute: (call: {
    contractAddress: string;
    entrypoint: string;
    calldata?: readonly unknown[];
    value?: bigint;
  }) => Promise<{
    transactionHash: string;
    transaction_hash: string;
    hash: string;
  }>;
  waitForTransaction: (hash: string) => Promise<unknown>;
};

type WalletConnector = {
  id: string;
  name: string;
  available: () => boolean;
  kind: "injected" | "walletconnect";
  detail?: Eip6963ProviderDetail;
};

type WalletContextValue = {
  address?: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  status: string;
  chain?: { id?: number; name: string; network: string };
  chainId?: number | null;
  account?: WalletAccount | null;
  accountMissing: boolean;
  connect: () => Promise<void>;
  connectAsync: (args?: { connector?: WalletConnector }) => Promise<{
    address: string | null;
    chainId: number | null;
  }>;
  disconnect: () => Promise<void>;
  disconnectAsync: () => Promise<void>;
  connectors: WalletConnector[];
  connectStatus: string;
  connectError: unknown;
  requestAccounts: () => Promise<string[] | null>;
  watchAsset: (asset: WalletAsset) => Promise<boolean>;
  connectEip1193: () => Promise<{
    address: string | null;
    chainId: number | null;
  }>;
  connectWalletConnectV2: () => Promise<{
    address: string | null;
    chainId: number | null;
  }>;
  disconnectEvm: () => Promise<void>;
  evm: {
    providers: Eip6963ProviderInfo[];
    address: string | null;
    chainId: number | null;
    providerName: string | null;
    isConnected: boolean;
    error: unknown;
    connectInjected: () => Promise<{
      address: string | null;
      chainId: number | null;
    }>;
    connectWalletConnectV2: () => Promise<{
      address: string | null;
      chainId: number | null;
    }>;
    disconnect: () => Promise<void>;
  };
};

const WalletContext = createContext<WalletContextValue | null>(null);

const EIP6963_ANNOUNCE_EVENT = "eip6963:announceProvider";
const EIP6963_REQUEST_EVENT = "eip6963:requestProvider";

function normalizeProviderDetail(
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

function providerDetailKey(detail: Eip6963ProviderDetail): string {
  const rdns = detail.info.rdns?.trim();
  if (rdns) return `rdns:${rdns.toLowerCase()}`;
  return `uuid:${detail.info.uuid.toLowerCase()}`;
}

function isUnsupportedInjectedProvider(
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

function mergeProviderDetails(
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

function inferFallbackProviderInfo(
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

function fallbackWindowEthereumProviders(): Eip6963ProviderDetail[] {
  if (typeof window === "undefined") return [];
  const injected = (window as any).ethereum as
    | (Eip1193Provider & { providers?: Eip1193Provider[] })
    | undefined;
  if (!injected) return [];
  const rawProviders =
    Array.isArray((injected as any).providers) &&
    (injected as any).providers.length > 0
      ? ((injected as any).providers as Eip1193Provider[])
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

async function discoverEip6963Providers(
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

function parseChainId(value: unknown): number | null {
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

function readEvmChainIds(): number[] {
  const raw = getEnv("VITE_EVM_CHAIN_IDS") ?? getEnv("VITE_EVM_CHAIN_ID");
  if (typeof raw !== "string" || !raw.trim()) return [11155111];
  const parsed = raw
    .split(",")
    .map((item) => parseChainId(item))
    .filter((item): item is number => item != null && item > 0);
  return parsed.length ? parsed : [11155111];
}

function chainLabel(chainId: number | null): { name: string; network: string } {
  if (chainId === 11155111) return { name: "Sepolia", network: "sepolia" };
  if (chainId === 31338) return { name: "PATH Local", network: "devnet" };
  if (chainId === 1) return { name: "Mainnet", network: "mainnet" };
  return { name: "Unknown", network: "unknown" };
}

async function connectEip1193Provider(detail: Eip6963ProviderDetail) {
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

function createWalletAccount(
  provider: Eip1193Provider,
  publicProvider: ProviderInterface,
  address: string
): WalletAccount {
  return {
    address,
    execute: async (call) => {
      const data = encodeExecuteData(call.entrypoint, call.calldata ?? []);
      const hash = await sendTransaction(provider, {
        from: address,
        to: call.contractAddress,
        data,
        value: call.value,
      });
      return {
        transactionHash: hash,
        transaction_hash: hash,
        hash,
      };
    },
    waitForTransaction: async (hash: string) =>
      waitForTransaction(publicProvider, hash),
  };
}

export type WalletProviderProps = {
  children?: React.ReactNode;
};

export function WalletProvider({ children }: WalletProviderProps) {
  const publicProvider = useMemo(() => getDefaultProvider(), []);
  const [evmProviders, setEvmProviders] = useState<Eip6963ProviderDetail[]>(() => {
    return fallbackWindowEthereumProviders();
  });
  const [activeProvider, setActiveProvider] =
    useState<Eip1193Provider | null>(null);
  const [walletConnectProvider, setWalletConnectProvider] =
    useState<WalletConnectEthereumProvider | null>(null);
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmChainId, setEvmChainId] = useState<number | null>(null);
  const [evmProviderLabel, setEvmProviderLabel] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState("idle");
  const [connectError, setConnectError] = useState<unknown>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stopped = false;
    const refresh = async () => {
      const discovered = await discoverEip6963Providers();
      if (stopped) return;
      setEvmProviders((prev) => mergeProviderDetails(prev, discovered));
    };
    void refresh();
    const onAnnounce = (event: Event) => {
      const normalized = normalizeProviderDetail((event as CustomEvent).detail);
      if (!normalized) return;
      setEvmProviders((prev) => mergeProviderDetails(prev, [normalized]));
    };
    window.addEventListener(
      EIP6963_ANNOUNCE_EVENT,
      onAnnounce as EventListener
    );
    const onEthereumInitialized = () => {
      void refresh();
    };
    window.addEventListener(
      "ethereum#initialized",
      onEthereumInitialized as EventListener
    );
    window.dispatchEvent(new Event(EIP6963_REQUEST_EVENT));
    return () => {
      stopped = true;
      window.removeEventListener(
        EIP6963_ANNOUNCE_EVENT,
        onAnnounce as EventListener
      );
      window.removeEventListener(
        "ethereum#initialized",
        onEthereumInitialized as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!activeProvider) return;
    const handleAccountsChanged = (accounts: unknown) => {
      const next =
        Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null;
      setEvmAddress(next);
      setConnectStatus(next ? "connected" : "idle");
    };
    const handleChainChanged = (value: unknown) => {
      setEvmChainId(parseChainId(value));
    };
    const handleDisconnect = () => {
      setActiveProvider(null);
      setWalletConnectProvider(null);
      setEvmAddress(null);
      setEvmChainId(null);
      setEvmProviderLabel(null);
      setConnectStatus("idle");
    };
    activeProvider.on?.("accountsChanged", handleAccountsChanged);
    activeProvider.on?.("chainChanged", handleChainChanged);
    activeProvider.on?.("disconnect", handleDisconnect);
    return () => {
      activeProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      activeProvider.removeListener?.("chainChanged", handleChainChanged);
      activeProvider.removeListener?.("disconnect", handleDisconnect);
    };
  }, [activeProvider]);

  const setConnectedState = useCallback(
    (
      provider: Eip1193Provider,
      connected: { address: string | null; chainId: number | null },
      label: string
    ) => {
      setActiveProvider(provider);
      setEvmAddress(connected.address);
      setEvmChainId(connected.chainId);
      setEvmProviderLabel(label);
      setConnectStatus(connected.address ? "connected" : "idle");
      setConnectError(null);
    },
    []
  );

  const connectEip1193 = useCallback(async () => {
    setConnectStatus("connecting");
    try {
      const discovered = await discoverEip6963Providers();
      const merged = mergeProviderDetails(evmProviders, discovered);
      const detail = merged[0] ?? fallbackWindowEthereumProviders()[0];
      if (!detail) {
        throw new Error("No EIP-1193 injected wallet found.");
      }
      const connected = await connectEip1193Provider(detail);
      setEvmProviders(mergeProviderDetails(merged, [detail]));
      if (walletConnectProvider) {
        try {
          await walletConnectProvider.disconnect?.();
        } catch {
          /* ignore */
        }
        setWalletConnectProvider(null);
      }
      setConnectedState(detail.provider, connected, detail.info.name || "Injected");
      return connected;
    } catch (error) {
      setConnectError(error);
      setConnectStatus("error");
      throw error;
    }
  }, [evmProviders, setConnectedState, walletConnectProvider]);

  const connectWalletConnectV2 = useCallback(async () => {
    setConnectStatus("connecting");
    try {
      const projectIdRaw = getEnv("VITE_WALLETCONNECT_PROJECT_ID");
      if (typeof projectIdRaw !== "string" || !projectIdRaw.trim()) {
        throw new Error("Missing VITE_WALLETCONNECT_PROJECT_ID.");
      }
      const mod = (await import("@walletconnect/ethereum-provider")) as any;
      const EthereumProviderCtor =
        mod?.EthereumProvider ?? mod?.default?.EthereumProvider;
      if (typeof EthereumProviderCtor?.init !== "function") {
        throw new Error("WalletConnect v2 provider is unavailable.");
      }
      const wcProvider = (await EthereumProviderCtor.init({
        projectId: projectIdRaw.trim(),
        chains: readEvmChainIds(),
        showQrModal: true,
      })) as WalletConnectEthereumProvider;
      const accounts =
        typeof wcProvider.enable === "function"
          ? await wcProvider.enable()
          : ((await wcProvider.request({
              method: "eth_requestAccounts",
            })) as string[]);
      const chainIdRaw = await wcProvider.request({ method: "eth_chainId" });
      const connected = {
        address:
          Array.isArray(accounts) && accounts[0] ? String(accounts[0]) : null,
        chainId: parseChainId(chainIdRaw),
      };
      setWalletConnectProvider(wcProvider);
      setConnectedState(wcProvider, connected, "WalletConnect v2");
      return connected;
    } catch (error) {
      setConnectError(error);
      setConnectStatus("error");
      throw error;
    }
  }, [setConnectedState]);

  const disconnectEvm = useCallback(async () => {
    if (walletConnectProvider) {
      try {
        await walletConnectProvider.disconnect?.();
      } catch {
        /* ignore */
      }
    }
    setWalletConnectProvider(null);
    setActiveProvider(null);
    setEvmAddress(null);
    setEvmChainId(null);
    setEvmProviderLabel(null);
    setConnectError(null);
    setConnectStatus("idle");
  }, [walletConnectProvider]);

  const connectors = useMemo<WalletConnector[]>(() => {
    const injected: WalletConnector[] = evmProviders.map((detail) => ({
      id: detail.info.uuid,
      name: detail.info.name || "Injected",
      available: () => true,
      kind: "injected" as const,
      detail,
    }));
    const walletConnectEnabled =
      typeof getEnv("VITE_WALLETCONNECT_PROJECT_ID") === "string" &&
      String(getEnv("VITE_WALLETCONNECT_PROJECT_ID")).trim().length > 0;
    if (walletConnectEnabled) {
      injected.push({
        id: "walletconnect-v2",
        name: "WalletConnect v2",
        available: () => true,
        kind: "walletconnect",
      });
    }
    return injected;
  }, [evmProviders]);

  const connectAsync = useCallback(
    async (args?: { connector?: WalletConnector }) => {
      const connector = args?.connector;
      if (connector?.kind === "walletconnect") {
        return connectWalletConnectV2();
      }
      if (connector?.detail) {
        setConnectStatus("connecting");
        try {
          const connected = await connectEip1193Provider(connector.detail);
          setConnectedState(
            connector.detail.provider,
            connected,
            connector.detail.info.name || "Injected"
          );
          return connected;
        } catch (error) {
          setConnectError(error);
          setConnectStatus("error");
          throw error;
        }
      }
      if (evmProviders.length > 0 || fallbackWindowEthereumProviders().length > 0) {
        return connectEip1193();
      }
      return connectWalletConnectV2();
    },
    [connectEip1193, connectWalletConnectV2, evmProviders, setConnectedState]
  );

  const connect = useCallback(async () => {
    await connectAsync();
  }, [connectAsync]);

  const disconnect = useCallback(async () => {
    await disconnectEvm();
  }, [disconnectEvm]);

  const requestAccounts = useCallback(async () => {
    const target =
      activeProvider ??
      evmProviders[0]?.provider ??
      fallbackWindowEthereumProviders()[0]?.provider ??
      null;
    if (!target) return null;
    try {
      const accountsRaw = await target.request({
        method: "eth_requestAccounts",
      });
      const accounts = Array.isArray(accountsRaw)
        ? accountsRaw.map((item) => String(item))
        : [];
      if (accounts[0]) {
        const chainIdRaw = await target.request({ method: "eth_chainId" });
        setConnectedState(
          target,
          {
            address: accounts[0],
            chainId: parseChainId(chainIdRaw),
          },
          evmProviderLabel ?? "Injected"
        );
      }
      return accounts.length ? accounts : null;
    } catch {
      return null;
    }
  }, [activeProvider, evmProviderLabel, evmProviders, setConnectedState]);

  const watchAsset = useCallback(
    async (asset: WalletAsset): Promise<boolean> => {
      if (!activeProvider) return false;
      try {
        const result = await activeProvider.request({
          method: "wallet_watchAsset",
          params: {
            type: "ERC20",
            options: {
              address: asset.address,
              symbol: asset.symbol,
              decimals: asset.decimals,
              image: asset.icon,
            },
          },
        });
        return Boolean(result);
      } catch {
        return false;
      }
    },
    [activeProvider]
  );

  const account = useMemo(
    () =>
      activeProvider && evmAddress
        ? createWalletAccount(activeProvider, publicProvider, evmAddress)
        : null,
    [activeProvider, evmAddress, publicProvider]
  );

  const chain = useMemo(() => {
    const label = chainLabel(evmChainId);
    return {
      id: evmChainId ?? undefined,
      name: label.name,
      network: label.network,
    };
  }, [evmChainId]);

  const value = useMemo<WalletContextValue>(
    () => ({
      address: evmAddress,
      isConnected: Boolean(evmAddress),
      isConnecting: connectStatus === "connecting",
      isReconnecting: false,
      status: evmAddress ? "connected" : connectStatus,
      chain,
      chainId: evmChainId,
      account,
      accountMissing: Boolean(evmAddress && !account),
      connect,
      connectAsync,
      disconnect,
      disconnectAsync: disconnectEvm,
      connectors,
      connectStatus,
      connectError,
      requestAccounts,
      watchAsset,
      connectEip1193,
      connectWalletConnectV2,
      disconnectEvm,
      evm: {
        providers: evmProviders.map((item) => item.info),
        address: evmAddress,
        chainId: evmChainId,
        providerName: evmProviderLabel,
        isConnected: Boolean(evmAddress),
        error: connectError,
        connectInjected: connectEip1193,
        connectWalletConnectV2,
        disconnect: disconnectEvm,
      },
    }),
    [
      account,
      chain,
      connect,
      connectAsync,
      connectEip1193,
      connectError,
      connectStatus,
      connectWalletConnectV2,
      connectors,
      disconnect,
      disconnectEvm,
      evmAddress,
      evmChainId,
      evmProviderLabel,
      evmProviders,
      requestAccounts,
      watchAsset,
    ]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet must be used within WalletProvider.");
  }
  return value;
}

export const useAccount = () => useWallet().account;

/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  encodeExecuteData,
  getDefaultProvider,
  sendTransaction,
  waitForTransaction,
  type ProviderInterface,
} from "@inshell/ethereum";
import {
  EIP6963_ANNOUNCE_EVENT,
  EIP6963_REQUEST_EVENT,
  chainLabel,
  connectEip1193Provider,
  createWalletConnectEthereumProvider,
  discoverEip6963Providers,
  fallbackWindowEthereumProviders,
  mergeProviderDetails,
  normalizeProviderDetail,
  parseChainId,
  readEvmChainIds,
  readWalletConnectProjectId,
  readWalletConnectRelayUrl,
  walletAnalyticsErrorCategory,
  walletConnectMetadata,
  walletConnectRpcMap,
  type Eip1193Provider,
  type Eip6963ProviderDetail,
  type Eip6963ProviderInfo,
  type WalletConnectEthereumProvider,
  type WalletConnector,
} from "./evm";

export * from "./evm";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

let walletConnectConfigWarningShown = false;

function warnMissingWalletConnectProjectId() {
  const isProduction = getEnv("PROD") === true || getEnv("MODE") === "production";
  if (!isProduction || readWalletConnectProjectId(getEnv) || walletConnectConfigWarningShown) {
    return;
  }
  walletConnectConfigWarningShown = true;
  console.warn("WalletConnect disabled: missing VITE_WALLETCONNECT_PROJECT_ID.");
}

export type WalletAsset = {
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  icon?: string;
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
    provider: Eip1193Provider | null;
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

type WalletAnalyticsEventType =
  | "wallet_connect_started"
  | "wallet_connect_succeeded"
  | "wallet_connect_failed";

function trackWalletAnalytics(
  eventType: WalletAnalyticsEventType,
  metadata: Record<string, unknown>
) {
  try {
    const analytics = typeof window === "undefined"
      ? null
      : (window as any).inshellAnalytics;
    analytics?.track?.({
      eventType,
      metadata,
    });
  } catch {
    /* analytics must never affect wallet flow */
  }
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
  const walletConnectRestoreRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    warnMissingWalletConnectProjectId();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let stopped = false;
    const refresh = async () => {
      const discovered = await discoverEip6963Providers();
      if (stopped) return;
      setEvmProviders((prev) => mergeProviderDetails(prev, discovered));
    };
    void refresh();
    const onAnnounce = (event: globalThis.Event) => {
      const normalized = normalizeProviderDetail(
        (event as globalThis.CustomEvent).detail
      );
      if (!normalized) return;
      setEvmProviders((prev) => mergeProviderDetails(prev, [normalized]));
    };
    window.addEventListener(
      EIP6963_ANNOUNCE_EVENT,
      onAnnounce as globalThis.EventListener
    );
    const onEthereumInitialized = () => {
      void refresh();
    };
    window.addEventListener(
      "ethereum#initialized",
      onEthereumInitialized as globalThis.EventListener
    );
    window.dispatchEvent(new globalThis.Event(EIP6963_REQUEST_EVENT));
    return () => {
      stopped = true;
      window.removeEventListener(
        EIP6963_ANNOUNCE_EVENT,
        onAnnounce as globalThis.EventListener
      );
      window.removeEventListener(
        "ethereum#initialized",
        onEthereumInitialized as globalThis.EventListener
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

  const createConfiguredWalletConnectProvider = useCallback(
    async (showQrModal: boolean) => {
      const projectId = readWalletConnectProjectId(getEnv);
      if (!projectId) {
        throw new Error("Missing VITE_WALLETCONNECT_PROJECT_ID.");
      }
      const chains = readEvmChainIds(getEnv);
      return createWalletConnectEthereumProvider({
        projectId,
        chains,
        rpcMap: walletConnectRpcMap(chains, getEnv),
        relayUrl: readWalletConnectRelayUrl(getEnv),
        showQrModal,
        metadata: walletConnectMetadata(),
      });
    },
    []
  );

  const restoreWalletConnectV2 = useCallback(async (options?: { force?: boolean }) => {
    if (
      activeProvider ||
      evmAddress ||
      (!options?.force && connectStatus === "connecting") ||
      !readWalletConnectProjectId(getEnv)
    ) {
      return;
    }
    if (walletConnectRestoreRef.current) {
      await walletConnectRestoreRef.current;
      return;
    }
    const task = (async () => {
      try {
        const wcProvider = await createConfiguredWalletConnectProvider(false);
        if (!(wcProvider as any)?.session) return;
        const accountsRaw = (await wcProvider.request({
          method: "eth_accounts",
        })) as unknown;
        const accounts = Array.isArray(accountsRaw)
          ? accountsRaw.map((item) => String(item))
          : [];
        if (!accounts[0]) return;
        const chainIdRaw = await wcProvider.request({ method: "eth_chainId" });
        setWalletConnectProvider(wcProvider);
        setConnectedState(
          wcProvider,
          {
            address: accounts[0],
            chainId: parseChainId(chainIdRaw),
          },
          "WalletConnect"
        );
        trackWalletAnalytics("wallet_connect_succeeded", {
          walletKind: "walletconnect",
          walletStage: "restored",
        });
      } catch {
        /* A missing/restoring session is non-fatal and must not block connect. */
      }
    })();
    walletConnectRestoreRef.current = task;
    try {
      await task;
    } finally {
      walletConnectRestoreRef.current = null;
    }
  }, [
    activeProvider,
    connectStatus,
    createConfiguredWalletConnectProvider,
    evmAddress,
    setConnectedState,
  ]);

  useEffect(() => {
    void restoreWalletConnectV2();
  }, [restoreWalletConnectV2]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restoreTimers = new Set<number>();
    const scheduleRestore = (delayMs: number) => {
      const timer = window.setTimeout(() => {
        restoreTimers.delete(timer);
        if (document.visibilityState === "hidden") return;
        void restoreWalletConnectV2({ force: true });
      }, delayMs);
      restoreTimers.add(timer);
    };
    const onFocusOrVisible = () => {
      if (document.visibilityState === "hidden") return;
      void restoreWalletConnectV2({ force: true });
      scheduleRestore(500);
      scheduleRestore(2000);
    };
    window.addEventListener("focus", onFocusOrVisible);
    window.addEventListener("pageshow", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);
    return () => {
      for (const timer of restoreTimers) window.clearTimeout(timer);
      restoreTimers.clear();
      window.removeEventListener("focus", onFocusOrVisible);
      window.removeEventListener("pageshow", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, [restoreWalletConnectV2]);

  const connectEip1193 = useCallback(async () => {
    setConnectStatus("connecting");
    trackWalletAnalytics("wallet_connect_started", {
      walletKind: "injected",
      walletStage: "request_accounts",
    });
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
      trackWalletAnalytics("wallet_connect_succeeded", {
        walletKind: "injected",
        walletStage: "connected",
      });
      return connected;
    } catch (error) {
      setConnectError(error);
      setConnectStatus("error");
      trackWalletAnalytics("wallet_connect_failed", {
        walletKind: "injected",
        walletStage: "request_accounts",
        errorCategory: walletAnalyticsErrorCategory(error),
      });
      throw error;
    }
  }, [evmProviders, setConnectedState, walletConnectProvider]);

  const connectWalletConnectV2 = useCallback(async () => {
    setConnectStatus("connecting");
    trackWalletAnalytics("wallet_connect_started", {
      walletKind: "walletconnect",
      walletStage: "request_accounts",
    });
    try {
      const wcProvider = await createConfiguredWalletConnectProvider(true);
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
      setConnectedState(wcProvider, connected, "WalletConnect");
      trackWalletAnalytics("wallet_connect_succeeded", {
        walletKind: "walletconnect",
        walletStage: "connected",
      });
      return connected;
    } catch (error) {
      setConnectError(error);
      setConnectStatus("error");
      trackWalletAnalytics("wallet_connect_failed", {
        walletKind: "walletconnect",
        walletStage: "request_accounts",
        errorCategory: walletAnalyticsErrorCategory(error),
      });
      throw error;
    }
  }, [createConfiguredWalletConnectProvider, setConnectedState]);

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
    if (readWalletConnectProjectId(getEnv)) {
      injected.push({
        id: "walletconnect-v2",
        name: "WalletConnect",
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
        trackWalletAnalytics("wallet_connect_started", {
          walletKind: "injected",
          walletStage: "request_accounts",
        });
        try {
          const connected = await connectEip1193Provider(connector.detail);
          setConnectedState(
            connector.detail.provider,
            connected,
            connector.detail.info.name || "Injected"
          );
          trackWalletAnalytics("wallet_connect_succeeded", {
            walletKind: "injected",
            walletStage: "connected",
          });
          return connected;
        } catch (error) {
          setConnectError(error);
          setConnectStatus("error");
          trackWalletAnalytics("wallet_connect_failed", {
            walletKind: "injected",
            walletStage: "request_accounts",
            errorCategory: walletAnalyticsErrorCategory(error),
          });
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
        provider: activeProvider,
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
      activeProvider,
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

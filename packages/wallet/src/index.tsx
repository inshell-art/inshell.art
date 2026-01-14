/* eslint-disable react-refresh/only-export-components */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  StarknetConfig,
  argent,
  braavos,
  jsonRpcProvider,
  type Connector,
  useAccount as useStarknetAccount,
  useConnect,
  useDisconnect,
  useNetwork,
} from "@starknet-react/core";
import { devnet, mainnet, sepolia } from "@starknet-react/chains";
import { QueryClient } from "@tanstack/react-query";
import {
  RpcProvider,
  WalletAccount,
  type ProviderInterface,
  type StarknetWindowObject,
  requestAccounts as walletRequestAccounts,
} from "starknet";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

type InjectedWallet = {
  id: string;
  wallet: StarknetWindowObject;
};

function findInjectedWallet(): InjectedWallet | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const priority = ["starknet_ready", "starknet"];
  for (const key of priority) {
    const wallet = w[key] as StarknetWindowObject | undefined;
    if (wallet?.request) return { id: key, wallet };
  }
  for (const key of Object.keys(w)) {
    if (!key.startsWith("starknet_")) continue;
    const wallet = w[key] as StarknetWindowObject | undefined;
    if (wallet?.request) return { id: key, wallet };
  }
  return null;
}

async function requestInjectedAccounts(
  wallet: StarknetWindowObject
): Promise<string[]> {
  try {
    const res = await walletRequestAccounts(wallet, false);
    if (Array.isArray(res)) return res as string[];
  } catch {
    // fall back to direct request
  }
  try {
    const anyWallet = wallet as any;
    if (typeof anyWallet.requestAccounts === "function") {
      const res = await anyWallet.requestAccounts(false);
      if (Array.isArray(res)) return res as string[];
    }
    if (typeof anyWallet.request === "function") {
      const res = await anyWallet.request({
        type: "wallet_requestAccounts",
        params: { silent_mode: false },
      });
      if (Array.isArray(res)) return res as string[];
      if (res?.accounts && Array.isArray(res.accounts)) return res.accounts;
    }
  } catch {
    return [];
  }
  return [];
}

function createFallbackProvider(chain?: {
  rpcUrls?: { public?: { http?: string[] }; default?: { http?: string[] } };
}): ProviderInterface {
  const rpcUrl = getEnv("VITE_STARKNET_RPC") as string | undefined;
  if (rpcUrl) return new RpcProvider({ nodeUrl: rpcUrl });
  const fallback =
    chain?.rpcUrls?.public?.http?.[0] ??
    chain?.rpcUrls?.default?.http?.[0] ??
    "http://127.0.0.1:5050/rpc";
  return new RpcProvider({ nodeUrl: fallback });
}

const CONNECTOR_PATCH = Symbol("inshellWalletPatch");

function patchConnector(
  connector: Connector,
  fallbackProvider: ProviderInterface
): Connector {
  const anyConnector = connector as any;
  if (anyConnector[CONNECTOR_PATCH]) return connector;
  anyConnector[CONNECTOR_PATCH] = true;
  const originalAccount = anyConnector.account?.bind(connector);
  if (typeof originalAccount !== "function") return connector;
  anyConnector.account = async (...args: any[]) => {
    try {
      return await originalAccount(...args);
    } catch (err) {
      const injected = findInjectedWallet();
      if (!injected?.wallet) throw err;
      const accounts = await requestInjectedAccounts(injected.wallet);
      const address = accounts?.[0];
      if (!address) throw err;
      return new WalletAccount(fallbackProvider, injected.wallet, address);
    }
  };
  return connector;
}

const provider = jsonRpcProvider({
  rpc: (chain) => {
    const rpcUrl = getEnv("VITE_STARKNET_RPC") as string | undefined;
    if (rpcUrl) return { nodeUrl: rpcUrl };
    const fallback =
      chain.rpcUrls?.public?.http?.[0] ?? chain.rpcUrls?.default?.http?.[0];
    return fallback ? { nodeUrl: fallback } : null;
  },
});

const knownChains = {
  devnet,
  sepolia,
  mainnet,
} as const;

function resolveChains(network: string) {
  if (network === "devnet") return [knownChains.devnet];
  if (network === "sepolia") return [knownChains.sepolia];
  if (network === "mainnet") return [knownChains.mainnet];
  return [knownChains.devnet, knownChains.sepolia, knownChains.mainnet];
}

export type WalletProviderProps = {
  children?: React.ReactNode;
};

export function WalletProvider({ children }: WalletProviderProps) {
  const queryClient = useMemo(() => new QueryClient(), []);
  const network = (getEnv("VITE_NETWORK") as string | undefined) ?? "devnet";
  const chains = useMemo(() => resolveChains(network), [network]);
  const defaultChainId = chains[0]?.id;
  const fallbackProvider = useMemo(
    () => createFallbackProvider(chains[0]),
    [chains]
  );
  const connectors = useMemo(
    () =>
      [argent(), braavos()].map((connector) =>
        patchConnector(connector, fallbackProvider)
      ),
    [fallbackProvider]
  );

  return (
    <StarknetConfig
      chains={chains}
      provider={provider}
      connectors={connectors}
      autoConnect
      defaultChainId={defaultChainId}
      queryClient={queryClient}
    >
      {children}
    </StarknetConfig>
  );
}

export function useWallet() {
  const account = useStarknetAccount();
  const { chain } = useNetwork();
  const {
    connect,
    connectAsync,
    connectors: availableConnectors,
    status,
    error,
  } = useConnect();
  const { disconnect, disconnectAsync } = useDisconnect();
  const [fallbackAccount, setFallbackAccount] = useState<WalletAccount | null>(
    null
  );
  const [fallbackWalletId, setFallbackWalletId] = useState<string | null>(null);
  const accountMissing = Boolean(account.isConnected && !account.account);
  const fallbackProvider = useMemo(() => createFallbackProvider(chain), [chain]);

  useEffect(() => {
    if (!account.isConnected || account.account || !account.address) {
      setFallbackAccount(null);
      setFallbackWalletId(null);
      return;
    }
    const injected = findInjectedWallet();
    if (!injected?.wallet) {
      setFallbackAccount(null);
      setFallbackWalletId(null);
      return;
    }
    if (
      fallbackAccount &&
      fallbackWalletId === injected.id &&
      fallbackAccount.address === account.address
    ) {
      return;
    }
    setFallbackWalletId(injected.id);
    setFallbackAccount(
      new WalletAccount(fallbackProvider, injected.wallet, account.address)
    );
  }, [
    account.isConnected,
    account.account,
    account.address,
    fallbackProvider,
    fallbackAccount,
    fallbackWalletId,
  ]);

  const requestAccounts = useCallback(async () => {
    const injected = findInjectedWallet();
    if (!injected?.wallet) return null;
    const accounts = await requestInjectedAccounts(injected.wallet);
    return accounts.length ? accounts : null;
  }, []);

  return {
    ...account,
    account: account.account ?? fallbackAccount ?? undefined,
    accountMissing,
    chain,
    chainId: chain?.id,
    connect,
    connectAsync,
    disconnect,
    disconnectAsync,
    connectors: availableConnectors,
    connectStatus: status,
    connectError: error,
    requestAccounts,
  };
}

export const useAccount = useStarknetAccount;

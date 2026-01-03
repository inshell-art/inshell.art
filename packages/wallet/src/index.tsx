/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from "react";
import {
  StarknetConfig,
  argent,
  braavos,
  jsonRpcProvider,
  useAccount as useStarknetAccount,
  useConnect,
  useDisconnect,
  useNetwork,
} from "@starknet-react/core";
import { devnet, mainnet, sepolia } from "@starknet-react/chains";
import { QueryClient } from "@tanstack/react-query";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
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

const connectors = [argent(), braavos()];
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
  const { connect, connectors: availableConnectors, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return {
    ...account,
    chain,
    chainId: chain?.id,
    connect,
    disconnect,
    connectors: availableConnectors,
    connectStatus: status,
    connectError: error,
  };
}

export const useAccount = useStarknetAccount;

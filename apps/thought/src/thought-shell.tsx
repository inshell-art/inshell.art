/* eslint-disable react-refresh/only-export-components */
import { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { InshellTopBar } from "@inshell/inshell-shell";
import {
  WalletProvider,
  useWallet,
  type Eip1193Provider,
} from "@inshell/wallet";

export type ThoughtShellWalletSnapshot = {
  ready: boolean;
  provider: Eip1193Provider | null;
  address: string;
  chainId: number | null;
  connectorCount: number;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
};

const emptyCommand = async () => {};
const listeners = new Set<(snapshot: ThoughtShellWalletSnapshot) => void>();
let shellRoot: Root | null = null;
let walletSnapshot: ThoughtShellWalletSnapshot = {
  ready: false,
  provider: null,
  address: "",
  chainId: null,
  connectorCount: 0,
  isConnecting: false,
  connect: emptyCommand,
  disconnect: emptyCommand,
  refresh: emptyCommand,
};

const publishWalletSnapshot = (snapshot: ThoughtShellWalletSnapshot) => {
  walletSnapshot = snapshot;
  listeners.forEach((listener) => listener(snapshot));
};

export const getThoughtShellWallet = () => walletSnapshot;

export const subscribeThoughtShellWallet = (
  listener: (snapshot: ThoughtShellWalletSnapshot) => void,
) => {
  listeners.add(listener);
  listener(walletSnapshot);
  return () => listeners.delete(listener);
};

function ThoughtWalletBridge() {
  const {
    address,
    chainId,
    connectAsync,
    connectors,
    disconnectWallet,
    evm,
    isConnecting,
    refreshWallet,
  } = useWallet();

  useEffect(() => {
    publishWalletSnapshot({
      ready: true,
      provider: evm.provider,
      address: address ?? "",
      chainId: chainId ?? null,
      connectorCount: connectors.length,
      isConnecting,
      connect: async () => {
        await connectAsync();
      },
      disconnect: disconnectWallet,
      refresh: refreshWallet,
    });
  }, [
    address,
    chainId,
    connectAsync,
    connectors.length,
    disconnectWallet,
    evm.provider,
    isConnecting,
    refreshWallet,
  ]);

  return null;
}

const disconnectedWalletNote = (chainId: number) => {
  if (chainId === 11155111) return "Sepolia ETH";
  if (chainId === 31337) return "Local ETH";
  return undefined;
};

export const mountThoughtShell = (element: HTMLElement, expectedChainId: number) => {
  if (shellRoot) return;
  shellRoot = createRoot(element);
  shellRoot.render(
    <WalletProvider>
      <ThoughtWalletBridge />
      <InshellTopBar
        active="thought"
        expectedChainId={expectedChainId}
        disconnectedWalletNote={disconnectedWalletNote(expectedChainId)}
      />
    </WalletProvider>,
  );
};

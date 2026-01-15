/* global HTMLDivElement, MouseEvent, KeyboardEvent, Node */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Connector } from "@starknet-react/core";
import { useWallet } from "@inshell/wallet";

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function parseChainId(value: unknown): bigint | null {
  if (value == null) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim().length) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }
  return null;
}

function shortAddress(address?: string) {
  if (!address) return "--";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function resolveExplorerBase(): string {
  const base = getEnvValue("VITE_EXPLORER_BASE_URL");
  if (typeof base === "string" && base.trim()) return base.trim();
  return "https://sepolia.voyager.online";
}

function resolveExpectedChainId(): bigint | null {
  return parseChainId(getEnvValue("VITE_EXPECTED_CHAIN_ID"));
}

function describeExpectedChain(chainId: bigint | null): string {
  if (!chainId) return "the expected network";
  const hex = chainId.toString(16).toLowerCase();
  if (hex === "534e5f5345504f4c4941") return "Sepolia";
  if (hex === "534e5f4d41494e") return "Mainnet";
  return "the expected network";
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

type HeaderWalletCTAProps = {
  onMint?: () => void;
};

type ConnectorState = {
  connector: Connector;
  available: boolean;
};

export default function HeaderWalletCTA({ onMint }: HeaderWalletCTAProps) {
  const {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    status,
    chain,
    chainId,
    connect,
    connectAsync,
    disconnect,
    disconnectAsync,
    connectors,
    connectStatus,
    requestAccounts,
    accountMissing,
  } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const expectedChainId = useMemo(() => resolveExpectedChainId(), []);
  const currentChainId = useMemo(() => parseChainId(chainId), [chainId]);
  const wrongNetwork =
    Boolean(isConnected) &&
    expectedChainId !== null &&
    currentChainId !== null &&
    expectedChainId !== currentChainId;

  const isBusy =
    Boolean(isConnecting) ||
    Boolean(isReconnecting) ||
    connectStatus === "pending" ||
    connectStatus === "loading" ||
    status === "connecting" ||
    status === "reconnecting";

  const expectedLabel = describeExpectedChain(expectedChainId);
  const explorerBase = resolveExplorerBase();
  const explorerUrl = address
    ? `${explorerBase.replace(/\/$/, "")}/contract/${address}`
    : null;
  const networkLabel = chain?.network ?? chain?.name ?? "unknown";

  const connectorsState = useMemo<ConnectorState[]>(() => {
    return connectors.map((connector) => {
      let available = true;
      if (typeof window !== "undefined") {
        try {
          available = connector.available();
        } catch {
          available = false;
        }
      }
      return { connector, available };
    });
  }, [connectors]);

  const primaryConnector = useMemo(() => {
    const available = connectorsState.find((item) => item.available);
    return available?.connector ?? connectors[0];
  }, [connectorsState, connectors]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isConnected || !address) {
      setMenuOpen(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const ctaLabel = isBusy
    ? "connecting..."
    : isConnected
      ? accountMissing
        ? "unlock wallet"
        : wrongNetwork
          ? "wrong network"
          : "mint"
      : "connect";
  const ctaDisabled = isBusy || (isConnected && wrongNetwork && !accountMissing);
  const dotState = isBusy
    ? "is-pending"
    : isConnected
      ? accountMissing || wrongNetwork
        ? "is-warning"
        : "is-on"
      : "is-off";
  const dotTooltip = isBusy
    ? "connecting..."
    : isConnected && address
      ? accountMissing
        ? "unlock wallet to continue"
        : `${shortAddress(address)} - ${wrongNetwork ? "wrong network" : networkLabel}`
      : "not connected";

  const reconnectWallet = async () => {
    if (!primaryConnector) return;
    try {
      await disconnectAsync?.();
    } catch {
      // no-op
    }
    if (connectAsync) {
      await connectAsync({ connector: primaryConnector });
    } else {
      connect({ connector: primaryConnector });
    }
  };

  const handlePrimaryClick = async () => {
    if (ctaDisabled) return;
    if (!isConnected) {
      if (!primaryConnector) return;
      connect({ connector: primaryConnector });
      return;
    }
    if (accountMissing) {
      if (requestAccounts) {
        await requestAccounts();
      }
      void reconnectWallet();
      return;
    }
    if (!wrongNetwork) {
      onMint?.();
    }
  };

  const handleDotClick = async () => {
    if (isBusy) return;
    if (!isConnected) {
      if (!primaryConnector) return;
      connect({ connector: primaryConnector });
      return;
    }
    if (accountMissing) {
      if (requestAccounts) {
        await requestAccounts();
      }
      void reconnectWallet();
      return;
    }
    setMenuOpen((open) => !open);
  };

  const handleCopy = async () => {
    if (!address) return;
    const ok = await copyToClipboard(address);
    if (ok) setCopied(true);
  };

  return (
    <div className="dotfield__cta" ref={menuRef}>
      <button
        className="dotfield__mint"
        type="button"
        onClick={handlePrimaryClick}
        disabled={ctaDisabled}
        title={wrongNetwork ? `Switch wallet network to ${expectedLabel}` : undefined}
      >
        [ {ctaLabel} ]
      </button>
      <button
        type="button"
        className="dotfield__cta-address"
        onClick={handleDotClick}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={dotTooltip}
        title={dotTooltip}
      >
        <span className={`dotfield__cta-dot ${dotState}`} aria-hidden="true" />
      </button>
      {menuOpen && isConnected && address && (
        <div className="dotfield__cta-menu" role="menu">
          <div className="dotfield__cta-menu-meta">
            <span className="dotfield__cta-menu-label">address</span>
            <span className="dotfield__cta-menu-value">{address}</span>
          </div>
          <div className="dotfield__cta-menu-meta">
            <span className="dotfield__cta-menu-label">network</span>
            <span className="dotfield__cta-menu-value">{networkLabel}</span>
          </div>
          <button
            type="button"
            className="dotfield__cta-menu-item"
            onClick={handleCopy}
          >
            {copied ? "copied" : "copy address"}
          </button>
          {explorerUrl && (
            <a
              className="dotfield__cta-menu-item"
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              open in explorer
            </a>
          )}
          <button
            type="button"
            className="dotfield__cta-menu-item"
            onClick={() => {
              disconnect();
              setMenuOpen(false);
            }}
          >
            disconnect
          </button>
        </div>
      )}
    </div>
  );
}

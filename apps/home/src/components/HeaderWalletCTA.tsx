/* global HTMLDivElement, MouseEvent, KeyboardEvent, Node */
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@inshell/wallet";

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
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
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaClick: () => void;
  dotState?: "off" | "on" | "amber" | "error";
  dotTooltip?: string;
  lastTxHash?: string | null;
  onCopyNotice?: () => void;
  onDisconnectNotice?: () => void;
};

export default function HeaderWalletCTA({
  ctaLabel,
  ctaDisabled,
  onCtaClick,
  dotState = "off",
  dotTooltip,
  lastTxHash,
  onCopyNotice,
  onDisconnectNotice,
}: HeaderWalletCTAProps) {
  const { address, chain, disconnect, isConnected } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const explorerBase = resolveExplorerBase();
  const explorerRoot = explorerBase.replace(/\/$/, "");
  const connectedAddress = isConnected ? address : undefined;
  const explorerUrl = connectedAddress
    ? `${explorerRoot}/contract/${connectedAddress}`
    : null;
  const txUrl = lastTxHash ? `${explorerRoot}/tx/${lastTxHash}` : null;
  const networkLabel = chain?.network ?? chain?.name ?? "unknown";

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

  const dotClass =
    dotState === "on"
      ? "is-on"
      : dotState === "amber"
      ? "is-pending"
      : dotState === "error"
      ? "is-error"
      : "is-off";
  const tooltip =
    dotTooltip ??
    (connectedAddress
      ? `${shortAddress(connectedAddress)} - ${networkLabel}`
      : "not connected");

  const handleCopy = async () => {
    if (!connectedAddress) return;
    const ok = await copyToClipboard(connectedAddress);
    if (ok) onCopyNotice?.();
  };

  const handleDisconnect = () => {
    if (!connectedAddress) return;
    disconnect();
    onDisconnectNotice?.();
    setMenuOpen(false);
  };

  return (
    <div className="dotfield__cta" ref={menuRef}>
      <button
        className="dotfield__mint"
        type="button"
        onClick={onCtaClick}
        disabled={ctaDisabled}
      >
        [ {ctaLabel} ]
      </button>
      <button
        type="button"
        className="dotfield__cta-address"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={tooltip}
        title={tooltip}
      >
        <span className={`dotfield__cta-dot ${dotClass}`} aria-hidden="true" />
      </button>
      {menuOpen && (
        <div className="dotfield__cta-menu" role="menu">
          <div className="dotfield__cta-menu-meta">
            <span className="dotfield__cta-menu-label">address</span>
            <span className="dotfield__cta-menu-value">
              {connectedAddress ?? "—"}
            </span>
          </div>
          <div className="dotfield__cta-menu-meta">
            <span className="dotfield__cta-menu-label">network</span>
            <span className="dotfield__cta-menu-value">{networkLabel}</span>
          </div>
          <button
            type="button"
            className="dotfield__cta-menu-item"
            onClick={handleCopy}
            disabled={!connectedAddress}
          >
            copy address
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
          {txUrl && (
            <a
              className="dotfield__cta-menu-item"
              href={txUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              last tx
            </a>
          )}
          <button
            type="button"
            className="dotfield__cta-menu-item"
            onClick={handleDisconnect}
            disabled={!connectedAddress}
          >
            disconnect
          </button>
        </div>
      )}
    </div>
  );
}

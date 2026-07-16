/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type WalletConnector } from "@inshell/wallet";
import { resolveInshellLinks } from "./links";
import { INSHELL_OPEN_WALLET_EVENT } from "./wallet-events";

export { resolveInshellLinks } from "./links";
export { INSHELL_OPEN_WALLET_EVENT, openInshellWallet } from "./wallet-events";

export type InshellSurface = "home" | "path" | "thought" | "works";

export type InshellTopBarProps = {
  active?: InshellSurface;
  expectedChainId?: number;
  compact?: boolean;
  disconnectedWalletNote?: string;
};

export type InshellWalletModalProps = {
  expectedChainId?: number;
};

export type InshellWalletPickerProps = {
  connectors: WalletConnector[];
  onConnect: (connector: WalletConnector) => void;
};

function shortAddress(address?: string | null) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function networkLabel(chain?: { id?: number; name?: string; network?: string }) {
  const raw = chain?.name?.trim() || chain?.network?.trim() || "";
  if (!raw) return "unknown";
  return raw.replace(/\btestnet\b/gi, "").replace(/\s+/g, " ").trim() || "unknown";
}

async function copyText(value: string) {
  if (!value) return false;
  try {
    await navigator.clipboard?.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function InshellWalletPicker({
  connectors,
  onConnect,
}: InshellWalletPickerProps) {
  return (
    <div className="inshell-wallet-picker" role="menu" aria-label="Wallet options">
      <div className="inshell-wallet-picker__title">wallet options</div>
      <p className="inshell-wallet-picker__note">
        address read only.
        <br />
        no signature.
        <br />
        no tx or approval.
        <br />
        <a href="/verify#wallet-notes" target="_blank" rel="noopener noreferrer">
          verify ↗
        </a>
      </p>
      {connectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          className="inshell-wallet-picker__item"
          role="menuitem"
          onClick={() => onConnect(connector)}
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}

export function InshellWalletModal({ expectedChainId }: InshellWalletModalProps) {
  const {
    address,
    chain,
    chainId,
    connectAsync,
    connectors,
    disconnectWallet,
    evm,
    isConnected,
    refreshWallet,
  } = useWallet();
  const [notice, setNotice] = useState("");
  const expectedMismatch = Boolean(
    expectedChainId && chainId && chainId !== expectedChainId
  );
  const mode = isConnected ? "read-only connected" : "disconnected";

  const connectWith = async (connector?: WalletConnector) => {
    setNotice("");
    try {
      await connectAsync(connector ? { connector } : undefined);
      setNotice("wallet connected.");
    } catch (error) {
      setNotice(String((error as any)?.message ?? "wallet connection failed."));
    }
  };

  const handleRefresh = async () => {
    setNotice("");
    try {
      await refreshWallet();
      setNotice("wallet refreshed.");
    } catch (error) {
      setNotice(String((error as any)?.message ?? "wallet refresh failed."));
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setNotice("disconnected in Inshell. to fully remove site access, disconnect this site in your wallet.");
  };

  const handleSwitchNetwork = async () => {
    if (!expectedChainId || !evm?.provider) return;
    setNotice("");
    try {
      await evm.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
      });
      await refreshWallet();
      setNotice("network ready.");
    } catch (error) {
      setNotice(String((error as any)?.message ?? "network switch failed."));
    }
  };

  const handleCopy = async () => {
    if (!address) return;
    setNotice((await copyText(address)) ? "address copied." : "copy failed.");
  };

  return (
    <section className="inshell-wallet-modal" role="dialog" aria-label="wallet">
      <h2>wallet</h2>
      <dl className="inshell-wallet-modal__rows">
        <div>
          <dt>address</dt>
          <dd>{address ?? "-"}</dd>
        </div>
        <div>
          <dt>network</dt>
          <dd>{networkLabel(chain)}</dd>
        </div>
        <div>
          <dt>mode</dt>
          <dd>{mode}</dd>
        </div>
        <div>
          <dt>signature</dt>
          <dd>none</dd>
        </div>
        <div>
          <dt>transaction</dt>
          <dd>none</dd>
        </div>
      </dl>
      <p className="inshell-wallet-modal__copy">
        address read only.<br />
        no signature.<br />
        no tx or approval.
      </p>
      <div className="inshell-wallet-modal__actions">
        {!isConnected ? (
          connectors.length ? (
            connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={() => void connectWith(connector)}
              >
                {connector.name}
              </button>
            ))
          ) : (
            <button type="button" onClick={() => void connectWith()}>
              connect wallet
            </button>
          )
        ) : (
          <>
            <button type="button" onClick={() => void handleCopy()}>copy address</button>
            <button type="button" onClick={() => void handleRefresh()}>refresh</button>
            {expectedMismatch ? (
              <button type="button" onClick={() => void handleSwitchNetwork()}>
                switch network
              </button>
            ) : null}
            <button type="button" onClick={() => void handleDisconnect()}>disconnect</button>
          </>
        )}
      </div>
      {notice ? <p className="inshell-wallet-modal__notice">{notice}</p> : null}
    </section>
  );
}

export function InshellTopBar({
  expectedChainId,
  compact,
  disconnectedWalletNote,
}: InshellTopBarProps) {
  const {
    address,
    chainId,
    connectAsync,
    connectors,
    connectError,
    isConnected,
    isConnecting,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const barRef = useRef<HTMLDivElement | null>(null);
  const links = useMemo(() => resolveInshellLinks(), []);
  const expectedMismatch = Boolean(
    expectedChainId && chainId && chainId !== expectedChainId
  );
  const dotState = connectError
    ? "error"
    : isConnecting || expectedMismatch
    ? "pending"
    : isConnected
    ? "on"
    : "off";
  const addressLabel = shortAddress(address);

  const connectWith = async (connector: WalletConnector) => {
    setNotice("");
    try {
      await connectAsync({ connector });
      setNotice("wallet connected.");
    } catch (error) {
      setNotice(String((error as any)?.message ?? "wallet connection failed."));
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!barRef.current) return;
      if (barRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const openWallet = () => setOpen(true);
    window.addEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    return () => {
      window.removeEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    };
  }, []);

  return (
    <header className={`inshell-topbar${compact ? " inshell-topbar--compact" : ""}`} ref={barRef}>
      <a className="inshell-topbar__brand" href={links.home}>
        INSHELL
      </a>
      <div className="inshell-topbar__right">
        <nav className="inshell-topbar__nav" aria-label="Inshell menu">
          <a
            className="inshell-topbar__link"
            href={links.path}
            aria-label="permission token"
            title="permission token"
          >
            $PATH
          </a>
          <a
            className="inshell-topbar__link"
            href={links.docs}
            aria-label="Inshell docs"
            title="Inshell docs"
          >
            docs
          </a>
          <a
            className="inshell-topbar__link"
            href={links.x}
            aria-label="Inshell on X"
            title="Inshell on X"
            target="_blank"
            rel="noreferrer noopener"
          >
            x
          </a>
        </nav>
        <div
          className={`inshell-topbar__wallet-surface${
            disconnectedWalletNote && !addressLabel
              ? " inshell-topbar__wallet-surface--with-note"
              : ""
          }`}
        >
          <button
            className="inshell-topbar__wallet"
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={isConnected && addressLabel ? `wallet ${addressLabel}` : "connect wallet"}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <span
              className={`inshell-topbar__wallet-label${
                addressLabel ? " inshell-topbar__address" : ""
              }`}
            >
              {addressLabel ? (
                addressLabel
              ) : (
                <>
                  <span>connect wallet</span>
                  {disconnectedWalletNote ? (
                    <span className="inshell-topbar__wallet-note">
                      {disconnectedWalletNote}
                    </span>
                  ) : null}
                </>
              )}
            </span>
            <span className={`inshell-topbar__dot inshell-topbar__dot--${dotState}`} aria-hidden="true" />
          </button>
          {open ? (
            isConnected ? (
              <InshellWalletModal expectedChainId={expectedChainId} />
            ) : connectors.length ? (
              <>
                <InshellWalletPicker
                  connectors={connectors}
                  onConnect={(connector) => void connectWith(connector)}
                />
                {notice ? <p className="inshell-wallet-picker__notice">{notice}</p> : null}
              </>
            ) : (
              <InshellWalletModal expectedChainId={expectedChainId} />
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}

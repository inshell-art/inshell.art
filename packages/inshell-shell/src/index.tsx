/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet, type WalletConnector } from "@inshell/wallet";
import { resolveInshellLinks } from "./links";
import {
  INSHELL_OPEN_WALLET_EVENT,
  announceInshellWalletVisibility,
} from "./wallet-events";

export { isLocalRuntimeHost, resolveInshellLinks } from "./links";
export {
  INSHELL_OPEN_WALLET_EVENT,
  INSHELL_WALLET_VISIBILITY_EVENT,
  openInshellWallet,
  type InshellWalletVisibilityDetail,
} from "./wallet-events";

export type InshellSurface = "home" | "path" | "thought" | "works";

export type InshellTopBarProps = {
  active?: InshellSurface;
  expectedChainId?: number;
  compact?: boolean;
  disconnectedWalletNote?: string;
  onWalletRefresh?: () => void | Promise<void>;
};

export type InshellWalletModalProps = {
  expectedChainId?: number;
  onRefresh?: () => void | Promise<void>;
};

export type InshellWalletPickerProps = {
  connectors: WalletConnector[];
  onConnect: (connector: WalletConnector) => void | Promise<void>;
  pendingConnectorId?: string | null;
  status?: string;
};

type WalletConnectResult = {
  address: string | null;
  chainId: number | null;
};

type WalletConnectAsync = (args?: {
  connector?: WalletConnector;
}) => Promise<WalletConnectResult>;

const WALLET_ATTENTION_DELAY_MS = 5_000;
const WALLET_STALLED_DELAY_MS = 30_000;

function shortAddress(address?: string | null) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function networkLabel(chain?: { id?: number; name?: string; network?: string }) {
  if (chain?.id === 1337 || chain?.id === 31337 || chain?.id === 31338) {
    return "Local Anvil";
  }
  const raw = chain?.name?.trim() || chain?.network?.trim() || "";
  if (!raw) return "unknown";
  return raw.replace(/\btestnet\b/gi, "").replace(/\s+/g, " ").trim() || "unknown";
}

function walletConnectionNotice(error: unknown) {
  const code = Number((error as any)?.code);
  const message = String((error as any)?.message ?? "").trim();
  if (
    code === -32002 ||
    /already pending|already processing|previous (?:request|transaction)/i.test(
      message
    )
  ) {
    return "a wallet request is already open. open your wallet and approve or cancel it.";
  }
  if (code === 4001 || /user rejected|user denied|request rejected/i.test(message)) {
    return "wallet connection canceled. choose a wallet to try again.";
  }
  return message || "wallet connection failed.";
}

function walletPendingNotice(
  connector: WalletConnector | undefined,
  stalled: boolean
) {
  const connectorName = connector?.name ?? "wallet";
  const isWalletConnect =
    connector?.kind === "walletconnect" ||
    connectorName.toLowerCase().includes("walletconnect");
  if (isWalletConnect) {
    return stalled
      ? "still waiting for WalletConnect. finish or cancel the connection there. if no request appears, reload this page."
      : "finish or cancel the connection in WalletConnect.";
  }
  return stalled
    ? `still waiting for ${connectorName}. approve or cancel the request there. if no request appears, restart ${connectorName} and reload this page.`
    : `open ${connectorName} from your browser toolbar, then approve or cancel the connection.`;
}

function useWalletConnectionAttempt(connectAsync: WalletConnectAsync) {
  const [notice, setNotice] = useState("");
  const [pendingConnectorId, setPendingConnectorId] = useState<string | null>(
    null
  );
  const connectAttemptRef = useRef<Promise<void> | null>(null);
  const attemptNumberRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearGuidanceTimers = () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  };

  useEffect(() => clearGuidanceTimers, []);

  const connectWith = (connector?: WalletConnector) => {
    if (connectAttemptRef.current) return connectAttemptRef.current;
    clearGuidanceTimers();
    const attemptNumber = ++attemptNumberRef.current;
    const connectorId = connector?.id ?? "wallet";
    const connectorName = connector?.name ?? "wallet";
    setPendingConnectorId(connectorId);
    setNotice(`opening ${connectorName}...`);
    timersRef.current = [
      window.setTimeout(() => {
        if (attemptNumberRef.current !== attemptNumber) return;
        setNotice(walletPendingNotice(connector, false));
      }, WALLET_ATTENTION_DELAY_MS),
      window.setTimeout(() => {
        if (attemptNumberRef.current !== attemptNumber) return;
        setNotice(walletPendingNotice(connector, true));
      }, WALLET_STALLED_DELAY_MS),
    ];
    const attempt = (async () => {
      try {
        await connectAsync(connector ? { connector } : undefined);
        if (attemptNumberRef.current === attemptNumber) {
          setNotice("wallet connected.");
        }
      } catch (error) {
        if (attemptNumberRef.current === attemptNumber) {
          setNotice(walletConnectionNotice(error));
        }
      } finally {
        if (attemptNumberRef.current === attemptNumber) {
          clearGuidanceTimers();
          setPendingConnectorId(null);
          connectAttemptRef.current = null;
        }
      }
    })();
    connectAttemptRef.current = attempt;
    return attempt;
  };

  return {
    connectWith,
    notice,
    pendingConnectorId,
    setNotice,
  };
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
  pendingConnectorId,
  status,
}: InshellWalletPickerProps) {
  const isPending = Boolean(pendingConnectorId);
  return (
    <div
      className="inshell-wallet-picker"
      role="menu"
      aria-label="Wallet options"
      aria-busy={isPending}
    >
      <div className="inshell-wallet-picker__title">wallet options</div>
      <p className="inshell-wallet-picker__note">
        Connecting shares your address only. No signature or transaction. {" "}
        <a href="/verify#wallet-notes" target="_blank" rel="noopener noreferrer">
          verify ↗
        </a>
      </p>
      {status ? (
        <p
          className="inshell-wallet-picker__status"
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
      ) : null}
      {connectors.map((connector) => (
        <button
          key={connector.id}
          type="button"
          className="inshell-wallet-picker__item"
          role="menuitem"
          disabled={isPending}
          aria-busy={pendingConnectorId === connector.id}
          onClick={() => onConnect(connector)}
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}

export function InshellWalletModal({ expectedChainId, onRefresh }: InshellWalletModalProps) {
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
  const { connectWith, notice, pendingConnectorId, setNotice } =
    useWalletConnectionAttempt(connectAsync);
  const expectedMismatch = Boolean(
    expectedChainId && chainId && chainId !== expectedChainId
  );

  const handleRefresh = async () => {
    setNotice("");
    try {
      await refreshWallet();
      await onRefresh?.();
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
      </dl>
      <p className="inshell-wallet-modal__copy">
        This menu never requests a signature or transaction.
      </p>
      <div className="inshell-wallet-modal__actions">
        {!isConnected ? (
          connectors.length ? (
            connectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                disabled={Boolean(pendingConnectorId)}
                aria-busy={pendingConnectorId === connector.id}
                onClick={() => void connectWith(connector)}
              >
                {connector.name}
              </button>
            ))
          ) : (
            <button
              type="button"
              disabled={Boolean(pendingConnectorId)}
              aria-busy={pendingConnectorId === "wallet"}
              onClick={() => void connectWith()}
            >
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
  onWalletRefresh,
}: InshellTopBarProps) {
  const {
    address,
    chainId,
    connectAsync,
    connectors,
    connectError,
    isConnected,
    isConnecting,
    refreshConnectors,
  } = useWallet();
  const [open, setOpen] = useState(false);
  const { connectWith, notice, pendingConnectorId } =
    useWalletConnectionAttempt(connectAsync);
  const barRef = useRef<HTMLDivElement | null>(null);
  const links = useMemo(() => resolveInshellLinks(), []);
  const expectedMismatch = Boolean(
    expectedChainId && chainId && chainId !== expectedChainId
  );
  const dotState = isConnecting || pendingConnectorId || expectedMismatch
    ? "pending"
    : connectError
    ? "error"
    : isConnected
    ? "on"
    : "off";
  const addressLabel = shortAddress(address);

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
    const openWallet = () => {
      setOpen(true);
      if (!isConnected) void refreshConnectors();
    };
    window.addEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    return () => {
      window.removeEventListener(INSHELL_OPEN_WALLET_EVENT, openWallet);
    };
  }, [isConnected, refreshConnectors]);

  useEffect(() => {
    announceInshellWalletVisibility(open);
    return () => {
      if (open) announceInshellWalletVisibility(false);
    };
  }, [open]);

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
            onClick={() => {
              const nextOpen = !open;
              setOpen(nextOpen);
              if (nextOpen && !isConnected) void refreshConnectors();
            }}
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
              <InshellWalletModal expectedChainId={expectedChainId} onRefresh={onWalletRefresh} />
            ) : connectors.length ? (
              <>
                <InshellWalletPicker
                  connectors={connectors}
                  pendingConnectorId={pendingConnectorId}
                  status={notice}
                  onConnect={(connector) => void connectWith(connector)}
                />
              </>
            ) : (
              <InshellWalletModal expectedChainId={expectedChainId} onRefresh={onWalletRefresh} />
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}

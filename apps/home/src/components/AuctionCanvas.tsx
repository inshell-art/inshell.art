import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decodeFunctionData, getAddress, type Hex } from "viem";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { ProviderInterface } from "@inshell/ethereum";
import {
  callContract,
  encodeExecuteData,
  getBalance,
  getBlock,
  getChainId,
  getCode,
  getDefaultProvider,
  hashBytecode,
  pulseAuctionAbi,
  supportsRpcRequest,
  ZERO_ADDRESS,
} from "@inshell/ethereum";
import {
  scaleIntegerString,
  toFixed,
  readU256,
  toU256Num,
  type U256Num,
} from "@inshell/utils";
import type { AuctionSnapshot } from "@/types/types";
import type { NormalizedBid } from "@/services/auction/bidsService";
import { clearPathTokenInventoryCache } from "@/services/pathTokens";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import {
  getProtocolRelease,
  getProtocolReleaseChainId,
  getProtocolReleaseCodeHash,
  getProtocolReleaseDeployBlock,
  isEvmAddress,
  maybeResolveAddress,
} from "@inshell/contracts";
import { SURFACE_TERMINOLOGY, resolveWalletChainRpcUrls } from "@inshell/shared";
import HeaderWalletCTA from "@/components/HeaderWalletCTA";
import { useWallet } from "@inshell/wallet";
import {
  buildReportBugLink,
  getPublicNetworkNotice,
  isSepoliaInviteMode,
  shouldShowDebugPanel,
  shouldShowReportBug,
} from "@/config/publicLaunch";
/* global Element, SVGSVGElement, SVGElement, HTMLDivElement, MouseEvent, PointerEvent, URL, URLSearchParams */

type Props = {
  address?: string;
  provider?: ProviderInterface;
  refreshMs?: number;
  decimals?: number;
  maxBids?: number;
};

type TxState = "idle" | "awaiting_signature" | "submitted" | "confirmed" | "failed";
type TxPhase = "approve" | "bid";
type NoticeKind = "info" | "warn" | "error";
type Notice = {
  kind: NoticeKind;
  text: string;
  delayMs?: number;
  reportState?: string;
  reportError?: string;
};

function walletErrorCode(error: unknown): number | null {
  const rawCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : null;
  if (rawCode === null || rawCode === undefined || rawCode === "") return null;
  const code = typeof rawCode === "number" ? rawCode : Number(rawCode);
  return Number.isFinite(code) ? code : null;
}

function walletErrorMessage(error: unknown): string {
  return String((error as any)?.message ?? error ?? "");
}

function isWalletCancellationError(error: unknown): boolean {
  const code = walletErrorCode(error);
  if (code === 4001) return true;
  const message = walletErrorMessage(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("user_refused") ||
    lower.includes("user rejected") ||
    lower.includes("user reject") ||
    lower.includes("request rejected") ||
    lower.includes("request denied") ||
    lower.includes("denied by user") ||
    /\b4001\b/.test(lower)
  );
}

function isWalletCancellationMessage(message: string): boolean {
  return isWalletCancellationError(new Error(message));
}

function isWalletReadOnlyRpcMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("eth_sendrawtransaction") || lower.includes("rpc method is not allowed");
}

function isWalletRpcBusyMessage(message: string): boolean {
  return /rpc endpoint returned too many errors|too many errors|too many requests|rate limit|429|502|503|504/i.test(
    message
  );
}

type PreflightResult = {
  ask: U256Num;
  balance: U256Num;
  allowance: U256Num;
};
type MintReviewQuote = {
  ask: U256Num;
  symbol: string;
  priceLabel: string;
  txValueLabel: string;
  maxPriceLabel: string;
  nativePayment: boolean;
  requiresApproval: boolean;
};

type PulseBidIntentCheck = {
  contractAddress: string;
  expectedContractAddress: string;
  calldata: readonly unknown[];
  maxPrice: U256Num;
  value?: bigint;
  nativePayment: boolean;
  chainId: bigint | null;
  targetChainId: bigint | null;
};

type PathMintIntent = {
  from: "thought";
  returnTo: string;
};

function useDesktopOnly(minWidth = 768) {
  const [isDesktop, setIsDesktop] = useState(
    typeof window === "undefined" ? true : window.innerWidth >= minWidth
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= minWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minWidth]);
  return isDesktop;
}

function normalizeReturnTo(raw: string | null): string | null {
  if (!raw || typeof window === "undefined") return null;
  try {
    const url = new URL(raw, window.location.href);
    const protocolOk = url.protocol === "http:" || url.protocol === "https:";
    const host = url.hostname.toLowerCase();
    const hostOk =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "inshell.art" ||
      host.endsWith(".inshell.art");
    return protocolOk && hostOk ? url.toString() : null;
  } catch {
    return null;
  }
}

function readPathMintIntent(): PathMintIntent | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("intent") !== "mint-path") return null;
  if (params.get("from") !== "thought") return null;
  const returnTo = normalizeReturnTo(params.get("returnTo"));
  return returnTo ? { from: "thought", returnTo } : null;
}

function toNumberSafe(v: string | number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function upperBound(sorted: number[], x: number): number {
  // First index i where sorted[i] > x.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function normalizeComparableAddress(value: string): string {
  try {
    return getAddress(value).toLowerCase();
  } catch {
    return String(value ?? "").trim().toLowerCase();
  }
}

function resolveExplorerAddressUrl(address: string): string {
  const base = resolveExplorerBase().replace(/\/$/, "");
  return `${base}/address/${address}`;
}

function assertPulseBidIntent(intent: PulseBidIntentCheck): Hex {
  const data = encodeExecuteData("bid", intent.calldata);
  const decoded = decodeFunctionData({
    abi: pulseAuctionAbi,
    data,
  });
  if (decoded.functionName !== "bid") {
    throw new Error("Pulse bid validation failed: decoded call is not bid.");
  }
  const decodedMaxPrice = BigInt(decoded.args[0] as bigint);
  if (decodedMaxPrice !== intent.maxPrice.value) {
    throw new Error("Pulse bid validation failed: maxPrice mismatch.");
  }
  const txTo = normalizeComparableAddress(intent.contractAddress);
  const expectedTo = normalizeComparableAddress(intent.expectedContractAddress);
  if (txTo !== expectedTo) {
    throw new Error("Pulse bid validation failed: contract mismatch.");
  }
  const expectedValue = intent.nativePayment ? intent.maxPrice.value : 0n;
  const txValue = intent.value ?? 0n;
  if (txValue !== expectedValue) {
    throw new Error("Pulse bid validation failed: ETH value mismatch.");
  }
  if (
    intent.chainId !== null &&
    intent.targetChainId !== null &&
    intent.chainId !== intent.targetChainId
  ) {
    throw new Error("Pulse bid validation failed: chain mismatch.");
  }
  return data;
}

function shortHash(hash?: string) {
  if (!hash) return "—";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function walletConnectorRank(connector: any): number {
  const kind = String(connector?.kind ?? "");
  const name = String(connector?.name ?? "").toLowerCase();
  const rdns = String(connector?.detail?.info?.rdns ?? "").toLowerCase();
  if (kind === "walletconnect") return 200;
  if (rdns.includes("metamask") || name.includes("metamask")) return 0;
  if (rdns.includes("rabby") || name.includes("rabby")) return 10;
  if (rdns.includes("coinbase") || name.includes("coinbase")) return 20;
  if (rdns === "window.ethereum" || name === "injected") return 100;
  return 50;
}

function isUnsupportedWalletConnector(connector: any): boolean {
  const name = String(connector?.name ?? "").toLowerCase();
  const rdns = String(connector?.detail?.info?.rdns ?? "").toLowerCase();
  return name.includes("temple") || rdns.includes("temple");
}

function isVisibleWalletConnector(connector: any): boolean {
  const name = String(connector?.name ?? "").toLowerCase();
  const rdns = String(connector?.detail?.info?.rdns ?? "").toLowerCase();
  return (
    rdns.includes("metamask") ||
    name.includes("metamask") ||
    rdns.includes("rabby") ||
    name.includes("rabby")
  );
}

function isConnectorAvailable(connector: any): boolean {
  if (isUnsupportedWalletConnector(connector)) return false;
  try {
    if (typeof connector?.available === "function") {
      return Boolean(connector.available());
    }
  } catch {
    return false;
  }
  return true;
}

function formatTinyDecimalString(
  fixed: string,
  significantDigits = 4
): string {
  const raw = String(fixed ?? "").trim();
  if (!raw) return "—";

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intRaw, fracRaw = ""] = unsigned.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "") || "0";

  if (!fracRaw) return negative ? `-${intPart}` : intPart;

  const firstNonZero = fracRaw.search(/[1-9]/);
  if (firstNonZero < 0) return "0";

  const keepTo = Math.min(fracRaw.length, firstNonZero + significantDigits);
  const frac = fracRaw.slice(0, keepTo).replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

function formatTokenAmount(u: { dec: string }, decimals: number): string {
  const raw = String(u?.dec ?? "").trim();
  if (!raw) return "—";
  const fixed = /^[0-9]+$/.test(raw)
    ? scaleIntegerString(raw, decimals)
    : raw;
  if (!fixed.includes(".")) return fixed;
  const [intPart, fracPart] = fixed.split(".");
  if ((intPart.replace(/^0+(?=\d)/, "") || "0") === "0") {
    return formatTinyDecimalString(fixed);
  }
  const trimmed = fracPart.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}

function formatHumanTokenAmount(value: number, fractionDigits = 4): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  const fixed = abs < 0.01 ? value.toFixed(18) : value.toFixed(fractionDigits);
  if (abs < 0.01 && Number(fixed) !== 0) {
    return formatTinyDecimalString(fixed, fractionDigits);
  }
  return fixed.replace(/\.?0+$/, "");
}

const BASE_HALF_LIVES = 10;
const EXTREME_HISTORY_TAIL_THRESHOLD = BASE_HALF_LIVES * 100;
const LIVE_HISTORY_CONTEXT_MAX_BIDS = 24;
const SPARSE_LIVE_ACTIVE_WINDOW = BASE_HALF_LIVES * 4;
const SPARSE_LIVE_ACTIVE_CONTEXT = BASE_HALF_LIVES * 0.5;
const PLOT_EDGE_PAD = 2.4;
const PLOT_LEFT_PAD = PLOT_EDGE_PAD;
const PLOT_RIGHT_PAD = PLOT_EDGE_PAD;
const PLOT_X_SPAN = 100 - PLOT_LEFT_PAD - PLOT_RIGHT_PAD;

function halfLifeWindowEnd(uEnd: number): number {
  if (!Number.isFinite(uEnd) || uEnd <= 0) return BASE_HALF_LIVES;
  return Math.max(
    BASE_HALF_LIVES,
    Math.ceil(uEnd / BASE_HALF_LIVES) * BASE_HALF_LIVES
  );
}

const FIXTURE_ASK_WEI = "1000000000000000000";
const FIXTURE_BALANCE_WEI = "1000000000000000000000000";
const FIXTURE_ARG_K_WEI = 100_000_000_000_000_000_000n; // 1e20
const FIXTURE_ARG_PTS_WEI_PER_SEC = 100_000_000_000_000n; // 1e14
const FIXTURE_ARG_GENESIS_PRICE_WEI = 1_000_000_000_000_000_000n; // 1e18
const FIXTURE_ARG_GENESIS_FLOOR_WEI = 100_000_000_000_000_000n; // 1e17

function rescaleWeiToDecimals(valueWei: bigint, decimals: number): bigint {
  if (decimals === 18) return valueWei;
  if (decimals > 18) {
    return valueWei * 10n ** BigInt(decimals - 18);
  }
  return valueWei / 10n ** BigInt(18 - decimals);
}

function scaledBigIntToHuman(valueScaled: bigint, decimals: number): number {
  return Number(valueScaled) / Math.pow(10, decimals);
}

function humanToScaledBigInt(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  const precision = Math.max(0, Math.min(decimals, 18));
  const fixed = value.toFixed(precision);
  const [intRaw, fracRaw = ""] = fixed.split(".");
  const intPart = intRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = fracRaw.padEnd(decimals, "0").slice(0, decimals);
  const digits = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, "") || "0";
  return BigInt(digits);
}

function humanToU256Num(value: number, decimals: number): U256Num {
  return toU256Num({
    low: humanToScaledBigInt(value, decimals).toString(),
    high: "0",
  });
}

async function readLatestChainTimeSec(
  provider?: ProviderInterface
): Promise<number | null> {
  try {
    const readProvider = provider ?? getDefaultProvider();
    const block = await getBlock(readProvider, "latest");
    const ts = Number(block?.timestamp);
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

async function readCurrentAskFromContract(
  provider: ProviderInterface,
  auctionAddress: string
): Promise<U256Num> {
  const priceRes: any = await callContract(provider, {
    contractAddress: auctionAddress,
    entrypoint: "get_current_price",
    calldata: [],
  });
  return toU256Num(readU256(priceRes?.price ?? priceRes?.[0] ?? priceRes));
}

async function syncDevnetTimeToBrowser(
  provider: ProviderInterface,
  targetTimeSec: number
): Promise<boolean> {
  if (!supportsRpcRequest(provider)) return false;
  const target = Math.max(0, Math.floor(targetTimeSec));
  const chainNow = await readLatestChainTimeSec(provider);
  if (chainNow != null && target <= Math.floor(chainNow) + 1) return false;

  const methods = ["evm_setNextBlockTimestamp", "anvil_setNextBlockTimestamp"];
  for (const method of methods) {
    try {
      await provider.request?.({ method, params: [target] });
      await provider.request?.({ method: "evm_mine", params: [] });
      return true;
    } catch {
      // Try the next local-node dialect. Public networks never enter this path.
    }
  }
  return false;
}

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function isTestRuntime(): boolean {
  return getEnvValue("NODE_ENV") === "test";
}

function resolveExplorerBase(): string {
  const base = getEnvValue("VITE_EXPLORER_BASE_URL");
  if (typeof base === "string" && base.trim()) return base.trim();
  return "https://sepolia.etherscan.io";
}

function resolveExplorerTxUrl(hash: string): string {
  const base = resolveExplorerBase().replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

function findInjectedWallet(): { request?: (...args: any[]) => Promise<any> } | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, any>;
  const priority = ["ethereum"];
  for (const key of priority) {
    const wallet = w[key];
    if (wallet?.request) return wallet;
  }
  for (const key of Object.keys(w)) {
    if (!key.startsWith("ethereum")) continue;
    const wallet = w[key];
    if (wallet?.request) return wallet;
  }
  return null;
}

function resolveWalletRequestProvider(
  provider?: { request?: (...args: any[]) => Promise<any> } | null
): { request?: (...args: any[]) => Promise<any> } | null {
  if (provider?.request) return provider;
  return findInjectedWallet();
}

function resolveChainLabel(chainIdHex: string): string {
  const normalized = chainIdHex.toLowerCase();
  if (normalized === ETH_SEPOLIA_CHAIN_ID_HEX) return "Sepolia";
  if (normalized === "0x7a6a") return "PATH Local";
  const network = getEnvValue("VITE_NETWORK");
  if (typeof network === "string" && network === "devnet") return "PATH Local";
  const parsed = parseChainId(chainIdHex);
  return parsed === null ? "target network" : `chain ${parsed.toString()}`;
}

function resolveAddChainParams(chainIdHex: string) {
  const normalized = chainIdHex.toLowerCase();
  const rpcUrl = getEnvValue("VITE_ETH_RPC");
  const walletRpcUrl = getEnvValue("VITE_WALLET_CHAIN_RPC_URL");
  const rpcUrls = resolveWalletChainRpcUrls({
    chainId: parseChainId(normalized),
    readRpcUrl: typeof rpcUrl === "string" ? rpcUrl : "",
    walletRpcUrl: typeof walletRpcUrl === "string" ? walletRpcUrl : "",
    currentOrigin: typeof window === "undefined" ? "" : window.location.origin,
    localFallbackRpcUrl: "http://127.0.0.1:8546",
  });

  if (normalized === ETH_SEPOLIA_CHAIN_ID_HEX) {
    const explorer = resolveExplorerBase();
    return {
      chainId: ETH_SEPOLIA_CHAIN_ID_HEX,
      chainName: "Sepolia",
      nativeCurrency: {
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls,
      blockExplorerUrls:
        typeof explorer === "string" && explorer.trim() ? [explorer.trim()] : [],
    };
  }

  const network = getEnvValue("VITE_NETWORK");
  if (typeof network !== "string" || network !== "devnet") return null;

  return {
    chainId: normalized,
    chainName: resolveChainLabel(normalized),
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: rpcUrls.length ? rpcUrls : ["http://127.0.0.1:8546"],
  };
}

async function requestChainSwitch(
  chainIdHex: string,
  provider?: { request?: (...args: any[]) => Promise<any> } | null
): Promise<boolean> {
  const wallet = resolveWalletRequestProvider(provider);
  if (!wallet?.request) return false;
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (err) {
    const code = Number((err as any)?.code);
    const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
    const shouldAddChain =
      code === 4902 ||
      msg.includes("unknown chain") ||
      msg.includes("unrecognized chain") ||
      msg.includes("chain has not been added") ||
      msg.includes("does not exist");
    if (!shouldAddChain) return false;

    const addParams = resolveAddChainParams(chainIdHex);
    if (!addParams) return false;
    try {
      await wallet.request({
        method: "wallet_addEthereumChain",
        params: [addParams],
      });
      await wallet.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

async function refreshWalletChainRpc(
  chainIdHex: string,
  provider?: { request?: (...args: any[]) => Promise<any> } | null
): Promise<boolean> {
  const wallet = resolveWalletRequestProvider(provider);
  const addParams = resolveAddChainParams(chainIdHex);
  if (!wallet?.request || !addParams || !addParams.rpcUrls.length) return false;
  try {
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [addParams],
    });
    return true;
  } catch {
    return false;
  }
}

const ETH_SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

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

function resolveTargetChainIdHex(): string {
  if (isSepoliaInviteMode()) return ETH_SEPOLIA_CHAIN_ID_HEX;
  const raw = getEnvValue("VITE_EXPECTED_CHAIN_ID");
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const releaseChainId = getProtocolReleaseChainId();
  if (typeof releaseChainId === "number") {
    return `0x${releaseChainId.toString(16)}`;
  }
  return ETH_SEPOLIA_CHAIN_ID_HEX;
}

function parseBlockNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    const parsed = raw.startsWith("0x")
      ? parseInt(raw, 16)
      : parseInt(raw, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return undefined;
}

function resolveBidsFromBlock(): number | undefined {
  const raw = getEnvValue("VITE_PULSE_AUCTION_DEPLOY_BLOCK");
  const parsed = parseBlockNumber(raw);
  if (typeof parsed === "number") return parsed;
  const releaseBlock = getProtocolReleaseDeployBlock("pulse_auction");
  if (typeof releaseBlock === "number") return releaseBlock;
  const network = getEnvValue("VITE_NETWORK");
  if (typeof network === "string" && network === "devnet") return 0;
  return undefined;
}

function useProtocolReleaseGuard(params: {
  address?: string;
  provider?: ProviderInterface;
  enabled: boolean;
}) {
  const { address, provider, enabled } = params;
  const release = useMemo(() => getProtocolRelease(), []);
  const releaseChainId = release?.chain_id;
  const releaseId = release?.deploy_run_id;
  const releaseCodeHash = getProtocolReleaseCodeHash("pulse_auction");
  const [state, setState] = useState<{
    loading: boolean;
    error: Error | null;
    checked: boolean;
  }>({ loading: false, error: null, checked: false });

  useEffect(() => {
    if (!enabled || !address) {
      setState({ loading: false, error: null, checked: false });
      return;
    }
    const prov = provider ?? (getDefaultProvider() as ProviderInterface);
    if (!supportsRpcRequest(prov)) {
      setState({ loading: false, error: null, checked: true });
      return;
    }

    let cancelled = false;
    setState({ loading: true, error: null, checked: false });

    (async () => {
      try {
        if (typeof releaseChainId === "number") {
          const actualChainId = await getChainId(prov);
          if (actualChainId !== BigInt(releaseChainId)) {
            throw new Error(
              `PATH release chain mismatch: expected ${releaseChainId}, RPC returned ${actualChainId.toString()}. Check VITE_ETH_RPC and VITE_NETWORK.`
            );
          }
        }

        const code = await getCode(prov, address);
        if (!code || code === "0x") {
          throw new Error(
            `No PulseAuction code at ${address} on the current RPC. Check VITE_ETH_RPC, VITE_NETWORK, and the imported PATH FE release.`
          );
        }

        if (releaseCodeHash) {
          const actualHash = hashBytecode(code);
          if (
            actualHash &&
            actualHash.toLowerCase() !== releaseCodeHash.toLowerCase()
          ) {
            throw new Error(
              `PATH release code hash mismatch for PulseAuction. Expected ${releaseCodeHash}, got ${actualHash}.`
            );
          }
        }

        if (!cancelled) setState({ loading: false, error: null, checked: true });
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
            checked: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, enabled, provider, releaseChainId, releaseCodeHash, releaseId]);

  return {
    loading: state.loading,
    error: state.error,
    ready: !enabled || (!state.loading && state.checked && !state.error),
  };
}

function resolvePaymentToken(): string | undefined {
  const alias = getEnvValue("VITE_PAYTOKEN");
  if (typeof alias === "string" && isEvmAddress(alias)) return alias.trim();
  return maybeResolveAddress("payment_token");
}

function resolvePaymentSymbol(paymentToken?: string): string {
  const raw =
    getEnvValue("VITE_PAYTOKEN_SYMBOL") ??
    getEnvValue("VITE_PAYMENT_TOKEN_SYMBOL");
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (paymentToken) return "ETH";
  return "ETH";
}

function isNativePaymentToken(paymentToken?: string): boolean {
  return typeof paymentToken === "string" && paymentToken.trim().toLowerCase() === ZERO_ADDRESS;
}

function isTransientRpcError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /insufficient_resources|empty response|invalid json|rpc upstream|failed to fetch|network error|load failed|timeout|temporar|rate limit|too many errors|too many requests|429|502|503|504/i.test(
    msg
  );
}

const isTestEnv =
  typeof globalThis !== "undefined" &&
  typeof globalThis.process !== "undefined" &&
  globalThis.process?.env?.NODE_ENV === "test";
const DELAY_MS = 500;
const ERROR_DELAY_MS = 700;
const STARTUP_ERROR_DELAY_MS = 2500;
const FALLBACK_DELAY_MS = 1200;
const DEBUG_ASK_LABEL = "25.2577";
const DEBUG_BALANCE_LABEL = "5.8346";
const DEBUG_TX_HASH = "0xdeadbeefcafebabe";

type DotPoint = {
  x: number;
  y: number;
  key: string;
  screenX?: number;
  screenY?: number;
  bidder?: string;
  amount: string;
  amountDec?: string;
  amountRaw?: string;
  txHash?: string;
  atMs: number;
  block?: number;
  epoch?: number;
  tokenId?: number;
  durationSec?: number;
  ptsHuman?: number;
  lastSec?: number;
  anchor?: number;
  kHuman?: number;
  floorHuman?: number;
  premiumHuman?: number;
  metaDtSec?: number;
  beforeNowSec?: number;
  hoverSetSec?: number;
  tHalf?: number;
  uLocal?: number;
  uGlobal?: number;
  dtPrevSec?: number;
  dtNextSec?: number | null;
  bLastHuman?: number;
  bCurrentHuman?: number;
  floorMoveCurrentHuman?: number;
  liveNow?: boolean;
};

type LinkedSegment = {
  idx: number; // render order index
  bid: NormalizedBid | null; // sale that closes this segment; null for active segment
  epoch: number;
  uStart: number; // global half-life axis
  uLen: number; // local segment length in half-lives (or window for last)
  startSec: number;
  endSec: number;
  floor: number; // b
  premium: number; // D (initial time premium)
  ask: number; // floor + premium
  kHuman: number;
  ptsHuman: number;
  tHalf: number;
  anchor: number; // a = tStart - T_half
  dtPrevSec: number; // used to compute premium (dt to previous sale)
  dtNextSec: number | null; // duration until next sale (null for last)
  uMaxWindow?: number; // only set for last segment
  metaU?: number; // only set for last segment
  metaDtSec?: number; // only set for last segment
};

type LinkedCurve = {
  segments: LinkedSegment[];
  uEnd: number; // global end (last segment end)
  nowU: number | null; // global now marker
  nowPrice: number | null;
  minY: number;
  maxY: number;
  reason: string | null;
};

type LinkedStatic = {
  segments: LinkedSegment[];
  minY: number;
  maxY: number;
  reason: string | null;
};

const QUOTED_PRICE_TIME_TOLERANCE_SEC = 30;

function quotedUForLiveSegment(
  seg: Pick<LinkedSegment, "floor" | "premium" | "startSec" | "tHalf">,
  quotedPrice: number,
  liveNowSec: number
): number | null {
  const quotedU = uFromPrice(seg.floor, seg.premium, quotedPrice);
  if (quotedU == null) return null;
  const impliedSec = seg.startSec + quotedU * seg.tHalf;
  const latestExpectedSec = Math.max(liveNowSec, seg.startSec);
  return impliedSec <= latestExpectedSec + QUOTED_PRICE_TIME_TOLERANCE_SEC
    ? quotedU
    : null;
}

type Viewport = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type AskMark = {
  key: string;
  kind: "ask" | "opening-floor";
  epoch: number;
  segIdx: number;
  u: number;
  price: number;
};

type PulseFixtureState = "before_open" | "open_not_active";

type PulseFixture = {
  k: number;
  state?: PulseFixtureState;
  epoch: {
    epochIndex: number;
    floor: number;
    D: number | null;
    tStart: number;
    tNow: number;
  };
  history?: {
    // Optional explicit serial history (oldest -> latest).
    floors?: number[];
    // Gap between sale i and sale i+1, in seconds.
    gapsSec?: number[];
    // Gap between auction open and sale #1, in seconds.
    openGapSec?: number;
  };
};

const DEFAULT_PULSE_FIXTURE_PRESET = "random";
const FALLBACK_PULSE_FIXTURE_PRESET = "normal";
const PULSE_FIXTURE_PRESETS: Record<string, PulseFixture> = {
  normal: {
    k: 1_000_000,
    epoch: {
      epochIndex: 10,
      floor: 15_000,
      D: 900,
      tStart: 1_700_000_000,
      tNow: 1_700_002_500,
    },
  },
  tiny: {
    k: 1_000_000,
    epoch: {
      epochIndex: 7,
      floor: 20_000,
      D: 100,
      tStart: 1_700_000_000,
      tNow: 1_700_005_000,
    },
  },
  huge: {
    k: 1_000_000,
    epoch: {
      epochIndex: 23,
      floor: 332_309.5,
      D: 70_000,
      tStart: 1_700_000_000,
      tNow: 1_700_007_200,
    },
  },
  stale: {
    k: 1_000_000,
    epoch: {
      epochIndex: 15,
      floor: 50_000,
      D: 500,
      tStart: 1_700_000_000,
      tNow: 1_700_010_000,
    },
  },
  epoch2: {
    k: 1_000_000,
    epoch: {
      epochIndex: 2,
      floor: 1_000,
      D: null,
      tStart: 1_700_000_000,
      tNow: 1_700_000_600,
    },
  },
  mixeda: {
    k: 1_000_000,
    epoch: {
      epochIndex: 8,
      floor: 31_000,
      D: 300,
      tStart: 1_700_000_000,
      tNow: 1_700_001_800,
    },
    history: {
      floors: [26_386, 26_387, 26_416, 27_281, 27_322, 29_185, 29_269, 31_000],
      gapsSec: [30, 900, 45, 2_400, 120, 3_600, 300],
    },
  },
  mixedb: {
    k: 1_000_000,
    epoch: {
      epochIndex: 10,
      floor: 44_000,
      D: 120,
      tStart: 1_700_000_000,
      tNow: 1_700_000_960,
    },
    history: {
      floors: [
        40_806, 40_807, 40_819, 40_837, 41_255, 41_270, 43_423, 43_433, 43_446,
        44_000,
      ],
      gapsSec: [12, 18, 420, 16, 2_200, 10, 14, 600, 140],
    },
  },
  mixedc: {
    k: 1_000_000,
    epoch: {
      epochIndex: 9,
      floor: 56_000,
      D: 2_000,
      tStart: 1_700_000_000,
      tNow: 1_700_004_800,
    },
    history: {
      floors: [52_882, 52_883, 53_078, 53_943, 54_098, 55_000, 55_154, 55_876, 56_000],
      gapsSec: [300, 1_800, 600, 4_800, 900, 5_400, 1_200, 7_200],
    },
  },
};

const PULSE_FIXTURE_PRESET_ALIASES: Record<string, string> = {
  rand: "random",
  rnd: "random",
  "tiny-pump": "tiny",
  tiny_pump: "tiny",
  "huge-pump": "huge",
  huge_pump: "huge",
  epoch_2: "epoch2",
  "before-open": "before_open",
  beforeopen: "before_open",
  "pre-open": "before_open",
  pre_open: "before_open",
  preopen: "before_open",
  "after-open": "open_not_active",
  afteropen: "open_not_active",
  "open-no-mint": "open_not_active",
  open_no_mint: "open_not_active",
  "open-not-active": "open_not_active",
  opennotactive: "open_not_active",
  "not-active": "open_not_active",
  not_active: "open_not_active",
  "mixed-a": "mixeda",
  mixed_a: "mixeda",
  "mixed-b": "mixedb",
  mixed_b: "mixedb",
  "mixed-c": "mixedc",
  mixed_c: "mixedc",
};
const RANDOM_FIXTURE_MIN_EPOCHS = 1;
const RANDOM_FIXTURE_MAX_EPOCHS = 100;
const BEFORE_OPEN_FIXTURE_DELAY_SEC = 10 * 60;
const BEFORE_OPEN_FIXTURE_OPEN_GAP_SEC = 10 * 60;
const OPEN_NOT_ACTIVE_FIXTURE_ELAPSED_SEC = 5 * 60;
const OPEN_NOT_ACTIVE_FIXTURE_OPEN_GAP_SEC = 10 * 60;

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(randomFloat(lo, hi + 1));
}

function clampRandomEpochCount(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.max(
    RANDOM_FIXTURE_MIN_EPOCHS,
    Math.min(RANDOM_FIXTURE_MAX_EPOCHS, Math.round(raw))
  );
}

function parseRandomEpochCount(raw: unknown): number | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return clampRandomEpochCount(parsed);
}

function readRandomEpochCountOverride(): number | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search ?? "");
  for (const key of ["sales", "epochs", "n"]) {
    const parsed = parseRandomEpochCount(params.get(key));
    if (parsed != null) return parsed;
  }
  return (
    parseRandomEpochCount(getEnvValue("VITE_PULSE_FIXTURE_SALES")) ??
    parseRandomEpochCount(getEnvValue("VITE_PULSE_FIXTURE_EPOCHS"))
  );
}

function premiumAtU(premium: number, uLocal: number): number {
  const u = Math.max(0, Number.isFinite(uLocal) ? uLocal : 0);
  if (!Number.isFinite(premium) || premium <= 0) return 0;
  return premium / Math.max(u + 1, 1e-9);
}

function priceAtU(floor: number, premium: number, uLocal: number): number {
  return floor + premiumAtU(premium, uLocal);
}

function uFromPrice(floor: number, premium: number, price: number): number | null {
  if (!Number.isFinite(floor) || !Number.isFinite(premium) || !Number.isFinite(price)) {
    return null;
  }
  const aboveFloor = price - floor;
  if (premium <= 0 || aboveFloor <= 0) return null;
  const u = premium / aboveFloor - 1;
  return Number.isFinite(u) ? Math.max(0, u) : null;
}

function positiveDenominator(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : Number.MIN_VALUE;
}

function getVisibleYExtents(
  linked: LinkedCurve,
  xMin: number,
  xMax: number
): { minY: number; maxY: number } {
  const eps = 1e-9;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const includeY = (value: number) => {
    if (!Number.isFinite(value)) return;
    minY = Math.min(minY, value);
    maxY = Math.max(maxY, value);
  };

  for (const seg of linked.segments) {
    const segStart = seg.uStart;
    const segEnd = seg.uStart + seg.uLen;
    if (segEnd < xMin - eps || segStart > xMax + eps) continue;

    const overlapStart = clamp(xMin, segStart, segEnd);
    const overlapEnd = clamp(xMax, segStart, segEnd);
    const u0 = Math.max(0, overlapStart - segStart);
    const u1 = Math.max(0, overlapEnd - segStart);
    const y0 = priceAtU(seg.floor, seg.premium, u0);
    const y1 = priceAtU(seg.floor, seg.premium, u1);
    includeY(y0);
    includeY(y1);

    if (segStart >= xMin - eps && segStart <= xMax + eps) {
      includeY(seg.floor);
      includeY(seg.ask);
    }
  }

  if (
    linked.nowU != null &&
    linked.nowPrice != null &&
    Number.isFinite(linked.nowU) &&
    Number.isFinite(linked.nowPrice) &&
    linked.nowU >= xMin - eps &&
    linked.nowU <= xMax + eps
  ) {
    includeY(linked.nowPrice);
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { minY: linked.minY, maxY: linked.maxY };
  }
  return { minY, maxY };
}

function clipULocalRangeToYDomain(
  seg: Pick<LinkedSegment, "floor" | "premium">,
  uStart: number,
  uEnd: number,
  yMin: number,
  yMax: number
): [number, number] | null {
  if (
    !Number.isFinite(seg.floor) ||
    !Number.isFinite(seg.premium) ||
    !Number.isFinite(uStart) ||
    !Number.isFinite(uEnd) ||
    !Number.isFinite(yMin) ||
    !Number.isFinite(yMax)
  ) {
    return null;
  }

  const low = Math.min(yMin, yMax);
  const high = Math.max(yMin, yMax);
  let start = Math.max(0, uStart);
  let end = Math.max(start, uEnd);
  const startPrice = priceAtU(seg.floor, seg.premium, start);
  const endPrice = priceAtU(seg.floor, seg.premium, end);

  if (!Number.isFinite(startPrice) || !Number.isFinite(endPrice)) return null;
  if (endPrice > high || startPrice < low) return null;

  if (startPrice > high) {
    const uAtHigh = uFromPrice(seg.floor, seg.premium, high);
    if (uAtHigh == null || !Number.isFinite(uAtHigh)) return null;
    start = Math.max(start, uAtHigh);
  }

  if (endPrice < low) {
    const uAtLow = uFromPrice(seg.floor, seg.premium, low);
    if (uAtLow == null || !Number.isFinite(uAtLow)) return null;
    end = Math.min(end, uAtLow);
  }

  return end > start + 1e-9 ? [start, end] : null;
}

function oneHalfDropAtU(premium: number, uLocal: number): number {
  const u = Math.max(0, Number.isFinite(uLocal) ? uLocal : 0);
  if (!Number.isFinite(premium) || premium <= 0) return 0;
  return premium / Math.max((u + 1) * (u + 2), 1e-9);
}

function curveFormulaLabel(): string {
  return "ask = k/(t-anchor)+floor";
}

function makeRandomPulseFixture(epochCountOverride?: number | null): PulseFixture {
  // Keep constructor-era baseline fixed; randomize only N and time gaps.
  const FIXED_K = 1e20;
  const FIXED_FLOOR = 0.1;
  const MIN_GAP_SEC = 60;
  const FIRST_SALE_MAX_GAP_SEC = 10 * 60;
  const MAX_GAP_SEC = 86_400; // 1 day

  const nowSec = Math.floor(Date.now() / 1000);
  const forcedEpochCount = clampRandomEpochCount(epochCountOverride);
  const epochIndex =
    forcedEpochCount ?? randomInt(RANDOM_FIXTURE_MIN_EPOCHS, RANDOM_FIXTURE_MAX_EPOCHS);
  const transitionCount = Math.max(0, epochIndex - 1);
  // Keep sale #1 bid window short/random within 10 minutes.
  const openGapSec = randomInt(MIN_GAP_SEC, FIRST_SALE_MAX_GAP_SEC);
  const gapsSec = Array.from({ length: transitionCount }, () =>
    randomInt(MIN_GAP_SEC, MAX_GAP_SEC)
  );
  const currentElapsed = randomInt(MIN_GAP_SEC, MAX_GAP_SEC);
  const tStart = nowSec - currentElapsed;
  const currentGap = gapsSec[transitionCount - 1] ?? null;
  return {
    k: FIXED_K,
    epoch: {
      epochIndex,
      floor: FIXED_FLOOR,
      D: currentGap,
      tStart,
      tNow: nowSec,
    },
    history: {
      gapsSec,
      openGapSec,
    },
  };
}

function makeBeforeOpenPulseFixture(): PulseFixture {
  const nowSec = Math.floor(Date.now() / 1000);
  const openTimeSec = nowSec + BEFORE_OPEN_FIXTURE_DELAY_SEC;
  return {
    k: 1e20,
    state: "before_open",
    epoch: {
      epochIndex: 0,
      floor: 0.1,
      D: BEFORE_OPEN_FIXTURE_OPEN_GAP_SEC,
      tStart: openTimeSec + BEFORE_OPEN_FIXTURE_OPEN_GAP_SEC,
      tNow: nowSec,
    },
    history: {
      openGapSec: BEFORE_OPEN_FIXTURE_OPEN_GAP_SEC,
    },
  };
}

function makeOpenNotActivePulseFixture(): PulseFixture {
  const nowSec = Math.floor(Date.now() / 1000);
  const openTimeSec = nowSec - OPEN_NOT_ACTIVE_FIXTURE_ELAPSED_SEC;
  return {
    k: 1e20,
    state: "open_not_active",
    epoch: {
      epochIndex: 0,
      floor: 0.1,
      D: OPEN_NOT_ACTIVE_FIXTURE_OPEN_GAP_SEC,
      tStart: openTimeSec + OPEN_NOT_ACTIVE_FIXTURE_OPEN_GAP_SEC,
      tNow: nowSec,
    },
    history: {
      openGapSec: OPEN_NOT_ACTIVE_FIXTURE_OPEN_GAP_SEC,
    },
  };
}

function normalizeFixtureSelector(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (!value) return null;
  if (
    value === "0" ||
    value === "false" ||
    value === "off" ||
    value === "none" ||
    value === "auto"
  ) {
    return null;
  }
  if (value === "1" || value === "true" || value === "on") {
    return DEFAULT_PULSE_FIXTURE_PRESET;
  }
  return PULSE_FIXTURE_PRESET_ALIASES[value] ?? value;
}

function isFixtureDisabledToken(raw: unknown): boolean {
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return (
    value === "0" ||
    value === "false" ||
    value === "off" ||
    value === "none" ||
    value === "auto"
  );
}

function readFixtureSelector(): string | null {
  if (typeof window === "undefined") return null;
  const query = window.location.search ?? "";
  const match = /(?:[?&])fixture=([^&]+)/.exec(query);
  if (match) {
    const queryValue = normalizeFixtureSelector(decodeURIComponent(match[1]));
    if (queryValue) return queryValue;
  }
  const envValue = normalizeFixtureSelector(getEnvValue("VITE_PULSE_FIXTURE"));
  if (envValue) return envValue;
  return null;
}

function clonePulseFixture(fx: PulseFixture): PulseFixture {
  return {
    k: fx.k,
    state: fx.state,
    epoch: {
      epochIndex: fx.epoch.epochIndex,
      floor: fx.epoch.floor,
      D: fx.epoch.D,
      tStart: fx.epoch.tStart,
      tNow: fx.epoch.tNow,
    },
    history: fx.history
      ? {
          floors: fx.history.floors?.slice(),
          gapsSec: fx.history.gapsSec?.slice(),
          openGapSec: fx.history.openGapSec,
        }
      : undefined,
  };
}

function parsePulseFixture(raw: unknown): PulseFixture | null {
  if (!raw || typeof raw !== "object" || !(raw as any).epoch) return null;
  try {
    const k = Number((raw as any).k);
    const stateRaw = String((raw as any).state ?? "").trim().toLowerCase();
    const state: PulseFixtureState | undefined =
      stateRaw === "before_open" ||
      stateRaw === "before-open" ||
      stateRaw === "beforeopen" ||
      stateRaw === "pre_open" ||
      stateRaw === "pre-open" ||
      stateRaw === "preopen"
        ? "before_open"
        : stateRaw === "open_not_active" ||
          stateRaw === "open-not-active" ||
          stateRaw === "opennotactive" ||
          stateRaw === "open_no_mint" ||
          stateRaw === "open-no-mint" ||
          stateRaw === "after_open" ||
          stateRaw === "after-open" ||
          stateRaw === "afteropen"
        ? "open_not_active"
        : undefined;
    const epoch = (raw as any).epoch ?? {};
    const floor = Number(epoch.floor);
    const tStart = Number(epoch.tStart);
    const tNow = Number(epoch.tNow);
    const D =
      epoch.D == null ? null : Number.isFinite(Number(epoch.D)) ? Number(epoch.D) : null;
    if (
      !Number.isFinite(k) ||
      !Number.isFinite(floor) ||
      !Number.isFinite(tStart) ||
      !Number.isFinite(tNow)
    ) {
      return null;
    }
    const historyRaw = (raw as any).history;
    let history: PulseFixture["history"] | undefined;
    if (historyRaw && typeof historyRaw === "object") {
      const floorsRaw = Array.isArray((historyRaw as any).floors)
        ? ((historyRaw as any).floors as unknown[])
        : [];
      const gapsRaw = Array.isArray((historyRaw as any).gapsSec)
        ? ((historyRaw as any).gapsSec as unknown[])
        : [];
      const openGapRaw = Number((historyRaw as any).openGapSec);
      const floors = floorsRaw
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v > 0)
        .map((v) => Math.max(1, v));
      const gapsSec = gapsRaw
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v))
        .map((v) => Math.max(1, Math.round(v)));
      const openGapSec =
        Number.isFinite(openGapRaw) && openGapRaw > 0
          ? Math.max(1, Math.round(openGapRaw))
          : undefined;
      if (floors.length >= 2 || gapsSec.length >= 1 || openGapSec != null) {
        history = {
          floors: floors.length ? floors : undefined,
          gapsSec: gapsSec.length ? gapsSec : undefined,
          openGapSec,
        };
      }
    }
    return {
      k,
      state,
      epoch: {
        epochIndex: Number.isFinite(Number(epoch.epochIndex))
          ? Number(epoch.epochIndex)
          : 0,
        floor,
        D,
        tStart,
        tNow,
      },
      history,
    };
  } catch {
    return null;
  }
}

function resolvePulseFixturePreset(
  name: string,
  opts?: { randomEpochCount?: number | null }
): PulseFixture | null {
  if (name === "random") return makeRandomPulseFixture(opts?.randomEpochCount ?? null);
  if (name === "before_open") return makeBeforeOpenPulseFixture();
  if (name === "open_not_active") return makeOpenNotActivePulseFixture();
  const preset = PULSE_FIXTURE_PRESETS[name];
  return preset ? clonePulseFixture(preset) : null;
}

function fixtureEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const query = window.location.search ?? "";
  const match = /(?:[?&])fixture=([^&]+)/.exec(query);
  if (match) return !isFixtureDisabledToken(decodeURIComponent(match[1]));

  const envRaw = getEnvValue("VITE_PULSE_FIXTURE");
  if (envRaw != null) return !isFixtureDisabledToken(envRaw);

  return false;
}

function readPulseFixture(enabled: boolean): PulseFixture | null {
  if (!enabled) return null;
  if (typeof window === "undefined") return null;

  const explicitRaw =
    (window as any).__PULSE_FIXTURE__ ??
    (() => {
      try {
        const stored = window.localStorage.getItem("__PULSE_FIXTURE__");
        if (stored) return JSON.parse(stored);
      } catch {
        /* ignore */
      }
      return null;
    })();
  const explicitFixture = parsePulseFixture(explicitRaw);
  if (explicitFixture) return explicitFixture;

  const selector = readFixtureSelector();
  const presetName = selector ?? DEFAULT_PULSE_FIXTURE_PRESET;
  const randomEpochCount = readRandomEpochCountOverride();
  const preset = resolvePulseFixturePreset(presetName, { randomEpochCount });
  if (preset) return preset;

  if (presetName.startsWith("{")) {
    try {
      const inline = parsePulseFixture(JSON.parse(presetName));
      if (inline) return inline;
    } catch {
      /* ignore */
    }
  }

  return (
    resolvePulseFixturePreset(DEFAULT_PULSE_FIXTURE_PRESET, { randomEpochCount }) ??
    resolvePulseFixturePreset(FALLBACK_PULSE_FIXTURE_PRESET, { randomEpochCount })
  );
}

function fixtureToState(
  fx: PulseFixture,
  decimals: number
): { config: AuctionSnapshot["config"]; bids: NormalizedBid[]; nowSec: number } {
  const kScaled = rescaleWeiToDecimals(
    FIXTURE_ARG_K_WEI,
    decimals
  );
  const ptsScaled = rescaleWeiToDecimals(
    FIXTURE_ARG_PTS_WEI_PER_SEC,
    decimals
  );
  const genesisPriceScaled = rescaleWeiToDecimals(
    FIXTURE_ARG_GENESIS_PRICE_WEI,
    decimals
  );
  const genesisFloorScaled = rescaleWeiToDecimals(
    FIXTURE_ARG_GENESIS_FLOOR_WEI,
    decimals
  );
  const kHuman = scaledBigIntToHuman(kScaled, decimals);
  const ptsHuman = scaledBigIntToHuman(ptsScaled, decimals);
  const genesisPriceHuman = scaledBigIntToHuman(genesisPriceScaled, decimals);
  const genesisFloorHuman = scaledBigIntToHuman(genesisFloorScaled, decimals);
  const genesisPremiumHuman = Math.max(
    1e-9,
    genesisPriceHuman - genesisFloorHuman
  );
  const nowSec = Number.isFinite(Number(fx.epoch.tNow))
    ? Number(fx.epoch.tNow)
    : Date.now() / 1000;
  const toU256 = (val: bigint) => toU256Num({ low: val.toString(), high: "0" });
  const genesisFloorU256 = toU256(genesisFloorScaled);
  const genesisPriceU256 = toU256(genesisPriceScaled);
  if (fx.state) {
    const openGapRaw = Number(fx.history?.openGapSec);
    const openGapSec =
      Number.isFinite(openGapRaw) && openGapRaw > 0
        ? Math.max(1, Math.round(openGapRaw))
        : fx.state === "before_open"
        ? BEFORE_OPEN_FIXTURE_OPEN_GAP_SEC
        : OPEN_NOT_ACTIVE_FIXTURE_OPEN_GAP_SEC;
    const openTimeCandidate = fx.epoch.tStart - openGapSec;
    const openTimeSec = Number.isFinite(openTimeCandidate)
      ? fx.state === "before_open"
        ? Math.max(openTimeCandidate, nowSec + 1)
        : Math.min(openTimeCandidate, nowSec - 1)
      : fx.state === "before_open"
      ? nowSec + BEFORE_OPEN_FIXTURE_DELAY_SEC
      : nowSec - OPEN_NOT_ACTIVE_FIXTURE_ELAPSED_SEC;
    return {
      config: {
        openTimeSec,
        genesisPrice: genesisPriceU256,
        genesisFloor: genesisFloorU256,
        k: toU256(kScaled),
        pts: ptsScaled.toString(),
      },
      bids: [],
      nowSec,
    };
  }
  const latestEpochIndex = Number.isFinite(Number(fx.epoch.epochIndex))
    ? Math.max(1, Math.round(Number(fx.epoch.epochIndex)))
    : 1;
  const maxBids = 120;
  const bidCount = Math.max(1, Math.min(maxBids, latestEpochIndex));
  const epochStartIndex = Math.max(1, latestEpochIndex - (bidCount - 1));
  const transitionCount = Math.max(0, bidCount - 1);

  const defaultGapRaw =
    fx.epoch.D != null && Number.isFinite(Number(fx.epoch.D)) && Number(fx.epoch.D) > 0
      ? Number(fx.epoch.D)
      : Math.max(1, nowSec - fx.epoch.tStart);
  const defaultGapSec = Math.max(1, Math.round(defaultGapRaw));

  const historyGaps = (fx.history?.gapsSec ?? [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0)
    .map((v) => Math.max(1, Math.round(v)));
  const knownGapTail = historyGaps.slice(
    -Math.min(historyGaps.length, transitionCount)
  );
  const gapsSec = Array.from(
    { length: Math.max(0, transitionCount - knownGapTail.length) },
    () => defaultGapSec
  ).concat(knownGapTail);

  // Keep the current epoch's pump aligned with the fixture's D for logical consistency.
  if (
    transitionCount > 0 &&
    fx.epoch.D != null &&
    Number.isFinite(Number(fx.epoch.D)) &&
    Number(fx.epoch.D) > 0
  ) {
    gapsSec[transitionCount - 1] = defaultGapSec;
  }

  const timeSeriesSec = new Array<number>(bidCount).fill(fx.epoch.tStart);
  timeSeriesSec[bidCount - 1] = fx.epoch.tStart;
  for (let idx = bidCount - 2; idx >= 0; idx -= 1) {
    timeSeriesSec[idx] = timeSeriesSec[idx + 1] - Math.max(1, gapsSec[idx] ?? defaultGapSec);
  }

  // Pure-ratchet cascade for fixtures:
  // each bid is a completed sale; its amount/floor is the executed sale price p_i.
  const floorSeries = new Array<number>(bidCount).fill(0);
  const premiumSeries = new Array<number>(bidCount).fill(0);
  const openGapRaw = Number(fx.history?.openGapSec);
  const openGapSec =
    Number.isFinite(openGapRaw) && openGapRaw > 0
      ? Math.max(1, Math.round(openGapRaw))
      : defaultGapSec;
  const firstBidAtSec = timeSeriesSec.length ? timeSeriesSec[0] : fx.epoch.tStart;
  const openTimeSec = firstBidAtSec - openGapSec;
  let prevFloor = genesisFloorHuman;
  let prevPremium = genesisPremiumHuman;
  let prevStartSec = openTimeSec;
  for (let idx = 0; idx < bidCount; idx += 1) {
    const saleTimeSec = timeSeriesSec[idx];
    const dtLastSec = Math.max(1, saleTimeSec - prevStartSec);
    const clearPrice =
      prevFloor +
      prevPremium /
        Math.max(1 + (dtLastSec * prevPremium) / Math.max(kHuman, 1e-9), 1e-9);
    floorSeries[idx] = Math.max(0, clearPrice);
    premiumSeries[idx] = ptsHuman * dtLastSec;
    prevFloor = floorSeries[idx];
    prevPremium = premiumSeries[idx];
    prevStartSec = saleTimeSec;
  }
  const floorSeriesScaled = floorSeries.map((floor) =>
    humanToScaledBigInt(floor, decimals)
  );

  const bids: NormalizedBid[] = floorSeriesScaled.map((floorScaled, idx) => {
    const epoch = epochStartIndex + idx;
    const premium = Math.max(premiumSeries[idx] ?? 0, 1e-9);
    const anchorOffsetSec = Math.max(1, Math.floor(kHuman / premium));
    const anchorASec = timeSeriesSec[idx] - anchorOffsetSec;
    return {
      key: `fx#${epoch}`,
      atMs: timeSeriesSec[idx] * 1000,
      bidder: `0xfixture-${epoch.toString(16)}`,
      amount: toU256(floorScaled),
      floorB: toU256(floorScaled),
      anchorASec,
      blockNumber: idx + 1,
      epochIndex: epoch,
      tokenId: epoch,
    };
  });
  const config: AuctionSnapshot["config"] = {
    openTimeSec,
    genesisPrice: genesisPriceU256,
    genesisFloor: genesisFloorU256,
    k: toU256(kScaled),
    pts: ptsScaled.toString(),
  };
  return { config, bids, nowSec };
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  const days = Math.floor(rounded / 86_400);
  const hours = Math.floor((rounded % 86_400) / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const secs = rounded % 60;
  if (days > 0) return `${days}d${hours}h${minutes}m${secs}s`;
  if (hours > 0) return `${hours}h${minutes}m${secs}s`;
  if (minutes > 0) return `${minutes}m${secs}s`;
  return `${secs}s`;
}

function formatSecondsDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  return `${Math.max(0, Math.round(seconds))}s`;
}

function formatLocalTime(atMs: number): string {
  const d = new Date(atMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatUtcTime(atMs: number): string {
  const d = new Date(atMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function formatAmount(
  val: string | undefined,
  _decimals: number,
  symbol: string
): string {
  const raw = val ?? "";
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  if (Number.isFinite(n)) {
    if (n !== 0 && Math.abs(n) < 0.01) {
      const fixed = n.toFixed(18);
      if (Number(fixed) !== 0) {
        return `${formatTinyDecimalString(fixed)} ${symbol}`;
      }
      return `${n.toExponential(4)} ${symbol}`;
    }
    const withSep = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return `${withSep} ${symbol}`;
  }
  return `${String(raw)} ${symbol}`;
}

function formatAmountTinyAware(
  val: string | undefined,
  _decimals: number,
  symbol: string
): string {
  const raw = val ?? "";
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return `${String(raw)} ${symbol}`;

  const baseDigits = 2;
  if (n === 0 || Number(n.toFixed(baseDigits)) !== 0) {
    return formatAmount(val, _decimals, symbol);
  }

  const meaningfulFracDigits = (fixed: string): number => {
    const parts = fixed.split(".");
    if (parts.length < 2) return 0;
    const frac = parts[1] ?? "";
    const firstNonZero = frac.search(/[1-9]/);
    if (firstNonZero < 0) return 0;
    return frac.length - firstNonZero;
  };

  let digits = 3;
  const maxDigits = 12;
  while (digits < maxDigits) {
    const fixed = n.toFixed(digits);
    const nonZero = Number(fixed) !== 0;
    const enoughMeaningful = meaningfulFracDigits(fixed) >= 2;
    if (nonZero && enoughMeaningful) break;
    digits += 1;
  }
  if (Number(n.toFixed(digits)) === 0) {
    return `${n.toExponential(2)} ${symbol}`;
  }

  const withSep = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
  return `${withSep} ${symbol}`;
}

function formatAmountDetailed(
  val: string | undefined,
  _decimals: number,
  symbol: string,
  maxFractionDigits = 8
): string {
  const raw = val ?? "";
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return `${String(raw)} ${symbol}`;
  if (n === 0) return `0 ${symbol}`;

  if (Math.abs(n) < 0.01) {
    const fixed = n.toFixed(18);
    if (Number(fixed) !== 0) {
      return `${formatTinyDecimalString(fixed, maxFractionDigits)} ${symbol}`;
    }
    return `${n.toExponential(4)} ${symbol}`;
  }

  const withSep = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(n);
  return `${withSep} ${symbol}`;
}

function formatAmountWithMinNonZeroFrac(
  val: string | undefined,
  _decimals: number,
  symbol: string,
  minNonZeroFracDigits = 2
): string {
  const raw = val ?? "";
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return `${String(raw)} ${symbol}`;
  if (n === 0) return formatAmount(val, _decimals, symbol);

  const nonZeroFracCount = (fixed: string): number => {
    const parts = fixed.split(".");
    if (parts.length < 2) return 0;
    const frac = parts[1] ?? "";
    const matches = frac.match(/[1-9]/g);
    return matches ? matches.length : 0;
  };

  const maxDigits = 12;
  for (let digits = 2; digits <= maxDigits; digits += 1) {
    const fixed = n.toFixed(digits);
    if (Number(fixed) === 0) continue;
    if (nonZeroFracCount(fixed) >= minNonZeroFracDigits) {
      const withSep = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);
      return `${withSep} ${symbol}`;
    }
  }

  return `${n.toExponential(4)} ${symbol}`;
}

type AuctionStatus =
  | "no_release"
  | "loading"
  | "history_loading"
  | "before_open"
  | "open_not_active"
  | "active"
  | "error";

const CURVE_REASON_COPY: Record<string, string> = {
  "invalid k/pts": "invalid curve constants",
  "k/pts nan": "curve constants not finite",
  "non-positive k/pts": "curve constants must be positive",
  "invalid open time": "invalid open time",
  "invalid opening curve": "invalid opening curve",
  "invalid bid time": "invalid bid time",
  "invalid premium": "invalid time premium",
  "invalid half-life": "invalid half-life",
  "sale price nan": "sale price not finite",
  "no bids": "no bids",
};

function formatCurveReason(reason: string): string {
  return CURVE_REASON_COPY[reason] ?? reason;
}

function normalizeAuctionStatus(value: unknown): AuctionStatus | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "auto") return null;
  if (
    raw === "no_release" ||
    raw === "no-release" ||
    raw === "norelease" ||
    raw === "not_deployed" ||
    raw === "not-deployed" ||
    raw === "no_deployment" ||
    raw === "no-deployment"
  ) {
    return "no_release";
  }
  if (
    raw === "before_open" ||
    raw === "before-open" ||
    raw === "beforeopen" ||
    raw === "pre_open" ||
    raw === "pre-open" ||
    raw === "preopen"
  ) {
    return "before_open";
  }
  if (
    raw === "open_not_active" ||
    raw === "open-not-active" ||
    raw === "opennotactive" ||
    raw === "open_not_actived" ||
    raw === "open-not-actived" ||
    raw === "inactive" ||
    raw === "not_active" ||
    raw === "not-active" ||
    raw === "genesis_waiting" ||
    raw === "genesis-waiting" ||
    raw === "genesis" ||
    raw === "waiting"
  ) {
    return "open_not_active";
  }
  if (raw === "active") return "active";
  if (raw === "loading") return "loading";
  if (raw === "error") return "error";
  return null;
}

function readAuctionStatusOverride(): AuctionStatus | null {
  if (typeof window === "undefined") return null;
  const query = window.location.search ?? "";
  const match = /(?:[?&])auction_status=([^&]+)/i.exec(query);
  if (match) {
    return normalizeAuctionStatus(decodeURIComponent(match[1]));
  }
  const env = getEnvValue("VITE_PULSE_STATUS");
  const envOverride = normalizeAuctionStatus(typeof env === "string" ? env : "");
  if (envOverride) return envOverride;
  const fromGlobal = (window as any).__PULSE_STATUS__;
  if (fromGlobal != null) return normalizeAuctionStatus(String(fromGlobal));
  try {
    const stored = window.localStorage.getItem("__PULSE_STATUS__");
    if (stored) return normalizeAuctionStatus(JSON.parse(stored));
  } catch {
    /* ignore */
  }
  return null;
}

function truthyEnv(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;
  const raw = value.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function directAuctionOverrideAllowed(): boolean {
  if (truthyEnv(getEnvValue("VITE_PATH_ALLOW_DIRECT_AUCTION"))) return true;
  if (typeof window === "undefined") return false;
  const query = window.location.search ?? "";
  return /(?:[?&])direct_auction=(1|true|yes|on)(?:&|$)/i.test(query);
}

function useAuctionStatus(params: {
  releaseMissing: boolean;
  nowSec: number;
  openTimeSec?: number | null;
  coreLoading: boolean;
  bidsLoading: boolean;
  coreActive: boolean;
  coreErrorVisible: unknown;
  bidsLength: number;
  hasRenderableCurve: boolean;
}) {
  const {
    releaseMissing,
    nowSec,
    openTimeSec,
    coreLoading,
    bidsLoading,
    coreActive,
    coreErrorVisible,
    bidsLength,
    hasRenderableCurve,
  } = params;
  const [status, setStatus] = useState<AuctionStatus>("loading");
  const statusOverride = useMemo(() => readAuctionStatusOverride(), []);
  const openAtUtcLabel = useMemo(() => {
    if (typeof openTimeSec !== "number" || !Number.isFinite(openTimeSec)) {
      return null;
    }
    return formatUtcTime(openTimeSec * 1000);
  }, [openTimeSec]);
  const opensInLabel = useMemo(() => {
    if (typeof openTimeSec !== "number" || !Number.isFinite(openTimeSec)) {
      return null;
    }
    const remaining = openTimeSec - nowSec;
    if (remaining <= 0) return null;
    return formatDuration(remaining);
  }, [nowSec, openTimeSec]);

  useEffect(() => {
    if (statusOverride) {
      setStatus(statusOverride);
      return;
    }
    if (releaseMissing) {
      setStatus("no_release");
      return;
    }
    if (coreErrorVisible) {
      setStatus("error");
      return;
    }
    if (typeof openTimeSec !== "number" || !Number.isFinite(openTimeSec)) {
      setStatus("loading");
      return;
    }
    if (nowSec < openTimeSec) {
      setStatus("before_open");
      return;
    }
    if (bidsLoading && bidsLength === 0 && coreActive && !hasRenderableCurve) {
      setStatus("history_loading");
      return;
    }
    if (bidsLength > 0 || coreActive) {
      setStatus("active");
      return;
    }
    if (coreLoading) {
      setStatus("loading");
      return;
    }
    setStatus("open_not_active");
  }, [
    statusOverride,
    releaseMissing,
    coreLoading,
    bidsLoading,
    coreActive,
    coreErrorVisible,
    openTimeSec,
    nowSec,
    bidsLength,
    hasRenderableCurve,
  ]);

  return { status, openAtUtcLabel, opensInLabel };
}

function toSafeNumber(val: string | number | bigint | undefined): number {
  if (val === undefined) return Number.NaN;
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const s = val.trim();
    const direct = Number(s);
    if (Number.isFinite(direct)) return direct;
    if (/^0x[0-9a-f]+$/i.test(s)) {
      try {
        return Number(BigInt(s));
      } catch {
        return Number.NaN;
      }
    }
    const f = Number.parseFloat(s);
    if (Number.isFinite(f)) return f;
    try {
      return Number(BigInt(s));
    } catch {
      return Number.NaN;
    }
  }
  return Number.NaN;
}

function pickNumber(
  ...vals: Array<string | number | bigint | undefined>
): number {
  for (const v of vals) {
    const n = toSafeNumber(v);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

export default function AuctionCanvas({
  address,
  provider,
  refreshMs = 12000,
  decimals = 18,
  maxBids = 800,
}: Props) {
  const useFixture = useMemo(() => fixtureEnabled(), []);
  const fixture = useMemo(() => readPulseFixture(useFixture), [useFixture]);
  const fixtureState = useMemo(
    () => (fixture ? fixtureToState(fixture, decimals) : null),
    [fixture, decimals]
  );
  const isDesktop = useDesktopOnly();
  const bidsFromBlock = useMemo(() => resolveBidsFromBlock(), []);
  const protocolRelease = useMemo(() => getProtocolRelease(), []);
  const allowDirectAuction = useMemo(() => directAuctionOverrideAllowed(), []);
  const pathMintIntent = useMemo(() => readPathMintIntent(), []);
  const releaseMissing = !fixtureState && !allowDirectAuction && !protocolRelease;
  const network = useMemo(() => {
    const raw = getEnvValue("VITE_NETWORK");
    return typeof raw === "string" ? raw : undefined;
  }, []);
  const missingDeployBlock = useMemo(() => {
    if (network === "devnet") return false;
    return bidsFromBlock == null;
  }, [network, bidsFromBlock]);
  const auctionAddress = useMemo(
    () =>
      releaseMissing ? undefined : maybeResolveAddress("pulse_auction", address),
    [address, releaseMissing]
  );
  const protocolGuard = useProtocolReleaseGuard({
    address: auctionAddress,
    provider,
    enabled: !fixtureState && !releaseMissing && Boolean(auctionAddress),
  });
  const liveAuctionEnabled =
    !fixtureState && Boolean(auctionAddress) && protocolGuard.ready;
  const {
    data: coreData,
    loading: coreLoadingHook,
    error: coreErrorHook,
    refresh: refreshCore = async () => undefined,
  } = useAuctionCore({
    address: auctionAddress,
    provider,
    refreshMs,
    enabled: liveAuctionEnabled,
  });
  const bidHistoryEnabled =
    liveAuctionEnabled && Boolean(coreData?.config);
  const {
    bids: bidsHook,
    loading: bidsLoading,
    pullOnce: pullBidsOnce = async () => [],
  } = useAuctionBids({
    address: auctionAddress ?? "0x0000000000000000000000000000000000000000",
    provider,
    fromBlock: bidsFromBlock,
    refreshMs,
    enabled: bidHistoryEnabled,
    maxBids,
  });
  const bids = fixtureState?.bids ?? bidsHook;
  const paymentToken = useMemo(() => resolvePaymentToken(), []);
  const nativePayment = useMemo(
    () => isNativePaymentToken(paymentToken),
    [paymentToken]
  );
  const displayTokenSymbol = useMemo(
    () => resolvePaymentSymbol(paymentToken),
    [paymentToken]
  );
  const core = useMemo(
    () => (fixtureState ? { config: fixtureState.config } : coreData),
    [fixtureState, coreData]
  );
  const coreImpliesActive = Boolean(
    coreData?.active ||
      coreData?.state?.active ||
      ((coreData?.state?.epochIndex ?? 0) > 0)
  );
  const bidsLoadingVisible = fixtureState ? false : bidHistoryEnabled && bidsLoading;
  const coreLoading = fixtureState
    ? false
    : protocolGuard.loading || coreLoadingHook;
  const coreError = fixtureState ? null : protocolGuard.error ?? coreErrorHook;
  const [coreErrorVisible, setCoreErrorVisible] = useState<unknown>(null);
  const [missingDeployBlockVisible, setMissingDeployBlockVisible] =
    useState(false);
  const [noBidsVisible, setNoBidsVisible] = useState(false);
  const {
    account,
    address: walletAddress,
    isConnected,
    chainId,
    connectAsync,
    connectors,
    accountMissing,
    requestAccounts,
    watchAsset,
    evm,
  } = useWallet();
  const [walletUnlockAttempted, setWalletUnlockAttempted] = useState(false);
  const [txState, setTxState] = useState<TxState>("idle");
  const [txPhase, setTxPhase] = useState<TxPhase | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<Notice | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const queuedToastRef = useRef<Notice | null>(null);
  const showToast = useCallback((notice: Notice) => {
    setToastNotice(notice);
  }, []);
  const queueToast = useCallback(
    (notice: Notice) => {
      if (!toastNotice) {
        setToastNotice(notice);
        return;
      }
      queuedToastRef.current = notice;
    },
    [toastNotice]
  );
  const [pendingMint, setPendingMint] = useState<{
    txHash: string;
    address: string;
    baselineTokenId: number | null;
  } | null>(null);
  const [persistentNoticeVisible, setPersistentNoticeVisible] =
    useState<Notice | null>(null);
  const persistentNoticeTimerRef = useRef<number | null>(null);
  const ctaTimerRef = useRef<number | null>(null);
  const ctaDisplayKeyRef = useRef<string | null>(null);
  const [ctaDisplay, setCtaDisplay] = useState<{
    label: string;
    disabled: boolean;
    onClick: () => void;
  } | null>(null);
  const [preflight, setPreflight] = useState<{
    ask: U256Num | null;
    balance: U256Num | null;
    allowance: U256Num | null;
    loading: boolean;
    attempted: boolean;
    error: string | null;
  }>({
    ask: null,
    balance: null,
    allowance: null,
    loading: false,
    attempted: false,
    error: null,
  });
  const [mintReview, setMintReview] = useState<MintReviewQuote | null>(null);
  const [currentAskQuoteDec, setCurrentAskQuoteDec] = useState<string | null>(null);
  const coreCurrentAskDec = useMemo(() => {
    if (fixtureState || !coreData?.price) return null;
    try {
      return toFixed(coreData.price, decimals);
    } catch {
      return null;
    }
  }, [coreData?.price, decimals, fixtureState]);
  const effectiveCurrentAskQuoteDec = currentAskQuoteDec ?? coreCurrentAskDec;
  const [returnPromptVisible, setReturnPromptVisible] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const preflightRef = useRef<Promise<PreflightResult | null> | null>(null);
  const ctaStackRef = useRef<HTMLDivElement | null>(null);
  const mintReviewRef = useRef<HTMLDivElement | null>(null);
  const walletPickerRef = useRef<HTMLDivElement | null>(null);

  const [hover, setHover] = useState<DotPoint | null>(null);
  const [selectedBidKey, setSelectedBidKey] = useState<string | null>(null);
  const [selectedAskKey, setSelectedAskKey] = useState<string | null>(null);
  const [selectedNow, setSelectedNow] = useState(false);
  const pinnedDotRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [viewportUserLocked, setViewportUserLocked] = useState(false);
  const viewportDataKeyRef = useRef<string | null>(null);
  const viewportUserLockedRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const initialAskTipCurveKeyRef = useRef<string | null>(null);
  const initialAskTipShownRef = useRef(false);
  const postMintNowTipPendingRef = useRef(false);
  const postMintNowTipBaseCurveKeyRef = useRef<string | null>(null);
  const panRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startSvgX: number;
    startSvgY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    startViewport: Viewport | null;
  }>({
    active: false,
    pointerId: null,
    startSvgX: 0,
    startSvgY: 0,
    startClientX: 0,
    startClientY: 0,
    moved: false,
    startViewport: null,
  });
  const hasPinnedDot = selectedBidKey != null || selectedAskKey != null || selectedNow;
  useEffect(() => {
    pinnedDotRef.current = hasPinnedDot;
  }, [hasPinnedDot]);
  const clearPinnedDot = useCallback(() => {
    pinnedDotRef.current = false;
    setSelectedBidKey(null);
    setSelectedAskKey(null);
    setSelectedNow(false);
    setHover(null);
  }, []);
  const pinBidDot = useCallback((key: string) => {
    pinnedDotRef.current = true;
    setSelectedBidKey(key);
    setSelectedAskKey(null);
    setSelectedNow(false);
  }, []);
  const pinAskDot = useCallback((key: string) => {
    pinnedDotRef.current = true;
    setSelectedAskKey(key);
    setSelectedBidKey(null);
    setSelectedNow(false);
  }, []);
  const pinNowDot = useCallback(() => {
    pinnedDotRef.current = true;
    setSelectedNow(true);
    setSelectedBidKey(null);
    setSelectedAskKey(null);
  }, []);
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!pinnedDotRef.current) return;
      const target = event.target as Element | null;
      if (target?.closest?.(".dotfield__point")) return;
      clearPinnedDot();
    };
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [clearPinnedDot]);
  const [preflightErrorVisible, setPreflightErrorVisible] =
    useState<string | null>(null);
  const [preflightWarm, setPreflightWarm] = useState(false);
  const coreWarm = Boolean(core?.config);
  const targetChainIdHex = useMemo(() => resolveTargetChainIdHex(), []);
  const targetChainLabel = useMemo(
    () => resolveChainLabel(targetChainIdHex),
    [targetChainIdHex]
  );
  const targetChainId = useMemo(
    () => parseChainId(targetChainIdHex),
    [targetChainIdHex]
  );
  const chainIdValue = useMemo(() => parseChainId(chainId), [chainId]);
  const chainKnown = chainIdValue !== null;
  const chainOk =
    chainKnown &&
    chainIdValue !== null &&
    targetChainId !== null &&
    chainIdValue === targetChainId;
  const hasDetectedWalletConnector = useMemo(() => {
    if (!connectors?.length) return false;
    return connectors.some((connector) => isConnectorAvailable(connector));
  }, [connectors]);
  const availableConnectors = useMemo(() => {
    if (!connectors?.length) return [];
    return connectors
      .filter(
        (connector) =>
          isConnectorAvailable(connector) && isVisibleWalletConnector(connector)
      )
      .sort((a, b) => {
        const rankDiff = walletConnectorRank(a) - walletConnectorRank(b);
        if (rankDiff !== 0) return rankDiff;
        return String((a as any)?.name ?? "").localeCompare(
          String((b as any)?.name ?? "")
        );
      });
  }, [connectors]);
  const publicNetworkNotice = getPublicNetworkNotice();
  const sepoliaInviteMode = isSepoliaInviteMode();
  const reportBugEnabled = shouldShowReportBug();
  const walletConnected = Boolean(isConnected);
  const reportWalletName = useMemo(() => {
    const providerName = typeof evm?.providerName === "string" ? evm.providerName.trim() : "";
    if (providerName) return providerName;
    const visibleNames = availableConnectors
      .map((connector) => String((connector as any)?.name ?? "").trim())
      .filter(Boolean);
    if (visibleNames.length === 1) return visibleNames[0];
    if (visibleNames.some((name) => /metamask/i.test(name))) return "MetaMask";
    if (visibleNames.some((name) => /rabby/i.test(name))) return "Rabby";
    return walletConnected ? "Injected" : "Unknown";
  }, [availableConnectors, evm?.providerName, walletConnected]);
  const isMetaMaskWallet = /metamask/i.test(reportWalletName);
  const walletConnectV2Enabled = useMemo(() => {
    const raw = getEnvValue("VITE_WALLETCONNECT_PROJECT_ID");
    return typeof raw === "string" && raw.trim().length > 0;
  }, []);
  const walletDetected =
    availableConnectors.length > 0 ||
    hasDetectedWalletConnector ||
    (evm?.providers?.length ?? 0) > 0 ||
    walletConnectV2Enabled;
  const walletAddressPresent = walletConnected && Boolean(walletAddress);
  const walletUnlocked =
    walletConnected && (Boolean(account) || (walletUnlockAttempted && !accountMissing));
  const preflightOk =
    Boolean(preflight.ask) && Boolean(preflight.balance) && Boolean(preflight.allowance);
  const balanceOk =
    preflightOk && (preflight.balance as U256Num).value >= (preflight.ask as U256Num).value;
  const allowanceOk =
    preflightOk && (preflight.allowance as U256Num).value >= (preflight.ask as U256Num).value;
  const askLabel = preflight.ask
    ? formatTokenAmount(preflight.ask, decimals)
    : "—";
  const balanceLabel = preflight.balance
    ? formatTokenAmount(preflight.balance, decimals)
    : "—";
  const devFlag = getEnvValue("DEV");
  const isDevMode =
    !isTestEnv &&
    (devFlag === true ||
      devFlag === "true" ||
      getEnvValue("MODE") === "development");
  const debugPanelEnabled =
    shouldShowDebugPanel() ||
    (publicNetworkNotice == null && isDevMode && (globalThis as any).__PULSE_DEBUG__ === true);
  const debugDefaults = {
    enabled: false,
    cta: "auto",
    notice: "auto",
    walletDetected: "auto",
    walletUnlocked: "auto",
    address: "auto",
    chain: "auto",
    txState: "auto",
    txPhase: "auto",
    txError: "auto",
  } as const;
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugOverride, setDebugOverride] = useState<{
    enabled: boolean;
    cta:
      | "auto"
      | "connect"
      | "connect-locked"
      | "switch"
      | "mint"
      | "mint-disabled"
      | "wallet-request"
      | "pending"
      | "retry";
    notice:
      | "auto"
      | "none"
      | "no_wallet"
      | "wallet_locked"
      | "wrong_network"
      | "rpc_error"
      | "insufficient"
      | "approval"
      | "minting"
      | "invalid_signature"
      | "user_refused"
      | "invalid_block_id"
      | "overflow"
      | "generic";
    walletDetected: "auto" | "yes" | "no";
    walletUnlocked: "auto" | "yes" | "no";
    address: "auto" | "present" | "none";
    chain: "auto" | "ok" | "wrong" | "unknown";
    txState: "auto" | "idle" | "awaiting_signature" | "submitted" | "failed";
    txPhase: "auto" | "approve" | "bid";
    txError:
      | "auto"
      | "invalid_signature"
      | "user_refused"
      | "invalid_block_id"
      | "overflow"
      | "generic";
  }>(debugDefaults);
  const debugActive = debugPanelEnabled && debugOverride.enabled;
  const debugCtaOverride = debugActive ? debugOverride.cta : "auto";
  const ctaOverrideActive = debugActive && debugCtaOverride !== "auto";
  const noticeOverrideActive =
    debugActive && !ctaOverrideActive && debugOverride.notice !== "auto";
  let effectiveWalletDetected = debugActive
    ? debugOverride.walletDetected === "auto"
      ? walletDetected
      : debugOverride.walletDetected === "yes"
    : walletDetected;
  let effectiveWalletAddressPresent = debugActive
    ? debugOverride.address === "auto"
      ? walletAddressPresent
      : debugOverride.address === "present"
    : walletAddressPresent;
  let effectiveWalletUnlocked = debugActive
    ? debugOverride.walletUnlocked === "auto"
      ? walletUnlocked
      : debugOverride.walletUnlocked === "yes"
    : walletUnlocked;
  if (debugActive && debugOverride.walletDetected === "no") {
    effectiveWalletUnlocked = false;
  }
  let effectiveChainKnown = debugActive
    ? debugOverride.chain === "auto"
      ? chainKnown
      : debugOverride.chain !== "unknown"
    : chainKnown;
  let effectiveChainOk = debugActive
    ? debugOverride.chain === "auto"
      ? chainOk
      : debugOverride.chain === "ok"
    : chainOk;
  let effectivePreflightOk = preflightOk;
  let effectiveBalanceOk = balanceOk;
  let effectiveAllowanceOk = allowanceOk;
  let effectivePreflightAttempted = preflight.attempted;
  let effectivePreflightLoading = preflight.loading;
  let effectiveAskLabel = askLabel;
  let effectiveBalanceLabel = balanceLabel;
  const debugTxErrorMap: Record<string, string> = {
    invalid_signature: "argent invalid signature length",
    user_refused: "USER_REFUSED_OP",
    invalid_block_id: "Invalid block id",
    overflow: "u256_sub Overflow",
    generic: "Mint failed",
  };
  let effectiveTxState: TxState =
    debugActive && debugOverride.txState !== "auto"
      ? (debugOverride.txState as TxState)
      : txState;
  let effectiveTxPhase: TxPhase | null =
    debugActive && debugOverride.txPhase !== "auto"
      ? (debugOverride.txPhase as TxPhase)
      : txPhase;
  let effectiveTxError =
    debugActive && debugOverride.txError !== "auto"
      ? debugTxErrorMap[debugOverride.txError] ?? "Mint failed"
      : txError;
  if (ctaOverrideActive) {
    effectiveWalletDetected = true;
    effectiveWalletUnlocked = true;
    effectiveWalletAddressPresent = true;
    effectiveChainKnown = true;
    effectiveChainOk = true;
    effectivePreflightAttempted = true;
    effectivePreflightOk = true;
    effectiveBalanceOk = true;
    effectiveAllowanceOk = true;
    effectiveAskLabel = DEBUG_ASK_LABEL;
    effectiveBalanceLabel = DEBUG_BALANCE_LABEL;
    effectiveTxState = "idle";
    effectiveTxPhase =
      debugOverride.txPhase === "auto"
        ? null
        : (debugOverride.txPhase as TxPhase);
    effectiveTxError =
      debugOverride.txError === "auto"
        ? null
        : debugTxErrorMap[debugOverride.txError] ?? "Mint failed";
    switch (debugCtaOverride) {
      case "connect":
        effectiveWalletAddressPresent = false;
        effectivePreflightAttempted = false;
        effectivePreflightOk = false;
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "connect-locked":
        effectiveWalletUnlocked = false;
        effectivePreflightAttempted = false;
        effectivePreflightOk = false;
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "switch":
        effectiveChainOk = false;
        effectivePreflightAttempted = false;
        effectivePreflightOk = false;
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "mint":
        effectiveTxError = null;
        break;
      case "mint-disabled":
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "wallet-request":
        effectiveTxState = "awaiting_signature";
        if (debugOverride.txPhase === "auto") {
          effectiveTxPhase = "approve";
        }
        break;
      case "pending":
        effectiveTxState = "submitted";
        if (debugOverride.txPhase === "auto") {
          effectiveTxPhase = "bid";
        }
        break;
      case "retry":
        effectiveTxState = "failed";
        if (debugOverride.txError === "auto") {
          effectiveTxError = "Mint failed";
        }
        break;
      default:
        break;
    }
  } else if (noticeOverrideActive) {
    effectiveWalletDetected = true;
    effectiveWalletUnlocked = true;
    effectiveWalletAddressPresent = true;
    effectiveChainKnown = true;
    effectiveChainOk = true;
    effectivePreflightAttempted = true;
    effectivePreflightOk = true;
    effectiveBalanceOk = true;
    effectiveAllowanceOk = true;
    effectiveAskLabel = DEBUG_ASK_LABEL;
    effectiveBalanceLabel = DEBUG_BALANCE_LABEL;
    effectiveTxState = "idle";
    effectiveTxPhase = null;
    effectiveTxError = null;
    switch (debugOverride.notice) {
      case "none":
        break;
      case "no_wallet":
        effectiveWalletDetected = false;
        effectiveWalletUnlocked = false;
        effectiveWalletAddressPresent = false;
        effectiveChainKnown = false;
        effectiveChainOk = false;
        effectivePreflightAttempted = false;
        effectivePreflightOk = false;
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "wallet_locked":
        effectiveWalletUnlocked = false;
        break;
      case "wrong_network":
        effectiveChainOk = false;
        break;
      case "rpc_error":
        effectivePreflightOk = false;
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "insufficient":
        effectiveBalanceOk = false;
        effectiveAllowanceOk = false;
        break;
      case "approval":
        effectiveTxState = "awaiting_signature";
        effectiveTxPhase = "approve";
        break;
      case "minting":
        effectiveTxState = "submitted";
        effectiveTxPhase = "bid";
        break;
      case "invalid_signature":
        effectiveTxState = "failed";
        effectiveTxError = debugTxErrorMap.invalid_signature;
        break;
      case "user_refused":
        effectiveTxState = "failed";
        effectiveTxError = debugTxErrorMap.user_refused;
        break;
      case "invalid_block_id":
        effectiveTxState = "failed";
        effectiveTxError = debugTxErrorMap.invalid_block_id;
        break;
      case "overflow":
        effectiveTxState = "failed";
        effectiveTxError = debugTxErrorMap.overflow;
        break;
      case "generic":
        effectiveTxState = "failed";
        effectiveTxError = debugTxErrorMap.generic;
        break;
      default:
        break;
    }
  }
  let effectiveTxHash =
    debugActive && effectiveTxState === "submitted"
      ? txHash ?? lastTxHash ?? DEBUG_TX_HASH
      : txHash;
  let effectiveLastTxHash =
    debugActive && effectiveTxState === "submitted"
      ? effectiveTxHash
      : lastTxHash;
  if (ctaOverrideActive && effectiveTxState !== "submitted") {
    effectiveTxHash = null;
  }
  const effectiveWalletNeedsUnlock =
    effectiveWalletDetected &&
    effectiveWalletAddressPresent &&
    !effectiveWalletUnlocked;

  useEffect(() => {
    if (!debugActive) return;
    setDebugOverride((prev) => {
      let changed = false;
      const next = { ...prev };
      const setField = <K extends keyof typeof prev,>(
        key: K,
        value: (typeof prev)[K]
      ) => {
        if (next[key] !== value) {
          next[key] = value;
          changed = true;
        }
      };
      const ctaActive = prev.cta !== "auto";
      const noticeActive = prev.notice !== "auto";
      if (ctaActive) {
        setField("notice", "auto");
        ([
          "walletDetected",
          "walletUnlocked",
          "address",
          "chain",
          "txState",
          "txPhase",
          "txError",
        ] as const).forEach((key) => setField(key, "auto"));
      } else if (noticeActive) {
        setField("cta", "auto");
        ([
          "walletDetected",
          "walletUnlocked",
          "address",
          "chain",
          "txState",
          "txPhase",
          "txError",
        ] as const).forEach((key) => setField(key, "auto"));
      } else {
        const walletDetectedNo = prev.walletDetected === "no";
        if (walletDetectedNo) {
          setField("walletUnlocked", "auto");
          setField("address", "auto");
          setField("chain", "auto");
        }
        const walletUnlockedNo = prev.walletUnlocked === "no";
        const addressNone = prev.address === "none";
        const chainBlocked = prev.chain === "wrong" || prev.chain === "unknown";
        const connectionBlocked =
          walletDetectedNo || walletUnlockedNo || addressNone || chainBlocked;
        if (connectionBlocked) {
          setField("txState", "auto");
          setField("txPhase", "auto");
          setField("txError", "auto");
        }
        if (prev.txState !== "failed") {
          setField("txError", "auto");
        }
        if (
          prev.txState !== "awaiting_signature" &&
          prev.txState !== "submitted"
        ) {
          setField("txPhase", "auto");
        }
      }
      return changed ? next : prev;
    });
  }, [debugActive, debugOverride]);

  useEffect(() => {
    if (!coreError || isTransientRpcError(coreError)) {
      setCoreErrorVisible(null);
      return;
    }
    const delay = coreWarm ? ERROR_DELAY_MS : STARTUP_ERROR_DELAY_MS;
    const id = window.setTimeout(
      () => setCoreErrorVisible(coreError),
      delay
    );
    return () => window.clearTimeout(id);
  }, [coreError, coreWarm]);


  useEffect(() => {
    if (!preflight.error || isTransientRpcError(preflight.error)) {
      setPreflightErrorVisible(null);
      return;
    }
    if (preflightOk) {
      setPreflightErrorVisible(null);
      return;
    }
    const delay = preflightWarm ? 0 : STARTUP_ERROR_DELAY_MS;
    const id = window.setTimeout(
      () => setPreflightErrorVisible(preflight.error ?? null),
      delay
    );
    return () => window.clearTimeout(id);
  }, [preflight.error, preflightOk, preflightWarm]);

  useEffect(() => {
    if (preflightOk) {
      setPreflightWarm(true);
    }
  }, [preflightOk]);

  useEffect(() => {
    if (prevWalletRef.current !== walletAddress) {
      prevWalletRef.current = walletAddress ?? null;
      setPreflight({
        ask: null,
        balance: null,
        allowance: null,
        loading: false,
        attempted: false,
        error: null,
      });
      setMintReview(null);
      setPreflightErrorVisible(null);
      setPreflightWarm(false);
    }
    if (!walletAddress || !walletConnected) {
      setWalletUnlockAttempted(false);
      setTxState("idle");
      setTxPhase(null);
      setTxHash(null);
      setTxError(null);
      setLastTxHash(null);
      setCtaDisplay(null);
      ctaDisplayKeyRef.current = null;
      setPreflightErrorVisible(null);
      setPreflightWarm(false);
      setPendingMint(null);
      setMintReview(null);
    }
  }, [walletAddress, walletConnected]);

  useEffect(() => {
    if (!walletConnected) return;
    setWalletPickerOpen(false);
  }, [walletConnected]);

  useEffect(() => {
    if (!mintReview) return;
    const handleOutsidePointerDown = (event: globalThis.Event) => {
      const target = event.target as globalThis.Node | null;
      if (!target) return;
      if (mintReviewRef.current?.contains(target)) return;
      if (ctaStackRef.current?.contains(target)) return;
      setMintReview(null);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    };
  }, [mintReview]);

  useEffect(() => {
    if (!walletPickerOpen) return;
    const handleOutsidePointerDown = (event: globalThis.Event) => {
      const target = event.target as globalThis.Node | null;
      if (!target) return;
      if (walletPickerRef.current?.contains(target)) return;
      if (ctaStackRef.current?.contains(target)) return;
      setWalletPickerOpen(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    };
  }, [walletPickerOpen]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [nowSec, setNowSec] = useState(
    () => fixtureState?.nowSec ?? Date.now() / 1000
  );
  const [liveNowSec, setLiveNowSec] = useState(
    () => fixtureState?.nowSec ?? Date.now() / 1000
  );
  const nowSecRef = useRef(nowSec);
  const liveNowSecRef = useRef(liveNowSec);
  useEffect(() => {
    nowSecRef.current = nowSec;
  }, [nowSec]);
  useEffect(() => {
    liveNowSecRef.current = liveNowSec;
  }, [liveNowSec]);
  const [fallbackConfig, setFallbackConfig] = useState<null | {
    openTimeSec: number;
    genesisPrice: { dec: string; value: bigint };
    genesisFloor: { dec: string; value: bigint };
    k: { dec: string; value: bigint };
    pts: string;
  }>(null);
  const [fallbackError, setFallbackError] = useState<unknown>(null);
  const watchAssetAttemptedRef = useRef(false);
  const txIdleTimerRef = useRef<number | null>(null);
  const prevWalletRef = useRef<string | null>(null);
  const maxTokenId = useMemo(() => {
    if (!bids.length) return null;
    let max = 0;
    for (const bid of bids) {
      const id = bid.tokenId ?? bid.epochIndex ?? 0;
      if (id > max) max = id;
    }
    return max > 0 ? max : null;
  }, [bids]);

  useEffect(() => {
    if (!pendingMint || !bids.length) return;
    const targetHash = pendingMint.txHash.toLowerCase();
    const match = bids.find(
      (bid) => bid.txHash && bid.txHash.toLowerCase() === targetHash
    );
    let tokenId: number | null = null;
    if (match) {
      tokenId = match.tokenId ?? match.epochIndex ?? match.id ?? null;
    } else if (
      maxTokenId != null &&
      pendingMint.baselineTokenId != null &&
      maxTokenId > pendingMint.baselineTokenId
    ) {
      const lastBid = bids[bids.length - 1];
      const bidderMatch =
        pendingMint.address &&
        lastBid?.bidder &&
        lastBid.bidder.toLowerCase() === pendingMint.address.toLowerCase();
      if (bidderMatch) {
        tokenId = lastBid.tokenId ?? lastBid.epochIndex ?? maxTokenId;
      }
    }
    if (tokenId == null) return;
    queueToast({ kind: "info", text: `Minted $PATH #${tokenId}. New curve started.` });
    void pullBidsOnce();
    void refreshCore();
    setPendingMint(null);
  }, [pendingMint, bids, maxTokenId, queueToast, pullBidsOnce, refreshCore]);

  useEffect(() => {
    if (!pendingMint) return;
    const id = window.setTimeout(() => {
      queueToast({
        kind: "warn",
        text: "Mint confirmed. Sale event is still indexing.",
        reportState: "event_detection_failed",
        reportError: pendingMint.txHash,
      });
    }, 15_000);
    return () => window.clearTimeout(id);
  }, [pendingMint, queueToast]);

  const mimicLocalTime = network === "devnet" || protocolRelease?.network === "devnet";

  // Devnet uses browser time to make local Anvil rehearsals usable even when
  // idle blocks are not mined. Public networks keep following block time.
  useEffect(() => {
    let cancelled = false;
    if (isTestRuntime() && !fixtureState) {
      return () => {
        cancelled = true;
      };
    }
    if (fixtureState) {
      if (fixtureState.nowSec) setLiveNowSec(fixtureState.nowSec);
      return () => {
        cancelled = true;
      };
    }
    if (mimicLocalTime) {
      const tick = () => {
        const nextNowSec = Date.now() / 1000;
        liveNowSecRef.current = nextNowSec;
        setLiveNowSec(nextNowSec);
      };
      tick();
      const id = window.setInterval(tick, 1000);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }
    const tick = async () => {
      const chainNowSec = await readLatestChainTimeSec(provider);
      if (cancelled) return;
      const nextNowSec = chainNowSec ?? Date.now() / 1000;
      if (Math.abs(liveNowSecRef.current - nextNowSec) > 0.5) {
        liveNowSecRef.current = nextNowSec;
        setLiveNowSec(nextNowSec);
      }
    };
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fixtureState, provider, mimicLocalTime]);

  // Before the first bid, keep notices/countdowns live. On devnet, keep the
  // active curve growing with browser time for local visual development.
  useEffect(() => {
    let cancelled = false;
    if (isTestRuntime() && !fixtureState) {
      return () => {
        cancelled = true;
      };
    }
    const readNow = async () => {
      const chainNowSec = await readLatestChainTimeSec(provider);
      if (cancelled) return;
      const nextNowSec = chainNowSec ?? Date.now() / 1000;
      if (Math.abs(nowSecRef.current - nextNowSec) > 0.5) {
        nowSecRef.current = nextNowSec;
        setNowSec(nextNowSec);
      }
    };
    if (fixtureState) {
      if (fixtureState.nowSec) setNowSec(fixtureState.nowSec);
      return () => {
        cancelled = true;
      };
    }
    if (mimicLocalTime) {
      const tick = () => {
        const nextNowSec = Date.now() / 1000;
        nowSecRef.current = nextNowSec;
        setNowSec(nextNowSec);
      };
      tick();
      const id = window.setInterval(tick, 1000);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }
    if (bids.length > 0) {
      void readNow();
      return () => {
        cancelled = true;
      };
    }
    void readNow();
    const id = window.setInterval(() => {
      void readNow();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fixtureState, bids.length, provider, mimicLocalTime]);

  // Fallback: fetch config directly if the core hook never fills it.
  useEffect(() => {
    if (fixtureState) return;
    if (core?.config) {
      if (fallbackConfig) setFallbackConfig(null);
      return;
    }
    if (fallbackConfig) return;
    if (!coreError || isTransientRpcError(coreError)) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      (async () => {
        try {
          setFallbackError(null);
          if (!auctionAddress) {
            throw new Error("Auction contract address is missing.");
          }
          const prov = provider ?? (getDefaultProvider() as ProviderInterface);
          const res: any = await callContract(prov, {
            contractAddress: auctionAddress,
            entrypoint: "get_config",
            calldata: [],
          });
          const r = res ?? {};
          if (cancelled) return;
          const open = Number(r.openTime ?? r.open_time ?? r.openTimeSec);
          const gp = readU256(r.genesisPrice ?? r.genesis_price);
          const gf = readU256(r.genesisFloor ?? r.genesis_floor);
          const k = readU256(r.k);
          const pts = String(r.pts);
          setFallbackConfig({
            openTimeSec: open,
            genesisPrice: toU256Num(gp),
            genesisFloor: toU256Num(gf),
            k: toU256Num(k),
            pts,
          });
        } catch (e) {
          if (!cancelled) setFallbackError(e);
        }
      })();
    }, FALLBACK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [
    core,
    coreError,
    auctionAddress,
    provider,
    fallbackConfig,
    fixtureState,
  ]);

  const activeConfig = core?.config ?? fallbackConfig ?? null;
  const openingAskLabel = useMemo(() => {
    if (!activeConfig?.genesisPrice) return "—";
    return formatTokenAmount(activeConfig.genesisPrice, decimals);
  }, [activeConfig?.genesisPrice, decimals]);

  const linkedStatic = useMemo<LinkedStatic>(() => {
    const empty: LinkedStatic = {
      segments: [],
      minY: 0,
      maxY: 1,
      reason: null,
    };
    if (!activeConfig) {
      return {
        ...empty,
        reason: coreLoading
          ? "loading"
          : fallbackError
          ? `fallback error: ${String(fallbackError)}`
          : "no config",
      };
    }

    const kParsed = pickNumber(
      activeConfig.k?.dec,
      (activeConfig as any).k?.value
    );
    const ptsParsed = pickNumber(activeConfig.pts || "0");
    if (!Number.isFinite(kParsed) || !Number.isFinite(ptsParsed)) {
      return { ...empty, reason: "invalid k/pts" };
    }

    const decFactor = Math.pow(10, decimals);
    const kHuman = kParsed / decFactor;
    const ptsHuman = ptsParsed / decFactor;
    if (!Number.isFinite(kHuman) || !Number.isFinite(ptsHuman)) {
      return { ...empty, reason: "k/pts nan" };
    }
    if (kHuman <= 0 || ptsHuman <= 0) {
      return { ...empty, reason: "non-positive k/pts" };
    }

    const openTimeSec = Number(activeConfig.openTimeSec);
    if (!Number.isFinite(openTimeSec)) {
      return { ...empty, reason: "invalid open time" };
    }

    const genesisPriceRaw = pickNumber(
      activeConfig.genesisPrice?.dec,
      (activeConfig as any).genesisPrice?.value
    );
    const genesisFloorRaw = pickNumber(
      activeConfig.genesisFloor?.dec,
      (activeConfig as any).genesisFloor?.value
    );
    const genesisPriceHuman = Number.isFinite(genesisPriceRaw)
      ? genesisPriceRaw / decFactor
      : Number.NaN;
    const genesisFloorHuman = Number.isFinite(genesisFloorRaw)
      ? genesisFloorRaw / decFactor
      : Number.NaN;
    const genesisPremiumHuman = genesisPriceHuman - genesisFloorHuman;
    if (
      !Number.isFinite(genesisPriceHuman) ||
      !Number.isFinite(genesisFloorHuman) ||
      !Number.isFinite(genesisPremiumHuman) ||
      genesisPremiumHuman <= 0
    ) {
      return { ...empty, reason: "invalid opening curve" };
    }

    const segments: LinkedSegment[] = [];
    let uCursor = 0;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const orderedBids = [...bids].sort((a, b) => a.atMs - b.atMs);

    const bidHuman = (bid: NormalizedBid): number => {
      const decStr =
        (bid as any).amountDec ??
        (() => {
          try {
            return toFixed(bid.amount, decimals);
          } catch {
            return String(bid.amount?.dec ?? "");
          }
      })();
      return toNumberSafe(decStr);
    };

    const directState = !fixtureState ? coreData?.state : null;
    const directStateEpoch = Number(directState?.epochIndex);
    const directStateImpliesActive =
      Boolean(directState?.active) ||
      (Number.isFinite(directStateEpoch) && directStateEpoch > 0);
    if (orderedBids.length === 0 && directState && directStateImpliesActive) {
      const stateStartSec = Number(directState.startTimeSec);
      const stateAnchorSec = Number(directState.anchorTimeSec);
      const floorRaw = pickNumber(
        directState.floorPrice?.dec,
        (directState as any).floorPrice?.value
      );
      const floor = Number.isFinite(floorRaw)
        ? floorRaw / decFactor
        : Number.NaN;
      const tHalf = stateStartSec - stateAnchorSec;
      const premium = kHuman / positiveDenominator(tHalf);
      if (
        !Number.isFinite(stateStartSec) ||
        !Number.isFinite(stateAnchorSec) ||
        !Number.isFinite(floor) ||
        !Number.isFinite(tHalf) ||
        !Number.isFinite(premium) ||
        tHalf <= 0 ||
        premium <= 0
      ) {
        return { ...empty, reason: "invalid half-life" };
      }
      const ask = floor + premium;
      const epoch = Number.isFinite(directStateEpoch)
        ? directStateEpoch
        : 1;
      return {
        segments: [
          {
            idx: 0,
            bid: null,
            epoch,
            uStart: 0,
            uLen: 0,
            startSec: stateStartSec,
            endSec: stateStartSec,
            floor,
            premium,
            ask,
            kHuman,
            ptsHuman,
            tHalf,
            anchor: stateAnchorSec,
            dtPrevSec: premium / positiveDenominator(ptsHuman),
            dtNextSec: null,
          },
        ],
        minY: Math.min(floor, ask),
        maxY: Math.max(floor, ask),
        reason: null,
      };
    }

    let segStartSec = openTimeSec;
    let segFloor = genesisFloorHuman;
    let segPremium = genesisPremiumHuman;
    let segDtPrevSec = segPremium / positiveDenominator(ptsHuman);

    for (let i = 0; i < orderedBids.length; i += 1) {
      const bid = orderedBids[i];
      const saleSecRaw = bid.atMs / 1000;
      if (!Number.isFinite(saleSecRaw)) {
        return { ...empty, reason: "invalid bid time" };
      }
      const saleSec = Math.max(segStartSec, saleSecRaw);
      const epoch = Number.isFinite(Number(bid.epochIndex))
        ? Number(bid.epochIndex)
        : i + 1;

      if (!Number.isFinite(segFloor) || !Number.isFinite(segPremium) || segPremium <= 0) {
        return { ...empty, reason: "invalid premium" };
      }

      const tHalf = kHuman / positiveDenominator(segPremium);
      if (!Number.isFinite(tHalf) || tHalf <= 0) {
        return { ...empty, reason: "invalid half-life" };
      }

      const dtToSaleSec = Math.max(0, saleSec - segStartSec);
      const uLen = dtToSaleSec / tHalf;
      const ask = segFloor + segPremium;
      segments.push({
        idx: segments.length,
        bid,
        epoch,
        uStart: uCursor,
        uLen,
        startSec: segStartSec,
        endSec: saleSec,
        floor: segFloor,
        premium: segPremium,
        ask,
        kHuman,
        ptsHuman,
        tHalf,
        anchor: segStartSec - tHalf,
        dtPrevSec: segDtPrevSec,
        dtNextSec: dtToSaleSec,
      });
      minY = Math.min(minY, segFloor, ask);
      maxY = Math.max(maxY, segFloor, ask);
      uCursor += uLen;

      const salePriceHuman = bidHuman(bid);
      if (!Number.isFinite(salePriceHuman)) {
        return { ...empty, reason: "sale price nan" };
      }
      minY = Math.min(minY, salePriceHuman);
      maxY = Math.max(maxY, salePriceHuman);

      const deltaTLastSec = Math.max(1, saleSec - segStartSec);
      let nextPremium = ptsHuman * deltaTLastSec;
      let nextDtPrevSec = deltaTLastSec;
      const anchorFromEvent = Number((bid as any).anchorASec);
      const hasAnchorFromEvent =
        Number.isFinite(anchorFromEvent) &&
        anchorFromEvent > 0 &&
        anchorFromEvent <= saleSec;
      if (hasAnchorFromEvent) {
        const anchorGap = saleSec - anchorFromEvent;
        const premiumFromAnchor =
          anchorGap <= 0 ? kHuman : kHuman / positiveDenominator(anchorGap);
        if (Number.isFinite(premiumFromAnchor) && premiumFromAnchor > 0) {
          nextPremium = premiumFromAnchor;
          nextDtPrevSec = premiumFromAnchor / positiveDenominator(ptsHuman);
        }
      }

      segStartSec = saleSec;
      segFloor = salePriceHuman;
      segPremium = nextPremium;
      segDtPrevSec = nextDtPrevSec;
    }

    if (!Number.isFinite(segFloor) || !Number.isFinite(segPremium) || segPremium <= 0) {
      return { ...empty, reason: "invalid premium" };
    }
    const activeTHalf = kHuman / positiveDenominator(segPremium);
    if (!Number.isFinite(activeTHalf) || activeTHalf <= 0) {
      return { ...empty, reason: "invalid half-life" };
    }
    const lastEpoch = orderedBids.length
      ? Number.isFinite(Number(orderedBids[orderedBids.length - 1].epochIndex))
        ? Number(orderedBids[orderedBids.length - 1].epochIndex)
        : orderedBids.length
      : 0;
    const activeEpoch = lastEpoch + 1;
    const activeAsk = segFloor + segPremium;
    segments.push({
      idx: segments.length,
      bid: null,
      epoch: activeEpoch,
      uStart: uCursor,
      uLen: 0,
      startSec: segStartSec,
      endSec: segStartSec,
      floor: segFloor,
      premium: segPremium,
      ask: activeAsk,
      kHuman,
      ptsHuman,
      tHalf: activeTHalf,
      anchor: segStartSec - activeTHalf,
      dtPrevSec: segDtPrevSec,
      dtNextSec: null,
    });
    minY = Math.min(minY, segFloor, activeAsk);
    maxY = Math.max(maxY, segFloor, activeAsk);

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      minY = 0;
      maxY = 1;
    }

    return {
      segments,
      minY,
      maxY,
      reason: null,
    };
  }, [activeConfig, bids, coreData?.state, coreLoading, fallbackError, decimals, fixtureState]);

  const activeCurveQuoteKey = useMemo(() => {
    if (linkedStatic.reason || !linkedStatic.segments.length) return "";
    const seg = linkedStatic.segments[linkedStatic.segments.length - 1];
    return `${seg.epoch}:${seg.startSec}:${seg.anchor}:${seg.floor}`;
  }, [linkedStatic.reason, linkedStatic.segments]);

  useEffect(() => {
    setCurrentAskQuoteDec((prev) => (prev === null ? prev : null));
  }, [activeCurveQuoteKey]);

  const linked = useMemo<LinkedCurve>(() => {
    const empty: LinkedCurve = {
      segments: [],
      uEnd: 0,
      nowU: null,
      nowPrice: null,
      minY: linkedStatic.minY,
      maxY: linkedStatic.maxY,
      reason: linkedStatic.reason,
    };
    if (linkedStatic.reason) return empty;
    if (!linkedStatic.segments.length) return { ...empty, reason: "no bids" };

    const segments = linkedStatic.segments.slice();
    const lastIdx = segments.length - 1;
    const lastBase = segments[lastIdx];
    let metaDtSec = Math.max(0, liveNowSec - lastBase.startSec);
    let metaU = metaDtSec / positiveDenominator(lastBase.tHalf);
    let metaUClamped = Number.isFinite(metaU) ? Math.max(0, metaU) : 0;
    let nowPrice = priceAtU(lastBase.floor, lastBase.premium, metaUClamped);
    const quotedPrice =
      !mimicLocalTime && effectiveCurrentAskQuoteDec != null
        ? Number(effectiveCurrentAskQuoteDec)
        : Number.NaN;
    if (Number.isFinite(quotedPrice)) {
      const quotedU = quotedUForLiveSegment(lastBase, quotedPrice, liveNowSec);
      if (quotedU != null) {
        metaUClamped = quotedU;
        metaU = quotedU;
        metaDtSec = quotedU * lastBase.tHalf;
        nowPrice = quotedPrice;
      }
    }
    // End the visible serial curve exactly at "now" so the now-dot is the rightmost endpoint.
    const uMaxWindow = metaUClamped;
    const endSec = lastBase.startSec + uMaxWindow * lastBase.tHalf;

    const lastSeg: LinkedSegment = {
      ...lastBase,
      uLen: uMaxWindow,
      endSec,
      dtNextSec: null,
      uMaxWindow,
      metaU,
      metaDtSec,
    };
    segments[lastIdx] = lastSeg;

    const nowU = lastSeg.uStart + metaUClamped;

    return {
      segments,
      uEnd: lastSeg.uStart + uMaxWindow,
      nowU,
      nowPrice,
      minY: linkedStatic.minY,
      maxY: linkedStatic.maxY,
      reason: null,
    };
  }, [linkedStatic, liveNowSec, effectiveCurrentAskQuoteDec, mimicLocalTime]);

  const currentAskEstimate = useMemo(() => {
    if (!fixtureState && !mimicLocalTime && effectiveCurrentAskQuoteDec != null) {
      const quoted = Number(effectiveCurrentAskQuoteDec);
      const seg = linkedStatic.segments[linkedStatic.segments.length - 1];
      if (
        Number.isFinite(quoted) &&
        seg &&
        quotedUForLiveSegment(seg, quoted, liveNowSec) != null
      ) {
        return quoted;
      }
    }
    if (linkedStatic.reason) return null;
    if (!linkedStatic.segments.length) return null;
    const seg = linkedStatic.segments[linkedStatic.segments.length - 1];
    if (!seg) return null;
    const durationSec = Math.max(0, liveNowSec - seg.startSec);
    const uLocal = durationSec / Math.max(seg.tHalf, 1e-9);
    const price = priceAtU(seg.floor, seg.premium, uLocal);
    return Number.isFinite(price) ? Math.max(0, price) : null;
  }, [
    fixtureState,
    mimicLocalTime,
    effectiveCurrentAskQuoteDec,
    linkedStatic.reason,
    linkedStatic.segments,
    liveNowSec,
  ]);
  const currentAskEstimateRef = useRef<number | null>(null);
  useEffect(() => {
    currentAskEstimateRef.current = currentAskEstimate;
  }, [currentAskEstimate]);
  const { status: auctionStatus, openAtUtcLabel, opensInLabel } = useAuctionStatus({
    releaseMissing,
    nowSec,
    openTimeSec: activeConfig?.openTimeSec,
    coreLoading,
    bidsLoading: bidsLoadingVisible,
    coreActive: coreImpliesActive,
    coreErrorVisible,
    bidsLength: bids.length,
    hasRenderableCurve: linked.segments.length > 0 && linked.reason === null,
  });
  const showNoReleaseNotice = auctionStatus === "no_release";
  const showBeforeOpenNotice = auctionStatus === "before_open";
  const showOpenNotActive = auctionStatus === "open_not_active";
  const showHistoryLoading = auctionStatus === "history_loading";
  const showCurveLoading = auctionStatus === "loading";
  const walletActionRequired =
    !effectiveWalletDetected ||
    !effectiveWalletAddressPresent ||
    effectiveWalletNeedsUnlock ||
    (effectiveWalletUnlocked && effectiveChainKnown && !effectiveChainOk);
  const auctionBlocksMint =
    !debugActive &&
    !walletActionRequired &&
    (showNoReleaseNotice || showBeforeOpenNotice || showCurveLoading);
  const auctionBlockedMintNotice = showBeforeOpenNotice
    ? `Auction opens ${opensInLabel ? `in ${opensInLabel}` : "soon"}.`
    : showNoReleaseNotice
    ? "PATH auction not loaded."
    : "Loading auction state.";
  const showMissingDeployBlock =
    auctionStatus === "loading" &&
    missingDeployBlock &&
    !coreLoading &&
    bids.length === 0;
  const showNoBidsLoaded =
    auctionStatus === "loading" &&
    !showMissingDeployBlock &&
    !coreLoading &&
    !bidsLoadingVisible &&
    bids.length === 0;
  useEffect(() => {
    if (!showMissingDeployBlock) {
      setMissingDeployBlockVisible(false);
      return;
    }
    const id = window.setTimeout(
      () => setMissingDeployBlockVisible(true),
      STARTUP_ERROR_DELAY_MS
    );
    return () => window.clearTimeout(id);
  }, [showMissingDeployBlock]);
  useEffect(() => {
    if (!showNoBidsLoaded) {
      setNoBidsVisible(false);
      return;
    }
    const id = window.setTimeout(
      () => setNoBidsVisible(true),
      STARTUP_ERROR_DELAY_MS
    );
    return () => window.clearTimeout(id);
  }, [showNoBidsLoaded]);
  useEffect(() => {
    if (!auctionBlocksMint) return;
    if (txState !== "awaiting_signature" && txState !== "submitted") return;
    setTxState("idle");
    setTxPhase(null);
    setTxHash(null);
    setPendingMint(null);
  }, [auctionBlocksMint, txState]);
  const showCurvePlot =
    auctionStatus === "active" &&
    !showNoReleaseNotice &&
    !showBeforeOpenNotice &&
    !showOpenNotActive &&
    linked.segments.length > 0 &&
    linked.reason === null;
  const liveAskLabel = useMemo(() => {
    if (currentAskEstimate == null || !Number.isFinite(currentAskEstimate)) return null;
    return formatHumanTokenAmount(currentAskEstimate);
  }, [currentAskEstimate]);
  const openCurrentPriceLabel = useMemo(() => {
    if (currentAskEstimate == null || !Number.isFinite(currentAskEstimate)) {
      return openingAskLabel;
    }
    return formatHumanTokenAmount(currentAskEstimate, 8);
  }, [currentAskEstimate, openingAskLabel]);
  const mintReviewCurrentAskLabel = useMemo(() => {
    if (!mintReview) return null;
    return mintReview.priceLabel;
  }, [mintReview]);
  const mintReviewTxValueLabel = useMemo(() => {
    if (!mintReview) return null;
    return mintReview.txValueLabel;
  }, [mintReview]);
  const mintReviewMaxPriceLabel = useMemo(() => {
    if (!mintReview) return null;
    return mintReview.maxPriceLabel;
  }, [mintReview]);
  const mintReviewContractHref = useMemo(() => {
    if (!mintReview || !auctionAddress) return null;
    return resolveExplorerAddressUrl(auctionAddress);
  }, [auctionAddress, mintReview]);
  const mintReviewChainIdLabel = useMemo(
    () => targetChainId?.toString() ?? "unknown",
    [targetChainId]
  );

  const useTailViewport = useMemo(() => {
    const hasSaleHistory = linked.segments.length > 1;
    const hasTinyLiveValues = linked.maxY > 0 && linked.maxY < 0.001;
    const isSparseLiveHistory =
      !fixtureState &&
      bids.length > 0 &&
      bids.length <= LIVE_HISTORY_CONTEXT_MAX_BIDS;
    return (
      isSparseLiveHistory &&
      hasSaleHistory &&
      hasTinyLiveValues &&
      linked.uEnd > EXTREME_HISTORY_TAIL_THRESHOLD
    );
  }, [linked.maxY, linked.segments, linked.uEnd, fixtureState, bids.length]);

  const defaultViewport = useMemo<Viewport | null>(() => {
    if (!linked.segments.length) return null;
    const lastSeg = linked.segments[linked.segments.length - 1];

    let xMin = 0;
    let xMax = Math.max(linked.uEnd, Number.EPSILON);

    if (useTailViewport && lastSeg) {
      xMin = Math.max(0, lastSeg.uStart - SPARSE_LIVE_ACTIVE_CONTEXT);
      xMax = Math.min(
        halfLifeWindowEnd(linked.uEnd),
        lastSeg.uStart + SPARSE_LIVE_ACTIVE_WINDOW
      );
      if (xMax - xMin < BASE_HALF_LIVES) {
        xMax = Math.min(halfLifeWindowEnd(linked.uEnd), xMin + BASE_HALF_LIVES);
      }
    }

    const visibleY = getVisibleYExtents(linked, xMin, xMax);
    const ySpan = visibleY.maxY - visibleY.minY;
    const pad = (ySpan || 1) * 0.15;
    const yMin = visibleY.minY - pad;
    const yMax = visibleY.maxY + pad;
    return { xMin, xMax, yMin, yMax };
  }, [linked, useTailViewport]);

  const viewportDataKey = useMemo(() => {
    const lastSeg = linked.segments[linked.segments.length - 1];
    if (!lastSeg) return null;
    const mode = useTailViewport ? "sparse-tail" : "full";
    const source = fixtureState ? "fixture" : "live";
    return `${source}:${mode}:${bids.length}:${lastSeg.epoch}:${lastSeg.startSec}:${lastSeg.floor}:${lastSeg.premium}:${lastSeg.tHalf}`;
  }, [
    linked.segments,
    useTailViewport,
    fixtureState,
    bids.length,
  ]);

  const effectiveViewport = viewport ?? defaultViewport;

  useEffect(() => {
    if (!linked.segments.length) {
      viewportDataKeyRef.current = null;
      return;
    }
    if (
      defaultViewport &&
      viewportDataKey &&
      viewportDataKeyRef.current !== viewportDataKey
    ) {
      viewportDataKeyRef.current = viewportDataKey;
      viewportUserLockedRef.current = false;
      setViewportUserLocked(false);
      setViewport(defaultViewport);
      return;
    }
    setViewport((prev) => {
      if (!prev) {
        return defaultViewport ?? prev;
      }

      const xRange = prev.xMax - prev.xMin;
      if (!Number.isFinite(xRange) || xRange <= 0) {
        return prev;
      }

      const xEnd = Math.max(
        Number.EPSILON,
        linked.uEnd,
        defaultViewport?.xMax ?? 0
      );
      let xMin = prev.xMin;
      let xMax = prev.xMax;
      if (xMax > xEnd) {
        xMax = xEnd;
        xMin = Math.max(0, xMax - xRange);
      }
      if (xMin < 0) {
        xMin = 0;
        xMax = Math.min(xEnd, xMin + xRange);
      }
      if (!viewportUserLockedRef.current && xMax < linked.uEnd && xMin === 0) {
        xMax = xEnd;
      }
      if (xMax - xMin < 1e-6) {
        xMax = Math.min(xEnd, xMin + BASE_HALF_LIVES);
      }
      return xMin === prev.xMin && xMax === prev.xMax ? prev : { ...prev, xMin, xMax };
    });
  }, [defaultViewport, linked.uEnd, linked.segments.length, viewportDataKey]);

  useEffect(() => {
    if (!toastNotice) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      if (queuedToastRef.current) {
        const next = queuedToastRef.current;
        queuedToastRef.current = null;
        setToastNotice(next);
      } else {
        setToastNotice(null);
      }
      toastTimerRef.current = null;
    }, 3000);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toastNotice]);

  const runPreflight = useCallback(async (): Promise<PreflightResult | null> => {
    if (!walletAddress) return null;
    if (fixtureState) {
      const askEstimate = currentAskEstimateRef.current;
      const ask =
        askEstimate != null && Number.isFinite(askEstimate)
          ? humanToU256Num(askEstimate, decimals)
          : activeConfig?.genesisPrice
          ? toU256Num(readU256(activeConfig.genesisPrice))
          : toU256Num({ low: FIXTURE_ASK_WEI, high: "0" });
      const balance = toU256Num({ low: FIXTURE_BALANCE_WEI, high: "0" });
      const allowance = toU256Num({ low: FIXTURE_BALANCE_WEI, high: "0" });
      setPreflight({
        ask,
        balance,
        allowance,
        loading: false,
        attempted: true,
        error: null,
      });
      return { ask, balance, allowance };
    }
    if (preflightRef.current) return preflightRef.current;
    const task = (async () => {
      setPreflight((prev) => ({
        ...prev,
        loading: true,
        attempted: true,
        error: null,
      }));
      if (!auctionAddress) {
        const msg = "Auction contract address is missing.";
        setPreflight({
          ask: null,
          balance: null,
          allowance: null,
          loading: false,
          attempted: true,
          error: msg,
        });
        return null;
      }
      if (!paymentToken) {
        const msg = "Payment token address is missing.";
        setPreflight({
          ask: null,
          balance: null,
          allowance: null,
          loading: false,
          attempted: true,
          error: msg,
        });
        return null;
      }
      const readProvider =
        provider ?? (getDefaultProvider() as ProviderInterface);
      const connectedReadProvider =
        chainOk && evm?.provider && evm.provider !== readProvider
          ? (evm.provider as ProviderInterface)
          : null;
      const readPreflightData = async (
        candidateProvider: ProviderInterface
      ): Promise<PreflightResult> => {
        let ask: U256Num | null = null;
        if (mimicLocalTime) {
          await syncDevnetTimeToBrowser(candidateProvider, liveNowSecRef.current);
          const askEstimate = currentAskEstimateRef.current;
          if (askEstimate != null && Number.isFinite(askEstimate)) {
            ask = humanToU256Num(askEstimate, decimals);
          }
        }
        if (!ask) {
          ask = await readCurrentAskFromContract(candidateProvider, auctionAddress);
        }
        let balance: U256Num;
        let allowance: U256Num;
        if (nativePayment) {
          const balanceRaw = await getBalance(candidateProvider, walletAddress, "latest");
          balance = toU256Num({
            low: balanceRaw.toString(10),
            high: "0",
          });
          allowance = ask;
        } else {
          const balanceRes: any = await callContract(candidateProvider, {
            contractAddress: paymentToken,
            entrypoint: "balance_of",
            calldata: [walletAddress],
          });
          balance = toU256Num(
            readU256(balanceRes?.balance ?? balanceRes?.[0] ?? balanceRes)
          );
          const allowanceRes: any = await callContract(candidateProvider, {
            contractAddress: paymentToken,
            entrypoint: "allowance",
            calldata: [walletAddress, auctionAddress],
          });
          allowance = toU256Num(
            readU256(
              allowanceRes?.remaining ?? allowanceRes?.[0] ?? allowanceRes
            )
          );
        }
        return { ask, balance, allowance };
      };
      try {
        const { ask, balance, allowance } = await readPreflightData(readProvider);
        setPreflight({
          ask,
          balance,
          allowance,
          loading: false,
          attempted: true,
          error: null,
        });
        return { ask, balance, allowance };
      } catch (err) {
        if (connectedReadProvider && isTransientRpcError(err)) {
          try {
            const { ask, balance, allowance } =
              await readPreflightData(connectedReadProvider);
            setPreflight({
              ask,
              balance,
              allowance,
              loading: false,
              attempted: true,
              error: null,
            });
            return { ask, balance, allowance };
          } catch {
            // Surface the original project RPC error; the wallet fallback is best-effort.
          }
        }
        const msg = String((err as any)?.message ?? err ?? "");
        setPreflight({
          ask: null,
          balance: null,
          allowance: null,
          loading: false,
          attempted: true,
          error: msg,
        });
        return null;
      }
    })();
    preflightRef.current = task;
    try {
      return await task;
    } finally {
      preflightRef.current = null;
    }
  }, [
    walletAddress,
    provider,
    auctionAddress,
    fixtureState,
    decimals,
    activeConfig?.genesisPrice,
    paymentToken,
    nativePayment,
    mimicLocalTime,
    chainOk,
    evm?.provider,
  ]);

  const mintReviewOpen = mintReview != null;

  useEffect(() => {
    if (!mimicLocalTime || !mintReviewOpen) return;
    const askEstimate = currentAskEstimate;
    if (askEstimate == null || !Number.isFinite(askEstimate)) return;
    const ask = humanToU256Num(askEstimate, decimals);
    const priceLabel = formatHumanTokenAmount(askEstimate, 8);
    setMintReview((prev) => {
      if (!prev) return prev;
      const txValueLabel = prev.nativePayment ? priceLabel : "0";
      if (
        prev.ask.value === ask.value &&
        prev.priceLabel === priceLabel &&
        prev.txValueLabel === txValueLabel &&
        prev.maxPriceLabel === priceLabel
      ) {
        return prev;
      }
      return {
        ...prev,
        ask,
        priceLabel,
        txValueLabel,
        maxPriceLabel: priceLabel,
      };
    });
  }, [mimicLocalTime, mintReviewOpen, currentAskEstimate, decimals]);

  useEffect(() => {
    if (fixtureState || !auctionAddress) {
      setCurrentAskQuoteDec(null);
      return;
    }
    const quotePollActive = !mimicLocalTime && (mintReviewOpen || selectedNow);
    if (!quotePollActive) return;

    let cancelled = false;
    const tick = async () => {
      const readProvider =
        provider ?? (getDefaultProvider() as ProviderInterface);
      try {
        const ask = await readCurrentAskFromContract(readProvider, auctionAddress);
        if (!cancelled) {
          const next = toFixed(ask, decimals);
          setCurrentAskQuoteDec((prev) => (prev === next ? prev : next));
          setMintReview((prev) => {
            if (!prev) return prev;
            if (prev.ask.value === ask.value) return prev;
            const priceLabel = formatTokenAmount(ask, decimals);
            return {
              ...prev,
              ask,
              priceLabel,
              txValueLabel: prev.nativePayment ? priceLabel : "0",
              maxPriceLabel: priceLabel,
            };
          });
        }
      } catch {
        if (!cancelled) {
          setCurrentAskQuoteDec((prev) => (prev === null ? prev : null));
        }
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    fixtureState,
    auctionAddress,
    provider,
    decimals,
    selectedNow,
    mintReviewOpen,
    mimicLocalTime,
  ]);

  useEffect(() => {
    if (debugActive) return;
    if (!walletUnlocked || !chainOk || !walletAddress) return;
    void runPreflight();
  }, [debugActive, walletUnlocked, chainOk, walletAddress, runPreflight]);

  const maybeWatchAsset = async (): Promise<boolean> => {
    if (!watchAsset || !paymentToken || nativePayment) return false;
    if (watchAssetAttemptedRef.current) return false;
    watchAssetAttemptedRef.current = true;
    try {
      const symbol = resolvePaymentSymbol(paymentToken);
      return await watchAsset({
        address: paymentToken,
        symbol,
        decimals: 18,
        name: symbol === "ETH" ? "Ether" : "ERC20 Token",
      });
    } catch {
      return false;
    }
  };

  const handleWalletConnectionError = (err: unknown) => {
    const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
    const code = Number((err as any)?.code);
    if (
      code === -32002 ||
      msg.includes("already processing") ||
      msg.includes("already pending") ||
      msg.includes("request of type 'eth_requestaccounts' already pending")
    ) {
      showToast({
        kind: "warn",
        text: "Finish the pending wallet request.",
      });
      return;
    }
    if (
      msg.includes("no eip-1193 injected wallet found") ||
      msg.includes("missing vite_walletconnect_project_id") ||
      msg.includes("walletconnect v2 provider is unavailable")
    ) {
      showToast({
        kind: "error",
        text: "No supported wallet found.",
        reportState: "no_supported_wallet",
        reportError: String((err as any)?.message ?? err ?? ""),
      });
      return;
    }
    console.warn("wallet connect failed", err);
    showToast({
      kind: "error",
      text: "Wallet connection failed.",
      reportState: "connect_failed",
      reportError: String((err as any)?.message ?? err ?? ""),
    });
  };

  const connectWalletConnector = async (connector?: any) => {
    try {
      await connectAsync(connector ? ({ connector } as any) : undefined);
      setWalletPickerOpen(false);
    } catch (err) {
      handleWalletConnectionError(err);
    }
  };

  const handleConnect = async () => {
    if (availableConnectors.length > 0) {
      setMintReview(null);
      setWalletPickerOpen((open) => !open);
      return;
    }
    await connectWalletConnector();
  };

  const handleUnlock = async () => {
    if (requestAccounts) {
      const accounts = await requestAccounts();
      if (accounts?.length) setWalletUnlockAttempted(true);
    }
    await connectWalletConnector();
  };

  const handleSwitch = async () => {
    const ok = await requestChainSwitch(targetChainIdHex, evm.provider);
    if (!ok) {
      showToast({
        kind: "warn",
        text: sepoliaInviteMode && publicNetworkNotice
          ? publicNetworkNotice
          : `Switch to ${targetChainLabel} in wallet.`,
        reportState: "switch_failed",
      });
    }
  };

  const handleFixWalletRpc = async () => {
    const ok = await refreshWalletChainRpc(targetChainIdHex, evm.provider);
    showToast({
      kind: ok ? "info" : "warn",
      text: ok
        ? `${isMetaMaskWallet ? "MetaMask" : "Wallet"} Sepolia RPC refreshed. Retry.`
        : `Open ${isMetaMaskWallet ? "MetaMask" : "wallet"} Sepolia RPC settings, then retry.`,
    });
  };

  const handlePending = () => {
    const hash = effectiveTxHash ?? lastTxHash;
    if (!hash) return;
    const url = resolveExplorerTxUrl(hash);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleReturnToThought = () => {
    if (!pathMintIntent || typeof window === "undefined") return;
    window.location.assign(pathMintIntent.returnTo);
  };

  const handleRetry = async () => {
    setTxError(null);
    setTxState("idle");
    setTxPhase(null);
    setTxHash(null);
    await handleMint();
  };

  const trackSubmittedBid = (hash: string) => {
    if (!walletAddress) return;
    clearPathTokenInventoryCache();
    setCurrentAskQuoteDec(null);
    postMintNowTipPendingRef.current = true;
    postMintNowTipBaseCurveKeyRef.current = initialAskTipCurveKeyRef.current;
    void pullBidsOnce();
    void refreshCore();
    window.setTimeout(() => void pullBidsOnce(), 2_000);
    window.setTimeout(() => void pullBidsOnce(), 6_000);
    window.setTimeout(() => void refreshCore(), 2_000);
    if (pathMintIntent) {
      setReturnPromptVisible(true);
    }
    setPendingMint({
      txHash: hash,
      address: walletAddress,
      baselineTokenId: maxTokenId ?? null,
    });
  };

  const runTx = async (
    phase: TxPhase,
    call: () => Promise<any>
  ): Promise<boolean> => {
    try {
      if (txIdleTimerRef.current) {
        window.clearTimeout(txIdleTimerRef.current);
        txIdleTimerRef.current = null;
      }
      setTxPhase(phase);
      setTxState("awaiting_signature");
      setTxError(null);
      const res = await call();
      const hash =
        res?.transaction_hash ??
        res?.transactionHash ??
        res?.hash ??
        res?.tx_hash;
      if (!hash) {
        throw new Error("Missing transaction hash");
      }
      setTxHash(hash);
      setLastTxHash(hash);
      setTxState("submitted");
      showToast({ kind: "info", text: `Submitted: ${shortHash(hash)}.` });
      const waitProvider =
        provider ?? (getDefaultProvider() as ProviderInterface);
      const waiter =
        (account as any)?.waitForTransaction ??
        (waitProvider as any)?.waitForTransaction;
      if (typeof waiter === "function") {
        try {
          await waiter.call(account ?? waitProvider, hash);
        } catch (waitErr) {
          if (phase === "bid" && isTransientRpcError(waitErr)) {
            trackSubmittedBid(hash);
            showToast({
              kind: "warn",
              text: "Submitted. Confirmation check delayed.",
            });
            txIdleTimerRef.current = window.setTimeout(() => {
              setTxState("idle");
              txIdleTimerRef.current = null;
            }, 15_000);
            return true;
          }
          throw waitErr;
        }
      }
      setTxState("confirmed");
      showToast({
        kind: "info",
        text: phase === "bid" ? "Settlement confirmed. Loading sale event." : "Confirmed.",
      });
      if (phase === "bid") {
        trackSubmittedBid(hash);
      }
      txIdleTimerRef.current = window.setTimeout(() => {
        setTxState("idle");
        txIdleTimerRef.current = null;
      }, 800);
      return true;
    } catch (err) {
      const rawMsg = walletErrorMessage(err);
      const walletCancelled = isWalletCancellationError(err);
      const msg = walletCancelled ? "wallet request rejected by user." : rawMsg;
      setTxError(msg);
      setTxState("failed");
      const lower = msg.toLowerCase();
      if (lower.includes("invalid block id") || lower.includes("u256_sub overflow")) {
        void runPreflight();
      }
      if (isWalletReadOnlyRpcMessage(rawMsg) || isWalletRpcBusyMessage(rawMsg)) {
        void refreshWalletChainRpc(targetChainIdHex, evm.provider);
      }
      if (!walletCancelled) {
        console.error("mint failed", err);
      }
      return false;
    } finally {
      setTxHash(null);
      setTxPhase(null);
    }
  };

  const handleMint = async () => {
    if (debugActive) return;
    if (auctionBlocksMint) {
      showToast({ kind: "info", text: auctionBlockedMintNotice });
      return;
    }
    if (!account || !walletAddress || !auctionAddress || !paymentToken) return;
    const data = await runPreflight();
    if (!data?.ask || !data.balance || !data.allowance) return;
    if (data.balance.value < data.ask.value) {
      setMintReview(null);
      return;
    }
    if (!mintReview) {
      const askEstimate = currentAskEstimateRef.current;
      const priceLabel =
        mimicLocalTime && askEstimate != null && Number.isFinite(askEstimate)
          ? formatHumanTokenAmount(askEstimate, 8)
          : formatTokenAmount(data.ask, decimals);
      setMintReview({
        ask: data.ask,
        symbol: displayTokenSymbol,
        priceLabel,
        txValueLabel: nativePayment ? priceLabel : "0",
        maxPriceLabel: priceLabel,
        nativePayment,
        requiresApproval: !nativePayment && data.allowance.value < data.ask.value,
      });
      return;
    }

    setMintReview(null);
    setReturnPromptVisible(false);
    await refreshWalletChainRpc(targetChainIdHex, evm.provider);
    await maybeWatchAsset();
    if (!nativePayment && data.allowance.value < data.ask.value) {
      const ok = await runTx("approve", () =>
        account.execute({
          contractAddress: paymentToken,
          entrypoint: "approve",
          calldata: [auctionAddress, data.ask.raw.low, data.ask.raw.high],
        })
      );
      if (!ok) return;
    }
    const bidCall = {
      contractAddress: auctionAddress,
      entrypoint: "bid",
      calldata: [data.ask.raw.low, data.ask.raw.high],
      value: nativePayment ? data.ask.value : undefined,
    };
    await runTx("bid", () => {
      assertPulseBidIntent({
        contractAddress: bidCall.contractAddress,
        expectedContractAddress: auctionAddress,
        calldata: bidCall.calldata,
        maxPrice: data.ask,
        value: bidCall.value,
        nativePayment,
        chainId: chainIdValue,
        targetChainId,
      });
      return account.execute(bidCall);
    });
  };

  const persistentNotice = useMemo<Notice | null>(() => {
    const noticeAskLabel =
      ctaOverrideActive || noticeOverrideActive
        ? effectiveAskLabel
        : liveAskLabel ?? effectiveAskLabel;
    if (auctionBlocksMint) {
      return { kind: "info", text: auctionBlockedMintNotice };
    }
    if (effectiveTxState === "awaiting_signature") {
      const text =
        effectiveTxPhase === "approve"
          ? `Wallet open: approve ${displayTokenSymbol} (1/2).`
          : "Wallet open: confirm Pulse bid (2/2).";
      return { kind: "info", text };
    }
    if (effectiveTxState === "submitted") {
      const text =
        effectiveTxPhase === "approve"
          ? "Approval submitted (1/2)."
          : "Pulse bid pending (2/2).";
      return { kind: "info", text };
    }
    if (effectiveTxState === "failed") {
      const msg = String(effectiveTxError ?? "");
      const lower = msg.toLowerCase();
      if (lower.includes("invalid signature length")) {
        return {
          kind: "error",
          text: "Account needs upgrade or activation.",
          reportState: "invalid_signature",
          reportError: msg,
        };
      }
      if (isWalletReadOnlyRpcMessage(msg)) {
        return {
          kind: "error",
          text: "Wallet RPC is read-only. Retry.",
          reportState: "wallet_rpc_read_only",
          reportError: msg,
        };
      }
      if (isWalletCancellationMessage(msg)) {
        return { kind: "warn", text: "Wallet request cancelled." };
      }
      if (isWalletRpcBusyMessage(msg)) {
        return {
          kind: "error",
          text: isMetaMaskWallet ? "MetaMask RPC busy." : "Wallet RPC busy.",
          reportState: "wallet_rpc_busy",
          reportError: msg,
        };
      }
      if (lower.includes("failed to fetch") || lower.includes("network error")) {
        return {
          kind: "error",
          text: "RPC busy. Retry.",
          reportState: "rpc_busy",
          reportError: msg,
        };
      }
      if (
        lower.includes("invalid block id") ||
        lower.includes("tip statistics") ||
        lower.includes("starting block number") ||
        lower.includes("rpc")
      ) {
        return {
          kind: "error",
          text: "RPC read failed.",
          reportState: "rpc_read_failed",
          reportError: msg,
        };
      }
      if (lower.includes("u256_sub overflow")) {
        return {
          kind: "warn",
          text: `Insufficient ${displayTokenSymbol} at execution.`,
          reportState: "insufficient_at_execution",
          reportError: msg,
        };
      }
      return {
        kind: "error",
        text: "Mint failed.",
        reportState: "mint_failed",
        reportError: msg,
      };
    }
    if (pendingMint) {
      return { kind: "info", text: "Settlement confirmed. Loading sale event." };
    }
    if (
      pathMintIntent &&
      returnPromptVisible &&
      (effectiveTxState === "idle" || effectiveTxState === "confirmed")
    ) {
      return { kind: "info", text: "$PATH minted. Return to THOUGHT." };
    }
    if (!effectiveWalletDetected) {
      return {
        kind: "error",
        text: "No supported wallet found.",
        reportState: "no_supported_wallet",
        delayMs: DELAY_MS,
      };
    }
    if (effectiveWalletDetected && !effectiveWalletAddressPresent) {
      return null;
    }
    if (effectiveWalletNeedsUnlock) {
      return null;
    }
    if (effectiveWalletUnlocked && effectiveChainKnown && !effectiveChainOk) {
      return {
        kind: "error",
        text:
          sepoliaInviteMode && publicNetworkNotice
            ? publicNetworkNotice
            : `${targetChainLabel} only.`,
        delayMs: DELAY_MS,
      };
    }
    if (
      effectiveWalletUnlocked &&
      effectiveChainOk &&
      effectivePreflightAttempted &&
      !effectivePreflightOk &&
      preflightErrorVisible
    ) {
      return {
        kind: "error",
        text: "RPC read failed.",
        reportState: "rpc_read_failed",
        reportError: preflight.error ?? undefined,
      };
    }
    if (
      effectiveWalletUnlocked &&
      effectiveChainOk &&
      (effectivePreflightLoading || !effectivePreflightAttempted)
    ) {
      return {
        kind: "info",
        text: "Checking mint state...",
        delayMs: DELAY_MS,
      };
    }
    if (
      effectiveWalletUnlocked &&
      effectiveChainOk &&
      effectivePreflightOk &&
      !effectiveBalanceOk
    ) {
      return {
        kind: "warn",
        text: `Need ${noticeAskLabel}; have ${effectiveBalanceLabel}.`,
      };
    }
    if (
      effectiveWalletUnlocked &&
      effectiveChainOk &&
      effectivePreflightOk &&
      effectiveBalanceOk &&
      !effectiveAllowanceOk &&
      effectiveTxState === "idle"
    ) {
      return { kind: "info", text: `Approve ${displayTokenSymbol} (1/2).` };
    }
    return null;
  }, [
    ctaOverrideActive,
    noticeOverrideActive,
    effectiveTxState,
    effectiveTxPhase,
    effectiveTxError,
    effectiveWalletDetected,
    effectiveWalletUnlocked,
    effectiveWalletAddressPresent,
    effectiveWalletNeedsUnlock,
    effectiveChainKnown,
    effectiveChainOk,
    effectivePreflightOk,
    effectiveBalanceOk,
    effectiveAllowanceOk,
    effectivePreflightAttempted,
    effectivePreflightLoading,
    effectiveAskLabel,
    liveAskLabel,
    effectiveBalanceLabel,
    preflightErrorVisible,
    preflight.error,
    displayTokenSymbol,
    targetChainLabel,
    publicNetworkNotice,
    sepoliaInviteMode,
    auctionBlocksMint,
    auctionBlockedMintNotice,
    pathMintIntent,
    returnPromptVisible,
    pendingMint,
    isMetaMaskWallet,
  ]);

  useEffect(() => {
    if (persistentNoticeTimerRef.current) {
      window.clearTimeout(persistentNoticeTimerRef.current);
      persistentNoticeTimerRef.current = null;
    }
    if (!persistentNotice) {
      setPersistentNoticeVisible(null);
      return;
    }
    const delay = persistentNotice.delayMs ?? 0;
    if (delay === 0) {
      setPersistentNoticeVisible(persistentNotice);
      return;
    }
    setPersistentNoticeVisible(null);
    persistentNoticeTimerRef.current = window.setTimeout(() => {
      setPersistentNoticeVisible(persistentNotice);
      persistentNoticeTimerRef.current = null;
    }, delay);
    return () => {
      if (persistentNoticeTimerRef.current) {
        window.clearTimeout(persistentNoticeTimerRef.current);
        persistentNoticeTimerRef.current = null;
      }
    };
  }, [persistentNotice]);

  const displayNotice =
    toastNotice ??
    persistentNoticeVisible ??
    (publicNetworkNotice ? { kind: "info" as const, text: publicNetworkNotice } : null);
  const displayWalletRpcFix =
    displayNotice?.reportState === "wallet_rpc_busy" &&
    effectiveWalletUnlocked &&
    effectiveChainOk;
  const displayNoticeReportLink =
    reportBugEnabled && displayNotice?.reportState
      ? buildReportBugLink({
          page: "/",
          surface: "path",
          network: targetChainLabel,
          chainId: targetChainId?.toString() ?? null,
          wallet: reportWalletName,
          state: displayNotice.reportState,
          address: walletAddress,
          lastTx: effectiveLastTxHash,
          error: displayNotice.reportError ?? displayNotice.text,
        })
      : null;
  const dotState =
    effectiveTxState === "awaiting_signature" || effectiveTxState === "submitted"
      ? "amber"
      : effectiveTxState === "failed"
      ? "error"
      : effectiveWalletUnlocked &&
        effectiveChainOk &&
        effectivePreflightOk &&
        effectiveBalanceOk
      ? "on"
      : effectiveWalletUnlocked && effectiveChainKnown && !effectiveChainOk
      ? "error"
      : effectivePreflightOk && !effectiveBalanceOk
      ? "error"
      : "off";

  const ctaState = (() => {
    if (effectiveWalletUnlocked && effectiveChainKnown && !effectiveChainOk) {
      return { label: "switch", disabled: false, onClick: handleSwitch };
    }
    if (effectiveWalletNeedsUnlock) {
      return { label: "connect", disabled: false, onClick: handleUnlock };
    }
    if (effectiveWalletDetected && !effectiveWalletAddressPresent) {
      return { label: "connect", disabled: false, onClick: handleConnect };
    }
    if (!effectiveWalletDetected) {
      return { label: "connect", disabled: false, onClick: handleConnect };
    }
    if (auctionBlocksMint) {
      return { label: "mint", disabled: true, onClick: handleMint };
    }
    if (effectiveTxState === "submitted") {
      return { label: "pending", disabled: false, onClick: handlePending };
    }
    if (effectiveTxState === "awaiting_signature") {
      return { label: "pending", disabled: true, onClick: () => {} };
    }
    if (effectiveTxState === "failed") {
      return { label: "retry", disabled: false, onClick: handleRetry };
    }
    if (
      pathMintIntent &&
      returnPromptVisible &&
      (effectiveTxState === "idle" || effectiveTxState === "confirmed")
    ) {
      return {
        label: "return",
        disabled: false,
        onClick: handleReturnToThought,
      };
    }
    if (
      mintReview &&
      effectiveWalletUnlocked &&
      effectiveChainOk &&
      effectivePreflightOk &&
      effectiveBalanceOk
    ) {
      return { label: "confirm", disabled: false, onClick: handleMint };
    }
    if (effectiveWalletUnlocked && effectiveChainOk && effectivePreflightOk) {
      return {
        label: "mint",
        disabled: !effectiveBalanceOk,
        onClick: handleMint,
      };
    }
    return { label: "mint", disabled: true, onClick: handleMint };
  })();
  const ctaDelayMs =
    ctaState.label === "connect" ||
    ctaState.label === "switch"
      ? DELAY_MS
      : 0;
  useEffect(() => {
    const nextKey = `${ctaState.label}:${ctaState.disabled ? "1" : "0"}`;
    if (ctaDisplayKeyRef.current === nextKey && ctaDisplay) return;
    if (ctaTimerRef.current) {
      window.clearTimeout(ctaTimerRef.current);
      ctaTimerRef.current = null;
    }
    if (!ctaDisplay || ctaDelayMs === 0) {
      ctaDisplayKeyRef.current = nextKey;
      setCtaDisplay(ctaState);
      return;
    }
    ctaTimerRef.current = window.setTimeout(() => {
      ctaDisplayKeyRef.current = nextKey;
      setCtaDisplay(ctaState);
      ctaTimerRef.current = null;
    }, ctaDelayMs);
    return () => {
      if (ctaTimerRef.current) {
        window.clearTimeout(ctaTimerRef.current);
        ctaTimerRef.current = null;
      }
    };
  }, [ctaState, ctaDelayMs, ctaDisplay]);
  const resetDebug = () => setDebugOverride(debugDefaults);

  const segmentStarts = useMemo(() => {
    return linkedStatic.segments.map((seg) => seg.uStart);
  }, [linkedStatic.segments]);

  const bidMarks = useMemo(() => {
    if (!linkedStatic.segments.length) return [];
    return linkedStatic.segments.flatMap((seg) => {
      const bid = seg.bid;
      if (!bid) return [];
      let amountDec = "";
      try {
        amountDec = toFixed(bid.amount, decimals);
      } catch {
        amountDec = String(bid.amount?.dec ?? "");
      }
      const amountHuman = toNumberSafe(amountDec);
      const tokenId =
        typeof bid.tokenId === "number"
          ? bid.tokenId
          : typeof bid.epochIndex === "number"
          ? bid.epochIndex
          : typeof bid.id === "number"
          ? bid.id
          : undefined;
      return [{
        key: bid.key,
        epoch: seg.epoch,
        segIdx: seg.idx,
        u: seg.uStart + Math.max(seg.uLen, 0),
        price: Number.isFinite(amountHuman) ? amountHuman : seg.floor,
        amountDec,
        bidder: bid.bidder,
        atMs: bid.atMs,
        block: bid.blockNumber,
        tokenId,
        txHash: bid.txHash,
      }];
    });
  }, [linkedStatic.segments, decimals]);

  const askMarks = useMemo(() => {
    if (!linkedStatic.segments.length) return [];
    const marks: AskMark[] = linkedStatic.segments.map((seg) => ({
      key: `ask#${seg.idx}`,
      kind: "ask",
      epoch: seg.epoch,
      segIdx: seg.idx,
      u: seg.uStart,
      price: seg.ask,
    }));
    const first = linkedStatic.segments[0];
    if (first) {
      marks.unshift({
        key: `opening-floor#${first.idx}`,
        kind: "opening-floor",
        epoch: first.epoch,
        segIdx: first.idx,
        u: first.uStart,
        price: first.floor,
      });
    }
    return marks;
  }, [linkedStatic.segments]);

  const selectedBid = useMemo(() => {
    if (!selectedBidKey) return null;
    return bidMarks.find((mark) => mark.key === selectedBidKey) ?? null;
  }, [bidMarks, selectedBidKey]);

  const selectedAsk = useMemo(() => {
    if (!selectedAskKey) return null;
    return askMarks.find((mark) => mark.key === selectedAskKey) ?? null;
  }, [askMarks, selectedAskKey]);

  useEffect(() => {
    if (!selectedBidKey) return;
    if (selectedBid) return;
    setSelectedBidKey(null);
  }, [selectedBidKey, selectedBid]);

  useEffect(() => {
    if (!selectedAskKey) return;
    if (selectedAsk) return;
    setSelectedAskKey(null);
  }, [selectedAskKey, selectedAsk]);

  const initialAskTipCurveKey = useMemo(() => {
    if (!showCurvePlot || !linked.segments.length) return null;
    const first = linked.segments[0];
    const last = linked.segments[linked.segments.length - 1];
    const firstBidKey = linked.segments.find((seg) => seg.bid)?.bid?.key ?? "none";
    const lastBidKey =
      [...linked.segments].reverse().find((seg) => seg.bid)?.bid?.key ?? "none";
    return `${linked.segments.length}:${firstBidKey}:${lastBidKey}:${first.startSec}:${last.startSec}`;
  }, [showCurvePlot, linked.segments]);

  useEffect(() => {
    if (!initialAskTipCurveKey) {
      initialAskTipCurveKeyRef.current = null;
      initialAskTipShownRef.current = false;
      return;
    }
    if (initialAskTipCurveKeyRef.current === initialAskTipCurveKey) return;
    initialAskTipCurveKeyRef.current = initialAskTipCurveKey;
    initialAskTipShownRef.current = false;
  }, [initialAskTipCurveKey]);

  const showNowCurveHover = useCallback(
    (clientX?: number, clientY?: number): boolean => {
      if (!showCurvePlot) return false;
      if (!effectiveViewport) return false;
      if (!linked.segments.length) return false;
      if (linked.nowU == null || linked.nowPrice == null) return false;
      if (!Number.isFinite(linked.nowU) || !Number.isFinite(linked.nowPrice)) return false;

      const vp = effectiveViewport;
      if (linked.nowU < vp.xMin || linked.nowU > vp.xMax) return false;
      const xRange = vp.xMax - vp.xMin || 1;
      const yRange = vp.yMax - vp.yMin || 1;
      const xSvg = PLOT_LEFT_PAD + ((linked.nowU - vp.xMin) / xRange) * PLOT_X_SPAN;
      const ySvg = 60 - ((linked.nowPrice - vp.yMin) / yRange) * 60;
      if (!Number.isFinite(xSvg) || !Number.isFinite(ySvg)) return false;

      let idx = Math.max(0, upperBound(segmentStarts, linked.nowU) - 1);
      idx = Math.min(idx, linked.segments.length - 1);
      while (idx < linked.segments.length - 1) {
        const seg = linked.segments[idx];
        if (linked.nowU <= seg.uStart + seg.uLen + 1e-9) break;
        idx += 1;
      }
      const seg = linked.segments[idx];
      if (!seg) return false;

      const quotedPrice =
        !mimicLocalTime && effectiveCurrentAskQuoteDec != null
          ? Number(effectiveCurrentAskQuoteDec)
          : Number.NaN;
      let liveDurationSec = Math.max(0, liveNowSec - seg.startSec);
      let liveULocal = liveDurationSec / Math.max(seg.tHalf, 1e-9);
      let livePrice = priceAtU(seg.floor, seg.premium, liveULocal);
      let quoteAccepted = false;
      if (Number.isFinite(quotedPrice)) {
        const quotedU = quotedUForLiveSegment(seg, quotedPrice, liveNowSec);
        if (quotedU != null) {
          liveULocal = quotedU;
          liveDurationSec = quotedU * seg.tHalf;
          livePrice = quotedPrice;
          quoteAccepted = true;
        }
      }
      const amountStr = Number.isFinite(livePrice) ? livePrice.toFixed(2) : "";
      const amountRaw =
        quoteAccepted && effectiveCurrentAskQuoteDec != null
          ? effectiveCurrentAskQuoteDec
          : String(livePrice);

      let screenX = 16;
      let screenY = 16;
      if (typeof clientX === "number" && typeof clientY === "number") {
        screenX = clientX + 8;
        screenY = clientY + 8;
      } else {
        const rect = canvasRef.current?.getBoundingClientRect();
        screenX =
          rect && rect.width > 0
            ? rect.left + (xSvg / 100) * rect.width + 8
            : 16;
        screenY =
          rect && rect.height > 0
            ? rect.top + (ySvg / 60) * rect.height + 8
            : 16;
      }

      setHover({
        key: "now",
        x: xSvg,
        y: ySvg,
        screenX,
        screenY,
        amount: amountStr,
        amountDec: amountStr,
        amountRaw,
        atMs: (seg.startSec + liveDurationSec) * 1000,
        epoch: seg.epoch,
        lastSec: seg.startSec,
        anchor: seg.anchor,
        kHuman: seg.kHuman,
        floorHuman: seg.floor,
        premiumHuman: seg.premium,
        durationSec: liveDurationSec,
        metaDtSec: liveDurationSec,
        beforeNowSec: 0,
        hoverSetSec: liveNowSec,
        tHalf: seg.tHalf,
        uLocal: liveULocal,
        uGlobal: seg.uStart + liveULocal,
        dtPrevSec: seg.dtPrevSec,
        dtNextSec: seg.dtNextSec,
        liveNow: true,
      });
      return true;
    },
    [
      showCurvePlot,
      effectiveViewport,
      linked.segments,
      linked.nowU,
      linked.nowPrice,
      segmentStarts,
      liveNowSec,
      effectiveCurrentAskQuoteDec,
      mimicLocalTime,
    ]
  );

  useEffect(() => {
    setHover((prev) => {
      if (!prev || prev.key !== "now" || !(prev as any).liveNow) {
        return prev;
      }
      const startSec = Number(prev.lastSec);
      const tHalf = Number(prev.tHalf);
      const floor = Number(prev.floorHuman);
      const premium = Number(prev.premiumHuman);
      if (
        !Number.isFinite(startSec) ||
        !Number.isFinite(tHalf) ||
        tHalf <= 0 ||
        !Number.isFinite(floor) ||
        !Number.isFinite(premium)
      ) {
        return prev;
      }

      const quotedPrice =
        !mimicLocalTime && effectiveCurrentAskQuoteDec != null
          ? Number(effectiveCurrentAskQuoteDec)
          : Number.NaN;
      let durationSec = Math.max(0, liveNowSec - startSec);
      let uLocal = durationSec / tHalf;
      let price = priceAtU(floor, premium, uLocal);
      let quoteAccepted = false;
      if (Number.isFinite(quotedPrice)) {
        const quotedU = quotedUForLiveSegment(
          { floor, premium, startSec, tHalf },
          quotedPrice,
          liveNowSec
        );
        if (quotedU != null) {
          uLocal = quotedU;
          durationSec = quotedU * tHalf;
          price = quotedPrice;
          quoteAccepted = true;
        }
      }
      if (!Number.isFinite(price)) return prev;

      const prevULocal = Number(prev.uLocal);
      const prevUGlobal = Number(prev.uGlobal);
      const uBase =
        Number.isFinite(prevULocal) && Number.isFinite(prevUGlobal)
          ? prevUGlobal - prevULocal
          : 0;
      const amountStr = price.toFixed(2);
      const amountRaw =
        quoteAccepted && effectiveCurrentAskQuoteDec != null
          ? effectiveCurrentAskQuoteDec
          : String(price);

      return {
        ...prev,
        amount: amountStr,
        amountDec: amountStr,
        amountRaw,
        atMs: (startSec + durationSec) * 1000,
        durationSec,
        metaDtSec: durationSec,
        beforeNowSec: 0,
        hoverSetSec: liveNowSec,
        uLocal,
        uGlobal: uBase + uLocal,
      };
    });
  }, [liveNowSec, effectiveCurrentAskQuoteDec, mimicLocalTime]);

  useEffect(() => {
    if (selectedBidKey || selectedAskKey || selectedNow) return;
    if (hover) return;
    if (isPanning || panRef.current.active) return;
    if (initialAskTipShownRef.current) return;
    if (!showNowCurveHover()) return;
    initialAskTipShownRef.current = true;
  }, [
    selectedBidKey,
    selectedAskKey,
    selectedNow,
    hover,
    isPanning,
    showNowCurveHover,
  ]);

  useEffect(() => {
    if (!postMintNowTipPendingRef.current) return;
    if (!initialAskTipCurveKey) return;
    if (postMintNowTipBaseCurveKeyRef.current === initialAskTipCurveKey) return;
    if (isPanning || panRef.current.active) return;

    pinnedDotRef.current = false;
    setSelectedBidKey(null);
    setSelectedAskKey(null);
    setSelectedNow(false);
    if (!showNowCurveHover()) return;

    postMintNowTipPendingRef.current = false;
    postMintNowTipBaseCurveKeyRef.current = null;
    initialAskTipShownRef.current = true;
  }, [initialAskTipCurveKey, isPanning, showNowCurveHover]);

  useEffect(() => {
    if (!selectedNow) return;
    if (!showCurvePlot) return;
    if (!effectiveViewport) return;
    if (isPanning || panRef.current.active) return;
    if (linked.nowU == null || !Number.isFinite(linked.nowU)) return;

    const targetNowU = linked.nowU;
    setViewport((prev) => {
      const base = prev ?? effectiveViewport;
      const xRange = base.xMax - base.xMin;
      if (!Number.isFinite(xRange) || xRange <= 0) return prev;
      const eps = 1e-6;
      if (targetNowU >= base.xMin - eps && targetNowU <= base.xMax + eps) {
        return prev;
      }

      const xEnd = Math.max(Number.EPSILON, linked.uEnd);
      let nextMax = clamp(targetNowU, 0, xEnd);
      let nextMin = nextMax - xRange;
      if (nextMin < 0) {
        nextMin = 0;
        nextMax = Math.min(xEnd, nextMin + xRange);
      }
      if (
        Math.abs(nextMin - base.xMin) < eps &&
        Math.abs(nextMax - base.xMax) < eps
      ) {
        return prev;
      }
      return { ...base, xMin: nextMin, xMax: nextMax };
    });
  }, [
    selectedNow,
    showCurvePlot,
    effectiveViewport,
    linked.nowU,
    linked.uEnd,
    isPanning,
  ]);

  const getSvgLoc = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null as { x: number; y: number } | null;
    try {
      const ctm = svg.getScreenCTM?.();
      if (ctm && typeof (svg as any).createSVGPoint === "function") {
        const pt = (svg as any).createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const loc = pt.matrixTransform(ctm.inverse());
        return { x: clamp(loc.x, 0, 100), y: clamp(loc.y, 0, 60) };
      }
    } catch {
      /* ignore */
    }
    const rect = svg.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) {
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 60;
      return { x: clamp(x, 0, 100), y: clamp(y, 0, 60) };
    }
    return { x: 0, y: 0 };
  };

  const clampXWindow = useCallback((xMin: number, xMax: number, xRange: number) => {
    const xEnd = Math.max(Number.EPSILON, linked.uEnd);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xRange <= 0) {
      return { xMin: 0, xMax: xEnd };
    }
    let nextMin = xMin;
    let nextMax = xMax;
    if (nextMin < 0) {
      nextMin = 0;
      nextMax = nextMin + xRange;
    }
    if (nextMax > xEnd) {
      nextMax = xEnd;
      nextMin = Math.max(0, nextMax - xRange);
    }
    return { xMin: nextMin, xMax: nextMax };
  }, [linked.uEnd]);

  const handleCanvasWheel = (event: any) => {
    if (!showCurvePlot) return;
    if (!effectiveViewport) return;
    event.preventDefault?.();
    const xRange = effectiveViewport.xMax - effectiveViewport.xMin;
    if (!Number.isFinite(xRange) || xRange <= 0) return;
    const delta = clamp(event.deltaY ?? 0, -120, 120);
    const scale = Math.exp(delta * 0.01);
    const nextRange = clamp(
      xRange * scale,
      0.5,
      Math.max(0.5, linked.uEnd)
    );

    const pinnedFocusU =
      selectedBid?.u ??
      selectedAsk?.u ??
      (selectedNow && linked.nowU != null && Number.isFinite(linked.nowU)
        ? linked.nowU
        : null);
    if (pinnedFocusU != null) {
      // Keep zoom anchored to the selected dot even if it is outside viewport.
      const xN =
        (pinnedFocusU - effectiveViewport.xMin) / Math.max(xRange, 1e-9);
      const nextMin = pinnedFocusU - xN * nextRange;
      const nextMax = nextMin + nextRange;
      const clamped = clampXWindow(nextMin, nextMax, nextRange);
      viewportUserLockedRef.current = true;
      setViewportUserLocked(true);
      setViewport((prev) => ({
        ...(prev ?? effectiveViewport),
        xMin: clamped.xMin,
        xMax: clamped.xMax,
      }));
      return;
    }

    const loc = getSvgLoc(event.clientX, event.clientY);
    if (!loc) return;
    const xN = clamp((loc.x - PLOT_LEFT_PAD) / Math.max(PLOT_X_SPAN, 1e-9), 0, 1);
    const focusX = effectiveViewport.xMin + xN * xRange;
    const nextMin = focusX - xN * nextRange;
    const nextMax = nextMin + nextRange;
    const clamped = clampXWindow(nextMin, nextMax, nextRange);
    viewportUserLockedRef.current = true;
    setViewportUserLocked(true);
    setViewport((prev) => ({
      ...(prev ?? effectiveViewport),
      xMin: clamped.xMin,
      xMax: clamped.xMax,
    }));
  };

  const handleCanvasPointerDown = (event: any) => {
    if (!showCurvePlot) return;
    if (!effectiveViewport) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const loc = getSvgLoc(event.clientX, event.clientY);
    if (!loc) return;
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    panRef.current.active = true;
    panRef.current.pointerId = event.pointerId ?? null;
    panRef.current.startSvgX = loc.x;
    panRef.current.startSvgY = loc.y;
    panRef.current.startClientX =
      typeof event.clientX === "number" ? event.clientX : 0;
    panRef.current.startClientY =
      typeof event.clientY === "number" ? event.clientY : 0;
    panRef.current.moved = false;
    panRef.current.startViewport = effectiveViewport;
    setIsPanning(true);
    if (pinnedDotRef.current) {
      clearPinnedDot();
    } else {
      setHover(null);
    }
  };

  const handleCanvasPointerMove = useCallback((event: any) => {
    if (!panRef.current.active) return;
    if (panRef.current.pointerId != null && event.pointerId != null) {
      if (panRef.current.pointerId !== event.pointerId) return;
    }
    const startVp = panRef.current.startViewport;
    if (!startVp) return;
    const loc = getSvgLoc(event.clientX, event.clientY);
    if (!loc) return;
    const dxClient = Math.abs((event.clientX ?? 0) - panRef.current.startClientX);
    const dyClient = Math.abs((event.clientY ?? 0) - panRef.current.startClientY);
    if (!panRef.current.moved && dxClient + dyClient < 3) {
      return;
    }
    const dragStarted = !panRef.current.moved;
    panRef.current.moved = true;
    if (dragStarted && pinnedDotRef.current) {
      clearPinnedDot();
    }
    viewportUserLockedRef.current = true;
    setViewportUserLocked(true);
    const xRange = startVp.xMax - startVp.xMin;
    if (!Number.isFinite(xRange) || xRange <= 0) return;
    const dxSvg = loc.x - panRef.current.startSvgX;
    const dxData = (dxSvg / 100) * xRange;
    const nextMin = startVp.xMin - dxData;
    const nextMax = startVp.xMax - dxData;
    const clamped = clampXWindow(nextMin, nextMax, xRange);
    setViewport((prev) => ({
      ...(prev ?? startVp),
      xMin: clamped.xMin,
      xMax: clamped.xMax,
    }));
  }, [clampXWindow, clearPinnedDot]);

  const pickPointAtClient = useCallback(
    (
      clientX: number,
      clientY: number,
      threshold = 2
    ): { kind: "sale" | "ask" | "floor"; key: string } | null => {
      if (!showCurvePlot || !effectiveViewport) return null;
      const loc = getSvgLoc(clientX, clientY);
      if (!loc) return null;
      const vp = effectiveViewport;
      const xRange = vp.xMax - vp.xMin || 1;
      const yRange = vp.yMax - vp.yMin || 1;
      const toSvgX = (x: number) =>
        PLOT_LEFT_PAD + ((x - vp.xMin) / xRange) * PLOT_X_SPAN;
      const toSvgY = (y: number) => 60 - ((y - vp.yMin) / yRange) * 60;
      let best: { kind: "sale" | "ask" | "floor"; key: string } | null = null;
      let bestD2 = threshold * threshold;
      for (const mark of bidMarks) {
        const bx = toSvgX(mark.u);
        const by = toSvgY(mark.price);
        const dx = bx - loc.x;
        const dy = by - loc.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = { kind: "sale", key: mark.key };
        }
      }
      for (const mark of askMarks) {
        const bx = toSvgX(mark.u);
        const by = toSvgY(mark.price);
        const dx = bx - loc.x;
        const dy = by - loc.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = {
            kind: mark.kind === "opening-floor" ? "floor" : "ask",
            key: mark.key,
          };
        }
      }
      return best;
    },
    [showCurvePlot, effectiveViewport, bidMarks, askMarks]
  );

  const endPan = useCallback((event: any) => {
    const wasActive = panRef.current.active;
    const wasMoved = panRef.current.moved;
    if (!wasActive) return;
    panRef.current.active = false;
    panRef.current.pointerId = null;
    panRef.current.startClientX = 0;
    panRef.current.startClientY = 0;
    panRef.current.moved = false;
    panRef.current.startViewport = null;
    setIsPanning(false);
    try {
      event.currentTarget?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    if (!wasMoved && typeof event.clientX === "number" && typeof event.clientY === "number") {
      const point = pickPointAtClient(event.clientX, event.clientY, 2.2);
      if (point?.kind === "sale") {
        pinBidDot(point.key);
      } else if (point?.kind === "ask" || point?.kind === "floor") {
        pinAskDot(point.key);
      } else {
        clearPinnedDot();
      }
    }
  }, [clearPinnedDot, pickPointAtClient, pinAskDot, pinBidDot]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (event: PointerEvent) => handleCanvasPointerMove(event as any);
    const onEnd = (event: PointerEvent) => endPan(event as any);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [isPanning, handleCanvasPointerMove, endPan]);

  const screenFromSvgPoint = useCallback(
    (x: number, y: number, clientX?: number, clientY?: number) => {
      if (typeof clientX === "number" && typeof clientY === "number") {
        return { screenX: clientX + 8, screenY: clientY + 8 };
      }
      const rect = canvasRef.current?.getBoundingClientRect();
      return {
        screenX:
          rect && rect.width > 0 ? rect.left + (x / 100) * rect.width + 8 : 16,
        screenY:
          rect && rect.height > 0 ? rect.top + (y / 60) * rect.height + 8 : 16,
      };
    },
    []
  );

  const showStartAskHover = useCallback((
    seg: LinkedSegment,
    x: number,
    y: number,
    clientX?: number,
    clientY?: number
  ) => {
    const tau = 0;
    const atMs = seg.startSec * 1000;
    const metaDt = Math.max(0, nowSec - seg.startSec);
    const beforeNow = Math.max(0, metaDt - tau);
    const amountStr = Number.isFinite(seg.ask) ? seg.ask.toFixed(2) : "";
    const { screenX, screenY } = screenFromSvgPoint(x, y, clientX, clientY);
    setHover({
      key: "ask",
      x,
      y,
      screenX,
      screenY,
      amount: amountStr,
      amountDec: amountStr,
      amountRaw: String(seg.ask),
      atMs,
      epoch: seg.epoch,
      lastSec: seg.startSec,
      anchor: seg.anchor,
      kHuman: seg.kHuman,
      floorHuman: seg.floor,
      premiumHuman: seg.premium,
      durationSec: tau,
      metaDtSec: metaDt,
      beforeNowSec: beforeNow,
      hoverSetSec: Date.now() / 1000,
      tHalf: seg.tHalf,
      uLocal: 0,
      uGlobal: seg.uStart,
      dtPrevSec: seg.dtPrevSec,
      dtNextSec: seg.dtNextSec,
    });
  }, [nowSec, screenFromSvgPoint]);

  const showOpeningFloorHover = useCallback((
    seg: LinkedSegment,
    x: number,
    y: number,
    clientX?: number,
    clientY?: number
  ) => {
    const tau = 0;
    const atMs = seg.startSec * 1000;
    const metaDt = Math.max(0, nowSec - seg.startSec);
    const beforeNow = Math.max(0, metaDt - tau);
    const amountStr = Number.isFinite(seg.floor) ? seg.floor.toFixed(2) : "";
    const { screenX, screenY } = screenFromSvgPoint(x, y, clientX, clientY);
    setHover({
      key: "opening-floor",
      x,
      y,
      screenX,
      screenY,
      amount: amountStr,
      amountDec: amountStr,
      amountRaw: String(seg.floor),
      atMs,
      epoch: seg.epoch,
      lastSec: seg.startSec,
      anchor: seg.anchor,
      kHuman: seg.kHuman,
      floorHuman: seg.floor,
      premiumHuman: seg.premium,
      durationSec: tau,
      metaDtSec: metaDt,
      beforeNowSec: beforeNow,
      hoverSetSec: Date.now() / 1000,
      tHalf: seg.tHalf,
      uLocal: 0,
      uGlobal: seg.uStart,
      dtPrevSec: seg.dtPrevSec,
      dtNextSec: seg.dtNextSec,
    });
  }, [nowSec, screenFromSvgPoint]);

  const handleSvgMouseMove = (event: any) => {
    if (!showCurvePlot) return;
    if (!effectiveViewport) return;
    if (panRef.current.active) return;
    if (pinnedDotRef.current) return;
    const loc = getSvgLoc(event.clientX, event.clientY);
    if (!loc) return;

    const vp = effectiveViewport;
    const xRange = vp.xMax - vp.xMin || 1;
    const yRange = vp.yMax - vp.yMin || 1;
    const toSvgX = (x: number) =>
      PLOT_LEFT_PAD + ((x - vp.xMin) / xRange) * PLOT_X_SPAN;
    const toSvgY = (y: number) => 60 - ((y - vp.yMin) / yRange) * 60;
    const toDataX = (xSvg: number) => {
      const xClamped = clamp(xSvg, PLOT_LEFT_PAD, 100 - PLOT_RIGHT_PAD);
      return vp.xMin + ((xClamped - PLOT_LEFT_PAD) / PLOT_X_SPAN) * xRange;
    };

    const threshold = 1.2;
    let best: any = null;
    let bestD2 = threshold * threshold;
    for (const mark of bidMarks) {
      if (mark.u < vp.xMin - xRange * 0.02) continue;
      if (mark.u > vp.xMax + xRange * 0.02) continue;
      const bx = toSvgX(mark.u);
      const by = toSvgY(mark.price);
      const dx = bx - loc.x;
      const dy = by - loc.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = { mark, bx, by };
      }
    }

    const startAskXThreshold = 2.2;
    const startAskYThreshold = 2.2;
    let bestStartAsk: { seg: LinkedSegment; x: number; y: number } | null = null;
    let bestStartAskD2 = Number.POSITIVE_INFINITY;
    let bestStartAskScore = Number.POSITIVE_INFINITY;
    for (const seg of linked.segments) {
      const xStart = toSvgX(seg.uStart);
      if (xStart < -2 || xStart > 102) continue;
      const yAsk = toSvgY(seg.ask);
      const dx = Math.abs(xStart - loc.x);
      const dy = Math.abs(yAsk - loc.y);
      if (dx > startAskXThreshold || dy > startAskYThreshold) continue;
      const nx = dx / startAskXThreshold;
      const ny = dy / startAskYThreshold;
      const score = nx * nx + ny * ny;
      if (score <= bestStartAskScore) {
        bestStartAskD2 = dx * dx + dy * dy;
        bestStartAskScore = score;
        bestStartAsk = { seg, x: xStart, y: yAsk };
      }
    }
    let bestOpeningFloor: { seg: LinkedSegment; x: number; y: number } | null = null;
    let bestOpeningFloorD2 = Number.POSITIVE_INFINITY;
    let bestOpeningFloorScore = Number.POSITIVE_INFINITY;
    const firstSeg = linked.segments[0];
    if (firstSeg) {
      const xFloor = toSvgX(firstSeg.uStart);
      const yFloor = toSvgY(firstSeg.floor);
      const dx = Math.abs(xFloor - loc.x);
      const dy = Math.abs(yFloor - loc.y);
      if (dx <= startAskXThreshold && dy <= startAskYThreshold) {
        const nx = dx / startAskXThreshold;
        const ny = dy / startAskYThreshold;
        const score = nx * nx + ny * ny;
        bestOpeningFloorD2 = dx * dx + dy * dy;
        bestOpeningFloorScore = score;
        bestOpeningFloor = { seg: firstSeg, x: xFloor, y: yFloor };
      }
    }
    if (best) {
      const seg = linked.segments[best.mark.segIdx];
      setHover({
        key: `bid#${best.mark.epoch}`,
        x: best.bx,
        y: best.by,
        screenX: event.clientX + 8,
        screenY: event.clientY + 8,
        bidder: best.mark.bidder,
        amount: best.mark.amountDec,
        amountDec: best.mark.amountDec,
        amountRaw: best.mark.amountDec,
        txHash: best.mark.txHash,
        atMs: best.mark.atMs,
        block: best.mark.block,
        epoch: best.mark.epoch,
        tokenId: best.mark.tokenId,
        floorHuman: seg?.floor,
        premiumHuman: seg?.premium,
        ptsHuman: seg?.ptsHuman,
        tHalf: seg?.tHalf,
        anchor: seg?.anchor,
        kHuman: seg?.kHuman,
        uGlobal: best.mark.u,
        dtPrevSec: seg?.dtPrevSec,
        dtNextSec: seg?.dtNextSec ?? null,
      });
      return;
    }

    for (const seg of linked.segments) {
      const xLine = toSvgX(seg.uStart);
      if (Math.abs(xLine - loc.x) > 0.8) continue;
      const yAsk = toSvgY(seg.ask);
      const yFloor = toSvgY(seg.floor);
      const yMin = Math.min(yAsk, yFloor);
      const yMax = Math.max(yAsk, yFloor);
      if (loc.y < yMin || loc.y > yMax) continue;
      const prevSeg = seg.idx > 0 ? linked.segments[seg.idx - 1] : null;
      const bLastHuman = prevSeg?.floor;
      const bCurrentHuman = seg.floor;
      const floorMoveCurrentHuman =
        prevSeg && Number.isFinite(prevSeg.floor) && Number.isFinite(seg.floor)
          ? Math.max(0, seg.floor - prevSeg.floor)
          : undefined;
      setHover({
        key: "premium",
        x: xLine,
        y: (yAsk + yFloor) / 2,
        screenX: event.clientX + 8,
        screenY: event.clientY + 8,
        amount: seg.premium.toFixed(2),
        amountDec: seg.premium.toFixed(2),
        amountRaw: seg.premium.toString(),
        durationSec: seg.dtPrevSec,
        ptsHuman: seg.ptsHuman,
        epoch: seg.epoch,
        atMs: seg.startSec * 1000,
        bLastHuman,
        bCurrentHuman,
        floorMoveCurrentHuman,
      });
      return;
    }
    if (
      bestStartAsk &&
      (!bestOpeningFloor || bestStartAskScore <= bestOpeningFloorScore + 1e-9) &&
      (!best || bestStartAskD2 <= bestD2 + 1e-9)
    ) {
      showStartAskHover(
        bestStartAsk.seg,
        bestStartAsk.x,
        bestStartAsk.y,
        event.clientX,
        event.clientY
      );
      return;
    }
    if (bestOpeningFloor && (!best || bestOpeningFloorD2 <= bestD2 + 1e-9)) {
      showOpeningFloorHover(
        bestOpeningFloor.seg,
        bestOpeningFloor.x,
        bestOpeningFloor.y,
        event.clientX,
        event.clientY
      );
      return;
    }

    const xData = toDataX(loc.x);
    let idx = Math.max(0, upperBound(segmentStarts, xData) - 1);
    idx = Math.min(idx, Math.max(0, linked.segments.length - 1));
    while (idx < linked.segments.length - 1) {
      const seg = linked.segments[idx];
      if (xData <= seg.uStart + seg.uLen + 1e-9) break;
      idx += 1;
    }
    const seg = linked.segments[idx];
    const uLocal = clamp(xData - seg.uStart, 0, Math.max(0, seg.uLen));
    const yAt = priceAtU(seg.floor, seg.premium, uLocal);
    const yCurve = toSvgY(yAt);
    const curveHoverThreshold = 1.2;
    const isCurveTarget =
      Boolean((event as any)?.target?.classList?.contains?.("dotfield__curve"));
    if (!isCurveTarget && Math.abs(yCurve - loc.y) > curveHoverThreshold) {
      setHover(null);
      return;
    }
    const tau = uLocal * seg.tHalf;
    const atMs = (seg.startSec + tau) * 1000;
    const metaDt = Math.max(0, nowSec - seg.startSec);
    const beforeNow = Math.max(0, metaDt - tau);
    const amountStr = Number.isFinite(yAt) ? yAt.toFixed(2) : "";
    setHover({
      key: "curve-point",
      x: loc.x,
      y: yCurve,
      screenX: event.clientX + 8,
      screenY: event.clientY + 8,
      amount: amountStr,
      amountDec: amountStr,
      amountRaw: String(yAt),
      atMs,
      epoch: seg.epoch,
      lastSec: seg.startSec,
      anchor: seg.anchor,
      kHuman: seg.kHuman,
      floorHuman: seg.floor,
      premiumHuman: seg.premium,
      durationSec: tau,
      metaDtSec: metaDt,
      beforeNowSec: beforeNow,
      hoverSetSec: Date.now() / 1000,
      tHalf: seg.tHalf,
      uLocal,
      uGlobal: seg.uStart + uLocal,
      dtPrevSec: seg.dtPrevSec,
      dtNextSec: seg.dtNextSec,
    });
  };

  const handleSvgClick = (event: any) => {
    if (!showCurvePlot) return;
    if (!effectiveViewport) return;
    if (panRef.current.active) return;
    const point = pickPointAtClient(event.clientX, event.clientY, 2.2);
    if (point?.kind === "sale") {
      pinBidDot(point.key);
    } else if (point?.kind === "ask" || point?.kind === "floor") {
      pinAskDot(point.key);
    } else {
      clearPinnedDot();
    }
  };

  const showBidHover = useCallback((
    mark: any,
    seg: LinkedSegment | undefined,
    x: number,
    y: number,
    clientX?: number,
    clientY?: number
  ) => {
    const { screenX, screenY } = screenFromSvgPoint(x, y, clientX, clientY);
    setHover({
      key: `bid#${mark.epoch}`,
      x,
      y,
      screenX,
      screenY,
      bidder: mark.bidder,
      amount: mark.amountDec,
      amountDec: mark.amountDec,
      amountRaw: mark.amountDec,
      txHash: mark.txHash,
      atMs: mark.atMs,
      block: mark.block,
      epoch: mark.epoch,
      tokenId: mark.tokenId,
      floorHuman: seg?.floor,
      premiumHuman: seg?.premium,
      ptsHuman: seg?.ptsHuman,
      tHalf: seg?.tHalf,
      anchor: seg?.anchor,
      kHuman: seg?.kHuman,
      uGlobal: mark.u,
      dtPrevSec: seg?.dtPrevSec,
      dtNextSec: seg?.dtNextSec ?? null,
    });
  }, [screenFromSvgPoint]);

  useEffect(() => {
    if (!hasPinnedDot) return;
    if (isPanning || panRef.current.active) return;
    if (!showCurvePlot || !effectiveViewport) return;

    const vp = effectiveViewport;
    const xRange = vp.xMax - vp.xMin || 1;
    const yRange = vp.yMax - vp.yMin || 1;
    const toSvgX = (x: number) =>
      PLOT_LEFT_PAD + ((x - vp.xMin) / xRange) * PLOT_X_SPAN;
    const toSvgY = (y: number) => 60 - ((y - vp.yMin) / yRange) * 60;

    if (selectedBid) {
      const seg = linked.segments[selectedBid.segIdx];
      showBidHover(
        selectedBid,
        seg,
        toSvgX(selectedBid.u),
        toSvgY(selectedBid.price)
      );
      return;
    }

    if (selectedAsk) {
      const seg = linked.segments[selectedAsk.segIdx];
      if (!seg) return;
      const x = toSvgX(selectedAsk.u);
      const y = toSvgY(selectedAsk.price);
      if (selectedAsk.kind === "opening-floor") {
        showOpeningFloorHover(seg, x, y);
      } else {
        showStartAskHover(seg, x, y);
      }
      return;
    }

    if (selectedNow) {
      showNowCurveHover();
    }
  }, [
    hasPinnedDot,
    isPanning,
    showCurvePlot,
    effectiveViewport,
    selectedBid,
    selectedAsk,
    selectedNow,
    linked.segments,
    showBidHover,
    showOpeningFloorHover,
    showStartAskHover,
    showNowCurveHover,
  ]);

  return (
    <div className="panel dotfield">
      {!isDesktop && (
        <div className="dotfield__overlay">
          <div className="muted small">
            This view needs more room. Please widen your window or use a larger screen.
          </div>
        </div>
      )}
      <div className="dotfield__nav">
        <a
          className="headline dotfield__title dotfield__title-link thin"
          href="/path"
          target="_blank"
          rel="noreferrer"
        >
          {SURFACE_TERMINOLOGY.pathDapp}
        </a>
        <div className="dotfield__cta-stack" ref={ctaStackRef}>
          <HeaderWalletCTA
            ctaLabel={(ctaDisplay ?? ctaState).label}
            ctaDisabled={(ctaDisplay ?? ctaState).disabled}
            onCtaClick={(ctaDisplay ?? ctaState).onClick}
            dotState={dotState}
            lastTxHash={effectiveLastTxHash}
            onCopyNotice={() => showToast({ kind: "info", text: "Copied." })}
            onDisconnectNotice={() => {
              setWalletUnlockAttempted(false);
              setTxState("idle");
              setTxPhase(null);
              setTxHash(null);
              setTxError(null);
              setLastTxHash(null);
              setPreflight({
                ask: null,
                balance: null,
                allowance: null,
                loading: false,
                attempted: false,
                error: null,
              });
              showToast({ kind: "info", text: "wallet disconnected." });
            }}
          />
          {walletPickerOpen && (
            <div
              className="dotfield__wallet-picker"
              ref={walletPickerRef}
              role="menu"
              aria-label="Wallet options"
            >
              <div className="dotfield__wallet-picker-title">
                wallet options
              </div>
              <p className="dotfield__wallet-picker-note">
                New dapp? Wallet may warn.
                <br />
                Verify domain and action before continuing.
                <br />
                <a href="/verify" target="_blank" rel="noopener noreferrer">
                  verify ↗
                </a>
              </p>
              {availableConnectors.map((connector) => (
                <button
                  key={String((connector as any)?.id ?? (connector as any)?.name)}
                  type="button"
                  className="dotfield__wallet-picker-item"
                  role="menuitem"
                  onClick={() => {
                    void connectWalletConnector(connector);
                  }}
                >
                  {(connector as any)?.name ?? "Injected wallet"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div
        className={`dotfield__mint-notice ${
          displayNotice
            ? displayNotice.kind === "error"
              ? "is-error"
              : displayNotice.kind === "warn"
              ? "is-warn"
              : "is-info"
            : "is-empty"
        }`}
      >
        {displayNotice?.text ?? ""}
        {displayWalletRpcFix && (
          <>
            {" "}
            <button
              type="button"
              className="dotfield__notice-action"
              onClick={() => {
                void handleFixWalletRpc();
              }}
              aria-label={
                isMetaMaskWallet
                  ? "Fix MetaMask Sepolia RPC"
                  : "Fix wallet Sepolia RPC"
              }
            >
              fix rpc ↗
            </button>
          </>
        )}
        {displayNoticeReportLink && (
          <>
            {" "}
            <a
              href={displayNoticeReportLink.href}
              target={displayNoticeReportLink.target}
              rel={displayNoticeReportLink.rel}
              aria-label={displayNoticeReportLink.ariaLabel}
              className={`dotfield__report-bug-link ${displayNoticeReportLink.className}`}
            >
              {displayNoticeReportLink.label}
            </a>
          </>
        )}
      </div>
      {mintReview && effectiveTxState === "idle" && (
        <div
          className="dotfield__mint-review"
          ref={mintReviewRef}
          aria-live="polite"
        >
          <div className="dotfield__mint-review-title">
            Pulse bid
          </div>
          <div className="dotfield__mint-review-subtitle">
            You are calling PulseAuction.bid(uint256 maxPrice).
          </div>
          <div className="dotfield__mint-review-row">
            <span>network</span>
            <strong>{targetChainLabel} / {mintReviewChainIdLabel}</strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>contract</span>
            <strong>
              {mintReviewContractHref ? (
                <a
                  className="dotfield__mint-review-link"
                  href={mintReviewContractHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PulseAuction {shortAddr(auctionAddress)}
                </a>
              ) : (
                <>PulseAuction {shortAddr(auctionAddress)}</>
              )}
            </strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>decoded call</span>
            <strong>bid(uint256 maxPrice)</strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>current ask</span>
            <strong>{mintReviewCurrentAskLabel ?? mintReview.priceLabel} {mintReview.symbol}</strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>ETH sent</span>
            <strong>{mintReviewTxValueLabel ?? mintReview.txValueLabel} {mintReview.nativePayment ? mintReview.symbol : "ETH"}</strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>max price</span>
            <strong>{mintReviewMaxPriceLabel ?? mintReview.maxPriceLabel} {mintReview.symbol}</strong>
          </div>
          <div className="dotfield__mint-review-row">
            <span>network gas</span>
            <strong>shown in wallet</strong>
          </div>
          <div className="dotfield__mint-review-warning">
            Some wallets may show this as raw transaction data. Verify the decoded fields before signing.
          </div>
          <div className="dotfield__mint-review-rule">
            If the ask is higher than maxPrice at execution, the bid reverts.
          </div>
          <div className="dotfield__mint-review-rule">
            If the accepted ask is below ETH sent, surplus is refunded by the contract.
          </div>
          <div className="dotfield__mint-review-rule">
            A successful bid settles through PathPulseAdapter and mints PATH to your wallet.
          </div>
          <div className="dotfield__mint-review-note">
            {mintReview.requiresApproval
              ? (
                <>
                  wallet opens next.
                  <br />
                  wallet step 1 approves {mintReview.symbol}.
                  <br />
                  wallet step 2 submits Pulse bid.
                </>
              )
              : (
                <>
                  wallet opens next.
                  <br />
                  local decode must match before the wallet opens.
                </>
              )}
            <br />
            <a
              className="dotfield__mint-review-link"
              href="/verify"
              target="_blank"
              rel="noopener noreferrer"
            >
              verify ↗
            </a>
          </div>
          {publicNetworkNotice && (
            <div className="dotfield__mint-review-network">
              {publicNetworkNotice}
            </div>
          )}
        </div>
      )}
      {debugPanelEnabled && (
        <div className="dotfield__debug">
          <button
            type="button"
            className="dotfield__debug-toggle"
            onClick={() => setDebugOpen((open) => !open)}
          >
            debug
          </button>
          {debugOpen && (
            <div className="dotfield__debug-panel">
              <div className="dotfield__debug-row">
                <span>override</span>
                <input
                  type="checkbox"
                  checked={debugOverride.enabled}
                  onChange={(event) =>
                    setDebugOverride((prev) => ({
                      ...prev,
                      enabled: event.target.checked,
                    }))
                  }
                />
                <button type="button" onClick={resetDebug}>
                  reset
                </button>
              </div>
              <div className="dotfield__debug-row">
                <span>cta</span>
                <select
                  value={debugOverride.cta}
                  disabled={noticeOverrideActive}
                  onChange={(event) =>
                    setDebugOverride((prev) => ({
                      ...prev,
                      cta: event.target.value as
                        | "auto"
                        | "connect"
                        | "connect-locked"
                        | "switch"
                        | "mint"
                        | "mint-disabled"
                        | "wallet-request"
                        | "pending"
                        | "retry",
                    }))
                  }
                >
                  <option value="auto">auto</option>
                  <option value="connect">connect</option>
                  <option value="connect-locked">connect locked</option>
                  <option value="switch">switch</option>
                  <option value="mint">mint</option>
                  <option value="mint-disabled">mint disabled</option>
                  <option value="wallet-request">wallet request</option>
                  <option value="pending">pending</option>
                  <option value="retry">retry</option>
                </select>
              </div>
              <div className="dotfield__debug-row">
                <span>notice</span>
                <select
                  value={debugOverride.notice}
                  disabled={ctaOverrideActive}
                  onChange={(event) =>
                    setDebugOverride((prev) => ({
                      ...prev,
                      notice: event.target.value as
                        | "auto"
                        | "none"
                        | "no_wallet"
                        | "wallet_locked"
                        | "wrong_network"
                        | "rpc_error"
                        | "insufficient"
                        | "approval"
                        | "minting"
                        | "invalid_signature"
                        | "user_refused"
                        | "invalid_block_id"
                        | "overflow"
                        | "generic",
                    }))
                  }
                >
                  <option value="auto">auto</option>
                  <option value="none">none</option>
                  <option value="no_wallet">no wallet</option>
                  <option value="wallet_locked">wallet locked</option>
                  <option value="wrong_network">wrong network</option>
                  <option value="rpc_error">rpc error</option>
                  <option value="insufficient">insufficient</option>
                  <option value="approval">approval</option>
                  <option value="minting">minting</option>
                  <option value="invalid_signature">invalid signature</option>
                  <option value="user_refused">user refused</option>
                  <option value="invalid_block_id">invalid block id</option>
                  <option value="overflow">overflow</option>
                  <option value="generic">generic</option>
                </select>
              </div>
              <div className="dotfield__debug-row">
                <span>toasts</span>
                <div className="dotfield__debug-actions">
                  <button
                    type="button"
                    onClick={() =>
                      showToast({ kind: "info", text: "Copied." })
                    }
                  >
                    copied
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      showToast({
                        kind: "info",
                        text: `Submitted: ${shortHash(DEBUG_TX_HASH)}.`,
                      })
                    }
                  >
                    submitted
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      showToast({ kind: "info", text: "Confirmed." })
                    }
                  >
                    confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      showToast({ kind: "info", text: "wallet disconnected." })
                    }
                  >
                    disconnected
                  </button>
                </div>
              </div>
              <div className="dotfield__debug-note muted">
                Overrides affect UI only. Use auto to return to live data. CTA or notice
                overrides drive wallet/tx state and lock related selectors.
              </div>
            </div>
          )}
        </div>
      )}
      {(() => {
        if (showNoReleaseNotice) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                No PATH deployment loaded.
                <br />
                PATH auction not loaded.
                <br />
                Deploy PATH, export the FE release, then sync inshell.art.
              </div>
            </div>
          );
        }
        if (showBeforeOpenNotice) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                Auction opens at {openAtUtcLabel ?? "—"} UTC.
                <br />
                {opensInLabel ? `Opens in ${opensInLabel}.` : "Waiting for first eligible block."}
                <br />
                First bid can land at or after open time.
              </div>
            </div>
          );
        }
        if (showOpenNotActive) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                Auction is open.
                <br />
                Waiting for first bid.
                <br />
                Opening ask: {openingAskLabel} {displayTokenSymbol}
                <br />
                Current ask: {openCurrentPriceLabel} {displayTokenSymbol}
              </div>
            </div>
          );
        }
        if (showHistoryLoading) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                Auction is active.
                <br />
                Loading sale history.
                <br />
                Current ask: {openCurrentPriceLabel} {displayTokenSymbol}
              </div>
            </div>
          );
        }
        if (missingDeployBlockVisible) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                No bids loaded.
                <br />
                Set VITE_PULSE_AUCTION_DEPLOY_BLOCK to backfill history.
              </div>
            </div>
          );
        }
        if (noBidsVisible) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted dotfield__status-copy">
                No bids loaded.
                <br />
                Check deploy block and RPC.
              </div>
            </div>
          );
        }
        if (showCurveLoading && !missingDeployBlockVisible && !noBidsVisible) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">loading pricing...</div>
            </div>
          );
        }
        if (coreErrorVisible && !showCurvePlot) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">curve error: {String(coreErrorVisible)}</div>
            </div>
          );
        }
        if (!showCurvePlot || !effectiveViewport) {
          return (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">
                {linked.reason
                  ? `curve unavailable: ${formatCurveReason(linked.reason)}`
                  : "curve not ready"}
              </div>
            </div>
          );
        }

        const vp = effectiveViewport;
        const xRange = vp.xMax - vp.xMin || 1;
        const yRange = vp.yMax - vp.yMin || 1;
        const toSvgX = (x: number) =>
          PLOT_LEFT_PAD + ((x - vp.xMin) / xRange) * PLOT_X_SPAN;
        const toSvgY = (y: number) => 60 - ((y - vp.yMin) / yRange) * 60;
        const isInPlotY = (y: number) => Number.isFinite(y) && y >= 0 && y <= 60;
        const hasNow =
          linked.nowU != null &&
          linked.nowPrice != null &&
          Number.isFinite(linked.nowU) &&
          Number.isFinite(linked.nowPrice);
        const nowU = hasNow ? (linked.nowU as number) : null;
        const nowPrice = hasNow ? (linked.nowPrice as number) : null;
        const inViewNow =
          nowU != null && nowU >= vp.xMin - 1e-6 && nowU <= vp.xMax + 1e-6;
        const showNow = hasNow && (selectedNow || inViewNow);

        const nowPt = showNow && nowU != null && nowPrice != null
          ? {
              x: toSvgX(nowU),
              y: toSvgY(nowPrice),
            }
          : null;
        const curveSegments: Array<{ key: string; d: string }> = [];
        const MAX_CURVE_SEGMENT_DX_SVG = 1.2;
        const MAX_CURVE_MIDPOINT_ERR_SVG = 0.03;
        const MAX_CURVE_SUBDIVISION_DEPTH = 12;
        const capPumpY = (floorY: number, askY: number): [number, number] | null => {
          if (!Number.isFinite(floorY) || !Number.isFinite(askY)) return null;
          if (!isInPlotY(floorY)) return null;
          let cappedAskY = clamp(askY, 0, 60);
          cappedAskY = clamp(cappedAskY, 0, 60);
          return Math.abs(cappedAskY - floorY) > 0.001 ? [floorY, cappedAskY] : null;
        };
        for (const seg of linked.segments) {
          const segEnd = seg.uStart + seg.uLen;
          if (segEnd < vp.xMin - 1e-9) continue;
          if (seg.uStart > vp.xMax + 1e-9) continue;

          const x0 = Math.max(vp.xMin, seg.uStart);
          const x1 = Math.min(vp.xMax, segEnd);
          const unclippedU0 = Math.max(0, x0 - seg.uStart);
          const unclippedU1 = Math.max(0, x1 - seg.uStart);
          const clippedRange = clipULocalRangeToYDomain(
            seg,
            unclippedU0,
            unclippedU1,
            vp.yMin,
            vp.yMax
          );
          if (!clippedRange) continue;
          const [u0, u1] = clippedRange;
          if (!(u1 > u0 + 1e-9)) continue;

          const evalPoint = (uLocal: number) => {
            const price = priceAtU(seg.floor, seg.premium, uLocal);
            const xSvg = toSvgX(seg.uStart + uLocal);
            const ySvg = toSvgY(price);
            return { uLocal, xSvg, ySvg };
          };

          const p0 = evalPoint(u0);
          const p1 = evalPoint(u1);
          if (
            !Number.isFinite(p0.xSvg) ||
            !Number.isFinite(p0.ySvg) ||
            !Number.isFinite(p1.xSvg) ||
            !Number.isFinite(p1.ySvg)
          ) {
            continue;
          }
          const points: Array<{ xSvg: number; ySvg: number }> = [
            { xSvg: p0.xSvg, ySvg: p0.ySvg },
          ];

          const appendAdaptive = (
            left: { uLocal: number; xSvg: number; ySvg: number },
            right: { uLocal: number; xSvg: number; ySvg: number },
            depth: number
          ) => {
            const dx = right.xSvg - left.xSvg;
            const dy = right.ySvg - left.ySvg;
            const uMid = left.uLocal + (right.uLocal - left.uLocal) * 0.5;
            const mid = evalPoint(uMid);
            if (!Number.isFinite(mid.xSvg) || !Number.isFinite(mid.ySvg)) {
              points.push({ xSvg: right.xSvg, ySvg: right.ySvg });
              return;
            }

            const xDen = Math.abs(dx) > 1e-9 ? dx : 1;
            const tMid = Math.abs(dx) > 1e-9 ? (mid.xSvg - left.xSvg) / xDen : 0.5;
            const yLinearMid = left.ySvg + tMid * dy;
            const midpointError = Math.abs(mid.ySvg - yLinearMid);
            const shouldSplit =
              depth < MAX_CURVE_SUBDIVISION_DEPTH &&
              (Math.abs(dx) > MAX_CURVE_SEGMENT_DX_SVG ||
                midpointError > MAX_CURVE_MIDPOINT_ERR_SVG);

            if (!shouldSplit) {
              points.push({ xSvg: right.xSvg, ySvg: right.ySvg });
              return;
            }

            appendAdaptive(left, mid, depth + 1);
            appendAdaptive(mid, right, depth + 1);
          };

          appendAdaptive(p0, p1, 0);

          const segDParts: string[] = [];
          for (let i = 0; i < points.length; i += 1) {
            const point = points[i];
            segDParts.push(`${i === 0 ? "M" : "L"} ${point.xSvg} ${point.ySvg}`);
          }
          if (segDParts.length > 1) {
            curveSegments.push({
              key: `curve-${seg.idx}`,
              d: segDParts.join(" "),
            });
          }
        }

        const xPad = xRange * 0.02;
        const contextSourceBidMarks = viewportUserLocked
          ? []
          : useTailViewport
            ? bidMarks.filter((m) => m.u < vp.xMin - xPad)
            : [];
        const contextBidMarks = contextSourceBidMarks.map((mark, index) => ({
          mark,
          x: PLOT_LEFT_PAD + 1.2 + index * 2.4,
        }));
        const contextBidMarkKeys = new Set(
          contextBidMarks.map(({ mark }) => mark.key)
        );
        const marksVisible = bidMarks
          .filter(
            (m) =>
              !contextBidMarkKeys.has(m.key) &&
              m.u >= vp.xMin - xPad &&
              m.u <= vp.xMax + xPad
          )
          .map((mark) => ({
            mark,
            x: toSvgX(mark.u),
          }));
        const bidMarksVisible = [...contextBidMarks, ...marksVisible];
        const contextAskMarks = contextBidMarks.flatMap(({ mark, x }) => {
          const seg = linked.segments[mark.segIdx];
          if (!seg) return [];
          const x0 = Math.max(PLOT_LEFT_PAD, x - 2.1);
          return askMarks
            .filter((askMark) => askMark.segIdx === seg.idx)
            .map((askMark) => ({
              mark: askMark,
              x: x0,
            }));
        });
        const contextAskMarkKeys = new Set(
          contextAskMarks.map(({ mark }) => mark.key)
        );
        const askMarksVisible = [
          ...contextAskMarks,
          ...askMarks
            .filter(
              (m) =>
                !contextAskMarkKeys.has(m.key) &&
                m.u >= vp.xMin - xPad &&
                m.u <= vp.xMax + xPad
            )
            .map((mark) => ({
              mark,
              x: toSvgX(mark.u),
            })),
        ];

        return (
          <div
            className={`dotfield__canvas${
              showCurvePlot && isPanning ? " is-dragging" : ""
            }`}
            ref={canvasRef}
            style={{ touchAction: "none" }}
            onWheelCapture={(event) => {
              if (!showCurvePlot || !effectiveViewport) return;
              event.preventDefault?.();
            }}
            onWheel={handleCanvasWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onMouseLeave={() => setHover(null)}
          >
            <svg
              viewBox={`0 0 100 60`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Pulse auction curve"
              ref={svgRef}
              onMouseMove={handleSvgMouseMove}
              onClick={handleSvgClick}
            >
              {contextBidMarks.map(({ mark, x }) => {
                const seg = linked.segments[mark.segIdx];
                if (!seg) return null;
                const x0 = Math.max(PLOT_LEFT_PAD, x - 2.1);
                const y0 = toSvgY(seg.floor);
                const y1 = toSvgY(seg.ask);
                const ySale = toSvgY(mark.price);
                if (
                  !Number.isFinite(x0) ||
                  !Number.isFinite(x) ||
                  !isInPlotY(y0) ||
                  !isInPlotY(ySale)
                ) {
                  return null;
                }
                const pumpY = capPumpY(y0, y1);
                const c1x = x0 + (x - x0) * 0.16;
                const c2x = x0 + (x - x0) * 0.68;
                return (
                  <Fragment key={`context-${mark.key}`}>
                    {pumpY ? (
                      <line
                        x1={x0}
                        y1={pumpY[0]}
                        x2={x0}
                        y2={pumpY[1]}
                        className="dotfield__pump dotfield__pump--context"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    <path
                      className="dotfield__context-curve"
                      d={`M ${x0} ${y1} C ${c1x} ${y1} ${c2x} ${ySale} ${x} ${ySale}`}
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Fragment>
                );
              })}

              {curveSegments.map((segPath) => (
                <path
                  key={segPath.key}
                  className="dotfield__curve"
                  d={segPath.d}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {linked.segments.map((seg) => {
                const x = toSvgX(seg.uStart);
                if (x < -2 || x > 102) return null;
                const y0 = toSvgY(seg.floor);
                const y1 = toSvgY(seg.ask);
                const pumpY = capPumpY(y0, y1);
                if (!pumpY) return null;
                return (
                  <line
                    key={`pump-${seg.idx}`}
                    x1={x}
                    y1={pumpY[0]}
                    x2={x}
                    y2={pumpY[1]}
                    className="dotfield__pump"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}

            </svg>

            <div className="dotfield__marks-layer">
              {askMarksVisible.map(({ mark, x }) => {
                const seg = linked.segments[mark.segIdx];
                if (!seg) return null;
                const y = toSvgY(mark.price);
                if (x < -2 || x > 102 || y < -2 || y > 62) return null;
                const isSelected = selectedAskKey === mark.key;
                const isOpeningFloor = mark.kind === "opening-floor";
                return (
                  <button
                    key={mark.key}
                    type="button"
                    className={`dotfield__point ${
                      isOpeningFloor ? "dotfield__point--opening-floor" : "dotfield__point--ask"
                    }${
                      isSelected ? " is-selected" : ""
                    }`}
                    style={{
                      left: `${x}%`,
                      top: `${(y / 60) * 100}%`,
                    }}
                    data-kind={isOpeningFloor ? "opening-floor" : "ask"}
                    data-dot-key={mark.key}
                    data-x={x}
                    data-y={y}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseMove={(e) => {
                      e.stopPropagation();
                      if (pinnedDotRef.current) return;
                      if (isOpeningFloor) {
                        showOpeningFloorHover(seg, x, y, e.clientX, e.clientY);
                      } else {
                        showStartAskHover(seg, x, y, e.clientX, e.clientY);
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (pinnedDotRef.current) return;
                      if (isOpeningFloor) {
                        showOpeningFloorHover(seg, x, y, e.clientX, e.clientY);
                      } else {
                        showStartAskHover(seg, x, y, e.clientX, e.clientY);
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (!pinnedDotRef.current) {
                        setHover(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOpeningFloor) {
                        showOpeningFloorHover(seg, x, y, e.clientX, e.clientY);
                      } else {
                        showStartAskHover(seg, x, y, e.clientX, e.clientY);
                      }
                      pinAskDot(mark.key);
                    }}
                  >
                    <span className="dotfield__dot" />
                  </button>
                );
              })}
              {bidMarksVisible.map(({ mark, x }) => {
                const seg = linked.segments[mark.segIdx];
                const y = toSvgY(mark.price);
                if (x < -2 || x > 102 || y < -2 || y > 62) return null;
                const isSelected = selectedBidKey === mark.key;
                return (
                  <button
                    key={mark.key}
                    type="button"
                    className={`dotfield__point dotfield__point--sale${
                      isSelected ? " is-selected" : ""
                    }`}
                    style={{
                      left: `${x}%`,
                      top: `${(y / 60) * 100}%`,
                    }}
                    data-kind="sale"
                    data-x={x}
                    data-y={y}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseMove={(e) => {
                      e.stopPropagation();
                      if (pinnedDotRef.current) return;
                      showBidHover(mark, seg, x, y, e.clientX, e.clientY);
                    }}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      if (pinnedDotRef.current) return;
                      showBidHover(mark, seg, x, y, e.clientX, e.clientY);
                    }}
                    onMouseLeave={(e) => {
                      e.stopPropagation();
                      if (!pinnedDotRef.current) {
                        setHover(null);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      showBidHover(mark, seg, x, y, e.clientX, e.clientY);
                      pinBidDot(mark.key);
                    }}
                  >
                    <span className="dotfield__dot" />
                  </button>
                );
              })}
              {showNow && nowPt && (
                <button
                  type="button"
                  className={`dotfield__point dotfield__point--now${
                    selectedNow ? " is-selected" : ""
                  }`}
                  style={{
                    left: `${nowPt.x}%`,
                    top: `${(nowPt.y / 60) * 100}%`,
                  }}
                  data-kind="now"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                    if (pinnedDotRef.current) return;
                    showNowCurveHover(e.clientX, e.clientY);
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    if (pinnedDotRef.current) return;
                    showNowCurveHover(e.clientX, e.clientY);
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    if (!pinnedDotRef.current) {
                      setHover(null);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    showNowCurveHover(e.clientX, e.clientY);
                    pinNowDot();
                  }}
                >
                  <span className="dotfield__dot" />
                </button>
              )}
            </div>

            {hover && (
              <div className="dotfield__popover" style={{ left: hover.screenX, top: hover.screenY }}>
                {hover.key?.startsWith("bid#") ? (
                  <>
                    <div className="muted small">
                      {`sale #${hover.epoch ?? "—"}`}
                    </div>
                    <div className="dotfield__popover-meta" style={{ marginTop: 6 }}>
                      <div className="dotfield__poprow">
                        <span>price</span>
                        <span>
                          {formatAmountDetailed(
                            hover.amountDec ?? hover.amount,
                            decimals,
                            displayTokenSymbol
                          )}
                        </span>
                      </div>
                      <div className="dotfield__poprow">
                        <span>bidder</span>
                        <span>{shortAddr(hover.bidder)}</span>
                      </div>
                      <div className="dotfield__poprow">
                        <span>time</span>
                        <span>{formatLocalTime(hover.atMs)}</span>
                      </div>
                    </div>
                    <div className="dotfield__note" style={{ marginTop: 4 }}>
                      mints one $PATH and starts the next curve
                    </div>
                  </>
                ) : (
                  <>
                    <div className="muted small">
                      {hover.key === "ask"
                        ? Math.abs(Number((hover as any).uGlobal ?? Number.NaN)) < 1e-9
                          ? "opening ask"
                          : "start ask"
                        : hover.key === "now"
                        ? "current ask"
                        : hover.key === "opening-floor"
                        ? "opening floor"
                        : hover.key === "premium"
                        ? "time premium"
                        : "ask"}
                    </div>
                    <div className="dotfield__poprow">
                      <span>
                        {hover.key === "premium"
                          ? "amount"
                          : "price"}
                      </span>
                      <span>
                        {formatAmountDetailed(
                          (hover as any).amountRaw ?? hover.amount,
                          decimals,
                          displayTokenSymbol
                        )}
                      </span>
                    </div>
                    {hover.key === "ask" && (
                      Math.abs(Number((hover as any).uGlobal ?? Number.NaN)) < 1e-9 ? (
                        <>
                          <div className="dotfield__poprow">
                            <span>time</span>
                            <span>{formatLocalTime(hover.atMs)}</span>
                          </div>
                          <div className="dotfield__note" style={{ marginTop: 4 }}>
                            ask when the auction opens
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="dotfield__poprow">
                            <span>floor</span>
                            <span>
                              {hover.floorHuman != null
                                ? formatAmountDetailed(
                                    String(hover.floorHuman),
                                    decimals,
                                    displayTokenSymbol
                                  )
                                : "—"}
                            </span>
                          </div>
                          <div className="dotfield__poprow">
                            <span>time premium</span>
                            <span>
                              {hover.floorHuman != null && hover.amountRaw
                                ? (() => {
                                    const f = Number((hover as any).floorHuman);
                                    const amt = Number((hover as any).amountRaw);
                                    if (Number.isFinite(f) && Number.isFinite(amt)) {
                                      return formatAmountDetailed(
                                        String(amt - f),
                                        decimals,
                                        displayTokenSymbol
                                      );
                                    }
                                    return "—";
                                  })()
                                : "—"}
                            </span>
                          </div>
                          <div className="dotfield__note" style={{ marginTop: 4 }}>
                            price = floor + time premium
                          </div>
                          <div className="dotfield__note">
                            floor = last sale
                          </div>
                        </>
                      )
                    )}
                    {hover.key === "opening-floor" && (
                      <>
                        <div className="dotfield__poprow">
                          <span>time</span>
                          <span>{formatLocalTime(hover.atMs)}</span>
                        </div>
                        <div className="dotfield__note" style={{ marginTop: 4 }}>
                          floor when the auction opens
                        </div>
                      </>
                    )}
                    {(hover.key === "curve-point" || hover.key === "now") && (
                      <>
                        <div className="dotfield__poprow">
                          <span>above floor</span>
                          <span>
                            {hover.floorHuman != null && hover.amountRaw
                              ? (() => {
                                  if (hover.key === "now") {
                                    const f = Number((hover as any).floorHuman);
                                    const amt = Number((hover as any).amountRaw);
                                    if (Number.isFinite(f) && Number.isFinite(amt)) {
                                      return formatAmountDetailed(
                                        String(Math.max(0, amt - f)),
                                        decimals,
                                        displayTokenSymbol
                                      );
                                    }
                                  }
                                  const d = Number((hover as any).premiumHuman);
                                  const u = Number((hover as any).uLocal);
                                  if (Number.isFinite(d) && Number.isFinite(u)) {
                                    return formatAmountDetailed(
                                      String(Math.max(0, premiumAtU(d, u))),
                                      decimals,
                                      displayTokenSymbol
                                    );
                                  }
                                  const f = Number((hover as any).floorHuman);
                                  const amt = Number((hover as any).amountRaw);
                                  if (Number.isFinite(f) && Number.isFinite(amt)) {
                                    return formatAmountDetailed(
                                      String(Math.max(0, amt - f)),
                                      decimals,
                                      displayTokenSymbol
                                    );
                                  }
                                  return "—";
                                })()
                              : "—"}
                          </span>
                        </div>
                        <div className="dotfield__poprow">
                          <span>ago</span>
                          <span>
                            {formatDuration(
                              Math.max(0, Number((hover as any).beforeNowSec ?? 0))
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    {hover.key === "premium" && (
                      <>
                        <div className="dotfield__poprow">
                          <span>duration</span>
                          <span>{formatSecondsDuration(hover.durationSec ?? 0)}</span>
                        </div>
                        <div className="dotfield__poprow">
                          <span>PTS ({displayTokenSymbol}/s)</span>
                          <span>
                            {hover.ptsHuman != null ? formatHumanTokenAmount(hover.ptsHuman) : "—"}
                          </span>
                        </div>
                        <div className="dotfield__note" style={{ marginTop: 4 }}>
                          amount = duration × PTS
                        </div>
                      </>
                    )}
                    {(hover.key === "curve-point" || hover.key === "now") && (
                      <>
                        <div className="dotfield__poprow">
                          <span>t½</span>
                          <span>
                            {(hover as any).tHalf != null
                              ? formatDuration((hover as any).tHalf)
                              : "—"}
                          </span>
                        </div>
                        <div className="dotfield__poprow">
                          <span>u(t½)</span>
                          <span>
                            {(() => {
                              const u =
                                (hover as any).durationSec != null && (hover as any).tHalf != null
                                  ? ((hover as any).durationSec ?? 0) / Math.max((hover as any).tHalf ?? 1, 1e-9)
                                  : 0;
                              return `${u.toFixed(2)}`;
                            })()}
                          </span>
                        </div>
                        <div className="dotfield__poprow">
                          <span>1 t½ decay</span>
                          <span>
                            {(() => {
                              const d = Number((hover as any).premiumHuman);
                              const u = Number((hover as any).uLocal);
                              if (Number.isFinite(d) && Number.isFinite(u)) {
                                return formatAmountDetailed(
                                  String(oneHalfDropAtU(d, u)),
                                  decimals,
                                  displayTokenSymbol
                                );
                              }
                              const f = Number((hover as any).floorHuman);
                              const amt = Number((hover as any).amountRaw);
                              if (Number.isFinite(f) && Number.isFinite(amt)) {
                                return formatAmountDetailed(
                                  String((amt - f) / 2),
                                  decimals,
                                  displayTokenSymbol
                                );
                              }
                              return "—";
                            })()}
                          </span>
                        </div>
                        <div className="dotfield__poprow">
                          <span>time</span>
                          <span>{formatLocalTime(hover.atMs)}</span>
                        </div>
                        <div className="dotfield__note" style={{ marginTop: 4 }}>
                          {curveFormulaLabel()}
                        </div>
                        <div className="dotfield__note">k = {(hover as any).kHuman ?? "?"}</div>
                        <div className="dotfield__note">
                          anchor = {(hover as any).anchor ?? "?"}
                        </div>
                        <div className="dotfield__note">
                          floor = {(hover as any).floorHuman ?? "?"}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {showCurvePlot && (
        <div className="dotfield__axes muted small">
          <span>time (t½) →</span>
          <span>price ({displayTokenSymbol}) ↑</span>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { ProviderInterface } from "starknet";
import { toFixed } from "@inshell/utils";
import type { AuctionSnapshot } from "@/types/types";
import type { AbiSource } from "@inshell/contracts";
import type { NormalizedBid } from "@/services/auction/bidsService";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { resolveAddress } from "@inshell/contracts";
import { callContract, getDefaultProvider } from "@inshell/starknet";
import { readU256, toU256Num } from "@inshell/utils";
import HeaderWalletCTA from "@/components/HeaderWalletCTA";
import { useWallet } from "@inshell/wallet";
/* global SVGSVGElement, SVGElement */

type Props = {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
  refreshMs?: number;
  decimals?: number;
  maxBids?: number;
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

function toNumberSafe(v: string | number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortAmount(val: string) {
  if (val.length > 8) {
    const n = Number(val);
    if (Number.isFinite(n)) return n.toFixed(2);
    return val.slice(0, 8) + "…";
  }
  return val;
}

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
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
  const network = getEnvValue("VITE_NETWORK");
  if (typeof network === "string" && network === "devnet") return 0;
  return undefined;
}

function resolvePaymentToken(): string {
  const raw =
    getEnvValue("VITE_PAYTOKEN") ?? getEnvValue("VITE_PAYMENT_TOKEN");
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return SEPOLIA_STRK;
}

function isTransientRpcError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /insufficient_resources/i.test(msg);
}

const isTestEnv =
  typeof globalThis !== "undefined" &&
  typeof globalThis.process !== "undefined" &&
  globalThis.process?.env?.NODE_ENV === "test";
const DELAY_MS = 500;
const ERROR_DELAY_MS = 700;
const STARTUP_ERROR_DELAY_MS = 2500;
const FALLBACK_DELAY_MS = 1200;
const CURVE_HALF_LIVES = 10;
const SEPOLIA_STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

function splitTokenId(id: number): [string, string] {
  const n = BigInt(Math.max(0, Math.trunc(id)));
  const low = n & ((1n << 128n) - 1n);
  const high = n >> 128n;
  return [low.toString(), high.toString()];
}

function feltToBytes(value: string, count: number): number[] {
  let n = 0n;
  try {
    n = BigInt(value);
  } catch {
    n = 0n;
  }
  const out: number[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const shift = BigInt(8 * (count - 1 - i));
    out[i] = Number((n >> shift) & 0xffn);
  }
  return out;
}

function decodeByteArray(raw: string[] | undefined): string {
  if (!raw?.length) return "";
  const fullWords = Number(raw[0] ?? 0);
  let idx = 1;
  const bytes: number[] = [];

  for (let i = 0; i < fullWords; i += 1) {
    const word = raw[idx++] ?? "0";
    bytes.push(...feltToBytes(word, 31));
  }

  const pendingWord = raw[idx++] ?? "0";
  const pendingLen = Number(raw[idx] ?? 0);
  if (pendingLen > 0) {
    bytes.push(...feltToBytes(pendingWord, pendingLen));
  }

  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}

type MetaAttribute = { trait_type: string; value: string };
type LookData = {
  svg: string;
  title: string;
  attrs: MetaAttribute[];
  tokenId: number;
};

function normalizeAttrValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeAttributes(raw: unknown): MetaAttribute[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as { trait_type?: unknown; value?: unknown };
      const trait =
        entry.trait_type != null ? String(entry.trait_type) : "attribute";
      return { trait_type: trait, value: normalizeAttrValue(entry.value) };
    })
    .filter((item): item is MetaAttribute => Boolean(item));
}

function parseTokenUri(
  uri: string
): { image?: string; name?: string; attributes?: MetaAttribute[] } | null {
  if (!uri) return null;
  if (uri.startsWith("data:application/json;base64,")) {
    const raw = uri.slice("data:application/json;base64,".length);
    try {
      const jsonText = atob(raw);
      const parsed = JSON.parse(jsonText);
      return {
        image: parsed?.image,
        name: parsed?.name,
        attributes: normalizeAttributes(parsed?.attributes),
      };
    } catch {
      return null;
    }
  }
  if (uri.startsWith("data:application/json,")) {
    const raw = uri.slice("data:application/json,".length);
    const jsonText =
      raw.startsWith("%7B") || raw.startsWith("%7b")
        ? decodeURIComponent(raw)
        : raw;
    try {
      const parsed = JSON.parse(jsonText);
      return {
        image: parsed?.image,
        name: parsed?.name,
        attributes: normalizeAttributes(parsed?.attributes),
      };
    } catch {
      return null;
    }
  }
  return null;
}

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
  metaDtSec?: number;
  beforeNowSec?: number;
  hoverSetSec?: number;
  tHalf?: number;
};

type CurvePoint = {
  x: number;
  y: number;
  u: number;
};

type CurveData = {
  points: CurvePoint[];
  ask: number;
  floor: number;
  isGenesis?: boolean;
  startSec: number;
  endSec: number;
  anchor?: number;
  k?: number;
  asymptoteB?: number;
  lastDecStr?: string;
  lastDecValue?: number | null;
  askDecStr?: string;
  floorDecStr?: string;
  lastEpoch?: number | null;
  premiumHuman?: number;
  dtSec?: number;
  ptsHuman?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  tHalf?: number;
  metaU?: number;
  metaDtSec?: number;
};

type PulseFixture = {
  k: number;
  epoch: {
    epochIndex: number;
    floor: number;
    D: number | null;
    tStart: number;
    tNow: number;
  };
};

function fixtureEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const query = window.location.search ?? "";
  const match = /(?:[?&])fixture=([^&]+)/.exec(query);
  if (match) {
    const value = match[1].toLowerCase();
    return value !== "0" && value !== "false";
  }
  const env = (globalThis as any)?.__VITE_ENV__?.VITE_PULSE_FIXTURE;
  if (env === "1" || env === "true") return true;
  return false;
}

function readPulseFixture(enabled: boolean): PulseFixture | null {
  if (!enabled) return null;
  if (typeof window === "undefined") return null;
  const raw =
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
  const fx = raw;
  if (!fx || typeof fx !== "object" || !fx.epoch) return null;
  try {
    const k = Number((fx as any).k);
    const epoch = (fx as any).epoch ?? {};
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
    const parsed = {
      k,
      epoch: {
        epochIndex: Number.isFinite(Number(epoch.epochIndex))
          ? Number(epoch.epochIndex)
          : 0,
        floor,
        D,
        tStart,
        tNow,
      },
    };
    return parsed;
  } catch {
    return null;
  }
}

function fixtureToState(
  fx: PulseFixture,
  decimals: number
): { config: AuctionSnapshot["config"]; bids: NormalizedBid[]; nowSec: number } {
  const scale = 10n ** BigInt(decimals);
  const clampInt = (n: number, min = 0) =>
    BigInt(Math.max(min, Math.round(Number.isFinite(n) ? n : 0)));
  const floorScaled = clampInt(fx.epoch.floor) * scale;
  const kScaled = clampInt(fx.k, 1) * scale;
  // PTS is fixed to 1 on-chain; keep it constant while allowing fixture D to exercise math elsewhere.
  const ptsScaled = 1n * scale;
  const toU256 = (val: bigint) => toU256Num({ low: val.toString(), high: "0" });
  const amountU256 = toU256(floorScaled);
  const bids: NormalizedBid[] = [
    {
      key: `fx#${Math.max(0, fx.epoch.epochIndex - 1)}`,
      atMs: (fx.epoch.tStart - 1) * 1000,
      bidder: "0xfixture-prev",
      amount: amountU256,
      blockNumber: 1,
      epochIndex: Math.max(0, fx.epoch.epochIndex - 1),
    },
    {
      key: `fx#${fx.epoch.epochIndex}`,
      atMs: fx.epoch.tStart * 1000,
      bidder: "0xfixture-last",
      amount: amountU256,
      blockNumber: 2,
      epochIndex: fx.epoch.epochIndex,
    },
  ];
  const config: AuctionSnapshot["config"] = {
    openTimeSec: fx.epoch.tStart,
    genesisPrice: amountU256,
    genesisFloor: amountU256,
    k: toU256(kScaled),
    pts: ptsScaled.toString(),
  };
  return { config, bids, nowSec: fx.epoch.tNow || Date.now() / 1000 };
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  return `${Math.round(seconds)}s`;
}

function formatHms(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600)
    .toString()
    .padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatLocalTime(atMs: number): string {
  const d = new Date(atMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatAmount(val: string | undefined, decimals: number): string {
  const raw = val ?? "";
  const cleaned = String(raw).replace(/,/g, "");
  const n = Number(cleaned);
  if (Number.isFinite(n)) {
    const withSep = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return `${withSep} STRK`;
  }
  return `${String(raw)} STRK`;
}

function formatPercent(value: number, maxDecimals = 5): string {
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(maxDecimals);
  const trimmed = fixed.replace(/\.?0+$/, "");
  return `${trimmed}%`;
}

type AuctionStatus = "loading" | "pre_open" | "genesis_waiting" | "active" | "error";

function normalizeAuctionStatus(value: unknown): AuctionStatus | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "auto") return null;
  if (raw === "pre_open" || raw === "pre-open" || raw === "preopen") {
    return "pre_open";
  }
  if (
    raw === "genesis_waiting" ||
    raw === "genesis-waiting" ||
    raw === "genesis" ||
    raw === "waiting"
  ) {
    return "genesis_waiting";
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

function useAuctionStatus(params: {
  nowSec: number;
  openTimeSec?: number | null;
  coreActive?: boolean | null;
  coreLoading: boolean;
  coreErrorVisible: unknown;
  bidsLength: number;
}) {
  const {
    nowSec,
    openTimeSec,
    coreActive,
    coreLoading,
    coreErrorVisible,
    bidsLength,
  } = params;
  const [status, setStatus] = useState<AuctionStatus>("loading");
  const statusOverride = useMemo(() => readAuctionStatusOverride(), []);
  const openAtLabel = useMemo(() => {
    if (typeof openTimeSec !== "number" || !Number.isFinite(openTimeSec)) {
      return null;
    }
    return formatLocalTime(openTimeSec * 1000);
  }, [openTimeSec]);

  useEffect(() => {
    if (statusOverride) {
      setStatus(statusOverride);
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
      setStatus("pre_open");
      return;
    }
    if (bidsLength > 0) {
      setStatus("active");
      return;
    }
    if (coreActive === false) {
      setStatus("genesis_waiting");
      return;
    }
    setStatus(coreLoading ? "loading" : "loading");
  }, [
    statusOverride,
    coreErrorVisible,
    openTimeSec,
    nowSec,
    bidsLength,
    coreActive,
    coreLoading,
  ]);

  return { status, openAtLabel };
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
  abiSource,
  refreshMs = 4000,
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
  const {
    bids: bidsHook,
    ready: bidsReady,
    loading: bidsLoading,
  } = useAuctionBids({
    address: address ?? "0x0",
    provider,
    fromBlock: bidsFromBlock,
    refreshMs,
    enabled: !fixtureState && Boolean(address),
    maxBids,
  });
  const {
    data: coreData,
    loading: coreLoadingHook,
    error: coreErrorHook,
  } = useAuctionCore({
    address,
    provider,
    refreshMs,
    abiSource,
  });
  const bids = fixtureState?.bids ?? bidsHook;
  const ready = fixtureState ? true : bidsReady;
  const loading = fixtureState ? false : bidsLoading;
  const core = useMemo(
    () => (fixtureState ? { config: fixtureState.config } : coreData),
    [fixtureState, coreData]
  );
  const coreLoading = fixtureState ? false : coreLoadingHook;
  const coreError = fixtureState ? null : coreErrorHook;
  const [coreErrorVisible, setCoreErrorVisible] = useState<unknown>(null);
  const { account, address: walletAddress } = useWallet();

  const [hover, setHover] = useState<DotPoint | null>(null);
  const [view, setView] = useState<"curve" | "bids" | "look">("curve");
  const [lookTokenId, setLookTokenId] = useState(1);
  const [lookDisplayTokenId, setLookDisplayTokenId] = useState(1);
  const [lookSvg, setLookSvg] = useState<string | null>(null);
  const [lookTitle, setLookTitle] = useState<string | null>(null);
  const [lookLoading, setLookLoading] = useState(false);
  const [lookLoadingVisible, setLookLoadingVisible] = useState(false);
  const [lookEmptyVisible, setLookEmptyVisible] = useState(false);
  const [lookMovementLoadingVisible, setLookMovementLoadingVisible] =
    useState(false);
  const [lookMovementEmptyVisible, setLookMovementEmptyVisible] =
    useState(false);
  const [lookError, setLookError] = useState<string | null>(null);
  const [lookErrorVisible, setLookErrorVisible] = useState<string | null>(null);
  const [lookAttrs, setLookAttrs] = useState<MetaAttribute[]>([]);
  const [lookIncoming, setLookIncoming] = useState<LookData | null>(null);
  const [lookSlideDir, setLookSlideDir] = useState<"next" | "prev" | null>(
    null
  );
  const [lookSlidePhase, setLookSlidePhase] = useState<
    "idle" | "prep" | "animating"
  >("idle");
  const lookSvgRef = useRef<string | null>(null);
  const lookSlideDirRef = useRef<"next" | "prev" | null>(null);
  const lookSlidePhaseRef = useRef<"idle" | "prep" | "animating">("idle");
  const [lookHover, setLookHover] = useState<{ x: number; y: number } | null>(
    null
  );
  const [lookNotice, setLookNotice] = useState<{
    text: string;
    side: "left" | "right";
  } | null>(null);
  const lookAttrDisplay = useMemo(() => {
    if (!lookAttrs.length) return [];
    return lookAttrs.map((attr) => ({
      label: attr.trait_type,
      value: attr.value,
    }));
  }, [lookAttrs]);
  const coreWarm = Boolean(core?.config);
  const lookWarm = Boolean(lookSvg || lookIncoming);

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
    if (!lookError || isTransientRpcError(lookError)) {
      setLookErrorVisible(null);
      return;
    }
    const delay = lookWarm ? ERROR_DELAY_MS : STARTUP_ERROR_DELAY_MS;
    const id = window.setTimeout(
      () => setLookErrorVisible(lookError),
      delay
    );
    return () => window.clearTimeout(id);
  }, [lookError, lookWarm]);
  const lookMovementDisplay = useMemo(() => {
    const map = new Map<string, string>();
    for (const attr of lookAttrDisplay) {
      const cleaned = attr.value
        .replace(/\bMinted\b\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      map.set(attr.label, cleaned || "—");
    }
    return ["THOUGHT", "WILL", "AWA"].map((label) => ({
      label,
      value: map.get(label) ?? "—",
    }));
  }, [lookAttrDisplay]);
  const bidSvgCache = useRef<Map<number, string>>(new Map());
  const [bidSvgTokenId, setBidSvgTokenId] = useState<number | null>(null);
  const [bidSvg, setBidSvg] = useState<string | null>(null);
  const [bidSvgLoading, setBidSvgLoading] = useState(false);
  const [bidSvgLoadingVisible, setBidSvgLoadingVisible] = useState(false);
  const [bidSvgEmptyVisible, setBidSvgEmptyVisible] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [nowSec, setNowSec] = useState(
    () => fixtureState?.nowSec ?? Date.now() / 1000
  );
  const [fallbackConfig, setFallbackConfig] = useState<null | {
    openTimeSec: number;
    genesisPrice: { dec: string; value: bigint };
    genesisFloor: { dec: string; value: bigint };
    k: { dec: string; value: bigint };
    pts: string;
  }>(null);
  const [fallbackError, setFallbackError] = useState<unknown>(null);
  const loggedCurveRef = useRef(false);
  const lastLoggedEndRef = useRef<number | null>(null);
  lookSvgRef.current = lookSvg;
  lookSlideDirRef.current = lookSlideDir;
  lookSlidePhaseRef.current = lookSlidePhase;
  const maxTokenId = useMemo(() => {
    if (!bids.length) return null;
    let max = 0;
    for (const bid of bids) {
      const id = bid.tokenId ?? bid.epochIndex ?? 0;
      if (id > max) max = id;
    }
    return max > 0 ? max : null;
  }, [bids]);

  // Keep a ticking wall clock so the curve endpoint advances.
  useEffect(() => {
    if (fixtureState) {
      if (fixtureState.nowSec) setNowSec(fixtureState.nowSec);
      return;
    }
    const id = window.setInterval(() => setNowSec(Date.now() / 1000), 1000);
    return () => window.clearInterval(id);
  }, [fixtureState]);

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
          const addr = address ?? resolveAddress("pulse_auction");
          const prov = provider ?? (getDefaultProvider() as any);
          const res: any = await callContract(prov, {
            contractAddress: addr,
            entrypoint: "get_config",
            calldata: [],
          });
          const out: any[] = res?.result ?? res;
          if (!Array.isArray(out) || out.length < 5) {
            throw new Error("unexpected get_config shape");
          }
          const r: any = {
            open_time: out[0],
            genesis_price: { low: out[1], high: out[2] },
            genesis_floor: { low: out[3], high: out[4] },
            k: { low: out[5], high: out[6] },
            pts: out[7],
          };
          if (cancelled) return;
          const open = Number(r.open_time);
          const gp = readU256(r.genesis_price);
          const gf = readU256(r.genesis_floor);
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
    address,
    provider,
    abiSource,
    fallbackConfig,
    fixtureState,
  ]);

  useEffect(() => {
    if (view !== "look") return;
    if (maxTokenId == null) {
      setLookLoading(false);
      setLookError(null);
      setLookSvg(null);
      setLookTitle(null);
      setLookAttrs([]);
      setLookIncoming(null);
      setLookSlidePhase("idle");
      setLookSlideDir(null);
      return;
    }
    let cancelled = false;
    setLookLoading(true);
    setLookError(null);
    (async () => {
      try {
        const nftAddr = resolveAddress("path_nft");
        const prov = provider ?? (getDefaultProvider() as any);
        const [low, high] = splitTokenId(lookTokenId);
        const res: any = await callContract(prov, {
          contractAddress: nftAddr,
          entrypoint: "token_uri",
          calldata: [low, high],
        });
        const raw: string[] | undefined = res?.result ?? res;
        if (!Array.isArray(raw)) {
          throw new Error("unexpected token_uri response");
        }
        const tokenUri = decodeByteArray(raw);
        if (!tokenUri) throw new Error("empty token_uri");
        const meta = parseTokenUri(tokenUri);
        if (!meta?.image) throw new Error("missing image");
        if (cancelled) return;
        const nextData: LookData = {
          svg: meta.image,
          title: meta.name ?? `PATH #${lookTokenId}`,
          attrs: meta.attributes ?? [],
          tokenId: lookTokenId,
        };
        const canSlide =
          !isTestEnv &&
          lookSvgRef.current &&
          lookSlideDirRef.current &&
          lookSlidePhaseRef.current === "idle";
        if (canSlide) {
          setLookIncoming(nextData);
          setLookSlidePhase("prep");
        } else {
          setLookSvg(nextData.svg);
          setLookTitle(nextData.title);
          setLookAttrs(nextData.attrs);
          setLookDisplayTokenId(nextData.tokenId);
          setLookIncoming(null);
          setLookSlidePhase("idle");
          setLookSlideDir(null);
        }
      } catch (err) {
        if (cancelled) return;
        setLookSvg(null);
        setLookTitle(null);
        setLookAttrs([]);
        setLookError(isTransientRpcError(err) ? null : String(err));
        setLookIncoming(null);
        setLookSlidePhase("idle");
        setLookSlideDir(null);
      } finally {
        if (!cancelled) setLookLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, lookTokenId, provider, maxTokenId]);

  useEffect(() => {
    if (lookSlidePhase !== "prep") return;
    const id = window.requestAnimationFrame(() => {
      setLookSlidePhase("animating");
    });
    return () => window.cancelAnimationFrame(id);
  }, [lookSlidePhase]);

  useEffect(() => {
    if (!lookLoading) {
      setLookLoadingVisible(false);
      setLookEmptyVisible(false);
      return;
    }
    const id = window.setTimeout(() => setLookLoadingVisible(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [lookLoading]);

  useEffect(() => {
    if (lookLoading || lookError || lookSvg) {
      setLookEmptyVisible(false);
      return;
    }
    const id = window.setTimeout(() => setLookEmptyVisible(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [lookLoading, lookError, lookSvg]);

  useEffect(() => {
    if (view !== "look") {
      setLookMovementLoadingVisible(false);
      return;
    }
    setLookMovementLoadingVisible(lookLoading);
  }, [view, lookLoading]);

  useEffect(() => {
    if (view !== "look") {
      setLookMovementEmptyVisible(false);
      return;
    }
    setLookMovementEmptyVisible(
      !lookLoading && !lookError && lookAttrs.length === 0
    );
  }, [view, lookLoading, lookError, lookAttrs.length]);

  useEffect(() => {
    if (!lookNotice) return;
    const id = window.setTimeout(() => setLookNotice(null), 1200);
    return () => window.clearTimeout(id);
  }, [lookNotice]);

  useEffect(() => {
    if (view !== "bids") return;
    const tokenId = hover?.tokenId ?? hover?.epoch;
    if (tokenId == null) return;
    const cached = bidSvgCache.current.get(tokenId);
    if (cached) {
      setBidSvgTokenId(tokenId);
      setBidSvg(cached);
      setBidSvgLoading(false);
      setBidSvgLoadingVisible(false);
      setBidSvgEmptyVisible(false);
      return;
    }
    let cancelled = false;
    setBidSvgTokenId(tokenId);
    setBidSvg(null);
    setBidSvgLoading(true);
    setBidSvgLoadingVisible(false);
    setBidSvgEmptyVisible(false);
    (async () => {
      try {
        const nftAddr = resolveAddress("path_nft");
        const prov = provider ?? (getDefaultProvider() as any);
        const [low, high] = splitTokenId(tokenId);
        const res: any = await callContract(prov, {
          contractAddress: nftAddr,
          entrypoint: "token_uri",
          calldata: [low, high],
        });
        const raw: string[] | undefined = res?.result ?? res;
        if (!Array.isArray(raw)) {
          throw new Error("unexpected token_uri response");
        }
        const tokenUri = decodeByteArray(raw);
        if (!tokenUri) throw new Error("empty token_uri");
        const meta = parseTokenUri(tokenUri);
        if (!meta?.image) throw new Error("missing image");
        if (cancelled) return;
        bidSvgCache.current.set(tokenId, meta.image);
        setBidSvg(meta.image);
      } catch {
        if (cancelled) return;
        setBidSvg(null);
      } finally {
        if (!cancelled) setBidSvgLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, hover?.tokenId, hover?.epoch, provider]);

  useEffect(() => {
    if (!bidSvgLoading) {
      setBidSvgLoadingVisible(false);
      return;
    }
    const id = window.setTimeout(() => setBidSvgLoadingVisible(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [bidSvgLoading, bidSvgTokenId]);

  useEffect(() => {
    if (bidSvgLoading || bidSvg) {
      setBidSvgEmptyVisible(false);
      return;
    }
    const id = window.setTimeout(() => setBidSvgEmptyVisible(true), DELAY_MS);
    return () => window.clearTimeout(id);
  }, [bidSvgLoading, bidSvg, bidSvgTokenId]);

  const dots = useMemo(() => {
    if (!bids.length) return { points: [], label: "" };

    // Throttle density: sample when too many
    const step = Math.max(1, Math.ceil(bids.length / 400));
    const sampled: NormalizedBid[] = bids.filter(
      (_: NormalizedBid, idx: number) => idx % step === 0
    );

    const minX = Math.min(...sampled.map((b: NormalizedBid) => b.atMs));
    const maxX = Math.max(...sampled.map((b: NormalizedBid) => b.atMs));
    const minY = Math.min(
      ...sampled.map((b: NormalizedBid) =>
        toNumberSafe(toFixed(b.amount, decimals))
      )
    );
    const maxY = Math.max(
      ...sampled.map((b: NormalizedBid) =>
        toNumberSafe(toFixed(b.amount, decimals))
      )
    );

    const padY = (maxY - minY || 1) * 0.1;
    const viewYMin = minY - padY;
    const viewYMax = maxY + padY;
    const w = 100;
    const h = 60;

    const toSvg = (atMs: number, price: number) => {
      const xN = (atMs - minX) / (maxX - minX || 1);
      const yN = (price - viewYMin) / (viewYMax - viewYMin || 1);
      return { x: xN * w, y: h - yN * h };
    };

    const points: DotPoint[] = sampled.map((b: NormalizedBid) => {
      const decStr = toFixed(b.amount, decimals);
      const p = toSvg(b.atMs, toNumberSafe(decStr));
      return {
        ...p,
        key: b.key,
        bidder: b.bidder,
        amount: decStr,
        amountDec: decStr,
        amountRaw: b.amount.dec,
        atMs: b.atMs,
        block: b.blockNumber,
        epoch: b.epochIndex,
        tokenId: b.tokenId ?? b.epochIndex,
      };
    });

    return { points, w, h };
  }, [bids, decimals]);

  const activeConfig = core?.config ?? fallbackConfig ?? null;

  const { curve, reason } = useMemo<{
    curve: CurveData | null;
    reason: string | null;
  }>(() => {
    if (!activeConfig)
      return {
        curve: null,
        reason: coreLoading
          ? "loading"
          : fallbackError
          ? `fallback error: ${String(fallbackError)}`
          : "no config",
      };
    const kParsed = pickNumber(
      activeConfig.k?.dec,
      (activeConfig as any).k?.value
    );
    const ptsParsed = pickNumber(activeConfig.pts || "0");
    if (!Number.isFinite(kParsed) || !Number.isFinite(ptsParsed)) {
      return {
        curve: null,
        reason: "invalid k/pts",
      };
    }

    const genesisPriceRaw = pickNumber(
      activeConfig.genesisPrice?.dec,
      (activeConfig as any).genesisPrice?.value
    );
    const genesisFloorRaw = pickNumber(
      activeConfig.genesisFloor?.dec,
      (activeConfig as any).genesisFloor?.value
    );

    if (!bids.length) {
      return { curve: null, reason: "no bids" };
    }

    const last = bids[bids.length - 1];
    const prev = bids[bids.length - 2];
    const lastEpoch = (last as any)?.epochIndex ?? (last as any)?.epoch ?? null;
    const isGenesis =
      bids.length === 1 && (lastEpoch == null || lastEpoch === 1);
    const lastDecStr =
      (last as any).amountDec ??
      (() => {
        try {
          return toFixed(last.amount, decimals);
        } catch {
          return String(last.amount?.dec ?? "");
        }
      })();
    const decFactor = Math.pow(10, decimals);

    if (isGenesis) {
      const genesisPriceHuman = Number.isFinite(genesisPriceRaw)
        ? genesisPriceRaw / decFactor
        : Number.NaN;
      const genesisFloorHuman = Number.isFinite(genesisFloorRaw)
        ? genesisFloorRaw / decFactor
        : Number.NaN;
      const premiumHuman = genesisPriceHuman - genesisFloorHuman;
      const kHuman = kParsed / decFactor;
      if (!Number.isFinite(genesisPriceHuman) || !Number.isFinite(genesisFloorHuman)) {
        return { curve: null, reason: "invalid genesis price/floor" };
      }
      if (!Number.isFinite(kHuman) || premiumHuman <= 0) {
        return { curve: null, reason: "invalid genesis gap" };
      }
      const lastSec = last.atMs / 1000;
      const tHalf = kHuman / Math.max(premiumHuman, 1e-9);
      const metaDtSec = Math.max(0, nowSec - lastSec);
      const metaU = tHalf > 0 ? metaDtSec / tHalf : 0;
      const uMax = CURVE_HALF_LIVES;
      const ask = genesisPriceHuman;
      const floor = genesisFloorHuman;
      const priceAtU = (u: number) => floor + premiumHuman / Math.max(u + 1, 1e-9);
      const samples = 120;
      const points: CurvePoint[] = [];
      for (let i = 0; i <= samples; i++) {
        const u = (uMax * i) / samples;
        const tau = u * tHalf;
        const t = lastSec + tau;
        const y = priceAtU(u);
        if (Number.isFinite(y)) points.push({ x: t, y, u });
      }
      const endTau = uMax * tHalf;
      const endT = lastSec + endTau;
      const yEnd = priceAtU(uMax);
      if (Number.isFinite(yEnd)) {
        const lastPoint = points[points.length - 1];
        if (!lastPoint || Math.abs(lastPoint.u - uMax) > 1e-6) {
          points[points.length - 1] = { x: endT, y: yEnd, u: uMax };
        }
      }
      if (!points.length) return { curve: null, reason: "no curve points" };
      const ysAll = [...points.map((p) => p.y), ask, floor];
      const minY = Math.min(...ysAll);
      const maxY = Math.max(...ysAll);
      return {
        curve: {
          points,
          ask,
          floor,
          isGenesis: true,
          startSec: lastSec,
          endSec: lastSec + uMax * tHalf,
          anchor: lastSec - tHalf,
          k: kHuman,
          asymptoteB: floor,
          lastDecStr,
          lastDecValue: Number.isFinite(Number(lastDecStr))
            ? Number(lastDecStr)
            : null,
          askDecStr: Number.isFinite(ask) ? ask.toFixed(2) : lastDecStr,
          floorDecStr: Number.isFinite(floor) ? floor.toFixed(2) : lastDecStr,
          lastEpoch,
          premiumHuman,
          dtSec: 0,
          minX: 0,
          maxX: uMax,
          minY,
          maxY,
          tHalf,
          metaU,
          metaDtSec,
        },
        reason: null,
      };
    }
    const floorHuman = Number(lastDecStr);
    if (!Number.isFinite(floorHuman))
      return { curve: null, reason: "floor nan" };

    const kHuman = kParsed / decFactor; // scale k into price units
    const ptsHumanCfg = ptsParsed / decFactor; // STRK per second (config hint)
    if (!Number.isFinite(kHuman) || !Number.isFinite(ptsHumanCfg)) {
      return { curve: null, reason: "k/pts nan" };
    }

    if (kHuman <= 0 || ptsHumanCfg <= 0) {
      return { curve: null, reason: "non-positive k/pts" };
    }

    const lastSec = last.atMs / 1000;
    const floor = floorHuman;
    // Re-anchor the curve so that at tau=0 we land exactly on the on-chain
    // initial ask (last bid + time premium). For y = k/(t-a) + b, solve a so
    // that y0 = askSeed at t=lastSec.
    const prevSec =
      (prev?.atMs ?? activeConfig.openTimeSec * 1000) / 1000 || lastSec - 1;
    const dtBidSec = Math.max(1, lastSec - prevSec);
    const premiumSeed = ptsHumanCfg * dtBidSec;
    const askSeed = floor + premiumSeed;
    const anchor = lastSec - kHuman / Math.max(askSeed - floor, 1e-9);
    // Half-life for normalization uses config pts (D): T1/2 = k / D
    const premiumHuman = premiumSeed;
    const tHalf = kHuman / Math.max(ptsHumanCfg, 1e-9);
    const metaDtSec = Math.max(0, nowSec - lastSec);
    const metaU = tHalf > 0 ? metaDtSec / tHalf : 0;
    const uMax = CURVE_HALF_LIVES;
    const asymptoteB = floor; // as t → ∞
    const ptsHumanEff = ptsHumanCfg;
    const nowSecTick = lastSec + uMax * tHalf;

    // Current values in real units (on-chain truthful)
    const ask = askSeed;
    const priceAtU = (u: number) => floor + premiumHuman / Math.max(u + 1, 1e-9);
    const samples = 120;
    const points: CurvePoint[] = [];
    for (let i = 0; i <= samples; i++) {
      const u = (uMax * i) / samples;
      const tau = u * tHalf; // seconds since last bid
      const t = lastSec + tau;
      const y = priceAtU(u);
      if (Number.isFinite(y)) points.push({ x: t, y, u });
    }
    // Ensure we end at uMax even if sampling skipped it.
    const endTau = uMax * tHalf;
    const endT = lastSec + endTau;
    const yEnd = priceAtU(uMax);
    if (Number.isFinite(yEnd)) {
      const lastPoint = points[points.length - 1];
      if (!lastPoint || Math.abs(lastPoint.u - uMax) > 1e-6) {
        points[points.length - 1] = { x: endT, y: yEnd, u: uMax };
      }
    }

    if (!points.length) return { curve: null, reason: "no curve points" };

    const minX = 0;
    const maxX = uMax;
    // Debug log to verify endpoints align with wall clock (throttled)
    if (typeof window !== "undefined" && !isTestEnv) {
      const lastPt = points[points.length - 1];
      if (
        lastPt &&
        (lastLoggedEndRef.current === null ||
          Math.abs(lastLoggedEndRef.current - lastPt.u) > 0.1)
      ) {
        lastLoggedEndRef.current = lastPt.u;
        console.log("[curve]", {
          lastSec,
          endSec: lastSec + uMax * tHalf,
          nowSec: Date.now() / 1000,
          lastDate: new Date(lastSec * 1000).toString(),
          endDate: new Date((lastSec + uMax * tHalf) * 1000).toString(),
          lastPoint: { u: lastPt.u, x: lastPt.x, y: lastPt.y },
          tHalf,
        });
      }
    }
    const ysAll = [...points.map((p) => p.y), ask, floor, asymptoteB];
    const minY = Math.min(...ysAll);
    const maxY = Math.max(...ysAll);

    const curveObj = {
      curve: {
        points,
        ask,
        floor,
        isGenesis: false,
        startSec: lastSec,
        endSec: lastSec + uMax * tHalf,
        anchor: lastSec - tHalf,
        k: kHuman,
        asymptoteB,
        lastDecStr,
        lastDecValue: Number.isFinite(Number(lastDecStr))
          ? Number(lastDecStr)
          : null,
        askDecStr: Number.isFinite(ask) ? ask.toFixed(2) : lastDecStr,
        floorDecStr: Number.isFinite(floor) ? floor.toFixed(2) : lastDecStr,
        lastEpoch: (last as any)?.epochIndex ?? (last as any)?.epoch ?? null,
        premiumHuman,
        dtSec: dtBidSec,
        ptsHuman: ptsHumanEff,
        minX,
        maxX,
        minY,
        maxY,
        tHalf,
        metaU,
        metaDtSec,
      },
      reason: null,
    };
    if (typeof window !== "undefined" && !loggedCurveRef.current) {
      loggedCurveRef.current = true;
    }
    return curveObj;
  }, [bids, coreLoading, activeConfig, fallbackError, decimals, nowSec]);

  const showBids = view === "bids";
  const showCurve = view === "curve";
  const showLook = view === "look";
  const isGenesisCurve = Boolean(curve?.isGenesis);
  const { status: auctionStatus, openAtLabel } = useAuctionStatus({
    nowSec,
    openTimeSec: activeConfig?.openTimeSec,
    coreActive: core?.active,
    coreLoading,
    coreErrorVisible,
    bidsLength: bids.length,
  });
  const showPreOpenNotice = showCurve && auctionStatus === "pre_open";
  const showGenesisWaiting = showCurve && auctionStatus === "genesis_waiting";
  const showCurveLoading = showCurve && auctionStatus === "loading";
  const lookSliding =
    lookSlidePhase !== "idle" &&
    Boolean(lookIncoming && lookSvg && lookSlideDir);
  const currentLookTitle = lookTitle ?? `PATH #${lookDisplayTokenId}`;
  const slideIsPrev = lookSlideDir === "prev";
  const lookTrackTransform =
    lookSlidePhase === "prep"
      ? slideIsPrev
        ? "translateX(-100%)"
        : "translateX(0%)"
      : lookSlidePhase === "animating"
      ? slideIsPrev
        ? "translateX(0%)"
        : "translateX(-100%)"
      : "translateX(0%)";
  const lookTrackTransition =
    lookSlidePhase === "animating" ? "transform 420ms ease" : "none";

  useEffect(() => {
    if (view !== "look") return;
    if (maxTokenId != null && lookDisplayTokenId > maxTokenId) {
      setLookTokenId(maxTokenId);
      setLookDisplayTokenId(maxTokenId);
    }
  }, [view, maxTokenId, lookDisplayTokenId]);

  const handleMint = async () => {
    if (!account || !walletAddress) return;
    try {
      const auctionAddr = address ?? resolveAddress("pulse_auction");
      const paymentToken = resolvePaymentToken();
      const readProvider =
        provider ?? (getDefaultProvider() as ProviderInterface);
      const priceRes: any = await callContract(readProvider, {
        contractAddress: auctionAddr,
        entrypoint: "get_current_price",
        calldata: [],
      });
      const price = toU256Num(
        readU256(priceRes?.price ?? priceRes?.[0] ?? priceRes)
      );
      const balanceRes: any = await callContract(readProvider, {
        contractAddress: paymentToken,
        entrypoint: "balance_of",
        calldata: [walletAddress],
      });
      const balance = toU256Num(
        readU256(balanceRes?.balance ?? balanceRes?.[0] ?? balanceRes)
      );
      if (balance.value < price.value) {
        console.warn("mint failed: insufficient STRK", {
          balance: balance.dec,
          price: price.dec,
        });
        return;
      }
      const allowanceRes: any = await callContract(readProvider, {
        contractAddress: paymentToken,
        entrypoint: "allowance",
        calldata: [walletAddress, auctionAddr],
      });
      const allowance = toU256Num(
        readU256(
          allowanceRes?.remaining ?? allowanceRes?.[0] ?? allowanceRes
        )
      );
      if (allowance.value < price.value) {
        await account.execute({
          contractAddress: paymentToken,
          entrypoint: "approve",
          calldata: [auctionAddr, price.raw.low, price.raw.high],
        });
      }
      await account.execute({
        contractAddress: auctionAddr,
        entrypoint: "bid",
        calldata: [price.raw.low, price.raw.high],
      });
    } catch (err) {
      console.error("mint failed", err);
    }
  };

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
        <h1 className="headline dotfield__title thin">$PATH</h1>
        <div className="dotfield__tabs">
          <button
            className={`dotfield__tab ${showBids ? "is-active" : ""}`}
            onClick={() => {
              setHover(null);
              setView("bids");
            }}
          >
            bids
          </button>
          <span className="dotfield__tab-sep">|</span>
          <button
            className={`dotfield__tab ${showCurve ? "is-active" : ""}`}
            onClick={() => {
              setHover(null);
              setView("curve");
            }}
          >
            curve
          </button>
          <span className="dotfield__tab-sep">|</span>
          <button
            className={`dotfield__tab ${showLook ? "is-active" : ""}`}
            onClick={() => {
              setHover(null);
              setLookTokenId(1);
              setLookDisplayTokenId(1);
              setLookSvg(null);
              setLookTitle(null);
              setLookAttrs([]);
              setLookIncoming(null);
              setLookSlideDir(null);
              setLookSlidePhase("idle");
              setLookError(null);
              setView("look");
            }}
          >
            look
          </button>
        </div>
        <HeaderWalletCTA onMint={handleMint} />
      </div>
      {showCurve && (
        <>
          {showPreOpenNotice && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">
                Auction will open at {openAtLabel ?? "—"}
              </div>
            </div>
          )}
          {showGenesisWaiting && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">Genesis is waiting for bid</div>
            </div>
          )}
          {showCurveLoading && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">loading curve…</div>
            </div>
          )}
          {coreErrorVisible && !curve && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">
                error loading curve: {String(coreErrorVisible)}
              </div>
            </div>
          )}
          {curve && (
            <>
              <div className="dotfield__canvas" onMouseLeave={() => setHover(null)}>
                <svg
                  viewBox={`0 0 100 60`}
                  role="img"
                  aria-label="Pulse curve"
                  ref={svgRef}
                >
                  {(() => {
                    const pts = curve.points;
                    if (!pts.length) return null;
                    const minX = 0;
                    const maxX = Math.max(...pts.map((p: any) => (p.u ?? p.x) || 0), curve.maxX ?? 0);
                    const ys = [
                      ...pts.map((p) => p.y),
                      curve.ask,
                      curve.floor,
                    ];
                    const minYRaw = Math.min(...ys);
                    const maxYRaw = Math.max(...ys);
                    const pad = (maxYRaw - minYRaw || 1) * 0.15;
                    const minY = minYRaw - pad;
                    const maxY = maxYRaw + pad;
                    const toSvg = (x: number, y: number) => {
                      const xN = (x - minX) / (maxX - minX || 1);
                      const yN = (y - minY) / (maxY - minY || 1);
                      return { x: xN * 100, y: 60 - yN * 60 };
                    };
                    const pathD = pts
                      .map((p, i) => {
                        const xVal = (p as any).u ?? p.x;
                        const { x, y } = toSvg(xVal, p.y);
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ");
                    const askPt = toSvg(pts[0].u ?? 0, pts[0].y ?? curve.ask);
                    const floorPt = toSvg(0, curve.floor);
                    const lastDecStr = (curve as any).lastDecStr ?? "";
                    const askDecStr = (curve as any).askDecStr ?? lastDecStr;
                    const floorDecStr =
                      (curve as any).floorDecStr ?? lastDecStr;
                    const lastEpoch = (curve as any).lastEpoch ?? null;
                    return (
                      <>
                        <circle
                          cx={askPt.x}
                          cy={askPt.y}
                          r={0.4}
                          className="dotfield__ask"
                        />
                        <circle
                          cx={askPt.x}
                          cy={askPt.y}
                          r={1.2}
                          fill="transparent"
                          onMouseMove={(e) =>
                            setHover({
                              key: "ask",
                              x: askPt.x,
                              y: askPt.y,
                              screenX: e.clientX + 8,
                              screenY: e.clientY + 8,
                              amount: askDecStr,
                              amountDec: askDecStr,
                              amountRaw: askDecStr,
                              epoch: lastEpoch ?? undefined,
                              atMs:
                                curve.startSec * 1000 +
                                ((curve as any).metaDtSec ?? 0) * 1000,
                              lastSec: curve.startSec,
                              anchor: (curve as any).anchor,
                              kHuman: (curve as any).k,
                              floorHuman: curve.floor,
                              durationSec: (curve as any).metaDtSec ?? 0,
                              metaDtSec: (curve as any).metaDtSec ?? 0,
                              beforeNowSec: Math.max(
                                0,
                                (curve as any).metaDtSec ?? 0 -
                                  ((curve as any).metaDtSec ?? 0)
                              ),
                              hoverSetSec: Date.now() / 1000,
                            })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
                        <path
                          className="dotfield__curve"
                          d={pathD}
                          vectorEffect="non-scaling-stroke"
                          onMouseMove={(e) => {
                            const svg = svgRef.current;
                            if (!svg || !curve?.points?.length) return;
                            const ctm = svg.getScreenCTM();
                            let xN = 0;
                            if (ctm) {
                              const pt = svg.createSVGPoint();
                              pt.x = e.clientX;
                              pt.y = e.clientY;
                              const loc = pt.matrixTransform(ctm.inverse());
                              const xPos = Math.min(100, Math.max(0, loc.x));
                              xN = xPos / 100;
                            }
                            const minX = 0;
                            const maxX =
                              curve.endSec && curve.startSec
                                ? (curve.endSec - curve.startSec) /
                                  Math.max((curve as any).tHalf ?? 1, 1)
                                : curve.points[curve.points.length - 1].u ?? 0;
                            const dataX = minX + (maxX - minX) * xN;
                            const clampedX = Math.min(
                              maxX,
                              Math.max(minX, dataX)
                            );
                            const ptsArr = curve.points;
                            let yAt = ptsArr[0].y;
                            if (clampedX <= ((ptsArr[0] as any).u ?? ptsArr[0].x)) {
                              yAt = ptsArr[0].y;
                            } else if (
                              clampedX >=
                              ((ptsArr[ptsArr.length - 1] as any).u ??
                                ptsArr[ptsArr.length - 1].x)
                            ) {
                              yAt = ptsArr[ptsArr.length - 1].y;
                            } else {
                              for (let i = 1; i < ptsArr.length; i++) {
                                const prev = ptsArr[i - 1];
                                const next = ptsArr[i];
                                const prevX = (prev as any).u ?? prev.x;
                                const nextX = (next as any).u ?? next.x;
                                if (clampedX >= prevX && clampedX <= nextX) {
                                  const span = nextX - prevX || 1;
                                  const t = (clampedX - prevX) / span;
                                  yAt = prev.y + (next.y - prev.y) * t;
                                  break;
                                }
                              }
                            }
                            const tHalf = (curve as any).tHalf ?? 1;
                            const timeU = clampedX;
                            const metaDt = (curve as any).metaDtSec ?? 0;
                            const tau = Math.max(0, timeU * tHalf); // seconds since last bid at this point
                            const atMs =
                              (curve.startSec ?? 0) * 1000 + tau * 1000;
                            const amountStr = Number.isFinite(yAt)
                              ? yAt.toFixed(2)
                              : (curve as any).askDecStr ?? "";
                            const secondsSinceBid = Math.max(0, tau);
                            const secondsBeforeNow = Math.max(
                              0,
                              metaDt - tau
                            );
                          setHover({
                            key: "curve-point",
                            x: 0,
                            y: 0,
                            screenX: e.clientX + 8,
                            screenY: e.clientY + 8,
                            amount: amountStr,
                            amountDec: amountStr,
                            amountRaw: amountStr,
                            atMs,
                            lastSec: curve.startSec,
                            anchor: (curve as any).anchor,
                            kHuman: (curve as any).k,
                            floorHuman: curve.floor,
                            durationSec: secondsSinceBid,
                            metaDtSec: metaDt,
                            beforeNowSec: secondsBeforeNow,
                            hoverSetSec: Date.now() / 1000,
                            tHalf,
                          });
                          }}
                          onMouseLeave={() => setHover(null)}
                        />
                        {!isGenesisCurve && (
                          <>
                            <line
                              x1={askPt.x}
                              y1={askPt.y}
                              x2={floorPt.x}
                              y2={floorPt.y}
                              stroke="var(--accent)"
                              strokeDasharray="0.4 2"
                              strokeWidth={1.1}
                              vectorEffect="non-scaling-stroke"
                              onMouseMove={(e) =>
                                setHover({
                                  key: "premium",
                                  x: (askPt.x + floorPt.x) / 2,
                                  y: (askPt.y + floorPt.y) / 2,
                                  screenX: e.clientX + 8,
                                  screenY: e.clientY + 8,
                                  amount:
                                    (curve as any).premiumHuman != null
                                      ? (curve as any).premiumHuman.toFixed(2)
                                      : "",
                                  amountRaw:
                                    (curve as any).premiumHuman != null
                                      ? (curve as any).premiumHuman.toString()
                                      : "",
                                  durationSec: (curve as any).dtSec ?? 0,
                                  ptsHuman: (curve as any).ptsHuman ?? undefined,
                                  epoch: lastEpoch ?? undefined,
                                  atMs: curve.startSec * 1000,
                                })
                              }
                              onMouseLeave={() => setHover(null)}
                            />
                            {/* pumped premium vertical line */}
                            <line
                              x1={floorPt.x}
                              y1={floorPt.y}
                              x2={floorPt.x}
                              y2={askPt.y}
                              stroke="var(--accent)"
                              strokeDasharray="0.4 2"
                              strokeWidth={0.9}
                              vectorEffect="non-scaling-stroke"
                              onMouseMove={(e) =>
                                setHover({
                                  key: "premium",
                                  x: floorPt.x,
                                  y: (askPt.y + floorPt.y) / 2,
                                  screenX: e.clientX + 8,
                                  screenY: e.clientY + 8,
                                  amount:
                                    (curve as any).premiumHuman?.toFixed(2) ??
                                    "",
                                  amountRaw:
                                    (curve as any).premiumHuman?.toString() ??
                                    "",
                                  durationSec: (curve as any).dtSec ?? 0,
                                  ptsHuman: (curve as any).ptsHuman ?? undefined,
                                  epoch: lastEpoch ?? undefined,
                                  atMs: curve.startSec * 1000,
                                })
                              }
                              onMouseLeave={() => setHover(null)}
                            />
                            <line
                              x1={floorPt.x}
                              y1={floorPt.y}
                              x2={floorPt.x}
                              y2={askPt.y}
                              stroke="transparent"
                              strokeWidth={4}
                              vectorEffect="non-scaling-stroke"
                              onMouseMove={(e) =>
                                setHover({
                                  key: "premium",
                                  x: floorPt.x,
                                  y: (askPt.y + floorPt.y) / 2,
                                  screenX: e.clientX + 8,
                                  screenY: e.clientY + 8,
                                  amount:
                                    (curve as any).premiumHuman?.toFixed(2) ??
                                    "",
                                  amountRaw:
                                    (curve as any).premiumHuman?.toString() ??
                                    "",
                                  durationSec: (curve as any).dtSec ?? 0,
                                  ptsHuman: (curve as any).ptsHuman ?? undefined,
                                  epoch: lastEpoch ?? undefined,
                                  atMs: curve.startSec * 1000,
                                })
                              }
                              onMouseLeave={() => setHover(null)}
                            />
                          </>
                        )}
                        <circle
                          cx={askPt.x}
                          cy={askPt.y}
                          r={0.4}
                          className="dotfield__ask"
                          onMouseMove={(e) =>
                            setHover({
                              key: "ask",
                              x: askPt.x,
                              y: askPt.y,
                              screenX: e.clientX + 8,
                              screenY: e.clientY + 8,
                              amount: askDecStr,
                              amountDec: askDecStr,
                              amountRaw: askDecStr,
                              epoch: lastEpoch ?? undefined,
                              atMs:
                                curve.startSec * 1000 +
                                ((curve as any).metaDtSec ?? 0) * 1000,
                              lastSec: curve.startSec,
                              anchor: (curve as any).anchor,
                              kHuman: (curve as any).k,
                              floorHuman: curve.floor,
                              durationSec: (curve as any).metaDtSec ?? 0,
                              metaDtSec: (curve as any).metaDtSec ?? 0,
                            })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
                        <circle
                          cx={askPt.x}
                          cy={askPt.y}
                          r={1.2}
                          fill="transparent"
                          onMouseMove={(e) =>
                            setHover({
                              key: "ask",
                              x: askPt.x,
                              y: askPt.y,
                              screenX: e.clientX + 8,
                              screenY: e.clientY + 8,
                              amount: askDecStr,
                              amountDec: askDecStr,
                              amountRaw: askDecStr,
                              epoch: lastEpoch ?? undefined,
                              atMs: curve.startSec * 1000,
                              lastSec: curve.startSec,
                              anchor: (curve as any).anchor,
                              kHuman: (curve as any).k,
                              floorHuman: curve.floor,
                            })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
                        {/* premium lines omitted during genesis */}
                        <circle
                          cx={floorPt.x}
                          cy={floorPt.y}
                          r={0.5}
                          className="dotfield__dot"
                          onMouseMove={(e) =>
                            setHover({
                              key: "floor",
                              x: floorPt.x,
                              y: floorPt.y,
                              screenX: e.clientX + 8,
                              screenY: e.clientY + 8,
                              amount: floorDecStr,
                              amountDec: floorDecStr,
                              amountRaw: floorDecStr,
                              epoch: lastEpoch ?? undefined,
                              atMs: curve.startSec * 1000,
                            })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
              {hover && (
                <div
                  className="dotfield__popover"
                  style={{ left: hover.screenX, top: hover.screenY }}
                >
                  <div className="muted small">
                    {hover.key === "ask"
                      ? "initial ask"
                      : hover.key === "curve-point"
                      ? "ask"
                      : hover.key === "premium"
                      ? "time premium"
                      : hover.key === "floor" && isGenesisCurve
                      ? "genesis floor"
                      : (() => {
                          const idx = hover.epoch ?? hover.key?.split("#")[1];
                          return `last sale · #${idx ?? "—"}`;
                        })()}
                    </div>
                    <div className="dotfield__poprow">
                      <span>price</span>
                      <span>
                          {hover.key === "premium"
                            ? (() => {
                                const raw =
                                  (hover as any).amountRaw ??
                                  hover.amount ??
                                  "0";
                                const n = Number(String(raw).replace(/,/g, ""));
                                if (Number.isFinite(n)) {
                                  const withSep = new Intl.NumberFormat(
                                    "en-US",
                                    {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 0,
                                    }
                                  ).format(n);
                                  return `${withSep} STRK`;
                                }
                                return `${String(raw)} STRK`;
                              })()
                            : formatAmount(
                                (hover as any).amountRaw ?? hover.amount,
                                decimals
                              )}
                    </span>
                  </div>
                  {hover.key === "ask" && (
                    <div className="dotfield__poprow">
                      <span>premium vs floor</span>
                      <span>
                        {hover.floorHuman != null && hover.amountRaw
                          ? (() => {
                              const f = Number((hover as any).floorHuman);
                              const amt = Number((hover as any).amountRaw);
                              if (Number.isFinite(f) && Number.isFinite(amt) && f > 0) {
                                const pct = ((amt - f) / f) * 100;
                                return formatPercent(pct);
                              }
                              return "—";
                            })()
                          : "—"}
                      </span>
                    </div>
                  )}
                  {hover.key === "curve-point" && (
                    <div className="dotfield__poprow">
                      <span>premium vs floor</span>
                      <span>
                        {hover.floorHuman != null && hover.amountRaw
                          ? (() => {
                              const f = Number((hover as any).floorHuman);
                              const amt = Number((hover as any).amountRaw);
                              if (Number.isFinite(f) && Number.isFinite(amt) && f > 0) {
                                const pct = ((amt - f) / f) * 100;
                                return formatPercent(pct);
                              }
                              return "—";
                            })()
                          : "—"}
                      </span>
                    </div>
                  )}
                  {!isGenesisCurve && hover.key === "premium" && (
                    <>
                      <div className="dotfield__poprow">
                        <span>duration</span>
                        <span>{formatDuration(hover.durationSec ?? 0)}</span>
                      </div>
                      <div className="dotfield__poprow">
                        <span>PTS</span>
                        <span>
                          {hover.ptsHuman != null
                            ? hover.ptsHuman.toFixed(0)
                            : "—"}
                        </span>
                      </div>
                      <div className="dotfield__note" style={{ marginTop: 4 }}>
                        amount = duration × PTS
                      </div>
                    </>
                  )}
                  {hover.key !== "premium" &&
                    !(isGenesisCurve && hover.key === "floor") && (
                    <div className="dotfield__poprow">
                      <span>time</span>
                      <span>{formatLocalTime(hover.atMs)}</span>
                    </div>
                  )}
                  {hover.key !== "ask" &&
                    hover.key !== "curve-point" &&
                    hover.key !== "premium" &&
                    !isGenesisCurve && (
                      <div className="dotfield__note" style={{ marginTop: 4 }}>
                        sets floor b for this curve
                      </div>
                  )}
                  {hover.key === "curve-point" && (
                    <>
                      <div className="dotfield__poprow">
                        <span>since last sale</span>
                        <span>
                          {formatHms((hover as any).durationSec ?? 0)}
                        </span>
                      </div>
                      <div className="dotfield__poprow">
                        <span>ago</span>
                        <span>
                          {formatHms(
                            Math.max(
                              0,
                              ((hover as any).beforeNowSec ?? 0) +
                                Math.max(
                                  0,
                                  (Date.now() / 1000) -
                                    ((hover as any).hoverSetSec ?? 0)
                                )
                            )
                          )}
                        </span>
                      </div>
                      <div className="dotfield__poprow">
                        <span>half-lives</span>
                        <span>
                          {(() => {
                            const u =
                              (hover as any).durationSec != null &&
                              (hover as any).tHalf != null
                                ? ((hover as any).durationSec ?? 0) /
                                  Math.max((hover as any).tHalf ?? 1, 1e-9)
                                : 0;
                            return `${u.toFixed(5)}`;
                          })()}
                        </span>
                      </div>
                      <div className="dotfield__note" style={{ marginTop: 4 }}>
                        y = k/(t-a)+b
                      </div>
                      <div className="dotfield__note">
                        k = {(hover as any).kHuman ?? "?"}
                      </div>
                      <div className="dotfield__note">
                        a = {(hover as any).anchor ?? "?"}
                      </div>
                      <div className="dotfield__note">
                        b = {(hover as any).floorHuman ?? "?"}
                      </div>
                    </>
                  )}
                  {!isGenesisCurve && hover.key === "ask" && (
                    <>
                      <div className="dotfield__note" style={{ marginTop: 4 }}>
                        amount = floor b + time premium
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {showCurve && (
        <div className="dotfield__axes muted small">
          <span>time (half-lives) →</span>
          <span>price ↑</span>
        </div>
      )}

      {showLook && (
        <>
          <div className="dotfield__canvas dotfield__look">
            {lookLoadingVisible && !lookSvg && !lookIncoming && (
              <div className="muted">loading svg…</div>
            )}
          {lookErrorVisible && (
            <div className="muted">error loading look: {lookErrorVisible}</div>
          )}
            {!lookError && (lookSvg || lookIncoming) && (
              <div
                className="dotfield__look-viewport"
                onMouseMove={(e) =>
                  setLookHover({ x: e.clientX + 8, y: e.clientY + 8 })
                }
                onMouseLeave={() => setLookHover(null)}
              >
                {lookSliding ? (
                  <div
                    className="dotfield__look-track"
                    style={{
                      transform: lookTrackTransform,
                      transition: lookTrackTransition,
                    }}
                    onTransitionEnd={(event) => {
                      if (event.propertyName !== "transform") return;
                      if (!lookIncoming) return;
                      setLookSvg(lookIncoming.svg);
                      setLookTitle(lookIncoming.title);
                      setLookAttrs(lookIncoming.attrs);
                      setLookDisplayTokenId(lookIncoming.tokenId);
                      setLookIncoming(null);
                      setLookSlidePhase("idle");
                      setLookSlideDir(null);
                    }}
                  >
                    {slideIsPrev ? (
                      <>
                        <div className="dotfield__look-frame">
                          <img
                            className="dotfield__look-img"
                            src={lookIncoming!.svg}
                            alt={lookIncoming!.title}
                          />
                        </div>
                        <div className="dotfield__look-frame">
                          <img
                            className="dotfield__look-img"
                            src={lookSvg!}
                            alt={currentLookTitle}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="dotfield__look-frame">
                          <img
                            className="dotfield__look-img"
                            src={lookSvg!}
                            alt={currentLookTitle}
                          />
                        </div>
                        <div className="dotfield__look-frame">
                          <img
                            className="dotfield__look-img"
                            src={lookIncoming!.svg}
                            alt={lookIncoming!.title}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <img
                    className="dotfield__look-img"
                    src={lookSvg ?? lookIncoming?.svg ?? ""}
                    alt={currentLookTitle}
                  />
                )}
              </div>
            )}
            {lookEmptyVisible && !lookSvg && !lookIncoming && (
              <div className="muted">no svg yet</div>
            )}
            <button
              className="dotfield__look-nav dotfield__look-prev"
              data-disabled={
                lookLoading ||
                lookSliding ||
                maxTokenId == null ||
                lookDisplayTokenId <= 1
              }
              aria-disabled={
                lookLoading ||
                lookSliding ||
                maxTokenId == null ||
                lookDisplayTokenId <= 1
              }
              onClick={() => {
                if (lookLoading || lookSliding) return;
                if (lookDisplayTokenId <= 1) {
                  setLookNotice({ text: "no more", side: "left" });
                  return;
                }
                setLookSlideDir("prev");
                setLookTokenId(Math.max(1, lookDisplayTokenId - 1));
              }}
              aria-label="Previous token"
            >
              &lt;
            </button>
            <button
              className="dotfield__look-nav dotfield__look-next"
              data-disabled={
                lookLoading ||
                lookSliding ||
                maxTokenId == null ||
                (maxTokenId != null && lookDisplayTokenId >= maxTokenId)
              }
              aria-disabled={
                lookLoading ||
                lookSliding ||
                maxTokenId == null ||
                (maxTokenId != null && lookDisplayTokenId >= maxTokenId)
              }
              onClick={() => {
                if (lookLoading || lookSliding) return;
                if (maxTokenId != null && lookDisplayTokenId >= maxTokenId) {
                  setLookNotice({ text: "no more", side: "right" });
                  return;
                }
                setLookSlideDir("next");
                setLookTokenId(lookDisplayTokenId + 1);
              }}
              aria-label="Next token"
            >
              &gt;
            </button>
            {lookNotice && (
              <div
                className={`dotfield__look-notice dotfield__look-notice--${lookNotice.side}`}
              >
                {lookNotice.text}
              </div>
            )}
            {!lookLoading &&
              !lookError &&
              lookAttrDisplay.length > 0 &&
              lookHover && (
                <div
                  className="dotfield__popover"
                  style={{ left: lookHover.x, top: lookHover.y }}
                >
                  <div className="muted small">attributes</div>
                  {lookAttrDisplay.map((attr, idx) => (
                    <div className="dotfield__poprow" key={`${attr.label}-${idx}`}>
                      <span>{attr.label}</span>
                      <span>{attr.value}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <div className="dotfield__axes muted small dotfield__look-axes">
            <span>token #{lookDisplayTokenId}</span>
            <span className="dotfield__look-axes-right">
              {lookMovementDisplay.map((movement) => (
                <span key={movement.label}>
                  {movement.label}
                  {lookAttrs.length
                    ? movement.value
                    : lookMovementLoadingVisible
                    ? "loading..."
                    : lookMovementEmptyVisible
                    ? "—"
                    : ""}
                </span>
              ))}
            </span>
          </div>
        </>
      )}

      {showBids && (
        <>
          {!ready && loading && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">loading bids…</div>
            </div>
          )}
          {ready && !dots.points.length && (
            <div className="dotfield__canvas dotfield__look">
              <div className="muted">no bids yet</div>
            </div>
          )}
          {ready && dots.points.length > 0 && (
            <>
              <div
                className="dotfield__canvas"
                onMouseLeave={() => setHover(null)}
              >
                <svg
                  viewBox={`0 0 ${dots.w} ${dots.h}`}
                  role="img"
                  aria-label="Pulse dots"
                >
                  {dots.points.map((p) => (
                    <g key={p.key} className="dotfield__point">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="0.5"
                        className="dotfield__dot"
                        onMouseMove={(e) => {
                          setHover({
                            ...p,
                            screenX: e.clientX + 8,
                            screenY: e.clientY + 8,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="0.65"
                        className="dotfield__halo"
                      />
                    </g>
                  ))}
                </svg>
                {hover && (
                  <div
                    className="dotfield__popover"
                    style={{ left: hover.screenX, top: hover.screenY }}
                  >
                    <div className="muted small">
                      {hover.epoch === 1
                        ? "sale #1 · genesis"
                        : `sale #${hover.epoch ?? "—"}`}
                    </div>
                    <div className="dotfield__popover-body">
                      <div className="dotfield__popover-thumb">
                        {(() => {
                          const tokenId = hover.tokenId ?? hover.epoch;
                          if (tokenId == null) {
                            return <div className="muted small">no svg</div>;
                          }
                          if (
                            bidSvgLoadingVisible &&
                            bidSvgTokenId === tokenId
                          ) {
                            return <div className="muted small">loading...</div>;
                          }
                          if (bidSvg && bidSvgTokenId === tokenId) {
                            return <img src={bidSvg} alt={`PATH #${tokenId}`} />;
                          }
                          if (bidSvgEmptyVisible && bidSvgTokenId === tokenId) {
                            return <div className="muted small">no svg</div>;
                          }
                          return null;
                        })()}
                      </div>
                      <div className="dotfield__popover-meta">
                        <div className="dotfield__poprow">
                          <span>price</span>
                          <span>
                            {formatAmount(
                              hover.amountDec ?? hover.amount,
                              decimals
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
                    </div>
                    <div className="dotfield__note" style={{ marginTop: 4 }}>
                      {hover.epoch === 1
                        ? "mints the first $PATH and starts the first curve"
                        : "mints 1 $PATH and starts the next curve"}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {ready && (
            <div className="dotfield__axes muted small">
              <span>time →</span>
              <span>price ↑</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

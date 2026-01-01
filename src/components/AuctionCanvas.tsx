import { useEffect, useMemo, useRef, useState } from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import type { ProviderInterface } from "starknet";
import { toFixed } from "@/num";
import type { AbiSource, AuctionSnapshot } from "@/types/types";
import type { NormalizedBid } from "@/services/auction/bidsService";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { resolveAddress } from "@/protocol/addressBook";
import { getDefaultProvider } from "@/protocol/contracts";
import { readU256, toU256Num } from "@/num";
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
  const {
    bids: bidsHook,
    ready: bidsReady,
    loading: bidsLoading,
  } = useAuctionBids({
    address: address ?? "0x0",
    provider,
    refreshMs,
    enabled: !fixtureState && Boolean(address),
    maxBids,
  });
  const {
    data: coreData,
    ready: coreReadyHook,
    loading: coreLoadingHook,
    error: coreErrorHook,
    refresh: refreshCoreHook,
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
  const coreReady = fixtureState ? true : coreReadyHook;
  const coreLoading = fixtureState ? false : coreLoadingHook;
  const coreError = fixtureState ? null : coreErrorHook;
  const refreshCore = useMemo(
    () => (fixtureState ? async () => {} : refreshCoreHook),
    [fixtureState, refreshCoreHook]
  );

  const [hover, setHover] = useState<DotPoint | null>(null);
  const [view, setView] = useState<"curve" | "bids" | "look">("curve");
  const [lookTokenId, setLookTokenId] = useState(1);
  const [lookSvg, setLookSvg] = useState<string | null>(null);
  const [lookTitle, setLookTitle] = useState<string | null>(null);
  const [lookLoading, setLookLoading] = useState(false);
  const [lookLoadingVisible, setLookLoadingVisible] = useState(false);
  const [lookEmptyVisible, setLookEmptyVisible] = useState(false);
  const [lookError, setLookError] = useState<string | null>(null);
  const [lookAttrs, setLookAttrs] = useState<MetaAttribute[]>([]);
  const [lookHover, setLookHover] = useState<{ x: number; y: number } | null>(
    null
  );
  const [lookNotice, setLookNotice] = useState<{
    text: string;
    side: "left" | "right";
  } | null>(null);
  const lookAttrDisplay = useMemo(() => {
    if (!lookAttrs.length) return [];
    const labelMap: Record<string, string> = {
      Steps: "segments",
      Voice: "stroke-width",
      Tension: "sharpness",
      Margin: "padding-pct",
      Breath: "sigma",
    };
    return lookAttrs.map((attr) => ({
      label: labelMap[attr.trait_type] ?? attr.trait_type,
      value: attr.value.replace(/Manifested/gi, "Minted"),
    }));
  }, [lookAttrs]);
  const lookMovementDisplay = useMemo(() => {
    const map = new Map<string, string>();
    for (const attr of lookAttrDisplay) {
      const cleaned = attr.value
        .replace(/\b(?:Minted|Manifested)\b/gi, "")
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

  // If the core service is ready but data hasn't landed, trigger a fetch.
  useEffect(() => {
    if (fixtureState) return;
    if (coreReady && !core && !coreLoading) {
      void refreshCore();
    }
  }, [coreReady, core, coreLoading, refreshCore, fixtureState]);

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
    let cancelled = false;
    if (core?.config) {
      if (fallbackConfig) setFallbackConfig(null);
      return;
    }
    (async () => {
      try {
        setFallbackError(null);
        const addr = address ?? resolveAddress("pulse_auction");
        const prov = provider ?? (getDefaultProvider() as any);
        const res: any = await prov.callContract({
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
    return () => {
      cancelled = true;
    };
  }, [core, address, provider, abiSource, fallbackConfig, fixtureState]);

  useEffect(() => {
    if (view !== "look") return;
    let cancelled = false;
    setLookLoading(true);
    setLookError(null);
    setLookAttrs([]);
    (async () => {
      try {
        const nftAddr = resolveAddress("path_nft");
        const prov = provider ?? (getDefaultProvider() as any);
        const [low, high] = splitTokenId(lookTokenId);
        const res: any = await prov.callContract({
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
        setLookSvg(meta.image);
        setLookTitle(meta.name ?? `PATH #${lookTokenId}`);
        setLookAttrs(meta.attributes ?? []);
      } catch (err) {
        if (cancelled) return;
        setLookSvg(null);
        setLookTitle(null);
        setLookAttrs([]);
        setLookError(String(err));
      } finally {
        if (!cancelled) setLookLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, lookTokenId, provider]);

  useEffect(() => {
    if (!lookLoading) {
      setLookLoadingVisible(false);
      setLookEmptyVisible(false);
      return;
    }
    const id = window.setTimeout(() => setLookLoadingVisible(true), 300);
    return () => window.clearTimeout(id);
  }, [lookLoading]);

  useEffect(() => {
    if (lookLoading || lookError || lookSvg) {
      setLookEmptyVisible(false);
      return;
    }
    const id = window.setTimeout(() => setLookEmptyVisible(true), 300);
    return () => window.clearTimeout(id);
  }, [lookLoading, lookError, lookSvg]);

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
      return;
    }
    let cancelled = false;
    setBidSvgTokenId(tokenId);
    setBidSvg(null);
    setBidSvgLoading(true);
    (async () => {
      try {
        const nftAddr = resolveAddress("path_nft");
        const prov = provider ?? (getDefaultProvider() as any);
        const [low, high] = splitTokenId(tokenId);
        const res: any = await prov.callContract({
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

    const baseFloor = pickNumber(
      activeConfig.genesisFloor?.dec,
      activeConfig.genesisPrice?.dec,
      (activeConfig as any).genesisFloor?.value,
      (activeConfig as any).genesisPrice?.value
    );

    if (!bids.length) {
      // no bids yet → seed with genesis price/floor for a flat baseline
      const decFactor = Math.pow(10, decimals);
      const k = kParsed / decFactor;
      const ptsPerSec = ptsParsed / decFactor;
      if (ptsPerSec <= 0) return { curve: null, reason: "pts<=0 (no bids)" };
      if (!Number.isFinite(baseFloor))
        return { curve: null, reason: "no floor (no bids)" };
      const baseFloorHuman = baseFloor / decFactor;
      const nowSecTick = Date.now() / 1000;
      const startSec = activeConfig.openTimeSec;
      const dtSinceOpen = Math.max(0, nowSecTick - startSec);
      const tHalf = Math.max(k / Math.max(ptsPerSec, 1e-9), 1e-9);
      const uEnd = dtSinceOpen / tHalf;
      const ask =
        baseFloorHuman + ptsPerSec * Math.max(1, nowSecTick - startSec); // synthetic ask above floor
      return {
        curve: {
          points: [
            { x: startSec, y: ask, u: 0 },
            { x: nowSecTick, y: ask, u: uEnd },
          ],
          ask,
          floor: baseFloorHuman,
          startSec,
          endSec: nowSecTick,
          tHalf,
          metaDtSec: dtSinceOpen,
          metaU: uEnd,
          maxX: uEnd,
          minX: 0,
        },
        reason: null,
      };
    }

    const last = bids[bids.length - 1];
    const prev = bids[bids.length - 2];
    const lastDecStr =
      (last as any).amountDec ??
      (() => {
        try {
          return toFixed(last.amount, decimals);
        } catch {
          return String(last.amount?.dec ?? "");
        }
      })();
    const floorHuman = Number(lastDecStr);
    if (!Number.isFinite(floorHuman))
      return { curve: null, reason: "floor nan" };

    const decFactor = Math.pow(10, decimals);
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
    const uMax = Math.max(10, metaU); // at least 10 half-lives or up to current
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
    if (typeof window !== "undefined") {
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
    if (view !== "look") return;
    if (maxTokenId != null && lookTokenId > maxTokenId) {
      setLookTokenId(maxTokenId);
    }
  }, [view, maxTokenId, lookTokenId]);

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
              setLookSvg(null);
              setLookError(null);
              setView("look");
            }}
          >
            look
          </button>
        </div>
        <button className="dotfield__mint">[ mint ]</button>
      </div>
      {showCurve && (
        <>
          {!coreReady && coreLoading && (
            <div className="dotfield__canvas">
              <div className="muted">loading curve…</div>
            </div>
          )}
          {coreError && !curve && (
            <div className="dotfield__canvas">
              <div className="muted">
                error loading curve: {String(coreError)}
              </div>
            </div>
          )}
          {coreReady && curve && (
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
                            const frac = maxX > 0 ? clampedX / maxX : 0;
                            const tau = Math.max(0, Math.min(metaDt, frac * metaDt)); // seconds since last bid at this point
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
                                (curve as any).premiumHuman?.toFixed(2) ?? "",
                              amountRaw:
                                (curve as any).premiumHuman?.toString() ?? "",
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
                                (curve as any).premiumHuman?.toFixed(2) ?? "",
                              amountRaw:
                                (curve as any).premiumHuman?.toString() ?? "",
                              durationSec: (curve as any).dtSec ?? 0,
                              ptsHuman: (curve as any).ptsHuman ?? undefined,
                              epoch: lastEpoch ?? undefined,
                              atMs: curve.startSec * 1000,
                            })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
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
              <div className="dotfield__axes muted small">
                <span>time (half-lives) →</span>
                <span>price ↑</span>
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
                                return `${pct.toFixed(5)}%`;
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
                                return `${pct.toFixed(5)}%`;
                              }
                              return "—";
                            })()
                          : "—"}
                      </span>
                    </div>
                  )}
                  {hover.key === "premium" && (
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
                  {hover.key !== "premium" && (
                    <div className="dotfield__poprow">
                      <span>time</span>
                      <span>{formatLocalTime(hover.atMs)}</span>
                    </div>
                  )}
                  {hover.key !== "ask" &&
                    hover.key !== "curve-point" &&
                    hover.key !== "premium" && (
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
                              (((hover as any).metaDtSec ?? 0) +
                                Math.max(
                                  0,
                                  (Date.now() / 1000) -
                                    ((hover as any).hoverSetSec ?? 0)
                                )) -
                                ((hover as any).durationSec ?? 0)
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
                  {hover.key === "ask" && (
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
          {coreReady && !curve && (
            <div className="dotfield__canvas">
              <div className="muted">&nbsp;</div>
            </div>
          )}
        </>
      )}

      {showLook && (
        <>
          <div className="dotfield__canvas dotfield__look">
            {lookLoadingVisible && <div className="muted">loading look…</div>}
            {lookError && (
              <div className="muted">error loading look: {lookError}</div>
            )}
            {!lookLoading && !lookError && lookSvg && (
              <div
                className="dotfield__look-viewport"
                onMouseMove={(e) =>
                  setLookHover({ x: e.clientX + 8, y: e.clientY + 8 })
                }
                onMouseLeave={() => setLookHover(null)}
              >
                <img
                  className="dotfield__look-img"
                  src={lookSvg}
                  alt={lookTitle ?? `PATH #${lookTokenId}`}
                />
              </div>
            )}
            {lookEmptyVisible && <div className="muted">no svg yet</div>}
            <button
              className="dotfield__look-nav dotfield__look-prev"
              data-disabled={lookLoading || lookTokenId <= 1}
              aria-disabled={lookLoading || lookTokenId <= 1}
              onClick={() => {
                if (lookLoading) return;
                if (lookTokenId <= 1) {
                  setLookNotice({ text: "no more", side: "left" });
                  return;
                }
                setLookTokenId((v) => Math.max(1, v - 1));
              }}
              aria-label="Previous token"
            >
              &lt;
            </button>
            <button
              className="dotfield__look-nav dotfield__look-next"
              data-disabled={
                lookLoading || (maxTokenId != null && lookTokenId >= maxTokenId)
              }
              aria-disabled={
                lookLoading || (maxTokenId != null && lookTokenId >= maxTokenId)
              }
              onClick={() => {
                if (lookLoading) return;
                if (maxTokenId != null && lookTokenId >= maxTokenId) {
                  setLookNotice({ text: "no more", side: "right" });
                  return;
                }
                setLookTokenId((v) => v + 1);
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
            <span>token #{lookTokenId}</span>
            <span className="dotfield__look-axes-right">
              {lookMovementDisplay.map((movement) => (
                <span key={movement.label}>
                  {movement.label}
                  {movement.value}
                </span>
              ))}
            </span>
          </div>
        </>
      )}

      {showBids && (
        <>
          {!ready && loading && (
            <div className="dotfield__canvas">
              <div className="muted">loading field…</div>
            </div>
          )}
          {ready && !dots.points.length && (
            <div className="dotfield__canvas">
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
                          if (bidSvgLoading && bidSvgTokenId === tokenId) {
                            return <div className="muted small">loading...</div>;
                          }
                          if (bidSvg && bidSvgTokenId === tokenId) {
                            return <img src={bidSvg} alt={`PATH #${tokenId}`} />;
                          }
                          return <div className="muted small">no svg</div>;
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
              <div className="dotfield__axes muted small">
                <span>time →</span>
                <span>price ↑</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

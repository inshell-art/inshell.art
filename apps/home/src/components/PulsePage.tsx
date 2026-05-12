import { useEffect, useMemo } from "react";
import {
  getProtocolReleaseChainId,
  getProtocolReleaseDeployBlock,
  maybeResolveAddress,
} from "@inshell/contracts";
import { scaleIntegerString } from "@inshell/utils";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { useAuctionCore } from "@/hooks/useAuctionCore";
import { PULSE } from "@/content/pulse";

type PulseMarkDot = {
  x: number;
  y: number;
};

type PulseMark = {
  curveD: string;
  guideD: string;
  dots: PulseMarkDot[];
};

type InstanceRow = {
  label: string;
  value: string;
  title?: string;
  ariaLabel?: string;
};

type InstanceGroup = InstanceRow[];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKEN_DECIMALS = 18;

function getEnv(name: string): string | undefined {
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  const value = envCache?.[name] ?? procEnv?.[name];
  return typeof value === "string" ? value : undefined;
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainLabelFromNetwork(network: string | undefined): string | undefined {
  switch (network?.toLowerCase()) {
    case "mainnet":
    case "ethereum":
    case "prod":
    case "production":
      return "Ethereum";
    case "sepolia":
      return "Sepolia";
    case "devnet":
    case "local":
    case "localhost":
      return "Local Devnet";
    default:
      return undefined;
  }
}

function chainLabelFromChainId(chainId: number | undefined): string | undefined {
  if (!Number.isFinite(chainId)) return undefined;
  if (chainId === 1) return "Ethereum";
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 31337 || chainId === 1337) return "Local Devnet";
  return `Chain ${Math.trunc(chainId as number).toString()}`;
}

function resolveChainLabel(): string {
  return (
    chainLabelFromChainId(getProtocolReleaseChainId()) ??
    chainLabelFromNetwork(getEnv("VITE_NETWORK")) ??
    "Local Devnet"
  );
}

function resolvePaymentSymbol(): string {
  const symbol =
    getEnv("VITE_PAYTOKEN_SYMBOL") ?? getEnv("VITE_PAYMENT_TOKEN_SYMBOL");
  return symbol?.trim() || "ETH";
}

function formatTinyDecimalString(
  fixed: string,
  significantDigits = 4
): string | undefined {
  const raw = String(fixed ?? "").trim();
  if (!raw) return undefined;

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

function cleanValue(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text || /^(null|nan|undefined)$/i.test(text)) return undefined;
  return text;
}

function formatTokenAmount(value: { dec: string } | undefined): string | undefined {
  const raw = cleanValue(String(value?.dec ?? ""));
  if (!raw) return undefined;

  const fixed = /^[0-9]+$/.test(raw)
    ? scaleIntegerString(raw, TOKEN_DECIMALS)
    : raw;
  if (!fixed.includes(".")) return cleanValue(fixed);

  const [intPart, fracPart] = fixed.split(".");
  if ((intPart.replace(/^0+(?=\d)/, "") || "0") === "0") {
    return formatTinyDecimalString(fixed);
  }

  const trimmed = fracPart.slice(0, 4).replace(/0+$/, "");
  return cleanValue(trimmed ? `${intPart}.${trimmed}` : intPart);
}

function formatTimestampSec(value: number | undefined): string | undefined {
  if (!Number.isFinite(value) || !value || value <= 0) return undefined;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function row(
  label: string,
  value: string | undefined,
  meta?: Pick<InstanceRow, "title" | "ariaLabel">
): InstanceRow | null {
  const clean = cleanValue(value);
  return clean ? { label, value: clean, ...meta } : null;
}

function withUnit(value: string | undefined, unit: string): string | undefined {
  const clean = cleanValue(value);
  return clean ? `${clean} ${unit}` : undefined;
}

function compactRows(rows: Array<InstanceRow | null>): InstanceGroup {
  return rows.filter((item): item is InstanceRow => Boolean(item));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataHtmlHref(html: string) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function rawLine(label: string, value: string | undefined) {
  return `${label.padEnd(14)}${cleanValue(value) ?? "unavailable"}`;
}

function pulseParamsDocument(params: {
  address: string;
  chainName: string;
  paymentSymbol: string;
  blockNumber?: number;
  k?: string;
  pts?: string;
  openingAsk?: string;
  openingFloor?: string;
  openTime?: string;
  currentAsk?: string;
  currentFloor?: string;
  epoch?: string;
  lastPrice?: string;
  lastSale?: string;
  anchorTime?: string;
}) {
  return [
    "pulse params",
    "",
    rawLine("loaded from", `PulseAuction ${params.address}`),
    rawLine("chain", params.chainName),
    rawLine(
      "block",
      Number.isFinite(params.blockNumber)
        ? String(Math.trunc(params.blockNumber as number))
        : undefined
    ),
    "",
    "config",
    "",
    rawLine("k", params.k),
    rawLine("PTS", withUnit(params.pts, `${params.paymentSymbol}/s`)),
    rawLine("opening ask", withUnit(params.openingAsk, params.paymentSymbol)),
    rawLine("opening floor", withUnit(params.openingFloor, params.paymentSymbol)),
    rawLine("payment", params.paymentSymbol),
    rawLine("open time", params.openTime),
    "",
    "current epoch",
    "",
    rawLine("current ask", withUnit(params.currentAsk, params.paymentSymbol)),
    rawLine("floor b", withUnit(params.currentFloor, params.paymentSymbol)),
    rawLine("epoch", params.epoch),
    rawLine("last price", params.lastPrice),
    rawLine("last sale", params.lastSale),
    rawLine("anchor a", params.anchorTime),
    "",
    "source: PulseAuction contract",
  ].join("\n");
}

function pulseParamsHtml(documentText: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>pulse params</title>",
    "<style>",
    "body{margin:24px;background:#fff;color:#111;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}",
    "pre{white-space:pre-wrap;margin:0;}",
    "</style>",
    "</head>",
    "<body>",
    `<pre>${escapeHtml(documentText)}</pre>`,
    "</body>",
    "</html>",
  ].join("");
}

function createPulseParamsHref(documentText: string) {
  const html = pulseParamsHtml(documentText);
  if (
    typeof globalThis.URL === "undefined" ||
    typeof globalThis.URL.createObjectURL !== "function" ||
    typeof globalThis.Blob === "undefined"
  ) {
    return dataHtmlHref(html);
  }
  return globalThis.URL.createObjectURL(
    new globalThis.Blob([html], { type: "text/html;charset=utf-8" })
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function coord(value: number) {
  return Number(value.toFixed(2));
}

function makePulseMark(): PulseMark {
  const left = 14;
  const right = 406;
  const floorMin = 31;
  const floorMax = 37;
  const count = 10 + Math.floor(Math.random() * 11);
  const usableWidth = right - left;
  const unit = usableWidth / count;
  let x = left;
  let floorY = randomBetween(floorMin, floorMax);
  const curve: string[] = [`M${coord(x)} ${coord(floorY)}`];
  const guide: string[] = [];
  const dots: PulseMarkDot[] = [{ x, y: floorY }];

  for (let i = 0; i < count; i += 1) {
    const width = unit * randomBetween(0.72, 1.28);
    const endX = i === count - 1 ? right : Math.min(right, x + width);
    const topY = Math.max(7, floorY - randomBetween(7, 24));
    const settleY = randomBetween(floorMin, floorMax);
    const c1x = x + (endX - x) * randomBetween(0.08, 0.2);
    const c2x = x + (endX - x) * randomBetween(0.4, 0.75);
    const c1y = topY + randomBetween(12, 22);
    const c2y = settleY - randomBetween(2, 8);

    guide.push(`M${coord(x)} ${coord(floorY)}V${coord(topY)}`);
    curve.push(
      `M${coord(x)} ${coord(topY)}`,
      `C${coord(c1x)} ${coord(c1y)} ${coord(c2x)} ${coord(c2y)} ${coord(
        endX
      )} ${coord(settleY)}`
    );
    dots.push({ x, y: topY }, { x: endX, y: settleY });

    x = endX;
    floorY = settleY;
    if (i < count - 1) {
      const nextX = Math.min(right, x + unit * randomBetween(0.02, 0.16));
      curve.push(`M${coord(x)} ${coord(floorY)}H${coord(nextX)}`);
      x = nextX;
      dots.push({ x, y: floorY });
    }
  }

  return {
    curveD: curve.join(" "),
    guideD: guide.join(" "),
    dots,
  };
}

function PulseCurrentInstance() {
  const auctionAddress = useMemo(() => maybeResolveAddress("pulse_auction"), []);
  const deployBlock = useMemo(
    () => getProtocolReleaseDeployBlock("pulse_auction") ?? 0,
    []
  );
  const chainName = useMemo(() => resolveChainLabel(), []);
  const paymentSymbol = useMemo(() => resolvePaymentSymbol(), []);
  const core = useAuctionCore({
    address: auctionAddress,
    enabled: Boolean(auctionAddress),
    refreshMs: 4000,
  });
  const bidState = useAuctionBids({
    address: auctionAddress ?? ZERO_ADDRESS,
    fromBlock: deployBlock,
    enabled: Boolean(auctionAddress),
    refreshMs: 4000,
    maxBids: 80,
  });
  const snapshot = core.data;
  const bids = bidState.bids;
  const latestBid = bids.length ? bids[bids.length - 1] : undefined;
  const bidsReady = Boolean(auctionAddress) && !bidState.loading && !bidState.error;

  const k = formatTokenAmount(snapshot?.config.k);
  const pts = formatTokenAmount(
    snapshot?.config.pts ? { dec: snapshot.config.pts } : undefined
  );
  const openingAsk = formatTokenAmount(snapshot?.config.genesisPrice);
  const openingFloor = formatTokenAmount(snapshot?.config.genesisFloor);
  const openTime = formatTimestampSec(snapshot?.config.openTimeSec);
  const currentAsk = formatTokenAmount(snapshot?.price);
  const currentFloor = formatTokenAmount(
    latestBid?.amount ?? (bidsReady ? snapshot?.config.genesisFloor : undefined)
  );
  const epoch = latestBid
    ? Number.isFinite(Number(latestBid.epochIndex))
      ? String(Math.trunc(Number(latestBid.epochIndex)) + 1)
      : String(bids.length + 1)
    : bidsReady && snapshot
    ? "1"
    : undefined;
  const lastPrice = formatTokenAmount(latestBid?.amount);
  const lastSale = latestBid?.atMs
    ? formatTimestampSec(latestBid.atMs / 1000)
    : undefined;
  const anchorTime = formatTimestampSec(latestBid?.anchorASec);
  const contextRows = compactRows([
    auctionAddress
      ? row("authority", `PulseAuction ${shortenAddress(auctionAddress)}`, {
          title: `PulseAuction ${auctionAddress}`,
          ariaLabel: `PulseAuction contract address ${auctionAddress}`,
        })
      : null,
    row("chain", chainName),
    row("payment", paymentSymbol),
    row("loaded from", "PulseAuction contract"),
  ]);
  const configRows = compactRows([
    row("k", k),
    row("PTS", withUnit(pts, `${paymentSymbol}/s`)),
    row("opening ask", withUnit(openingAsk, paymentSymbol)),
    row("opening floor", withUnit(openingFloor, paymentSymbol)),
  ]);
  const currentRows = compactRows([
    row("current ask", withUnit(currentAsk, paymentSymbol)),
    row("floor b", withUnit(currentFloor, paymentSymbol)),
    row("epoch", epoch),
  ]);
  const fieldGroups = [contextRows, configRows, currentRows].filter(
    (group) => group.length
  );
  const loading = Boolean(auctionAddress) && !snapshot && !core.error;
  const failed = !auctionAddress || Boolean(core.error && !snapshot);
  const visibleFieldGroups = failed ? [] : fieldGroups;
  const rawDocument = auctionAddress
    ? pulseParamsDocument({
        address: auctionAddress,
        chainName,
        paymentSymbol,
        k,
        pts,
        openingAsk,
        openingFloor,
        openTime,
        currentAsk,
        currentFloor,
        epoch,
        lastPrice,
        lastSale,
        anchorTime,
      })
    : undefined;
  const rawParamsHref = useMemo(
    () => (rawDocument && snapshot ? createPulseParamsHref(rawDocument) : null),
    [rawDocument, snapshot]
  );

  useEffect(() => {
    return () => {
      if (rawParamsHref?.startsWith("blob:")) {
        globalThis.URL.revokeObjectURL(rawParamsHref);
      }
    };
  }, [rawParamsHref]);

  return (
    <section className="pulse-page__current" aria-label="Pulse current instance">
      <div className="pulse-page__current-copy">
        <div className="pulse-page__section-title">current instance</div>
        <p className="pulse-page__lead-line">
          $PATH is the current public auction using Pulse.
        </p>
        <p>Each successful bid mints one $PATH.</p>
      </div>

      {loading ? (
        <p className="pulse-page__instance-status">loading current instance...</p>
      ) : null}

      {failed ? (
        <div className="pulse-page__instance-status" role="status">
          <p>live params unavailable.</p>
        </div>
      ) : null}

      {visibleFieldGroups.length ? (
        <div
          className="pulse-page__instance-block"
          aria-label="Pulse current instance contract params"
        >
          {visibleFieldGroups.map((group, groupIndex) => (
            <dl className="pulse-page__instance-fields" key={groupIndex}>
              {group.map((item) => (
                <div key={`${item.label}-${item.value}`}>
                  <dt>{item.label}</dt>
                  <dd title={item.title} aria-label={item.ariaLabel}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      ) : null}

      {rawParamsHref ? (
        <nav
          className="primitive-page__links pulse-page__instance-links"
          aria-label="Pulse live params"
        >
          <a
            href={rawParamsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open live Pulse params"
          >
            Open live params ↗
          </a>
        </nav>
      ) : null}
    </section>
  );
}

export default function PulsePage() {
  const pulseMark = useMemo(() => makePulseMark(), []);

  return (
    <main className="primitive-page" aria-labelledby="pulse-page-title">
      <header className="primitive-page__header">
        <div>
          <h1 id="pulse-page-title" className="primitive-page__title">
            {PULSE.title}
          </h1>
          <svg
            className="pulse-page__mark"
            viewBox="0 0 420 44"
            role="img"
            aria-label="Iconic linked pulse auction curves"
          >
            <path
              className="pulse-page__mark-guide"
              d={pulseMark.guideD}
            />
            <path
              className="pulse-page__mark-curve"
              d={pulseMark.curveD}
            />
            <g className="pulse-page__mark-dots">
              {pulseMark.dots.map((dot, index) => (
                <circle
                  key={`${index}-${dot.x}-${dot.y}`}
                  cx={coord(dot.x)}
                  cy={coord(dot.y)}
                  r="1.65"
                />
              ))}
            </g>
          </svg>
          <p className="primitive-page__subtitle">{PULSE.subtitle}</p>
        </div>
      </header>

      <section className="primitive-page__body" aria-label="Pulse source note">
        <div className="primitive-page__copy">
          <p className="pulse-page__lead-line">{PULSE.explanation[0]}</p>
          <p>
            {PULSE.explanation[1]}
            <br />
            {PULSE.explanation[2]}
          </p>
          <p>
            {PULSE.explanation[3]}
            <br />
            {PULSE.explanation[4]}
          </p>
        </div>

        <pre
          className="primitive-page__formula pulse-page__math"
          aria-label="Pulse pump and drop equations"
        >
          {PULSE.math}
        </pre>

        <PulseCurrentInstance />

        <div className="pulse-page__ending">
          <p className="primitive-page__note">{PULSE.note}</p>

          <nav className="primitive-page__links" aria-label="Pulse references">
            <a href={PULSE.desmosUrl} target="_blank" rel="noopener noreferrer">
              Open original Desmos sketch ↗
            </a>
            {PULSE.repositoryUrl ? (
              <a href={PULSE.repositoryUrl} target="_blank" rel="noopener noreferrer">
                View source ↗
              </a>
            ) : null}
          </nav>
        </div>
      </section>
    </main>
  );
}

import { formatUnits } from "ethers";

export const PULSE_AUCTION_LIVE_PRICE_REFRESH_MS = 1_000;

export function formatPulseAuctionDecimal(
  value: string,
  significantFractionDigits = 8,
): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integerRaw, fractionRaw = ""] = unsigned.split(".");
  const integer = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  if (!fractionRaw) return negative ? `-${integer}` : integer;

  const firstNonZero = fractionRaw.search(/[1-9]/);
  if (firstNonZero < 0) return "0";
  const meaningfulStart = integer === "0" ? firstNonZero : 0;
  const keepTo = Math.min(
    fractionRaw.length,
    meaningfulStart + significantFractionDigits,
  );
  const fraction = fractionRaw.slice(0, keepTo).replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fraction ? `${sign}${integer}.${fraction}` : `${sign}${integer}`;
}

export function formatPulseAuctionPrice(
  price: bigint,
  decimals = 18,
  significantFractionDigits = 8,
): string {
  return formatPulseAuctionDecimal(
    formatUnits(price, decimals),
    significantFractionDigits,
  );
}

export function pulseAuctionPriceAtHalfLives(
  floor: number,
  premium: number,
  elapsedHalfLives: number,
): number {
  const u = Math.max(
    0,
    Number.isFinite(elapsedHalfLives) ? elapsedHalfLives : 0,
  );
  if (!Number.isFinite(floor)) return Number.NaN;
  if (!Number.isFinite(premium) || premium <= 0) return floor;
  return floor + premium / Math.max(u + 1, Number.EPSILON);
}

export function pulseAuctionPriceAtTimestamp(input: {
  floorPrice: bigint;
  curveK: bigint;
  anchorTimeSec: bigint;
  timestampSec: bigint;
  openTimeSec?: bigint;
}): bigint {
  const effectiveTime =
    input.openTimeSec !== undefined && input.timestampSec < input.openTimeSec
      ? input.openTimeSec
      : input.timestampSec;

  if (effectiveTime <= input.anchorTimeSec) {
    return input.floorPrice + input.curveK;
  }

  return (
    input.floorPrice +
    input.curveK / (effectiveTime - input.anchorTimeSec)
  );
}

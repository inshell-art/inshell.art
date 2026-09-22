import { scaleIntegerString, type U256Num } from "@inshell/utils";
import type { NormalizedBid } from "@/services/auction/bidsService";

export type PathIssuance = {
  initialMinter?: string;
  price: U256Num;
  transactionHash?: string;
  blockNumber?: number;
  mintedAtMs: number;
};

function tokenIdForSale(
  sale: NormalizedBid,
  tokenBase: number,
  epochBase: number,
): number | undefined {
  if (typeof sale.tokenId === "number" && Number.isSafeInteger(sale.tokenId)) {
    return sale.tokenId;
  }
  if (
    typeof sale.epochIndex !== "number" ||
    !Number.isSafeInteger(sale.epochIndex)
  ) {
    return undefined;
  }
  const tokenId = tokenBase + (sale.epochIndex - epochBase);
  return Number.isSafeInteger(tokenId) && tokenId >= 0 ? tokenId : undefined;
}

export function findPathIssuance(args: {
  tokenId: bigint;
  sales: NormalizedBid[];
  tokenBase?: number;
  epochBase?: number;
}): PathIssuance | null {
  if (args.tokenId > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const tokenId = Number(args.tokenId);
  const tokenBase = args.tokenBase ?? 1;
  const epochBase = args.epochBase ?? 1;
  const sale = args.sales.find(
    (candidate) => tokenIdForSale(candidate, tokenBase, epochBase) === tokenId,
  );
  if (!sale) return null;
  return {
    initialMinter: sale.bidder,
    price: sale.amount,
    transactionHash: sale.txHash,
    blockNumber: sale.blockNumber,
    mintedAtMs: sale.atMs,
  };
}

function formatTinyDecimalString(
  fixed: string,
  significantDigits = 4,
): string {
  const [integer = "0", fraction = ""] = fixed.split(".");
  const firstNonZero = fraction.search(/[1-9]/);
  if (firstNonZero < 0) return integer;
  const keepTo = Math.min(fraction.length, firstNonZero + significantDigits);
  const kept = fraction.slice(0, keepTo).replace(/0+$/, "");
  return kept ? `${integer}.${kept}` : integer;
}

export function formatPathMintPrice(price: U256Num): string {
  const fixed = scaleIntegerString(price.dec, 18);
  if (!fixed.includes(".")) return fixed;
  const [integer, fraction] = fixed.split(".");
  if ((integer.replace(/^0+(?=\d)/, "") || "0") === "0") {
    return formatTinyDecimalString(fixed);
  }
  const kept = fraction.slice(0, 4).replace(/0+$/, "");
  return kept ? `${integer}.${kept}` : integer;
}

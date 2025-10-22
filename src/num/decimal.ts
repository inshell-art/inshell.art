import { asU256Num, type U256Input, type U256Num } from "./256";

/** Insert a decimal point `decimals` digits from the right (no rounding). */
export function scaleIntegerString(intStr: string, decimals: number): string {
  const s0 = String(intStr ?? "").replace(/^0+(?=\d)/, "") || "0";
  if (decimals <= 0) return s0;
  const len = s0.length;
  if (len <= decimals) {
    const pad = "0".repeat(decimals - len);
    return `0.${pad}${s0}`;
  }
  const i = len - decimals;
  return `${s0.slice(0, i)}.${s0.slice(i)}`;
}

/** Convert any u256-ish input to a fixed string given token `decimals` (no precision loss). */
export function toFixed(u: U256Input, decimals: number): string {
  const n = asU256Num(u);
  return scaleIntegerString(n.dec, decimals);
}

/** Optional pretty printer (decimal with group separators) */
export function formatU256Dec(u: U256Num, locale = "en-US"): string {
  return Number.isSafeInteger(Number(u.dec))
    ? Number(u.dec).toLocaleString(locale)
    : u.dec; // keep as plain string for huge values
}

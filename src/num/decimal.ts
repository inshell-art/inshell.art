import { readU256, toU256Num, type U256Num } from "./256";

export type U256Input =
  | U256Num
  | { low: unknown; high: unknown }
  | [unknown, unknown]
  | string
  | number
  | bigint
  | { raw?: { low: unknown; high: unknown }; value?: unknown; dec?: unknown };

/** Best-effort coercion into U256Num using num/256 primitives (no changes to 256.ts). */
export function asU256Num(x: U256Input): U256Num {
  // Already a U256Num
  if (x && typeof x === "object" && "value" in x && "raw" in x) {
    return x as U256Num;
  }
  // Has .raw
  if (x && typeof x === "object" && "raw" in (x as any) && (x as any).raw) {
    const r = (x as any).raw;
    return toU256Num({ low: r.low, high: r.high });
  }
  // Tuple
  if (Array.isArray(x) && x.length >= 2) {
    return toU256Num({ low: (x as any)[0], high: (x as any)[1] });
  }
  // Struct {low, high}
  if (
    x &&
    typeof x === "object" &&
    "low" in (x as any) &&
    "high" in (x as any)
  ) {
    return toU256Num({ low: (x as any).low, high: (x as any).high });
  }
  // Scalar or nested unknown → delegate to readU256
  return toU256Num(readU256(x as any));
}

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

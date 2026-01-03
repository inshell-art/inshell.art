export type U256Input =
  | U256Num
  | { low: unknown; high: unknown }
  | [unknown, unknown]
  | string
  | number
  | bigint
  | { raw?: { low: unknown; high: unknown }; value?: unknown; dec?: unknown };

export type BigNumberish = string | number | bigint;

// Pure ABI representation (keep limbs as strings to avoid precision traps if serialized)
export type Uint256Raw = { low: string; high: string };

// Ergonomic wrapper for a Cairo u256
export type U256Num = {
  raw: Uint256Raw; // ABI limbs
  value: bigint; // exact integer
  dec: string; // decimal string for UI/JSON
};

const MASK128 = (1n << 128n) - 1n;

export function toBig(x: BigNumberish): bigint {
  if (typeof x === "bigint") return x;
  const s = String(x).trim();
  // accept only integer literals: dec/hex/bin/oct
  if (!/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|[0-9]+)$/.test(s)) {
    throw new Error(`Not an integer: ${x}`);
  }
  const n = BigInt(s);
  if (n < 0n) throw new Error("u256 must be unsigned");
  return n;
}

export function dumpShape(v: unknown): string {
  try {
    return JSON.stringify(
      v,
      (_, val) => (typeof val === "bigint" ? `0x${val.toString(16)}` : val),
      2
    );
  } catch {
    return String(v);
  }
}

/** Accept {low,high} | [low,high] | BigNumberish | nested {price|value|0,1} */
export function readU256(v: any): { low: BigNumberish; high: BigNumberish } {
  if (v == null) throw new Error("Unexpected u256: null/undefined");

  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    const b = toBig(v);
    return { low: b & MASK128, high: b >> 128n };
  }

  if (Array.isArray(v) && v.length >= 2) return { low: v[0], high: v[1] };

  if (typeof v === "object") {
    if ("low" in v && "high" in v)
      return { low: (v as any).low, high: (v as any).high };
    if (0 in (v as any) && 1 in (v as any))
      return { low: (v as any)[0], high: (v as any)[1] };
    if ("price" in v) return readU256((v as any).price);
    if ("value" in v) return readU256((v as any).value);
  }

  throw new Error(`Unexpected u256 shape:\n${dumpShape(v)}`);
}

export function u256ToBigint(u: {
  low: BigNumberish;
  high: BigNumberish;
}): bigint {
  return (toBig(u.high) << 128n) + toBig(u.low);
}

export function toU256Num(u: {
  low: BigNumberish;
  high: BigNumberish;
}): U256Num {
  const val = u256ToBigint(u);
  return {
    raw: { low: String(u.low), high: String(u.high) },
    value: val,
    dec: val.toString(10),
  };
}

/** Best-effort coercion into U256Num using num/256 primitives. */
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

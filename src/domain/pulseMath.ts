import Decimal from "decimal.js";

// Minimal math for the Pulse curve from on-chain params.
// Model: p(t) = k / (t - a) + b, where:
//   - a (ms): anchor returned by get_state
//   - b: current floor (last filled price)
//   - k: shape constant from get_config

export type EpochParams = {
  aMs: Decimal; // anchor in milliseconds
  b: Decimal; // floor price
  k: Decimal; // shape constant
};

/** Convenience factory to normalize inputs into Decimals. */
export function makeEpochParams(
  k: Decimal | number | string,
  aMs: Decimal | number | string,
  b: Decimal | number | string
): EpochParams {
  return { k: new Decimal(k), aMs: new Decimal(aMs), b: new Decimal(b) };
}

/** Evaluate p(t) for the provided epoch params. */
export function priceAtMs(ms: number, p: EpochParams): Decimal {
  const tMinusA = new Decimal(ms).minus(p.aMs);
  if (tMinusA.lte(0)) return new Decimal(Infinity); // before domain
  return p.k.div(tMinusA).plus(p.b);
}

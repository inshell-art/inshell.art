export type EpochParams = {
  epochIndex: number;
  floor: number;
  D: number | null; // pump amount (STRK * seconds), null for epoch 2
  k: number; // hyperbola constant
  tStart: number; // unix seconds: epoch start (last bid)
  tNow: number; // unix seconds: current time
};

export type CurvePoint = {
  epochIndex: number;
  tau: number; // seconds since tStart
  u: number; // normalized time (tau / T_half), or tau when D is null
  price: number; // ask in STRK
};

export type CurveOptions = {
  uMax?: number;
  steps?: number;
};

const EPS = 1e-9;

export function computeHalfLife(k: number, D: number | null): number {
  if (D === null || D <= 0) return Number.POSITIVE_INFINITY;
  return k / Math.max(D, EPS);
}

export function computeAsk(
  floor: number,
  k: number,
  D: number | null,
  tau: number
): number {
  if (D === null) {
    const safeTau = Math.max(tau, EPS);
    return floor + k / safeTau;
  }
  const premium = k / (tau + k / Math.max(D, EPS));
  return floor + premium;
}

export function buildPulseCurvePoints(
  epoch: EpochParams,
  options: CurveOptions = {}
): CurvePoint[] {
  const { floor, D, k, tStart, tNow, epochIndex } = epoch;
  const steps = options.steps ?? 120;
  if (!Number.isFinite(floor) || !Number.isFinite(k) || k <= 0) return [];
  const tauNow = Math.max(0, tNow - tStart);

  if (D === null) {
    // Epoch 2 special case: use limit curve k / tau.
    const endTau = tauNow || options.uMax || 600;
    const pts: CurvePoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const tau = (endTau * i) / steps || EPS;
      pts.push({
        epochIndex,
        tau,
        u: tau, // no normalization when D is null
        price: computeAsk(floor, k, null, tau),
      });
    }
    return pts;
  }

  if (D <= 0) return [];

  const T_half = computeHalfLife(k, D);
  const uNow = tauNow / T_half;
  const uMax = options.uMax ?? Math.max(uNow, 10);
  const pts: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = (uMax * i) / steps;
    const tau = u * T_half;
    pts.push({
      epochIndex,
      tau,
      u,
      price: computeAsk(floor, k, D, tau),
    });
  }
  return pts;
}

import { describe, expect, test } from "@jest/globals";
import {
  buildPulseCurvePoints,
  computeAsk,
  computeHalfLife,
  type EpochParams,
} from "../src/pulse/curve";
import normal from "./fixtures/pulse_normal.json";
import huge from "./fixtures/pulse_huge_pump.json";
import tiny from "./fixtures/pulse_tiny_pump.json";
import epoch2 from "./fixtures/pulse_epoch2.json";
import stale from "./fixtures/pulse_stale.json";

const EPS = 1e-3;

const withK = (fixture: any): EpochParams => ({
  ...(fixture.epoch as EpochParams),
  k: fixture.k,
});

describe("buildPulseCurvePoints", () => {
  test("respects premium identity for normal case", () => {
    const epoch = withK(normal);
    const T_half = computeHalfLife(normal.k, epoch.D);
    const pts = buildPulseCurvePoints(epoch, { uMax: 3, steps: 6 });
    const mid = pts[Math.floor(pts.length / 2)];
    const u = mid.u;
    const tau = u * T_half;
    const P1 = normal.k / (tau + normal.k / (epoch.D as number));
    const P2 = (epoch.D as number) / (u + 1);
    expect(P1).toBeCloseTo(P2, 1e-6);
    const ask = epoch.floor + P1;
    expect(mid.price).toBeCloseTo(ask, EPS);
  });

  test("sampling hits expected premiums at key taus", () => {
    const epoch = withK(normal);
    const T_half = computeHalfLife(normal.k, epoch.D);
    const pts = buildPulseCurvePoints(epoch, { uMax: 2, steps: 4 });
    const atZero = pts[0];
    expect(atZero.price).toBeCloseTo(epoch.floor + (epoch.D as number), EPS);

    const atHalf = pts.find((p) => Math.abs(p.u - 1) < 1e-6);
    expect(atHalf?.price).toBeCloseTo(epoch.floor + (epoch.D as number) / 2, 0);
  });

  test("handles huge pump without cliff in normalized x", () => {
    const epoch = withK(huge);
    const pts = buildPulseCurvePoints(epoch, { uMax: 5, steps: 20 });
    expect(pts.length).toBeGreaterThan(10);
    const maxU = Math.max(...pts.map((p) => p.u));
    expect(maxU).toBeGreaterThanOrEqual(5);
    const first = pts[0].price;
    const second = pts[1].price;
    expect(first).toBeGreaterThan(second); // monotonic decay
  });

  test("tiny pump produces gentle ask around u=0.5", () => {
    const epoch = withK(tiny);
    const pts = buildPulseCurvePoints(epoch, { uMax: 1, steps: 200 });
    const T_half = computeHalfLife(epoch.k, epoch.D);
    const expected = computeAsk(epoch.floor, epoch.k, epoch.D, 0.5 * T_half);
    const mid = pts.find((p) => Math.abs(p.u - 0.5) < 0.05);
    expect(Math.abs((mid?.price ?? 0) - expected)).toBeLessThan(5);
  });

  test("epoch 2 (no D) uses limit curve without crashing", () => {
    const epoch = withK(epoch2);
    const pts = buildPulseCurvePoints(epoch, { steps: 12 });
    expect(pts.length).toBeGreaterThan(0);
    const last = pts[pts.length - 1];
    expect(last.price).toBeCloseTo(2666.67, 1);
  });

  test("stale epoch lands near floor after many half-lives", () => {
    const epoch = withK(stale);
    const pts = buildPulseCurvePoints(epoch, { uMax: 5, steps: 10 });
    const last = pts[pts.length - 1];
    expect(last.price - epoch.floor).toBeLessThan(100); // small premium
  });
});

describe("computeAsk", () => {
  test("matches D/2 premium at half-life", () => {
    const epoch = withK(normal);
    const T_half = computeHalfLife(normal.k, epoch.D);
    const tau = T_half;
    const ask = computeAsk(epoch.floor, normal.k, epoch.D, tau);
    expect(ask).toBeCloseTo(epoch.floor + (epoch.D as number) / 2, EPS);
  });

  test("epoch 2 ask uses k/tau", () => {
    const epoch = epoch2.epoch as EpochParams;
    const ask = computeAsk(epoch.floor, epoch2.k, epoch.D, 600);
    expect(ask).toBeCloseTo(2666.67, 1);
  });
});

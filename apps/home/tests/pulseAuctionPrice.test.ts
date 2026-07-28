import { describe, expect, test } from "@jest/globals";
import {
  PULSE_AUCTION_LIVE_PRICE_REFRESH_MS,
  formatPulseAuctionPrice,
  pulseAuctionPriceAtHalfLives,
  pulseAuctionPriceAtTimestamp,
} from "@inshell/shared";

describe("shared Pulse auction live price", () => {
  test("matches the renderer half-life price curve", () => {
    expect(pulseAuctionPriceAtHalfLives(0.9, 0.6, 0)).toBeCloseTo(1.5);
    expect(pulseAuctionPriceAtHalfLives(0.9, 0.6, 1)).toBeCloseTo(1.2);
  });

  test("matches the contract timestamp formula and open-time clamp", () => {
    const pricing = {
      floorPrice: 900n,
      curveK: 600n,
      anchorTimeSec: 100n,
      openTimeSec: 101n,
    };

    expect(
      pulseAuctionPriceAtTimestamp({ ...pricing, timestampSec: 99n }),
    ).toBe(1_500n);
    expect(
      pulseAuctionPriceAtTimestamp({ ...pricing, timestampSec: 102n }),
    ).toBe(1_200n);
  });

  test("uses one shared live-price cadence", () => {
    expect(PULSE_AUCTION_LIVE_PRICE_REFRESH_MS).toBe(1_000);
  });

  test("keeps enough shared precision for a visibly live small ask", () => {
    expect(formatPulseAuctionPrice(9_037_901_234_567_890n)).toBe(
      "0.0090379012",
    );
  });
});

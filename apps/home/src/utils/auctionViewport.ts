export function clampLockedExplorationXWindow(
  xMin: number,
  xMax: number,
  xRange: number,
  xEnd: number,
): { xMin: number; xMax: number } {
  const safeXEnd = Math.max(Number.EPSILON, xEnd);
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xRange <= 0) {
    return { xMin: 0, xMax: safeXEnd };
  }

  // Locked exploration may pan one full viewport beyond either data edge.
  // That lets the first curve reach the right edge and the latest curve
  // reach the left edge without changing the bounded default viewport.
  const minX = -xRange;
  const maxX = safeXEnd + xRange;
  let nextMin = xMin;
  let nextMax = xMax;

  if (nextMin < minX) {
    nextMin = minX;
    nextMax = nextMin + xRange;
  }
  if (nextMax > maxX) {
    nextMax = maxX;
    nextMin = nextMax - xRange;
  }

  return { xMin: nextMin, xMax: nextMax };
}

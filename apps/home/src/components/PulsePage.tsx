import { useEffect, useMemo, useState } from "react";
import { PULSE } from "@/content/pulse";

type PulseDemoDot = {
  x: number;
  y: number;
  delay: number;
};

type PulseDemoSegment = {
  d: string;
  delay: number;
  seconds: number;
};

type PulseDemo = {
  cycleSeconds: number;
  drops: PulseDemoSegment[];
  pumps: PulseDemoSegment[];
  dots: PulseDemoDot[];
};

const PULSE_DEMO_START_SECONDS = 0;
const PULSE_DEMO_PUMP_SECONDS = 0.16;
const PULSE_DEMO_TIME_SCALE = 0.38;
const PULSE_DEMO_DURATION_PROFILE = [1.09, 0.82, 1.06, 0.74, 1.02, 1.27];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function coord(value: number) {
  return Number(value.toFixed(2));
}

function seconds(value: number) {
  return Number((value * PULSE_DEMO_TIME_SCALE).toFixed(3));
}

function makeDurations(count: number, total: number) {
  const weights =
    count === PULSE_DEMO_DURATION_PROFILE.length
      ? PULSE_DEMO_DURATION_PROFILE
      : Array.from({ length: count }, () => randomBetween(0.82, 1.18));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (weight / weightTotal) * total);
}

function makePulseDemo(): PulseDemo {
  const left = 0;
  const right = 640;
  const floorMin = 118;
  const floorMax = 121;
  const topPadding = 4;
  const count = 6;
  const usableWidth = right - left;
  const averageDuration = usableWidth / count;
  const durations = makeDurations(count, usableWidth);
  let timeCursor = PULSE_DEMO_START_SECONDS;
  let x = left;
  let floorY = randomBetween(floorMin, floorMax);
  let previousDuration = durations[0];
  const drops: PulseDemoSegment[] = [];
  const pumps: PulseDemoSegment[] = [];
  const dots: PulseDemoDot[] = [{ x, y: floorY, delay: 0 }];

  for (let i = 0; i < count; i += 1) {
    const duration = i === count - 1 ? right - x : durations[i];
    const durationRatio = clamp(duration / averageDuration, 0.55, 1.55);
    const nextDuration = i + 1 < count - 1 ? durations[i + 1] : duration;
    const requiredFloorHeight = Math.max(duration, nextDuration);
    const endX = x + duration;
    const topY = floorY - previousDuration;
    const maxSaleLift = Math.max(0, floorY - requiredFloorHeight - topPadding);
    const saleLift = Math.min(
      previousDuration * randomBetween(0.1, 0.22),
      maxSaleLift
    );
    const settleY = floorY - saleLift;
    const dropWidth = endX - x;
    const dropHeight = settleY - topY;
    const c1x = x + dropWidth * randomBetween(0.08, 0.18);
    const c2x = x + dropWidth * randomBetween(0.58, 0.82);
    const c1y = topY + dropHeight * randomBetween(0.58, 0.82);
    const c2y = topY + dropHeight * randomBetween(0.9, 0.98);
    const dropSeconds = clamp(
      0.42 + durationRatio * 0.34 + randomBetween(-0.08, 0.09),
      0.5,
      1.02
    );
    const stepDelay = timeCursor;
    const pumpDelay = stepDelay;
    const dropDelay = pumpDelay + PULSE_DEMO_PUMP_SECONDS;

    pumps.push({
      d: `M${coord(x)} ${coord(floorY)}V${coord(topY)}`,
      delay: seconds(pumpDelay),
      seconds: seconds(PULSE_DEMO_PUMP_SECONDS),
    });
    drops.push({
      d: `M${coord(x)} ${coord(topY)}C${coord(c1x)} ${coord(c1y)} ${coord(
        c2x
      )} ${coord(c2y)} ${coord(
        endX
      )} ${coord(settleY)}`,
      delay: seconds(dropDelay),
      seconds: seconds(dropSeconds),
    });
    dots.push(
      { x, y: topY, delay: seconds(pumpDelay) },
      { x: endX, y: settleY, delay: seconds(dropDelay + dropSeconds) }
    );

    x = endX;
    floorY = settleY;
    previousDuration = duration;
    timeCursor = dropDelay + dropSeconds;
  }

  return {
    cycleSeconds: seconds(timeCursor) + 0.04,
    drops,
    pumps,
    dots,
  };
}

export default function PulsePage() {
  const pulseDemo = useMemo(() => makePulseDemo(), []);
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setAnimationCycle((cycle) => cycle + 1);
    }, pulseDemo.cycleSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [pulseDemo.cycleSeconds]);

  return (
    <main className="primitive-page" aria-labelledby="pulse-page-title">
      <header className="primitive-page__header">
        <div>
          <h1 id="pulse-page-title" className="primitive-page__title">
            {PULSE.title}
          </h1>
          <svg
            key={animationCycle}
            className="pulse-page__demo"
            viewBox="0 0 640 122"
            role="img"
            aria-label="Animated timeline of linked pulse auction curves"
          >
            <g className="pulse-page__demo-drops">
              {pulseDemo.drops.map((segment, index) => (
                <path
                  key={`drop-${index}-${segment.d}`}
                  className="pulse-page__demo-drop"
                  d={segment.d}
                  pathLength={1}
                  style={{
                    animationDelay: `${segment.delay}s`,
                    animationDuration: `${segment.seconds}s`,
                  }}
                />
              ))}
            </g>
            <g className="pulse-page__demo-pumps">
              {pulseDemo.pumps.map((segment, index) => (
                <path
                  key={`pump-${index}-${segment.d}`}
                  className="pulse-page__demo-pump"
                  d={segment.d}
                  style={{
                    animationDelay: `${segment.delay}s`,
                    animationDuration: `${segment.seconds}s`,
                  }}
                />
              ))}
            </g>
            <g className="pulse-page__demo-dots">
              {pulseDemo.dots.map((dot, index) => (
                <circle
                  key={`${index}-${dot.x}-${dot.y}`}
                  cx={coord(dot.x)}
                  cy={coord(dot.y)}
                  r="2.05"
                  style={{ animationDelay: `${dot.delay}s` }}
                />
              ))}
            </g>
          </svg>
          <p className="primitive-page__subtitle">{PULSE.subtitle}</p>
        </div>
      </header>

      <section className="primitive-page__body" aria-label="Pulse source note">
        <div className="primitive-page__copy">
          <p>{PULSE.explanation[0]}</p>
          <p>
            {PULSE.explanation[1]}
            <br />
            {PULSE.explanation[2]}
          </p>
          <p>
            {PULSE.explanation[3]}
            <br />
            {PULSE.explanation[4]}
          </p>
        </div>

        <pre
          className="primitive-page__formula pulse-page__math"
          aria-label="Pulse pump and drop equations"
        >
          {PULSE.math}
        </pre>

        <div className="pulse-page__ending">
          <p className="primitive-page__note">{PULSE.note}</p>

          <nav className="primitive-page__links" aria-label="Pulse references">
            <a href={PULSE.desmosUrl} target="_blank" rel="noopener noreferrer">
              Open original Desmos sketch ↗
            </a>
            {PULSE.repositoryUrl ? (
              <a href={PULSE.repositoryUrl} target="_blank" rel="noopener noreferrer">
                View source ↗
              </a>
            ) : null}
          </nav>
        </div>
      </section>
    </main>
  );
}

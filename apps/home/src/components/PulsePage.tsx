import { useMemo } from "react";
import { PULSE } from "@/content/pulse";

type PulseDemoDot = {
  x: number;
  y: number;
  delay: number;
};

type PulseDemoSegment = {
  d: string;
  delay: number;
};

type PulseDemo = {
  durations: PulseDemoSegment[];
  drops: PulseDemoSegment[];
  pumps: PulseDemoSegment[];
  dots: PulseDemoDot[];
};

const PULSE_DEMO_DROP_SECONDS = 1;
const PULSE_DEMO_REFERENCE_SECONDS = 0.5;
const PULSE_DEMO_PUMP_HOLD_SECONDS = 0.5;
const PULSE_DEMO_EMPTY_SECONDS = 0.5;
const PULSE_DEMO_PRE_DROP_SECONDS =
  PULSE_DEMO_REFERENCE_SECONDS +
  PULSE_DEMO_PUMP_HOLD_SECONDS +
  PULSE_DEMO_EMPTY_SECONDS;
const PULSE_DEMO_STEP_SECONDS =
  PULSE_DEMO_PRE_DROP_SECONDS + PULSE_DEMO_DROP_SECONDS;
const PULSE_DEMO_START_SECONDS = 0.14;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function coord(value: number) {
  return Number(value.toFixed(2));
}

function makeDurations(count: number, total: number) {
  const weights = Array.from({ length: count }, () => randomBetween(0.9, 1.1));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => (weight / weightTotal) * total);
}

function makePulseDemo(): PulseDemo {
  const left = 0;
  const right = 560;
  const floorMin = 55;
  const floorMax = 58;
  const count = 15;
  const usableWidth = right - left;
  const durations = makeDurations(count, usableWidth);
  let x = left;
  let floorY = randomBetween(floorMin, floorMax);
  let previousDuration = durations[0];
  const durationRefs: PulseDemoSegment[] = [];
  const drops: PulseDemoSegment[] = [];
  const pumps: PulseDemoSegment[] = [];
  const dots: PulseDemoDot[] = [{ x, y: floorY, delay: 0 }];

  for (let i = 0; i < count; i += 1) {
    const duration = i === count - 1 ? right - x : durations[i];
    const endX = x + duration;
    const topY = floorY - previousDuration;
    const settleY = randomBetween(floorMin, floorMax);
    const dropWidth = endX - x;
    const dropHeight = settleY - topY;
    const c1x = x + dropWidth * 0.12;
    const c2x = x + dropWidth * 0.72;
    const c1y = topY + dropHeight * 0.72;
    const c2y = topY + dropHeight * 0.96;
    const stepDelay = PULSE_DEMO_START_SECONDS + i * PULSE_DEMO_STEP_SECONDS;
    const pumpDelay =
      i > 0 ? stepDelay + PULSE_DEMO_REFERENCE_SECONDS : stepDelay;
    const dropDelay = stepDelay + PULSE_DEMO_PRE_DROP_SECONDS;

    if (i > 0) {
      durationRefs.push({
        d: `M${coord(x - previousDuration)} ${coord(floorY)}H${coord(x)}`,
        delay: stepDelay,
      });
    }
    pumps.push({
      d: `M${coord(x)} ${coord(floorY)}V${coord(topY)}`,
      delay: pumpDelay,
    });
    drops.push({
      d: `M${coord(x)} ${coord(topY)}C${coord(c1x)} ${coord(c1y)} ${coord(
        c2x
      )} ${coord(c2y)} ${coord(
        endX
      )} ${coord(settleY)}`,
      delay: dropDelay,
    });
    dots.push(
      { x, y: topY, delay: pumpDelay },
      { x: endX, y: settleY, delay: dropDelay + PULSE_DEMO_DROP_SECONDS }
    );

    x = endX;
    floorY = settleY;
    previousDuration = duration;
  }

  return {
    durations: durationRefs,
    drops,
    pumps,
    dots,
  };
}

export default function PulsePage() {
  const pulseDemo = useMemo(() => makePulseDemo(), []);

  return (
    <main className="primitive-page" aria-labelledby="pulse-page-title">
      <header className="primitive-page__header">
        <div>
          <h1 id="pulse-page-title" className="primitive-page__title">
            {PULSE.title}
          </h1>
          <svg
            className="pulse-page__demo"
            viewBox="0 0 560 72"
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
                  style={{ animationDelay: `${segment.delay}s` }}
                />
              ))}
            </g>
            <g className="pulse-page__demo-durations">
              {pulseDemo.durations.map((segment, index) => (
                <path
                  key={`duration-${index}-${segment.d}`}
                  className="pulse-page__demo-duration"
                  d={segment.d}
                  style={{ animationDelay: `${segment.delay}s` }}
                />
              ))}
            </g>
            <g className="pulse-page__demo-pumps">
              {pulseDemo.pumps.map((segment, index) => (
                <path
                  key={`pump-${index}-${segment.d}`}
                  className="pulse-page__demo-pump"
                  d={segment.d}
                  style={{ animationDelay: `${segment.delay}s` }}
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

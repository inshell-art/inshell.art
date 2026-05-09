import { useMemo } from "react";
import { PULSE } from "@/content/pulse";

type PulseMarkDot = {
  x: number;
  y: number;
};

type PulseMark = {
  curveD: string;
  guideD: string;
  dots: PulseMarkDot[];
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function coord(value: number) {
  return Number(value.toFixed(2));
}

function makePulseMark(): PulseMark {
  const left = 14;
  const right = 406;
  const floorMin = 31;
  const floorMax = 37;
  const count = 10 + Math.floor(Math.random() * 11);
  const usableWidth = right - left;
  const unit = usableWidth / count;
  let x = left;
  let floorY = randomBetween(floorMin, floorMax);
  const curve: string[] = [`M${coord(x)} ${coord(floorY)}`];
  const guide: string[] = [];
  const dots: PulseMarkDot[] = [{ x, y: floorY }];

  for (let i = 0; i < count; i += 1) {
    const width = unit * randomBetween(0.72, 1.28);
    const endX = i === count - 1 ? right : Math.min(right, x + width);
    const topY = Math.max(7, floorY - randomBetween(7, 24));
    const settleY = randomBetween(floorMin, floorMax);
    const c1x = x + (endX - x) * randomBetween(0.08, 0.2);
    const c2x = x + (endX - x) * randomBetween(0.4, 0.75);
    const c1y = topY + randomBetween(12, 22);
    const c2y = settleY - randomBetween(2, 8);

    guide.push(`M${coord(x)} ${coord(floorY)}V${coord(topY)}`);
    curve.push(
      `M${coord(x)} ${coord(topY)}`,
      `C${coord(c1x)} ${coord(c1y)} ${coord(c2x)} ${coord(c2y)} ${coord(
        endX
      )} ${coord(settleY)}`
    );
    dots.push({ x, y: topY }, { x: endX, y: settleY });

    x = endX;
    floorY = settleY;
    if (i < count - 1) {
      const nextX = Math.min(right, x + unit * randomBetween(0.02, 0.16));
      curve.push(`M${coord(x)} ${coord(floorY)}H${coord(nextX)}`);
      x = nextX;
      dots.push({ x, y: floorY });
    }
  }

  return {
    curveD: curve.join(" "),
    guideD: guide.join(" "),
    dots,
  };
}

export default function PulsePage() {
  const pulseMark = useMemo(() => makePulseMark(), []);

  return (
    <main className="primitive-page" aria-labelledby="pulse-page-title">
      <header className="primitive-page__header">
        <div>
          <h1 id="pulse-page-title" className="primitive-page__title">
            {PULSE.title}
          </h1>
          <svg
            className="pulse-page__mark"
            viewBox="0 0 420 44"
            role="img"
            aria-label="Iconic linked pulse auction curves"
          >
            <path
              className="pulse-page__mark-guide"
              d={pulseMark.guideD}
            />
            <path
              className="pulse-page__mark-curve"
              d={pulseMark.curveD}
            />
            <g className="pulse-page__mark-dots">
              {pulseMark.dots.map((dot, index) => (
                <circle
                  key={`${index}-${dot.x}-${dot.y}`}
                  cx={coord(dot.x)}
                  cy={coord(dot.y)}
                  r="1.65"
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

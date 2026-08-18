import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const WILL_LOAD_AHEAD_VIEWPORT_RATIO = 0.5;

type WillWheelInput = { deltaY: number };
type WillTouchInput = {
  touches: ArrayLike<{ clientY: number }>;
};

function isNearWillPageEnd() {
  const remaining =
    document.documentElement.scrollHeight -
    (window.scrollY + window.innerHeight);
  return remaining <= window.innerHeight * WILL_LOAD_AHEAD_VIEWPORT_RATIO;
}

export default function WillPage() {
  const [dotPageCount, setDotPageCount] = useState(1);
  const [dotPageHeight, setDotPageHeight] = useState<number | null>(null);
  const firstDotPageRef = useRef<HTMLDivElement>(null);
  const appendLockedRef = useRef(false);
  const appendFrameRef = useRef<number | null>(null);

  const appendDotPage = useCallback(() => {
    if (appendLockedRef.current) return;

    const measuredHeight = firstDotPageRef.current?.getBoundingClientRect().height;
    if (!measuredHeight || measuredHeight <= 0) return;

    appendLockedRef.current = true;
    setDotPageHeight((current) => current ?? measuredHeight);
    setDotPageCount((current) => current + 1);
    appendFrameRef.current = window.requestAnimationFrame(() => {
      appendLockedRef.current = false;
      appendFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    let previousScrollY = window.scrollY;
    let previousTouchY: number | null = null;

    const appendIfMovingTowardEnd = () => {
      if (isNearWillPageEnd()) appendDotPage();
    };
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > previousScrollY) appendIfMovingTowardEnd();
      previousScrollY = currentScrollY;
    };
    const handleWheel = (event: WillWheelInput) => {
      if (event.deltaY > 0) appendIfMovingTowardEnd();
    };
    const handleTouchStart = (event: WillTouchInput) => {
      previousTouchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: WillTouchInput) => {
      const currentTouchY = event.touches[0]?.clientY ?? null;
      if (
        currentTouchY !== null &&
        previousTouchY !== null &&
        currentTouchY < previousTouchY
      ) {
        appendIfMovingTowardEnd();
      }
      previousTouchY = currentTouchY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      if (appendFrameRef.current !== null) {
        window.cancelAnimationFrame(appendFrameRef.current);
      }
    };
  }, [appendDotPage]);

  const dotFieldStyle =
    dotPageHeight === null
      ? undefined
      : ({
          "--will-page-loaded-height": `${dotPageHeight}px`,
        } as CSSProperties);

  return (
    <main className="will-page" aria-labelledby="will-page-title">
      <header className="will-page__identity">
        <div className="will-page__title-line">
          <h1 id="will-page-title" className="will-page__title">
            WILL
          </h1>
          <span className="will-page__launch-note">launch in 2027</span>
        </div>
        <p className="will-page__slogan">many people. many Agents. one will.</p>
      </header>
      <div
        className="will-page__dot-field"
        aria-hidden="true"
        data-dot-layout="even"
        data-loaded-pages={dotPageCount}
        data-measured={dotPageHeight === null ? "false" : "true"}
        style={dotFieldStyle}
      >
        {Array.from({ length: dotPageCount }, (_, index) => (
          <div
            key={index}
            ref={index === 0 ? firstDotPageRef : undefined}
            className="will-page__dot-page"
            data-dot-layout="even"
            data-dot-page={index + 1}
          />
        ))}
      </div>
    </main>
  );
}

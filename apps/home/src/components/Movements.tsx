import { useEffect, useRef, useState } from "react";
import { isDesktopDevice } from "@inshell/utils";
import "./Movements.css";

const WORDS = [
  { label: "THOUGHT", year: "2025" },
  { label: "WILL", year: "2026" },
  { label: "AWA!", year: "2027" },
];

function resolveThoughtUrl() {
  const env: Record<string, any> | undefined = (globalThis as any)?.__VITE_ENV__;
  const nodeEnv = (globalThis as any)?.process?.env?.NODE_ENV;
  const isDev =
    env?.DEV === true || env?.MODE === "development" || nodeEnv === "development";
  if (isDev) {
    const devPort = String(env?.VITE_THOUGHT_DEV_PORT ?? "5173");
    const devHost =
      typeof window !== "undefined" ? window.location.hostname : "localhost";
    const devProtocol =
      typeof window !== "undefined" ? window.location.protocol : "http:";
    return `${devProtocol}//${devHost}:${devPort}`;
  }
  return env?.VITE_THOUGHT_URL ?? "https://thought.inshell.art";
}

export default function Movements() {
  const [projectOpacity, setProjectOpacity] = useState(0);
  const [yearOpacity, setYearOpacity] = useState(0);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const lastTimestamp = useRef(Date.now());
  const [isDesktop, setIsDesktop] = useState(true);
  const thoughtUrl = resolveThoughtUrl();

  useEffect(() => {
    setIsDesktop(isDesktopDevice());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setProjectOpacity((prevOpacity) => Math.max(prevOpacity - 0.1, 0.1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setProjectOpacity((prevOpacity) => Math.min(prevOpacity + 0.2, 1));
    };
    handleClick();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const currentTimestamp = Date.now();
      let deltaTime = currentTimestamp - lastTimestamp.current;
      const distance = Math.hypot(
        event.clientX - lastMousePosition.current.x,
        event.clientY - lastMousePosition.current.y
      );

      if (deltaTime === 0) deltaTime = 1;
      const speed = distance / deltaTime;
      const opacityIncrease = Math.min(speed * 0.05, 0.05);

      setProjectOpacity((prevOpacity) =>
        Math.min(prevOpacity + opacityIncrease, 1)
      );

      lastMousePosition.current = { x: event.clientX, y: event.clientY };
      lastTimestamp.current = currentTimestamp;
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (projectOpacity > 0.9) {
      setYearOpacity(projectOpacity);
    } else {
      setYearOpacity(Math.max(projectOpacity / 50, 0));
    }
  }, [projectOpacity]);

  if (!isDesktop) return null;

  return (
    <div className="movements" aria-label="movements-hero">
      {WORDS.map((word) => (
        <div key={word.label} className="movements__cell">
          <div className="movements__year" style={{ opacity: yearOpacity }}>
            in {word.year}
          </div>
          {word.label === "THOUGHT" ? (
            <a
              className="movements__word movements__word--link"
              style={{ opacity: projectOpacity }}
              href={thoughtUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {word.label}
            </a>
          ) : (
            <div
              className="movements__word"
              style={{ opacity: projectOpacity }}
            >
              {word.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

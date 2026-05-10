import { useEffect, useRef, useState } from "react";
import { isDesktopDevice } from "@inshell/utils";
import "./Movements.css";

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function isDevLikeEnv(): boolean {
  const dev = getEnvValue("DEV");
  const mode = getEnvValue("MODE");
  const nodeEnv = getEnvValue("NODE_ENV");
  return dev === true || mode === "development" || nodeEnv === "test";
}

function resolveThoughtUrl(): string | null {
  const explicit =
    getEnvValue("VITE_THOUGHT_URL") ?? getEnvValue("VITE_THOUGHT_APP_URL");
  if (typeof explicit === "string" && explicit.trim()) {
    const value = explicit.trim();
    if (/^https?:\/\//i.test(value)) return value;
  }
  return isDevLikeEnv() ? "http://127.0.0.1:5174/" : null;
}

const WORDS = [
  { label: "THOUGHT" },
  { label: "WILL", year: "2027" },
  { label: "AWA!", year: "2028" },
];

export default function Movements() {
  const [projectOpacity, setProjectOpacity] = useState(0);
  const [yearOpacity, setYearOpacity] = useState(0);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const lastTimestamp = useRef(Date.now());
  const [isDesktop, setIsDesktop] = useState(true);

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

  const thoughtUrl = resolveThoughtUrl();

  return (
    <div className="movements" aria-label="Movements">
      {WORDS.map((word) => (
        <div key={word.label} className="movements__cell">
          <div
            className={`movements__year${
              word.year ? "" : " movements__year--empty"
            }`}
            style={{ opacity: word.year ? yearOpacity : 0 }}
            aria-hidden={word.year ? undefined : "true"}
          >
            {word.year ? `in ${word.year}` : "\u00a0"}
          </div>
          {word.label === "THOUGHT" && thoughtUrl ? (
            <a
              href={thoughtUrl}
              className="movements__word movements__word--link"
              target="_blank"
              rel="noopener noreferrer"
              style={{ opacity: projectOpacity }}
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

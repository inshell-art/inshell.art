import { useEffect, useState } from "react";
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

function wordClassName(label: string): string {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `movements__word movements__word--${key}`;
}

export default function Movements() {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    setIsDesktop(isDesktopDevice());
  }, []);

  if (!isDesktop) return null;

  const thoughtUrl = resolveThoughtUrl();

  return (
    <div className="movements" aria-label="Movements">
      {WORDS.map((word) => {
        const isActive = activeLabel === word.label;
        const activate = () => setActiveLabel(word.label);
        const deactivate = () => setActiveLabel(null);
        return (
          <div
            key={word.label}
            className={`movements__cell${
              isActive ? " movements__cell--active" : ""
            }`}
          >
            <div
              className={`movements__year${
                word.year ? "" : " movements__year--empty"
              }`}
              style={{ opacity: word.year && isActive ? 1 : 0 }}
              aria-hidden={word.year ? undefined : "true"}
            >
              {word.year ? `in ${word.year}` : "\u00a0"}
            </div>
            {word.label === "THOUGHT" && thoughtUrl ? (
              <a
                href={thoughtUrl}
                className={`${wordClassName(word.label)} movements__word--link`}
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={activate}
                onMouseLeave={deactivate}
                onFocus={activate}
                onBlur={deactivate}
              >
                {word.label}
              </a>
            ) : (
              <div
                className={wordClassName(word.label)}
                onMouseEnter={activate}
                onMouseLeave={deactivate}
              >
                {word.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";
import { PUBLIC_NETWORK_CONFIG } from "@inshell/shared";

type LoadState =
  | { status: "loading"; items: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; items: ThoughtGalleryItem[]; error: null }
  | { status: "error"; items: ThoughtGalleryItem[]; error: string };

const GALLERY_LOADING_DETAILS = [
  "checking latest block",
  "reading THOUGHT snapshot",
  "collecting minted works",
  "rendering gallery",
] as const;

function getEnvValue(name: string): unknown {
  const runtimeEnv: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, unknown> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env as
    | Record<string, unknown>
    | undefined;
  return runtimeEnv?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function configuredUrl(name: string) {
  const value = getEnvValue(name);
  return typeof value === "string" && /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : null;
}

function isPreviewDeployment(): boolean {
  const deployEnv = getEnvValue("VITE_DEPLOY_ENV");
  if (typeof deployEnv === "string" && deployEnv.trim().toLowerCase() === "preview") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "preview.inshell.art" ||
    hostname.endsWith(".preview.inshell.art") ||
    hostname === "staging.inshell-art.pages.dev" ||
    hostname === "staging.thought-inshell-art.pages.dev" ||
    (hostname.startsWith("staging.") && hostname.endsWith(".pages.dev"))
  );
}

function thoughtAppUrl(): string {
  return (
    configuredUrl("VITE_THOUGHT_URL") ??
    (isPreviewDeployment()
      ? "https://thought.preview.inshell.art/"
      : "https://thought.inshell.art/")
  );
}

function colorFontUrl(): string {
  return isPreviewDeployment()
    ? "https://preview.inshell.art/color-font"
    : "/color-font";
}

function canonicalThoughtTitle(value: string): string {
  return (
    value
      .replace(/[^A-Za-z]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase() || "-"
  );
}

function shortValue(value?: string, head = 6, tail = 4): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

function thoughtImageUrl(tokenId: number): string {
  return `/api/thought-image?id=${encodeURIComponent(String(tokenId))}`;
}

function thoughtDetailUrl(tokenId: number): string {
  return `/thought/${encodeURIComponent(String(tokenId))}`;
}

function fallbackThumbnailUri(text: string): string {
  const label = canonicalThoughtTitle(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="#050505"/><text x="400" y="410" fill="#e8edf7" font-family="monospace" font-size="48" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function galleryTipTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "time unavailable";
  return new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}

function ChainLoadingStatus({ detail }: { detail: string }) {
  return (
    <span
      className="inshell-chain-loading"
      aria-label={`reading from chain: ${detail}...`}
    >
      <span className="inshell-chain-loading__line">
        reading from chain: {detail}
        <span className="inshell-chain-loading__dots" aria-hidden="true">
          ...
        </span>
      </span>
    </span>
  );
}

function ThoughtGalleryCard({ thought }: { thought: ThoughtGalleryItem }) {
  const title = canonicalThoughtTitle(thought.rawText);
  return (
    <article
      className="thought-gallery__card"
      data-token-id={thought.tokenId}
      aria-label={`THOUGHT #${thought.tokenId}`}
    >
      <a
        className="thought-gallery__thumb"
        href={thoughtDetailUrl(thought.tokenId)}
        aria-label={`Open THOUGHT #${thought.tokenId}`}
      >
        <img
          className="thought-gallery__image"
          src={thought.image ? thoughtImageUrl(thought.tokenId) : fallbackThumbnailUri(title)}
          alt={`THOUGHT #${thought.tokenId}`}
          loading="lazy"
        />
        <span className="thought-gallery__tip">
          <strong>{`THOUGHT #${thought.tokenId}`}</strong>
          <span>{title || "(empty)"}</span>
          <span className="thought-gallery__tip-break" aria-hidden="true" />
          <span>{`$PATH #${thought.pathId} THOUGHT unit consumed`}</span>
          <span>{`minted ${galleryTipTime(thought.mintedAt)}`}</span>
          <span>{`by ${shortValue(thought.minter, 6, 4)}`}</span>
        </span>
      </a>
    </article>
  );
}

export default function ThoughtGalleryPage() {
  const [state, setState] = useState<LoadState>(() => {
    const cached = readCachedThoughtGallery();
    return cached
      ? { status: "ready", items: cached, error: null }
      : { status: "loading", items: [], error: null };
  });
  const [loadingIndex, setLoadingIndex] = useState(0);
  const createUrl = useMemo(() => thoughtAppUrl(), []);
  const count = state.items.length;

  useEffect(() => {
    if (state.status !== "loading") return undefined;
    const timer = window.setInterval(() => {
      setLoadingIndex((index) => (index + 1) % GALLERY_LOADING_DETAILS.length);
    }, 1400);
    return () => {
      window.clearInterval(timer);
    };
  }, [state.status]);

  useEffect(() => {
    let cancelled = false;

    void loadThoughtGallery()
      .then((items) => {
        if (!cancelled) {
          setState({ status: "ready", items, error: null });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const cached = readCachedThoughtGallery();
        if (cached) {
          setState({ status: "ready", items: cached, error: null });
          return;
        }
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Gallery unavailable.";
        setState({ status: "error", items: [], error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="thought-gallery" aria-labelledby="gallery-title">
      <header className="thought-gallery__header">
        <div>
          <p className="thought-gallery__eyebrow">{PUBLIC_NETWORK_CONFIG.environmentLabel}</p>
          <h1 id="gallery-title" className="thought-gallery__title">
            Gallery
          </h1>
        </div>
      </header>

      <div className="thought-gallery__status-row">
        <p className="thought-gallery__status" aria-live="polite">
          {state.status === "loading" ? (
            <ChainLoadingStatus detail={GALLERY_LOADING_DETAILS[loadingIndex]} />
          ) : state.status === "error" ? (
            state.error
          ) : count === 0 ? (
            "no minted THOUGHTs yet."
          ) : (
            `${count} minted THOUGHT${count === 1 ? "" : "s"}.`
          )}
        </p>
        <a className="thought-gallery__create" href={createUrl}>
          create your THOUGHT
        </a>
      </div>

      <div className="thought-gallery__grid">
        {state.items.map((thought) => (
          <ThoughtGalleryCard key={thought.tokenId} thought={thought} />
        ))}
      </div>

      <footer className="thought-gallery__footer" aria-label="Gallery references">
        <a
          className="thought-gallery__footer-link"
          href={colorFontUrl()}
          aria-label="Open the Color Font page"
        >
          color font
        </a>
      </footer>
    </main>
  );
}

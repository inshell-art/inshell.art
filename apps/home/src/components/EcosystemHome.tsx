import { useEffect, useState } from "react";
import {
  isThoughtGalleryDeploymentActive,
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";

type Movement = {
  key: "thought" | "will" | "awa";
  title: string;
  note: string;
  href?: string;
};

type GalleryState =
  | { status: "loading"; items: ThoughtGalleryItem[]; error: null }
  | { status: "prelaunch"; items: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; items: ThoughtGalleryItem[]; error: null }
  | { status: "error"; items: ThoughtGalleryItem[]; error: string };

const thoughtDeploymentActive = isThoughtGalleryDeploymentActive();

const MOVEMENTS: Movement[] = [
  {
    key: "thought",
    title: "THOUGHT",
    note: "try it now",
    href: "thought",
  },
  { key: "will", title: "WILL", note: "launch in 2027", href: "will" },
  { key: "awa", title: "AWA!", note: "launch in 2028" },
];

function thoughtImageUrl(tokenId: number): string {
  return `/api/thought-image?id=${encodeURIComponent(String(tokenId))}`;
}

function thoughtDetailUrl(tokenId: number): string {
  return `/thought/${encodeURIComponent(String(tokenId))}`;
}

function homeThoughtTargetId(): string | null {
  try {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    return /^thought-[1-9]\d*$/.test(targetId) ? targetId : null;
  } catch {
    return null;
  }
}

function initialGalleryState(): GalleryState {
  const cached = readCachedThoughtGallery();
  if (!thoughtDeploymentActive) {
    return { status: "prelaunch", items: [], error: null };
  }
  return cached
    ? { status: "ready", items: cached, error: null }
    : { status: "loading", items: [], error: null };
}

export default function EcosystemHome() {
  const studioPreview = !thoughtDeploymentActive;
  const [gallery, setGallery] = useState<GalleryState>(initialGalleryState);
  const [focusedTargetId, setFocusedTargetId] = useState(homeThoughtTargetId);

  useEffect(() => {
    if (!thoughtDeploymentActive) return undefined;
    let cancelled = false;

    void loadThoughtGallery()
      .then((items) => {
        if (!cancelled) setGallery({ status: "ready", items, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "THOUGHT gallery unavailable.";
        setGallery({ status: "error", items: [], error: message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gallery.status !== "ready") return;
    const targetId = homeThoughtTargetId();
    if (!targetId) return;
    const target = document.getElementById(targetId);
    const workLink = target?.querySelector<HTMLAnchorElement>(
      ".ecosystem-home__work-canvas",
    );
    if (!target || !workLink) return;

    const frame = window.requestAnimationFrame(() => {
      workLink.focus({ preventScroll: true });
      target.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [gallery]);

  return (
    <main className="ecosystem-home" aria-labelledby="ecosystem-home-slogan">
      <section className="ecosystem-home__hero">
        <div className="ecosystem-home__movements" aria-label="Inshell movements">
          {MOVEMENTS.map((movement) => (
            movement.href ? (
              <a
                key={movement.key}
                className="ecosystem-home__movement"
                href={`/${movement.href}`}
                aria-label={movement.title}
              >
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </a>
            ) : (
              <button
                key={movement.key}
                type="button"
                className="ecosystem-home__movement ecosystem-home__movement--button"
                aria-label={movement.title}
                onClick={() => window.alert("AWA!")}
              >
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </button>
            )
          ))}
        </div>
        <h1 id="ecosystem-home-slogan" className="ecosystem-home__slogan">
          3 fully onchain movements for Agent Art.
        </h1>
      </section>

      <section className="ecosystem-home__works" aria-label="THOUGHT works">
        <p className="ecosystem-home__works-status" aria-live="polite">
          {studioPreview || gallery.status === "prelaunch"
            ? "THOUGHT records will appear when onchain minting opens."
            : gallery.status === "loading"
              ? "reading THOUGHT works..."
              : gallery.status === "error"
                ? gallery.error
                : gallery.items.length === 0
                  ? (
                    <a className="ecosystem-home__works-invite" href="/thought">
                      Create the first THOUGHT.
                    </a>
                  )
                  : `${gallery.items.length} minted THOUGHT${gallery.items.length === 1 ? "" : "s"}.`}
        </p>

        <div className="ecosystem-home__works-grid">
          {gallery.items.map((work) => (
            <article
              id={`thought-${work.tokenId}`}
              className={`ecosystem-home__work-card${
                `thought-${work.tokenId}` === focusedTargetId
                  ? " ecosystem-home__work-card--focused"
                  : ""
              }`}
              data-token-id={work.tokenId}
              key={work.tokenId}
              aria-label={`THOUGHT #${work.tokenId}`}
            >
              <a
                className="ecosystem-home__work-canvas"
                href={thoughtDetailUrl(work.tokenId)}
                aria-label={`Open THOUGHT #${work.tokenId}`}
                onAnimationEnd={
                  `thought-${work.tokenId}` === focusedTargetId
                    ? () => {
                        setFocusedTargetId((current) =>
                          current === `thought-${work.tokenId}` ? null : current,
                        );
                      }
                    : undefined
                }
              >
                <img
                  src={work.image || thoughtImageUrl(work.tokenId)}
                  alt={`THOUGHT #${work.tokenId}`}
                  loading="lazy"
                  decoding="async"
                />
              </a>
              <div className="ecosystem-home__work-meta">
                <p className="ecosystem-home__work-meta-line">THOUGHT #{work.tokenId}</p>
                <p className="ecosystem-home__work-meta-line">
                  Agent: {work.provider.trim() || "-"}
                </p>
                <p className="ecosystem-home__work-meta-line">
                  Model: {work.model.trim() || "-"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

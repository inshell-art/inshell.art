import { useEffect, useState } from "react";
import {
  isThoughtGalleryDeploymentActive,
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";
import { PUBLIC_NETWORK_CONFIG } from "@inshell/shared";

type Movement = {
  key: "thought" | "will" | "awa";
  title: string;
  note: string;
  href?: string;
};

type GalleryState =
  | { status: "loading"; items: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; items: ThoughtGalleryItem[]; error: null }
  | { status: "error"; items: ThoughtGalleryItem[]; error: string };

const thoughtDeploymentActive = isThoughtGalleryDeploymentActive();

const MOVEMENTS: Movement[] = [
  {
    key: "thought",
    title: "THOUGHT",
    note: thoughtDeploymentActive
      ? `on ${PUBLIC_NETWORK_CONFIG.chainLabel} now`
      : "not deployed",
    href: "thought",
  },
  { key: "will", title: "WILL", note: "launch in 2027" },
  { key: "awa", title: "AWA!", note: "launch in 2028" },
];

function thoughtImageUrl(tokenId: number): string {
  return `/api/thought-image?id=${encodeURIComponent(String(tokenId))}`;
}

function thoughtDetailUrl(tokenId: number): string {
  return `/thought/${encodeURIComponent(String(tokenId))}`;
}

function initialGalleryState(): GalleryState {
  const cached = readCachedThoughtGallery();
  if (!thoughtDeploymentActive) {
    return {
      status: "error",
      items: [],
      error: "Current THOUGHT collection is not deployed.",
    };
  }
  return cached
    ? { status: "ready", items: cached, error: null }
    : { status: "loading", items: [], error: null };
}

export default function EcosystemHome() {
  const [gallery, setGallery] = useState<GalleryState>(initialGalleryState);

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

  return (
    <main className="ecosystem-home" aria-labelledby="ecosystem-home-slogan">
      <section className="ecosystem-home__hero">
        <div className="ecosystem-home__movements" aria-label="Inshell movements">
          {MOVEMENTS.map((movement) => (
            movement.href === "thought" ? (
              <a
                key={movement.key}
                className="ecosystem-home__movement"
                href="/thought"
                aria-label={movement.title}
              >
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </a>
            ) : (
              <span key={movement.key} className="ecosystem-home__movement">
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </span>
            )
          ))}
        </div>
        <h1 id="ecosystem-home-slogan" className="ecosystem-home__slogan">
          3 fully onchain movements for Agent Art.
        </h1>
      </section>

      <section className="ecosystem-home__works" aria-label="THOUGHT works">
        <p className="ecosystem-home__works-status" aria-live="polite">
          {gallery.status === "loading"
            ? "reading THOUGHT works..."
            : gallery.status === "error"
              ? gallery.error
              : gallery.items.length === 0
                ? "no minted THOUGHTs yet."
                : `${gallery.items.length} minted THOUGHT${gallery.items.length === 1 ? "" : "s"}.`}
        </p>

        <div className="ecosystem-home__works-grid">
          {gallery.items.map((work) => (
            <article
              className="ecosystem-home__work-card"
              data-token-id={work.tokenId}
              key={work.tokenId}
              aria-label={`THOUGHT #${work.tokenId}`}
            >
              <a
                className="ecosystem-home__work-canvas"
                href={thoughtDetailUrl(work.tokenId)}
                aria-label={`Open THOUGHT #${work.tokenId}`}
              >
                <img
                  src={thoughtImageUrl(work.tokenId)}
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
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

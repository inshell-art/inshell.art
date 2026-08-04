import { useEffect, useState } from "react";
import {
  loadThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";

type Movement = {
  key: "thought" | "will" | "awa";
  title: string;
  note: string;
  href?: string;
};

type HomeGalleryState =
  | { status: "loading"; works: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; works: ThoughtGalleryItem[]; error: null }
  | { status: "error"; works: ThoughtGalleryItem[]; error: string };

const MOVEMENTS: Movement[] = [
  {
    key: "thought",
    title: "THOUGHT",
    note: "on Sepolia now",
    href: "thought?new=1",
  },
  {
    key: "will",
    title: "WILL",
    note: "launch in 2027",
    href: "will",
  },
  {
    key: "awa",
    title: "AWA!",
    note: "launch in 2028",
  },
];

function thoughtAvailabilityNote() {
  const env = (globalThis as any).__VITE_ENV__ as
    | Record<string, unknown>
    | undefined;
  return String(env?.VITE_NETWORK ?? "").toLowerCase() === "devnet"
    ? "local Anvil"
    : "on Sepolia now";
}

function homeThoughtTargetId(): string | null {
  try {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    return /^thought-[1-9]\d*$/.test(targetId) ? targetId : null;
  } catch {
    return null;
  }
}

function newestThoughtWorks(works: ThoughtGalleryItem[]): ThoughtGalleryItem[] {
  return works.slice().sort((left, right) => {
    const leftMintedAt = left.mintedAt;
    const rightMintedAt = right.mintedAt;
    if (leftMintedAt != null && rightMintedAt != null) {
      return rightMintedAt - leftMintedAt || right.tokenId - left.tokenId;
    }
    if (leftMintedAt != null) return -1;
    if (rightMintedAt != null) return 1;
    return right.tokenId - left.tokenId;
  });
}

function HomeThoughtCard({
  work,
  focused,
  onFocusFlashEnd,
}: {
  work: ThoughtGalleryItem;
  focused: boolean;
  onFocusFlashEnd: () => void;
}) {
  const agent = work.agent?.trim() || work.declaredAgent?.trim() || "-";
  const model = work.model?.trim() || work.declaredModel?.trim() || "-";
  return (
    <article
      id={`thought-${work.tokenId}`}
      className={`ecosystem-home__work-card${
        focused ? " ecosystem-home__work-card--focused" : ""
      }`}
      data-token-id={work.tokenId}
      aria-label={`THOUGHT #${work.tokenId} minted work`}
    >
      <a
        className="ecosystem-home__work-canvas"
        href={`/thought/${work.tokenId}`}
        aria-label={`Open THOUGHT #${work.tokenId}`}
        onAnimationEnd={focused ? onFocusFlashEnd : undefined}
      >
        <img
          src={work.image}
          alt={`THOUGHT #${work.tokenId} canvas`}
          loading="lazy"
          decoding="async"
        />
      </a>
      <div className="ecosystem-home__work-meta">
        <p className="ecosystem-home__work-meta-line">THOUGHT #{work.tokenId}</p>
        <p className="ecosystem-home__work-meta-line">
          Agent: {agent}
        </p>
        <p className="ecosystem-home__work-meta-line">
          Model: {model}
        </p>
      </div>
    </article>
  );
}

export default function EcosystemHome() {
  const [gallery, setGallery] = useState<HomeGalleryState>({
    status: "loading",
    works: [],
    error: null,
  });
  const [focusedTargetId, setFocusedTargetId] = useState(homeThoughtTargetId);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    const readChain = () => {
      const currentRequestId = ++requestId;
      void loadThoughtGallery({ cacheMode: "bypass" })
        .then((works) => {
          if (!cancelled && currentRequestId === requestId) {
            setGallery({
              status: "ready",
              works: newestThoughtWorks(works),
              error: null,
            });
          }
        })
        .catch((error: unknown) => {
          if (cancelled || currentRequestId !== requestId) return;
          setGallery({
            status: "error",
            works: [],
            error:
              error instanceof Error && error.message.trim()
                ? error.message
                : "THOUGHT gallery unavailable.",
          });
        });
    };
    const readChainWhenVisible = () => {
      if (document.visibilityState === "visible") readChain();
    };

    readChain();
    document.addEventListener("visibilitychange", readChainWhenVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", readChainWhenVisible);
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
          {MOVEMENTS.map((movement) => {
            const note =
              movement.key === "thought"
                ? thoughtAvailabilityNote()
                : movement.note;
            return (
            movement.href ? (
              <a
                key={movement.key}
                className="ecosystem-home__movement"
                href={`/${movement.href}`}
                aria-label={movement.title}
              >
                <span className="ecosystem-home__movement-note" data-note={note}>
                  {note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </a>
            ) : (
              <span key={movement.key} className="ecosystem-home__movement">
                <span className="ecosystem-home__movement-note" data-note={note}>
                  {note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </span>
            )
            );
          })}
        </div>
        <h1 id="ecosystem-home-slogan" className="ecosystem-home__slogan">
          3 fully onchain movements for Agent Art.
        </h1>
      </section>
      <div
        className="ecosystem-home__works"
        aria-label="Minted THOUGHT works"
      >
        {gallery.status === "loading" ? (
          <p className="ecosystem-home__works-status">reading THOUGHTs from chain...</p>
        ) : gallery.status === "error" ? (
          <p className="ecosystem-home__works-status" title={gallery.error}>
            THOUGHT gallery unavailable.
          </p>
        ) : gallery.works.length === 0 ? (
          <p className="ecosystem-home__works-status">no minted THOUGHTs yet.</p>
        ) : (
          gallery.works.map((work) => (
            <HomeThoughtCard
              key={work.tokenId}
              work={work}
              focused={`thought-${work.tokenId}` === focusedTargetId}
              onFocusFlashEnd={() => {
                setFocusedTargetId((current) =>
                  current === `thought-${work.tokenId}` ? null : current,
                );
              }}
            />
          ))
        )}
      </div>
    </main>
  );
}

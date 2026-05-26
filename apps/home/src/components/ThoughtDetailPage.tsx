import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";

type LoadState =
  | { status: "loading"; items: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; items: ThoughtGalleryItem[]; error: null }
  | { status: "error"; items: ThoughtGalleryItem[]; error: string };

type DetailRow = {
  label: string;
  value: string;
  title?: string;
  href?: string;
  external?: boolean;
};

function getEnvValue(name: string): unknown {
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env as
    | Record<string, unknown>
    | undefined;
  return envCache?.[name] ?? procEnv?.[name];
}

function isPreviewDeployment(): boolean {
  const deployEnv = getEnvValue("VITE_DEPLOY_ENV");
  if (typeof deployEnv === "string" && deployEnv.trim().toLowerCase() === "preview") {
    return true;
  }
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "preview.inshell.art" || hostname.endsWith(".preview.inshell.art");
}

function configuredUrl(name: string) {
  const value = getEnvValue(name);
  return typeof value === "string" && /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : null;
}

function galleryUrl(): string {
  return (
    configuredUrl("VITE_THOUGHT_GALLERY_URL") ??
    configuredUrl("VITE_GALLERY_URL") ??
    (isPreviewDeployment()
      ? "https://gallery.preview.inshell.art/"
      : "https://gallery.inshell.art/")
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

function shortValue(value?: string, head = 6, tail = 4): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  return new Date(seconds * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function explorerTxUrl(txHash: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  const configured = configuredUrl("VITE_THOUGHT_EXPLORER_BASE_URL");
  const base = configured?.replace(/\/$/, "") ?? "https://sepolia.etherscan.io";
  return `${base}/tx/${txHash}`;
}

function DetailRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="path-detail__fields">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`}>
          <dt>{row.label}</dt>
          <dd title={row.title}>
            {row.href ? (
              <a
                href={row.href}
                className="path-detail__value-link"
                target={row.external ? "_blank" : undefined}
                rel={row.external ? "noopener noreferrer" : undefined}
              >
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ThoughtSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="path-detail__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function thoughtTitle(item: ThoughtGalleryItem): string {
  return item.rawText.trim() || `THOUGHT #${item.tokenId}`;
}

function ThoughtDetail({ item }: { item: ThoughtGalleryItem }) {
  const txUrl = explorerTxUrl(item.txHash);
  const title = thoughtTitle(item);

  return (
    <article className="path-detail thought-detail" aria-label={`THOUGHT #${item.tokenId} detail`}>
      <div className="path-detail__canvas-frame thought-detail__canvas-frame">
        {item.image ? (
          <img
            className="path-detail__image thought-detail__image"
            src={item.image}
            alt={`THOUGHT #${item.tokenId} work`}
            title={title}
          />
        ) : (
          <div className="path-page-token__missing">image unavailable</div>
        )}
      </div>
      <section className="path-detail__rail" aria-label={`THOUGHT #${item.tokenId} record`}>
        <header className="path-detail__record-header">
          <h2>THOUGHT #{item.tokenId}</h2>
          <p>Created from $PATH #{item.pathId}.</p>
        </header>

        <ThoughtSection title="work">
          <div className="thought-detail__text">{title}</div>
        </ThoughtSection>

        <ThoughtSection title="record">
          <DetailRows
            rows={[
              {
                label: "$PATH",
                value: `$PATH #${item.pathId}`,
                href: `/path/${item.pathId}`,
              },
              { label: "minter", value: shortValue(item.minter), title: item.minter },
              { label: "minted", value: formatTimestamp(item.mintedAt) },
              { label: "block", value: item.blockNumber ? String(item.blockNumber) : "-" },
              txUrl
                ? {
                    label: "tx",
                    value: `${shortValue(item.txHash)} ->`,
                    title: item.txHash,
                    href: txUrl,
                    external: true,
                  }
                : { label: "tx", value: shortValue(item.txHash), title: item.txHash },
            ]}
          />
        </ThoughtSection>

        <ThoughtSection title="model">
          <DetailRows
            rows={[
              { label: "provider", value: item.provider || "-" },
              { label: "model", value: item.model || "-" },
              { label: "mode", value: item.mode || "-" },
            ]}
          />
        </ThoughtSection>

        {item.prompt && (
          <ThoughtSection title="prompt">
            <div className="thought-detail__text thought-detail__text--muted">
              {item.prompt}
            </div>
          </ThoughtSection>
        )}

        <ThoughtSection title="hashes">
          <DetailRows
            rows={[
              { label: "text", value: shortValue(item.textHash), title: item.textHash },
              { label: "prompt", value: shortValue(item.promptHash), title: item.promptHash },
              {
                label: "provenance",
                value: shortValue(item.provenanceHash),
                title: item.provenanceHash,
              },
              { label: "spec", value: shortValue(item.thoughtSpecHash), title: item.thoughtSpecHash },
            ]}
          />
        </ThoughtSection>

        <nav className="primitive-page__links path-detail__links" aria-label="THOUGHT detail links">
          <a href={galleryUrl()} aria-label="Back to THOUGHT gallery">
            Back to gallery
          </a>
          <a href={thoughtAppUrl()} target="_blank" rel="noopener noreferrer" aria-label="Create THOUGHT">
            Create THOUGHT
          </a>
        </nav>
      </section>
    </article>
  );
}

export default function ThoughtDetailPage({ tokenId }: { tokenId: string }) {
  const targetTokenId = useMemo(() => Number(tokenId), [tokenId]);
  const [state, setState] = useState<LoadState>(() => {
    const cached = readCachedThoughtGallery();
    return cached
      ? { status: "ready", items: cached, error: null }
      : { status: "loading", items: [], error: null };
  });

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedThoughtGallery();
    if (cached) {
      setState({ status: "ready", items: cached, error: null });
    } else {
      setState({ status: "loading", items: [], error: null });
    }

    void loadThoughtGallery()
      .then((items) => {
        if (cancelled) return;
        setState({ status: "ready", items, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          items: cached ?? [],
          error: String((error as Error)?.message ?? error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const item = Number.isFinite(targetTokenId)
    ? state.items.find((entry) => entry.tokenId === targetTokenId)
    : null;

  return (
    <main className="primitive-page path-page thought-detail-page">
      <header className="primitive-page__header path-page__header">
        <div>
          <h1 className="primitive-page__title">THOUGHT #{tokenId}</h1>
          <p className="primitive-page__subtitle">THOUGHT work detail.</p>
        </div>
      </header>

      <section className="path-page__body path-page__body--detail" aria-label={`THOUGHT #${tokenId} work`}>
        {state.status === "error" && (
          <div className="path-page__notice path-page__notice--error">
            {state.error}
          </div>
        )}
        {item ? (
          <ThoughtDetail item={item} />
        ) : state.status === "ready" ? (
          <div className="path-page__notice">THOUGHT #{tokenId} not found.</div>
        ) : (
          <div className="path-page__notice">loading THOUGHT...</div>
        )}
      </section>
    </main>
  );
}

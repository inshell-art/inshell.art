import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";

const SPEC_SOURCE_URL =
  "https://github.com/inshell-art/inshell.art/blob/main/apps/thought/THOUGHT.v1.md";

type LoadState =
  | { status: "loading"; items: ThoughtGalleryItem[]; error: null }
  | { status: "ready"; items: ThoughtGalleryItem[]; error: null }
  | { status: "error"; items: ThoughtGalleryItem[]; error: string };

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

function shortDetailAddress(value: string): string {
  return shortValue(value, 18, 10);
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

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  return new Date(seconds * 1000)
    .toISOString()
    .replace(".000Z", "Z")
    .replace("T", " ")
    .replace("Z", " UTC");
}

function formatProvenanceJson(value: string): string {
  if (!value) return "{}";
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function provenanceDataUrl(value: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(formatProvenanceJson(value))}`;
}

function explorerTxUrl(txHash: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  const configured = configuredUrl("VITE_THOUGHT_EXPLORER_BASE_URL");
  const base = configured?.replace(/\/$/, "") ?? "https://sepolia.etherscan.io";
  return `${base}/tx/${txHash}`;
}

function ThoughtSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="thought-detail__section">
      <h2>{title}</h2>
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
  const provenanceBytes = item.provenanceJson ? byteLength(item.provenanceJson) : 0;

  return (
    <div className="thought-detail__body">
      <div className="thought-detail__canvas-frame">
        {item.image ? (
          <img
            className="thought-detail__image"
            src={item.image}
            alt={`THOUGHT #${item.tokenId} canvas`}
            title={title}
          />
        ) : (
          <div className="thought-detail__missing">image unavailable</div>
        )}
      </div>

      <aside className="thought-detail__rail" aria-label={`THOUGHT #${item.tokenId} record`}>
        <ThoughtSection title="prompt">
          <p className="thought-detail__text">{item.prompt || "prompt unavailable."}</p>
        </ThoughtSection>

        <ThoughtSection title="spec">
          <a
            className="thought-detail__value thought-detail__value-link"
            href={SPEC_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            THOUGHT.v1.md -&gt;
          </a>
        </ThoughtSection>

        <ThoughtSection title="model">
          <p className="thought-detail__value">{item.model || "model unavailable."}</p>
        </ThoughtSection>

        <ThoughtSection title="model return">
          <p className="thought-detail__text">
            {item.returnedText || "model return unavailable."}
          </p>
        </ThoughtSection>

        <ThoughtSection title="text">
          <p className="thought-detail__text">{canonicalThoughtTitle(item.rawText)}</p>
        </ThoughtSection>

        <ThoughtSection title="$PATH">
          <a
            className="thought-detail__value thought-detail__value-link"
            href={`/path/${item.pathId}`}
            title={`Open $PATH #${item.pathId} detail`}
          >
            $PATH #{item.pathId} -&gt;
          </a>
        </ThoughtSection>

        <ThoughtSection title="mint">
          <dl className="thought-detail__fields">
            <div>
              <dt>minter</dt>
              <dd title={item.minter}>{shortDetailAddress(item.minter)}</dd>
            </div>
            <div>
              <dt>minted</dt>
              <dd>{formatTimestamp(item.mintedAt)}</dd>
            </div>
            <div>
              <dt>tx</dt>
              <dd>
                {txUrl ? (
                  <a
                    className="thought-detail__value-link"
                    href={txUrl}
                    title={item.txHash}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shortValue(item.txHash, 22, 14)} -&gt;
                  </a>
                ) : (
                  shortValue(item.txHash)
                )}
              </dd>
            </div>
          </dl>
        </ThoughtSection>

        <ThoughtSection title="provenance">
          {item.provenanceJson ? (
            <>
              <a
                className="thought-detail__value thought-detail__value-link"
                href={provenanceDataUrl(item.provenanceJson)}
                target="_blank"
                rel="noopener noreferrer"
                download={`thought-${item.tokenId}-provenance.json`}
              >
                {provenanceBytes} bytes -&gt;
              </a>
              <div className="thought-detail__viewer">
                <p className="thought-detail__viewer-title">
                  source: ThoughtNFT.provenanceOf({item.tokenId})
                </p>
                <pre className="thought-detail__json">
                  {formatProvenanceJson(item.provenanceJson)}
                </pre>
              </div>
            </>
          ) : (
            <p className="thought-detail__value">unavailable.</p>
          )}
        </ThoughtSection>

        <ThoughtSection title="color font">
          <a className="thought-detail__value thought-detail__value-link" href="/color-font">
            Color Font v1 -&gt;
          </a>
        </ThoughtSection>
      </aside>
    </div>
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
        if (cached?.length) {
          setState({ status: "ready", items: cached, error: null });
          return;
        }
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
    <main className="thought-detail thought-detail-page" aria-labelledby="thought-detail-title">
      <header className="thought-detail__header">
        <h1 id="thought-detail-title" className="thought-detail__title">
          THOUGHT #<span>{tokenId}</span>
        </h1>
        <nav className="thought-detail__links" aria-label="THOUGHT detail links">
          <a className="thought-detail__link" href={galleryUrl()}>
            [ gallery ]
          </a>
          <a className="thought-detail__link" href={thoughtAppUrl()}>
            [ create yours ]
          </a>
        </nav>
      </header>

      {state.status === "error" && (
        <p className="thought-detail__status thought-detail__status--error">{state.error}</p>
      )}
      {item ? (
        <ThoughtDetail item={item} />
      ) : state.status === "ready" ? (
        <p className="thought-detail__status">THOUGHT #{tokenId} not found.</p>
      ) : (
        <p className="thought-detail__status">loading THOUGHT #{tokenId}...</p>
      )}
    </main>
  );
}

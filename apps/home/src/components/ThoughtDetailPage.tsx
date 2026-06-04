import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
} from "react";
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

function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function defaultGalleryUrl(): string {
  if (isPreviewDeployment()) return "https://gallery.preview.inshell.art/";
  if (isLocalBrowserHost()) return "http://127.0.0.1:5174/gallery";
  return "https://gallery.inshell.art/";
}

function galleryUrl(): string {
  return (
    configuredUrl("VITE_GALLERY_URL") ??
    configuredUrl("VITE_THOUGHT_GALLERY_URL") ??
    defaultGalleryUrl()
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

function thoughtRawText(item: ThoughtGalleryItem): string {
  return item.rawText.trim() || canonicalThoughtTitle(item.rawText) || "-";
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

function thoughtDetailApiUrl(tokenId: number, part: "provenance" | "spec"): string {
  return `/api/thought-${part}?id=${encodeURIComponent(String(tokenId))}`;
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

function ThoughtTextBlock({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<ElementRef<"p"> | null>(null);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window === "undefined") return;

    const sync = () => {
      const wasEmbedded = element.classList.contains("is-embedded");
      element.classList.remove("is-embedded");
      const style = window.getComputedStyle(element);
      const lineHeight =
        Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.55;
      if (wasEmbedded) {
        element.classList.add("is-embedded");
      }
      setEmbedded(element.scrollHeight > lineHeight * 2 + 1);
    };

    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("resize", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", sync);
    };
  }, [children]);

  return (
    <p
      id={id}
      ref={ref}
      className={`thought-detail__text${embedded ? " is-embedded" : ""}`}
    >
      {children}
    </p>
  );
}

function thoughtTitle(item: ThoughtGalleryItem): string {
  return thoughtRawText(item) || `THOUGHT #${item.tokenId}`;
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
          <ThoughtTextBlock id="thought-detail-prompt">
            {item.prompt || "prompt unavailable."}
          </ThoughtTextBlock>
        </ThoughtSection>

        <ThoughtSection title="spec">
          <a
            id="thought-detail-spec-ref"
            className="thought-detail__value thought-detail__value-link"
            href={thoughtDetailApiUrl(item.tokenId, "spec")}
            title="Open cached spec JSON"
            target="_blank"
            rel="noopener noreferrer"
          >
            THOUGHT.v1.md ↗
          </a>
        </ThoughtSection>

        <ThoughtSection title="model">
          <p className="thought-detail__value">{item.model || "model unavailable."}</p>
        </ThoughtSection>

        <ThoughtSection title="model return">
          <ThoughtTextBlock id="thought-detail-model-return">
            {item.returnedText || "model return unavailable."}
          </ThoughtTextBlock>
        </ThoughtSection>

        <ThoughtSection title="text">
          <ThoughtTextBlock id="thought-detail-canonical-title">
            {thoughtRawText(item)}
          </ThoughtTextBlock>
        </ThoughtSection>

        <ThoughtSection title="$PATH">
          <a
            id="thought-detail-path"
            className="thought-detail__value thought-detail__path-link"
            href={`/path/${item.pathId}`}
            title={`Open $PATH #${item.pathId} detail`}
          >
            $PATH #{item.pathId} ↗
          </a>
        </ThoughtSection>

        <ThoughtSection title="mint">
          <dl className="thought-detail__fields">
            <div>
              <dt>minter</dt>
              <dd id="thought-detail-minter" title={item.minter}>
                {shortDetailAddress(item.minter)}
              </dd>
            </div>
            <div>
              <dt>network</dt>
              <dd>{PUBLIC_NETWORK_CONFIG.environmentLabel}</dd>
            </div>
            <div>
              <dt>chain</dt>
              <dd>{PUBLIC_NETWORK_CONFIG.chainLabel}</dd>
            </div>
            <div>
              <dt>chain id</dt>
              <dd>{PUBLIC_NETWORK_CONFIG.chainId}</dd>
            </div>
            <div>
              <dt>currency</dt>
              <dd>{PUBLIC_NETWORK_CONFIG.currencyLabel}</dd>
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
                    id="thought-detail-view-tx"
                    className="thought-detail__value-link"
                    href={txUrl}
                    title={item.txHash}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {shortValue(item.txHash, 22, 14)} ↗
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
                href={thoughtDetailApiUrl(item.tokenId, "provenance")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {provenanceBytes} bytes ↗
              </a>
              <div className="thought-detail__viewer is-hidden" aria-hidden="true">
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
          <a
            id="thought-detail-color-font"
            className="thought-detail__value thought-detail__value-link"
            href="/color-font"
            title="Open color-font source of truth"
            target="_blank"
            rel="noopener noreferrer"
          >
            Color Font v1 ↗
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

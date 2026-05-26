import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import Movements from "@/components/Movements";
import Footer from "@/components/Footer/Footer";
import PulsePage from "@/components/PulsePage";
import ColorFontPage from "@/components/ColorFontPage";
import PathPage from "@/components/PathPage";
import VerifyPage from "@/components/VerifyPage";
import FloatingReportBug from "@/components/FloatingReportBug";
import PreviewWatermark from "@/components/PreviewWatermark";
import { maybeResolveAddress } from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";

function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function getPrimitiveRoute() {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname.replace(/\/+$/, "");
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/color-font") return "color-font";
  if (pathname === "/path" || /^\/path\/[1-9]\d*$/.test(pathname)) return "path";
  if (pathname === "/verify") return "verify";
  if (/^\/thought\/[1-9]\d*$/.test(pathname)) return "thought";
  return null;
}

function getPathRouteTokenId() {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return /^\/path\/([1-9]\d*)$/.exec(pathname)?.[1] ?? null;
}

function getThoughtRouteTokenId() {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname.replace(/\/+$/, "");
  return /^\/thought\/([1-9]\d*)$/.exec(pathname)?.[1] ?? null;
}

function setFavicon(href: string) {
  const existingIcon = document.querySelector('link[rel="icon"]');
  let icon =
    existingIcon instanceof globalThis.HTMLLinkElement ? existingIcon : null;
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }
  icon.type = "image/svg+xml";
  icon.setAttribute("href", href);
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

function isDevLikeEnv(): boolean {
  const dev = getEnvValue("DEV");
  const mode = getEnvValue("MODE");
  const nodeEnv = getEnvValue("NODE_ENV");
  return dev === true || mode === "development" || nodeEnv === "test";
}

function defaultThoughtUrl(): string {
  if (isDevLikeEnv()) return "http://127.0.0.1:5174/";
  return isPreviewDeployment()
    ? "https://thought.preview.inshell.art/"
    : "https://thought.inshell.art/";
}

function resolveThoughtDetailUrl(tokenId: string): string {
  const explicit =
    getEnvValue("VITE_THOUGHT_URL") ?? getEnvValue("VITE_THOUGHT_APP_URL");
  const base =
    typeof explicit === "string" && /^https?:\/\//i.test(explicit.trim())
      ? explicit.trim()
      : defaultThoughtUrl();
  const url = new globalThis.URL(base);
  url.pathname = `/thought/${tokenId}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function ThoughtRouteBridge({ tokenId }: { tokenId: string }) {
  const href = resolveThoughtDetailUrl(tokenId);

  useEffect(() => {
    if (getEnvValue("NODE_ENV") === "test") return;
    window.location.replace(href);
  }, [href]);

  return (
    <main className="primitive-page thought-route-bridge">
      <h1 className="primitive-page__title">THOUGHT #{tokenId}</h1>
      <p className="primitive-page__status">opening THOUGHT #{tokenId}...</p>
      <a href={href}>Open THOUGHT #{tokenId}</a>
    </main>
  );
}

export default function App() {
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const primitiveRoute = getPrimitiveRoute();

  useEffect(() => {
    if (primitiveRoute === "pulse") {
      document.title = `pulse — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/pulse.svg");
      return;
    }
    if (primitiveRoute === "color-font") {
      document.title = "color-font";
      setFavicon("/color-font.svg");
      return;
    }
    if (primitiveRoute === "path") {
      const pathTokenId = getPathRouteTokenId();
      document.title = pathTokenId ? `$PATH #${pathTokenId}` : "$PATH";
      setFavicon("/path.svg");
      return;
    }
    if (primitiveRoute === "verify") {
      document.title = `verify — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "thought") {
      const thoughtTokenId = getThoughtRouteTokenId();
      document.title = thoughtTokenId ? `THOUGHT #${thoughtTokenId}` : "THOUGHT";
      setFavicon("/inshell.svg");
      return;
    }
    document.title = SURFACE_TERMINOLOGY.ecosystem;
    setFavicon("/inshell.svg");
  }, [primitiveRoute]);

  const thoughtTokenId = getThoughtRouteTokenId();

  return (
    <>
      <ErrorBoundary
        FallbackComponent={({ error }) => (
          <div style={{ padding: "20px", color: "red" }}>
            <h1>page error</h1>
            <p>{error.message}</p>
          </div>
        )}
      >
        <div className={`shell${primitiveRoute ? "" : " shell--home"}`}>
          {primitiveRoute === "pulse" ? (
            <PulsePage />
          ) : primitiveRoute === "color-font" ? (
            <ColorFontPage />
          ) : primitiveRoute === "path" ? (
            <PathPage tokenId={getPathRouteTokenId()} />
          ) : primitiveRoute === "verify" ? (
            <VerifyPage />
          ) : primitiveRoute === "thought" && thoughtTokenId ? (
            <ThoughtRouteBridge tokenId={thoughtTokenId} />
          ) : (
            <div className="content content--home">
              <AuctionCanvas address={pulseAuction} />
              <div className="hero">
                <Movements />
              </div>
            </div>
          )}
          {primitiveRoute ? null : <Footer />}
        </div>
      </ErrorBoundary>
      <PreviewWatermark />
      <FloatingReportBug />
    </>
  );
}

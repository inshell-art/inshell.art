import { useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import EcosystemHome from "@/components/EcosystemHome";
import PulsePage from "@/components/PulsePage";
import ColorFontPage from "@/components/ColorFontPage";
import PathPage from "@/components/PathPage";
import PathMarketplaceLabPage from "@/components/PathMarketplaceLabPage";
import DocsPage from "@/components/DocsPage";
import VerifyPage from "@/components/VerifyPage";
import ThoughtDetailPage from "@/components/ThoughtDetailPage";
import ThoughtGalleryPage from "@/components/ThoughtGalleryPage";
import WillPage from "@/components/WillPage";
import FloatingReportBug from "@/components/FloatingReportBug";
import PreviewWatermark from "@/components/PreviewWatermark";
import { InshellTopBar, type InshellSurface } from "@inshell/inshell-shell";
import { getProtocolReleaseChainId, maybeResolveAddress } from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";

function getLocationKey() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function pathnameFromLocationKey(locationKey: string) {
  return locationKey.split(/[?#]/)[0].replace(/\/+$/, "");
}

function parseTokenRouteId(pathname: string, route: "path" | "thought") {
  const match = new RegExp(`^/${route}/([1-9]\\d{0,8})$`).exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? match[1] : null;
}

function getPrimitiveRoute(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  if (pathname === "/path-app") return "path-app";
  const query = locationKey.split("?")[1]?.split("#")[0] ?? "";
  if (pathname === "/path" && !new URLSearchParams(query).has("fixture")) {
    return "path-app";
  }
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/docs") return "docs";
  if (pathname === "/color-font") return "color-font";
  if (
    pathname === "/lab/path-marketplace" ||
    getPathMarketplaceRouteTokenId(locationKey)
  ) return "path-marketplace-lab";
  if (pathname === "/path" || parseTokenRouteId(pathname, "path")) return "path";
  if (pathname === "/gallery") return "gallery";
  if (pathname === "/will") return "will";
  if (pathname === "/verify") return "verify";
  if (parseTokenRouteId(pathname, "thought")) return "thought";
  return null;
}

function getHostname() {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

function isPathAppHost() {
  const hostname = getHostname();
  return hostname === "path.inshell.art" || hostname === "path.preview.inshell.art";
}

function activeSurfaceForRoute(route: string | null): InshellSurface {
  if (
    route === "path-app" ||
    route === "path" ||
    route === "pulse" ||
    route === "path-marketplace-lab"
  ) return "path";
  if (route === "gallery" || route === "thought") return "works";
  return "home";
}

function getPathRouteTokenId(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  return parseTokenRouteId(pathname, "path");
}

function getThoughtRouteTokenId(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  return parseTokenRouteId(pathname, "thought");
}

function getPathMarketplaceRouteTokenId(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  const match = /^\/lab\/path-marketplace\/([1-9]\d{0,8})$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? match[1] : null;
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

export default function App() {
  const [locationKey, setLocationKey] = useState(() => getLocationKey());
  const [pathInventoryRefreshSignal, setPathInventoryRefreshSignal] = useState(0);
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const primitiveRoute = getPrimitiveRoute(locationKey);
  const pathAppHost = isPathAppHost();
  const pathTokenId = getPathRouteTokenId(locationKey);
  const thoughtTokenId = getThoughtRouteTokenId(locationKey);
  const pathMarketplaceTokenId = getPathMarketplaceRouteTokenId(locationKey);
  const shouldRenderPathApp =
    primitiveRoute === "path-app" ||
    primitiveRoute === "path" ||
    (pathAppHost && !primitiveRoute);
  const isPathContext =
    shouldRenderPathApp || primitiveRoute === "path-marketplace-lab";
  const activeSurface = shouldRenderPathApp ? "path" : activeSurfaceForRoute(primitiveRoute);
  const pathExpectedChainId = isPathContext
    ? getProtocolReleaseChainId()
    : undefined;
  const pathWalletNote =
    pathExpectedChainId === 31337 || pathExpectedChainId === 1337
      ? "local ETH"
      : "Sepolia ETH";
  const refreshPathInventory = useCallback(() => {
    setPathInventoryRefreshSignal((value) => value + 1);
  }, []);

  useEffect(() => {
    const updateLocation = () => {
      setLocationKey(getLocationKey());
    };
    window.addEventListener("popstate", updateLocation);
    return () => {
      window.removeEventListener("popstate", updateLocation);
    };
  }, []);

  useEffect(() => {
    const pathname = pathnameFromLocationKey(locationKey);
    if (pathname !== "/path-app") return;
    const [, suffix = ""] = locationKey.split("/path-app");
    const nextPath = `/path${suffix}`;
    window.history.replaceState({}, "", nextPath);
    setLocationKey(getLocationKey());
  }, [locationKey]);

  useEffect(() => {
    if (shouldRenderPathApp) {
      document.title = pathTokenId ? `$PATH #${pathTokenId}` : "$PATH";
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "pulse") {
      document.title = `pulse — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "docs") {
      document.title = `docs — ${SURFACE_TERMINOLOGY.ecosystem}`;
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "color-font") {
      document.title = "color-font";
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "path-marketplace-lab") {
      document.title = pathMarketplaceTokenId
        ? `$PATH #${pathMarketplaceTokenId} marketplace lab`
        : "$PATH marketplace lab";
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "gallery") {
      document.title = "THOUGHT Gallery";
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "will") {
      document.title = "WILL";
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "verify") {
      document.title = `verify — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/inshell.svg");
      return;
    }
    if (primitiveRoute === "thought") {
      document.title = thoughtTokenId ? `THOUGHT #${thoughtTokenId}` : "THOUGHT";
      setFavicon("/inshell.svg");
      return;
    }
    document.title = SURFACE_TERMINOLOGY.ecosystem;
    setFavicon("/inshell.svg");
  }, [pathMarketplaceTokenId, pathTokenId, primitiveRoute, shouldRenderPathApp, thoughtTokenId]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    const targetId = decodeURIComponent(hash.slice(1));
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [locationKey]);

  return (
    <>
      <ErrorBoundary
        FallbackComponent={({ error }) => (
          <div style={{ padding: "20px", color: "red" }}>
            <h1>page error</h1>
            <p>{error instanceof Error ? error.message : String(error)}</p>
          </div>
        )}
      >
        <div
          className={`shell${
            shouldRenderPathApp
              ? " shell--path-app"
              : primitiveRoute
                ? ""
                : " shell--home"
          }`}
        >
          <InshellTopBar
            active={activeSurface}
            expectedChainId={pathExpectedChainId}
            disconnectedWalletNote={
              isPathContext ? pathWalletNote : undefined
            }
            onWalletRefresh={
              isPathContext ? refreshPathInventory : undefined
            }
          />
          {shouldRenderPathApp ? (
            <div className={`content content--path-app${pathTokenId ? " content--path-detail" : ""}`}>
              {!pathTokenId ? (
                <AuctionCanvas
                  address={pulseAuction}
                  onPathMinted={refreshPathInventory}
                />
              ) : null}
              <PathPage
                tokenId={pathTokenId}
                refreshSignal={pathInventoryRefreshSignal}
              />
            </div>
          ) : primitiveRoute === "pulse" ? (
            <PulsePage />
          ) : primitiveRoute === "docs" ? (
            <DocsPage />
          ) : primitiveRoute === "color-font" ? (
            <ColorFontPage />
          ) : primitiveRoute === "path-marketplace-lab" ? (
            <PathMarketplaceLabPage
              refreshSignal={pathInventoryRefreshSignal}
              tokenId={pathMarketplaceTokenId}
            />
          ) : primitiveRoute === "gallery" ? (
            <ThoughtGalleryPage />
          ) : primitiveRoute === "will" ? (
            <WillPage />
          ) : primitiveRoute === "verify" ? (
            <VerifyPage />
          ) : primitiveRoute === "thought" && thoughtTokenId ? (
            <ThoughtDetailPage tokenId={thoughtTokenId} />
          ) : (
            <EcosystemHome />
          )}
        </div>
      </ErrorBoundary>
      <PreviewWatermark />
      <FloatingReportBug />
    </>
  );
}

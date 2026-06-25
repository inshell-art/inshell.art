import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import Movements from "@/components/Movements";
import Footer from "@/components/Footer/Footer";
import PulsePage from "@/components/PulsePage";
import ColorFontPage from "@/components/ColorFontPage";
import PathPage from "@/components/PathPage";
import VerifyPage from "@/components/VerifyPage";
import ThoughtDetailPage from "@/components/ThoughtDetailPage";
import ThoughtGalleryPage from "@/components/ThoughtGalleryPage";
import FloatingReportBug from "@/components/FloatingReportBug";
import PreviewWatermark from "@/components/PreviewWatermark";
import { maybeResolveAddress } from "@inshell/contracts";
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
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/color-font") return "color-font";
  if (pathname === "/path" || parseTokenRouteId(pathname, "path")) return "path";
  if (pathname === "/gallery") return "gallery";
  if (pathname === "/verify") return "verify";
  if (parseTokenRouteId(pathname, "thought")) return "thought";
  return null;
}

function getPathRouteTokenId(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  return parseTokenRouteId(pathname, "path");
}

function getThoughtRouteTokenId(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  return parseTokenRouteId(pathname, "thought");
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
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const primitiveRoute = getPrimitiveRoute(locationKey);
  const pathTokenId = getPathRouteTokenId(locationKey);
  const thoughtTokenId = getThoughtRouteTokenId(locationKey);

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
      document.title = pathTokenId ? `$PATH #${pathTokenId}` : "$PATH";
      setFavicon("/path.svg");
      return;
    }
    if (primitiveRoute === "gallery") {
      document.title = "THOUGHT Gallery";
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
  }, [pathTokenId, primitiveRoute, thoughtTokenId]);

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
            <PathPage tokenId={pathTokenId} />
          ) : primitiveRoute === "gallery" ? (
            <ThoughtGalleryPage />
          ) : primitiveRoute === "verify" ? (
            <VerifyPage />
          ) : primitiveRoute === "thought" && thoughtTokenId ? (
            <ThoughtDetailPage tokenId={thoughtTokenId} />
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

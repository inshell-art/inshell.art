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
import { maybeResolveAddress } from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";

function getPrimitiveRoute() {
  if (typeof window === "undefined") return null;
  const pathname = window.location.pathname.replace(/\/+$/, "");
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/color-font") return "color-font";
  if (pathname === "/path") return "path";
  if (pathname === "/verify") return "verify";
  return null;
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
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const primitiveRoute = getPrimitiveRoute();

  useEffect(() => {
    if (primitiveRoute === "pulse") {
      document.title = `pulse — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/pulse.svg");
      return;
    }
    if (primitiveRoute === "color-font") {
      document.title = "Color Font";
      setFavicon("/color-font.svg");
      return;
    }
    if (primitiveRoute === "path") {
      document.title = "$PATH";
      setFavicon("/path.svg");
      return;
    }
    if (primitiveRoute === "verify") {
      document.title = `verify — ${SURFACE_TERMINOLOGY.pathDapp}`;
      setFavicon("/inshell.svg");
      return;
    }
    document.title = SURFACE_TERMINOLOGY.ecosystem;
    setFavicon("/inshell.svg");
  }, [primitiveRoute]);

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
            <PathPage />
          ) : primitiveRoute === "verify" ? (
            <VerifyPage />
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
      <FloatingReportBug />
    </>
  );
}

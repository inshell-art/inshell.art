import { useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import AuctionCanvas from "@/components/AuctionCanvas";
import EcosystemHome from "@/components/EcosystemHome";
import PulsePage from "@/components/PulsePage";
import ColorFontPage from "@/components/ColorFontPage";
import PathPage from "@/components/PathPage";
import DocsPage from "@/components/DocsPage";
import VerifyPage from "@/components/VerifyPage";
import ThoughtDetailPage from "@/components/ThoughtDetailPage";
import FloatingReportBug from "@/components/FloatingReportBug";
import PreviewWatermark from "@/components/PreviewWatermark";
import { DOCS_SOURCE } from "@/content/docs";
import { InshellTopBar, type InshellSurface } from "@inshell/inshell-shell";
import { getProtocolReleaseChainId, maybeResolveAddress } from "@inshell/contracts";
import docsRouteMetadataJson from "../../../packages/shared/generated/docs-route-metadata.json";

type DocsRouteMetadata = {
  description: string;
  title: string;
};

const DOCS_ROUTE_METADATA = docsRouteMetadataJson.topics as Record<
  string,
  DocsRouteMetadata
>;

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

function parseDocsRouteSlug(pathname: string) {
  const match = /^\/docs\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  return match?.[1] ?? null;
}

function docsTopicForLegacyAnchor(anchor: string) {
  for (const topic of DOCS_SOURCE.topics) {
    if (topic.id === anchor || topic.aliases?.includes(anchor)) {
      return { topic, sectionAnchor: null };
    }
    const section = topic.sections?.find((candidate) => candidate.id === anchor);
    if (section) return { topic, sectionAnchor: section.id };
  }
  return null;
}

function getPrimitiveRoute(locationKey: string) {
  const pathname = pathnameFromLocationKey(locationKey);
  if (pathname === "/path-app") return "path-app";
  const query = locationKey.split("?")[1]?.split("#")[0] ?? "";
  if (pathname === "/path" && !new URLSearchParams(query).has("fixture")) {
    return "path-app";
  }
  if (pathname === "/pulse") return "pulse";
  if (pathname === "/docs" || parseDocsRouteSlug(pathname)) return "docs";
  if (pathname === "/color-font") return "color-font";
  if (pathname === "/path" || parseTokenRouteId(pathname, "path")) return "path";
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
  if (route === "path-app" || route === "path" || route === "pulse") return "path";
  if (route === "thought") return "works";
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

function getDocsRouteSlug(locationKey: string) {
  return parseDocsRouteSlug(pathnameFromLocationKey(locationKey));
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

type RouteMetadata = {
  canonicalPath: string;
  description: string;
  title: string;
  alternates: Array<{ type: string; title: string; href: string }>;
};

function routeMetadata(pathname: string): RouteMetadata {
  const pathId = parseTokenRouteId(pathname, "path");
  const thoughtId = parseTokenRouteId(pathname, "thought");
  const docsSlug = parseDocsRouteSlug(pathname);
  const docsMetadata = docsSlug ? DOCS_ROUTE_METADATA[docsSlug] : undefined;
  const agentIndex = {
    type: "application/json",
    title: "Inshell Agent documentation index",
    href: "/docs/agent-index.json",
  };
  const agentContent = {
    type: "application/json",
    title: "Inshell structured documentation",
    href: "/docs/content.json",
  };

  if (pathname === "/docs") {
    return {
      canonicalPath: "/docs",
      title: "docs — Inshell",
      description:
        "Inshell documentation for the artist, works, contracts, provenance, and verification boundaries.",
      alternates: [
        {
          type: "text/markdown",
          title: "Inshell documentation",
          href: "/docs/index.md",
        },
        agentContent,
        agentIndex,
      ],
    };
  }

  if (docsSlug && docsMetadata) {
    return {
      canonicalPath: `/docs/${docsSlug}`,
      title: `${docsMetadata.title} — docs — Inshell`,
      description: docsMetadata.description,
      alternates: [
        {
          type: "text/markdown",
          title: `${docsMetadata.title} documentation`,
          href: `/docs/${docsSlug}.md`,
        },
        {
          type: "application/json",
          title: `${docsMetadata.title} structured documentation`,
          href: `/docs/${docsSlug}.json`,
        },
        agentIndex,
      ],
    };
  }

  if (docsSlug) {
    return {
      canonicalPath: "/docs",
      title: "docs — Inshell",
      description:
        "Inshell documentation for the artist, works, contracts, provenance, and verification boundaries.",
      alternates: [
        {
          type: "text/markdown",
          title: "Inshell documentation",
          href: "/docs/index.md",
        },
        agentContent,
        agentIndex,
      ],
    };
  }

  if (pathId) {
    return {
      canonicalPath: `/path/${pathId}`,
      title: `$PATH #${pathId}`,
      description: `$PATH #${pathId} artwork, mint capacity, issuance, and public chain record.`,
      alternates: [
        {
          type: "application/json",
          title: `$PATH #${pathId} public record`,
          href: `/api/path-record?id=${pathId}`,
        },
        agentIndex,
      ],
    };
  }

  if (thoughtId) {
    return {
      canonicalPath: `/thought/${thoughtId}`,
      title: `THOUGHT #${thoughtId}`,
      description: `THOUGHT #${thoughtId} canonical artwork, work, creation provenance, and verification record.`,
      alternates: [
        {
          type: "application/json",
          title: `THOUGHT #${thoughtId} public record`,
          href: `/api/thought-record?id=${thoughtId}`,
        },
        {
          type: "application/json",
          title: `THOUGHT #${thoughtId} provenance`,
          href: `/api/thought-provenance?id=${thoughtId}`,
        },
        agentIndex,
      ],
    };
  }

  const descriptions: Record<string, string> = {
    "/":
      "Inshell is an artist working with human intention, Agents, code, and public blockchains.",
    "/path":
      "$PATH is the Inshell permission token issued through Pulse and an evolving record of movement progress.",
    "/pulse":
      "Pulse is the decentralized automatic auction that issues public $PATH tokens.",
    "/thought":
      "THOUGHT is a narrow terminal channel between one human intention and one Agent response.",
    "/will":
      "WILL is Inshell's movement about delegated human will, Agent action, and crowd dynamics.",
    "/gallery": "Canonical THOUGHT gallery route; the current R2 collection is not deployed.",
    "/verify":
      "Official origins, contracts, releases, locks, and verification boundaries for Inshell.",
    "/color-font": "Inshell color and typography primitives.",
  };
  const titles: Record<string, string> = {
    "/": "Inshell",
    "/path": "$PATH",
    "/pulse": "Pulse",
    "/thought": "THOUGHT",
    "/will": "WILL",
    "/gallery": "THOUGHT gallery",
    "/verify": "verify — Inshell",
    "/color-font": "color-font — Inshell",
  };
  const canonicalPath = descriptions[pathname] ? pathname : "/";
  return {
    canonicalPath,
    title: titles[canonicalPath],
    description: descriptions[canonicalPath],
    alternates: [agentIndex],
  };
}

function ensureMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector);
  if (!(element instanceof globalThis.HTMLMetaElement)) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function applyRouteMetadata(pathname: string) {
  const metadata = routeMetadata(pathname);
  const canonicalHref = `https://inshell.art${metadata.canonicalPath}`;
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!(canonical instanceof globalThis.HTMLLinkElement)) {
    const created = document.createElement("link");
    created.rel = "canonical";
    document.head.appendChild(created);
    canonical = created;
  }
  canonical.setAttribute("href", canonicalHref);
  ensureMeta('meta[name="description"]', {
    name: "description",
    content: metadata.description,
  });
  ensureMeta('meta[property="og:description"]', {
    property: "og:description",
    content: metadata.description,
  });
  ensureMeta('meta[property="og:url"]', {
    property: "og:url",
    content: canonicalHref,
  });
  ensureMeta('meta[property="og:title"]', {
    property: "og:title",
    content: metadata.title,
  });
  ensureMeta('meta[name="twitter:title"]', {
    name: "twitter:title",
    content: metadata.title,
  });
  ensureMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: metadata.description,
  });

  document.head
    .querySelectorAll('[data-inshell-route-alternate="true"]')
    .forEach((element) => {
      element.remove();
    });
  for (const alternate of metadata.alternates) {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = alternate.type;
    link.title = alternate.title;
    link.href = alternate.href;
    link.dataset.inshellRouteAlternate = "true";
    document.head.appendChild(link);
  }
}

export default function App() {
  const [locationKey, setLocationKey] = useState(() => getLocationKey());
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const primitiveRoute = getPrimitiveRoute(locationKey);
  const pathAppHost = isPathAppHost();
  const pathTokenId = getPathRouteTokenId(locationKey);
  const thoughtTokenId = getThoughtRouteTokenId(locationKey);
  const docsTopicSlug = getDocsRouteSlug(locationKey);
  const shouldRenderPathApp =
    primitiveRoute === "path-app" ||
    primitiveRoute === "path" ||
    (pathAppHost && !primitiveRoute);
  const activeSurface = shouldRenderPathApp ? "path" : activeSurfaceForRoute(primitiveRoute);
  const pathExpectedChainId = shouldRenderPathApp
    ? getProtocolReleaseChainId()
    : undefined;

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
    if (pathname === "/path-app") {
      const [, suffix = ""] = locationKey.split("/path-app");
      const nextPath = `/path${suffix}`;
      window.history.replaceState({}, "", nextPath);
      setLocationKey(getLocationKey());
      return;
    }
  }, [locationKey]);

  useEffect(() => {
    const pathname = pathnameFromLocationKey(locationKey);
    if (pathname !== "/docs") return;
    const rawHash = window.location.hash.slice(1);
    if (!rawHash) return;
    let anchor: string;
    try {
      anchor = decodeURIComponent(rawHash);
    } catch {
      return;
    }
    const legacyTarget = docsTopicForLegacyAnchor(anchor);
    if (!legacyTarget) return;
    const nextPath = `/docs/${legacyTarget.topic.slug}${
      legacyTarget.sectionAnchor ? `#${legacyTarget.sectionAnchor}` : ""
    }`;
    window.history.replaceState({}, "", nextPath);
    setLocationKey(getLocationKey());
  }, [locationKey]);

  useEffect(() => {
    const pathname = pathnameFromLocationKey(locationKey);
    if (shouldRenderPathApp) {
      document.title = pathTokenId ? `$PATH #${pathTokenId}` : "$PATH";
    } else {
      document.title = routeMetadata(pathname).title;
    }
    setFavicon("/inshell.svg");
  }, [locationKey, pathTokenId, shouldRenderPathApp]);

  useEffect(() => {
    applyRouteMetadata(pathnameFromLocationKey(locationKey));
  }, [locationKey]);

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
              shouldRenderPathApp ? "Sepolia ETH" : undefined
            }
          />
          {shouldRenderPathApp ? (
            <div className="content content--path-app">
              <AuctionCanvas address={pulseAuction} />
              <PathPage tokenId={pathTokenId} />
            </div>
          ) : primitiveRoute === "pulse" ? (
            <PulsePage />
          ) : primitiveRoute === "docs" ? (
            <DocsPage topicSlug={docsTopicSlug} />
          ) : primitiveRoute === "color-font" ? (
            <ColorFontPage />
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

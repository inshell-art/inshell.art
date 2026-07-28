const PUBLIC_FEED_RSS_URL = "https://inshell-public-feed.pages.dev/rss.xml";
const PUBLIC_FEED_ALIAS_URL = "https://inshell-public-feed.pages.dev/feed.xml";
const PUBLIC_FEED_SEPOLIA_RSS_URL = "https://inshell-public-feed.pages.dev/rss.sepolia.xml";
const PUBLIC_FEED_BASE_URL = "https://d807d286.inshell-public-feed.pages.dev";
const PUB_UPSTREAM_DEFAULT = "https://inshell-pub.pages.dev";
const APP_SHELL_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

type PagesAssets = {
  fetch: (request: Request) => Promise<Response>;
};

type MiddlewareContext = {
  request: Request;
  env: {
    ASSETS?: PagesAssets;
    PUB_UPSTREAM?: string;
    PUB_BOUNDARY_CONTRACT_URL?: string;
  };
  next: (request?: Request) => Promise<Response>;
};
type UrlInstance = InstanceType<typeof globalThis.URL>;

export async function onRequest(ctx: MiddlewareContext): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  if (isPubRouteHost(url.hostname) && isPubReservedPathname(url.pathname)) {
    return proxyPubArtifact(ctx.request, url, ctx.env);
  }

  const pathname = normalizePathname(url.pathname);
  const galleryRedirect = canonicalGalleryHostRedirect(ctx.request, url, pathname);
  const sepoliaRedirect = temporarySepoliaHostRedirect(url);
  const thoughtRedirect = canonicalThoughtRedirect(ctx.request, url, pathname);
  const pathHostRedirect = canonicalPathHostRedirect(ctx.request, url, pathname);
  const pathAppRedirect = canonicalPathAppRedirect(ctx.request, url, pathname);
  const worksRedirect = canonicalWorksRedirect(ctx.request, url, pathname);

  if (galleryRedirect) {
    return galleryRedirect;
  }
  if (sepoliaRedirect) {
    return sepoliaRedirect;
  }
  if (thoughtRedirect) {
    return thoughtRedirect;
  }
  if (pathHostRedirect) {
    return pathHostRedirect;
  }
  if (pathAppRedirect) {
    return pathAppRedirect;
  }
  if (worksRedirect) {
    return worksRedirect;
  }

  if (pathname === "/rss.xml") {
    return proxyFeed(PUBLIC_FEED_RSS_URL, ctx.request);
  }
  if (pathname === "/feed.xml") {
    return proxyFeed(PUBLIC_FEED_ALIAS_URL, ctx.request);
  }
  if (pathname === "/rss.sepolia.xml") {
    return proxyFeed(PUBLIC_FEED_SEPOLIA_RSS_URL, ctx.request);
  }
  const publicFeedArtifactUrl = getPublicFeedArtifactUrl(ctx.request.url);
  if (publicFeedArtifactUrl) {
    return proxyPublicFeedArtifact(publicFeedArtifactUrl, ctx.request);
  }
  if (isThoughtAppShellRoute(pathname)) {
    return serveThoughtAppShell(ctx);
  }
  if (isAppShellRoute(pathname)) {
    return serveAppShell(ctx);
  }

  return ctx.next();
}

function isPubReservedPathname(pathname: string) {
  return (
    pathname === "/llms.txt" ||
    pathname === "/pub.manifest.json" ||
    pathname === "/pub/" ||
    pathname.startsWith("/pub/")
  );
}

function isPubRouteHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "inshell.art" ||
    host === "preview.inshell.art" ||
    host === "inshell-art.pages.dev" ||
    host.endsWith(".inshell-art.pages.dev")
  );
}

async function proxyPubArtifact(request: Request, requestUrl: UrlInstance, env: MiddlewareContext["env"]) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return pubMethodNotAllowed();
  }

  const upstreamUrl = getPubArtifactUrl(requestUrl, env);
  let upstream: Response;
  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8000);
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      signal: abortController.signal,
      headers: {
        accept: pubArtifactAcceptHeader(requestUrl.pathname),
      },
    });
  } catch {
    return pubArtifactUnavailable();
  } finally {
    clearTimeout(timeout);
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: pubArtifactHeaders(upstream, requestUrl.pathname),
  });
}

function getPubArtifactUrl(requestUrl: UrlInstance, env: MiddlewareContext["env"]) {
  const upstream = normalizePubUpstream(env.PUB_UPSTREAM);
  const url = new globalThis.URL(upstream);
  url.pathname = encodedPathnameForProxy(requestUrl.pathname);
  url.search = requestUrl.search;
  return url.toString();
}

function normalizePubUpstream(value: string | undefined) {
  const raw = value?.trim() || PUB_UPSTREAM_DEFAULT;
  try {
    const url = new globalThis.URL(raw);
    if (url.protocol !== "https:") return PUB_UPSTREAM_DEFAULT;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return PUB_UPSTREAM_DEFAULT;
  }
}

function pubArtifactAcceptHeader(pathname: string) {
  if (pathname === "/llms.txt") return "text/plain, */*;q=0.1";
  if (pathname === "/pub.manifest.json" || pathname === "/pub/contract/pub-path-boundary.json") {
    return "application/json, */*;q=0.1";
  }
  return "*/*";
}

function pubArtifactHeaders(upstream: Response, pathname: string) {
  const upstreamHeaders = new Headers(upstream.headers);
  const headers = new Headers();
  headers.set(
    "content-type",
    upstreamHeaders.get("content-type") ?? pubArtifactContentType(pathname),
  );
  headers.set("cache-control", upstreamHeaders.get("cache-control") ?? "public, max-age=60");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-inshell-dev-path-boundary", "pub-proxy");
  const etag = upstreamHeaders.get("etag");
  if (etag) headers.set("etag", etag);
  const lastModified = upstreamHeaders.get("last-modified");
  if (lastModified) headers.set("last-modified", lastModified);
  return headers;
}

function pubArtifactContentType(pathname: string) {
  if (pathname === "/llms.txt") return "text/plain; charset=utf-8";
  if (pathname === "/pub.manifest.json" || pathname.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  return "application/octet-stream";
}

function pubMethodNotAllowed() {
  return new Response("PUB artifacts are read-only.", {
    status: 405,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      allow: "GET, HEAD",
      "x-content-type-options": "nosniff",
      "x-inshell-dev-path-boundary": "pub-method-not-allowed",
    },
  });
}

function pubArtifactUnavailable() {
  return new Response("PUB artifact unavailable.", {
    status: 502,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-inshell-dev-path-boundary": "pub-upstream-unavailable",
    },
  });
}

function temporarySepoliaHostRedirect(url: UrlInstance) {
  if (url.hostname.toLowerCase() !== "sepolia.inshell.art") return null;

  const target = new globalThis.URL(url.pathname, "https://inshell.art");
  target.search = url.search;
  return Response.redirect(target.toString(), 302);
}

function canonicalGalleryHostRedirect(request: Request, url: UrlInstance, pathname: string) {
  const hostname = url.hostname.toLowerCase();
  if (!isCanonicalGalleryRedirectHost(hostname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (isApiPathname(pathname) || isLikelyStaticAssetPathname(url.pathname)) return null;

  const target = new globalThis.URL(
    canonicalGalleryPathname(pathname),
    hostname === "gallery.preview.inshell.art"
      ? "https://preview.inshell.art"
      : "https://inshell.art",
  );
  target.search = url.search;
  const thoughtId = parseTokenRouteId(pathname, "thought");
  target.hash = thoughtId ? `#thought-${thoughtId}` : url.hash;
  normalizeSameOriginReturnTo(target);
  return Response.redirect(target.toString(), 308);
}

function isCanonicalGalleryRedirectHost(hostname: string) {
  return hostname === "gallery.inshell.art" || hostname === "gallery.preview.inshell.art";
}

function isApiPathname(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isLikelyStaticAssetPathname(pathname: string) {
  return (
    pathname === "/assets" ||
    pathname.startsWith("/assets/") ||
    /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|json|txt|xml)$/i.test(pathname)
  );
}

function canonicalGalleryPathname(pathname: string) {
  if (pathname === "/" || pathname === "/gallery") return "/gallery";
  const thoughtId = parseTokenRouteId(pathname, "thought");
  if (thoughtId) return "/gallery";
  return pathname.startsWith("/gallery/") ? pathname : "/gallery";
}

function canonicalPathHostRedirect(request: Request, url: UrlInstance, pathname: string) {
  const hostname = url.hostname.toLowerCase();
  if (!isCanonicalPathRedirectHost(hostname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (isApiPathname(pathname) || isLikelyStaticAssetPathname(url.pathname)) return null;

  const target = new globalThis.URL(
    canonicalPathHostPathname(pathname),
    hostname === "path.preview.inshell.art" ? "https://preview.inshell.art" : "https://inshell.art",
  );
  target.search = url.search;
  target.hash = url.hash;
  normalizeSameOriginReturnTo(target);
  return Response.redirect(target.toString(), isPreviewHost(hostname) ? 302 : 308);
}

function isCanonicalPathRedirectHost(hostname: string) {
  return hostname === "path.inshell.art" || hostname === "path.preview.inshell.art";
}

function canonicalPathHostPathname(pathname: string) {
  if (pathname === "/" || pathname === "/path" || pathname === "/path-app") return "/path";
  if (pathname.startsWith("/path/")) return pathname;
  return `/path${pathname}`;
}

function canonicalPathAppRedirect(request: Request, url: UrlInstance, pathname: string) {
  if (pathname !== "/path-app") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const target = new globalThis.URL("/path", url.origin);
  target.search = url.search;
  target.hash = url.hash;
  normalizeSameOriginReturnTo(target);
  return Response.redirect(target.toString(), 308);
}

function canonicalWorksRedirect(request: Request, url: UrlInstance, pathname: string) {
  if (pathname !== "/works") return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const target = new globalThis.URL("/gallery", url.origin);
  target.search = url.search;
  target.hash = url.hash;
  normalizeSameOriginReturnTo(target);
  return Response.redirect(target.toString(), 308);
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function isAppShellRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/pulse" ||
    pathname === "/docs" ||
    pathname === "/color-font" ||
    pathname === "/verify" ||
    pathname === "/path-app" ||
    pathname === "/path" ||
    pathname === "/gallery" ||
    pathname === "/will" ||
    isTokenRoute(pathname, "path")
  );
}

function isThoughtAppShellRoute(pathname: string) {
  return (
    pathname === "/thought" ||
    pathname === "/thought/color-font" ||
    pathname === "/thought/verify" ||
    pathname === "/thought/agent-demo" ||
    pathname === "/thought/plugin" ||
    pathname === "/thought/plugin/codex" ||
    pathname === "/thought/plugin/claude" ||
    /^\/thought\/runs\/[A-Za-z0-9_-]+$/.test(pathname) ||
    isTokenRoute(pathname, "thought")
  );
}

function parseTokenRouteId(pathname: string, route: "path" | "thought") {
  const match = new RegExp(`^/${route}/([1-9]\\d{0,8})$`).exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? match[1] : null;
}

function isTokenRoute(pathname: string, route: "path" | "thought") {
  return parseTokenRouteId(pathname, route) !== null;
}

function canonicalThoughtRedirect(request: Request, url: UrlInstance, pathname: string) {
  const hostname = url.hostname.toLowerCase();
  if (!isThoughtHost(hostname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (isApiPathname(pathname) || isLikelyStaticAssetPathname(url.pathname)) return null;
  if (isGalleryIntent(hostname, pathname, url)) {
    const galleryTarget = new globalThis.URL(
      "/gallery",
      isPreviewHost(hostname) ? "https://preview.inshell.art" : "https://inshell.art",
    );
    galleryTarget.search = url.search;
    const thoughtHashId = /^#thought-([1-9]\d*)$/.exec(url.hash)?.[1];
    galleryTarget.hash = thoughtHashId ? `#thought-${thoughtHashId}` : url.hash;
    normalizeSameOriginReturnTo(galleryTarget);
    return Response.redirect(galleryTarget.toString(), isPreviewHost(hostname) ? 302 : 308);
  }

  const pathThoughtId = parseTokenRouteId(pathname, "thought");
  const queryThoughtId = url.searchParams.get("thought")?.trim() ?? "";
  const thoughtId =
    pathThoughtId ??
    (queryThoughtId && parseTokenRouteId(`/thought/${queryThoughtId}`, "thought")
      ? queryThoughtId
      : "");
  const target = new globalThis.URL(
    thoughtId ? `/thought/${thoughtId}` : canonicalThoughtHostPathname(pathname),
    isPreviewHost(hostname) ? "https://preview.inshell.art" : "https://inshell.art",
  );
  target.search = url.search;
  if (thoughtId && queryThoughtId === thoughtId) {
    target.searchParams.delete("thought");
  }
  target.hash = url.hash;
  normalizeSameOriginReturnTo(target);
  return Response.redirect(target.toString(), isPreviewHost(hostname) ? 302 : 308);
}

function canonicalThoughtHostPathname(pathname: string) {
  if (pathname === "/" || pathname === "/thought") return "/thought";
  if (pathname.startsWith("/thought/")) return pathname;
  return `/thought${pathname}`;
}

function normalizeSameOriginReturnTo(target: UrlInstance) {
  const raw = target.searchParams.get("returnTo");
  if (!raw) return;
  const normalized = normalizeSameOriginReturnToValue(raw, target.origin);
  if (normalized) {
    target.searchParams.set("returnTo", normalized);
  } else {
    target.searchParams.delete("returnTo");
  }
}

function normalizeSameOriginReturnToValue(raw: string, fallbackOrigin: string) {
  try {
    const url = new globalThis.URL(raw, fallbackOrigin);
    const hostname = url.hostname.toLowerCase();
    const isSameOrigin = url.origin === fallbackOrigin;
    const isLocalhost =
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isInshell = hostname === "inshell.art" || hostname === "preview.inshell.art";
    const isLegacyThought = hostname === "thought.inshell.art" || hostname === "thought.preview.inshell.art";
    const isLegacyPath = hostname === "path.inshell.art" || hostname === "path.preview.inshell.art";
    const isLegacyGallery = hostname === "gallery.inshell.art" || hostname === "gallery.preview.inshell.art";
    if (!isSameOrigin && !isLocalhost && !isInshell && !isLegacyThought && !isLegacyPath && !isLegacyGallery) {
      return "";
    }

    let pathname = normalizePathname(url.pathname);
    if (isLegacyThought && !pathname.startsWith("/thought")) {
      pathname = canonicalThoughtHostPathname(pathname);
    } else if (isLegacyPath && !pathname.startsWith("/path")) {
      pathname = canonicalPathHostPathname(pathname);
    } else if (isLegacyGallery) {
      pathname = canonicalGalleryPathname(pathname);
    }
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    if (raw.startsWith("/")) {
      const url = new globalThis.URL(raw, fallbackOrigin);
      const pathname = normalizePathname(url.pathname);
      return `${pathname}${url.search}${url.hash}`;
    }
    return "";
  }
}

function isThoughtHost(hostname: string) {
  return (
    hostname === "thought.inshell.art" ||
    hostname === "thought.preview.inshell.art" ||
    hostname === "thought-inshell-art.pages.dev" ||
    hostname.endsWith(".thought-inshell-art.pages.dev")
  );
}

function isPreviewHost(hostname: string) {
  return hostname === "thought.preview.inshell.art" || hostname.startsWith("staging.");
}

function isGalleryIntent(hostname: string, pathname: string, url: UrlInstance) {
  return (
    hostname === "gallery.inshell.art" ||
    hostname === "gallery.preview.inshell.art" ||
    pathname === "/gallery" ||
    url.searchParams.get("gallery") === "1" ||
    url.hash === "#gallery" ||
    /^#thought-[1-9]\d*$/.test(url.hash)
  );
}

function getPublicFeedArtifactUrl(requestUrl: string) {
  const url = new globalThis.URL(requestUrl);
  if (
    url.pathname === "/events.json" ||
    url.pathname === "/source" ||
    url.pathname.startsWith("/source/") ||
    url.pathname === "/source-assets" ||
    url.pathname.startsWith("/source-assets/")
  ) {
    return `${PUBLIC_FEED_BASE_URL}${encodedPathnameForProxy(url.pathname)}${url.search}`;
  }

  return null;
}

function encodedPathnameForProxy(pathname: string) {
  return (
    pathname
      .split("/")
      .map((segment) => encodePathSegment(segment))
      .join("/") || "/"
  );
}

function encodePathSegment(segment: string) {
  if (!segment) return "";
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

async function serveAppShell(ctx: MiddlewareContext): Promise<Response> {
  const indexUrl = new globalThis.URL(ctx.request.url);
  indexUrl.pathname = "/";
  indexUrl.search = "";
  const request = new Request(indexUrl.toString(), ctx.request);
  let response: Response;
  if (ctx.env.ASSETS) {
    response = await ctx.env.ASSETS.fetch(request);
  } else {
    response = await ctx.next(request);
  }
  return withAppShellHeaders(response);
}

async function serveThoughtAppShell(ctx: MiddlewareContext): Promise<Response> {
  const indexUrl = new globalThis.URL(ctx.request.url);
  indexUrl.pathname = "/thought/";
  indexUrl.search = "";
  const request = new Request(indexUrl.toString(), ctx.request);
  let response: Response;
  if (ctx.env.ASSETS) {
    response = await ctx.env.ASSETS.fetch(request);
  } else {
    response = await ctx.next(request);
  }
  return withAppShellHeaders(response);
}

function withAppShellHeaders(response: Response) {
  const headers = new Headers(response.headers);
  headers.delete("clear-site-data");
  headers.set("cache-control", APP_SHELL_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function proxyFeed(url: string, request: Request): Promise<Response> {
  let upstream: Response;
  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8000);
  try {
    upstream = await fetch(url, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      signal: abortController.signal,
      headers: {
        accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1",
      },
    });
  } catch {
    return new Response("RSS feed unavailable.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!upstream.ok) {
    return new Response("RSS feed unavailable.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

async function proxyPublicFeedArtifact(url: string, request: Request): Promise<Response> {
  let upstream: Response;
  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8000);
  try {
    upstream = await fetch(url, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      signal: abortController.signal,
      headers: {
        accept: artifactAcceptHeader(url),
      },
    });
  } catch {
    return publicFeedArtifactUnavailable(502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    return publicFeedArtifactUnavailable(upstream.status);
  }

  const upstreamHeaders = new Headers(upstream.headers);
  const contentType = upstreamHeaders.get("content-type") ?? artifactContentType(url);
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

function publicFeedArtifactUnavailable(status: number) {
  return new Response("Public feed artifact unavailable.", {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function artifactAcceptHeader(url: string) {
  const pathname = new globalThis.URL(url).pathname;
  if (pathname === "/events.json") return "application/json, */*;q=0.1";
  if (pathname === "/source-assets" || pathname.startsWith("/source-assets/")) return "*/*";
  return "text/html, application/xhtml+xml;q=0.9, */*;q=0.1";
}

function artifactContentType(url: string) {
  const pathname = new globalThis.URL(url).pathname;
  if (pathname === "/events.json") return "application/json; charset=utf-8";
  if (pathname === "/source" || pathname.startsWith("/source/")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

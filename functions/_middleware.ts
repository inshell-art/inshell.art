import docsRouteMetadataJson from "../packages/shared/generated/docs-route-metadata.json";

type DocsRouteMetadata = {
  description: string;
  title: string;
};

const DOCS_ROUTE_METADATA = docsRouteMetadataJson.topics as Record<
  string,
  DocsRouteMetadata
>;
const DOCS_ARTICLE_SLUGS = new Set(Object.keys(DOCS_ROUTE_METADATA));

const PUBLIC_FEED_RSS_URL = "https://inshell-public-feed.pages.dev/rss.xml";
const PUBLIC_FEED_ALIAS_URL = "https://inshell-public-feed.pages.dev/feed.xml";
const PUBLIC_FEED_SEPOLIA_RSS_URL = "https://inshell-public-feed.pages.dev/rss.sepolia.xml";
const PUBLIC_FEED_BASE_URL = "https://d807d286.inshell-public-feed.pages.dev";
const PUB_UPSTREAM_DEFAULT = "https://inshell-pub.pages.dev";
const APP_SHELL_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
const LEGACY_PROD_HOME_ORIGIN = "https://c02c54b0.inshell-art.pages.dev";
const LEGACY_PROD_FRONTEND_MARKER = "20260610-02b53bb";
const LEGACY_PROD_HOTFIX_BRANCH = "codex/prod-restore-20260610-fe";

type PagesAssets = {
  fetch: (request: Request) => Promise<Response>;
};

type MiddlewareContext = {
  request: Request;
  env: {
    ASSETS?: PagesAssets;
    CF_PAGES_BRANCH?: string;
    PUB_UPSTREAM?: string;
    PUB_BOUNDARY_CONTRACT_URL?: string;
  };
  next: (request?: Request) => Promise<Response>;
};
type UrlInstance = InstanceType<typeof globalThis.URL>;
type LegacyProdResourceKind =
  | "document"
  | "javascript"
  | "stylesheet"
  | "font";
type LegacyProdResource = {
  kind: LegacyProdResourceKind;
  injectPreviewWatermark?: boolean;
};

const LEGACY_PROD_ENTRY_ASSETS = new Map<string, LegacyProdResource>([
  ["/assets/index-6XkpjGyk.js", { kind: "javascript" }],
  ["/assets/index-CwenU7ox.css", { kind: "stylesheet" }],
  ["/assets/source-code-pro-vietnamese-600-normal-NO4inUC1.woff2", { kind: "font" }],
  ["/assets/source-code-pro-vietnamese-600-normal-RwzYAKw5.woff", { kind: "font" }],
  ["/assets/source-code-pro-latin-ext-600-normal-ChD8h2GM.woff2", { kind: "font" }],
  ["/assets/source-code-pro-latin-ext-600-normal-s-QVw45K.woff", { kind: "font" }],
  ["/assets/source-code-pro-latin-600-normal-D9kwMNJ_.woff2", { kind: "font" }],
  ["/assets/source-code-pro-latin-600-normal-DdCNScYx.woff", { kind: "font" }],
]);

export async function onRequest(ctx: MiddlewareContext): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  if (isPubRouteHost(url.hostname) && isPubReservedPathname(url.pathname)) {
    return proxyPubArtifact(ctx.request, url, ctx.env);
  }

  const pathname = normalizePathname(url.pathname);
  if (isImmutableProtocolReleasePathname(pathname)) {
    return serveImmutableProtocolRelease(ctx, pathname);
  }
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

  // Keep every current Function route ahead of the temporary frontend recovery proxy.
  if (isApiPathname(pathname)) {
    return ctx.next();
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
  const legacyProdResource = getLegacyProdResource(ctx.request, url, pathname, ctx.env);
  if (legacyProdResource) {
    return proxyLegacyProdFrontend(ctx.request, url, legacyProdResource);
  }
  if (isThoughtAppShellRoute(pathname)) {
    return serveThoughtAppShell(ctx);
  }
  if (isAppShellRoute(pathname)) {
    return serveAppShell(ctx);
  }

  return ctx.next();
}

function getLegacyProdResource(
  request: Request,
  url: UrlInstance,
  pathname: string,
  env: MiddlewareContext["env"],
): LegacyProdResource | null {
  if (!isLegacyProdRecoveryHost(url.hostname, env)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (isLegacyProdHomeDocumentPathname(pathname)) {
    return {
      kind: "document",
      injectPreviewWatermark: isLegacyProdHotfixBranchHost(url.hostname, env),
    };
  }

  return LEGACY_PROD_ENTRY_ASSETS.get(url.pathname) ?? null;
}

function isLegacyProdRecoveryHost(hostname: string, env: MiddlewareContext["env"]) {
  const host = hostname.toLowerCase();
  if (host === "inshell.art") return true;
  return isLegacyProdHotfixBranchHost(host, env);
}

function isLegacyProdHotfixBranchHost(hostname: string, env: MiddlewareContext["env"]) {
  const host = hostname.toLowerCase();
  return (
    env.CF_PAGES_BRANCH === LEGACY_PROD_HOTFIX_BRANCH &&
    (host === "inshell-art.pages.dev" || host.endsWith(".inshell-art.pages.dev"))
  );
}

function isLegacyProdHomeDocumentPathname(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/pulse" ||
    pathname === "/color-font" ||
    pathname === "/verify" ||
    pathname === "/path" ||
    isTokenRoute(pathname, "path")
  );
}

async function proxyLegacyProdFrontend(
  request: Request,
  requestUrl: UrlInstance,
  resource: LegacyProdResource,
): Promise<Response> {
  const upstreamUrl = new globalThis.URL(
    resource.kind === "document" ? "/" : encodedPathnameForProxy(requestUrl.pathname),
    LEGACY_PROD_HOME_ORIGIN,
  );
  const abortController = new globalThis.AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8000);
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: request.method,
      redirect: "manual",
      signal: abortController.signal,
      // Do not forward cookies, authorization, Access assertions, or request query data.
      headers: {
        accept: legacyProdAcceptHeader(resource.kind),
      },
    });
  } catch {
    return legacyProdFrontendUnavailable(502, "upstream-unavailable");
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    return legacyProdFrontendUnavailable(resource.kind === "document" ? 502 : 404, "upstream-error");
  }

  const contentType = new Headers(upstream.headers).get("content-type") ?? "";
  if (!isExpectedLegacyProdContentType(resource.kind, contentType)) {
    return legacyProdFrontendUnavailable(resource.kind === "document" ? 502 : 404, "mime-rejected");
  }

  let body: ConstructorParameters<typeof Response>[0] =
    request.method === "HEAD" ? null : upstream.body;
  if (request.method === "GET" && resource.injectPreviewWatermark) {
    try {
      body = injectLegacyProdPreviewWatermark(await upstream.text());
    } catch {
      return legacyProdFrontendUnavailable(502, "body-unavailable");
    }
  }

  return new Response(body, {
    status: 200,
    headers: legacyProdFrontendResponseHeaders(upstream, contentType, resource.kind),
  });
}

function injectLegacyProdPreviewWatermark(html: string) {
  const watermark = '<div class="inshell-preview-watermark" aria-hidden="true">preview</div>';
  if (html.includes(watermark)) return html;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${watermark}</body>`);
  return `${html}${watermark}`;
}

function legacyProdAcceptHeader(kind: LegacyProdResourceKind) {
  if (kind === "document") return "text/html, application/xhtml+xml;q=0.9, */*;q=0.1";
  if (kind === "javascript") return "application/javascript, text/javascript;q=0.9, */*;q=0.1";
  if (kind === "stylesheet") return "text/css, */*;q=0.1";
  return "font/woff2, font/woff, */*;q=0.1";
}

function isExpectedLegacyProdContentType(kind: LegacyProdResourceKind, contentType: string) {
  const normalized = contentType.toLowerCase();
  if (kind === "document") return normalized.startsWith("text/html");
  if (kind === "javascript") return normalized.includes("javascript");
  if (kind === "stylesheet") return normalized.startsWith("text/css");
  return normalized.startsWith("font/woff");
}

function legacyProdFrontendResponseHeaders(
  upstream: Response,
  contentType: string,
  kind: LegacyProdResourceKind,
) {
  const upstreamHeaders = new Headers(upstream.headers);
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", upstreamHeaders.get("cache-control") ?? "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("x-xss-protection", "1; mode=block");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains; preload");
  headers.set("x-inshell-frontend-recovery", LEGACY_PROD_FRONTEND_MARKER);
  headers.set("x-inshell-frontend-recovery-source", "home");
  if (kind !== "document") {
    const etag = upstreamHeaders.get("etag");
    if (etag) headers.set("etag", etag);
    const lastModified = upstreamHeaders.get("last-modified");
    if (lastModified) headers.set("last-modified", lastModified);
  }
  return headers;
}

function legacyProdFrontendUnavailable(status: number, reason: string) {
  return new Response(status === 404 ? "Frontend asset not found." : "Frontend unavailable.", {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-inshell-frontend-recovery": LEGACY_PROD_FRONTEND_MARKER,
      "x-inshell-frontend-recovery-status": reason,
    },
  });
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

function parseDocsArticleSlug(pathname: string) {
  const match = /^\/docs\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  return match?.[1] ?? null;
}

function isAppShellRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/pulse" ||
    pathname === "/docs" ||
    parseDocsArticleSlug(pathname) !== null ||
    pathname === "/color-font" ||
    pathname === "/verify" ||
    pathname === "/path-app" ||
    pathname === "/path" ||
    pathname === "/gallery" ||
    pathname === "/will" ||
    isTokenRoute(pathname, "path")
  );
}

function isImmutableProtocolReleasePathname(pathname: string) {
  return pathname === "/protocol/releases" || pathname.startsWith("/protocol/releases/");
}

async function serveImmutableProtocolRelease(
  ctx: MiddlewareContext,
  pathname: string,
): Promise<Response> {
  if (ctx.request.method !== "GET" && ctx.request.method !== "HEAD") {
    return new Response("Immutable protocol artifacts are read-only.", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }

  const response = ctx.env.ASSETS
    ? await ctx.env.ASSETS.fetch(ctx.request)
    : await ctx.next(ctx.request);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!response.ok || contentType.includes("text/html")) {
    return new Response("Immutable protocol artifact not found.", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-type", immutableProtocolContentType(pathname));
  headers.set("x-content-type-options", "nosniff");
  return new Response(ctx.request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function immutableProtocolContentType(pathname: string) {
  if (pathname.endsWith(".schema.json")) {
    return "application/schema+json; charset=utf-8";
  }
  if (pathname.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }
  if (pathname.endsWith(".md")) {
    return "text/markdown; charset=utf-8";
  }
  if (pathname.endsWith(".txt")) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
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
  return withAppShellHeaders(response, ctx.request);
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
  return withAppShellHeaders(response, ctx.request);
}

async function withAppShellHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.delete("clear-site-data");
  headers.set("cache-control", APP_SHELL_CACHE_CONTROL);
  const url = new globalThis.URL(request.url);
  headers.set("link", appShellDiscoveryLink(url.pathname));
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  if (request.method === "HEAD" || !contentType.includes("text/html")) {
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const metadata = appShellMetadata(url.pathname);
  const canonicalUrl = `https://inshell.art${metadata.canonicalPath}`;
  let html = await response.text();
  html = upsertHeadTag(
    html,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}" />`,
  );
  html = upsertHeadTag(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlText(metadata.title)}</title>`,
  );
  html = upsertMetaContent(html, "name", "description", metadata.description);
  html = upsertMetaContent(html, "property", "og:title", metadata.title);
  html = upsertMetaContent(html, "property", "og:description", metadata.description);
  html = upsertMetaContent(html, "property", "og:url", canonicalUrl);
  html = upsertMetaContent(html, "name", "twitter:title", metadata.title);
  html = upsertMetaContent(html, "name", "twitter:description", metadata.description);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.delete("last-modified");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function appShellCanonicalPath(rawPathname: string) {
  const pathname = normalizePathname(rawPathname);
  const docsArticleSlug = parseDocsArticleSlug(pathname);
  if (docsArticleSlug && !DOCS_ARTICLE_SLUGS.has(docsArticleSlug)) return "/docs";
  if (isAppShellRoute(pathname) || isThoughtAppShellRoute(pathname)) return pathname;
  return "/";
}

type AppShellMetadata = {
  canonicalPath: string;
  description: string;
  title: string;
};

function appShellMetadata(rawPathname: string): AppShellMetadata {
  const pathname = normalizePathname(rawPathname);
  const docsArticleSlug = parseDocsArticleSlug(pathname);
  if (pathname === "/docs" || docsArticleSlug) {
    const articleMetadata = docsArticleSlug
      ? DOCS_ROUTE_METADATA[docsArticleSlug]
      : undefined;
    return {
      canonicalPath: articleMetadata ? pathname : "/docs",
      title: articleMetadata
        ? `${articleMetadata.title} — docs — Inshell`
        : "docs — Inshell",
      description: articleMetadata
        ? articleMetadata.description
        : "Inshell documentation for the artist, works, contracts, provenance, and verification boundaries.",
    };
  }

  const pathId = parseTokenRouteId(pathname, "path");
  if (pathId) {
    return {
      canonicalPath: pathname,
      title: `$PATH #${pathId}`,
      description: `$PATH #${pathId} artwork, mint capacity, issuance, and public chain record.`,
    };
  }
  const thoughtId = parseTokenRouteId(pathname, "thought");
  if (thoughtId) {
    return {
      canonicalPath: pathname,
      title: `THOUGHT #${thoughtId}`,
      description: `THOUGHT #${thoughtId} canonical artwork, work, creation provenance, and verification record.`,
    };
  }
  if (pathname === "/thought" || pathname.startsWith("/thought/")) {
    return {
      canonicalPath: appShellCanonicalPath(pathname),
      title: "THOUGHT",
      description: "THOUGHT is a narrow terminal channel between one human intention and one Agent response.",
    };
  }

  const known = new Map<string, Omit<AppShellMetadata, "canonicalPath">>([
    ["/", {
      title: "Inshell",
      description: "Inshell is an artist working with human intention, Agents, code, and public blockchains.",
    }],
    ["/path", {
      title: "$PATH",
      description: "$PATH is the Inshell permission token issued through Pulse and an evolving record of movement progress.",
    }],
    ["/pulse", {
      title: "Pulse",
      description: "Pulse is the decentralized automatic auction that issues public $PATH tokens.",
    }],
    ["/thought", {
      title: "THOUGHT",
      description: "THOUGHT is a narrow terminal channel between one human intention and one Agent response.",
    }],
    ["/gallery", {
      title: "THOUGHT gallery",
      description: "Canonical THOUGHT gallery route; the current R2 collection is not deployed.",
    }],
    ["/will", {
      title: "WILL",
      description: "WILL is an Inshell Agent Art movement study: many people, many Agents, one will.",
    }],
    ["/verify", {
      title: "verify — Inshell",
      description: "Official origins, contracts, releases, locks, and verification boundaries for Inshell.",
    }],
    ["/color-font", {
      title: "color-font — Inshell",
      description: "Inshell color and typography primitives.",
    }],
  ]);
  const metadata = known.get(pathname) ?? known.get("/")!;
  return {
    canonicalPath: appShellCanonicalPath(pathname),
    ...metadata,
  };
}

function upsertMetaContent(
  html: string,
  attribute: "name" | "property",
  key: string,
  content: string,
) {
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${key}["'][^>]*>`, "i");
  return upsertHeadTag(
    html,
    pattern,
    `<meta ${attribute}="${key}" content="${escapeHtmlAttribute(content)}" />`,
  );
}

function upsertHeadTag(html: string, pattern: RegExp, tag: string) {
  if (pattern.test(html)) return html.replace(pattern, tag);
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`);
  return `${tag}\n${html}`;
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeHtmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function appShellDiscoveryLink(rawPathname: string) {
  const pathname = normalizePathname(rawPathname);
  const docsArticleSlug = parseDocsArticleSlug(pathname);
  const links = [
    '</docs/agent-index.json>; rel="alternate"; type="application/json"; title="Inshell Agent documentation index"',
  ];
  if (pathname === "/docs") {
    links.unshift(
      '</docs/index.md>; rel="alternate"; type="text/markdown"; title="Inshell documentation"',
      '</docs/content.json>; rel="alternate"; type="application/json"; title="Inshell structured documentation"',
    );
  } else if (docsArticleSlug && DOCS_ARTICLE_SLUGS.has(docsArticleSlug)) {
    links.unshift(
      `</docs/${docsArticleSlug}.md>; rel="alternate"; type="text/markdown"; title="Inshell documentation article"`,
      `</docs/${docsArticleSlug}.json>; rel="alternate"; type="application/json"; title="Inshell structured documentation article"`,
    );
  } else if (docsArticleSlug) {
    links.unshift(
      '</docs/content.json>; rel="alternate"; type="application/json"; title="Inshell structured documentation"',
    );
  }
  const pathId = parseTokenRouteId(pathname, "path");
  if (pathId) {
    links.unshift(
      `</api/path-record?id=${pathId}>; rel="alternate"; type="application/json"; title="$PATH #${pathId} public record"`,
    );
  }
  const thoughtId = parseTokenRouteId(pathname, "thought");
  if (thoughtId) {
    links.unshift(
      `</api/thought-record?id=${thoughtId}>; rel="alternate"; type="application/json"; title="THOUGHT #${thoughtId} public record"`,
      `</api/thought-provenance?id=${thoughtId}>; rel="alternate"; type="application/json"; title="THOUGHT #${thoughtId} provenance"`,
    );
  }
  return links.join(", ");
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

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

const APP_SHELL_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";
type PagesAssets = {
  fetch: (request: Request) => Promise<Response>;
};

type MiddlewareContext = {
  request: Request;
  env: {
    ASSETS?: PagesAssets;
    CF_PAGES_BRANCH?: string;
  };
  next: (request?: Request) => Promise<Response>;
};
type UrlInstance = InstanceType<typeof globalThis.URL>;
export async function onRequest(ctx: MiddlewareContext): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  if (isRetiredPublicPathname(url.pathname)) {
    return retiredPublicNotFound(ctx.request);
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

  // APIs stay on the current deployment, ahead of frontend app-shell routing.
  if (isApiPathname(pathname)) {
    return ctx.next();
  }

  if (isThoughtAppShellRoute(pathname)) {
    return serveThoughtAppShell(ctx);
  }
  if (isAppShellRoute(pathname)) {
    return serveAppShell(ctx);
  }

  return ctx.next();
}

function isRetiredPublicPathname(pathname: string) {
  // Decode path escapes only for retirement matching, not unrelated route handling.
  const decodedPathname = normalizePathname(pathname.replace(
    /%([0-9a-f]{2})/gi,
    (_, byte: string) => String.fromCharCode(Number.parseInt(byte, 16)),
  ));
  return (
    ["/llms.txt", "/pub.manifest.json", "/rss.xml", "/feed.xml", "/rss.sepolia.xml", "/events.json"]
      .includes(decodedPathname) ||
    ["/pub", "/source", "/source-assets"].some(
      (root) => decodedPathname === root || decodedPathname.startsWith(`${root}/`),
    )
  );
}

function retiredPublicNotFound(request: Request) {
  return new Response(request.method === "HEAD" ? null : "Not found.", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
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
      description: "THOUGHT works created from one human prompt and one Agent response.",
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

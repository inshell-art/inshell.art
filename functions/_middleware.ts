const PUBLIC_FEED_RSS_URL = "https://inshell-public-feed.pages.dev/rss.xml";
const PUBLIC_FEED_ALIAS_URL = "https://inshell-public-feed.pages.dev/feed.xml";
const TEMP_CLEAR_SITE_DATA_CACHE = "\"cache\"";

type PagesAssets = {
  fetch: (request: Request) => Promise<Response>;
};

type MiddlewareContext = {
  request: Request;
  env: {
    ASSETS?: PagesAssets;
  };
  next: (request?: Request) => Promise<Response>;
};
type UrlInstance = InstanceType<typeof globalThis.URL>;

export async function onRequest(ctx: MiddlewareContext): Promise<Response> {
  const url = new globalThis.URL(ctx.request.url);
  const pathname = normalizePathname(url.pathname);
  const thoughtRedirect = canonicalThoughtRedirect(url, pathname);

  if (thoughtRedirect) {
    return thoughtRedirect;
  }

  if (pathname === "/rss.xml") {
    return proxyFeed(PUBLIC_FEED_RSS_URL, ctx.request);
  }
  if (pathname === "/feed.xml") {
    return proxyFeed(PUBLIC_FEED_ALIAS_URL, ctx.request);
  }
  if (isAppShellRoute(pathname)) {
    return serveAppShell(ctx);
  }

  return ctx.next();
}

function normalizePathname(pathname: string) {
  if (pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

function isAppShellRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/pulse" ||
    pathname === "/color-font" ||
    pathname === "/verify" ||
    pathname === "/path" ||
    pathname === "/gallery" ||
    /^\/path\/[1-9]\d*$/.test(pathname) ||
    /^\/thought\/[1-9]\d*$/.test(pathname)
  );
}

function canonicalThoughtRedirect(url: UrlInstance, pathname: string) {
  const hostname = url.hostname.toLowerCase();
  if (!isThoughtHost(hostname)) return null;
  if (isGalleryIntent(hostname, pathname, url)) return null;

  const pathMatch = /^\/thought\/([1-9]\d*)$/.exec(pathname);
  const queryThoughtId = url.searchParams.get("thought")?.trim() ?? "";
  const thoughtId = pathMatch?.[1] ?? (/^[1-9]\d*$/.test(queryThoughtId) ? queryThoughtId : "");
  if (!thoughtId) return null;

  const target = new globalThis.URL(
    `/thought/${thoughtId}`,
    isPreviewHost(hostname) ? "https://preview.inshell.art" : "https://inshell.art",
  );
  return Response.redirect(target.toString(), 302);
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
  return withAppShellHeaders(response);
}

function withAppShellHeaders(response: Response) {
  const headers = new Headers(response.headers);
  // Temporary cleanup for cached 308 route redirects from the RSS hotfix window.
  headers.set("clear-site-data", TEMP_CLEAR_SITE_DATA_CACHE);
  headers.set("cache-control", "no-store, max-age=0");
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

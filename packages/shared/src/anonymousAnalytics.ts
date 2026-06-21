/* global Element, HTMLAnchorElement, RequestInfo, RequestInit, URL, performance */

export type AnonymousAnalyticsEventType =
  | "pageview"
  | "page_visible_duration"
  | "scroll_depth"
  | "cta_click"
  | "wallet_connect_started"
  | "wallet_connect_succeeded"
  | "wallet_connect_failed"
  | "mint_started"
  | "mint_succeeded"
  | "mint_failed"
  | "api_error"
  | "frontend_error"
  | "external_link_click";

export type AnonymousAnalyticsContentType =
  | "home"
  | "path"
  | "thought"
  | "gallery"
  | "pulse"
  | "verify"
  | "unknown";

export type AnonymousAnalyticsTrackInput = {
  eventType: AnonymousAnalyticsEventType;
  path?: string;
  contentType?: AnonymousAnalyticsContentType;
  contentId?: string | number | null;
  metadata?: Record<string, unknown>;
};

export type AnonymousAnalyticsOptions = {
  env?: Readonly<Record<string, unknown>>;
  endpoint?: string;
  hostname?: string | null;
  location?: Pick<globalThis.Location, "href" | "hostname" | "pathname" | "search" | "hash" | "origin"> | null;
  document?: globalThis.Document | null;
  window?: globalThis.Window | null;
  navigator?: globalThis.Navigator | null;
};

type AnalyticsWindow = globalThis.Window & {
  __INSHELL_ANON_ANALYTICS_INSTALLED__?: boolean;
  __INSHELL_ANON_ANALYTICS_FETCH_PATCHED__?: boolean;
  inshellAnalytics?: {
    track: (input: AnonymousAnalyticsTrackInput) => boolean;
  };
};

const VISITOR_STORAGE_KEY = "inshell.analytics.visitor.v1";
const SESSION_STORAGE_KEY = "inshell.analytics.session.v1";
const DEFAULT_ENDPOINT = "/api/analytics/event";
const DURATION_BUCKETS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000];

const ALLOWED_HOSTS = new Set([
  "inshell.art",
  "thought.inshell.art",
  "gallery.inshell.art",
  "preview.inshell.art",
  "thought.preview.inshell.art",
  "gallery.preview.inshell.art",
  "inshell-art.pages.dev",
  "thought-inshell-art.pages.dev",
  "staging.inshell-art.pages.dev",
  "staging.thought-inshell-art.pages.dev",
]);

export function installInshellAnonymousAnalytics(options: AnonymousAnalyticsOptions = {}): boolean {
  const windowRef = options.window ?? (typeof window === "undefined" ? null : window);
  const documentRef = options.document ?? (typeof document === "undefined" ? null : document);
  const navigatorRef = options.navigator ?? (typeof navigator === "undefined" ? null : navigator);
  const locationRef = options.location ?? windowRef?.location ?? null;
  if (!windowRef || !documentRef || !navigatorRef || !locationRef) return false;

  const analyticsWindow = windowRef as AnalyticsWindow;
  if (analyticsWindow.__INSHELL_ANON_ANALYTICS_INSTALLED__) return false;

  const hostname = normalizeHostname(options.hostname ?? locationRef.hostname);
  if (!isAnalyticsHostAllowed(hostname)) return false;
  if (isAnalyticsDisabled(options.env)) return false;

  const visitorId = readOrCreateWindowStorageId(windowRef, "localStorage", VISITOR_STORAGE_KEY);
  const sessionId = readOrCreateWindowStorageId(windowRef, "sessionStorage", SESSION_STORAGE_KEY);
  if (!visitorId || !sessionId) return false;

  analyticsWindow.__INSHELL_ANON_ANALYTICS_INSTALLED__ = true;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  let lastLocationKey = "";
  let pageVisibleSinceMs = nowMs();
  let emittedScrollBuckets = new Set<number>();

  const track = (input: AnonymousAnalyticsTrackInput) => {
    const path = normalizePath(input.path ?? locationRef.pathname);
    const content = contentForPath(path, input.contentType, input.contentId);
    sendAnalyticsEvent(endpoint, {
      version: 1,
      eventId: createId(),
      visitorId,
      sessionId,
      eventType: input.eventType,
      path,
      contentType: content.contentType,
      contentId: content.contentId,
      title: input.eventType === "pageview" ? documentRef.title : undefined,
      referrer: documentRef.referrer || "",
      occurredAt: new Date().toISOString(),
      deviceClass: deviceClassFor(windowRef, navigatorRef),
      viewportWidth: Math.max(1, Math.trunc(windowRef.innerWidth || 0)),
      viewportHeight: Math.max(1, Math.trunc(windowRef.innerHeight || 0)),
      timezoneOffset: new Date().getTimezoneOffset(),
      language: navigatorRef.language || "",
      automation: navigatorRef.webdriver === true,
      metadata: input.metadata ?? {},
    }, navigatorRef);
    return true;
  };

  analyticsWindow.inshellAnalytics = { track };

  const sendVisibleDuration = () => {
    const elapsedMs = nowMs() - pageVisibleSinceMs;
    if (elapsedMs < 1_000) return;
    track({
      eventType: "page_visible_duration",
      metadata: {
        durationMs: bucketDurationMs(elapsedMs),
      },
    });
    pageVisibleSinceMs = nowMs();
  };

  const sendCurrentPageView = () => {
    const locationKey = `${locationRef.pathname}${locationRef.search}${locationRef.hash}`;
    if (locationKey === lastLocationKey) return;
    if (lastLocationKey) sendVisibleDuration();
    lastLocationKey = locationKey;
    emittedScrollBuckets = new Set<number>();
    pageVisibleSinceMs = nowMs();
    track({ eventType: "pageview" });
    maybeSendScrollDepth(windowRef, documentRef, emittedScrollBuckets, track);
  };

  patchHistory(windowRef, sendCurrentPageView);
  patchFetch(windowRef, endpoint, track);
  windowRef.addEventListener("popstate", sendCurrentPageView);
  windowRef.addEventListener("hashchange", sendCurrentPageView);
  windowRef.addEventListener("scroll", () => {
    maybeSendScrollDepth(windowRef, documentRef, emittedScrollBuckets, track);
  }, { passive: true });
  documentRef.addEventListener("click", (event) => {
    trackClickEvent(event, windowRef, track);
  }, { capture: true });
  windowRef.addEventListener("error", () => {
    track({
      eventType: "frontend_error",
      metadata: { errorCategory: "runtime" },
    });
  });
  windowRef.addEventListener("unhandledrejection", () => {
    track({
      eventType: "frontend_error",
      metadata: { errorCategory: "promise" },
    });
  });
  documentRef.addEventListener("visibilitychange", () => {
    if (documentRef.visibilityState === "hidden") sendVisibleDuration();
    if (documentRef.visibilityState === "visible") pageVisibleSinceMs = nowMs();
  });
  windowRef.addEventListener("pagehide", sendVisibleDuration);
  sendCurrentPageView();
  return true;
}

export function trackInshellAnonymousAnalytics(input: AnonymousAnalyticsTrackInput): boolean {
  const api = typeof window === "undefined" ? null : (window as AnalyticsWindow).inshellAnalytics;
  return api?.track(input) ?? false;
}

function sendAnalyticsEvent(
  endpoint: string,
  payload: Record<string, unknown>,
  navigatorRef: globalThis.Navigator,
) {
  const body = JSON.stringify(payload);
  if (typeof navigatorRef.sendBeacon === "function") {
    try {
      if (navigatorRef.sendBeacon(endpoint, new globalThis.Blob([body], { type: "application/json" }))) {
        return;
      }
    } catch {
      // Fall through to fetch.
    }
  }
  void fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function patchHistory(windowRef: globalThis.Window, callback: () => void) {
  const history = windowRef.history;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function patchedHistoryMethod(
      this: globalThis.History,
      ...args: Parameters<globalThis.History[typeof method]>
    ) {
      const result = original.apply(this, args);
      windowRef.setTimeout(callback, 0);
      return result;
    };
  }
}

function patchFetch(
  windowRef: globalThis.Window,
  analyticsEndpoint: string,
  track: (input: AnonymousAnalyticsTrackInput) => boolean,
) {
  const analyticsWindow = windowRef as AnalyticsWindow;
  if (analyticsWindow.__INSHELL_ANON_ANALYTICS_FETCH_PATCHED__) return;
  if (typeof windowRef.fetch !== "function") return;
  analyticsWindow.__INSHELL_ANON_ANALYTICS_FETCH_PATCHED__ = true;
  const originalFetch = windowRef.fetch.bind(windowRef);
  windowRef.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpointPath = requestPath(input, windowRef.location.origin);
    try {
      const response = await originalFetch(input, init);
      if (endpointPath && isTrackedApiPath(endpointPath, analyticsEndpoint) && !response.ok) {
        track({
          eventType: "api_error",
          path: endpointPath,
          metadata: {
            endpoint: endpointPath,
            status: response.status,
            errorCategory: "http",
          },
        });
      }
      return response;
    } catch (error) {
      if (endpointPath && isTrackedApiPath(endpointPath, analyticsEndpoint)) {
        track({
          eventType: "api_error",
          path: endpointPath,
          metadata: {
            endpoint: endpointPath,
            errorCategory: categorizeError(error),
          },
        });
      }
      throw error;
    }
  }) as typeof fetch;
}

function trackClickEvent(
  event: globalThis.Event,
  windowRef: globalThis.Window,
  track: (input: AnonymousAnalyticsTrackInput) => boolean,
) {
  const target = event.target instanceof Element ? event.target : null;
  const clickable = target?.closest("a,button,[role='button'],[data-analytics-cta],[data-inshell-analytics]");
  if (!clickable) return;
  const ctaId = ctaIdForElement(clickable);
  if (ctaId) {
    track({
      eventType: "cta_click",
      metadata: { ctaId },
    });
  }
  if (clickable instanceof HTMLAnchorElement && clickable.href) {
    const link = safeUrl(clickable.href, windowRef.location.href);
    if (link && link.hostname.toLowerCase() !== windowRef.location.hostname.toLowerCase()) {
      track({
        eventType: "external_link_click",
        metadata: {
          hrefHost: link.hostname.toLowerCase(),
          hrefPath: normalizePath(link.pathname),
          ctaId: ctaId || undefined,
        },
      });
    }
  }
}

function ctaIdForElement(element: Element) {
  const dataId =
    element.getAttribute("data-analytics-cta") ||
    element.getAttribute("data-inshell-analytics") ||
    element.getAttribute("data-analytics-id");
  const id = dataId || element.id;
  if (id) return sanitizeToken(id, 80);
  if (element instanceof HTMLAnchorElement) {
    const href = safeUrl(element.href, typeof window === "undefined" ? "https://inshell.art" : window.location.href);
    if (href) return sanitizeToken(`link:${normalizePath(href.pathname)}`, 80);
  }
  return "";
}

function maybeSendScrollDepth(
  windowRef: globalThis.Window,
  documentRef: globalThis.Document,
  emittedBuckets: Set<number>,
  track: (input: AnonymousAnalyticsTrackInput) => boolean,
) {
  const root = documentRef.documentElement;
  const body = documentRef.body;
  const scrollTop = Math.max(0, windowRef.scrollY || root.scrollTop || body?.scrollTop || 0);
  const viewportHeight = Math.max(1, windowRef.innerHeight || root.clientHeight || 1);
  const scrollHeight = Math.max(
    root.scrollHeight || 0,
    body?.scrollHeight || 0,
    viewportHeight,
  );
  const scrollable = Math.max(1, scrollHeight - viewportHeight);
  const percent = Math.min(100, Math.max(0, Math.round(((scrollTop + viewportHeight) / scrollHeight) * 100)));
  if (scrollable <= 1) return;
  for (const bucket of [25, 50, 75, 100]) {
    if (percent >= bucket && !emittedBuckets.has(bucket)) {
      emittedBuckets.add(bucket);
      track({
        eventType: "scroll_depth",
        metadata: { scrollPercent: bucket },
      });
    }
  }
}

function readOrCreateWindowStorageId(
  windowRef: globalThis.Window,
  storageName: "localStorage" | "sessionStorage",
  key: string,
) {
  try {
    const storage = windowRef[storageName];
    const existing = storage.getItem(key);
    if (existing && /^[A-Za-z0-9_-]{8,96}$/.test(existing)) return existing;
    const created = createId();
    storage.setItem(key, created);
    return created;
  } catch {
    return "";
  }
}

function createId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestPath(input: RequestInfo | URL, origin: string) {
  const raw = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const parsed = safeUrl(raw, origin);
  return parsed ? normalizePath(parsed.pathname) : "";
}

function isTrackedApiPath(path: string, analyticsEndpoint: string) {
  const analyticsPath = normalizePath(analyticsEndpoint);
  return path.startsWith("/api/") && path !== analyticsPath;
}

function safeUrl(value: string, base: string) {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function contentForPath(
  path: string,
  providedType?: AnonymousAnalyticsContentType,
  providedId?: string | number | null,
) {
  const contentType = providedType ?? contentTypeForPath(path);
  const contentId = providedId == null ? contentIdForPath(path, contentType) : sanitizeToken(String(providedId), 64);
  return { contentType, contentId };
}

function contentTypeForPath(path: string): AnonymousAnalyticsContentType {
  if (path === "/" || path === "/home") return "home";
  if (path === "/verify" || path.startsWith("/verify/")) return "verify";
  if (path === "/gallery" || path.startsWith("/gallery/")) return "gallery";
  if (path === "/thought" || path.startsWith("/thought/")) return "thought";
  if (path === "/pulse" || path.startsWith("/pulse/")) return "pulse";
  if (path === "/path" || path.startsWith("/path/")) return "path";
  return "unknown";
}

function contentIdForPath(path: string, contentType: AnonymousAnalyticsContentType) {
  if (contentType !== "path" && contentType !== "thought" && contentType !== "gallery") return null;
  const match = path.match(/\/(?:path|thought|gallery)\/([A-Za-z0-9_-]{1,64})(?:\/|$)/i);
  return match ? sanitizeToken(match[1], 64) : null;
}

function normalizePath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "/";
  if (!raw) return "/";
  try {
    const parsed = new URL(raw, "https://inshell.art");
    return parsed.pathname.replace(/\/{2,}/g, "/").slice(0, 256) || "/";
  } catch {
    return "/";
  }
}

function bucketDurationMs(value: number) {
  const duration = Math.max(0, Math.min(600_000, Math.trunc(value)));
  return DURATION_BUCKETS_MS.find((bucket) => duration <= bucket) ?? 600_000;
}

function categorizeError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("network") || message.includes("fetch")) return "network";
  if (message.includes("rpc")) return "rpc";
  return "unknown";
}

function sanitizeToken(value: string, maxLength: number) {
  return value.trim().replace(/[^A-Za-z0-9_.:/#-]+/g, "_").slice(0, maxLength);
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function normalizeHostname(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\.$/, "") ?? "";
}

function isAnalyticsHostAllowed(hostname: string) {
  return (
    ALLOWED_HOSTS.has(hostname) ||
    hostname.endsWith(".inshell-art.pages.dev") ||
    hostname.endsWith(".thought-inshell-art.pages.dev")
  );
}

function isAnalyticsDisabled(env?: Readonly<Record<string, unknown>>) {
  const value = env?.VITE_INSHELL_ANON_ANALYTICS ?? env?.INSHELL_ANON_ANALYTICS;
  return typeof value === "string" && /^(0|false|off)$/i.test(value.trim());
}

function deviceClassFor(windowRef: globalThis.Window, navigatorRef: globalThis.Navigator) {
  const width = Math.max(0, Number(windowRef.innerWidth) || 0);
  const touch = Number(navigatorRef.maxTouchPoints ?? 0) > 0;
  if (width > 0 && width < 700) return "mobile";
  if (touch && width <= 1100) return "tablet";
  return "desktop";
}

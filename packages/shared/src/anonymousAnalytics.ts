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
};

const VISITOR_STORAGE_KEY = "inshell.analytics.visitor.v1";
const SESSION_STORAGE_KEY = "inshell.analytics.session.v1";
const DEFAULT_ENDPOINT = "/api/analytics/event";

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

  const sendCurrentPageView = () => {
    const locationKey = `${locationRef.pathname}${locationRef.search}${locationRef.hash}`;
    if (locationKey === lastLocationKey) return;
    lastLocationKey = locationKey;
    sendAnalyticsEvent(endpoint, {
      version: 1,
      eventId: createId(),
      visitorId,
      sessionId,
      eventType: "pageview",
      path: locationRef.pathname,
      title: documentRef.title,
      referrer: documentRef.referrer || "",
      occurredAt: new Date().toISOString(),
      deviceClass: deviceClassFor(windowRef, navigatorRef),
      viewportWidth: Math.max(1, Math.trunc(windowRef.innerWidth || 0)),
      viewportHeight: Math.max(1, Math.trunc(windowRef.innerHeight || 0)),
      timezoneOffset: new Date().getTimezoneOffset(),
      language: navigatorRef.language || "",
      automation: navigatorRef.webdriver === true,
    }, navigatorRef);
  };

  patchHistory(windowRef, sendCurrentPageView);
  windowRef.addEventListener("popstate", sendCurrentPageView);
  windowRef.addEventListener("hashchange", sendCurrentPageView);
  sendCurrentPageView();
  return true;
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

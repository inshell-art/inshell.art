import { GA4_COOKIE_PREFIX, GA4_EXCLUSION_KEY, GA4_LIFETIME_MS, GA4_POLICY_VERSION, GA4_PREFERENCE_KEY,
  ga4Context, ga4EnvironmentAllowed, ga4Referrer, ga4Screen, readGa4Preference } from "./ga4-policy";

type Env = Record<string, unknown>;
type GaWindow = globalThis.Window & typeof globalThis & { inshellGa4Layer?: unknown[]; __inshellGa4?: Ga4Controller };
export type Ga4Controller = {
  choose: (choice: "allow" | "reject") => void;
  exclude: (excluded: boolean) => void;
  refresh: () => void;
  status: () => { choice: string; excluded: boolean; available: boolean; blocked: boolean; storageOk: boolean };
  subscribe: (listener: () => void) => void;
};

export function installGa4(env: Env, win: GaWindow = window as GaWindow): Ga4Controller {
  if (win.__inshellGa4) return win.__inshellGa4;
  const doc = win.document;
  const id = typeof env.VITE_GA4_MEASUREMENT_ID === "string" ? env.VITE_GA4_MEASUREMENT_ID : "";
  const disable = `ga-disable-${id}`;
  const flags = win as unknown as Record<string, unknown>;
  const referrer = ga4Referrer(doc.referrer);
  const listeners = new Set<() => void>();
  let started = false, blocked = false, storageOk = true, writeFailed = false, lastPath = "", lastRoute = "";
  let expiryTimer = 0;
  let script: globalThis.HTMLScriptElement | undefined;
  const available = ga4EnvironmentAllowed(env, new URL(win.location.href), win.navigator.webdriver);
  flags[disable] = true;
  let channel: globalThis.BroadcastChannel | undefined;
  try { channel = new win.BroadcastChannel("inshell.ga4.choice.v1"); } catch { /* Storage events also synchronize tabs. */ }

  function state() {
    try {
      // An old allow is not usable if this browser can no longer persist withdrawal.
      // Probe a separate temporary key BEFORE reading consent. Never write a
      // captured choice back: another tab may have rejected it since that read.
      const probe = "inshell.ga4.storage-probe.v1";
      win.localStorage.setItem(probe, "1");
      win.localStorage.removeItem(probe);
      const preference = readGa4Preference(win.localStorage.getItem(GA4_PREFERENCE_KEY));
      const exclusion = win.localStorage.getItem(GA4_EXCLUSION_KEY);
      storageOk = !writeFailed;
      if (!storageOk) return { preference: null, excluded: true };
      return { preference, excluded: exclusion !== null && exclusion !== "0" };
    } catch { storageOk = false; stop(); return { preference: null, excluded: true }; }
  }
  function clearCookies() {
    // Only this pilot's host-only, path=/ cookies. Never enumerate other storage.
    try {
      for (const cookie of doc.cookie.split(";")) {
        const name = cookie.trim().split("=")[0];
        if (name === `${GA4_COOKIE_PREFIX}_ga` || name.startsWith(`${GA4_COOKIE_PREFIX}_ga_`)) {
          doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
        }
      }
    } catch { /* No storage availability is assumed. */ }
  }
  function stop(clear = true) {
    flags[disable] = true; // Native disable comes first, not a denied-consent ping.
    if (started) blocked = true; // Never revive an already-loaded SDK in this document.
    win.clearTimeout(expiryTimer);
    if (win.inshellGa4Layer) win.inshellGa4Layer.length = 0;
    script?.remove();
    if (clear) clearCookies();
    lastPath = ""; lastRoute = "";
  }
  function command(..._args: unknown[]) {
    // gtag's documented queue format is an Arguments object, not an event object.
    win.inshellGa4Layer!.push(arguments);
  }
  function refresh() {
    const { preference, excluded } = state();
    const url = new URL(win.location.href);
    const screen = ga4Screen(url);
    if (!available || blocked || excluded || preference?.choice !== "allow" || !screen) {
      stop(); listeners.forEach(listener => listener()); return;
    }
    win.clearTimeout(expiryTimer);
    // Recheck expiry without keeping a long-lived page consented indefinitely.
    expiryTimer = win.setTimeout(refresh, Math.min(preference.expiresAt - Date.now(), 2_147_483_647));
    const context = ga4Context(screen, lastPath ? `https://inshell.art${lastPath}` : referrer);
    if (!started) {
      started = true;
      flags[disable] = false;
      win.inshellGa4Layer = [];
      command("consent", "default", { analytics_storage: "granted", ad_storage: "denied",
        ad_user_data: "denied", ad_personalization: "denied" });
      command("set", { ...context, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, ads_data_redaction: true, url_passthrough: false });
      command("js", new Date());
      command("config", id, { ...context, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: "none", cookie_path: "/",
        cookie_prefix: GA4_COOKIE_PREFIX, cookie_expires: GA4_LIFETIME_MS / 1000,
        cookie_update: false, cookie_flags: "SameSite=Lax;Secure" });
      script = doc.createElement("script");
      script.async = true;
      script.referrerPolicy = "no-referrer";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${id}&l=inshellGa4Layer`;
      script.onerror = () => { stop(); listeners.forEach(listener => listener()); };
      doc.head.append(script);
    }
    const route = url.pathname.replace(/\/+$/, "") || "/";
    if (route !== lastRoute) {
      // Config update preserves native session/engagement bookkeeping. Never
      // emit synthetic user_engagement or replay time before permission.
      command("config", id, { ...context, update: true, send_page_view: false });
      command("set", context);
      command("event", "page_view", { ...context, send_to: id });
      lastPath = screen.path;
      lastRoute = route;
    }
    listeners.forEach(listener => listener());
  }
  function persist(key: string, value: string) {
    try {
      win.localStorage.setItem(key, value);
      if (win.localStorage.getItem(key) !== value) throw new Error("Preference unavailable");
      return true;
    } catch { storageOk = false; writeFailed = true; blocked = true; stop(); channel?.postMessage("stop"); return false; }
  }
  const controller: Ga4Controller = {
    choose(choice) {
      if (choice === "reject") { stop(); channel?.postMessage("stop"); }
      persist(GA4_PREFERENCE_KEY, JSON.stringify({ choice, version: GA4_POLICY_VERSION, expiresAt: Date.now() + GA4_LIFETIME_MS }));
      refresh();
    },
    exclude(excluded) {
      if (excluded) { stop(); channel?.postMessage("stop"); }
      persist(GA4_EXCLUSION_KEY, excluded ? "1" : "0"); refresh();
    },
    refresh,
    status: () => { const { preference, excluded } = state(); return { choice: preference?.choice ?? "unknown", excluded, available, blocked, storageOk }; },
    subscribe: listener => { listeners.add(listener); },
  };
  win.__inshellGa4 = controller;
  channel?.addEventListener("message", event => {
    // Messages can only revoke, never grant permission.
    if (event.data === "stop") { blocked = true; stop(); listeners.forEach(listener => listener()); }
  });
  win.addEventListener("storage", event => {
    if (event.key === null || [GA4_PREFERENCE_KEY, GA4_EXCLUSION_KEY].includes(event.key)) refresh();
  });
  for (const name of ["pushState", "replaceState"] as const) {
    const original = win.history[name].bind(win.history);
    win.history[name] = (data, unused, url) => {
      if (url != null && !ga4Screen(new URL(String(url), win.location.href))) stop();
      original(data, unused, url); refresh();
    };
  }
  win.addEventListener("popstate", refresh, true);
  win.addEventListener("hashchange", refresh, true);
  win.addEventListener("pageshow", refresh, true);
  win.addEventListener("focus", refresh, true);
  doc.addEventListener("visibilitychange", refresh, true);
  refresh();
  return controller;
}

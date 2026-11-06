// Keep the existing explicit exclusion. GA4 consent is not CF permission.
export const ANALYTICS_EXCLUSION_KEY = "inshell.ga4.excluded.v1";
export const ANALYTICS_ORIGIN = "https://inshell.art";
export const MEASUREMENT_REGION_META = "inshell-measurement-region";

export function documentMeasurementRegion(document: Pick<globalThis.Document, "querySelectorAll">): boolean {
  const markers = document.querySelectorAll(`meta[name="${MEASUREMENT_REGION_META}"]`);
  // Absence, malformed/duplicate markers and static previews fail closed.
  return markers.length === 1 && markers[0].getAttribute("content") === "eligible";
}
// site_tag identifies reports; site_token configures a native beacon. Neither
// is the private account API credential. No real values are embedded here.
export function measurementConfiguration(env: Readonly<Record<string, unknown>>) {
  return {
    reportingSiteTag: env.VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG,
    beaconToken: env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
  };
}

export const HOME_MEASUREMENT_POLICY = "home-document-v1";
export const NATIVE_BEACON_URL = "https://static.cloudflareinsights.com/beacon.min.js";

export function publicMeasurementUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Test raw delimiters too: URL.search/hash omit an empty '?' or '#'.
    if (url.origin !== ANALYTICS_ORIGIN || url.username || url.password || /[?#%\\]/.test(raw)) return false;
    // Reject URL normalization of ambiguous paths, not just the normalized URL.
    if (raw !== `${ANALYTICS_ORIGIN}${url.pathname}`) return false;
    return url.pathname === "/";
  } catch { return false; }
}

export function publicMeasurementReferrer(raw: string): boolean {
  // Empty direct entry or an exact curated same-origin URL only. External
  // origins remain unqualified; do not pretend rewriting a label sanitizes CF.
  return raw === "" || publicMeasurementUrl(raw);
}

export function browserExclusion(storage: Pick<globalThis.Storage, "getItem">): { readable: boolean; excluded: boolean } {
  try {
    const value = storage.getItem(ANALYTICS_EXCLUSION_KEY);
    return { readable: true, excluded: value !== null && value !== "0" };
  } catch { return { readable: false, excluded: true }; }
}

export function setBrowserExclusion(storage: Pick<globalThis.Storage, "setItem" | "getItem">, excluded: boolean): boolean {
  try {
    const value = excluded ? "1" : "0";
    storage.setItem(ANALYTICS_EXCLUSION_KEY, value);
    return storage.getItem(ANALYTICS_EXCLUSION_KEY) === value;
  }
  catch { return false; }
}

export type MeasurementContext = {
  env: Readonly<Record<string, unknown>>;
  href: string;
  referrer: string;
  automation: boolean;
  storage: Pick<globalThis.Storage, "getItem">;
  regionEligible?: boolean;
};

export function measurementBlockReason(context: MeasurementContext): string | null {
  const { env, href, referrer, automation, storage } = context;
  const configuration = measurementConfiguration(env);
  if (env.PROD !== true || env.DEV === true || env.MODE === "test" ||
      env.VITE_DEPLOY_ENV !== "production" || env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED !== "true" ||
      typeof configuration.reportingSiteTag !== "string" || !/^[a-f0-9]{32}$/.test(configuration.reportingSiteTag) ||
      typeof configuration.beaconToken !== "string" || !/^[a-f0-9]{32}$/.test(configuration.beaconToken)) return "configuration";
  if (automation || (env.CI !== undefined && env.CI !== false && env.CI !== "false") || env.VITE_AUTOMATION === "true") return "automation";
  const exclusion = browserExclusion(storage);
  if (!exclusion.readable) return "storage-unavailable";
  if (exclusion.excluded) return "browser-excluded";
  if (!publicMeasurementUrl(href)) return "unsafe-url";
  if (!publicMeasurementReferrer(referrer)) return "unqualified-referrer";
  if (context.regionEligible !== true) return "region-unqualified";
  // Separate operational attestation: setting ENABLED or a token alone is not
  // approval. OPS must qualify the exact pairing/manual mode/lifecycle before
  // configuring this versioned policy. Neither value defaults to on.
  if (env.VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY !== HOME_MEASUREMENT_POLICY) return "qualification-pending";
  return null;
}

type MeasurementController = { loaded: boolean; locked: boolean; withdraw: () => void };
type MeasurementWindow = globalThis.Window & { __INSHELL_HOME_MEASUREMENT__?: MeasurementController };

export function measurementLoaded(): boolean {
  return typeof window !== "undefined" && (window as MeasurementWindow).__INSHELL_HOME_MEASUREMENT__?.loaded === true;
}

export function withdrawMeasurement(): void {
  if (typeof window !== "undefined") (window as MeasurementWindow).__INSHELL_HOME_MEASUREMENT__?.withdraw();
}

export function knownMeasurementAutomation(navigator: Pick<globalThis.Navigator, "webdriver" | "userAgent">): boolean {
  return navigator.webdriver === true || /HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium|bot\b|crawler|spider|GPTBot|ChatGPT|ClaudeBot|Claude-User/i.test(navigator.userAgent);
}

export function installQualifiedMeasurement(env: Readonly<Record<string, unknown>>): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const host = window as MeasurementWindow;
  // Never reinstall or re-enable in the same document, including bfcache.
  if (host.__INSHELL_HOME_MEASUREMENT__) return false;
  try {
    if (measurementBlockReason({ env, href: window.location.href, referrer: document.referrer,
      automation: knownMeasurementAutomation(window.navigator), storage: window.localStorage,
      regionEligible: documentMeasurementRegion(document) }) !== null) return false;
    if (document.querySelector('script[data-cf-beacon], script[src*="cloudflareinsights.com/"]')) return false;
    const controller: MeasurementController = {
      loaded: false, locked: false,
      withdraw() {
        if (controller.locked) return;
        controller.locked = true;
        // Do not pretend removing the element cancels installed SDK handlers.
        // A final public-document beacon can occur while the document unloads.
        if (controller.loaded) window.location.reload();
      },
    };
    host.__INSHELL_HOME_MEASUREMENT__ = controller;
    const recheck = () => {
      try {
        const preference = browserExclusion(window.localStorage);
        if (!preference.readable || preference.excluded || !publicMeasurementUrl(window.location.href)) controller.withdraw();
      } catch { controller.withdraw(); }
    };
    window.addEventListener("storage", (event: globalThis.StorageEvent) => {
      if (event.key === null || event.key === ANALYTICS_EXCLUSION_KEY) recheck();
    });
    window.addEventListener("hashchange", recheck);
    window.addEventListener("popstate", recheck);
    window.addEventListener("pageshow", recheck);
    // Eligible document only. This origin-only document behavior is installed
    // before the module SDK; noneligible pages keep their no-referrer baseline.
    let referrer = document.querySelector<globalThis.HTMLMetaElement>('meta[name="referrer"]');
    if (!referrer) {
      referrer = document.createElement("meta");
      referrer.name = "referrer";
      document.head.append(referrer);
    }
    referrer.content = "strict-origin";
    const script = document.createElement("script");
    script.type = "module";
    script.src = NATIVE_BEACON_URL;
    script.referrerPolicy = "no-referrer";
    script.dataset.cfBeacon = JSON.stringify({ token: measurementConfiguration(env).beaconToken, spa: false });
    document.head.append(script);
    controller.loaded = true;
    return true;
  } catch { return false; }
}

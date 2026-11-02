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

// Source-reviewed qualification, deliberately not environment switches.
// No supported manual regional policy, SPA stop/withdrawal boundary or absence
// of competing automatic injection has been verified for this candidate.
export const ANALYTICS_QUALIFICATION = Object.freeze({
  manualRegionalMode: false,
  navigationAndWithdrawal: false,
  automaticInjectionAbsent: false,
});

const paths = new Set(["/", "/path", "/will", "/gallery", "/docs"]);
const docs = new Set(["inshell", "agent-art", "movements", "thought", "will", "awa", "path", "pulse",
  "contracts", "artwork-metadata-chain", "fully-onchain", "mono-76", "verification", "wallet-local-data",
  "source-release-boundaries", "lineage", "generative-art", "agents-and-ai", "svg", "ethereum",
  "tokens-and-nfts", "onchain-art", "design-principles", "glossary"]);

export function publicMeasurementUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Test raw delimiters too: URL.search/hash omit an empty '?' or '#'.
    if (url.origin !== ANALYTICS_ORIGIN || url.username || url.password || /[?#%\\]/.test(raw)) return false;
    const pathname = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    // Reject URL normalization of ambiguous paths, not just the normalized URL.
    if (raw !== `${ANALYTICS_ORIGIN}${url.pathname}`) return false;
    return paths.has(pathname) || (pathname.startsWith("/docs/") && docs.has(pathname.slice(6)));
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

export function setBrowserExclusion(storage: Pick<globalThis.Storage, "setItem">, excluded: boolean): boolean {
  try { storage.setItem(ANALYTICS_EXCLUSION_KEY, excluded ? "1" : "0"); return true; }
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

export function measurementBlockReason(context: MeasurementContext): string {
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
  // Exact site_tag/site_token pairing also requires qualification. Shape alone
  // is not identity approval. These gates are not bypassable with public config.
  return "qualification-pending";
}

export function installQualifiedMeasurement(env: Readonly<Record<string, unknown>>): false {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    measurementBlockReason({ env, href: window.location.href, referrer: document.referrer,
      automation: window.navigator.webdriver === true, storage: window.localStorage,
      regionEligible: documentMeasurementRegion(document) });
  } catch { return false; }
  // Intentionally no vendor script or network call. Implement the native load
  // only after the three source-reviewed qualifications above have evidence.
  // Removing a script is NOT a supported stop for already-installed handlers.
  return false;
}

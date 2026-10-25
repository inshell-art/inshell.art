// Public pilot settings, not credentials. No production measurement ID is shipped.
export const GA4_PREFERENCE_KEY = "inshell.ga4.preference.v1";
export const GA4_EXCLUSION_KEY = "inshell.ga4.excluded.v1";
export const GA4_POLICY_VERSION = 1;
export const GA4_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
export const GA4_COOKIE_PREFIX = "inshell_ga4";
export type Ga4Preference = { choice: "allow" | "reject"; version: 1; expiresAt: number };
export type Ga4Screen = { path: string; title: string };

export function readGa4Preference(raw: string | null, now = Date.now()): Ga4Preference | null {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.version !== GA4_POLICY_VERSION ||
      !["allow", "reject"].includes(value.choice) || !Number.isFinite(value.expiresAt) ||
      value.expiresAt <= now || value.expiresAt > now + GA4_LIFETIME_MS ||
      Object.keys(value).sort().join() !== "choice,expiresAt,version") return null;
    return value;
  } catch { return null; }
}

const screens: Record<string, string> = {
  "/": "Home", "/path": "$PATH", "/thought": "THOUGHT", "/gallery": "Gallery",
  "/docs": "Docs", "/will": "WILL", "/verify": "Verify", "/color-font": "Color Font",
};
// Closed list: arbitrary docs slugs must not become analytics labels.
const docs = new Set(["inshell", "agent-art", "movements", "thought", "will", "awa", "path", "pulse",
  "contracts", "artwork-metadata-chain", "fully-onchain", "mono-76", "verification", "wallet-local-data",
  "source-release-boundaries", "lineage", "generative-art", "agents-and-ai", "svg", "ethereum",
  "tokens-and-nfts", "onchain-art", "design-principles", "glossary"]);

export function ga4Screen(url: URL): Ga4Screen | null {
  // A fixture, callback or old launch query is not an ordinary public screen.
  if ([...url.searchParams.keys()].some(key => /fixture|callback|return|auth|token|run|launch|surface|debug|test|handoff/i.test(key))) return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (screens[path]) return { path, title: screens[path] };
  if (/^\/(thought|path)\/[1-9]\d*$/.test(path)) {
    const kind = path.split("/")[1];
    return { path: `/${kind}/record`, title: kind === "thought" ? "THOUGHT record" : "$PATH record" };
  }
  if (path.startsWith("/docs/") && docs.has(path.slice(6))) return { path, title: "Docs" };
  return null;
}

export function ga4Referrer(raw: string): string {
  try {
    const url = new URL(raw);
    // Only hostname, never username/password, path, port, query or fragment.
    return ["https:", "http:"].includes(url.protocol) ? `https://${url.hostname}/` : "";
  } catch { return ""; }
}

export function ga4EnvironmentAllowed(env: Record<string, unknown>, url: URL, webdriver: boolean): boolean {
  return url.origin === "https://inshell.art" && env.PROD === true && env.DEV !== true &&
    env.VITE_DEPLOY_ENV === "production" && env.VITE_GA4_ENABLED === "true" &&
    env.MODE !== "test" && env.VITE_GA4_TEST !== "true" && !webdriver &&
    typeof env.VITE_GA4_MEASUREMENT_ID === "string" && /^G-[A-Z0-9]{6,20}$/.test(env.VITE_GA4_MEASUREMENT_ID) &&
    !env.VITE_GA4_MEASUREMENT_ID.includes("TEST");
}

export function ga4Context(screen: Ga4Screen, referrer: string) {
  return { page_location: `https://inshell.art${screen.path}`, page_title: screen.title,
    page_referrer: referrer, campaign_id: "", campaign_source: "", campaign_medium: "",
    campaign_name: "", campaign_term: "", campaign_content: "" };
}

export const GA4_NOTICE = {
  question: "Allow optional Google Analytics to help us understand which countries visits come from, which pages are viewed, time in view and repeat visits? It uses first-party analytics cookies. You can change this choice in Analytics settings.",
  scope: "This choice controls Google Analytics only. Existing Cloudflare and first-party telemetry are separate and are not disabled by this choice.",
  details: "Google receives coarse page categories, referrer hostname, device/browser information and analytics cookie identifiers. Requests expose your IP address to Google for delivery and approximate location. We do not send prompts, returned text, work IDs, wallet addresses or saved works. Your choice lasts 90 days. Analytics cookies are host-only. The client cookie has a fixed expiry of up to 90 days after creation; the session cookie can renew for up to 90 days after activity or a new visit. An expired choice keeps measurement off until you allow it again. The required Google setting is two-month user/event retention without activity-based reset; aggregated reports have different retention. Figures describe consenting observed browsers, not all visitors or verified people. Location can reflect VPN/proxy egress; time in view is not proof of attention. Withdrawal stops future measurement, not already-sent requests or historical records. It does not reload the page or delete your work.",
};

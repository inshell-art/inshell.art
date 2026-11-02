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

// Compatibility for pinned THOUGHT source. Retired: no hooks, IDs, cookies,
// storage mutations or network traffic. Historical data is deliberately kept.
export function installInshellAnonymousAnalytics(_options: AnonymousAnalyticsOptions = {}): false { return false; }
export function trackInshellAnonymousAnalytics(_input: AnonymousAnalyticsTrackInput): false { return false; }

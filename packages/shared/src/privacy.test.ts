import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { ANALYTICS_EXCLUSION_KEY, ANALYTICS_QUALIFICATION, publicMeasurementUrl,
  publicMeasurementReferrer, measurementBlockReason, measurementConfiguration, browserExclusion,
  setBrowserExclusion, installQualifiedMeasurement, documentMeasurementRegion } from "./privacy.ts";
import { installInshellAnonymousAnalytics, trackInshellAnonymousAnalytics } from "./anonymousAnalytics.ts";

const env = { PROD: true, DEV: false, MODE: "production", VITE_DEPLOY_ENV: "production",
  VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "true", VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "1".repeat(32),
  VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "2".repeat(32) };
const context = { env, href: "https://inshell.art/", referrer: "", automation: false,
  storage: { getItem: () => null }, regionEligible: true };

test("exact server marker is required and cannot enable collection", () => {
  for (const contents of [[], ["off"], ["ELIGIBLE"], ["true"], [null], ["eligible", "eligible"], ["off", "eligible"], ["eligible"]]) {
    const document = { querySelectorAll: () => contents.map(content => ({ getAttribute: () => content })) } as unknown as Pick<globalThis.Document, "querySelectorAll">;
    assert.equal(documentMeasurementRegion(document), contents.length === 1 && contents[0] === "eligible");
  }
  for (const regionEligible of [undefined, false]) assert.equal(measurementBlockReason({ ...context, regionEligible }), "region-unqualified");
  assert.equal(measurementBlockReason(context), "qualification-pending");
  assert.equal(measurementBlockReason({ ...context, regionEligible: undefined,
    env: { ...env, regionEligible: true, VITE_GA4_ENABLED: "true" } }), "region-unqualified");
});

test("reporting site tag and public beacon token remain distinct", () => {
  assert.deepEqual(measurementConfiguration(env), { reportingSiteTag: "1".repeat(32), beaconToken: "2".repeat(32) });
  assert.equal(measurementConfiguration({ VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "1".repeat(32) }).beaconToken, undefined);
});
test("qualification cannot be turned on through env or old consent", () => {
  assert.deepEqual(Object.values(ANALYTICS_QUALIFICATION), [false, false, false]);
  assert.ok(Object.isFrozen(ANALYTICS_QUALIFICATION));
  assert.equal(measurementBlockReason(context), "qualification-pending");
  for (const overrides of [{}, { VITE_GA4_ENABLED: "true", lite: true, navigationAndWithdrawal: true }]) {
    assert.equal(installQualifiedMeasurement({ ...env, ...overrides }), false);
    assert.equal(measurementBlockReason({ ...context, env: { ...env, ...overrides } }), "qualification-pending");
  }
});
for (const route of ["/", "/path", "/path/", "/will", "/gallery", "/docs", "/docs/agent-art"]) {
  test(`potential route only: ${route}`, () => assert.equal(publicMeasurementUrl(`https://inshell.art${route}`), true));
}
for (const route of ["/thought", "/thought/1", "/thought?token=private", "/path/2", "/verify", "/wallet", "/auth/callback",
  "/api/ops/status", "/pub/x", "/llms.txt", "/feed.xml", "/docs/unknown", "/?", "/#", "/?utm=foo", "/#private",
  "/docs/../path", "/%70ath", "/path//", "/docs/agent-art#intent"]) {
  test(`reject actual URL ${route}`, () => assert.equal(publicMeasurementUrl(`https://inshell.art${route}`), false));
}
for (const origin of ["http://inshell.art", "https://inshell.art:444", "https://preview.inshell.art", "https://thought.inshell.art",
  "https://staging.inshell-art.pages.dev", "https://x.workers.dev", "http://127.0.0.1:5177", "https://a:b@inshell.art"]) {
  test(`excluded origin ${origin}`, () => assert.equal(publicMeasurementUrl(`${origin}/`), false));
}
test("referrer is checked as transmitted, never relabeled", () => {
  for (const raw of ["https://external.example/", "https://external.example/private", "https://inshell.art/thought/1", "https://inshell.art/?private=1", "not a URL"]) {
    assert.equal(publicMeasurementReferrer(raw), false);
    assert.equal(measurementBlockReason({ ...context, referrer: raw }), "unqualified-referrer");
  }
  assert.equal(publicMeasurementReferrer(""), true);
  assert.equal(publicMeasurementReferrer("https://inshell.art/path"), true);
});
test("preserve exclusion semantics, fail closed on unreadable storage", () => {
  assert.equal(ANALYTICS_EXCLUSION_KEY, "inshell.ga4.excluded.v1");
  for (const raw of ["1", "true", "unexpected", ""]) assert.equal(browserExclusion({ getItem: () => raw }).excluded, true);
  for (const raw of [null, "0"]) assert.equal(browserExclusion({ getItem: () => raw }).excluded, false);
  assert.equal(measurementBlockReason({ ...context, storage: { getItem() { throw Error("denied"); } } }), "storage-unavailable");
  assert.equal(measurementBlockReason({ ...context, storage: { getItem: () => "1" } }), "browser-excluded");
  const values = new Map([["work", "saved"], ["auth", "retained"], ["inshell.ga4.preference.v1", "old-allow"]]);
  const storage = { setItem: (k: string, v: string) => { values.set(k, v); } };
  assert.equal(setBrowserExclusion(storage, true), true);
  assert.equal(values.get(ANALYTICS_EXCLUSION_KEY), "1");
  setBrowserExclusion(storage, false);
  assert.equal(values.get(ANALYTICS_EXCLUSION_KEY), "0");
  assert.equal(values.get("work"), "saved"); assert.equal(values.get("auth"), "retained");
  assert.equal(values.get("inshell.ga4.preference.v1"), "old-allow");
  assert.equal(setBrowserExclusion({ setItem() { throw Error("quota"); } }, true), false);
});
test("local, preview, test, disabled, missing configuration and automation stay off", () => {
  for (const overrides of [{ PROD: false }, { DEV: true }, { MODE: "test" }, { VITE_DEPLOY_ENV: "preview" },
    { VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "false" }, { VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: undefined }]) {
    assert.equal(measurementBlockReason({ ...context, env: { ...env, ...overrides } }), "configuration");
  }
  for (const overrides of [{ CI: true }, { CI: "1" }, { VITE_AUTOMATION: "true" }]) {
    assert.equal(measurementBlockReason({ ...context, env: { ...env, ...overrides } }), "automation");
  }
  assert.equal(measurementBlockReason({ ...context, automation: true }), "automation");
});
test("retired compatibility client cannot touch provided objects", () => {
  const forbidden = new Proxy({}, { get() { throw Error("side effect"); } });
  assert.equal(installInshellAnonymousAnalytics(forbidden), false);
  assert.equal(trackInshellAnonymousAnalytics({ eventType: "pageview" }), false);
});
test("no GA4 or legacy installer in current entries; quiet Privacy, no auto-open panel", () => {
  const root = new URL("../../../", import.meta.url);
  for (const file of ["apps/home/src/main.tsx", "apps/thought/scripts/plain-return-entry.ts"]) {
    assert.doesNotMatch(readFileSync(new URL(file, root), "utf8"), /installInshellAnonymousAnalytics|mountGa4Choice|ga4-ui/);
  }
  // The integrity-pinned legacy main keeps its import/call, but the imported
  // shared compatibility function is inert (covered above), not a collector.
  assert.doesNotMatch(readFileSync(new URL("apps/thought/src/main.ts", root), "utf8"), /mountGa4Choice|ga4-ui/);
  for (const file of ["ga4.ts", "ga4-ui.ts", "ga4.css"]) assert.equal(existsSync(new URL(file, import.meta.url)), false);
  const ui = readFileSync(new URL("privacy-ui.ts", import.meta.url), "utf8");
  assert.match(ui, /createElement\("details"\)/);
  assert.doesNotMatch(ui, /\.open\s*=|localStorage\.clear|removeItem|location\.reload|document\.cookie|Allow Google/);
  assert.doesNotMatch(readFileSync(new URL("privacy.css", import.meta.url), "utf8"), /position:\s*(fixed|absolute)/);
});
test("quiet Privacy opens only by visitor action and only persists the exclusion key", () => {
  // An offline DOM stub, not a browser collection test. No network capability.
  type Element = { tag: string; id?: string; textContent?: string; disabled?: boolean;
    children: Element[]; events: Record<string, () => void>; append: (...children: Element[]) => void;
    setAttribute: () => void; addEventListener: (event: string, handler: () => void) => void };
  function element(tag: string): Element {
    return { tag, children: [], events: {}, append(...children) { this.children.push(...children); },
      setAttribute() {}, addEventListener(event, handler) { this.events[event] = handler; } };
  }
  const body = element("body");
  const values = new Map([["saved-work", "keep"], [ANALYTICS_EXCLUSION_KEY, "1"]]);
  const listeners: Record<string, () => void> = {};
  const source = readFileSync(new URL("privacy-ui.ts", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace("export function", "function");
  const code = stripTypeScriptTypes(source) + "\nmountPrivacyInformation();mountPrivacyInformation();";
  runInNewContext(code, { browserExclusion, setBrowserExclusion,
    document: { body, createElement: element, getElementById: (id: string) => body.children.find(child => child.id === id) },
    window: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
      addEventListener: (event: string, handler: () => void) => { listeners[event] = handler; } } });
  assert.equal(body.children.length, 1);
  const panel = body.children[0];
  assert.equal(panel.tag, "details"); assert.equal("open" in panel, false);
  const button = panel.children.find(child => child.tag === "button")!;
  assert.equal(button.textContent, "Remove browser exclusion");
  button.events.click();
  assert.equal(values.get(ANALYTICS_EXCLUSION_KEY), "0");
  assert.equal(button.textContent, "Exclude this browser");
  values.set(ANALYTICS_EXCLUSION_KEY, "1"); listeners.storage();
  assert.equal(button.textContent, "Remove browser exclusion");
  assert.equal(values.get("saved-work"), "keep"); assert.equal(values.size, 2);
});

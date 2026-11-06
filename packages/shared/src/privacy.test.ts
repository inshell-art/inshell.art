import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { ANALYTICS_EXCLUSION_KEY, HOME_MEASUREMENT_POLICY, NATIVE_BEACON_URL, publicMeasurementUrl,
  publicMeasurementReferrer, measurementBlockReason, measurementConfiguration, browserExclusion,
  setBrowserExclusion, installQualifiedMeasurement, documentMeasurementRegion, knownMeasurementAutomation } from "./privacy.ts";
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
test("the exact operational policy is separate from enablement and old consent", () => {
  assert.equal(HOME_MEASUREMENT_POLICY, "home-document-v1");
  assert.equal(measurementBlockReason(context), "qualification-pending");
  for (const overrides of [{}, { VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY: "home-document-v0" },
    { VITE_GA4_ENABLED: "true", lite: true, navigationAndWithdrawal: true }]) {
    assert.equal(installQualifiedMeasurement({ ...env, ...overrides }), false);
    assert.equal(measurementBlockReason({ ...context, env: { ...env, ...overrides } }), "qualification-pending");
  }
  assert.equal(measurementBlockReason({ ...context,
    env: { ...env, VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY: HOME_MEASUREMENT_POLICY } }), null);
});
test("only the canonical Home document is eligible", () => assert.equal(publicMeasurementUrl("https://inshell.art/"), true));
for (const route of ["/path", "/path/", "/will", "/gallery", "/docs", "/docs/agent-art", "/thought", "/thought/1", "/thought?token=private", "/path/2", "/verify", "/wallet", "/auth/callback",
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
  assert.equal(publicMeasurementReferrer("https://inshell.art/"), true);
  assert.equal(publicMeasurementReferrer("https://inshell.art/path"), false);
});
test("preserve exclusion semantics, fail closed on unreadable storage", () => {
  assert.equal(ANALYTICS_EXCLUSION_KEY, "inshell.ga4.excluded.v1");
  for (const raw of ["1", "true", "unexpected", ""]) assert.equal(browserExclusion({ getItem: () => raw }).excluded, true);
  for (const raw of [null, "0"]) assert.equal(browserExclusion({ getItem: () => raw }).excluded, false);
  assert.equal(measurementBlockReason({ ...context, storage: { getItem() { throw Error("denied"); } } }), "storage-unavailable");
  assert.equal(measurementBlockReason({ ...context, storage: { getItem: () => "1" } }), "browser-excluded");
  const values = new Map([["work", "saved"], ["auth", "retained"], ["inshell.ga4.preference.v1", "old-allow"]]);
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
  assert.equal(setBrowserExclusion(storage, true), true);
  assert.equal(values.get(ANALYTICS_EXCLUSION_KEY), "1");
  setBrowserExclusion(storage, false);
  assert.equal(values.get(ANALYTICS_EXCLUSION_KEY), "0");
  assert.equal(values.get("work"), "saved"); assert.equal(values.get("auth"), "retained");
  assert.equal(values.get("inshell.ga4.preference.v1"), "old-allow");
  assert.equal(setBrowserExclusion({ getItem: () => null, setItem() { throw Error("quota"); } }, true), false);
  assert.equal(setBrowserExclusion({ getItem: () => null, setItem() {} }, true), false);
  assert.equal(setBrowserExclusion({ getItem() { throw Error("readback"); }, setItem() {} }, true), false);
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
  runInNewContext(code, { browserExclusion, setBrowserExclusion, measurementLoaded: () => false, withdrawMeasurement: () => {},
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

type OfflineElement = {
  tag: string; name?: string; content?: string; src?: string; type?: string; referrerPolicy?: string;
  id?: string; textContent?: string; disabled?: boolean; dataset: Record<string, string>;
  children: OfflineElement[]; events: Record<string, () => void>;
  append: (...children: OfflineElement[]) => void;
  setAttribute: () => void;
  addEventListener: (event: string, handler: () => void) => void;
};

// This VM has no fetch, XMLHttpRequest, navigator.sendBeacon or network hook.
// Script insertion is observed as inert DOM data; no vendor code can execute.
function offlineMeasurement(options: {
  href?: string; referrer?: string; markers?: (string | null)[];
  webdriver?: boolean; userAgent?: string; excluded?: string;
  duplicateScript?: boolean; existingReferrer?: boolean; storageUnavailable?: boolean;
} = {}) {
  function element(tag: string): OfflineElement {
    return { tag, dataset: {}, children: [], events: {},
      append(...children) { this.children.push(...children); },
      setAttribute() {}, addEventListener(event, handler) { this.events[event] = handler; } };
  }
  const body = element("body");
  const head = element("head");
  if (options.existingReferrer) head.children.push({ ...element("meta"), name: "referrer", content: "no-referrer" });
  const values = new Map([["saved-work", "keep-work"], ["auth", "keep-auth"]]);
  if (options.excluded !== undefined) values.set(ANALYTICS_EXCLUSION_KEY, options.excluded);
  const state = { unreadable: options.storageUnavailable ?? false, failWrite: false, ignoreWrite: false, reloads: 0 };
  const storage = {
    getItem(key: string) { if (state.unreadable) throw Error("storage denied"); return values.get(key) ?? null; },
    setItem(key: string, value: string) {
      if (state.failWrite) throw Error("storage quota");
      if (!state.ignoreWrite) values.set(key, value);
    },
  };
  const listeners: Record<string, ((event: { key?: string | null }) => void)[]> = {};
  const appends: { tag: string; referrer: string | undefined }[] = [];
  head.append = (...children) => {
    head.children.push(...children);
    for (const child of children) appends.push({ tag: child.tag,
      referrer: head.children.find(item => item.tag === "meta" && item.name === "referrer")?.content });
  };
  const location = { href: options.href ?? "https://inshell.art/", reload() { state.reloads++; } };
  const document = {
    head, body, referrer: options.referrer ?? "", createElement: element,
    getElementById: (id: string) => body.children.find(child => child.id === id),
    querySelectorAll: () => (options.markers ?? ["eligible"]).map(content => ({ getAttribute: () => content })),
    querySelector(selector: string) {
      if (selector === 'meta[name="referrer"]') return head.children.find(item => item.tag === "meta" && item.name === "referrer") ?? null;
      return options.duplicateScript ? element("script") : null;
    },
  };
  const window = { location, localStorage: storage,
    navigator: { webdriver: options.webdriver ?? false, userAgent: options.userAgent ?? "Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36" },
    addEventListener(event: string, handler: (event: { key?: string | null }) => void) { (listeners[event] ??= []).push(handler); } };
  const source = readFileSync(new URL("privacy.ts", import.meta.url), "utf8").replace(/^export /gm, "");
  const ui = readFileSync(new URL("privacy-ui.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
  const api = runInNewContext(stripTypeScriptTypes(source + "\n" + ui) +
    "\n({install:installQualifiedMeasurement,loaded:measurementLoaded,withdraw:withdrawMeasurement,mount:mountPrivacyInformation})",
  { URL, document, window }) as {
    install: (env: Record<string, unknown>) => boolean; loaded: () => boolean; withdraw: () => void; mount: () => void;
  };
  return { api, document, head, body, state, values, location, appends,
    emit(event: string, value: { key?: string | null } = {}) { for (const handler of listeners[event] ?? []) handler(value); } };
}

const qualifiedEnv = { ...env, VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY: HOME_MEASUREMENT_POLICY };

test("qualified Home installs one module after origin-only behavior, never inlines identity", () => {
  const fixture = offlineMeasurement();
  assert.equal(fixture.api.loaded(), false);
  assert.equal(fixture.api.install(qualifiedEnv), true);
  assert.equal(fixture.api.loaded(), true);
  assert.deepEqual(fixture.appends.map(item => item.tag), ["meta", "script"]);
  assert.equal(fixture.appends[1].referrer, "strict-origin");
  const script = fixture.head.children.find(child => child.tag === "script")!;
  assert.equal(script.src, NATIVE_BEACON_URL);
  assert.equal(script.type, "module");
  assert.equal(script.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(script.dataset.cfBeacon), { token: "2".repeat(32), spa: false });
  assert.equal(fixture.api.install(qualifiedEnv), false);
  assert.equal(fixture.head.children.filter(child => child.tag === "script").length, 1);
  assert.deepEqual([...fixture.values], [["saved-work", "keep-work"], ["auth", "keep-auth"]]);
});

test("a qualified Home updates the existing referrer meta without duplicating it", () => {
  const fixture = offlineMeasurement({ existingReferrer: true });
  assert.equal(fixture.api.install(qualifiedEnv), true);
  assert.equal(fixture.head.children.filter(child => child.name === "referrer").length, 1);
  assert.equal(fixture.appends[0].referrer, "strict-origin");
});

test("blocked documents never change referrer behavior or append a SDK", () => {
  for (const options of [
    { href: "https://preview.inshell.art/" }, { href: "https://inshell.art/path" },
    { href: "https://inshell.art/thought" }, { href: "https://inshell.art/docs" },
    { href: "https://inshell.art/?private=1" }, { href: "https://inshell.art/#private" },
    { referrer: "https://external.example/private" }, { referrer: "https://inshell.art/thought" },
    { markers: [] }, { markers: ["off"] }, { markers: ["eligible", "eligible"] },
    { excluded: "1" }, { storageUnavailable: true }, { webdriver: true },
    { userAgent: "HeadlessChrome/142" }, { duplicateScript: true },
  ]) {
    const fixture = offlineMeasurement({ ...options, existingReferrer: true });
    assert.equal(fixture.api.install(qualifiedEnv), false, JSON.stringify(options));
    assert.equal(fixture.api.loaded(), false);
    assert.equal(fixture.head.children[0].content, "no-referrer");
    assert.equal(fixture.appends.length, 0);
  }
  for (const config of [{}, env, { ...qualifiedEnv, VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "false" },
    { ...qualifiedEnv, VITE_DEPLOY_ENV: "preview" }, { ...qualifiedEnv, VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "invalid" },
    { ...qualifiedEnv, VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: undefined }]) {
    const fixture = offlineMeasurement();
    assert.equal(fixture.api.install(config), false);
    assert.equal(fixture.appends.length, 0);
  }
});

test("known automation is excluded independently of the operational policy", () => {
  for (const userAgent of ["HeadlessChrome", "Playwright", "Puppeteer", "Selenium", "GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "a crawler", "spider"]) {
    assert.equal(knownMeasurementAutomation({ webdriver: false, userAgent }), true, userAgent);
  }
  assert.equal(knownMeasurementAutomation({ webdriver: true, userAgent: "Mozilla/5.0" }), true);
  assert.equal(knownMeasurementAutomation({ webdriver: false, userAgent: "Mozilla/5.0 Chrome/142.0.0.0 Safari/537.36" }), false);
});

test("withdrawal reloads once and cannot re-enable the same document", () => {
  const fixture = offlineMeasurement();
  fixture.api.withdraw();
  assert.equal(fixture.state.reloads, 0);
  assert.equal(fixture.api.install(qualifiedEnv), true);
  fixture.api.withdraw(); fixture.api.withdraw();
  assert.equal(fixture.state.reloads, 1);
  assert.equal(fixture.api.install(qualifiedEnv), false);
  assert.equal(fixture.head.children.filter(child => child.tag === "script").length, 1);
  assert.equal(fixture.values.get("saved-work"), "keep-work");
  assert.equal(fixture.values.get("auth"), "keep-auth");
});

test("storage changes fail closed only for the exclusion key or clear event", () => {
  const fixture = offlineMeasurement();
  assert.equal(fixture.api.install(qualifiedEnv), true);
  fixture.values.set(ANALYTICS_EXCLUSION_KEY, "1");
  fixture.emit("storage", { key: "saved-work" });
  assert.equal(fixture.state.reloads, 0);
  fixture.emit("storage", { key: ANALYTICS_EXCLUSION_KEY });
  assert.equal(fixture.state.reloads, 1);
  fixture.values.set(ANALYTICS_EXCLUSION_KEY, "0");
  fixture.emit("storage", { key: ANALYTICS_EXCLUSION_KEY });
  assert.equal(fixture.api.install(qualifiedEnv), false);
  assert.equal(fixture.state.reloads, 1);
  const unreadable = offlineMeasurement();
  assert.equal(unreadable.api.install(qualifiedEnv), true);
  unreadable.state.unreadable = true;
  unreadable.emit("storage", { key: null });
  assert.equal(unreadable.state.reloads, 1);
});

test("hash, history and bfcache rechecks withdraw unsafe loaded documents", () => {
  for (const event of ["hashchange", "popstate", "pageshow"]) {
    const fixture = offlineMeasurement();
    assert.equal(fixture.api.install(qualifiedEnv), true);
    fixture.emit(event);
    assert.equal(fixture.state.reloads, 0);
    fixture.location.href = event === "hashchange" ? "https://inshell.art/#private" : "https://inshell.art/thought";
    fixture.emit(event); fixture.emit(event);
    assert.equal(fixture.state.reloads, 1, event);
    assert.equal(fixture.api.install(qualifiedEnv), false);
  }
});

test("quiet Privacy discloses loaded Home withdrawal and preserves functional storage", () => {
  const fixture = offlineMeasurement();
  assert.equal(fixture.api.install(qualifiedEnv), true);
  fixture.api.mount(); fixture.api.mount();
  assert.equal(fixture.body.children.length, 1);
  const panel = fixture.body.children[0];
  assert.equal("open" in panel, false);
  assert.match(panel.children[1].textContent!, /Home page only.*final public-page send may occur/);
  const button = panel.children.find(child => child.tag === "button")!;
  button.events.click();
  assert.equal(fixture.values.get(ANALYTICS_EXCLUSION_KEY), "1");
  assert.equal(fixture.state.reloads, 1);
  assert.equal(fixture.values.get("saved-work"), "keep-work");
  assert.equal(fixture.values.get("auth"), "keep-auth");
});

test("removing exclusion never installs a SDK in the already open document", () => {
  const fixture = offlineMeasurement({ excluded: "1" });
  assert.equal(fixture.api.install(qualifiedEnv), false);
  fixture.api.mount();
  const panel = fixture.body.children[0];
  const button = panel.children.find(child => child.tag === "button")!;
  assert.equal(button.textContent, "Remove browser exclusion");
  button.events.click();
  assert.equal(fixture.values.get(ANALYTICS_EXCLUSION_KEY), "0");
  assert.equal(fixture.api.loaded(), false);
  assert.equal(fixture.appends.length, 0);
  assert.equal(fixture.state.reloads, 0);
  assert.match(panel.children[3].textContent!, /Removing an exclusion does not start measurement on this page/);
});

test("failed preference writes or readback withdraw a loaded SDK without clearing data", () => {
  for (const failure of ["failWrite", "ignoreWrite"] as const) {
    const fixture = offlineMeasurement();
    assert.equal(fixture.api.install(qualifiedEnv), true);
    fixture.api.mount();
    fixture.state[failure] = true;
    const panel = fixture.body.children[0];
    panel.children.find(child => child.tag === "button")!.events.click();
    assert.equal(fixture.state.reloads, 1, failure);
    assert.match(panel.children[3].textContent!, /preference could not be saved/);
    assert.equal(fixture.values.get("saved-work"), "keep-work");
    assert.equal(fixture.values.get("auth"), "keep-auth");
  }
});

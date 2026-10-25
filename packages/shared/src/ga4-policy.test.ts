import assert from "node:assert/strict";
import test from "node:test";
import { GA4_NOTICE, GA4_LIFETIME_MS, ga4Context, ga4EnvironmentAllowed, ga4Referrer, ga4Screen, readGa4Preference } from "./ga4-policy";

test("explicit production gates fail closed", () => {
  const env = { PROD: true, VITE_DEPLOY_ENV: "production", VITE_GA4_ENABLED: "true", VITE_GA4_MEASUREMENT_ID: "G-LOCALONLY01" };
  const url = new URL("https://inshell.art/");
  assert.equal(ga4EnvironmentAllowed(env, url, false), true);
  for (const origin of ["http://inshell.art", "https://preview.inshell.art", "https://inshell-art.pages.dev", "http://127.0.0.1", "https://thought.inshell.art", "https://inshell.art:444"]) {
    assert.equal(ga4EnvironmentAllowed(env, new URL(origin), false), false);
  }
  for (const change of [{ PROD: false }, { DEV: true }, { VITE_DEPLOY_ENV: "preview" }, { VITE_GA4_ENABLED: "false" }, { MODE: "test" }, { VITE_GA4_TEST: "true" }, { VITE_GA4_MEASUREMENT_ID: "" }, { VITE_GA4_MEASUREMENT_ID: "G-TEST000000" }]) {
    assert.equal(ga4EnvironmentAllowed({ ...env, ...change }, url, false), false);
  }
  assert.equal(ga4EnvironmentAllowed(env, url, true), false);
});
test("only bounded versioned preferences are accepted", () => {
  const now = 1000, valid = { choice: "allow", version: 1, expiresAt: now + GA4_LIFETIME_MS };
  assert.deepEqual(readGa4Preference(JSON.stringify(valid), now), valid);
  for (const value of [null, "broken", {}, { ...valid, visitorId: "not-permitted" }, { ...valid, version: 0 }, { ...valid, choice: "yes" }, { ...valid, expiresAt: now }, { ...valid, expiresAt: now + GA4_LIFETIME_MS + 1 }]) {
    assert.equal(readGa4Preference(JSON.stringify(value), now), null);
  }
});
test("cookie notice distinguishes fixed client expiry from rolling session expiry", () => {
  assert.match(GA4_NOTICE.details, /choice lasts 90 days/);
  assert.match(GA4_NOTICE.details, /client cookie has a fixed expiry of up to 90 days after creation/);
  assert.match(GA4_NOTICE.details, /session cookie can renew for up to 90 days after activity or a new visit/);
  assert.match(GA4_NOTICE.details, /expired choice keeps measurement off/);
  assert.doesNotMatch(GA4_NOTICE.details, /fixed-lifetime, host-only analytics cookies/);
});
test("allowlisted contexts contain no raw URL state or dynamic identifiers", () => {
  assert.deepEqual(ga4Screen(new URL("https://inshell.art/thought/124?utm_source=private#secret")), { path: "/thought/record", title: "THOUGHT record" });
  for (const path of ["/api/x", "/thought/run/123", "/docs/private-value", "/pub/a", "/source", "/return", "/auth", "/thought?launch=anything", "/path?fixture=active"]) {
    assert.equal(ga4Screen(new URL(`https://inshell.art${path}`)), null);
  }
  const context = ga4Context(ga4Screen(new URL("https://inshell.art/docs/agent-art?q=private#secret"))!, ga4Referrer("https://example.org/private?token=secret#fragment"));
  assert.equal(context.page_referrer, "https://example.org/");
  assert.equal(context.page_location, "https://inshell.art/docs/agent-art");
  assert.doesNotMatch(JSON.stringify(context), /private|secret|fragment/);
  assert.equal(ga4Referrer("javascript:bad"), "");
});

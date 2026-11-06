import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkAnalyticsOffBuild } from "./check-analytics-off-build.mjs";

function fixture(t, policy = {}) {
  const root = mkdtempSync(join(tmpdir(), "inshell-analytics-off-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "measurement-build-policy.json"), JSON.stringify({
    schema: "inshell.measurement-build-policy.v1", enabled: "false",
    policy: "home-document-v1", deployEnv: "production", ...policy,
  }));
  writeFileSync(join(root, "index.html"), '<html><script type="module" src="/app.js"></script></html>');
  writeFileSync(join(root, "app.js"), 'const dormantOfficialLoader = "https://static.cloudflareinsights.com/beacon.min.js";');
  return root;
}

test("OFF projection permits the inert official loader in a JS bundle", (t) => {
  assert.deepEqual(checkAnalyticsOffBuild(fixture(t)), { checked: 2, policies: 1 });
});

test("enabled, malformed and absent policies fail closed", (t) => {
  for (const enabled of ["true", true, "", "0", null]) {
    assert.throws(() => checkAnalyticsOffBuild(fixture(t, { enabled })), /not configured OFF/);
  }
  const root = fixture(t);
  rmSync(join(root, "measurement-build-policy.json"));
  assert.throws(() => checkAnalyticsOffBuild(root), /ENOENT/);
  writeFileSync(join(root, "measurement-build-policy.json"), "{");
  assert.throws(() => checkAnalyticsOffBuild(root), SyntaxError);
});

test("unknown projection fields and deployment identities are rejected", (t) => {
  assert.throws(() => checkAnalyticsOffBuild(fixture(t, { token: "not-allowed" })), /not configured OFF/);
  assert.throws(() => checkAnalyticsOffBuild(fixture(t, { deployEnv: "arbitrary" })), /not configured OFF/);
});

test("a native loader in HTML is rejected even with OFF policy", (t) => {
  const root = fixture(t);
  for (const html of [
    '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js"></script>',
    '<link rel="preload" href="https://static.cloudflareinsights.com/beacon.min.js">',
    '<script>load("https://static.cloudflareinsights.com/beacon.min.js")</script>',
  ]) {
    writeFileSync(join(root, "index.html"), html);
    assert.throws(() => checkAnalyticsOffBuild(root), /Native collector remains/);
  }
});

test("legacy collectors and identity installers remain forbidden in JS", (t) => {
  const root = fixture(t);
  for (const banned of ["googletagmanager.com/gtag/js", "google-analytics.com/g/collect", "inshell-ga4-choice", "__INSHELL_ANON_ANALYTICS_INSTALLED__"]) {
    writeFileSync(join(root, "app.js"), JSON.stringify(banned));
    assert.throws(() => checkAnalyticsOffBuild(root), /Retired collector remains/);
  }
});

test("nested same-origin THOUGHT requires its own OFF build projection", (t) => {
  const root = fixture(t);
  const thought = join(root, "thought");
  mkdirSync(thought);
  writeFileSync(join(thought, "index.html"), "<html></html>");
  assert.throws(() => checkAnalyticsOffBuild(root), /ENOENT/);
  writeFileSync(join(thought, "measurement-build-policy.json"), JSON.stringify({
    schema: "inshell.measurement-build-policy.v1", enabled: "true", policy: "home-document-v1", deployEnv: "production",
  }));
  assert.throws(() => checkAnalyticsOffBuild(root), /not configured OFF/);
  writeFileSync(join(thought, "measurement-build-policy.json"), JSON.stringify({
    schema: "inshell.measurement-build-policy.v1", enabled: "false", policy: null, deployEnv: null,
  }));
  assert.deepEqual(checkAnalyticsOffBuild(root), { checked: 3, policies: 2 });
});

test("qualified Home mode requires an exact enabled production Home policy", (t) => {
  const root = fixture(t, { enabled: "true" });
  assert.deepEqual(checkAnalyticsOffBuild(root, { qualifiedHome: true }), { checked: 2, policies: 1 });
  for (const change of [{ enabled: "false" }, { policy: "other" }, { deployEnv: "preview" }, { deployEnv: null }]) {
    assert.throws(() => checkAnalyticsOffBuild(fixture(t, { enabled: "true", ...change }), { qualifiedHome: true }), /qualified Home-only/);
  }
});

test("qualified Home mode never enables nested THOUGHT", (t) => {
  const root = fixture(t, { enabled: "true" });
  const thought = join(root, "thought");
  mkdirSync(thought);
  writeFileSync(join(thought, "index.html"), "<html></html>");
  const policy = { schema: "inshell.measurement-build-policy.v1", enabled: "false", policy: "", deployEnv: "production" };
  writeFileSync(join(thought, "measurement-build-policy.json"), JSON.stringify(policy));
  assert.deepEqual(checkAnalyticsOffBuild(root, { qualifiedHome: true }), { checked: 3, policies: 2 });
  writeFileSync(join(thought, "measurement-build-policy.json"), JSON.stringify({ ...policy, enabled: "true", policy: "home-document-v1" }));
  assert.throws(() => checkAnalyticsOffBuild(root, { qualifiedHome: true }), /not configured OFF/);
});

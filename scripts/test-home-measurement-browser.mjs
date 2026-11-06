import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { onRequest } from "../functions/_middleware.ts";

// No upstream request may continue. The SDK is a retained, checksummed local
// input, and even unload/sendBeacon uploads are intercepted before navigation.
const sdkPath = process.env.PRIVACY_RETAINED_SDK;
assert.ok(sdkPath, "PRIVACY_RETAINED_SDK must name the retained local SDK");
const sdk = await readFile(sdkPath);
const sdkSha256 = createHash("sha256").update(sdk).digest("hex");
assert.equal(sdkSha256, "637381256384554e1cc3309a62fb238a51b83e7f10b2a56d8ba15dbc73ca762e");
const out = resolve(process.env.PRIVACY_TEST_OUTPUT ?? "tmp/home-measurement-browser");
await mkdir(out, { recursive: true });
assert.equal(execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier",
  "/Applications/Google Chrome.app/Contents/Info.plist"], { encoding: "utf8" }).trim(), "com.google.Chrome");
const privacy = stripTypeScriptTypes(await readFile("packages/shared/src/privacy.ts", "utf8"));
const ui = stripTypeScriptTypes((await readFile("packages/shared/src/privacy-ui.ts", "utf8"))
  .replace('import "./privacy.css";', "").replace('from "./privacy"', 'from "/privacy.js"'));
const css = await readFile("packages/shared/src/privacy.css", "utf8");
const design = await readFile("packages/shared/src/design.css", "utf8");
const tokens = await readFile("packages/inshell-shell/src/tokens.css", "utf8");
const env = { PROD: true, DEV: false, MODE: "production", VITE_DEPLOY_ENV: "production",
  VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "true", VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY: "home-document-v1",
  VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "1".repeat(32), VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "2".repeat(32) };
const browser = await chromium.launch({ headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--disable-background-networking", "--disable-component-update", "--disable-sync"] });
const checks = [], errors = [], uploads = [], requests = [];
try {
  for (const scenario of [
    { name: "enabled-home", url: "https://inshell.art/", active: true },
    { name: "enabled-mobile", url: "https://inshell.art/", active: true, mobile: true },
    { name: "restricted-country", url: "https://inshell.art/", country: "DE" },
    { name: "unknown-country", url: "https://inshell.art/", country: "XX" },
    { name: "default-off", url: "https://inshell.art/", overrides: { VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "false" } },
    { name: "unqualified", url: "https://inshell.art/", overrides: { VITE_CLOUDFLARE_WEB_ANALYTICS_POLICY: undefined } },
    { name: "preview", url: "https://preview.inshell.art/" },
    { name: "path", url: "https://inshell.art/path" },
    { name: "thought", url: "https://inshell.art/thought" },
    { name: "docs", url: "https://inshell.art/docs" },
    { name: "query", url: "https://inshell.art/?private=fixture" },
    { name: "fragment", url: "https://inshell.art/#private-fixture" },
    { name: "unsafe-referrer", url: "https://inshell.art/", referrer: "https://inshell.art/thought/123" },
    { name: "excluded", url: "https://inshell.art/", excluded: true },
    { name: "storage-denied", url: "https://inshell.art/", storageDenied: true },
    { name: "automation", url: "https://inshell.art/", automation: true },
  ]) {
    const context = await browser.newContext({ serviceWorkers: "block",
      viewport: scenario.mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" });
    let sdkLoads = 0;
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      requests.push({ scenario: scenario.name, method: request.method(), origin: url.origin, path: url.pathname });
      if (url.href === "https://static.cloudflareinsights.com/beacon.min.js") {
        sdkLoads++;
        assert.equal(request.headers().referer, undefined, "SDK fetch must not send referrer");
        return route.fulfill({ contentType: "text/javascript", body: sdk });
      }
      if (url.pathname === "/cdn-cgi/rum" && request.method() === "POST") {
        uploads.push({ scenario: scenario.name, referer: request.headers().referer ?? null,
          body: request.postDataJSON() });
        return route.fulfill({ status: 204, body: "" });
      }
      if (url.origin !== new URL(scenario.url).origin) throw Error("Unexpected external request: " + url.origin);
      if (url.pathname === "/privacy.js") return route.fulfill({ contentType: "text/javascript", body: privacy });
      if (url.pathname === "/privacy-ui.js") return route.fulfill({ contentType: "text/javascript", body: ui });
      if (url.pathname === "/fixture.js") return route.fulfill({ contentType: "text/javascript", body:
        `import {installQualifiedMeasurement} from '/privacy.js'; import {mountPrivacyInformation} from '/privacy-ui.js'; window.fixtureInstall=()=>installQualifiedMeasurement(${JSON.stringify({ ...env, ...scenario.overrides })}); window.fixtureInstall(); mountPrivacyInformation();` });
      const shell = `<html><head><style>${tokens}\n${design}\n${css}</style></head><body><h1>Home fixture</h1><a href="/thought">THOUGHT</a><script type="module" src="/fixture.js"></script></body></html>`;
      const incoming = new Request(url);
      Object.defineProperty(incoming, "cf", { value: { country: scenario.country ?? "US" } });
      const response = await onRequest({ request: incoming, env: { ASSETS: { fetch: async () => new Response(shell, { headers: { "content-type": "text/html", "referrer-policy": "no-referrer" } }) } }, next: async () => new Response("", { status: 404 }) });
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    });
    await context.addInitScript(scenario => {
      // This is a controlled eligibility simulation, NOT human/native-canary
      // evidence. A separate negative case leaves webdriver true.
      Object.defineProperty(navigator, "webdriver", { get: () => !!scenario.automation });
      if (scenario.excluded) localStorage.setItem("inshell.ga4.excluded.v1", "1");
      localStorage.setItem("saved-work-fixture", "retained");
      localStorage.setItem("auth-fixture", "retained");
      if (scenario.storageDenied) Storage.prototype.getItem = () => { throw Error("synthetic denial"); };
    }, scenario);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ scenario: scenario.name, message: error.message }));
    await page.goto(scenario.url, scenario.referrer ? { referer: scenario.referrer } : {});
    await page.locator("#inshell-privacy").waitFor();
    assert.equal(await page.locator("#inshell-privacy").getAttribute("open"), null);
    await page.waitForTimeout(250);
    assert.equal(sdkLoads, scenario.active ? 1 : 0, scenario.name);
    if (scenario.active) {
      assert.equal(await page.locator('script[data-cf-beacon]').getAttribute("type"), "module");
      assert.deepEqual(JSON.parse(await page.locator('script[data-cf-beacon]').getAttribute("data-cf-beacon")), { token: "2".repeat(32), spa: false });
      assert.equal(await page.locator('meta[name="referrer"]').getAttribute("content"), "strict-origin");
      assert.equal(await page.evaluate(() => window.fixtureInstall()), false);
      await page.locator("#inshell-privacy summary").click();
      const metrics = await page.locator("#inshell-privacy").evaluate(element => ({
        count: document.querySelectorAll("#inshell-privacy").length,
        width: element.getBoundingClientRect().width, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        position: getComputedStyle(element).position,
      }));
      assert.equal(metrics.count, 1); assert.ok(metrics.documentWidth <= metrics.viewport + 1);
      assert.ok(!["fixed", "absolute"].includes(metrics.position));
      await page.screenshot({ path: `${out}/${scenario.name}.png` });
      await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Exclude this browser", exact: true }).click()]);
      await page.locator("#inshell-privacy").waitFor();
      assert.equal(sdkLoads, 1, "excluded reload must not reinstall");
      assert.equal(await page.locator('script[data-cf-beacon]').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem("saved-work-fixture")), "retained");
      assert.equal(await page.evaluate(() => localStorage.getItem("auth-fixture")), "retained");
      await page.locator("#inshell-privacy summary").click();
      await page.getByRole("button", { name: "Remove browser exclusion", exact: true }).click();
      assert.equal(sdkLoads, 1, "removing exclusion does not load in existing document");
      await page.reload();
      await page.locator('script[data-cf-beacon]').waitFor({ state: "attached" });
      assert.equal(sdkLoads, 2, "new eligible document can load after exclusion removal");
      await page.getByRole("link", { name: "THOUGHT", exact: true }).click();
      await page.locator("#inshell-privacy").waitFor();
      assert.equal(await page.locator('script[data-cf-beacon]').count(), 0, "full document departure does not carry SDK to THOUGHT");
      assert.equal(sdkLoads, 2);
      checks.push({ scenario: scenario.name, metrics, withdrawalReload: true, functionalStoragePreserved: true, fullDocumentDepartureExcluded: true });
    } else {
      assert.equal(await page.locator('meta[name="referrer"]').count(), 0, "noneligible policy unchanged");
      checks.push({ scenario: scenario.name, loaded: false });
    }
    await context.close();
  }
  assert.ok(uploads.length > 0, "retained SDK produced intercepted upload attempts");
  for (const upload of uploads) {
    assert.ok(upload.referer === null || upload.referer === "https://inshell.art/");
    assert.doesNotMatch(JSON.stringify(upload.body), /private-fixture|thought\/123|auth-fixture|saved-work-fixture/);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${out}/REPORT.json`, JSON.stringify({ sdkSha256, checks, errors, uploads, requests,
    actualVendorSends: 0, localInterceptionBeforeNavigation: true, browserClosed: true,
    limitation: "Synthetic eligibility/configuration with retained SDK, not live policy/provider or human automation qualification." }, null, 2) + "\n");
}
console.log(JSON.stringify({ checks: checks.length, uploadsIntercepted: uploads.length, actualVendorSends: 0, out }));

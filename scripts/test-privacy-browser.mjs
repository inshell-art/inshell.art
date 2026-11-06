import assert from "node:assert/strict";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, extname, sep } from "node:path";
import { chromium } from "@playwright/test";
import { makeWork, SAVED_KEY } from "../apps/thought/src/plain-return/model.ts";
import { PlainClient } from "../apps/thought/src/plain-return/client.ts";
import { onRequest } from "../functions/_middleware.ts";

// Every document, asset and API response is fulfilled locally BEFORE navigation.
// No live provider/API/Agent request, cookies from existing profiles, or D1.
const root = resolve("dist/home");
const out = resolve(process.env.PRIVACY_TEST_OUTPUT ?? "tmp/privacy-browser");
await mkdir(out, { recursive: true });
assert.equal(execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier",
  "/Applications/Google Chrome.app/Contents/Info.plist"], { encoding: "utf8" }).trim(), "com.google.Chrome");
const values = new Map();
const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const client = new PlainClient(storage, storage, () => { throw Error("No API in this fixture"); });
client.work = makeWork("plain_privacy-fixture-20261101", "Synthetic privacy test", "Kept in this browser.", "2026-11-01T00:00:00.000Z");
client.state = "review";
client.review(); client.save();
const saved = values.get(SAVED_KEY);
assert.ok(saved);
const browser = await chromium.launch({ headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--disable-background-networking", "--disable-component-update", "--disable-sync"] });
const checks = [], unexpected = [], errors = [], requests = [];
try {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      requests.push({ path: url.pathname, method: route.request().method() });
      if (url.origin !== "https://inshell.art") {
        unexpected.push(url.origin + url.pathname); return route.abort();
      }
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/thought-plain/v1/capabilities") return route.fulfill({ status: 200,
          contentType: "application/json", body: JSON.stringify({ schema: "inshell.thought.plain-capabilities.v1", enabled: true, mintEligible: false }) });
        unexpected.push(url.pathname);
        return route.fulfill({ status: 404, contentType: "application/json", body: '{"code":"NOT_FOUND"}' });
      }
      let file = resolve(root, "." + decodeURIComponent(url.pathname));
      assert.ok(file === root || file.startsWith(root + sep));
      try { if ((await stat(file)).isDirectory()) file = resolve(file, "index.html"); }
      catch { file = resolve(root, url.pathname.startsWith("/thought") ? "thought/index.html" : "index.html"); }
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
      if (extname(file) === ".html") {
        const request = new Request(url);
        Object.defineProperty(request, "cf", { value: { country: label === "desktop" ? "US" : "DE" } });
        const response = await onRequest({ request, env: { ASSETS: { fetch: async () => new Response(await readFile(file), {
          headers: { "content-type": "text/html", "cache-control": "public, max-age=60" },
        }) } }, next: async () => { throw Error("Unexpected shell fallthrough"); } });
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      }
      await route.fulfill({ status: 200, contentType: types[extname(file)] ?? "application/octet-stream", body: await readFile(file) });
    });
    await context.addInitScript(({ key, saved }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, saved);
      if (localStorage.getItem("auth-fixture") === null) localStorage.setItem("auth-fixture", "retained");
    }, { key: SAVED_KEY, saved });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push({ label, message: error.message }));
    page.setDefaultTimeout(10000);
    for (const path of ["/", "/path", "/docs/wallet-local-data", "/thought"]) {
      await page.goto("https://inshell.art" + path);
      const panel = page.locator("#inshell-privacy");
      await panel.waitFor();
      assert.equal(await page.locator('meta[name="inshell-measurement-region"]').getAttribute("content"),
        label === "desktop" && path === "/" ? "eligible" : "off");
      assert.equal(await panel.getAttribute("open"), null);
      assert.equal(await page.locator("#inshell-ga4-choice").count(), 0);
      await panel.locator("summary").click();
      await panel.getByRole("button", { name: "Exclude this browser", exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem("inshell.ga4.excluded.v1")), "1");
      assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVED_KEY), saved);
      assert.equal(await page.evaluate(() => localStorage.getItem("auth-fixture")), "retained");
      await panel.getByRole("button", { name: "Remove browser exclusion", exact: true }).click();
      const metrics = await panel.evaluate(element => ({
        count: document.querySelectorAll("#inshell-privacy").length,
        position: getComputedStyle(element).position,
        width: element.getBoundingClientRect().width,
        documentWidth: document.documentElement.scrollWidth, viewport: innerWidth,
        scripts: [...document.scripts].map(script => script.src).filter(src => /google-analytics|googletagmanager|cloudflareinsights/.test(src)),
      }));
      assert.equal(metrics.count, 1); assert.ok(!["fixed", "absolute"].includes(metrics.position));
      assert.ok(metrics.documentWidth <= metrics.viewport + 1); assert.equal(metrics.scripts.length, 0);
      await panel.scrollIntoViewIfNeeded();
      const screenshot = `${out}/${label}-${path.replaceAll("/", "_") || "home"}.png`;
      await page.screenshot({ path: screenshot });
      checks.push({ label, path, metrics, screenshot });
    }
    await page.getByRole("button", { name: "Open saved works", exact: true }).click();
    await page.locator("#thought-dock-works-select").selectOption(client.work.runId);
    await page.getByText("Work loaded", { exact: true }).first().waitFor();
    await page.waitForFunction(() => document.querySelector("#thought-svg-preview")?.naturalWidth > 0);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVED_KEY), saved);
    await page.reload();
    await page.getByRole("button", { name: "Open saved works", exact: true }).click();
    await page.locator("#thought-dock-works-select").selectOption(client.work.runId);
    await page.getByText("Work loaded", { exact: true }).first().waitFor();
    await page.waitForFunction(() => document.querySelector("#thought-svg-preview")?.naturalWidth > 0);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), SAVED_KEY), saved);
    assert.equal(await page.evaluate(() => localStorage.getItem("auth-fixture")), "retained");
    await page.screenshot({ path: `${out}/${label}-work-loaded.png`, fullPage: true });
    checks.push({ label, test: "synthetic saved work loads before and after reload", status: "passed" });
    // Required exclusion preference unreadable: controls fail closed, no popup.
    await page.evaluate(() => {
      Storage.prototype.getItem = () => { throw new DOMException("synthetic denial", "SecurityError"); };
      dispatchEvent(new StorageEvent("storage"));
    });
    await page.locator("#inshell-privacy summary").click();
    assert.equal(await page.locator("#inshell-privacy button").isDisabled(), true);
    checks.push({ label, test: "unreadable storage fails closed", status: "passed" });
    await context.close();
  }
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${out}/REPORT.json`, JSON.stringify({ checks, unexpected, errors, requests,
    transport: "all requests intercepted; local assets and actual shell middleware with synthetic US/DE metadata, synthetic capabilities only, other API 404; no route.continue",
    actualVendorSends: 0, browserClosed: true }, null, 2) + "\n");
}
console.log(JSON.stringify({ checks: checks.length, unexpected, errors, out }));

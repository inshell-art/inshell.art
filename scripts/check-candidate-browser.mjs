#!/usr/bin/env node
// Real local-browser acceptance for the composed Studio Preview build.
// External requests are blocked; this is not a hosted Agent/wallet canary.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.CANDIDATE_BASE_URL || "http://127.0.0.1:4175");
assert.ok(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname),
  "This local check must not run against a hosted deployment");
const output = path.join(root, "tmp/candidate-browser");
await mkdir(output, { recursive: true });
const metadata = JSON.parse(await readFile(path.join(root,
  "packages/shared/generated/docs-route-metadata.json"), "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
const coverage = new Map();
const failures = [];
let active = "";
const recordFailure = (kind, detail) => failures.push({ check: active, kind, detail });

async function check(name, body) {
  active = name;
  try {
    await body();
    results.push({ name, status: "PASS" });
  } catch (error) {
    results.push({ name, status: "FAIL", error: error.message });
    recordFailure("assertion", error.message);
  }
  console.log(results.at(-1).status + " " + name);
}

try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "light", serviceWorkers: "block" });
    await context.addInitScript(() => {
      window.__candidateWalletRequests = [];
      window.ethereum = {
        isMetaMask: true,
        on() {}, removeListener() {},
        async request(request) {
          window.__candidateWalletRequests.push(request.method);
          throw new Error("Candidate acceptance: wallet request prohibited");
        },
      };
    });
    await context.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (["data:", "blob:"].includes(requestUrl.protocol)) return route.continue();
      if (requestUrl.origin !== base.origin) {
        recordFailure("external-request", requestUrl.origin + requestUrl.pathname);
        return route.abort("blockedbyclient");
      }
      if (requestUrl.pathname.startsWith("/api/")) {
        recordFailure("unexpected-api-request", requestUrl.pathname);
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.setDefaultNavigationTimeout(12000);
    page.on("pageerror", (error) => recordFailure("page-error", error.message));
    page.on("requestfailed", (request) => recordFailure("failed-request",
      request.url() + " " + request.failure()?.errorText));
    page.on("response", (response) => {
      if (response.status() >= 400) recordFailure("http-error", response.status() + " " + response.url());
    });

    const surface = async (selector) => {
      await page.locator(selector).first().waitFor({ state: "visible" });
      assert.equal(new URL(page.url()).origin, base.origin, "navigation left the local candidate");
      assert.deepEqual(await page.evaluate(() => window.__candidateWalletRequests), [],
        "a page requested wallet access or RPC");
      const geometry = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(geometry.scrollWidth <= geometry.width + 1, "horizontal page overflow");
      assert.ok((await page.locator("body").innerText()).includes("PREVIEW"), "missing preview watermark");
      const links = await page.locator("a[href]:visible").evaluateAll((anchors) => anchors.map((a) => ({
        href: a.getAttribute("href"), resolved: a.href, text: a.innerText.trim(),
      })));
      for (const link of links) {
        if (!link.href || link.href === "#" || !/^https?:/.test(link.resolved)) continue;
        const target = new URL(link.resolved);
        if (target.origin === base.origin) coverage.set(target.pathname + target.search + target.hash, link.text);
        if (["thought.inshell.art", "gallery.inshell.art",
          "thought.preview.inshell.art", "gallery.preview.inshell.art"].includes(target.hostname)) {
          recordFailure("legacy-product-link", link.resolved);
        }
      }
    };
    const visit = async (route, selector) => {
      const response = await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      await surface(selector);
    };
    const click = async (selector, target, marker) => {
      await page.locator(selector).first().click();
      await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === target.replace(/\/$/, ""));
      await page.waitForLoadState("networkidle");
      await surface(marker);
    };

    await check(label + ": Home -> THOUGHT -> reload -> back -> forward", async () => {
      await visit("/", ".ecosystem-home");
      await click('a[aria-label="THOUGHT"]', "/thought", "#thought-dock-prompt");
      await page.reload({ waitUntil: "networkidle" });
      await surface("#thought-dock-prompt");
      await page.goBack({ waitUntil: "networkidle" });
      await surface(".ecosystem-home");
      await page.goForward({ waitUntil: "networkidle" });
      await surface("#thought-dock-prompt");
    });
    await check(label + ": shared topbar navigation", async () => {
      await visit("/thought", "#thought-dock-prompt");
      await click('a.inshell-topbar__link[title="permission token"]', "/path", ".path-page");
      await click('a.inshell-topbar__link[title="Inshell docs"]', "/docs", ".docs-page");
      await click("a.inshell-topbar__brand", "/", ".ecosystem-home");
      await click('a[aria-label="WILL"]', "/will", ".will-page");
      await click("a.inshell-topbar__brand", "/", ".ecosystem-home");
    });
    await check(label + ": Home AWA guidance", async () => {
      await visit("/", ".ecosystem-home");
      const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
        const message = dialog.message();
        await dialog.accept();
        assert.equal(message, "AWA!");
      });
      await Promise.all([
        dialogPromise,
        page.getByRole("button", { name: "AWA!", exact: true }).click(),
      ]);
    });
    for (const [route, marker] of [
      ["/", ".ecosystem-home"], ["/path", ".path-page"], ["/thought", "#thought-dock-prompt"],
    ]) {
      await check(label + ": guidance-only wallet on " + route, async () => {
        await visit(route, marker);
        await page.locator("button.inshell-topbar__wallet").click();
        await page.getByRole("dialog").waitFor({ state: "visible" });
        assert.match(await page.getByRole("dialog").innerText(), /THOUGHT/);
        assert.deepEqual(await page.evaluate(() => window.__candidateWalletRequests), []);
      });
    }
    await check(label + ": Docs topic links and contents fragment", async () => {
      await visit("/docs", ".docs-page");
      await click('.docs-page__menu a[href="/docs/glossary"]', "/docs/glossary", ".docs-page");
      assert.match(await page.title(), /Glossary/);
      const anchors = page.locator('.docs-page__content a[href*="#"]:visible');
      assert.ok(await anchors.count(), "expected a Glossary cross-article fragment link");
      const href = await anchors.first().getAttribute("href");
      const target = new URL(href, base);
      assert.equal(target.origin, base.origin, "article navigation must remain same-origin");
      await anchors.first().click();
      await page.waitForURL((url) => url.pathname === target.pathname && url.hash === target.hash);
      await page.waitForLoadState("networkidle");
      const fragment = decodeURIComponent(target.hash.slice(1));
      assert.ok(fragment);
      await page.locator('[id="' + fragment + '"]').first().waitFor({ state: "attached" });
    });

    const routes = [
      ["/", ".ecosystem-home"], ["/path", ".path-page"], ["/path/", ".path-page"],
      ["/will", ".will-page"], ["/pulse", '#pulse-page-title'], ["/pulse?raw=1", '#pulse-page-title'],
      ["/color-font", ".color-font-page"],
      ["/verify", ".verify-page"], ["/docs", ".docs-page"], ["/gallery", ".ecosystem-home"],
      ["/gallery/", ".ecosystem-home"], ["/thought", "#thought-dock-prompt"],
      ["/thought/", "#thought-dock-prompt"], ["/thought?new=1", "#thought-dock-prompt"],
      ["/thought/plugin", "#plugin-page"], ["/thought/plugin/codex", "#plugin-page"],
      ["/thought/plugin/claude", "#plugin-page"], ["/thought/agent-demo", "#agent-demo-page"],
      ["/thought/color-font", "#color-font-page"], ["/thought/verify", "#verify-page"],
      ["/path/1", ".path-detail-page"], ["/thought/1", "#thought-detail-status"],
      ["/works?review=1#kept", ".ecosystem-home"], ["/path-app?review=1", ".path-page"],
      ...Object.keys(metadata.topics).map((slug) => ["/docs/" + slug, ".docs-page"]),
    ];
    for (const [route, marker] of routes) {
      await check(label + ": route " + route, async () => {
        await visit(route, marker);
        if (route.startsWith("/docs/")) {
          assert.equal(await page.title(), metadata.topics[route.slice(6)].title + " — docs — Inshell");
        }
        if (route === "/thought/1") {
          assert.equal(await page.locator("#thought-page").isVisible(), true);
          assert.equal(await page.locator("#thought-detail-token-id").innerText(), "1");
          assert.equal(await page.locator("#thought-detail-status").innerText(),
            "Onchain THOUGHT details will appear when minting opens.");
          assert.equal(await page.locator("#thought-dock-prompt").isVisible(), false);
        }
        if (route.startsWith("/works")) assert.equal(new URL(page.url()).pathname, "/gallery");
        if (route.startsWith("/path-app")) assert.equal(new URL(page.url()).pathname, "/path");
        if (route.includes("review=1")) assert.equal(new URL(page.url()).searchParams.get("review"), "1");
        if (route.includes("#kept")) assert.equal(new URL(page.url()).hash, "#kept");
      });
    }
    for (const slug of Object.keys(metadata.topics)) {
      await check(label + ": click Docs topic " + slug, async () => {
        await visit("/docs", ".docs-page");
        await click('.docs-page__menu a[href="/docs/' + slug + '"]', "/docs/" + slug, ".docs-page");
        assert.equal(await page.title(), metadata.topics[slug].title + " — docs — Inshell");
      });
    }
    for (const [name, route, marker] of [
      ["home", "/", ".ecosystem-home"], ["thought", "/thought", "#thought-dock-prompt"],
      ["path", "/path", ".path-page"], ["docs", "/docs/glossary", ".docs-page"],
      ["gallery", "/gallery", ".ecosystem-home"], ["will", "/will", ".will-page"],
      ["thought-detail", "/thought/1", "#thought-detail-status"],
    ]) {
      await check(label + ": screenshot " + name, async () => {
        await visit(route, marker);
        await page.screenshot({ path: path.join(output, label + "-" + name + ".png") });
      });
    }
    await context.close();
  }
  // Check all discovered same-origin content links, including structured Docs
  // and protocol downloads. Do not follow an accidental external redirect.
  for (const [link] of coverage) {
    await check("HTTP linked content " + link, async () => {
      const url = new URL(link, base);
      assert.ok(!url.pathname.startsWith("/api/"), "live APIs are outside this local content check");
      const response = await fetch(url, { redirect: "manual" });
      assert.equal(response.status, 200);
      const body = await response.text();
      if (url.pathname.endsWith(".json")) {
        assert.match(response.headers.get("content-type"), /^application\/(?:json|schema\+json)(?:;|$)/);
        JSON.parse(body);
      } else if (url.pathname.endsWith(".md")) {
        assert.ok(!/^\s*<!doctype html/i.test(body), "Markdown link returned the app shell");
        assert.ok(body.trim().length > 0);
      }
    });
  }
  for (const missing of ["/not-a-product-page", "/assets/does-not-exist.js",
    "/thought/assets/does-not-exist.js", "/api/does-not-exist"]) {
    await check("HTTP missing path " + missing, async () => {
      const response = await fetch(new URL(missing, base), { redirect: "manual" });
      assert.equal(response.status, 404, "unknown paths must not be a successful Home fallback");
      assert.ok(!(await response.text()).includes('<div id="root">'), "404 must not load Home");
    });
  }
} finally {
  await browser.close();
  const report = {
    scope: "Local composed Studio Preview: real browser navigation, route matrix, guidance controls, responsive geometry",
    baseUrl: base.href,
    results, failures,
    discoveredLocalLinks: [...coverage].map(([url, text]) => ({ url, text })),
    limitations: [
      "No hosted deployment or production-host routing attestation",
      "No real Agent session, wallet, transaction, RPC or contract interaction",
      "External/API requests are blocked and recorded as failures, not simulated successes",
      "Screenshots require separate visual inspection",
    ],
  };
  await writeFile(path.join(output, "REPORT.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ checks: results.length, failures: failures.length, output }));
  if (failures.length) process.exitCode = 1;
}

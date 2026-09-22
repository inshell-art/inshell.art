import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Local-only automated integration test. No Agent runs or issue submissions.
const base = "http://127.0.0.1:5174";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
      if (!route.request().url().startsWith(base + "/")) return route.abort();
      requests.push({ url: route.request().url(), method: route.request().method() });
      return route.continue();
    });
    await page.addInitScript(() => {
      window.testCopies = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (text) => { window.testCopies.push(text); },
      } });
    });
    await page.goto(base + "/thought/?report-test=1");
    await page.locator("#simulate-report-failure").click();
    const reportAction = page.getByRole("button", { name: "Review a sanitized problem report" });
    assert.equal(await reportAction.count(), 1);
    assert.equal(await reportAction.evaluate((node) => node.closest("[data-console-kind]")?.getAttribute("data-console-kind")), "work_run_failed");
    assert.equal(await page.locator('[data-console-kind="work_run_failed"]').getByRole("button", { name: "Start a new Agent run" }).count(), 1);
    await reportAction.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/private/tmp/thought-report-console-${viewport.width}.png` });
    await page.getByRole("button", { name: "Review a sanitized problem report" }).click();
    const dialog = page.getByRole("dialog");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "failure-report-title");
    assert.equal(await page.locator("dialog details").count(), 0);
    await page.getByRole("textbox", { name: "Agent version (optional)" }).fill("test-version");
    const summary = page.getByRole("textbox", { name: "Sanitized report preview" });
    assert.match(await summary.inputValue(), /simulated local UI test/);
    await page.getByRole("textbox", { name: "Description (optional)" }).fill("Test only\nBearer SECRET\nhttps://example.invalid/?token=PRIVATE\n<script>window.bad=true</script>");
    const text = await summary.inputValue();
    assert.ok(!text.includes("SECRET") && !text.includes("PRIVATE"));
    assert.equal(await page.evaluate(() => window.bad), undefined);
    const link = new URL(await page.getByRole("link", { name: "Continue to GitHub ↗" }).getAttribute("href"));
    assert.equal(link.origin, "https://github.com");
    assert.equal(link.pathname, "/inshell-art/inshell.art/issues/new");
    assert.equal(link.searchParams.get("body"), text);
    assert.deepEqual(await page.evaluate(() => window.testCopies), []);
    assert.equal(await page.getByRole("button", { name: "Copy report", exact: true }).count(), 0);
    assert.equal(await dialog.locator(".report-actions > *").count(), 2);
    const geometry = await dialog.boundingBox();
    assert.ok(geometry.x >= 0 && geometry.x + geometry.width <= viewport.width);
    assert.ok(geometry.y >= 0 && geometry.y + geometry.height <= viewport.height);
    await page.screenshot({ path: `/private/tmp/thought-report-${viewport.width}.png` });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("dialog").waitFor({ state: "detached" });
    assert.equal(await page.locator("dialog").count(), 0);
    await page.getByRole("button", { name: "Review a sanitized problem report" }).click();
    await page.keyboard.press("Escape");
    await page.locator("dialog").waitFor({ state: "detached" });
    assert.equal(await page.locator("dialog").count(), 0);
    assert.equal(requests.filter((request) => request.method !== "GET").length, 0);
    await page.getByRole("button", { name: "Reset THOUGHT Dock and clear input", exact: true }).click();
    assert.equal(await reportAction.count(), 1);
    await reportAction.click();
    assert.match(await summary.inputValue(), /simulated local UI test/);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("dialog").waitFor({ state: "detached" });
    await page.locator("#simulate-report-failure").click();
    assert.equal(await reportAction.count(), 2);
    await reportAction.last().click();
    assert.match(await summary.inputValue(), /simulated local UI test/);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator("dialog").waitFor({ state: "detached" });
    await reportAction.last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/private/tmp/thought-report-history-${viewport.width}.png` });
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.testCopies), []);
    await page.goto(base + "/thought/");
    assert.equal(await page.locator("#simulate-report-failure").count(), 0);
    assert.equal(await reportAction.count(), 2);
    await reportAction.last().click();
    assert.match(await summary.inputValue(), /Agent: unknown/);
    console.log(JSON.stringify({ testKind: "automated-integration", viewport, passed: true, realAgentExecuted: false, reportsSent: 0 }));
    await context.close();
  }
} finally { await browser.close(); }

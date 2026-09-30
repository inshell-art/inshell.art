import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.PLAIN_TEST_ORIGIN ?? "http://127.0.0.1:5192";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = process.env.PLAIN_COMPAT_OUTPUT ?? "/private/tmp/plain-replacement-compatibility";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const requests = [], errors = [];
const pendingKeys = ["thought-agent-pending-run", "thought:dock:pending-agent-run:v2", "thought:dock:pending-agent-launch:v1"];
const historicalBytes = JSON.stringify([{ id: 1, prompt: "Past?", returnedText: "One.", text: "One.", title: "Past?", rawOutput: "One.", image: "", route: "agent-v2", provider: "codex", model: "unknown", createdAt: "2026-09-24T00:00:00.000Z", runContext: { mode: "codex", provider: "codex", model: "unknown", prompt: "Past?", clientGeneratedAt: "2026-09-24T00:00:00.000Z" } }]);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || (url.pathname.startsWith("/api/") && !url.pathname.endsWith("/thought-plain/v1/capabilities"))) {
      requests.push(url.pathname); return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${origin}/thought/`);
  await page.getByRole("button", { name: "Send to your Agent" }).waitFor();
  await page.evaluate(({ bytes, keys }) => {
    localStorage.setItem("thought-works", bytes);
    for (const key of keys) sessionStorage.setItem(key, "synthetic earlier task remains untouched");
  }, { bytes: historicalBytes, keys: pendingKeys });
  for (const suffix of ["/thought", "/thought/", "/thought/?transport=plain", "/thought/?transport=legacy", "/thought/?surface=cli"]) {
    await page.goto(origin + suffix);
    await page.getByRole("button", { name: "Open saved works", exact: true }).click();
    await page.locator("#thought-dock-works-select").selectOption("historical:1");
    await page.locator(".thought-dock-status-screen__entry.is-latest").getByText("Earlier work loaded", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Send to your Agent" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Save", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Export artwork record without credentials" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /^Mint/ }).count(), 0);
    const input = page.locator("#thought-dock-prompt");
    await input.press("ArrowUp"); await input.press("Control+Enter");
    assert.equal(await input.inputValue(), "Past?");
    assert.equal(await page.evaluate(() => localStorage.getItem("thought-works")), historicalBytes);
    for (const key of pendingKeys) assert.equal(await page.evaluate(key => sessionStorage.getItem(key), key), "synthetic earlier task remains untouched");
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.querySelector("#thought-svg-preview")?.naturalWidth > 0);
  const geometry = await page.evaluate(() => {
    const frame = document.querySelector(".thought-canvas-frame").getBoundingClientRect();
    return { width: frame.width, height: frame.height, overflow: document.documentElement.scrollWidth > innerWidth, images: document.querySelectorAll("#thought-svg-preview:not(.is-hidden)").length };
  });
  assert.ok(Math.abs(geometry.width - geometry.height) < 2 && geometry.width > 250);
  assert.equal(geometry.overflow, false); assert.equal(geometry.images, 1);
  await page.screenshot({ path: `${out}/historical-read-only.png`, fullPage: true });
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ syntheticOnly: true, routes: 5, geometry, unexpectedRequests: requests, errors, legacyStoreUnchanged: true, pendingStoreUnchanged: true, nativeLaunches: 0 }, null, 2));
  console.log(`PASS: default/old-query links and read-only historical works; ${out}`);
} finally { await browser.close(); }

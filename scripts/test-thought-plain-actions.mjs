import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { makeWork, PENDING_KEY } from "../apps/thought/src/plain-return/model.ts";

// Exercise the emitted HTML and its real JS/CSS graph, never a copied presenter.
// Every API call is fulfilled with synthetic data; no server/Agent is contacted.
const root = path.resolve(process.env.ACTION_BUILD_ROOT ?? "dist/home");
const out = process.env.ACTION_OUTPUT ?? "tmp/plain-actions/after";
const observe = process.env.ACTION_OBSERVE === "1";
const dev = process.env.ACTION_DEV_ORIGIN;
const origin = dev ?? "http://127.0.0.1:5191";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const records = [], failures = [];
function check(name, actual, expected) {
  try { assert.deepEqual(actual, expected); } catch { failures.push({ name, actual, expected }); }
}
try {
  for (const theme of ["light", "dark"]) for (const [width, height] of [[1496, 823], [1920, 720], [1280, 900], [1024, 768], [768, 900], [390, 844]]) {
    const name = `${theme}-${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    const work = makeWork("plain_action-fixture", "Synthetic?", "One.", "2026-10-01T00:00:00.000Z");
    let creates = 0;
    const external = [], errors = [], missing = [], unexpectedApi = [], cssLoaded = [];
    await context.addInitScript(({ key, work }) => {
      sessionStorage.setItem(key, JSON.stringify({ runId: work.runId, promptLine: work.promptLine, browserToken: "a".repeat(43), readExpiresAt: Date.now() + 3600000 }));
    }, { key: PENDING_KEY, work });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
      if (url.pathname.startsWith("/api/")) {
        if (!url.pathname.startsWith("/api/thought-plain/v1/")) {
          unexpectedApi.push(url.pathname); return route.abort();
        }
        if (url.pathname.endsWith("/capabilities")) return route.fulfill({ json: { schema: "inshell.thought.plain-capabilities.v1", enabled: true, mintEligible: false } });
        if (route.request().method() === "POST") {
          creates++;
          return route.fulfill({ json: { runId: "plain_next-fixture", promptLine: route.request().postDataJSON().promptLine, browserToken: "a".repeat(43), readExpiresAt: Date.now() + 3600000, handoff: "Synthetic only. Do not launch." } });
        }
        return route.fulfill({ json: { runId: work.runId, state: "returned", conflict: false, work } });
      }
      if (dev) return route.continue();
      const relative = url.pathname.replace(/^\//, "");
      const file = path.resolve(root, relative.endsWith("/") ? `${relative}index.html` : relative);
      assert.ok(file.startsWith(`${root}/`));
      try {
        const contentType = ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" })[path.extname(file)] ?? "application/octet-stream";
        return route.fulfill({ body: await readFile(file), contentType });
      } catch { missing.push(relative); return route.fulfill({ status: 404 }); }
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (r.url().split("?")[0].endsWith(".css")) cssLoaded.push({ url: r.url(), status: r.status() }); });
    const button = label => page.getByRole("button", { name: label, exact: true });
    const capture = async state => {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const geometry = await page.evaluate(() => {
        const group = document.querySelector(".thought-dock-actions");
        const rect = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const controls = [...group.querySelectorAll("button,a")].map(e => {
          const box = rect(e), clippedBy = [];
          for (let p = e.parentElement; p; p = p.parentElement) {
            const c = getComputedStyle(p), r = rect(p);
            if ((/(hidden|clip|auto|scroll)/.test(c.overflowX) && (box.left < r.left - 1 || box.right > r.right + 1)) || (/(hidden|clip|auto|scroll)/.test(c.overflowY) && (box.top < r.top - 1 || box.bottom > r.bottom + 1))) clippedBy.push(p.id || p.className);
          }
          return { text: e.textContent, box, clippedBy };
        });
        const rules = [];
        const visit = sheet => { for (const rule of sheet.cssRules ?? []) { if (rule.selectorText?.includes("thought-dock-actions") && group.matches(rule.selectorText)) rules.push(rule.cssText); if (rule.cssRules) visit(rule); } };
        for (const sheet of document.styleSheets) visit(sheet);
        return { controls, rules, flexWrap: getComputedStyle(group).flexWrap, overflow: getComputedStyle(group).overflow, group: rect(group), rail: rect(group.parentElement), scrollWidth: group.scrollWidth, documentOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      records.push({ name, state, ...geometry });
      check(`${name}/${state}/wrap`, geometry.flexWrap, "wrap");
      check(`${name}/${state}/clipping`, geometry.controls.filter(c => c.clippedBy.length), []);
      check(`${name}/${state}/document-overflow`, geometry.documentOverflow, false);
      check(`${name}/${state}/no-accepted-recheck`, geometry.controls.some(c => c.text === "Check return"), false);
      check(`${name}/${state}/primary-order`, geometry.controls.map(c => c.text), [state === "review" ? "Review complete" : state === "reviewed" ? "Save" : "Saved", "Load", "Reset", "Export work"]);
      await page.screenshot({ path: `${out}/${name}-${state}.png`, fullPage: true });
      if (!observe) {
        await button("Reset").click({ trial: true });
        await button("Open saved works").click({ trial: true });
        // Natural Tab traversal from primary action, not programmatic Reset focus.
        await button("Open saved works").focus(); await page.keyboard.press("Tab");
        check(`${name}/${state}/keyboard-reset`, await button("Reset").evaluate(e => document.activeElement === e), true);
      }
    };
    await page.goto(`${origin}/thought/`);
    await button("Review complete").waitFor();
    await capture("review");
    await button("Review complete").click();
    await capture("reviewed");
    await button("Save").click(); await button("Saved").waitFor();
    await capture("saved");
    if (!observe) {
      const downloadPromise = page.waitForEvent("download");
      await button("Export artwork record without credentials").click();
      const download = await downloadPromise;
      const record = JSON.parse(await readFile(await download.path(), "utf8"));
      check(`${name}/export-work`, record.work, work);
      check(`${name}/export-stage`, record.stage, "saved");
      check(`${name}/export-no-credential`, JSON.stringify(record).includes("a".repeat(43)), false);
      await button("Open saved works").click();
      await page.locator("#thought-dock-works-select").selectOption(work.runId);
      await capture("loaded");
      await button("Open saved works").focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
      const input = page.locator("#thought-dock-prompt");
      check(`${name}/reset-editable`, await input.evaluate(e => !e.readOnly && !e.disabled && e.value === ""), true);
      await input.fill("Next synthetic?");
      if (width > 760) {
        await button("Send to your Agent").click();
        await page.getByRole("link", { name: "Claude", exact: true }).waitFor();
        check(`${name}/new-preparation`, creates, 1);
      } else check(`${name}/mobile-no-launch`, await button("Send to your Agent").count(), 0);
    }
    check(`${name}/external`, external, []); check(`${name}/errors`, errors, []); check(`${name}/missing`, missing, []);
    check(`${name}/unexpected-api`, unexpectedApi, []);
    records.push({ name, cssLoaded, external, errors, missing, unexpectedApi, syntheticCreates: creates, realApiRequests: 0, nativeLaunches: 0 });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${out}/report.json`, JSON.stringify({ root, dev, failures, records }, null, 2));
console.log(JSON.stringify({ out, observations: records.length, failures: failures.length }));
if (!observe) assert.deepEqual(failures, []);

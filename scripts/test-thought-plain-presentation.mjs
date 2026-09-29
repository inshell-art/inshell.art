import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { makeWork } from "../apps/thought/src/plain-return/model.ts";

const origin = process.env.PLAIN_TEST_ORIGIN ?? "http://127.0.0.1:5190";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = process.env.PLAIN_PRESENTATION_OUTPUT ?? "tmp/plain-presentation-20260929/checked";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const records = [];
const states = [];
try {
  for (const mode of ["formal", "plain"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const external = [], api = [], fonts = [], errors = [];
    let sequence = 0, status = "pending", currentWork = null, rejectRead = false, rejectCreate = false;
    let releaseCreate;
    let createGate = Promise.resolve();
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
      if (url.pathname.startsWith("/api/")) {
        api.push({ path: url.pathname, method: route.request().method() });
        if (url.pathname.endsWith("/thought-plain/v1/capabilities")) return route.fulfill({ json: { schema: "inshell.thought.plain-capabilities.v1", enabled: true, mintEligible: false } });
        if (url.pathname === "/api/thought-plain/v1/runs" && route.request().method() === "POST") {
          if (rejectCreate) return route.abort();
          sequence++;
          const prompt = route.request().postDataJSON().promptLine;
          const id = `plain_fixture-${sequence}`;
          currentWork = makeWork(id, prompt, '"One."', "2026-09-29T00:00:00.000Z");
          status = "pending";
          await createGate;
          return route.fulfill({ status: 201, json: { runId: id, promptLine: prompt, browserToken: "a".repeat(43), readExpiresAt: Date.now() + 3600000, handoff: "Synthetic UI fixture. Never launch an Agent." } });
        }
        if (url.pathname.startsWith("/api/thought-plain/v1/runs/") && currentWork) {
          if (rejectRead) return route.abort();
          if (route.request().method() === "DELETE") status = "cancelled";
          return route.fulfill({ json: { runId: currentWork.runId, state: status === "conflict" ? "returned" : status,
            conflict: status === "conflict", work: ["returned", "conflict"].includes(status) ? currentWork : null } });
        }
        return route.fulfill({ status: 404, json: { code: "SYNTHETIC_ONLY" } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    // Force every event into one timestamp bucket without stopping polling.
    // Failure -> success ordering must follow append order, not tone priority.
    await page.clock.setFixedTime(new Date("2026-09-29T10:00:00.000Z"));
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", r => { if (/woff2?(?:\?|$)/.test(r.url())) fonts.push({ path: new URL(r.url()).pathname, status: r.status() }); });
    await page.goto(`${origin}/thought/?surface=agent${mode === "plain" ? "&transport=plain" : ""}`);
    await page.locator(".thought-dock-status-screen__entry").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => {
      const read = selector => {
        const el = document.querySelector(selector), s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { font: s.fontFamily, weight: s.fontWeight, size: s.fontSize, lineHeight: s.lineHeight, x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return { title: read(".thought-create__title"), prompt: read("#thought-dock-prompt"), console: read("#thought-dock-details"),
        consoleEntries: document.querySelectorAll(".thought-dock-status-screen__entry").length,
        buttons: [...document.querySelectorAll("#thought-dock-action-area button")].map(el => ({ text: el.textContent, disabled: el.disabled })),
        fontFaces: [...document.fonts].filter(f => f.family.includes("Source Code Pro")).map(f => ({ weight: f.weight, status: f.status })),
      };
    });
    await page.screenshot({ path: `${out}/${mode}-idle.png`, fullPage: true });
    const load = page.getByRole("button", { name: "Open saved works", exact: true });
    await load.click();
    await page.locator("#thought-dock-works:not(.is-hidden)").waitFor();
    assert.equal(await page.locator("#thought-dock-works-select").isDisabled(), true);
    const loadStyle = await page.locator("#thought-dock-works-select").evaluate(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, height: r.height, width: r.width };
    });
    await page.screenshot({ path: `${out}/${mode}-load.png`, fullPage: true });
    await page.getByRole("button", { name: "Collapse saved works", exact: true }).click();
    if (mode === "plain") {
      const latest = () => page.locator(".thought-dock-status-screen__entry.is-latest");
      const heading = name => latest().getByText(name, { exact: true });
      const first = () => page.locator(".thought-dock-status-screen__entry").first();
      const button = name => page.getByRole("button", { name, exact: true });
      const capture = async name => {
        await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
        const value = await page.evaluate(() => ({
          firstIsLatest: document.querySelector(".thought-dock-status-screen__entry").classList.contains("is-latest"),
          title: document.querySelector(".is-latest .thought-dock-status-screen__line--heading").textContent,
          lines: [...document.querySelectorAll(".is-latest p")].map(p => ({ text: p.textContent, classes: p.className })),
          entries: document.querySelectorAll(".thought-dock-status-screen__entry").length,
          actions: [...document.querySelectorAll("#thought-dock-action-area button, #thought-dock-action-area a")].map(e => e.textContent),
          mintVisible: Boolean(document.querySelector("#thought-dock-path:not(.is-hidden)")),
        }));
        assert.match(value.title, /^\[\d{2}:\d{2}:\d{2}\] /);
        assert.equal(value.firstIsLatest, true, `${name}: actual current state is first rendered`);
        assert.equal(value.mintVisible, false);
        await page.screenshot({ path: `${out}/plain-${name}.png`, fullPage: true });
        states.push({ name, ...value });
      };
      assert.equal(await button("Send to your Agent").isDisabled(), true);
      // Even an artificial event bypassing the disabled UI cannot submit empty bytes.
      await button("Send to your Agent").dispatchEvent("click");
      await first().getByText("Prompt is empty", { exact: true }).waitFor();
      assert.equal(sequence, 0);
      await page.locator("#thought-dock-prompt").fill("🙂");
      await button("Send to your Agent").click();
      await heading("Unsupported characters").waitFor();
      assert.equal(sequence, 0);
      await capture("invalid");
      await page.locator("#thought-dock-prompt").fill("Hello?");
      createGate = new Promise(resolve => { releaseCreate = resolve; });
      await button("Send to your Agent").click();
      await heading("Preparing task").waitFor();
      await capture("preparing");
      releaseCreate();
      createGate = Promise.resolve();
      await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
      await capture("waiting");
      await page.reload();
      await button("Check return").waitFor();
      assert.equal(await page.getByRole("link", { name: "ChatGPT", exact: true }).count(), 0);
      status = "returned";
      await heading("Return received").waitFor();
      await page.waitForFunction(() => document.querySelector("#thought-svg-preview").naturalWidth > 0);
      await capture("received");
      await button("Review complete").click();
      await heading("Work reviewed").waitFor();
      await capture("reviewed");
      await page.evaluate(() => {
        window.originalSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) { if (k === "inshell.thought.plain-http.works.v1") throw Error("Synthetic storage refusal"); return window.originalSet.call(this, k, v); };
      });
      await button("Save").click();
      await heading("Work not saved").waitFor();
      assert.ok(!(await latest().textContent()).includes("Edit the prompt"));
      await latest().getByRole("button", { name: "Review a sanitized problem report" }).click();
      await page.getByRole("dialog").waitFor();
      const report = await page.getByRole("textbox", { name: "Sanitized report preview" }).inputValue();
      assert.ok(!report.includes("Hello?") && !report.includes("One.") && !report.includes("a".repeat(43)));
      await page.screenshot({ path: `${out}/plain-failure-report.png`, fullPage: true });
      await button("Close").click();
      await capture("save-error");
      await page.evaluate(() => { Storage.prototype.setItem = window.originalSet; });
      await button("Save").click();
      await heading("Work saved").waitFor();
      await first().getByText("Work saved", { exact: true }).waitFor();
      assert.equal(await page.getByText("Work not saved", { exact: true }).count(), 1);
      assert.equal(await button("Saved").isDisabled(), true);
      assert.ok(!(await latest().textContent()).includes("next:"));
      const savedBytes = await page.evaluate(() => localStorage.getItem("inshell.thought.plain-http.works.v1"));
      await capture("saved");
      await button("Reset").click();
      await capture("reset");
      await button("Open saved works").click();
      await page.evaluate(() => {
        window.originalRemove = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function(k) { if (k === "inshell.thought.plain-http.pending.v1") throw Error("Synthetic storage refusal"); return window.originalRemove.call(this, k); };
      });
      await page.locator("#thought-dock-works-select").selectOption({ label: "Hello?" });
      await heading("Work not loaded").waitFor();
      assert.ok(!(await latest().textContent()).includes("Edit the prompt"));
      await capture("load-error");
      await page.evaluate(() => { Storage.prototype.removeItem = window.originalRemove; });
      await page.locator("#thought-dock-works-select").selectOption({ label: "Hello?" });
      await heading("Work loaded").waitFor();
      await first().getByText("Work loaded", { exact: true }).waitFor();
      assert.equal(await page.getByText("Work not loaded", { exact: true }).count(), 1);
      assert.equal(await page.locator(".thought-dock-status-screen__entry").filter({ hasText: "Work not loaded" }).getByRole("button", { name: "Review a sanitized problem report" }).count(), 1);
      await capture("loaded");
      assert.equal(await page.evaluate(() => localStorage.getItem("inshell.thought.plain-http.works.v1")), savedBytes);
      assert.equal(await page.evaluate(() => localStorage.getItem("thought-works")), null);
      for (const width of [390, 924, 1496]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: width === 1496 ? "dark" : "light" });
        await capture(`loaded-${width}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await button("Reset").click();
      await page.locator("#thought-dock-prompt").fill("Wait?");
      await button("Send to your Agent").click();
      await page.getByRole("link", { name: "Claude", exact: true }).waitFor();
      rejectRead = true;
      await heading("Delivery uncertain").waitFor();
      const beforeUncertain = sequence;
      await capture("uncertain");
      assert.equal(await button("Reset").count(), 0);
      assert.equal(await button("Open saved works").count(), 0);
      assert.equal(await button("Send to your Agent").count(), 0);
      rejectRead = false;
      await button("Cancel").click();
      await heading("Task cancelled").waitFor();
      await capture("cancelled");
      assert.equal(sequence, beforeUncertain);
      await button("Reset").click();
      rejectCreate = true;
      await page.locator("#thought-dock-prompt").fill("Uncertain?");
      await button("Send to your Agent").click();
      await heading("Preparation uncertain").waitFor();
      await capture("preparation-uncertain");
      assert.equal(await button("Reset").count(), 0);
      assert.equal(await button("Check return").count(), 0);
      assert.equal(await button("Open saved works").count(), 0);
    }
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    records.push({ mode, metrics, loadStyle, fonts, external, mockedApi: api, errors });
    await context.close();
  }
  const [formal, plain] = records;
  for (const key of ["title", "prompt", "console"]) assert.deepEqual(plain.metrics[key], formal.metrics[key], `${key}: formal geometry/type parity`);
  assert.deepEqual(plain.loadStyle, formal.loadStyle);
  assert.deepEqual(plain.metrics.buttons, formal.metrics.buttons, "Initial control labels and disabled states match");
  assert.ok(plain.fonts.some(f => f.path.includes("latin-200-normal") && f.status === 200));
  assert.equal(plain.metrics.consoleEntries, 1);
  await writeFile(`${out}/comparison.json`, JSON.stringify({ syntheticOnly: true, realApiRequests: 0, nativeLaunches: 0, records, states }, null, 2) + "\n");
  console.log(JSON.stringify({ out, states: states.map(s => s.name), parity: true, realApiRequests: 0, nativeLaunches: 0 }));
} finally { await browser.close(); }

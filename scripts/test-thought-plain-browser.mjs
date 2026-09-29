import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.PLAIN_TEST_ORIGIN ?? "http://127.0.0.1:5190";
const disabledOrigin = process.env.PLAIN_TEST_DISABLED_ORIGIN ?? "http://127.0.0.1:5191";
for (const value of [origin, disabledOrigin]) assert.match(value, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = resolve(process.env.PLAIN_TEST_OUTPUT ?? "tmp/plain-return-browser");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const external = [], errors = [], requests = [];
await context.route("**/*", route => {
  const url = new URL(route.request().url());
  if ([origin, disabledOrigin].includes(url.origin)) return route.continue();
  external.push(url.origin); return route.abort();
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => requests.push({ path: new URL(request.url()).pathname, method: request.method() }));
const metrics = async () => page.evaluate(() => {
  const canvas = document.querySelector(".thought-canvas-frame").getBoundingClientRect();
  const panel = document.querySelector("#thought-panel").getBoundingClientRect();
  const image = document.querySelector("#thought-svg-preview");
  const controls = [...document.querySelectorAll("#thought-dock-action-area button, #thought-dock-action-area a, #thought-dock-action-area select")];
  return {
    viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
    canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
    panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
    controls: controls.map(control => ({ text: control.textContent, width: control.getBoundingClientRect().width,
      contained: control.getBoundingClientRect().right <= panel.right && control.getBoundingClientRect().left >= panel.left,
      font: getComputedStyle(control).fontFamily })),
    imageLoaded: image.naturalWidth > 0, imageCount: document.querySelectorAll("#thought-svg-preview:not(.is-hidden)").length,
    watermarkCount: document.querySelectorAll(".inshell-preview-watermark").length,
    mintVisible: Boolean(document.querySelector("#thought-dock-path:not(.is-hidden)")),
    console: document.querySelector("#thought-dock-details-body").textContent,
  };
});
try {
  await page.goto(`${origin}/thought/?transport=plain&surface=agent`);
  await page.getByRole("button", { name: "Send to your Agent" }).waitFor();
  await page.locator("#thought-dock-prompt").fill("Hello?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
  assert.ok((await page.locator("#thought-dock-details-body").textContent()).includes('fresh chat with "No folder"'));
  const codexLink = await page.getByRole("link", { name: "ChatGPT", exact: true }).getAttribute("href");
  const claudeLink = await page.getByRole("link", { name: "Claude", exact: true }).getAttribute("href");
  const task = new URL(codexLink).searchParams.get("prompt");
  assert.equal(new URL(claudeLink).searchParams.get("q"), task);
  assert.ok(task.includes("PHASE 1 — CREATE ONCE") && task.includes("do not regenerate or automatically resend"));
  const bytes = Buffer.byteLength(task);
  const url = /^URL: (.+)$/m.exec(task)[1], authorization = /^Authorization: (.+)$/m.exec(task)[1];
  assert.equal(new URL(url).origin, origin);
  // No click on either native app link and no live Agent. Preserve the in-memory
  // synthetic sender while the real product browser loses its launch packet.
  await page.reload();
  await page.getByRole("button", { name: "Check return" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "ChatGPT", exact: true }).count(), 0);
  const response = await fetch(url, { method: "POST", headers: { Authorization: authorization, "Content-Type": "text/plain; charset=utf-8" }, body: '"One."', redirect: "error" });
  assert.equal(response.status, 200);
  // Deliberately don't use the acknowledgement to feed the UI: polling owns it.
  await response.body.cancel();
  await page.getByRole("button", { name: "Review complete" }).waitFor();
  const statusReads = () => requests.filter(request => request.method === "GET" && request.path.startsWith("/api/thought-plain/v1/runs/")).length;
  const reviewReads = statusReads();
  await page.waitForTimeout(4200);
  assert.equal(statusReads(), reviewReads);
  await page.waitForFunction(() => document.querySelector("#thought-svg-preview").naturalWidth > 0);
  const desktop = await metrics();
  assert.equal(desktop.imageCount, 1); assert.equal(desktop.mintVisible, false);
  assert.equal(desktop.watermarkCount, 1);
  assert.ok(desktop.documentWidth <= desktop.viewport);
  assert.ok(desktop.canvas.width > 400 && Math.abs(desktop.canvas.width - desktop.canvas.height) < 2);
  assert.ok(desktop.panel.x >= desktop.canvas.x + desktop.canvas.width);
  assert.ok(desktop.controls.every(control => control.font.includes("Source Code Pro")));
  assert.ok(desktop.controls.every(control => control.contained));
  await page.screenshot({ path: `${out}/desktop-review.png`, fullPage: true });
  await page.getByRole("button", { name: "Review complete" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Work saved", { exact: true }).waitFor();
  const savedReads = statusReads();
  await page.waitForTimeout(4200);
  assert.equal(statusReads(), savedReads);
  await page.reload();
  await page.getByText("Work saved", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const select = page.getByRole("combobox", { name: "Load saved experimental work" });
  await select.selectOption({ label: "Hello?" });
  await page.getByText("Work saved", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  const mobile = await metrics();
  assert.ok(mobile.documentWidth <= mobile.viewport);
  assert.ok(mobile.canvas.width > 250 && mobile.panel.y >= mobile.canvas.y + mobile.canvas.height);
  assert.equal(mobile.imageCount, 1); assert.equal(mobile.mintVisible, false);
  await page.screenshot({ path: `${out}/mobile-saved.png`, fullPage: true });
  assert.equal(external.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(requests.filter(request => request.method === "POST" && request.path === "/api/thought-plain/v1/runs").length, 1);
  assert.equal(requests.filter(request => /\/api\/(thought-agent|.*rpc|thought-contract)/.test(request.path)).length, 0);
  const plainRequestCount = requests.length;
  await page.goto(`${disabledOrigin}/thought/?transport=plain&surface=agent`);
  await page.getByText("Experimental return unavailable", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Send to your Agent" }).count(), 0);
  assert.equal((await fetch(disabledOrigin + "/api/thought-plain/v1/runs", { method: "POST" })).status, 404);
  await page.goto(`${disabledOrigin}/thought/?surface=agent`);
  await page.locator("#thought-dock-prompt").waitFor({ state: "visible" });
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('body[data-thought-transport="plain-experimental"]').count(), 0);
  assert.equal(await page.getByText("Experimental creation", { exact: true }).count(), 0);
  await page.goto(`${origin}/thought/?transport=plain&surface=agent`);
  await page.getByRole("button", { name: "Send to your Agent" }).waitFor();
  await page.route("**/api/thought-plain/v1/runs", route => route.abort());
  await page.locator("#thought-dock-prompt").fill("Unknown?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByText("Preparation uncertain", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Check return", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Reset", exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Return to THOUGHT", exact: true }).getAttribute("href"), "/thought/");
  await page.screenshot({ path: `${out}/preparation-uncertain.png`, fullPage: true });
  await page.unroute("**/api/thought-plain/v1/runs");
  const report = { syntheticOnly: true, liveAgents: 0, nativeLaunches: 0, handoffBytes: bytes,
    passed: ["real create/HTTP return/poll", "reload pending", "lost Agent ack", "exact quotes", "review/save", "reload saved", "load", "desktop geometry", "mobile dark geometry", "mint isolation", "no RPC/Agent v2", "disabled UI/API", "legacy default entry", "terminal polling stopped", "Claude No folder guidance", "lost preparation reply safe exit"],
    desktop, mobile, plainRequestCount, externalRequests: external, pageErrors: errors };
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, handoffBytes: bytes, evidence: out, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); }

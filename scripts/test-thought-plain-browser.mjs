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
const settleLayout = async () => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
};
const metrics = async () => page.evaluate(() => {
  const canvas = document.querySelector(".thought-canvas-frame").getBoundingClientRect();
  const panel = document.querySelector("#thought-panel").getBoundingClientRect();
  const header = document.querySelector(".thought-create__header").getBoundingClientRect();
  const main = document.querySelector(".frontpage-main").getBoundingClientRect();
  const image = document.querySelector("#thought-svg-preview");
  const controls = [...document.querySelectorAll("#thought-dock-action-area button, #thought-dock-action-area a, #thought-dock-action-area select")];
  const reportLink = document.querySelector("#thought-report-bug-link");
  const reportBox = reportLink.getBoundingClientRect();
  const overlaps = rect => reportBox.left < rect.right && reportBox.right > rect.left && reportBox.top < rect.bottom && reportBox.bottom > rect.top;
  return {
    viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
    canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
    panel: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
    headerBottom: header.bottom, mainTop: main.top,
    controls: controls.map(control => ({ text: control.textContent, width: control.getBoundingClientRect().width,
      contained: control.getBoundingClientRect().right <= panel.right && control.getBoundingClientRect().left >= panel.left,
      font: getComputedStyle(control).fontFamily })),
    imageLoaded: image.naturalWidth > 0, imageCount: document.querySelectorAll("#thought-svg-preview:not(.is-hidden)").length,
    watermarkCount: document.querySelectorAll(".inshell-preview-watermark").length,
    mintVisible: Boolean(document.querySelector("#thought-dock-path:not(.is-hidden)")),
    reportLink: { href: reportLink.getAttribute("href"), position: getComputedStyle(reportLink).position, y: reportBox.y,
      left: reportBox.left, right: reportBox.right,
      visible: reportBox.width > 0 && reportBox.height > 0, overlapsCanvas: overlaps(canvas),
      overlapsControls: controls.some(control => overlaps(control.getBoundingClientRect())) },
    console: document.querySelector("#thought-dock-details-body").textContent,
  };
});
const assertLayout = (value, stacked) => {
  assert.ok(value.documentWidth <= value.viewport, "No horizontal overflow");
  assert.ok(value.canvas.y >= value.headerBottom - 1, "Canvas stays below the heading");
  assert.ok(value.canvas.y >= value.mainTop - 1, "Canvas never overflows upward from its layout");
  assert.ok(Math.abs(value.canvas.width - value.canvas.height) < 2, "Canvas remains square");
  if (stacked) assert.ok(value.panel.y >= value.canvas.y + value.canvas.height - 1, "Controls follow the canvas");
  assert.ok(value.controls.every(control => control.contained), "Controls stay inside the panel");
  assert.ok(value.reportLink.visible && value.reportLink.href, "Existing report feature is retained");
  assert.equal(value.reportLink.overlapsCanvas, false, "Report link never overlaps artwork");
  assert.equal(value.reportLink.overlapsControls, false, "Report link never overlaps actions");
  if (stacked) {
    assert.equal(value.reportLink.position, "static");
    assert.ok(value.reportLink.left > 0 && value.reportLink.right < value.viewport, "Report link keeps the shared page inset");
  }
};
const frameChecks = [];
const assertFrame = async (name) => {
  await settleLayout();
  const bounds = await page.locator(".thought-canvas-frame").boundingBox();
  // Full-page capture avoids locator auto-scroll moving the fixed PREVIEW badge
  // over the sampled frame at medium widths.
  const png = await page.screenshot({ path: `${out}/${name}-frame.png`, fullPage: true });
  // Sample the rendered screenshot, not only the canvas backing store. This
  // catches missing paint, CSS occlusion and incorrect responsive frame width.
  const pixels = await page.evaluate(async ({ base64, bounds }) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
    const scale = canvas.width / innerWidth;
    const sample = (x, y) => [...context.getImageData(Math.floor((bounds.x + x * bounds.width) * scale), Math.floor((bounds.y + y * bounds.height) * scale), 1, 1).data];
    return { width: bounds.width, height: bounds.height,
      outer: [[.02,.5],[.98,.5],[.5,.02],[.5,.98],[.02,.02],[.98,.98]].map(([x,y]) => sample(x,y)),
      inner: [[.04,.5],[.96,.5],[.5,.04],[.5,.96]].map(([x,y]) => sample(x,y)) };
  }, { base64: png.toString("base64"), bounds });
  for (const pixel of pixels.outer) assert.deepEqual(pixel, [0, 97, 0, 255], `${name}: canonical green frame`);
  for (const pixel of pixels.inner) assert.deepEqual(pixel, [0, 0, 0, 255], `${name}: black inside 32/1024 inset`);
  frameChecks.push({ name, ...pixels });
};
try {
  await page.setViewportSize({ width: 924, height: 809 });
  await page.goto(`${disabledOrigin}/thought/?surface=agent`);
  await page.locator("#thought-dock-prompt").waitFor({ state: "visible" });
  await page.locator(".inshell-preview-watermark").waitFor();
  await settleLayout();
  const defaultMedium = await metrics();
  assert.equal(defaultMedium.reportLink.position, "fixed", "Default surface is unchanged");
  await page.screenshot({ path: `${out}/default-medium-initial.png`, fullPage: true });
  await page.goto(`${origin}/thought/?transport=plain&surface=agent`);
  await page.getByRole("button", { name: "Send to your Agent" }).waitFor();
  const initial = [];
  for (const width of [924, 390, 768, 1023, 1024, 1280]) {
    await page.setViewportSize({ width, height: 809 });
    await settleLayout();
    const layout = await metrics();
    await page.screenshot({ path: `${out}/initial-${width}.png`, fullPage: true });
    initial.push(layout);
    assertLayout(layout, width < 1024);
    await assertFrame(`initial-${width}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const createCount = () => requests.filter(request => request.method === "POST" && request.path === "/api/thought-plain/v1/runs").length;
  const beforeInvalid = createCount();
  for (const [value, heading] of [["", "Prompt is empty"], ["🙂", "Unsupported characters"], ["A".repeat(65), "Prompt is too long"], [" A", "Prompt spacing needs editing"], ["A  B", "Prompt spacing needs editing"]]) {
    await page.locator("#thought-dock-prompt").fill(value);
    await page.getByRole("button", { name: "Send to your Agent" }).click();
    await page.getByText(heading, { exact: true }).waitFor();
    await page.waitForTimeout(2100);
    assert.equal(await page.locator("#thought-dock-prompt").inputValue(), value, "Invalid bytes are not rewritten");
    assert.equal(await page.getByText(heading, { exact: true }).count(), 1, "Validation survives polling render");
    assert.equal(createCount(), beforeInvalid);
  }
  await page.screenshot({ path: `${out}/invalid-prompt.png`, fullPage: true });
  await page.locator("#thought-dock-prompt").fill("Hello?");
  assert.equal(await page.locator('[aria-invalid="true"]').count(), 0);
  let releaseCreate;
  const createGate = new Promise(resolve => { releaseCreate = resolve; });
  await page.route("**/api/thought-plain/v1/runs", async route => { await createGate; await route.continue(); });
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByText("Preparing task", { exact: true }).waitFor();
  await assertFrame("preparing");
  releaseCreate();
  await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
  await page.unroute("**/api/thought-plain/v1/runs");
  await assertFrame("waiting");
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
  await page.route("**/api/thought-plain/v1/runs/*", route => route.abort());
  await page.getByRole("button", { name: "Check return", exact: true }).click();
  await page.getByText("Delivery uncertain", { exact: true }).waitFor();
  await assertFrame("delivery-uncertain");
  assert.equal(createCount(), beforeInvalid + 1);
  await page.unroute("**/api/thought-plain/v1/runs/*");
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
  const returned = [];
  for (const width of [768, 924, 1023, 1024]) {
    await page.setViewportSize({ width, height: 809 });
    await settleLayout();
    const layout = await metrics();
    await page.screenshot({ path: `${out}/returned-${width}.png`, fullPage: true });
    returned.push(layout);
    assertLayout(layout, width < 1024);
    assert.equal(layout.imageCount, 1);
    assert.equal(layout.mintVisible, false);
    await assertFrame(`returned-${width}`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Review complete" }).click();
  await page.evaluate(() => {
    window.restoreStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "inshell.thought.plain-http.works.v1") throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return window.restoreStorageWrite.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Work not saved", { exact: true }).waitFor();
  await page.waitForTimeout(2100);
  assert.equal(await page.getByText("Work not saved", { exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).count(), 1);
  assert.equal((await metrics()).imageCount, 1);
  assert.equal(createCount(), beforeInvalid + 1);
  await page.screenshot({ path: `${out}/save-failed.png`, fullPage: true });
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreStorageWrite; delete window.restoreStorageWrite; });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Work saved", { exact: true }).waitFor();
  const savedReads = statusReads();
  await page.waitForTimeout(4200);
  assert.equal(statusReads(), savedReads);
  await page.reload();
  await page.getByText("Work saved", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await assertFrame("reset");
  const select = page.getByRole("combobox", { name: "Load saved experimental work" });
  await select.selectOption({ label: "Hello?" });
  await page.getByText("Work saved", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await settleLayout();
  const mobile = await metrics();
  assert.ok(mobile.documentWidth <= mobile.viewport);
  assert.ok(mobile.canvas.width > 250 && mobile.panel.y >= mobile.canvas.y + mobile.canvas.height);
  assert.equal(mobile.imageCount, 1); assert.equal(mobile.mintVisible, false);
  await page.screenshot({ path: `${out}/mobile-saved.png`, fullPage: true });
  await assertFrame("mobile-dark-saved");
  assert.equal(external.length, 0);
  assert.equal(errors.length, 0);
  assert.equal(requests.filter(request => request.method === "POST" && request.path === "/api/thought-plain/v1/runs").length, 1);
  assert.equal(requests.filter(request => /\/api\/(thought-agent|.*rpc|thought-contract)/.test(request.path)).length, 0);
  const plainRequestCount = requests.length;
  // Exercise terminal rejection and cancellation through the actual loopback
  // API; no native app is opened and no failed real task is replayed.
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator("#thought-dock-prompt").fill("Reject?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
  const rejectedTask = new URL(await page.getByRole("link", { name: "ChatGPT", exact: true }).getAttribute("href")).searchParams.get("prompt");
  const rejectedReply = await fetch(/^URL: (.+)$/m.exec(rejectedTask)[1], { method: "POST", headers: { Authorization: /^Authorization: (.+)$/m.exec(rejectedTask)[1], "Content-Type": "text/plain" }, body: "Bad\n", redirect: "error" });
  assert.equal(rejectedReply.status, 422); await rejectedReply.body.cancel();
  await page.getByText("Return rejected", { exact: true }).waitFor();
  await assertFrame("rejected");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator("#thought-dock-prompt").fill("Cancel?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Task cancelled", { exact: true }).waitFor();
  await assertFrame("cancelled");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator("#thought-dock-prompt").fill("Feedback?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
  const feedbackTask = new URL(await page.getByRole("link", { name: "ChatGPT", exact: true }).getAttribute("href")).searchParams.get("prompt");
  const feedbackUrl = /^URL: (.+)$/m.exec(feedbackTask)[1];
  const feedbackAuth = /^Authorization: (.+)$/m.exec(feedbackTask)[1];
  const feedbackPending = await page.evaluate(() => sessionStorage.getItem("inshell.thought.plain-http.pending.v1"));
  const feedbackReply = await fetch(feedbackUrl, { method: "POST", headers: { Authorization: feedbackAuth, "Content-Type": "text/plain" }, body: "One.", redirect: "error" });
  assert.equal(feedbackReply.status, 200); await feedbackReply.body.cancel();
  await page.getByRole("button", { name: "Review complete" }).click();
  await page.evaluate(() => {
    window.restoreStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "inshell.thought.plain-http.works.v1") throw new DOMException("Synthetic quota failure", "QuotaExceededError");
      return window.restoreStorageWrite.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Work not saved", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByText("Prompt is empty", { exact: true }).waitFor();
  await page.waitForTimeout(2100);
  assert.equal(await page.getByText("Prompt is empty", { exact: true }).count(), 1);
  await page.evaluate(() => { Storage.prototype.setItem = window.restoreStorageWrite; delete window.restoreStorageWrite; });
  assert.equal(createCount(), beforeInvalid + 4, "Save failure/reset/invalid prompt never resends");

  // Restore the synthetic read session to inspect a subsequent conflicting
  // delivery. The first response remains visible and cannot be reviewed/saved.
  const conflictReply = await fetch(feedbackUrl, { method: "POST", headers: { Authorization: feedbackAuth, "Content-Type": "text/plain" }, body: "Two.", redirect: "error" });
  assert.equal(conflictReply.status, 409); await conflictReply.body.cancel();
  await page.evaluate(pending => sessionStorage.setItem("inshell.thought.plain-http.pending.v1", pending), feedbackPending);
  await page.reload();
  await page.getByText("Conflicting return", { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector("#thought-svg-preview").naturalWidth > 0);
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Review complete", exact: true }).count(), 0);
  assert.equal(await page.locator("#thought-svg-preview").getAttribute("alt"), "THOUGHT: Feedback? — One.");
  await assertFrame("conflict");
  await page.getByRole("button", { name: "Reset", exact: true }).click();

  // Isolated browser-only fixtures complement actual API terminal-state tests.
  // They exercise expiry/conflict UI without mutating time or production data.
  await page.locator("#thought-dock-prompt").fill("Expiry?");
  await page.getByRole("button", { name: "Send to your Agent" }).click();
  await page.getByRole("link", { name: "ChatGPT", exact: true }).waitFor();
  const expiryRun = await page.evaluate(() => JSON.parse(sessionStorage.getItem("inshell.thought.plain-http.pending.v1")).runId);
  await page.route(`**/api/thought-plain/v1/runs/${expiryRun}`, route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ runId: expiryRun, state: "expired", work: null, conflict: false }) }));
  await page.getByText("Task expired", { exact: true }).waitFor();
  await assertFrame("expired");
  assert.ok(!(await page.locator("#thought-dock-details-body").textContent()).includes("can no longer be checked"));
  await page.unroute(`**/api/thought-plain/v1/runs/${expiryRun}`);
  // Close the synthetic server task using its scoped read capability before
  // leaving this fixture, since the UI expiry above did not expire the server.
  await page.evaluate(async () => {
    const pending = JSON.parse(sessionStorage.getItem("inshell.thought.plain-http.pending.v1"));
    const response = await fetch(`/api/thought-plain/v1/runs/${pending.runId}`, { method: "DELETE", headers: { Authorization: `Bearer ${pending.browserToken}` } });
    if (!response.ok) throw Error("Synthetic cleanup failed");
  });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
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
  await assertFrame("preparation-uncertain");
  await page.unroute("**/api/thought-plain/v1/runs");
  await page.addInitScript(() => {
    for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException("Synthetic denied storage", "SecurityError"); } });
  });
  await page.goto(`${origin}/thought/?transport=plain&surface=agent`);
  await page.getByRole("button", { name: "Send to your Agent" }).waitFor();
  await assertFrame("storage-denied-initial");
  const report = { syntheticOnly: true, liveAgents: 0, nativeLaunches: 0, handoffBytes: bytes,
    passed: ["real create/HTTP return/poll", "reload pending", "lost Agent ack", "exact quotes", "review/save", "reload saved", "load", "desktop geometry", "mobile dark geometry", "six-width initial geometry", "four-width returned geometry", "default medium-width comparison", "mint isolation", "no RPC/Agent v2", "disabled UI/API", "legacy default entry", "terminal polling stopped", "Claude No folder guidance", "lost preparation reply safe exit"],
    frameChecks, defaultMedium, initial, returned, desktop, mobile, plainRequestCount, externalRequests: external, pageErrors: errors };
  report.passed.push("rendered frame pixels in all states and widths", "persistent specific prompt validation; zero create and no byte rewrite", "validation clears after editing", "preparing and delivery uncertainty", "quota failure keeps review and Save without resend", "terminal rejection and cancellation");
  report.passed.push("validation after failed Save and Reset", "expiry copy valid for separate write/read limits");
  report.passed.push("conflict retains first work and blocks review/save", "denied storage getters do not blank initial UI");
  report.passed.push("report link retained outside canvas and controls; default placement unchanged");
  assert.equal(external.length, 0); assert.equal(errors.length, 0);
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, handoffBytes: bytes, evidence: out, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); }

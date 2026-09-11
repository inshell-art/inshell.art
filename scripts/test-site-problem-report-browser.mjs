import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Local UI-only coverage. External requests and report submission are blocked.
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  for (const width of [1440, 390]) {
    for (const [base, path, surface] of [
      ["http://127.0.0.1:5173", "/", "home"],
      ["http://127.0.0.1:5173", "/path", "path"],
      ["http://127.0.0.1:5173", "/gallery", "gallery"],
      ["http://127.0.0.1:5173", "/docs", "docs"],
      ["http://127.0.0.1:5174", "/thought/", "thought"],
    ]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route("**/*", route => {
        const request = route.request();
        return request.url().startsWith(base + "/") && request.method() === "GET"
          ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(base + path + "?private-test=DO_NOT_INCLUDE#PRIVATE_FRAGMENT");
      const entry = page.getByRole("link", { name: "Report a problem", exact: true });
      await entry.click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(await dialog.locator("details").count(), 0);
      assert.equal(await dialog.locator("#failure-agent-version").count(), 0);
      const text = await dialog.locator("#failure-report-preview").inputValue();
      assert.match(text, new RegExp("Surface: " + surface));
      assert.match(text, /not release-test evidence/);
      assert.doesNotMatch(text, /DO_NOT_INCLUDE|PRIVATE_FRAGMENT|Agent version|Agent:/);
      const draft = new URL(await dialog.getByRole("link", { name: "Continue to GitHub" }).getAttribute("href"));
      assert.equal(draft.origin, "https://github.com");
      assert.equal(draft.searchParams.get("body"), text);
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      await page.screenshot({ path: `/private/tmp/site-report-${surface}-${width}.png` });
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(await entry.evaluate(node => node === document.activeElement), true);
      await context.close();
    }
  }
  console.log(JSON.stringify({ passed: true, cases: 10, reportsSent: 0, realAgentExecuted: false }));
} finally { await browser.close(); }

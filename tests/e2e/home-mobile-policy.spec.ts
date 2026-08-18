import { chromium, devices, expect, test, webkit, type Browser, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import process from "node:process";
import { MAINSTREAM_PHONE_TARGETS } from "./fixtures/mainstream-phone-targets";

const MINIMUM_WORK_PEEK_PX = 16;
const POLICY_URL = process.env.INSHELL_MOBILE_POLICY_URL ?? "http://127.0.0.1:5173/";
const CHROME_IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 " +
  "Mobile/15E148 Safari/604.1";

async function ensureFirstWorkGeometry(page: Page) {
  await page.goto(POLICY_URL);
  await expect(page.locator(".ecosystem-home__hero")).toBeVisible();
  const firstWork = page.locator(".ecosystem-home__work-card").first();
  await expect(firstWork).toBeVisible({ timeout: 30_000 });
  const firstImage = firstWork.locator("img").first();
  await expect(firstImage).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
    );
  });
  await expect
    .poll(() => firstImage.evaluate((image: { complete: boolean; naturalWidth: number }) => image.complete && image.naturalWidth > 0))
    .toBe(true);
}

async function launchTargetBrowser(engine: "webkit" | "chromium"): Promise<Browser> {
  return engine === "webkit"
    ? webkit.launch({ channel: undefined })
    : chromium.launch({ channel: "chrome" });
}

test.describe("canonical mobile policy matrix", () => {
  test("keeps 20 unique, consecutively ranked targets", () => {
    expect(MAINSTREAM_PHONE_TARGETS).toHaveLength(20);
    expect(MAINSTREAM_PHONE_TARGETS.map(({ rank }) => rank)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(new Set(MAINSTREAM_PHONE_TARGETS.map(({ model }) => model)).size).toBe(20);
  });

  for (const target of MAINSTREAM_PHONE_TARGETS) {
    // Playwright requires the first callback argument to use object destructuring.
    // eslint-disable-next-line no-empty-pattern
    test(`${String(target.rank).padStart(2, "0")} ${target.model}: first work peeks into Home`, async ({}, testInfo) => {
      const descriptor = devices[target.playwrightDevice];
      expect(descriptor, `${target.playwrightDevice} must remain in Playwright's registry`).toBeDefined();
      expect(descriptor.viewport).toEqual(target.viewport);
      expect(descriptor.deviceScaleFactor).toBe(target.deviceScaleFactor);

      const targetBrowser = await launchTargetBrowser(target.browserEngine);
      const context = await targetBrowser.newContext({
        ...descriptor,
        colorScheme: "dark",
        ...(target.browserEngine === "webkit" ? { userAgent: CHROME_IOS_USER_AGENT } : {}),
      });
      const page = await context.newPage();
      const criticalAssetFailures: string[] = [];
      const isCriticalAsset = (resourceType: string) =>
        ["document", "script", "stylesheet", "font"].includes(resourceType);
      page.on("requestfailed", (request) => {
        if (isCriticalAsset(request.resourceType())) {
          criticalAssetFailures.push(`${request.resourceType()} ${request.failure()?.errorText ?? "failed"}`);
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400 && isCriticalAsset(response.request().resourceType())) {
          criticalAssetFailures.push(`${response.request().resourceType()} HTTP ${response.status()}`);
        }
      });

      try {
        await ensureFirstWorkGeometry(page);
        const geometry = await page.evaluate(() => {
          const firstWork = document.querySelector<HTMLElement>(".ecosystem-home__work-card");
          const movements = document.querySelector<HTMLElement>(".ecosystem-home__movements");
          const slogan = document.querySelector<HTMLElement>(".ecosystem-home__slogan");
          const image = firstWork?.querySelector("img") as {
            currentSrc: string;
            src: string;
            naturalWidth: number;
            naturalHeight: number;
          } | null;
          if (!firstWork || !movements || !slogan || !image) throw new Error("Home policy nodes missing");
          const workRect = firstWork.getBoundingClientRect();
          const movementsRect = movements.getBoundingClientRect();
          const sloganRect = slogan.getBoundingClientRect();
          const imageSource = image.currentSrc || image.src;
          const imageSourceKind = imageSource.startsWith("data:image/svg+xml")
            ? "embedded-svg"
            : imageSource.includes("/thought/")
              ? "thought-route"
              : "other";
          return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            firstWorkTop: workRect.top,
            visibleWorkPixels: Math.max(0, window.innerHeight - workRect.top),
            movementsTop: movementsRect.top,
            movementsBottom: movementsRect.bottom,
            sloganTop: sloganRect.top,
            sloganBottom: sloganRect.bottom,
            imageSourceKind,
            imageNaturalWidth: image.naturalWidth,
            imageNaturalHeight: image.naturalHeight,
          };
        });

        expect(geometry.innerWidth).toBe(target.viewport.width);
        expect(geometry.innerHeight).toBe(target.viewport.height);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
        expect(geometry.movementsTop).toBeGreaterThanOrEqual(0);
        expect(geometry.movementsBottom).toBeLessThanOrEqual(geometry.innerHeight);
        expect(geometry.sloganTop).toBeGreaterThanOrEqual(0);
        expect(geometry.sloganBottom).toBeLessThanOrEqual(geometry.innerHeight);
        expect(geometry.visibleWorkPixels).toBeGreaterThanOrEqual(MINIMUM_WORK_PEEK_PX);
        expect(["embedded-svg", "thought-route"]).toContain(geometry.imageSourceKind);
        expect(geometry.imageNaturalWidth).toBeGreaterThan(0);
        expect(geometry.imageNaturalHeight).toBeGreaterThan(0);
        if (target.model === "iPhone 12 mini") {
          expect(geometry.visibleWorkPixels).toBeGreaterThanOrEqual(20);
          expect(geometry.visibleWorkPixels).toBeLessThanOrEqual(40);
        }
        expect(criticalAssetFailures).toEqual([]);

        await testInfo.attach(`${target.model}-geometry`, {
          body: Buffer.from(JSON.stringify(geometry, null, 2)),
          contentType: "application/json",
        });

        if (target.model === "iPhone 12 mini" || target.rank === 14) {
          await testInfo.attach(`${target.model}-home-policy`, {
            body: await page.screenshot({ fullPage: false }),
            contentType: "image/png",
          });
        }
      } finally {
        await context.close();
        await targetBrowser.close();
      }
    });
  }
});

test.describe("canonical desktop policy matrix", () => {
  for (const target of [
    { model: "Desktop 1568x944", viewport: { width: 1568, height: 944 } },
    { model: "Desktop 1440x900", viewport: { width: 1440, height: 900 } },
    { model: "Desktop 1280x720", viewport: { width: 1280, height: 720 } },
  ]) {
    // Playwright requires the first callback argument to use object destructuring.
    // eslint-disable-next-line no-empty-pattern
    test(`${target.model}: first work peeks into Home`, async ({}, testInfo) => {
      const targetBrowser = await launchTargetBrowser("chromium");
      const context = await targetBrowser.newContext({ viewport: target.viewport, colorScheme: "dark" });
      const page = await context.newPage();
      const criticalAssetFailures: string[] = [];
      const isCriticalAsset = (resourceType: string) =>
        ["document", "script", "stylesheet", "font"].includes(resourceType);
      page.on("requestfailed", (request) => {
        if (isCriticalAsset(request.resourceType())) {
          criticalAssetFailures.push(`${request.resourceType()} ${request.failure()?.errorText ?? "failed"}`);
        }
      });
      page.on("response", (response) => {
        if (response.status() >= 400 && isCriticalAsset(response.request().resourceType())) {
          criticalAssetFailures.push(`${response.request().resourceType()} HTTP ${response.status()}`);
        }
      });

      try {
        await ensureFirstWorkGeometry(page);
        const geometry = await page.evaluate(() => {
          const firstWork = document.querySelector<HTMLElement>(".ecosystem-home__work-card");
          const movements = document.querySelector<HTMLElement>(".ecosystem-home__movements");
          const slogan = document.querySelector<HTMLElement>(".ecosystem-home__slogan");
          const image = firstWork?.querySelector("img") as {
            currentSrc: string;
            naturalWidth: number;
            naturalHeight: number;
          } | null;
          if (!firstWork || !movements || !slogan || !image) throw new Error("Home policy nodes missing");
          const workRect = firstWork.getBoundingClientRect();
          const movementsRect = movements.getBoundingClientRect();
          const sloganRect = slogan.getBoundingClientRect();
          const imageSource = image.currentSrc || image.src;
          return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            scrollWidth: document.documentElement.scrollWidth,
            firstWorkTop: workRect.top,
            visibleWorkPixels: Math.max(0, window.innerHeight - workRect.top),
            movementsTop: movementsRect.top,
            movementsBottom: movementsRect.bottom,
            sloganTop: sloganRect.top,
            sloganBottom: sloganRect.bottom,
            imageSourceKind: imageSource.startsWith("data:image/svg+xml")
              ? "embedded-svg"
              : imageSource.includes("/thought/")
                ? "thought-route"
                : "other",
            imageNaturalWidth: image.naturalWidth,
            imageNaturalHeight: image.naturalHeight,
          };
        });
        expect(geometry.innerWidth).toBe(target.viewport.width);
        expect(geometry.innerHeight).toBe(target.viewport.height);
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
        expect(geometry.movementsTop).toBeGreaterThanOrEqual(0);
        expect(geometry.movementsBottom).toBeLessThanOrEqual(geometry.innerHeight);
        expect(geometry.sloganTop).toBeGreaterThanOrEqual(0);
        expect(geometry.sloganBottom).toBeLessThanOrEqual(geometry.innerHeight);
        expect(geometry.visibleWorkPixels).toBeGreaterThanOrEqual(MINIMUM_WORK_PEEK_PX);
        expect(["embedded-svg", "thought-route"]).toContain(geometry.imageSourceKind);
        expect(geometry.imageNaturalWidth).toBeGreaterThan(0);
        expect(geometry.imageNaturalHeight).toBeGreaterThan(0);
        expect(criticalAssetFailures).toEqual([]);
        await testInfo.attach(`${target.model}-geometry`, {
          body: Buffer.from(JSON.stringify(geometry, null, 2)),
          contentType: "application/json",
        });
      } finally {
        await context.close();
        await targetBrowser.close();
      }
    });
  }
});

import { chromium, devices, webkit, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAINSTREAM_PHONE_TARGETS } from "../tests/e2e/fixtures/mainstream-phone-targets";

const LABEL_HEIGHT = 48;
const DEFAULT_URL = "http://192.168.0.103:5177/";
const DEFAULT_OUTPUT_DIRECTORY = path.resolve("playwright-report/home-phone-matrix");
const COLOR_SCHEME =
  process.env.INSHELL_MOBILE_POLICY_COLOR_SCHEME === "light" ? "light" : "dark";
const IOS_BROWSER_PROFILE =
  process.env.INSHELL_MOBILE_POLICY_IOS_BROWSER === "chrome-ios"
    ? "chrome-ios-ua-on-webkit"
    : "playwright-safari-webkit";
const CHROME_IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.119 " +
  "Mobile/15E148 Safari/604.1";

function selectedTargets() {
  const rawRanks = process.env.INSHELL_MOBILE_POLICY_TARGET_RANKS;
  if (!rawRanks) return MAINSTREAM_PHONE_TARGETS;
  const ranks = new Set(
    rawRanks
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isSafeInteger),
  );
  return MAINSTREAM_PHONE_TARGETS.filter(({ rank }) => ranks.has(rank));
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function settleHome(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".ecosystem-home__hero", { state: "visible" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
    );
  });
  await page.waitForSelector(".ecosystem-home__work-card", {
    state: "attached",
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => {
      const image = document.querySelector(".ecosystem-home__work-card img") as {
        complete: boolean;
        naturalWidth: number;
      } | null;
      return Boolean(image?.complete && image.naturalWidth > 0);
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve()),
        ),
      ),
  );
}

async function renderAnnotatedImage(
  browser: Browser,
  screenshot: Buffer,
  label: string,
  width: number,
  height: number,
) {
  const context = await browser.newContext({
    viewport: { width, height: height + LABEL_HEIGHT },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; width: ${width}px; height: ${height + LABEL_HEIGHT}px; overflow: hidden; }
          body { background: #111; color: #f5f5f5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          header { height: ${LABEL_HEIGHT}px; display: flex; align-items: center; padding: 0 14px; font-size: 14px; font-weight: 600; letter-spacing: .01em; }
          img { display: block; width: ${width}px; height: ${height}px; object-fit: fill; }
        </style>
      </head>
      <body>
        <header>${escapeHtml(label)}</header>
        <img alt="" src="data:image/png;base64,${screenshot.toString("base64")}">
      </body>
    </html>`);
  const annotated = await page.screenshot({ fullPage: true });
  await context.close();
  return annotated;
}

async function main() {
  const url = process.argv[2] ?? DEFAULT_URL;
  const outputDirectory = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT_DIRECTORY);
  await mkdir(outputDirectory, { recursive: true });
  const browsers = {
    webkit: await webkit.launch({ headless: true }),
    chromium: await chromium.launch({ channel: "chrome", headless: true }),
  } satisfies Record<"webkit" | "chromium", Browser>;
  const annotationBrowser = browsers.chromium;
  const results: Array<{
    rank: number;
    model: string;
    viewport: { width: number; height: number };
    browserEngine: "webkit" | "chromium";
    browserProfile: string;
    browserVersion: string;
    colorScheme: "dark" | "light";
    file: string;
    geometry: Record<string, number | string | number[] | null>;
    assetHashes: Record<string, string>;
    criticalAssetFailures: string[];
    imageData: string;
  }> = [];

  try {
    for (const target of selectedTargets()) {
      const descriptor = devices[target.playwrightDevice];
      if (!descriptor) throw new Error(`Missing Playwright device: ${target.playwrightDevice}`);
      const browser = browsers[target.browserEngine];
      const context = await browser.newContext({
        ...descriptor,
        colorScheme: COLOR_SCHEME,
        ...(target.browserEngine === "webkit" &&
        IOS_BROWSER_PROFILE === "chrome-ios-ua-on-webkit"
          ? { userAgent: CHROME_IOS_USER_AGENT }
          : {}),
      });
      const page = await context.newPage();
      const criticalAssetFailures: string[] = [];
      const assetHashPromises: Array<Promise<[string, string] | null>> = [];
      const isCriticalAsset = (resourceType: string) =>
        ["document", "script", "stylesheet", "font"].includes(resourceType);
      page.on("requestfailed", (request) => {
        if (isCriticalAsset(request.resourceType())) {
          criticalAssetFailures.push(
            `${request.resourceType()} ${request.failure()?.errorText ?? "failed"}`,
          );
        }
      });
      page.on("response", (response) => {
        const request = response.request();
        const resourceType = request.resourceType();
        if (response.status() >= 400 && isCriticalAsset(response.request().resourceType())) {
          criticalAssetFailures.push(
            `${response.request().resourceType()} HTTP ${response.status()}`,
          );
        }
        if (["document", "script", "stylesheet"].includes(resourceType)) {
          assetHashPromises.push(
            response
              .body()
              .then((body) => {
                const assetUrl = new URL(response.url());
                return [`${resourceType}:${assetUrl.pathname}`, sha256(body)] as [string, string];
              })
              .catch(() => null),
          );
        }
      });

      await settleHome(page, url);
      const geometry = await page.evaluate(() => {
        const movements = document.querySelector<HTMLElement>(".ecosystem-home__movements");
        const slogan = document.querySelector<HTMLElement>(".ecosystem-home__slogan");
        const firstWorkNode = document.querySelector<HTMLElement>(".ecosystem-home__work-card");
        const shell = document.querySelector<HTMLElement>(".inshell-topbar");
        const walletLabel = document.querySelector<HTMLElement>(
          ".inshell-topbar__wallet-label",
        );
        const walletNote = document.querySelector<HTMLElement>(
          ".inshell-topbar__wallet-note",
        );
        const walletSurface = document.querySelector<HTMLElement>(
          ".inshell-topbar__wallet-surface",
        );
        const shellChildren = shell
          ? Array.from(shell.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
          : [];
        const firstWorkImage = firstWorkNode?.querySelector("img") as {
          naturalHeight: number;
          naturalWidth: number;
        } | null;
        const movementsBox = movements?.getBoundingClientRect() ?? null;
        const sloganBox = slogan?.getBoundingClientRect() ?? null;
        const firstWork = firstWorkNode?.getBoundingClientRect() ?? null;
        const shellBox = shell?.getBoundingClientRect() ?? null;
        const walletLabelBox = walletLabel?.getBoundingClientRect() ?? null;
        const walletNoteBox = walletNote?.getBoundingClientRect() ?? null;
        const shellChildTops = shellChildren.map((node) =>
          Number(node.getBoundingClientRect().top.toFixed(2)),
        );
        const shellRowTops = Array.from(new Set(shellChildTops));
        const bodyStyle = window.getComputedStyle(document.body);
        const movementStyle = movements ? window.getComputedStyle(movements) : null;
        const sloganStyle = slogan ? window.getComputedStyle(slogan) : null;
        return {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          devicePixelRatio: window.devicePixelRatio,
          visualViewportWidth: window.visualViewport?.width ?? null,
          visualViewportHeight: window.visualViewport?.height ?? null,
          userAgent: navigator.userAgent,
          bodyBackgroundColor: bodyStyle.backgroundColor,
          bodyColor: bodyStyle.color,
          movementFontSize: movementStyle?.fontSize ?? null,
          sloganFontSize: sloganStyle?.fontSize ?? null,
          shellTop: shellBox?.top ?? null,
          shellBottom: shellBox?.bottom ?? null,
          shellHeight: shellBox?.height ?? null,
          shellChildTops,
          shellRowCount: shellRowTops.length,
          walletLabelText: walletLabel?.innerText.trim() ?? null,
          walletLabelTop: walletLabelBox?.top ?? null,
          walletLabelBottom: walletLabelBox?.bottom ?? null,
          walletNoteText: walletNote?.innerText.trim() ?? null,
          walletNoteTop: walletNoteBox?.top ?? null,
          walletNoteBottom: walletNoteBox?.bottom ?? null,
          walletSurfaceClass: walletSurface?.className ?? null,
          movementsBottom: movementsBox?.bottom ?? null,
          sloganBottom: sloganBox?.bottom ?? null,
          firstWorkTop: firstWork?.top ?? null,
          visibleWorkPixels: firstWork ? Math.max(0, window.innerHeight - firstWork.top) : null,
          firstWorkImageNaturalWidth: firstWorkImage?.naturalWidth ?? null,
          firstWorkImageNaturalHeight: firstWorkImage?.naturalHeight ?? null,
          firstWorkImageSrc: (() => {
            const image = firstWorkNode?.querySelector("img") as {
              currentSrc: string;
              src: string;
            } | null;
            return image?.currentSrc || image?.src || null;
          })(),
          firstWorkHref:
            firstWorkNode?.closest("a")?.getAttribute("href") ??
            firstWorkNode?.querySelector("a")?.getAttribute("href") ??
            null,
        };
      });
      const assetEntries = (await Promise.all(assetHashPromises)).filter(
        (entry): entry is [string, string] => entry !== null,
      );
      const assetHashes = Object.fromEntries(assetEntries.sort(([a], [b]) => a.localeCompare(b)));
      const firstWorkImageSource = geometry.firstWorkImageSrc;
      const firstWorkImageSourceKind =
        typeof firstWorkImageSource === "string" && firstWorkImageSource.startsWith("data:")
          ? firstWorkImageSource.slice(0, firstWorkImageSource.indexOf(","))
          : typeof firstWorkImageSource === "string"
            ? "url"
            : null;
      const manifestGeometry = {
        ...geometry,
        firstWorkImageSrc:
          firstWorkImageSourceKind === "url" ? firstWorkImageSource : null,
        firstWorkImageSourceKind,
        firstWorkImageSourceSha256:
          typeof firstWorkImageSource === "string" ? sha256(firstWorkImageSource) : null,
      };
      const rawScreenshot = await page.screenshot({ fullPage: false });
      await context.close();

      const browserProfile =
        target.browserEngine === "webkit" ? IOS_BROWSER_PROFILE : "playwright-chrome";
      const label = `${String(target.rank).padStart(2, "0")}  ${target.model}  ·  ${target.viewport.width}×${target.viewport.height} CSS px  ·  ${browserProfile}  ·  emulated`;
      const annotated = await renderAnnotatedImage(
        annotationBrowser,
        rawScreenshot,
        label,
        target.viewport.width,
        target.viewport.height,
      );
      const file = `${String(target.rank).padStart(2, "0")}-${slugify(target.model)}-${target.viewport.width}x${target.viewport.height}.png`;
      await writeFile(path.join(outputDirectory, file), annotated);
      results.push({
        rank: target.rank,
        model: target.model,
        viewport: target.viewport,
        browserEngine: target.browserEngine,
        browserProfile,
        browserVersion: browser.version(),
        colorScheme: COLOR_SCHEME,
        file,
        geometry: manifestGeometry,
        assetHashes,
        criticalAssetFailures,
        imageData: annotated.toString("base64"),
      });
      process.stdout.write(`rendered ${file}\n`);
    }

    const contactContext = await annotationBrowser.newContext({
      viewport: { width: 1840, height: 900 },
      deviceScaleFactor: 1,
    });
    const contactPage = await contactContext.newPage();
    await contactPage.setContent(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; background: #080808; color: #f5f5f5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
            body { padding: 28px; }
            h1 { margin: 0 0 24px; font-size: 24px; font-weight: 600; }
            .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 22px; align-items: start; }
            figure { margin: 0; border: 1px solid #333; background: #111; padding: 10px; }
            img { display: block; width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <h1>Inshell Home · emulated CSS-viewport matrix (not physical-device screenshots) · 2026-08-18</h1>
          <main class="grid">
            ${results.map((result) => `<figure><img alt="${escapeHtml(result.model)}" src="data:image/png;base64,${result.imageData}"></figure>`).join("")}
          </main>
        </body>
      </html>`);
    await contactPage.screenshot({
      path: path.join(outputDirectory, "00-home-phone-matrix-contact-sheet.png"),
      fullPage: true,
    });
    await contactContext.close();

    await writeFile(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          sourceUrl: url,
          sizeUnit: "CSS pixels",
          evidenceKind: "browser-engine emulation; browser chrome excluded",
          iosBrowserProfile: IOS_BROWSER_PROFILE,
          thoughtGallerySource: {
            mode: "live-served-page",
            requirement: "real rendered THOUGHT artwork; no synthetic or loading placeholder",
          },
          targets: results.map(({ imageData: _imageData, ...result }) => result),
        },
        null,
        2,
      )}\n`,
    );
    process.stdout.write(`contact sheet and manifest written to ${outputDirectory}\n`);
  } finally {
    await Promise.all(Object.values(browsers).map((browser) => browser.close()));
  }
}

await main();

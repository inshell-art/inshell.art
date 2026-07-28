import { expect, test, type Browser, type Page } from "@playwright/test";

const SHELL_ROUTES = ["/path", "/thought", "/will", "/docs", "/verify"];

async function shellBarBox(page: Page, route: string) {
  await page.goto(route);
  const bar = page.locator(".inshell-topbar");
  await expect(bar).toBeVisible();
  return bar.boundingBox();
}

test.describe("shared responsive shell", () => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 834, height: 1112 },
    { width: 1440, height: 900 },
  ]) {
    test(`aligns route bars and avoids horizontal overflow at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const tops: number[] = [];

      for (const route of SHELL_ROUTES) {
        const box = await shellBarBox(page, route);
        expect(box).not.toBeNull();
        tops.push(box!.y);
        const geometry = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      }

      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    });
  }
});

test("PATH remains interactive on a phone without the legacy room blocker", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/path");
  await expect(page.getByText("This view needs more room.")).toHaveCount(0);
  const canvas = page.locator(".dotfield__canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(200);
});

test("PATH warning and desktop mint popover share the 6px CTA gap", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/path");
  await expect(page.locator(".dotfield__cta-anchor .dotfield__mint")).toBeVisible();

  const geometry = await page.evaluate(async () => {
    const anchor = document.querySelector<HTMLElement>(".dotfield__cta-anchor");
    const button = anchor?.querySelector<HTMLElement>(".dotfield__mint");
    const notice = document.querySelector<HTMLElement>(".dotfield__mint-notice");
    if (!anchor || !button || !notice) throw new Error("PATH CTA geometry nodes missing");

    const originalNoticeClass = notice.className;
    const originalNoticeText = notice.textContent;
    notice.className = "dotfield__mint-notice is-warn";
    notice.textContent = "Need 0.009 ETH; have 0.";
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const warningGap = notice.getBoundingClientRect().top - button.getBoundingClientRect().bottom;

    notice.className = originalNoticeClass;
    notice.textContent = originalNoticeText;
    const review = document.createElement("div");
    review.className = "dotfield__mint-review";
    review.textContent = "$PATH mint";
    anchor.appendChild(review);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const buttonRect = button.getBoundingClientRect();
    const reviewRect = review.getBoundingClientRect();

    return {
      warningGap,
      popoverGap: reviewRect.top - buttonRect.bottom,
      rightEdgeDelta: Math.abs(reviewRect.right - buttonRect.right),
    };
  });

  expect(geometry.warningGap).toBeCloseTo(6, 4);
  expect(geometry.popoverGap).toBeCloseTo(6, 4);
  expect(geometry.rightEdgeDelta).toBeLessThanOrEqual(1);
});

test("WILL shares the route identity height and renders an even canonical-green dot field", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const titleTops: number[] = [];
    for (const [route, selector] of [
      ["/path", ".dotfield__title"],
      ["/thought", ".thought-create__title"],
      ["/will", ".will-page__title"],
    ] as const) {
      await page.goto(route);
      const title = page.locator(selector);
      await expect(title).toBeVisible();
      const box = await title.boundingBox();
      expect(box).not.toBeNull();
      titleTops.push(box!.y);
    }
    expect(Math.max(...titleTops) - Math.min(...titleTops)).toBeLessThanOrEqual(1);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/will");
  await expect(
    page.getByText("many people. many Agents. one will.", { exact: true }),
  ).toBeVisible();

  const geometry = await page.evaluate(() => {
    const title = document.querySelector(".will-page__title")?.getBoundingClientRect();
    const slogan = document.querySelector(".will-page__slogan")?.getBoundingClientRect();
    const field = document.querySelector(".will-page__dot-field");
    const fieldRect = field?.getBoundingClientRect();
    const styles = field ? window.getComputedStyle(field) : null;
    const pitch = styles?.backgroundSize.split(" ") ?? [];
    return {
      titleCenter: title ? title.left + title.width / 2 : 0,
      sloganCenter: slogan ? slogan.left + slogan.width / 2 : 0,
      fieldWidth: fieldRect?.width ?? 0,
      fieldHeight: fieldRect?.height ?? 0,
      backgroundImage: styles?.backgroundImage ?? "",
      pitchX: pitch[0] ?? "",
      pitchY: pitch[1] ?? "",
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(geometry.titleCenter).toBeCloseTo(geometry.innerWidth / 2, 1);
  expect(geometry.sloganCenter).toBeCloseTo(geometry.innerWidth / 2, 1);
  expect(geometry.fieldWidth).toBeGreaterThan(0);
  expect(geometry.fieldHeight).toBeGreaterThan(0);
  expect(geometry.backgroundImage).toContain("rgb(0, 97, 0)");
  expect(geometry.pitchX).toBe(geometry.pitchY);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
});

test("THOUGHT stacks its prompt, actions, canvas, and console on phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/thought");
  const slogan = page.getByText("one person. one Agent. one thought.", {
    exact: true,
  });
  await expect(slogan).toBeVisible();
  await expect(page.locator(".thought-dock-prompt-row")).toBeVisible();
  await expect(page.locator(".thought-dock-action-rail")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const title = document.querySelector(".thought-create__title")?.getBoundingClientRect();
    const slogan = document.querySelector(".thought-create__slogan")?.getBoundingClientRect();
    const frame = document.querySelector(".thought-canvas-frame")?.getBoundingClientRect();
    const canvas = document.querySelector(".thought-canvas-panel")?.getBoundingClientRect();
    const prompt = document.querySelector(".thought-dock-prompt-row")?.getBoundingClientRect();
    const actions = document.querySelector(".thought-dock-action-rail")?.getBoundingClientRect();
    const bodyStyles = window.getComputedStyle(document.body);
    return {
      titleLeft: title?.left ?? 0,
      sloganLeft: slogan?.left ?? 0,
      frameLeft: frame?.left ?? 0,
      sloganBottom: slogan?.bottom ?? 0,
      canvasTop: canvas?.top ?? 0,
      promptBottom: prompt?.bottom ?? 0,
      actionsTop: actions?.top ?? 0,
      overflowY: bodyStyles.overflowY,
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });

  expect(geometry.titleLeft).toBeCloseTo(geometry.frameLeft, 1);
  expect(geometry.sloganLeft).toBeCloseTo(geometry.frameLeft, 1);
  expect(geometry.canvasTop).toBeGreaterThanOrEqual(geometry.sloganBottom);
  expect(geometry.actionsTop).toBeGreaterThanOrEqual(geometry.promptBottom - 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.overflowY).not.toBe("hidden");
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.viewportHeight);
});

test("THOUGHT caps the tablet canvas so controls stay reachable", async ({ page }) => {
  const viewport = { width: 834, height: 1112 };
  await page.setViewportSize(viewport);
  await page.goto("/thought");
  await expect(
    page.getByText("one person. one Agent. one thought.", { exact: true }),
  ).toBeVisible();
  const canvas = page.locator("#thought-grid");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeLessThanOrEqual(Math.floor(viewport.height * 0.62) + 2);
  await expect(page.locator("#thought-panel")).toBeVisible();
});

test("coarse-pointer controls expose 44px touch targets", async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:5173",
    colorScheme: "light",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto("/thought");
  const walletHeight = await page.locator(".inshell-topbar__wallet").evaluate((element) =>
    element.getBoundingClientRect().height,
  );
  const actionHeight = await page.locator(".thought-dock-button").first().evaluate((element) =>
    element.getBoundingClientRect().height,
  );

  expect(walletHeight).toBeGreaterThanOrEqual(44);
  expect(actionHeight).toBeGreaterThanOrEqual(44);
  await context.close();
});

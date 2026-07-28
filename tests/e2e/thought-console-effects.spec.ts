import { expect, test, type Page } from "@playwright/test";

const CURRENT_OUTPUT_STORAGE_KEY = "thought-current-output";
const CONSOLE_HISTORY_STORAGE_KEY = "inshell:thought:console-history:v1";

type SeededConsoleEntry = {
  kind: string;
  title: string;
  detail?: string;
  nextStep?: string;
  tone: "neutral" | "success" | "warning" | "error";
  time?: string;
};

const seedRestoredWork = async (
  page: Page,
  consoleEntries: SeededConsoleEntry[] = [],
) => {
  await page.addInitScript(
    ({ consoleHistoryStorageKey, entries, outputStorageKey }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem(
        outputStorageKey,
        JSON.stringify({
          output: "fixture output",
          image: "",
          svg: "",
          runContext: null,
          workId: null,
          mintDockRevealed: false,
        }),
      );
      if (entries.length > 0) {
        window.sessionStorage.setItem(
          consoleHistoryStorageKey,
          JSON.stringify({
            version: 1,
            entries: entries.map((entry, index) => ({
              id: `seeded-console-${index}`,
              dedupeKey: `seeded-console-${index}`,
              kind: entry.kind,
              time: entry.time ?? `10:00:0${index}`,
              title: entry.title,
              ...(entry.detail ? { detail: entry.detail } : {}),
              ...(entry.nextStep ? { nextStep: entry.nextStep } : {}),
              context: { attemptId: "seeded-visual-role" },
              tone: entry.tone,
              boundary: false,
            })),
          }),
        );
      }
    },
    {
      consoleHistoryStorageKey: CONSOLE_HISTORY_STORAGE_KEY,
      entries: consoleEntries,
      outputStorageKey: CURRENT_OUTPUT_STORAGE_KEY,
    },
  );
};

const consoleEvents = (page: Page, kind: string) =>
  page.locator(
    `.thought-dock-status-screen__entry[data-console-kind="${kind}"]`,
  );

const expectControlPanelsCollapsed = async (page: Page) => {
  await expect(page.locator("#thought-dock-works")).toHaveClass(/\bis-hidden\b/);
  await expect(page.locator("#thought-dock-path")).toHaveClass(/\bis-hidden\b/);
};

const openThought = async (
  page: Page,
  consoleEntries: SeededConsoleEntry[] = [],
) => {
  await seedRestoredWork(page, consoleEntries);
  await page.goto("/thought");
  await expect(
    page.getByRole("button", { name: "open saved works" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "reset THOUGHT Dock and clear input" }),
  ).toBeVisible();
};

test("Load guidance is emitted once and Reset does not emit it again", async ({
  page,
}) => {
  await openThought(page);
  const loadEvents = consoleEvents(page, "work_library_opened");
  const resetEvents = consoleEvents(page, "work_reset");

  await expect(loadEvents).toHaveCount(0);
  await expect(resetEvents).toHaveCount(0);

  await page.getByRole("button", { name: "open saved works" }).click();

  await expect(page.locator("#thought-dock-works")).not.toHaveClass(
    /\bis-hidden\b/,
  );
  await expect(loadEvents).toHaveCount(1);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      }),
  );
  await expect(loadEvents).toHaveCount(1);

  await page
    .getByRole("button", { name: "reset THOUGHT Dock and clear input" })
    .click();

  await expect(resetEvents).toHaveCount(1);
  await expect(loadEvents).toHaveCount(1);
  await expectControlPanelsCollapsed(page);
});

test("direct Reset emits one reset event and no Load guidance", async ({
  page,
}) => {
  await openThought(page);
  const loadEvents = consoleEvents(page, "work_library_opened");
  const resetEvents = consoleEvents(page, "work_reset");

  await expect(loadEvents).toHaveCount(0);
  await expect(resetEvents).toHaveCount(0);

  await page
    .getByRole("button", { name: "reset THOUGHT Dock and clear input" })
    .click();

  await expect(resetEvents).toHaveCount(1);
  await expect(loadEvents).toHaveCount(0);
  await expectControlPanelsCollapsed(page);
});

test("Console promotes guidance within one timestamp without reordering other entries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await openThought(page, [
    {
      kind: "work_ready",
      title: "older guidance",
      tone: "success",
      time: "16:20:25",
    },
    {
      kind: "transaction_submitted",
      title: "$PATH mint submitted",
      tone: "neutral",
      time: "16:20:26",
    },
    {
      kind: "path_acquisition_confirmed",
      title: "$PATH #2 minted",
      tone: "success",
      time: "16:20:26",
    },
    {
      kind: "path_selected",
      title: "$PATH #2 picked",
      detail: "Select “Sign $PATH #2” above to continue.",
      tone: "neutral",
      time: "16:20:26",
    },
    {
      kind: "transaction_requested",
      title: "confirm THOUGHT mint in wallet",
      tone: "neutral",
      time: "16:20:26",
    },
  ]);

  await expect
    .poll(() =>
      page
        .locator(
          '.thought-dock-status-screen__entry[data-console-entry-id^="seeded-console-"]',
        )
        .evaluateAll((entries) =>
          entries.map((entry) => entry.getAttribute("data-console-kind")),
        ),
    )
    .toEqual([
      "path_selected",
      "transaction_requested",
      "transaction_submitted",
      "path_acquisition_confirmed",
      "work_ready",
    ]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`Console guidance is yellow while processing stays muted in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await openThought(page, [
      {
        kind: "work_ready",
        title: "ready to mint",
        detail: "Select “mint” above to continue.",
        tone: "success",
      },
      {
        kind: "work_preview_rejected",
        title: "work rejected",
        detail: "The App could not accept the Agent response.",
        nextStep: "reset, then send the prompt to your Agent again",
        tone: "warning",
      },
      {
        kind: "transaction_requested",
        title: "confirm THOUGHT mint in wallet",
        detail: "Open your wallet and confirm the transaction. Gas applies.",
        tone: "neutral",
      },
      {
        kind: "path_selected",
        title: "$PATH #2 picked",
        detail: "Select “Sign $PATH #2” above to continue.",
        tone: "neutral",
      },
      {
        kind: "work_previewing",
        title: "Previewing",
        tone: "neutral",
      },
      {
        kind: "work_agent_returned",
        title: "Return received",
        tone: "success",
      },
    ]);

    for (const kind of [
      "work_ready",
      "work_preview_rejected",
      "transaction_requested",
      "path_selected",
    ]) {
      const line = consoleEvents(page, kind).locator(
        ".thought-dock-status-screen__line",
      ).first();
      await expect(line).toHaveClass(/\bthought-dock-status-screen__line--guidance\b/);
      await expect(line).toHaveCSS("color", "rgb(139, 115, 28)");
      await expect(line).toHaveCSS("opacity", "1");
    }

    for (const kind of ["work_previewing", "work_agent_returned"]) {
      const line = consoleEvents(page, kind).locator(
        ".thought-dock-status-screen__line",
      ).first();
      await expect(line).not.toHaveClass(/\bthought-dock-status-screen__line--guidance\b/);
      await expect(line).toHaveCSS("opacity", "0.5");
    }

    const pickedPath = consoleEvents(page, "path_selected");
    await expect(pickedPath).toContainText("$PATH #2 picked");
    await expect(pickedPath).toContainText(
      "Select “Sign $PATH #2” above to continue.",
    );
    await expect(pickedPath).not.toContainText(/provenance/i);

    const readyToMint = consoleEvents(page, "work_ready");
    await expect(readyToMint).toContainText("ready to mint");
    await expect(readyToMint).toContainText(
      "Select “mint” above to continue.",
    );

    const blockedWork = consoleEvents(page, "work_blocked").first();
    await expect(blockedWork).toContainText(
      "This work is no longer ready to mint.",
    );
    await expect(blockedWork).toContainText(
      "next: reset and send the prompt to your Agent again",
    );
    await expect(blockedWork).not.toContainText(/session|provenance/i);
  });
}

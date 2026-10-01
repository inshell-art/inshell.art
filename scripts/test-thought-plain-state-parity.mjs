import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { makeWork } from "../apps/thought/src/plain-return/model.ts";
import { loadThoughtDevSnapshotFile } from "../apps/thought/scripts/dev-index-snapshot.mjs";

// Expectations are tied to approved production, not to the presenter under test.
const baseline = "024ba2ab218b5ad3e535c495cf0f85996871d387";
const source = execFileSync("git", ["show", `${baseline}:apps/thought/src/main.ts`], { encoding: "utf8" });
const railStart = source.indexOf("const getThoughtDockRailView =");
const rail = source.slice(railStart, source.indexOf("installLocalFailureTest", railStart));
const actionsFor = kind => {
  const section = rail.split(`case "${kind}":`)[1].split('\n    case ')[0];
  if (["expired", "failed"].includes(kind)) { assert.match(section, /actions: \[resetAction\(\)\]/); return ["Reset"]; }
  assert.match(section, /loadAction\(\)/);
  assert.match(section, /Send to your Agent/);
  return ["Send to your Agent", "Load"];
};
assert.match(rail, /setThoughtDockState\(\{ kind: "ready", prompt \}\);\s+focusThoughtDockPrompt/);
assert.match(source, /thoughtDockPrompt.value = stored.prompt/);
assert.match(rail, /title: "Load a saved work"/);
assert.match(source, /const THOUGHT_MOBILE_AGENT_QUERY =\s+"\(max-width: 760px\)/);
const progressKinds = source.slice(source.indexOf("const THOUGHT_CONSOLE_PROGRESS_KINDS"), source.indexOf("const isThoughtConsoleProgressEntry"));
assert.ok(!progressKinds.includes("work_agent_selection_ready"));
const chooserEvent = source.slice(source.indexOf('kind: "work_agent_selection_ready"'), source.indexOf('kind: "work_agent_selection_ready"') + 600);
assert.match(chooserEvent, /tone: "warning"/);
assert.match(source, /navigateThoughtPromptHistory\(\{/);
assert.match(source, /event\.metaKey \|\| event\.ctrlKey/);
assert.match(source, /readPrivateCreationSessionItem\(THOUGHT_PROMPT_SESSION_STORAGE_KEY\)/);
assert.match(source, /THOUGHT_DOCK_PROMPT_HISTORY_LIMIT = 50/);
// The dev fixture is transformed from a verified snapshot. Check the relevant
// behavior there too; the entire main/snapshot files are NOT claimed identical.
const locked = loadThoughtDevSnapshotFile(process.cwd(), "main");
for (const text of ['thoughtDockPrompt.value = stored.prompt', 'title: "Load a saved work"', 'kind: "work_agent_selection_ready"']) assert.ok(locked.includes(text));
assert.match(locked, /kind: "work_agent_selection_ready",[\s\S]*?tone: "warning"/);

const origin = process.env.PLAIN_TEST_ORIGIN ?? "http://127.0.0.1:5190";
assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
const out = process.env.PARITY_OUTPUT ?? "tmp/plain-state-parity-20260930/after";
const observe = process.env.PARITY_OBSERVE === "1";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const records = [], failures = [];
function check(name, actual, expected) {
  try { assert.deepEqual(actual, expected); } catch { failures.push({ name, actual, expected }); }
}
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    let id = 0, work, status = "pending", failRead = false, failCancel = false, cancelReturnsWork = false;
    let failCreate = false, holdCreate = null, releaseCreate, requests = 0;
    const external = [], errors = [];
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== origin) { external.push(url.origin); return route.abort(); }
      if (!url.pathname.startsWith("/api/")) return route.continue();
      requests++;
      if (url.pathname.endsWith("/capabilities")) return route.fulfill({ json: { schema: "inshell.thought.plain-capabilities.v1", enabled: true, mintEligible: false } });
      if (req.method() === "POST") {
        if (failCreate) return route.abort();
        work = makeWork(`plain_parity-${++id}`, req.postDataJSON().promptLine, "One.", "2026-09-30T00:00:00.000Z");
        status = "pending";
        if (holdCreate) await holdCreate;
        return route.fulfill({ json: { runId: work.runId, promptLine: work.promptLine, browserToken: "a".repeat(43), readExpiresAt: Date.now() + 3600000, handoff: "Synthetic fixture. Do not launch." } });
      }
      if (failRead || (req.method() === "DELETE" && failCancel)) return route.abort();
      if (req.method() === "DELETE") status = cancelReturnsWork ? "returned" : "cancelled";
      return route.fulfill({ json: { runId: work.runId, state: status, conflict: false, work: status === "returned" ? work : null } });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    const input = page.locator("#thought-dock-prompt");
    const button = label => page.getByRole("button", { name: label, exact: true });
    const latest = () => page.locator(".thought-dock-status-screen__entry.is-latest");
    const wait = title => latest().getByText(title, { exact: true }).waitFor();
    const draftKey = "inshell.thought.plain-http.draft.v1";
    const promptHistoryKey = "inshell.thought.plain-http.prompt-history.v1";
    const lockedEditor = async name => {
      const line = await input.inputValue(), creates = id;
      for (const key of ["ArrowUp", "ArrowDown", "Control+Enter", "Meta+Enter"]) await input.press(key);
      check(`${theme}/${name}/keyboard-line-unchanged`, await input.inputValue(), line);
      check(`${theme}/${name}/keyboard-no-create`, id, creates);
    };
    const capture = async (name, expected = {}) => {
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const state = await page.evaluate(() => {
        const input = document.querySelector("#thought-dock-prompt"), entry = document.querySelector(".is-latest");
        const heading = entry.querySelector("p"), css = getComputedStyle(heading);
        return {
          prompt: input.value, readOnly: input.readOnly, disabled: input.disabled, focus: document.activeElement.id,
          actions: [...document.querySelectorAll("#thought-dock-action-area button, #thought-dock-action-area a")].map(e => e.textContent),
          disabledActions: [...document.querySelectorAll("#thought-dock-action-area button:disabled")].map(e => e.textContent),
          warning: heading.classList.contains("thought-dock-status-screen__line--warning"), color: css.color,
          progress: entry.querySelectorAll(".thought-progress-ellipsis.is-active").length,
          text: entry.textContent, entries: document.querySelectorAll(".thought-dock-status-screen__entry").length,
          report: entry.querySelectorAll('[aria-label="Review a sanitized problem report"]').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          mint: Boolean(document.querySelector("#thought-dock-path:not(.is-hidden)")),
        };
      });
      for (const [key, value] of Object.entries(expected)) check(`${theme}/${name}/${key}`, state[key], value);
      if (expected.warning) check(`${theme}/${name}/shared-warning-color`, state.color, "rgb(181, 122, 0)");
      check(`${theme}/${name}/mint`, state.mint, false);
      check(`${theme}/${name}/overflow`, state.overflow, false);
      records.push({ theme, name, ...state });
      await page.screenshot({ path: `${out}/${theme}-${name}.png`, fullPage: true });
      return state;
    };
    const send = async text => { await input.fill(text); await button("Send to your Agent").click(); await wait("Task ready"); };
    await page.goto(`${origin}/thought/?surface=agent&transport=plain`);
    await button("Send to your Agent").waitFor();
    await capture("empty", { actions: actionsFor("empty"), disabledActions: ["Send to your Agent"], prompt: "", readOnly: false });
    await input.fill("Draft?!"); await page.reload(); await button("Send to your Agent").waitFor();
    await capture("draft-refresh", { prompt: "Draft?!", readOnly: false, actions: actionsFor("ready") });
    check(`${theme}/draft-tab-only`, await page.evaluate(key => localStorage.getItem(key), draftKey), null);
    check(`${theme}/no-legacy-draft`, await page.evaluate(() => localStorage.getItem("thought:dock:prompt-history:v1")), null);
    await input.fill(""); await page.reload(); await button("Send to your Agent").waitFor();
    await capture("cleared-draft-refresh", { prompt: "", disabledActions: ["Send to your Agent"] });
    await input.fill("Hello?");
    await capture("ready", { actions: actionsFor("ready"), disabledActions: [], readOnly: false });
    await input.dispatchEvent("keydown", { key: "Enter", ctrlKey: true, isComposing: true });
    await input.dispatchEvent("keydown", { key: "Enter", metaKey: true, repeat: true });
    check(`${theme}/ime-repeat-no-create`, id, 0);
    holdCreate = new Promise(resolve => { releaseCreate = resolve; });
    await input.evaluate(el => {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }));
    });
    await wait("Preparing task");
    check(`${theme}/double-shortcut-one-create`, id, 1);
    await lockedEditor("preparing");
    await capture("preparing", { actions: [], prompt: "Hello?", readOnly: true, progress: 1 });
    releaseCreate(); holdCreate = null; await wait("Task ready");
    const choosing = await capture("choosing", { actions: ["ChatGPT", "Claude", "Cancel"], warning: true, progress: 0, prompt: "Hello?" });
    check(`${theme}/Claude-no-folder`, choosing.text.includes('"No folder"'), true);
    await lockedEditor("choosing");
    // Reload loses launch capability intentionally, but must not lose the prompt.
    await page.evaluate(key => sessionStorage.setItem(key, "Older draft"), draftKey);
    await page.reload(); await button("Check return").waitFor();
    await capture("restored-pending", { prompt: "Hello?", readOnly: true, actions: ["Check return", "Cancel"], warning: true, progress: 1 });
    await lockedEditor("restored-pending");
    await button("Cancel").click(); await wait("Task cancelled").catch(() => {});
    await capture("confirmed-cancel", { prompt: "Hello?", readOnly: false, actions: actionsFor("ready"), focus: "thought-dock-prompt", progress: 0 });
    // Let observation mode continue through the old terminal UI without claiming parity.
    if (await button("Reset").count()) await button("Reset").click();
    await send("Chooser?"); await button("Cancel").click();
    await page.waitForFunction(() => !document.querySelector('#thought-dock-action-area a'));
    await capture("chooser-cancel", { prompt: "Chooser?", readOnly: false, actions: actionsFor("ready"), focus: "thought-dock-prompt" });
    if (await button("Reset").count()) await button("Reset").click();
    await send("Launch?");
    // Prevent OS dispatch while exercising the real link's presenter handler.
    await page.getByRole("link", { name: "Claude", exact: true }).evaluate(el => el.addEventListener("click", event => event.preventDefault()));
    await page.getByRole("link", { name: "Claude", exact: true }).click(); await wait("Waiting for the return");
    await capture("launched", { actions: ["Check return", "Cancel"], prompt: "Launch?", warning: true, progress: 1 });
    await button("Cancel").click(); await wait("Task cancelled");
    if (await button("Reset").count()) await button("Reset").click();
    check(`${theme}/launched-history-only`, await page.evaluate(key => JSON.parse(localStorage.getItem(key)), promptHistoryKey), ["Launch?"]);
    await input.fill("Current draft"); await input.press("ArrowUp");
    await capture("history-older", { prompt: "Launch?", readOnly: false });
    await input.press("ArrowDown");
    await capture("history-draft-return", { prompt: "Current draft", readOnly: false });
    await input.fill("History?"); await input.press("Meta+Enter"); await wait("Task ready");
    await page.getByRole("link", { name: "ChatGPT", exact: true }).evaluate(el => el.addEventListener("click", event => event.preventDefault()));
    await page.getByRole("link", { name: "ChatGPT", exact: true }).click(); await wait("Waiting for the return");
    await button("Cancel").click(); await wait("Task cancelled");
    await input.fill("Kept draft"); await page.reload(); await button("Send to your Agent").waitFor();
    await capture("cancelled-draft-refresh", { prompt: "Kept draft", readOnly: false });
    await input.press("ArrowUp"); check(`${theme}/history-newest`, await input.inputValue(), "History?");
    await input.press("ArrowUp"); check(`${theme}/history-older`, await input.inputValue(), "Launch?");
    await input.press("ArrowDown"); await input.press("ArrowDown");
    check(`${theme}/history-restores-draft`, await input.inputValue(), "Kept draft");
    const createsBeforeClear = id;
    await input.fill("");
    check(`${theme}/cancelled-clear-send-disabled`, await button("Send to your Agent").isDisabled(), true);
    check(`${theme}/cancelled-clear-explicit-empty`, await page.evaluate(key => sessionStorage.getItem(key), draftKey), "");
    await page.reload(); await button("Send to your Agent").waitFor();
    await capture("cancelled-clear-refresh", { prompt: "", readOnly: false,
      actions: actionsFor("empty"), disabledActions: ["Send to your Agent"] });
    await input.press("Control+Enter"); await input.press("Meta+Enter");
    check(`${theme}/cancelled-clear-no-create`, id, createsBeforeClear);
    check(`${theme}/cancelled-clear-still-explicit-empty`, await page.evaluate(key => sessionStorage.getItem(key), draftKey), "");
    check(`${theme}/cancelled-clear-tab-only`, await page.evaluate(key => localStorage.getItem(key), draftKey), null);
    await send("Race?"); failCancel = true;
    await button("Cancel").click(); await wait("Delivery uncertain");
    await capture("cancel-uncertain", { prompt: "Race?", readOnly: true, actions: ["Check return", "Cancel"], warning: true, report: 1 });
    await lockedEditor("cancel-uncertain");
    failCancel = false; cancelReturnsWork = true;
    await button("Cancel").click(); await wait("Return received"); cancelReturnsWork = false;
    await capture("return-wins-cancel", { prompt: "Race?", readOnly: true, actions: ["Review complete", "Load", "Reset", "Export work"], progress: 0 });
    await lockedEditor("returned");
    await button("Review complete").click(); await wait("Work reviewed");
    await capture("reviewed", { actions: ["Save", "Load", "Reset", "Export work"] });
    await button("Save").click(); await wait("Work saved");
    const saved = await capture("saved", { actions: ["Saved", "Load", "Reset", "Export work"], disabledActions: ["Saved"] });
    check(`${theme}/saved-next`, saved.text.includes("next:"), false);
    await button("Reset").click(); await button("Send to your Agent").waitFor();
    await capture("reset", { prompt: "", readOnly: false, focus: "thought-dock-prompt" });
    await page.reload(); await button("Send to your Agent").waitFor();
    await capture("reset-refresh", { prompt: "", readOnly: false });
    check(`${theme}/reset-retains-history`, await page.evaluate(key => JSON.parse(localStorage.getItem(key)), promptHistoryKey), ["Launch?", "History?"]);
    await button("Open saved works").click();
    await page.locator("#thought-dock-works-select").waitFor();
    await capture("load-panel", { focus: "thought-dock-works-select" });
    check(`${theme}/load-guidance`, (await latest().textContent()).includes("Saved in this browser only—not on-chain or synced."), true);
    await page.locator("#thought-dock-works-select").selectOption({ label: "Race?" }); await wait("Work loaded");
    await capture("loaded", { prompt: "Race?", readOnly: true, actions: ["Saved", "Load", "Reset", "Export work"], disabledActions: ["Saved"] });
    for (const width of [390, 924]) {
      await page.setViewportSize({ width, height: 900 });
      await capture(`loaded-${width}`, { prompt: "Race?" });
    }
    await button("Reset").click(); await capture("ready-924", { actions: actionsFor("empty") });
    await page.setViewportSize({ width: 390, height: 844 });
    await capture("mobile-empty", { actions: ["Load"] });
    await input.fill("Mobile?"); await capture("mobile-ready", { actions: ["Load"], readOnly: false });
    const beforeMobile = id; await input.press("Meta+Enter"); await input.press("Control+Enter");
    check(`${theme}/mobile-shortcut-no-create`, id, beforeMobile);
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const terminal of ["rejected", "expired"]) {
      await send("Terminal?"); status = terminal;
      await wait(terminal === "expired" ? "Task expired" : "Return rejected");
      await capture(terminal, { prompt: "Terminal?", actions: actionsFor(terminal === "expired" ? "expired" : "failed"), progress: 0 });
      await button("Reset").click();
    }
    await send("Retry?"); failRead = true; await wait("Delivery uncertain");
    await capture("uncertain", { readOnly: true, actions: ["Check return", "Cancel"], warning: true, report: 1 });
    failRead = false; await button("Cancel").click();
    await wait("Task cancelled");
    if (await button("Reset").count()) await button("Reset").click();
    failCreate = true; await input.fill("Lost?"); await button("Send to your Agent").click(); await wait("Preparation uncertain");
    await capture("preparation-uncertain", { actions: ["Return to THOUGHT"], readOnly: true, report: 1, warning: true });
    await lockedEditor("preparation-uncertain");
    check(`${theme}/external`, external, []); check(`${theme}/errors`, errors, []);
    records.push({ theme, interceptedApiRequests: requests, actualApiRequests: 0, nativeLaunches: 0, errors, external });
    await context.close();
  }
  await writeFile(`${out}/report.json`, JSON.stringify({ baseline, failures, records }, null, 2) + "\n");
  console.log(JSON.stringify({ out, failures, captures: records.length }));
  if (!observe) assert.equal(failures.length, 0, "Baseline-derived presenter parity");
} finally { await browser.close(); }

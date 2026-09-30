import "@fontsource/source-code-pro/200.css";
import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/500.css";
import "@fontsource/source-code-pro/600.css";
import "@fontsource/source-code-pro/700.css";
import "@fontsource/source-code-pro/800.css";
import "@fontsource/source-code-pro/900.css";
import "@fontsource-variable/roboto-mono/wght.css";
import "@inshell/shared/design.css";
import "./view.css";
import { PREVIEW_WATERMARK_LABEL, shouldShowPreviewWatermark } from "@inshell/shared";
import { mountThoughtShell } from "../thought-shell";
import { PlainClient, readEarlierWorks, readSaved } from "./client";
import { createBrief } from "./model";
import { thoughtV2EmptyFrameCanvasRect } from "../thought-v2-empty-frame";
import { formatSavedWorkPromptLabel, type WorkStorage } from "../works";
import { appendThoughtConsoleEvent, buildThoughtConsoleLines,
  parseThoughtConsoleHistory, serializeThoughtConsoleHistory, thoughtConsoleVisualRole,
  THOUGHT_CONSOLE_EMPTY_TITLE, THOUGHT_CONSOLE_EMPTY_DETAIL, type ThoughtConsoleTone } from "../thought-console";
import { openFailureReport } from "../thought-failure-report";
import { appendThoughtPromptHistory, navigateThoughtPromptHistory, parseThoughtPromptHistory, type ThoughtPromptHistoryCursor } from "../thought-prompt-history";
import { THOUGHT_V2_ALLOWED_CHARACTERS, THOUGHT_V2_PUNCTUATION } from "../../contract-integration/current/reference/thought-v2-terminal-work-profile";
import { assertDeploymentOverrides } from "../thought-v2-production-deployment";

// No main.ts import: none of its legacy Agent, wallet-to-mint or RPC handlers run.
// Integrity remains enforced even though this surface has no mint capability.
assertDeploymentOverrides(import.meta.env);
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
document.documentElement.classList.remove("cli-surface", "debug-cli");
document.documentElement.classList.add("agent-surface");
document.body.dataset.thoughtTransport = "plain-experimental";
mountThoughtShell(element("thought-shell-root"), 0, undefined, true);
if (shouldShowPreviewWatermark({ env: import.meta.env })) {
  const watermark = document.createElement("div");
  watermark.className = "inshell-preview-watermark";
  watermark.textContent = PREVIEW_WATERMARK_LABEL;
  watermark.setAttribute("aria-hidden", "true");
  document.body.append(watermark);
}
const prompt = element<HTMLInputElement>("thought-dock-prompt");
const actions = element("thought-dock-action-area");
const actionGroup = document.createElement("div");
actionGroup.className = "thought-dock-actions";
const consoleBody = element("thought-dock-details-body");
const consolePanel = element("thought-dock-details");
const library = element("thought-dock-works");
const librarySelect = element<HTMLSelectElement>("thought-dock-works-select");
const preview = element<HTMLImageElement>("thought-svg-preview");
// Resolve browser storage only when used: blocked storage must not blank the UI.
const storage = (kind: "sessionStorage" | "localStorage"): WorkStorage => ({
  getItem: key => window[kind].getItem(key),
  setItem: (key, value) => window[kind].setItem(key, value),
  removeItem: key => window[kind].removeItem(key),
});
const savedStorage = storage("localStorage");
const client = new PlainClient(storage("sessionStorage"), savedStorage);
let task = "";
let launched = false;
let enabled = false;
let imageUrl = "";
let shownWork = "";
let rendering = "";
let actionError: { title: string; detail: string; nextStep?: string; report?: boolean } | null = null;
let actionErrorState = client.state;
let libraryOpen = false;
let loaded = false;
let historical: ReturnType<typeof readEarlierWorks>[number] | null = null;
let cancelling = false;
const mobileAgentMedia = window.matchMedia("(max-width: 760px), ((max-height: 500px) and (orientation: landscape) and (pointer: coarse))");
mobileAgentMedia.addEventListener("change", () => { rendering = ""; render(); });
// Same privacy classes as the formal editor, separate from its storage keys:
// unsubmitted draft is tab-only; launched prompt history is browser-local.
const draftKey = "inshell.thought.plain-http.draft.v1";
const promptHistoryKey = "inshell.thought.plain-http.prompt-history.v1";
const promptHistoryLimit = 50;
function readDraft() {
  try { return window.sessionStorage.getItem(draftKey); } catch { return null; }
}
function writeDraft() {
  try {
    // Empty is an explicit edit, not an absent draft: do not revive a cancelled prompt on refresh.
    window.sessionStorage.setItem(draftKey, prompt.value);
  } catch { /* Denied storage must not prevent editing. Never fall back to localStorage. */ }
}
let promptHistory = parseThoughtPromptHistory((() => {
  try { return window.localStorage.getItem(promptHistoryKey) ?? window.sessionStorage.getItem(promptHistoryKey); }
  catch { try { return window.sessionStorage.getItem(promptHistoryKey); } catch { return null; } }
})(), promptHistoryLimit);
let promptCursor: ThoughtPromptHistoryCursor = { index: null, draft: "" };
function recordPrompt() {
  promptHistory = appendThoughtPromptHistory(promptHistory, prompt.value, promptHistoryLimit);
  try { window.localStorage.setItem(promptHistoryKey, JSON.stringify(promptHistory)); }
  catch { try { window.sessionStorage.setItem(promptHistoryKey, JSON.stringify(promptHistory)); } catch { /* Memory-only history. */ } }
  promptCursor = { index: null, draft: "" };
}
const canEditPrompt = () => enabled && !historical && !cancelling && (client.state === "idle" || client.state === "cancelled");
const historyKey = "inshell.thought.plain-http.console.v1";
let history = parseThoughtConsoleHistory((() => {
  try { return sessionStorage.getItem(historyKey); } catch { return null; }
})());
let attemptId = history.entries.at(-1)?.context.attemptId ?? window.crypto.randomUUID();
let lastMessage = "";
element("thought-dock-details").hidden = false;
consoleBody.setAttribute("aria-live", "polite");
actions.dataset.content = "actions";
// Reject invalid input without silently truncating pasted artistic bytes.
prompt.removeAttribute("maxlength");
prompt.addEventListener("input", () => {
  if (!canEditPrompt()) return;
  promptCursor = { index: null, draft: "" };
  writeDraft();
  actionError = null;
  prompt.removeAttribute("aria-invalid");
  render();
});
prompt.addEventListener("keydown", event => {
  if (!canEditPrompt() || event.isComposing || event.repeat) return;
  if (!event.metaKey && !event.ctrlKey && !event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) {
    const navigation = navigateThoughtPromptHistory({ history: promptHistory, cursor: promptCursor,
      currentValue: prompt.value, direction: event.key === "ArrowUp" ? "older" : "newer" });
    if (!navigation.handled) return;
    event.preventDefault();
    prompt.value = navigation.value;
    promptCursor = { index: navigation.index, draft: navigation.draft };
    actionError = null; prompt.removeAttribute("aria-invalid"); writeDraft(); render();
    try { prompt.setSelectionRange(prompt.value.length, prompt.value.length); } catch { /* IME may reject selection. */ }
  } else if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === "Enter" && !mobileAgentMedia.matches) {
    event.preventDefault();
    // Use the same synchronous disabled latch and validation as an explicit click.
    Array.from(actionGroup.querySelectorAll("button")).find(control => control.textContent === "Send to your Agent")?.click();
  }
});

function paintEmptyFrame() {
  const canvas = element<HTMLCanvasElement>("thought-grid");
  const css = window.getComputedStyle(canvas);
  const frame = {
    canvasSize: Number(css.getPropertyValue("--thought-work-canvas-size")),
    inset: Number(css.getPropertyValue("--thought-work-frame-inset")),
    color: css.getPropertyValue("--thought-work-frame-color").trim(),
  };
  // The same artboard and pure inset rule as the default surface. CSS scales
  // this square with its container; no legacy Agent, wallet or RPC initializer.
  canvas.width = canvas.height = frame.canvasSize + frame.inset * 2;
  const context = canvas.getContext("2d")!;
  const rect = thoughtV2EmptyFrameCanvasRect(canvas.width, canvas.height, frame);
  context.fillStyle = frame.color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = css.getPropertyValue("--thought-art-canvas-bg").trim();
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}
paintEmptyFrame();

// Mirror the formal layout's canvas-derived identity and panel dimensions,
// without mounting its execution, wallet or chain controllers.
const frameElement = document.querySelector<HTMLElement>(".thought-canvas-frame")!;
new window.ResizeObserver(() => {
  const rect = frameElement.getBoundingClientRect();
  document.querySelector<HTMLElement>(".frontpage-stage")!.style.setProperty("--thought-create-identity-width", `${rect.width}px`);
  document.documentElement.style.setProperty("--thought-cli-height", `${rect.height}px`);
}).observe(frameElement);

function renderHistory() {
  const scrollTop = consolePanel.scrollTop;
  const previous = consoleBody.dataset.newestEntryId;
  const newest = history.entries.at(-1)?.id;
  // Append order is authoritative: second-resolution timestamps can tie, and
  // historical guidance must never outrank a later successful state.
  const nodes = [...history.entries].reverse().map(entry => {
    const article = document.createElement("article");
    article.className = "thought-dock-status-screen__entry";
    article.dataset.consoleEntryId = entry.id;
    article.dataset.consoleKind = entry.kind;
    article.dataset.attemptId = entry.context.attemptId;
    article.classList.toggle("is-latest", entry.id === newest);
    article.classList.toggle("is-current-attempt", entry.context.attemptId === attemptId);
    const guidance = thoughtConsoleVisualRole(entry) === "guidance";
    // History remains readable, but obsolete actions must not look current.
    const lines = buildThoughtConsoleLines({ ...entry, nextStep: entry.id === newest ? entry.nextStep : undefined });
    for (const [index, text] of lines.entries()) {
      const line = document.createElement("p");
      line.className = ["thought-dock-status-screen__line", index === 0 ? "thought-dock-status-screen__line--heading" : "",
        guidance ? "thought-dock-status-screen__line--guidance" : "",
        entry.tone === "neutral" ? "" : `thought-dock-status-screen__line--${entry.tone}`].filter(Boolean).join(" ");
      if (index === 0) {
        line.append(`[${entry.time}] `);
        const title = document.createElement("span");
        title.textContent = entry.title;
        line.append(title);
        if (entry.id === newest && (client.state === "preparing" || (client.state === "waiting" && (!task || launched))) && !actionError && !libraryOpen) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "thought-progress-ellipsis is-active";
          ellipsis.setAttribute("aria-hidden", "true");
          for (let i = 0; i < 3; i++) {
            const dot = document.createElement("span");
            dot.className = "thought-progress-ellipsis__dot";
            dot.textContent = ".";
            ellipsis.append(dot);
          }
          line.append(ellipsis);
        }
      } else line.textContent = text;
      article.append(line);
    }
    if (entry.kind === "work_failed") {
      const line = document.createElement("p");
      line.className = "thought-dock-status-screen__line thought-dock-status-screen__line--guidance";
      const report = document.createElement("button");
      report.type = "button";
      report.className = "thought-dock-status-screen__link thought-dock-status-screen__action";
      report.textContent = "[ Report this problem ]";
      report.setAttribute("aria-label", "Review a sanitized problem report");
      report.addEventListener("click", () => openFailureReport({ agent: "unknown", surface: "THOUGHT experimental return",
        appVersion: "unknown", build: "unknown", stage: "app-run" }));
      line.append(report);
      article.append(line);
    }
    return article;
  });
  consoleBody.replaceChildren(...nodes);
  consoleBody.dataset.newestEntryId = newest ?? "";
  consolePanel.scrollTop = previous !== newest || scrollTop <= 2 ? 0 : scrollTop;
}

function message(title: string, detail: string, tone: ThoughtConsoleTone = "neutral", nextStep?: string) {
  if (libraryOpen && !actionError) {
    title = "Load a saved work";
    detail = "Saved in this browser only—not on-chain or synced.";
    tone = "neutral";
    nextStep = undefined;
  }
  title = actionError?.title ?? title;
  detail = actionError?.detail ?? detail;
  if (actionError) tone = actionError.report ? "error" : "warning";
  const failure = Boolean(actionError?.report) || ["uncertain", "preparation-uncertain", "rejected", "unavailable"].includes(client.state);
  if (actionError) nextStep = actionError.nextStep ?? "Edit the prompt above";
  const signature = JSON.stringify([attemptId, title, detail, tone, nextStep]);
  if (signature !== lastMessage) {
    lastMessage = signature;
    history = appendThoughtConsoleEvent(history, { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      kind: failure ? "work_failed" : tone === "warning" || tone === "error" ? "work_attention" : "work_activity",
      context: { attemptId }, title, detail, tone, nextStep });
    history = { ...history, entries: history.entries.slice(-80) };
    try { sessionStorage.setItem(historyKey, serializeThoughtConsoleHistory(history)); } catch { /* History cannot block work. */ }
  }
  renderHistory();
}
function button(label: string, action: () => void | Promise<void>, options: { disabled?: boolean; ariaLabel?: string; expanded?: boolean } = {}) {
  const control = document.createElement("button");
  control.className = "thought-dock-button thought-work-cta";
  control.type = "button";
  control.textContent = label;
  control.disabled = Boolean(options.disabled);
  if (options.ariaLabel) control.setAttribute("aria-label", options.ariaLabel);
  if (options.expanded !== undefined) control.setAttribute("aria-expanded", String(options.expanded));
  control.addEventListener("click", () => {
    control.disabled = true;
    actionError = null;
    void Promise.resolve().then(action).catch(() => {
      // Keep feedback visible across the final render and background polls.
      // Ambiguous transport states supply their own more specific guidance.
      if (!["preparation-uncertain", "uncertain"].includes(client.state)) {
        actionErrorState = client.state;
        actionError = label === "Save"
          ? { title: "Work not saved", detail: "This browser could not store the work. Keep this page open.", nextStep: "Allow browser storage, then save again", report: true }
          : { title: "Action unavailable", detail: "The action could not finish. Keep this page open.", nextStep: "Review the problem before continuing; do not resubmit the task", report: true };
      }
    }).finally(() => { rendering = ""; render(); });
  });
  actionGroup.append(control);
  return control;
}
librarySelect.addEventListener("change", () => {
  if (!librarySelect.value) return;
  try {
    if (librarySelect.value.startsWith("historical:")) {
      const earlier = readEarlierWorks(savedStorage).find(work => work.runId === librarySelect.value);
      if (!earlier) throw new Error("Historical work missing");
      client.reset(); historical = earlier;
    } else { client.load(librarySelect.value); historical = null; }
    loaded = true; libraryOpen = false; actionError = null;
  }
  catch { actionErrorState = client.state; actionError = { title: "Work not loaded", detail: "The browser could not restore this saved work. Keep the current work open.", nextStep: "Check browser storage before loading again", report: true }; }
  render();
});
function render() {
  if (actionError && (client.state !== actionErrorState || client.conflict)) actionError = null;
  const signature = JSON.stringify([enabled, client.state, client.work?.runId, historical?.runId, client.reviewed, client.conflict, Boolean(task), launched, cancelling, actionError, libraryOpen, loaded, prompt.value]);
  if (signature === rendering) return;
  rendering = signature;
  actionGroup.replaceChildren();
  actions.replaceChildren(actionGroup);
  actions.hidden = false;
  prompt.disabled = !enabled;
  prompt.readOnly = Boolean(historical) || (client.state !== "idle" && client.state !== "cancelled");
  library.classList.add("is-hidden");
  const work = historical ?? client.work;
  if (work && shownWork !== work.runId) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(new Blob([work.svg], { type: "image/svg+xml" }));
    preview.src = imageUrl;
    preview.alt = `THOUGHT: ${work.promptLine} — ${work.agentLine}`;
    preview.classList.remove("is-hidden");
    element("thought-grid").classList.add("is-hidden");
    prompt.value = work.promptLine;
    shownWork = work.runId;
  }
  if (!work) {
    if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = ""; preview.removeAttribute("src"); }
    preview.classList.add("is-hidden");
    element("thought-grid").classList.remove("is-hidden");
    shownWork = "";
  }
  if (historical) {
    message("Earlier work loaded", "Read-only preview of a saved work. Its original record is unchanged; it is not a new return and cannot be minted here.");
    button("Saved", () => {}, { disabled: true });
  } else if (!enabled) {
    message("Creation unavailable", "The App cannot receive a new work right now. Your saved works remain in this browser.", "warning");
  } else if (client.conflict) {
    message("Conflicting return", "A different response was rejected. The first response is retained for inspection, not minting.", "warning", "Inspect this work, then reset when ready");
  } else if (client.state === "idle" || client.state === "cancelled") {
    if (mobileAgentMedia.matches) message("Continue on desktop", "ChatGPT and Claude creation require the desktop THOUGHT App. Open this page on desktop to create and save a THOUGHT.");
    else if (client.state === "cancelled") message("Task cancelled", "This task can no longer receive a response. Edit the prompt or send it as a new task.");
    else message(THOUGHT_CONSOLE_EMPTY_TITLE, THOUGHT_CONSOLE_EMPTY_DETAIL);
    if (!mobileAgentMedia.matches) button("Send to your Agent", async () => {
      if (!canEditPrompt() || mobileAgentMedia.matches) return;
      try { createBrief("plain_validate", prompt.value); }
      catch {
        actionErrorState = client.state;
        actionError = !prompt.value.length
          ? { title: "Prompt is empty", detail: "Write one short prompt before sending it to your Agent. Nothing was sent." }
          : [...prompt.value].some(character => !THOUGHT_V2_ALLOWED_CHARACTERS.includes(character))
            ? { title: "Unsupported characters", detail: `Use English letters, digits, spaces or punctuation: ${[...THOUGHT_V2_PUNCTUATION].join(" ")}. Nothing was sent.` }
            : prompt.value.length > 64
              ? { title: "Prompt is too long", detail: "Keep your prompt within 64 characters. Nothing was shortened or sent." }
              : { title: "Prompt spacing needs editing", detail: "Remove leading, trailing or repeated spaces. Nothing was changed or sent." };
        prompt.setAttribute("aria-invalid", "true");
        prompt.focus();
        return;
      }
      // Only an explicit new Send may leave a confirmed cancellation. No replay.
      if (client.state === "cancelled") client.reset();
      task = ""; launched = false; libraryOpen = false; loaded = false;
      attemptId = window.crypto.randomUUID();
      const pending = client.create(prompt.value); render(); task = await pending;
    }, { disabled: prompt.value.length === 0 });
  } else if (client.state === "preparing") {
    message("Preparing task", "Keep this page open.");
  } else if (client.state === "waiting") {
    message(task && !launched ? "Task ready" : "Waiting for the return", task && !launched
      ? 'Choose your Agent and submit the prefilled task once. For Claude, use a fresh chat with "No folder"; this task needs no repository access. Its response will return here automatically.'
      : 'Check your Agent for any permission request. For Claude, use a fresh chat with "No folder". Do not submit the task again.', "warning");
    if (task && !launched && !mobileAgentMedia.matches) {
      // Explicit trusted click; no automatic app launch during creation/reload.
      for (const [label, prefix, key] of [["ChatGPT", "codex://new?", "prompt"], ["Claude", "claude://code/new?", "q"]]) {
        const link = document.createElement("a");
        link.className = "thought-dock-button thought-work-cta";
        link.textContent = label;
        link.href = prefix + new URLSearchParams({ [key]: task });
        link.addEventListener("click", event => {
          if (cancelling || mobileAgentMedia.matches) { event.preventDefault(); return; }
          recordPrompt();
          launched = true; task = ""; globalThis.queueMicrotask(render);
        }, { once: true });
        actionGroup.append(link);
      }
    }
    if (!task || launched) button("Check return", () => client.check());
    button("Cancel", cancelTask, { disabled: cancelling });
  } else if (client.state === "review" || client.state === "saved") {
    task = "";
    message(client.state === "saved" ? loaded ? "Work loaded" : "Work saved" : client.reviewed ? "Work reviewed" : "Return received", client.state === "saved"
      ? "Stored in this browser. This experimental work is not eligible for minting."
      : client.reviewed ? "Save the reviewed work in this browser to keep it. This experimental work cannot be minted."
      : "Review the returned work above. Provider and model are unknown; start-only creation is not established. This work cannot be minted.", "success");
    if (client.state === "review") button(client.reviewed ? "Save" : "Review complete", () => { if (client.reviewed) client.save(); else client.review(); });
    if (client.state === "saved") button("Saved", () => {}, { disabled: true });
    if (client.canInspect) button("Check return", () => client.check());
    button("Export work", () => {
      const record = client.exportWork();
      const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${record.work.runId}-${record.stage}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, { ariaLabel: "Export artwork record without credentials" });
  } else if (client.state === "preparation-uncertain") {
    task = "";
    message("Preparation uncertain", "A task may have been prepared, but this page has no recovery access. It cannot check or cancel that task. Do not submit it again.", "warning", "Keep this page open and check the Agent task before starting another work");
    const exit = document.createElement("a");
    exit.className = "thought-dock-button thought-work-cta";
    exit.href = "/thought/";
    exit.textContent = "Return to THOUGHT";
    actionGroup.append(exit);
  } else if (client.state === "uncertain") {
    message("Delivery uncertain", "The App may already have accepted the work. Do not generate or submit again.", "warning", "Check the return");
    button("Check return", () => client.check());
    button("Cancel", cancelTask, { disabled: cancelling });
  } else if (client.state === "rejected") {
    message("Return rejected", "The response did not meet this task's rules. Do not resend this task.", "error", "Reset when ready for a new work");
  } else if (client.state === "expired") {
    message("Task expired", "This exchange has reached its time limit. Do not resend this task.", "warning", "Reset when ready for a new work");
  } else {
    message("Exchange closed", "No replacement response is accepted for this task.");
  }
  if (!["waiting", "preparing", "uncertain", "preparation-uncertain"].includes(client.state)) {
    if (["idle", "cancelled", "review", "saved"].includes(client.state)) button(libraryOpen ? "Load ↓" : "Load", () => {
      libraryOpen = !libraryOpen;
      if (libraryOpen) window.requestAnimationFrame(() => librarySelect.focus({ preventScroll: true }));
    }, {
      ariaLabel: libraryOpen ? "Collapse saved works" : "Open saved works", expanded: libraryOpen,
    });
    if (historical || (client.state !== "idle" && client.state !== "cancelled")) button("Reset", () => {
      historical = null;
      client.reset(); task = ""; launched = false; prompt.value = ""; loaded = false; libraryOpen = false;
      promptCursor = { index: null, draft: "" }; writeDraft();
      attemptId = window.crypto.randomUUID();
      message("Work reset", "Prompt, current work, and open panels cleared.");
      window.requestAnimationFrame(() => prompt.focus({ preventScroll: true }));
    });
    if (libraryOpen) {
      const saved = [...readSaved(savedStorage)].reverse();
      const earlierWorks = [...readEarlierWorks(savedStorage)].reverse();
      const placeholder = new Option(saved.length + earlierWorks.length ? "Load a saved work" : "No saved works", "");
      placeholder.disabled = true;
      librarySelect.replaceChildren(placeholder, ...[...saved, ...earlierWorks].map(item => {
        const option = new Option((item.runId.startsWith("historical:") ? "Earlier: " : "") + formatSavedWorkPromptLabel(item.promptLine), item.runId);
        option.title = item.promptLine;
        return option;
      }));
      librarySelect.value = work?.runId ?? "";
      if (!librarySelect.value) placeholder.selected = true;
      librarySelect.disabled = !(saved.length + earlierWorks.length);
      library.classList.remove("is-hidden");
    }
  }
  actions.hidden = !actionGroup.childElementCount;
  element("thought-dock").dataset.rail = actions.hidden ? "hidden" : "visible";
}
async function cancelTask() {
  cancelling = true;
  render();
  try {
    await client.cancel();
    if (client.state === "cancelled") {
      task = ""; launched = false; libraryOpen = false;
      writeDraft();
      window.requestAnimationFrame(() => prompt.focus({ preventScroll: true }));
    }
  } finally { cancelling = false; }
}
async function start() {
  try {
    await client.available(); enabled = true;
    const draft = readDraft(); prompt.value = draft ?? "";
    client.restore();
    if (client.pendingPrompt !== null) prompt.value = client.pendingPrompt;
    await client.check();
    if (client.state === "cancelled" && draft !== null) prompt.value = draft;
  }
  catch { enabled = false; }
  render();
  window.setInterval(() => { if (enabled) void client.poll().then(render); }, 2000);
}
void start();

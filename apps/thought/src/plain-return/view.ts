import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource-variable/roboto-mono/wght.css";
import "@inshell/shared/design.css";
import "./view.css";
import { PREVIEW_WATERMARK_LABEL, shouldShowPreviewWatermark } from "@inshell/shared";
import { mountThoughtShell } from "../thought-shell";
import { PlainClient, readSaved } from "./client";
import { createBrief } from "./model";
import { thoughtV2EmptyFrameCanvasRect } from "../thought-v2-empty-frame";
import type { WorkStorage } from "../works";
import { THOUGHT_V2_ALLOWED_CHARACTERS, THOUGHT_V2_PUNCTUATION } from "../../contract-integration/current/reference/thought-v2-terminal-work-profile";

// No main.ts import: none of its legacy Agent, wallet-to-mint or RPC handlers run.
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
let actionError: { title: string; detail: string } | null = null;
let actionErrorState = client.state;
element("thought-dock-details").hidden = false;
consoleBody.setAttribute("aria-live", "polite");
actions.dataset.content = "actions";
// Reject invalid input without silently truncating pasted artistic bytes.
prompt.removeAttribute("maxlength");
prompt.addEventListener("input", () => {
  actionError = null;
  prompt.removeAttribute("aria-invalid");
  render();
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

function message(title: string, detail: string) {
  const heading = document.createElement("p");
  heading.className = "thought-dock-status-screen__line thought-dock-status-screen__line--heading";
  heading.textContent = actionError?.title ?? title;
  const body = document.createElement("p");
  body.className = "thought-dock-status-screen__line thought-dock-status-screen__line--guidance";
  body.textContent = actionError?.detail ?? detail;
  consoleBody.replaceChildren(heading, body);
}
function button(label: string, action: () => void | Promise<void>) {
  const control = document.createElement("button");
  control.className = "thought-dock-button thought-work-cta";
  control.type = "button";
  control.textContent = label;
  control.addEventListener("click", () => {
    control.disabled = true;
    actionError = null;
    void Promise.resolve().then(action).catch(() => {
      // Keep feedback visible across the final render and background polls.
      // Ambiguous transport states supply their own more specific guidance.
      if (!["preparation-uncertain", "uncertain"].includes(client.state)) {
        actionErrorState = client.state;
        actionError = label === "Save"
          ? { title: "Work not saved", detail: "This browser could not store the work. Keep this page open and allow browser storage before saving again." }
          : { title: "Action unavailable", detail: "The action could not finish. Keep this page open and check the work before continuing." };
      }
    }).finally(() => { rendering = ""; render(); });
  });
  actionGroup.append(control);
}
function render() {
  if (actionError && (client.state !== actionErrorState || client.conflict)) actionError = null;
  const signature = JSON.stringify([enabled, client.state, client.work?.runId, client.reviewed, client.conflict, Boolean(task), launched, actionError]);
  if (signature === rendering) return;
  rendering = signature;
  actionGroup.replaceChildren();
  actions.replaceChildren(actionGroup);
  actions.hidden = false;
  prompt.disabled = !enabled || client.state !== "idle";
  const work = client.work;
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
  if (!enabled) { message("Experimental return unavailable", "This App has not enabled this test path. Return to the regular THOUGHT page."); return; }
  if (client.conflict) {
    message("Conflicting return", "A different response was rejected. The first response is retained for inspection, not minting.");
  } else if (client.state === "idle") {
    message("Experimental creation", "Write one short prompt. Returned work can be saved here, but cannot be minted.");
    button("Send to your Agent", async () => {
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
      const pending = client.create(prompt.value); render(); task = await pending;
    });
  } else if (client.state === "preparing") {
    message("Preparing task", "Keep this page open.");
  } else if (client.state === "waiting") {
    message(task && !launched ? "Task ready" : "Waiting for the return", task && !launched
      ? 'Choose your Agent and submit the prefilled task once. For Claude, use a fresh chat with "No folder"; this task needs no repository access. Its response will return here automatically.'
      : "Check your Agent for any permission request. Do not submit the task again.");
    if (task && !launched) {
      // Explicit trusted click; no automatic app launch during creation/reload.
      for (const [label, prefix, key] of [["ChatGPT", "codex://new?", "prompt"], ["Claude", "claude://code/new?", "q"]]) {
        const link = document.createElement("a");
        link.className = "thought-dock-button thought-work-cta";
        link.textContent = label;
        link.href = prefix + new URLSearchParams({ [key]: task });
        link.addEventListener("click", () => { launched = true; task = ""; globalThis.queueMicrotask(render); }, { once: true });
        actionGroup.append(link);
      }
    }
    if (!task || launched) button("Check return", () => client.check());
    button("Cancel", () => client.cancel());
  } else if (client.state === "review" || client.state === "saved") {
    task = "";
    message(client.state === "saved" ? "Work saved" : "Return received", client.state === "saved"
      ? "Stored in this browser. This experimental work is not eligible for minting."
      : `Review the exact response: ${work?.agentLine}\nProvider and model are unknown; start-only creation is not established. This work cannot be minted.`);
    if (client.state === "review") button(client.reviewed ? "Save" : "Review complete", () => { if (client.reviewed) client.save(); else client.review(); });
    if (client.canInspect) button("Check return", () => client.check());
  } else if (client.state === "preparation-uncertain") {
    task = "";
    message("Preparation uncertain", "A task may have been prepared, but this page has no recovery access. It cannot check or cancel that task. Do not submit it again. You can leave for the regular THOUGHT page.");
    const exit = document.createElement("a");
    exit.className = "thought-dock-button thought-work-cta";
    exit.href = "/thought/";
    exit.textContent = "Return to THOUGHT";
    actionGroup.append(exit);
  } else if (client.state === "uncertain") {
    message("Delivery uncertain", "The App may already have accepted the work. Check the return; do not generate or submit again.");
    button("Check return", () => client.check());
    button("Cancel", () => client.cancel());
  } else if (client.state === "rejected") {
    message("Return rejected", "The response did not meet this task's rules. Reset to begin a new work; do not resend this task.");
  } else if (client.state === "cancelled") {
    message("Task cancelled", "This task can no longer receive a response. Reset when you are ready for a new work.");
  } else if (client.state === "expired") {
    message("Task expired", "This exchange has reached its time limit. Reset to begin a new work; do not resend this task.");
  } else {
    message("Exchange closed", "No replacement response is accepted for this task.");
  }
  if (!["waiting", "preparing", "uncertain", "preparation-uncertain"].includes(client.state)) {
    if (client.state !== "idle") button("Reset", () => { client.reset(); task = ""; launched = false; prompt.value = ""; });
    const saved = readSaved(savedStorage);
    if (saved.length) {
      const select = document.createElement("select");
      select.className = "thought-dock-button thought-work-cta";
      select.setAttribute("aria-label", "Load saved experimental work");
      select.add(new Option("Load", ""));
      for (const item of saved) select.add(new Option(item.promptLine, item.runId));
      select.addEventListener("change", () => { if (select.value) { client.load(select.value); render(); } });
      actionGroup.append(select);
    }
  }
}
async function start() {
  try { await client.available(); enabled = true; client.restore(); await client.check(); }
  catch { enabled = false; }
  render();
  window.setInterval(() => { if (enabled) void client.poll().then(render); }, 2000);
}
void start();

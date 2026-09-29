import "@fontsource/source-code-pro/300.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource-variable/roboto-mono/wght.css";
import "@inshell/shared/design.css";
import "./view.css";
import { PREVIEW_WATERMARK_LABEL, shouldShowPreviewWatermark } from "@inshell/shared";
import { mountThoughtShell } from "../thought-shell";
import { PlainClient, readSaved } from "./client";

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
const client = new PlainClient(sessionStorage, localStorage);
let task = "";
let launched = false;
let enabled = false;
let imageUrl = "";
let shownWork = "";
let rendering = "";
element("thought-dock-details").hidden = false;
consoleBody.setAttribute("aria-live", "polite");
actions.dataset.content = "actions";
prompt.maxLength = 64;

function message(title: string, detail: string) {
  const heading = document.createElement("p");
  heading.className = "thought-dock-status-screen__line thought-dock-status-screen__line--heading";
  heading.textContent = title;
  const body = document.createElement("p");
  body.className = "thought-dock-status-screen__line thought-dock-status-screen__line--guidance";
  body.textContent = detail;
  consoleBody.replaceChildren(heading, body);
}
function button(label: string, action: () => void | Promise<void>) {
  const control = document.createElement("button");
  control.className = "thought-dock-button thought-work-cta";
  control.type = "button";
  control.textContent = label;
  control.addEventListener("click", () => {
    control.disabled = true;
    void Promise.resolve().then(action).catch(() => {
      message("Action unavailable", "Nothing was resubmitted. Check this work before continuing.");
    }).finally(() => { rendering = ""; render(); });
  });
  actionGroup.append(control);
}
function render() {
  const signature = JSON.stringify([enabled, client.state, client.work?.runId, client.reviewed, client.conflict, Boolean(task), launched]);
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
    preview.classList.add("is-hidden");
    element("thought-grid").classList.remove("is-hidden");
    shownWork = "";
  }
  if (!enabled) { message("Experimental return unavailable", "This App has not enabled this test path. Return to the regular THOUGHT page."); return; }
  if (client.conflict) {
    message("Conflicting return", "A different response was rejected. The first response is retained for inspection, not minting.");
  } else if (client.state === "idle") {
    message("Experimental creation", "Write one short prompt. Returned work can be saved here, but cannot be minted.");
    button("Send to your Agent", async () => { const pending = client.create(prompt.value); render(); task = await pending; });
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
  } else {
    message("Exchange closed", "No replacement response is accepted for this task.");
  }
  if (!["waiting", "preparing", "uncertain", "preparation-uncertain"].includes(client.state)) {
    if (client.state !== "idle") button("Reset", () => { client.reset(); task = ""; launched = false; prompt.value = ""; });
    const saved = readSaved(localStorage);
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

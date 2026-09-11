import "./problem-report.css";
import { failureReportSummary, type FailureReportContext } from "./problem-report-data";

export function openProblemReport(context: FailureReportContext): void {
  document.querySelector("#thought-failure-report")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "thought-failure-report";
  dialog.className = "thought-failure-report";
  dialog.setAttribute("aria-labelledby", "failure-report-title");
  const title = document.createElement("h2");
  title.id = "failure-report-title"; title.textContent = "Report a problem";
  title.tabIndex = -1;
  const note = document.createElement("p");
  note.textContent = "Tell us what went wrong. You can review the report before sharing it.";
  const label = (text: string, id: string) => {
    const element = document.createElement("label");
    element.textContent = text; element.htmlFor = id;
    return element;
  };
  const version = document.createElement("input");
  version.maxLength = 100; version.placeholder = "Agent version (optional)";
  version.setAttribute("aria-label", "Agent version (optional)");
  version.id = "failure-agent-version";
  const agentRelated = context.stage !== "site-feedback";
  const details = document.createElement("div");
  if (agentRelated) details.append(label("Agent version (optional)", version.id), version);
  const description = document.createElement("textarea");
  description.maxLength = 1000; description.placeholder = "What happened? (optional)";
  description.setAttribute("aria-label", "Description (optional)");
  description.id = "failure-description"; description.rows = 3;
  description.placeholder = "Describe what you expected and what happened.";
  const summary = document.createElement("textarea");
  summary.readOnly = true; summary.rows = 12;
  summary.setAttribute("aria-label", "Sanitized report preview");
  summary.id = "failure-report-preview"; summary.rows = 8;
  const send = document.createElement("a"); send.textContent = "Continue to GitHub ↗";
  send.className = "report-primary";
  send.target = "_blank"; send.rel = "noopener noreferrer"; send.referrerPolicy = "no-referrer";
  const close = document.createElement("button"); close.textContent = "Close";
  const privacy = document.createElement("p");
  privacy.className = "report-privacy";
  privacy.textContent = "GitHub issues are public. Don’t include private information. Nothing is sent automatically.";
  const actions = document.createElement("div"); actions.className = "report-actions";
  actions.append(close, send);
  const update = () => {
    summary.value = failureReportSummary(context, navigator.userAgent, version.value, description.value);
    // Existing public issue destination; never reuse page/search/handoff URLs.
    const url = new URL("https://github.com/inshell-art/inshell.art/issues/new");
    url.searchParams.set("title", context.stage === "site-feedback" ? "Inshell problem report" : "THOUGHT Agent run problem");
    url.searchParams.set("body", summary.value);
    send.href = url.href;
  };
  version.addEventListener("input", update); description.addEventListener("input", update);
  const previous = document.activeElement;
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { dialog.remove(); if (previous instanceof HTMLElement) previous.focus(); });
  dialog.append(title, note, label("What happened? (optional)", description.id), description,
    details, label("Technical details", summary.id), summary, privacy, actions);
  document.body.append(dialog); update(); dialog.showModal(); title.focus();
}

export function openSiteProblemReport(build = "unknown"): void {
  const section = window.location.pathname.split("/").filter(Boolean)[0] ?? "home";
  const surface = ["home", "path", "thought", "gallery", "docs", "pulse", "color-font", "will", "verify"].includes(section) ? section : "other";
  openProblemReport({ agent: "not applicable", surface, appVersion: "unknown", build, stage: "site-feedback" });
}
export function installSiteProblemReporting(build = "unknown"): () => void {
  const click = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest("a.inshell-report-bug-link") : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openSiteProblemReport(build);
  };
  document.addEventListener("click", click);
  return () => document.removeEventListener("click", click);
}

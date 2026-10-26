import "./ga4.css";
import { installGa4 } from "./ga4";
import { GA4_NOTICE, ga4Screen } from "./ga4-policy";

export function mountGa4Choice(env: Record<string, unknown>) {
  if (document.getElementById("inshell-ga4-choice")) return;
  const controller = installGa4(env);
  // No solicitation on preview/local/disabled builds. Settings still allow an
  // operator to persist browser exclusion before a future production release.
  const root = document.createElement("aside");
  root.id = "inshell-ga4-choice";
  root.className = "inshell-ga4";
  root.setAttribute("aria-label", "Google Analytics preferences");
  const settings = document.createElement("button");
  settings.type = "button";
  settings.textContent = "Analytics settings";
  settings.setAttribute("aria-controls", "inshell-ga4-panel");
  const panel = document.createElement("section");
  panel.id = "inshell-ga4-panel";
  const heading = document.createElement("h2");
  heading.textContent = "Optional Google Analytics";
  const question = document.createElement("p"); question.textContent = GA4_NOTICE.question;
  const scope = document.createElement("p"); scope.textContent = GA4_NOTICE.scope;
  const notice = document.createElement("details");
  const summary = document.createElement("summary"); summary.textContent = "Google Analytics notice";
  const details = document.createElement("p"); details.textContent = GA4_NOTICE.details;
  const noticeLink = document.createElement("a");
  noticeLink.href = "/docs/wallet-local-data#docs-wallet-google-analytics";
  noticeLink.target = "_blank";
  noticeLink.rel = "noopener noreferrer";
  noticeLink.textContent = "Read the analytics and local-data notice";
  notice.append(summary, details, noticeLink);
  const status = document.createElement("p"); status.setAttribute("role", "status");
  const actions = document.createElement("div"); actions.className = "inshell-ga4-actions";
  function button(label: string, action: () => void) {
    const element = document.createElement("button"); element.type = "button";
    element.textContent = label; element.addEventListener("click", action); return element;
  }
  const allow = button("Allow Google Analytics", () => { controller.choose("allow"); close(); });
  const reject = button("Reject Google Analytics", () => { controller.choose("reject"); close(); });
  const withdraw = button("Withdraw Google Analytics permission", () => { controller.choose("reject"); });
  const exclude = button("Exclude this browser", () => { controller.exclude(!controller.status().excluded); });
  const dismiss = button("Close", close);
  actions.append(allow, reject);
  panel.append(heading, question, scope, notice, status, actions, withdraw, exclude, dismiss);
  root.append(panel, settings);
  document.body.append(root);
  let open = controller.status().available && controller.status().choice === "unknown" && !controller.status().excluded;
  function close() { open = false; render(); settings.focus({ preventScroll: true }); }
  function render() {
    const current = controller.status();
    root.hidden = !ga4Screen(new URL(window.location.href));
    panel.hidden = !open;
    settings.setAttribute("aria-expanded", String(open));
    allow.disabled = !current.available || !current.storageOk || current.excluded;
    withdraw.hidden = current.choice !== "allow";
    exclude.textContent = current.excluded ? "Remove browser exclusion" : "Exclude this browser";
    status.textContent = !current.storageOk ? "Browser storage is unavailable. Google Analytics stays off." :
      current.excluded ? "This browser is excluded from Google Analytics." :
      !current.available ? "Google Analytics is not enabled for this build or environment." :
      current.blocked ? "Google Analytics is off on this page. An allowed choice takes effect on your next ordinary page navigation." :
      current.choice === "allow" ? "Google Analytics is allowed." : "Google Analytics is off.";
  }
  settings.addEventListener("click", () => { open = !open; render(); if (open) dismiss.focus({ preventScroll: true }); });
  panel.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  controller.subscribe(render);
  render();
}

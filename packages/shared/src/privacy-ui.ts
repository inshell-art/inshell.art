import "./privacy.css";
import { browserExclusion, setBrowserExclusion } from "./privacy";

export function mountPrivacyInformation() {
  if (document.getElementById("inshell-privacy")) return;
  const root = document.createElement("details");
  root.id = "inshell-privacy";
  root.className = "inshell-privacy";
  const summary = document.createElement("summary");
  summary.textContent = "Privacy";
  const note = document.createElement("p");
  note.textContent = "Optional browser measurement is off. Your saved works and other functional browser data are kept separately.";
  const link = document.createElement("a");
  link.href = "/docs/wallet-local-data#docs-wallet-google-analytics";
  link.textContent = "Privacy and local data";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const button = document.createElement("button");
  button.type = "button";
  function render() {
    let preference = { readable: false, excluded: true };
    try { preference = browserExclusion(window.localStorage); } catch { /* fail closed */ }
    button.disabled = !preference.readable;
    button.textContent = preference.excluded ? "Remove browser exclusion" : "Exclude this browser";
    status.textContent = !preference.readable ? "Browser storage is unavailable. Measurement stays off." :
      preference.excluded ? "This browser is excluded from optional measurement." : "You can exclude this browser from future optional measurement.";
  }
  button.addEventListener("click", () => {
    try {
      const current = browserExclusion(window.localStorage);
      if (!current.readable || !setBrowserExclusion(window.localStorage, !current.excluded)) throw new Error("storage");
      render();
    } catch { status.textContent = "The preference could not be saved. Measurement stays off."; }
  });
  // No reload, cookies, IDs, storage cleanup or permission prompt.
  window.addEventListener("storage", render);
  root.append(summary, note, link, status, button);
  document.body.append(root);
  render();
}

import "./privacy.css";
import { browserExclusion, setBrowserExclusion, measurementLoaded, withdrawMeasurement } from "./privacy";

export function mountPrivacyInformation() {
  if (document.getElementById("inshell-privacy")) return;
  const root = document.createElement("details");
  root.id = "inshell-privacy";
  root.className = "inshell-privacy";
  const summary = document.createElement("summary");
  summary.textContent = "Privacy";
  const note = document.createElement("p");
  const link = document.createElement("a");
  link.href = "/docs/wallet-local-data#docs-wallet-google-analytics";
  link.textContent = "Privacy and local data";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const button = document.createElement("button");
  button.type = "button";
  function render() {
    note.textContent = measurementLoaded()
      ? "Optional measurement covers this public Home page only. Excluding this browser reloads the page; a final public-page send may occur during reload. Saved works and other functional browser data are kept separately."
      : "Optional browser measurement is off on this page. Your saved works and other functional browser data are kept separately.";
    let preference = { readable: false, excluded: true };
    try { preference = browserExclusion(window.localStorage); } catch { /* fail closed */ }
    button.disabled = !preference.readable;
    button.textContent = preference.excluded ? "Remove browser exclusion" : "Exclude this browser";
    status.textContent = !preference.readable ? (measurementLoaded()
      ? "Browser storage is unavailable. The loaded page needs to reload; a final public-page send may occur."
      : "Browser storage is unavailable. Measurement stays off.") :
      preference.excluded ? "This browser is excluded from optional measurement." :
        measurementLoaded() ? "Optional Home measurement is enabled for this page. You can exclude this browser." : "You can exclude this browser from future optional measurement. Removing an exclusion does not start measurement on this page.";
  }
  button.addEventListener("click", () => {
    try {
      const current = browserExclusion(window.localStorage);
      if (!current.readable || !setBrowserExclusion(window.localStorage, !current.excluded)) throw new Error("storage");
      render();
      if (!current.excluded) withdrawMeasurement();
    } catch {
      status.textContent = "The preference could not be saved. A loaded page will reload, but exclusion cannot be guaranteed until the preference is saved.";
      withdrawMeasurement();
    }
  });
  // No cookies, IDs, storage cleanup or permission prompt. A loaded SDK needs
  // a document boundary on withdrawal; removing its script would not stop it.
  window.addEventListener("storage", render);
  root.append(summary, note, link, status, button);
  document.body.append(root);
  render();
}

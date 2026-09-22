export { openProblemReport as openFailureReport } from "@inshell/shared/problem-report";
export { failureReportSummary, sanitizeReportText } from "@inshell/shared/problem-report-data";
export function installLocalFailureTest(fail: () => void): void {
  if (!import.meta.env.DEV || !["127.0.0.1", "localhost"].includes(window.location.hostname)
      || new URLSearchParams(window.location.search).get("report-test") !== "1") return;
  window.addEventListener("load", () => {
    const button = document.createElement("button");
    button.id = "simulate-report-failure";
    button.textContent = "Simulate failed run (local UI test)";
    button.addEventListener("click", fail);
    document.body.prepend(button);
  }, { once: true });
}

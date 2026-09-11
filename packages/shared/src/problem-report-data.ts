export type FailureReportContext = {
  agent: string; surface: string; appVersion: string; build: string;
  stage: "agent-run" | "app-run" | "site-feedback"; simulated?: boolean; contextUnavailable?: boolean;
};

// Deliberately never accepts a run, URL, error payload, prompt or artwork.
export function sanitizeReportText(value: string): string {
  return value.slice(0, 2000)
    .replace(/(?:https?:\/\/|[a-z]+:\/\/)[^\s]+/gi, "[link removed]")
    .replace(/\bBearer\s+\S+/gi, "[credential removed]")
    .replace(/\b(?:token|secret|password|authorization|credential|prompt|artwork)\s*[:=]\s*[^\n]+/gi, "[private field removed]")
    .replace(/\b[A-Za-z0-9_+/=-]{40,}\b/g, "[opaque value removed]");
}

export function failureReportSummary(context: FailureReportContext, userAgent: string, version = "", description = ""): string {
  const build = /^[a-f0-9]{40,64}$/.test(context.build) ? context.build : sanitizeReportText(context.build);
  const browser = userAgent.match(/(?:Firefox|Edg|Chrome|Version)\/[\d.]+/)?.[0] ?? "unknown";
  const os = userAgent.match(/(?:Mac OS X [\d_]+|Windows NT [\d.]+|Android [\d.]+|Linux)/)?.[0] ?? "unknown";
  return [
    context.stage === "site-feedback" ? "Inshell problem report" : "THOUGHT problem report",
    `Evidence: ${context.contextUnavailable ? "historical failure — original diagnostic context unavailable" : context.simulated ? "simulated local UI test — not a real Agent run" : context.stage === "site-feedback" ? "visitor feedback — not release-test evidence" : "visitor-reported failure"}`,
    ...(context.stage === "site-feedback" ? [] : [`Agent: ${sanitizeReportText(context.agent)}`]),
    `Surface: ${sanitizeReportText(context.surface)}`,
    `App: ${sanitizeReportText(context.appVersion)}; build: ${build}`,
    `${context.stage === "site-feedback" ? "Context" : "Failure stage"}: ${context.stage}`,
    `Browser (reported): ${browser}`, `OS (browser-reported, may be reduced): ${os}`,
    ...(context.stage === "site-feedback" ? [] : [`Agent version (optional, self-reported): ${sanitizeReportText(version) || "unknown"}`]),
    `Description (optional): ${sanitizeReportText(description) || "not supplied"}`,
    "Prompt, artwork, run payloads, handoff URLs and credentials are not collected.",
  ].join("\n");
}

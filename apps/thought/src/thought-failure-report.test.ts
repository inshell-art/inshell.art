import assert from "node:assert/strict";
import test from "node:test";
import { failureReportSummary, sanitizeReportText } from "./thought-failure-report-data";
const context = { agent: "claude", surface: "claude-code", appVersion: "0.0.2", build: "dev", stage: "agent-run" as const };
test("report whitelist does not collect run payloads or creative data", () => {
  const report = failureReportSummary({ ...context, prompt: "PRIVATE", token: "PRIVATE", artwork: "PRIVATE" } as typeof context, "");
  assert.ok(!report.includes("PRIVATE")); assert.match(report, /unknown/);
});
test("optional text removes links, credentials, opaque values and private fields", () => {
  const value = sanitizeReportText("https://example.invalid/?token=SECRET\nBearer SECRET\nprompt: PRIVATE\n" + "x".repeat(64));
  assert.ok(!value.includes("SECRET")); assert.ok(!value.includes("PRIVATE")); assert.ok(!value.includes("x".repeat(64)));
});
test("simulated UI evidence is explicit; reported environment is not attestation", () => {
  const report = failureReportSummary({ ...context, simulated: true }, "Mac OS X 10_15_7 Chrome/145.0.0.0");
  assert.match(report, /simulated local UI test/); assert.match(report, /may be reduced/);
  assert.match(report, /Chrome\/145/);
});
test("optional description is bounded and markup remains text", () => {
  assert.ok(sanitizeReportText("a ".repeat(3000)).length <= 2000);
  assert.equal(sanitizeReportText("<script>alert(1)</script>"), "<script>alert(1)</script>");
});
test("public build commit identity is preserved, not mistaken for a bearer credential", () => {
  const build = "abc123".repeat(6) + "abcd";
  assert.ok(failureReportSummary({ ...context, build }, "").includes(build));
});

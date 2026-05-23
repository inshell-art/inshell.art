#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const args = new Set(process.argv.slice(2));
const live = args.has("--live") || process.env.INSHELL_DEPLOYMENT_LIVE === "1";
const failOnWarnings =
  args.has("--fail-on-warnings") || process.env.INSHELL_DEPLOYMENT_FAIL_ON_WARNINGS === "1";
const failOnHighWarnings =
  args.has("--fail-on-high-warnings") || process.env.INSHELL_DEPLOYMENT_FAIL_ON_HIGH_WARNINGS === "1";
const outputDir = process.env.INSHELL_VALIDATION_OUT_DIR
  ? resolve(process.env.INSHELL_VALIDATION_OUT_DIR)
  : join(repoRoot, "tmp/validation");
const reportPath = join(outputDir, "contract_validation_report.json");

function run(label, command, commandArgs, env = {}) {
  console.log(`\n[check-deployment] ${label}`);
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });
}

function readReport() {
  if (!existsSync(reportPath)) {
    throw new Error(`Contract validation report missing: ${reportPath}`);
  }
  return JSON.parse(readFileSync(reportPath, "utf8"));
}

run("Validate production surface", "pnpm", ["tsx", "scripts/validate-production-surface.ts"]);
run("Validate imported PATH/THOUGHT artifacts", "pnpm", [
  "tsx",
  "scripts/validate-path-artifacts.ts",
  "packages/contracts/src/releases",
  "packages/contracts/src/abi",
  "packages/contracts/src/addresses",
]);
run("Generate contract deployment validation report", "node", [
  "scripts/validate-inshell-contracts.mjs",
], {
  INSHELL_VALIDATION_OUT_DIR: outputDir,
  INSHELL_VALIDATION_SKIP_LIVE: live ? "0" : "1",
});

const report = readReport();
const checks = Array.isArray(report.checks) ? report.checks : [];
const warningChecks = checks.filter((check) => check.status === "WARN");
const highWarningChecks = warningChecks.filter((check) => ["critical", "high"].includes(check.severity));

console.log(`\n[check-deployment] Contract verdict: ${report.verdict}`);
console.log(
  `[check-deployment] Summary: PASS=${report.summary?.pass ?? 0} WARN=${report.summary?.warn ?? 0} FAIL=${report.summary?.fail ?? 0} N/A=${report.summary?.na ?? 0}`,
);
console.log(`[check-deployment] Report: ${reportPath}`);

if (report.verdict === "NOT_READY") {
  throw new Error("Deployment validation failed: contract verdict is NOT_READY.");
}

if (failOnWarnings && report.verdict !== "READY") {
  throw new Error("Deployment validation failed: warnings are configured as errors.");
}

if (failOnHighWarnings && highWarningChecks.length > 0) {
  throw new Error(
    `Deployment validation failed: ${highWarningChecks.length} high/critical warnings are configured as errors.`,
  );
}

#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_REPO = "inshell-art/inshell.art";
const DEFAULT_BRANCH = "main";
const DEFAULT_OUTPUT = ".ops/dev-quality/status.json";
const DEFAULT_RUNS_DIR = ".ops/dev-quality/runs";
const DEFAULT_MAX_ACTION_RUNS = 50;
const MAX_BUFFER = 20 * 1024 * 1024;

const checked = ["actions", "dependabot", "code_scanning", "secret_scanning"];

const parseArgs = (argv) => {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    branch: process.env.INSHELL_DEV_QUALITY_BRANCH || DEFAULT_BRANCH,
    output: process.env.INSHELL_DEV_QUALITY_STATUS || DEFAULT_OUTPUT,
    runsDir: process.env.INSHELL_DEV_QUALITY_RUNS_DIR || DEFAULT_RUNS_DIR,
    maxActionRuns: DEFAULT_MAX_ACTION_RUNS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--repo" && next) {
      args.repo = next;
      index += 1;
    } else if (arg === "--branch" && next) {
      args.branch = next;
      index += 1;
    } else if (arg === "--output" && next) {
      args.output = next;
      index += 1;
    } else if (arg === "--runs-dir" && next) {
      args.runsDir = next;
      index += 1;
    } else if (arg === "--max-action-runs" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.maxActionRuns = parsed;
      }
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
};

const printHelp = () => {
  console.log(`DEV GitHub quality loop

Usage:
  pnpm run quality:github -- [options]

Options:
  --repo <owner/name>          GitHub repository. Default: ${DEFAULT_REPO}
  --branch <branch>           Default branch to inspect. Default: ${DEFAULT_BRANCH}
  --output <path>             Status JSON path. Default: ${DEFAULT_OUTPUT}
  --runs-dir <path>           Markdown run notes directory. Default: ${DEFAULT_RUNS_DIR}
  --max-action-runs <number>  Completed workflow runs to inspect. Default: ${DEFAULT_MAX_ACTION_RUNS}
`);
};

const isoForFile = (date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const compactError = (error) => {
  const status = error?.status ?? error?.code ?? null;
  const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
  const stdout = typeof error?.stdout === "string" ? error.stdout.trim() : "";
  const message = stderr || stdout || error?.message || String(error);
  return {
    status,
    message: message.split("\n").slice(0, 4).join(" "),
  };
};

const ghApi = async (endpoint) => {
  try {
    const { stdout } = await execFileAsync("gh", ["api", endpoint], {
      env: {
        ...process.env,
        GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
      },
      maxBuffer: MAX_BUFFER,
    });
    return {
      ok: true,
      data: stdout.trim() ? JSON.parse(stdout) : null,
    };
  } catch (error) {
    return {
      ok: false,
      error: compactError(error),
    };
  }
};

const normalizeSeverity = (value, fallback = "medium") => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "critical") return "critical";
  if (normalized === "high" || normalized === "error") return "high";
  if (normalized === "medium" || normalized === "moderate" || normalized === "warning") return "medium";
  if (normalized === "low" || normalized === "note") return "low";
  return fallback;
};

const issue = ({ kind, severity = "medium", summary, url, details = {} }) => ({
  kind,
  severity: normalizeSeverity(severity),
  summary,
  ...(url ? { url } : {}),
  ...(Object.keys(details).length ? { details } : {}),
});

const inspectActions = async ({ repo, branch, maxActionRuns }) => {
  const endpoint =
    `repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=${maxActionRuns}`;
  const response = await ghApi(endpoint);
  if (!response.ok) {
    return {
      issues: [],
      readError: {
        kind: "github_actions",
        summary: `Unable to read completed GitHub Actions runs for ${branch}.`,
        error: response.error,
      },
    };
  }

  const workflowRuns = Array.isArray(response.data?.workflow_runs) ? response.data.workflow_runs : [];
  const latestByWorkflow = new Map();
  for (const run of workflowRuns) {
    const key = run.workflow_id ?? run.name ?? run.path ?? run.id;
    if (!latestByWorkflow.has(key)) {
      latestByWorkflow.set(key, run);
    }
  }

  const badConclusions = new Set(["failure", "timed_out", "action_required", "startup_failure"]);
  const issues = [];
  for (const run of latestByWorkflow.values()) {
    if (!badConclusions.has(run.conclusion)) {
      continue;
    }

    issues.push(issue({
      kind: "github_actions",
      severity: run.conclusion === "failure" ? "medium" : "high",
      summary: `${run.name || "workflow"} ${run.conclusion} on ${branch}`,
      url: run.html_url,
      details: {
        runId: run.id,
        workflowId: run.workflow_id,
        event: run.event,
        displayTitle: run.display_title,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      },
    }));
  }

  return { issues, readError: null };
};

const inspectDependabot = async ({ repo }) => {
  const response = await ghApi(`repos/${repo}/dependabot/alerts?state=open&per_page=100`);
  if (!response.ok) {
    return {
      issues: [],
      readError: {
        kind: "dependabot",
        summary: "Unable to read Dependabot alerts.",
        error: response.error,
      },
    };
  }

  const alerts = Array.isArray(response.data) ? response.data : [];
  return {
    issues: alerts.map((alert) => issue({
      kind: "dependabot",
      severity: alert.security_advisory?.severity,
      summary: `${alert.dependency?.package?.name || "dependency"}: ${alert.security_advisory?.summary || "open Dependabot alert"}`,
      url: alert.html_url,
      details: {
        number: alert.number,
        package: alert.dependency?.package?.name,
        ecosystem: alert.dependency?.package?.ecosystem,
        vulnerableManifestPath: alert.dependency?.manifest_path,
      },
    })),
    readError: null,
  };
};

const inspectCodeScanning = async ({ repo }) => {
  const response = await ghApi(`repos/${repo}/code-scanning/alerts?state=open&per_page=100`);
  if (!response.ok) {
    return {
      issues: [],
      readError: {
        kind: "code_scanning",
        summary: "Unable to read code scanning alerts.",
        error: response.error,
      },
    };
  }

  const alerts = Array.isArray(response.data) ? response.data : [];
  return {
    issues: alerts.map((alert) => issue({
      kind: "code_scanning",
      severity: alert.rule?.security_severity_level || alert.rule?.severity,
      summary: `${alert.rule?.id || "code-scanning"}: ${alert.rule?.description || alert.rule?.name || "open code scanning alert"}`,
      url: alert.html_url,
      details: {
        number: alert.number,
        tool: alert.tool?.name,
        state: alert.state,
      },
    })),
    readError: null,
  };
};

const inspectSecretScanning = async ({ repo }) => {
  const response = await ghApi(`repos/${repo}/secret-scanning/alerts?state=open&per_page=100`);
  if (!response.ok) {
    return {
      issues: [],
      readError: {
        kind: "secret_scanning",
        summary: "Unable to read secret scanning alerts.",
        error: response.error,
      },
    };
  }

  const alerts = Array.isArray(response.data) ? response.data : [];
  return {
    issues: alerts.map((alert) => issue({
      kind: "secret_scanning",
      severity: "critical",
      summary: `${alert.secret_type_display_name || alert.secret_type || "secret"}: open secret scanning alert`,
      url: alert.html_url,
      details: {
        number: alert.number,
        state: alert.state,
        resolution: alert.resolution,
      },
    })),
    readError: null,
  };
};

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const severityLabel = (severity) => `【${severity}】`;

const writeRunNote = async ({ runsDir, startedAt, status }) => {
  await mkdir(runsDir, { recursive: true });
  const filePath = path.join(runsDir, `${isoForFile(new Date(startedAt))}.md`);
  const lines = [
    "# DEV GitHub Quality Loop",
    "",
    `Repo: ${status.repo}`,
    `Branch: ${status.lastRun.branch}`,
    `Started: ${status.lastRun.startedAt}`,
    `Finished: ${status.lastRun.finishedAt}`,
    `Status: ${status.lastRun.status}`,
    `Workflow run: ${status.lastRun.workflowRunUrl || "-"}`,
    "",
    "## Checked",
    "",
    ...status.lastRun.checked.map((entry) => `- ${entry}`),
    "",
    "## Open Issues",
    "",
    ...(status.lastRun.openIssues.length
      ? status.lastRun.openIssues.map((entry) =>
          `- ${severityLabel(entry.severity)} ${entry.kind}: ${entry.summary}${entry.url ? ` ${entry.url}` : ""}`)
      : ["None."]),
    "",
    "## Read Errors",
    "",
    ...(status.lastRun.readErrors.length
      ? status.lastRun.readErrors.map((entry) =>
          `- ${entry.kind}: ${entry.summary} ${entry.error?.message || ""}`.trim())
      : ["None."]),
    "",
    "## Repairs",
    "",
    ...(status.lastRun.repairs.length
      ? status.lastRun.repairs.map((entry) => `- ${entry.summary || JSON.stringify(entry)}`)
      : ["None. This loop records repo-quality state; DEV patches safe repo-local issues on staging from this report."]),
    "",
  ];

  await writeFile(filePath, `${lines.join("\n")}\n`);
  return filePath;
};

const workflowRunUrl = () => {
  if (!process.env.GITHUB_SERVER_URL || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) {
    return null;
  }
  return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  const results = await Promise.all([
    inspectActions(args),
    inspectDependabot(args),
    inspectCodeScanning(args),
    inspectSecretScanning(args),
  ]);

  const openIssues = results.flatMap((result) => result.issues);
  const readErrors = results.flatMap((result) => result.readError ? [result.readError] : []);
  const finishedAt = new Date();
  const runStatus = openIssues.length || readErrors.length ? "blocked" : "ok";

  const status = {
    version: 1,
    repo: args.repo,
    updatedAt: finishedAt.toISOString(),
    mode: "observe-and-repair",
    lastRun: {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      status: runStatus,
      branch: args.branch,
      workflowRunUrl: workflowRunUrl(),
      checked,
      openIssues,
      readErrors,
      repairs: [],
      repairPolicy: "DEV patches safe repo-local issues on staging from this status. The loop does not mutate provider accounts, secrets, billing, Cloudflare, or OPS config.",
    },
  };

  await writeJson(args.output, status);
  const runNotePath = await writeRunNote({
    runsDir: args.runsDir,
    startedAt: startedAt.toISOString(),
    status,
  });

  console.log(`DEV GitHub quality loop status: ${runStatus}`);
  console.log(`status: ${args.output}`);
  console.log(`run note: ${runNotePath}`);

  if (openIssues.length) {
    for (const entry of openIssues) {
      console.log(`- ${severityLabel(entry.severity)} ${entry.kind}: ${entry.summary}`);
    }
  }
  if (readErrors.length) {
    for (const entry of readErrors) {
      console.log(`- read error ${entry.kind}: ${entry.summary}`);
    }
  }
};

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

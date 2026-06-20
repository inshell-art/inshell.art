#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CONTRACT_URL = "https://inshell-pub.pages.dev/pub/contract/pub-path-boundary.json";
const EXPECTED_ORIGIN = "https://inshell.art";
const EXPECTED_OWNER = "PUB";
const REQUEST_TIMEOUT_MS = 12_000;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  const args = {
    contractUrl:
      process.env.PUB_BOUNDARY_CONTRACT_URL ||
      process.env.PUB_PATH_BOUNDARY_CONTRACT_URL ||
      DEFAULT_CONTRACT_URL,
    contractFile: process.env.PUB_PATH_BOUNDARY_CONTRACT_FILE || "",
    skipContractFetch: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--") {
      continue;
    }
    if (arg === "--contract-url" && next) {
      args.contractUrl = next;
      index += 1;
      continue;
    }
    if (arg === "--contract-file" && next) {
      args.contractFile = next;
      index += 1;
      continue;
    }
    if (arg === "--skip-contract-fetch") {
      args.skipContractFetch = true;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return args;
}

function normalizeRoutePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let path = value.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith("/")) return null;
  return path || "/";
}

async function readContract(args) {
  if (args.skipContractFetch) {
    return {
      schemaVersion: 1,
      origin: EXPECTED_ORIGIN,
      owner: EXPECTED_OWNER,
      paths: {
        exact: ["/llms.txt", "/pub.manifest.json"],
        prefixes: ["/pub/"],
      },
    };
  }

  if (args.contractFile) {
    const fullPath = resolve(repoRoot, args.contractFile);
    return JSON.parse(readFileSync(fullPath, "utf8"));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(args.contractUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${args.contractUrl} returned HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `${args.contractUrl} returned non-JSON. PUB must deploy the path-boundary contract before DEV can treat this URL as current. Response starts: ${text.slice(0, 120).replace(/\s+/g, " ")}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

function validateContract(contract) {
  const errors = [];
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return ["contract must be a JSON object"];
  }
  if (contract.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (contract.origin !== EXPECTED_ORIGIN) errors.push(`origin must be ${EXPECTED_ORIGIN}`);
  if (contract.owner !== EXPECTED_OWNER) errors.push(`owner must be ${EXPECTED_OWNER}`);
  if (!contract.paths || typeof contract.paths !== "object" || Array.isArray(contract.paths)) {
    errors.push("paths must be an object");
    return errors;
  }
  for (const field of ["exact", "prefixes"]) {
    const values = contract.paths[field];
    if (!Array.isArray(values)) {
      errors.push(`paths.${field} must be an array`);
      continue;
    }
    for (const value of values) {
      if (typeof value !== "string" || !value.startsWith("/")) {
        errors.push(`paths.${field} contains invalid path ${JSON.stringify(value)}`);
      }
      if (field === "prefixes" && typeof value === "string" && !value.endsWith("/")) {
        errors.push(`paths.prefixes entry must end with /: ${value}`);
      }
    }
  }
  return errors;
}

function addOwnedPath(paths, path, source, kind) {
  const normalized = normalizeRoutePath(path);
  if (!normalized) return;
  paths.push({ path: normalized, source, kind });
}

function collectStaticFiles(paths, dir) {
  const fullDir = resolve(repoRoot, dir);
  if (!existsSync(fullDir)) return;
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const fullPath = join(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;
      if (name === "_headers" || name === "_redirects") continue;
      const rel = relative(fullDir, fullPath).split(sep).join("/");
      const route = rel === "index.html"
        ? "/"
        : rel.endsWith("/index.html")
          ? `/${rel.slice(0, -"index.html".length)}`
          : `/${rel}`;
      addOwnedPath(paths, route, relative(repoRoot, fullPath), "static");
    }
  };
  walk(fullDir);
}

function collectFunctionRoutes(paths) {
  const apiDir = resolve(repoRoot, "functions/api");
  if (!existsSync(apiDir)) return;
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const fullPath = join(current, name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!stat.isFile() || !/\.(?:ts|js)$/.test(name)) continue;
      const rel = relative(apiDir, fullPath).split(sep).join("/").replace(/\.(?:ts|js)$/i, "");
      const route = rel.endsWith("/index") ? `/api/${rel.slice(0, -"/index".length)}` : `/api/${rel}`;
      addOwnedPath(paths, route, relative(repoRoot, fullPath), "api-route");
    }
  };
  walk(apiDir);
}

function collectRedirectRoutes(paths, filePath) {
  const fullPath = resolve(repoRoot, filePath);
  if (!existsSync(fullPath)) return;
  const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [from, to] = line.split(/\s+/);
    addOwnedPath(paths, from, `${filePath}:${index + 1}`, "redirect-source");
    if (to?.startsWith("/")) addOwnedPath(paths, to, `${filePath}:${index + 1}`, "redirect-target");
  }
}

function collectMiddlewareRoutes(paths) {
  const filePath = "functions/_middleware.ts";
  const fullPath = resolve(repoRoot, filePath);
  if (!existsSync(fullPath)) return;
  const text = readFileSync(fullPath, "utf8");
  const stringLiteralPattern = /(["'`])(\/[A-Za-z0-9._~:/?#[\]@!$&()*+,;=%-]*)\1/g;
  let inPubRouteLayer = false;
  let braceDepth = 0;
  for (const line of text.split(/\r?\n/)) {
    if (
      line.includes("function isPubReservedPathname") ||
      line.includes("function isPubRouteHost") ||
      line.includes("function proxyPubArtifact") ||
      line.includes("function getPubArtifactUrl") ||
      line.includes("function pubArtifactAcceptHeader") ||
      line.includes("function pubArtifactContentType")
    ) {
      inPubRouteLayer = true;
      braceDepth = 0;
    }
    if (!inPubRouteLayer) {
      for (const match of line.matchAll(stringLiteralPattern)) {
        const value = match[2];
        if (!value || value.startsWith("//")) continue;
        addOwnedPath(paths, value, filePath, "middleware-literal");
      }
    }
    if (inPubRouteLayer) {
      braceDepth += (line.match(/{/g) ?? []).length;
      braceDepth -= (line.match(/}/g) ?? []).length;
      if (braceDepth <= 0 && line.includes("}")) {
        inPubRouteLayer = false;
      }
    }
  }
}

function collectDeployConfigRoutes(paths) {
  collectRedirectRoutes(paths, "apps/home/public/_redirects");
  collectRedirectRoutes(paths, "apps/thought/public/_redirects");
}

function collectOwnedPaths() {
  const paths = [];
  for (const dir of [
    "apps/home/public",
    "apps/thought/public",
    "public",
    "dist/home",
    "dist/thought",
  ]) {
    collectStaticFiles(paths, dir);
  }
  collectFunctionRoutes(paths);
  collectMiddlewareRoutes(paths);
  collectDeployConfigRoutes(paths);
  return paths;
}

function matchesReservedPath(path, contract) {
  const exact = contract.paths.exact ?? [];
  const prefixes = contract.paths.prefixes ?? [];
  if (exact.includes(path)) return { type: "exact", pattern: path };
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(prefix)) {
      return { type: "prefix", pattern: prefix };
    }
  }
  return null;
}

function uniqueViolations(violations) {
  const seen = new Set();
  return violations.filter((violation) => {
    const key = `${violation.path}\0${violation.source}\0${violation.kind}\0${violation.pattern}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = await readContract(args);
  const contractErrors = validateContract(contract);
  if (contractErrors.length > 0) {
    throw new Error(`Invalid PUB path-boundary contract:\n- ${contractErrors.join("\n- ")}`);
  }

  const ownedPaths = collectOwnedPaths();
  const violations = uniqueViolations(
    ownedPaths
      .map((entry) => {
        const match = matchesReservedPath(entry.path, contract);
        return match ? { ...entry, ...match } : null;
      })
      .filter(Boolean),
  );

  const middleware = readFileSync(resolve(repoRoot, "functions/_middleware.ts"), "utf8");
  for (const snippet of [
    "PUB_UPSTREAM_DEFAULT",
    "https://inshell-pub.pages.dev",
    "isPubRouteHost",
    "isPubReservedPathname",
    "proxyPubArtifact",
    "pubMethodNotAllowed",
    "pub-proxy",
    "x-inshell-dev-path-boundary",
  ]) {
    if (!middleware.includes(snippet)) {
      violations.push({
        path: "(runtime guard)",
        source: "functions/_middleware.ts",
        kind: "missing-runtime-guard",
        type: "required-snippet",
        pattern: snippet,
      });
    }
  }
  for (const path of [...contract.paths.exact, ...contract.paths.prefixes]) {
    if (!middleware.includes(path)) {
      violations.push({
        path,
        source: "functions/_middleware.ts",
        kind: "missing-router-coverage",
        type: "contract-path",
        pattern: path,
      });
    }
  }

  if (violations.length > 0) {
    console.error("[pub-boundary] FAIL");
    for (const violation of violations) {
      console.error(
        `- ${violation.kind} ${violation.path} from ${violation.source} matches ${violation.type} ${violation.pattern}`,
      );
    }
    process.exit(1);
  }

  console.log(
    `[pub-boundary] OK owner=${contract.owner} exact=${contract.paths.exact.length} prefixes=${contract.paths.prefixes.length} checkedPaths=${ownedPaths.length}${contract.contractVersion ? ` contractVersion=${contract.contractVersion}` : ""}`,
  );
}

main().catch((error) => {
  console.error(`[pub-boundary] failed: ${error.message}`);
  process.exitCode = 1;
});

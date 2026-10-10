#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_ORIGIN = "https://inshell.art";
const EXPECTED_OWNER = "retired";
const LEGACY_HOST = /\b(?:[a-z0-9-]+\.)*(?:inshell-pub|inshell-public-feed)\.pages\.dev\b/i;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  for (const arg of argv) {
    if (arg === "--") continue;
    throw new Error(`Unknown argument: ${arg}; retirement checks are local and always enforced`);
  }
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
  return path.split(/[?#]/, 1)[0].replace(/%([0-9a-f]{2})/gi,
    (_, byte) => String.fromCharCode(Number.parseInt(byte, 16)))
    .replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function readContract() {
  // Operator-approved retirement, 2026-10-10. Preserve the ownership guard with
  // a fixed, fail-closed inventory; never fetch authority from a retired host.
  return {
    schemaVersion: 1,
    origin: EXPECTED_ORIGIN,
    owner: EXPECTED_OWNER,
    paths: {
      exact: ["/llms.txt", "/pub.manifest.json", "/pub", "/rss.xml", "/feed.xml",
        "/rss.sepolia.xml", "/events.json", "/source", "/source-assets"],
      prefixes: ["/pub/", "/source/", "/source-assets/"],
    },
  };
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
      if (rel.endsWith(".html")) {
        addOwnedPath(paths, `/${rel.replace(/\.html$/, "")}`,
          relative(repoRoot, fullPath), "static-clean-url");
      }
      if (!rel.startsWith("docs/") && /\.(?:html|[cm]?js|css|xml|txt)$/.test(rel)
        && LEGACY_HOST.test(readFileSync(fullPath, "utf8"))) {
        addOwnedPath(paths, route, relative(repoRoot, fullPath), "legacy-upstream");
      }
    }
  };
  walk(fullDir);
}

function collectFunctionRoutes(paths) {
  const apiDir = resolve(repoRoot, "functions");
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
      if (name === "_middleware.ts" || name === "_middleware.js") continue;
      const rel = relative(apiDir, fullPath).split(sep).join("/").replace(/\.(?:ts|js)$/i, "");
      const route = rel.endsWith("/index") ? `/${rel.slice(0, -"/index".length)}` : `/${rel}`;
      addOwnedPath(paths, route, relative(repoRoot, fullPath), "api-route");
      if (LEGACY_HOST.test(readFileSync(fullPath, "utf8"))) {
        addOwnedPath(paths, route, relative(repoRoot, fullPath), "legacy-upstream");
      }
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
    if (to) addOwnedPath(paths, to, `${filePath}:${index + 1}`, "redirect-target");
    if (LEGACY_HOST.test(line)) addOwnedPath(paths, from, `${filePath}:${index + 1}`, "legacy-upstream");
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
      line.includes("function isRetiredPublicPathname")
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
  for (const dir of ["apps/home/public", "apps/thought/public", "public", "dist/home", "dist/thought"]) {
    collectRedirectRoutes(paths, `${dir}/_redirects`);
  }
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
  if (path.includes("*") || path.includes(":") || path.includes("[")) {
    const wildcard = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, ".*")
      .replace(/:[a-zA-Z_][\w-]*/g, "[^/]+")
      .replace(/\\\[\\\[[^\]]+\\\]\\\]/g, ".*")
      .replace(/\\\[[^\]]+\\\]/g, "[^/]+");
    const matcher = new RegExp(`^${wildcard}$`);
    const matched = [...exact, ...prefixes.map((prefix) => `${prefix}artifact`)]
      .find((candidate) => matcher.test(candidate));
    if (matched) return { type: "wildcard", pattern: matched };
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
  parseArgs(process.argv.slice(2));
  const contract = readContract();
  const contractErrors = validateContract(contract);
  if (contractErrors.length > 0) {
    throw new Error(`Invalid PUB path-boundary contract:\n- ${contractErrors.join("\n- ")}`);
  }

  const ownedPaths = collectOwnedPaths();
  const violations = uniqueViolations(
    ownedPaths
      .map((entry) => {
        if (entry.kind === "legacy-upstream") return { ...entry, type: "retired-host", pattern: "legacy PUB/feed host" };
        const match = matchesReservedPath(entry.path, contract);
        return match ? { ...entry, ...match } : null;
      })
      .filter(Boolean),
  );

  const middleware = readFileSync(resolve(repoRoot, "functions/_middleware.ts"), "utf8");
  for (const snippet of [
    "isRetiredPublicPathname(url.pathname)",
    "return retiredPublicNotFound(ctx.request)",
    "function retiredPublicNotFound",
    "status: 404",
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
  const retirementMatcher = middleware.match(/function isRetiredPublicPathname\([^)]*\)\s*\{([^]*?)\n\}/)?.[1] ?? "";
  for (const path of contract.paths.exact) {
    if (!retirementMatcher.includes(`"${path}"`) && !retirementMatcher.includes(`'${path}'`)) {
      violations.push({
        path,
        source: "functions/_middleware.ts",
        kind: "missing-router-coverage",
        type: "contract-path",
        pattern: path,
      });
    }
  }

  const forbidden = /\b(?:PUB_UPSTREAM(?:_DEFAULT)?|PUB_BOUNDARY_CONTRACT_URL|isPubRouteHost|isPubReservedPathname|proxyPubArtifact|PUBLIC_FEED_(?:RSS_URL|ALIAS_URL|SEPOLIA_RSS_URL|BASE_URL)|proxyFeed|getPublicFeedArtifactUrl|proxyPublicFeedArtifact)\b/;
  if (forbidden.test(middleware) || LEGACY_HOST.test(middleware)) {
    violations.push({ path: "(runtime guard)", source: "functions/_middleware.ts",
      kind: "legacy-proxy", type: "forbidden", pattern: "retired PUB/feed upstream or proxy" });
  }
  const firstRouteGuard = /export async function onRequest\([^)]*\)(?:\s*:\s*Promise<Response>)?\s*\{\s*const url = new globalThis\.URL\(ctx\.request\.url\);\s*if \(isRetiredPublicPathname\(url\.pathname\)\) \{\s*return retiredPublicNotFound\(ctx\.request\);\s*\}/;
  const notFoundResponder = middleware.match(/function retiredPublicNotFound\([^)]*\)\s*\{([^]*?)\n\}/)?.[1] ?? "";
  if (!firstRouteGuard.test(middleware) || !/^\s*return new Response\(/.test(notFoundResponder)
    || !/status:\s*404\s*,/.test(notFoundResponder)
    || !retirementMatcher.includes(".startsWith(`${root}/`)")) {
    violations.push({ path: "(runtime guard)", source: "functions/_middleware.ts",
      kind: "invalid-retirement-guard", type: "required", pattern: "first-route 404 and descendant matching" });
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
    `[pub-boundary] OK owner=${contract.owner} exact=${contract.paths.exact.length} prefixes=${contract.paths.prefixes.length} checkedPaths=${ownedPaths.length} externalFetches=0`,
  );
}

main().catch((error) => {
  console.error(`[pub-boundary] failed: ${error.message}`);
  process.exitCode = 1;
});

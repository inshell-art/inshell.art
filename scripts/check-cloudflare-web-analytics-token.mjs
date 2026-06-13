#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const DEFAULT_PRIVATE_ENV = resolve(homedir(), ".inshell-secrets/inshell-sepolia.env");
const TOKEN_ENV_KEYS = [
  "INSHELL_CLOUDFLARE_WEB_ANALYTICS_READ_TOKEN",
  "CLOUDFLARE_WEB_ANALYTICS_API_TOKEN",
  "INSHELL_CLOUDFLARE_WEB_ANALYTICS_EDIT",
];

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function expandPath(input) {
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

function loadPrivateEnv() {
  const candidates = [
    process.env.INSHELL_SECRETS_ENV_FILE,
    process.env.INSHELL_PRIVATE_ENV_FILE,
    DEFAULT_PRIVATE_ENV,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const envPath = expandPath(candidate);
    if (!existsSync(envPath)) {
      continue;
    }
    const text = readFileSync(envPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const normalized = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
      const separator = normalized.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = normalized.slice(0, separator).trim();
      if (!key || process.env[key]) {
        continue;
      }
      process.env[key] = parseEnvValue(normalized.slice(separator + 1));
    }
    return envPath;
  }
  return null;
}

function resolveConfig() {
  const loadedEnvPath = loadPrivateEnv();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const tokenKey = TOKEN_ENV_KEYS.find((key) => process.env[key]);
  return {
    accountId,
    tokenKey,
    token: tokenKey ? process.env[tokenKey] : undefined,
    loadedEnvPath,
  };
}

async function main() {
  const { accountId, tokenKey, token, loadedEnvPath } = resolveConfig();
  if (!accountId) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID.");
  }
  if (!token || !tokenKey) {
    throw new Error(
      `Missing Web Analytics read token. Set ${TOKEN_ENV_KEYS[0]} in the private env file.`,
    );
  }
  if (tokenKey !== TOKEN_ENV_KEYS[0]) {
    console.warn(
      `[web-analytics] using ${tokenKey}; prefer ${TOKEN_ENV_KEYS[0]} for least-privilege RUM metadata reads.`,
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/rum/site_info/list`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Cloudflare returned non-JSON response with HTTP ${response.status}.`);
  }

  if (!response.ok || payload?.success === false) {
    const firstError = Array.isArray(payload?.errors) ? payload.errors[0] : null;
    const message = firstError?.message || response.statusText || "request failed";
    if (response.status === 403) {
      throw new Error(
        `Cloudflare returned 403 for RUM site metadata. ${tokenKey} needs Web Analytics/RUM metadata read access for account ${accountId}; Account Settings Write alone is not enough. (${message})`,
      );
    }
    throw new Error(`Cloudflare RUM site metadata request failed with HTTP ${response.status}: ${message}`);
  }

  const sites = Array.isArray(payload?.result) ? payload.result : [];
  console.log(`[web-analytics] ok: ${sites.length} site(s) readable`);
  for (const site of sites) {
    const host = site?.host || site?.hostname || site?.site || site?.name || "unknown";
    const tag = site?.site_tag || site?.siteTag || site?.token || "unknown";
    console.log(`[web-analytics] site ${host} tag=${String(tag).slice(0, 8)}...`);
  }
  if (loadedEnvPath) {
    console.log(`[web-analytics] private env loaded: ${loadedEnvPath}`);
  }
}

main().catch((error) => {
  console.error(`[web-analytics] failed: ${error.message}`);
  process.exitCode = 1;
});

#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, lstat, mkdir, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function candidatePreviewInvocation(root, inherited, executable = process.execPath) {
  const nodeBin = dirname(executable);
  const local = join(root, "tmp/candidate-pages");
  return {
    command: join(nodeBin, "npx"),
    args: [
      "--yes", "wrangler@4.94.0", "pages", "dev", "dist/home",
      "--ip", "127.0.0.1", "--port", "4175", "--inspector-port", "0",
      "--compatibility-date", "2026-05-28",
      "--binding", "CF_PAGES_BRANCH=staging",
      "--persist-to", "tmp/candidate-pages/state",
      "--live-reload", "--show-interactive-dev-session=false",
    ],
    env: {
      PATH: `${nodeBin}:${inherited.PATH ?? ""}`,
      XDG_CONFIG_HOME: join(local, "config"),
      TMPDIR: join(local, "tmp"),
      LANG: "en_US.UTF-8",
      CI: "1",
      WRANGLER_SEND_METRICS: "false",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
      npm_config_cache: join(root, "tmp/wrangler-cache"),
      npm_config_userconfig: join(local, "npm-userconfig"),
      npm_config_globalconfig: join(local, "npm-globalconfig"),
      npm_config_update_notifier: "false",
    },
  };
}

async function requireFreePort(host) {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen({ host, port: 4175, exclusive: true }, () => server.close(resolvePromise));
  });
}

async function main() {
  const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
  // Wrangler searches for configuration in ancestor directories. Do not load an
  // unrelated project's bindings or local secrets into this candidate review.
  for (let dir = root; ; dir = dirname(dir)) {
    const names = await readdir(dir);
    const unexpected = names.filter((name) =>
      /^wrangler\.(?:toml|json|jsonc)$/.test(name) ||
      /^\.dev\.vars(?:\.|$)/.test(name) || /^\.env(?:\.|$)/.test(name) ||
      (dir === root && name === ".npmrc"),
    );
    if (unexpected.length) throw new Error(`Candidate preview refuses automatic configuration files in ${dir}: ${unexpected.join(", ")}`);
    if (dirname(dir) === dir) break;
  }
  // Wrangler 4.94.0 gives legacy ~/.wrangler precedence over XDG_CONFIG_HOME.
  // Check presence only and stop rather than reading or changing that config.
  try {
    await lstat(join(homedir(), ".wrangler"));
    throw new Error("Candidate preview refuses existing legacy ~/.wrangler configuration; no configuration was read or changed.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await access(join(root, "dist/home/index.html"));
  await access(join(root, "dist/home/thought/index.html"));
  const invocation = candidatePreviewInvocation(root, process.env);
  await access(invocation.command);
  await requireFreePort("127.0.0.1");
  await requireFreePort("::1");
  for (const path of [invocation.env.XDG_CONFIG_HOME, invocation.env.TMPDIR]) {
    await mkdir(path, { recursive: true });
  }
  console.log("Candidate review: http://127.0.0.1:4175 — built assets and actual Pages middleware; no remote resource bindings.");
  console.log("Hosted Agent/API integrations still require separate preview verification. This command does not deploy.");
  const child = spawn(invocation.command, invocation.args, {
    cwd: root, env: invocation.env, stdio: "inherit",
  });
  process.once("SIGINT", () => child.kill("SIGINT"));
  process.once("SIGTERM", () => child.kill("SIGTERM"));
  child.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
  child.once("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

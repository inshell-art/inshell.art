#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = process.env.INSHELL_ANVIL_HOST?.trim() || "127.0.0.1";
const port = process.env.INSHELL_ANVIL_PORT?.trim() || "8546";
const chainId = process.env.INSHELL_ANVIL_CHAIN_ID?.trim() || "31337";
const stateInterval = process.env.INSHELL_ANVIL_STATE_INTERVAL?.trim() || "1";
const stateFile = path.resolve(
  process.env.INSHELL_ANVIL_STATE_FILE?.trim() ||
    path.join(root, ".local", "anvil", "inshell-state.json"),
);

await fs.mkdir(path.dirname(stateFile), { recursive: true });

let restoring = false;
try {
  const stats = await fs.stat(stateFile);
  restoring = stats.isFile() && stats.size > 0;
} catch {
  restoring = false;
}

const args = [
  "--host",
  host,
  "--port",
  port,
  "--chain-id",
  chainId,
  "--state",
  stateFile,
  "--state-interval",
  stateInterval,
  "--silent",
];

console.log(`Starting persistent Inshell Anvil on ${host}:${port}`);
console.log(`${restoring ? "Restoring" : "Creating"} chain memory: ${stateFile}`);
console.log("PATH and THOUGHT tokens are written periodically and again on clean shutdown.");

const child = spawn("anvil", args, { stdio: "inherit" });
let forwardingSignal = false;

const forwardSignal = (signal) => {
  if (forwardingSignal) return;
  forwardingSignal = true;
  child.kill(signal);
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("error", (error) => {
  console.error(`Failed to start Anvil: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal && !forwardingSignal) {
    console.error(`Anvil exited from ${signal}.`);
  }
  process.exit(code ?? (signal ? 1 : 0));
});

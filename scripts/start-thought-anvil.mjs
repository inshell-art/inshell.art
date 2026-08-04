#!/usr/bin/env node

import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import {
  THOUGHT_ANVIL_CHAIN_ID,
  THOUGHT_ANVIL_HOST,
  THOUGHT_ANVIL_PORT,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_ANVIL_STATE_FILE,
} from "./thought-local-lane.mjs";

await fs.mkdir(path.dirname(THOUGHT_ANVIL_STATE_FILE), { recursive: true });

let restoring = false;
try {
  const stats = await fs.stat(THOUGHT_ANVIL_STATE_FILE);
  restoring = stats.isFile() && stats.size > 0;
} catch {
  restoring = false;
}

const args = [
  "--host",
  THOUGHT_ANVIL_HOST,
  "--port",
  THOUGHT_ANVIL_PORT,
  "--chain-id",
  THOUGHT_ANVIL_CHAIN_ID,
  "--state",
  THOUGHT_ANVIL_STATE_FILE,
  "--state-interval",
  "1",
  "--silent",
];

console.log(`Starting isolated THOUGHT Anvil at ${THOUGHT_ANVIL_RPC_URL}`);
console.log(`${restoring ? "Restoring" : "Creating"} THOUGHT lane state: ${THOUGHT_ANVIL_STATE_FILE}`);
console.log("This node contains a pinned PATH dependency and THOUGHT contracts only.");

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
  console.error(`Failed to start THOUGHT Anvil: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal && !forwardingSignal) {
    console.error(`THOUGHT Anvil exited from ${signal}.`);
  }
  process.exit(code ?? (signal ? 1 : 0));
});

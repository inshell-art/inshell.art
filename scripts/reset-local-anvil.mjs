#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (!process.argv.includes("--confirm-reset")) {
  throw new Error(
    "Refusing to erase local chain memory without --confirm-reset.",
  );
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rpcUrl =
  process.env.INSHELL_ANVIL_RPC_URL?.trim() || "http://127.0.0.1:8546";
const stateFile = path.resolve(
  process.env.INSHELL_ANVIL_STATE_FILE?.trim() ||
    path.join(root, ".local", "anvil", "inshell-state.json"),
);
const checkpointFile = path.resolve(
  process.env.INSHELL_ANVIL_CHECKPOINT_FILE?.trim() ||
    path.join(root, ".local", "anvil", "latest-checkpoint.json"),
);
const rpcPort = new URL(rpcUrl).port || "8546";
const listenerCheck = spawnSync(
  "lsof",
  ["-nP", `-iTCP:${rpcPort}`, "-sTCP:LISTEN"],
  { encoding: "utf8" },
);
if (listenerCheck.status === 0 && listenerCheck.stdout.trim()) {
  throw new Error(
    `Persistent Anvil is still running at ${rpcUrl}. Stop it before resetting chain memory.`,
  );
}

try {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_chainId",
      params: [],
    }),
    signal: AbortSignal.timeout(500),
  });
  if (response.ok) {
    throw new Error(
      `Persistent Anvil is still running at ${rpcUrl}. Stop it before resetting chain memory.`,
    );
  }
} catch (error) {
  if (
    error instanceof Error &&
    error.message.includes("Persistent Anvil is still running")
  ) {
    throw error;
  }
}

await Promise.all([
  fs.rm(stateFile, { force: true }),
  fs.rm(checkpointFile, { force: true }),
]);

console.log("Local Anvil chain memory was reset.");
console.log("Start pnpm dev:anvil, then redeploy PATH + THOUGHT before starting the frontend.");

#!/usr/bin/env node

import fs from "node:fs/promises";

import {
  THOUGHT_ANVIL_CHECKPOINT_FILE,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_ANVIL_STATE_FILE,
  THOUGHT_CONTRACT_RUNTIME_FILE,
} from "./thought-local-lane.mjs";

if (!process.argv.includes("--confirm-reset")) {
  throw new Error("Refusing to erase the THOUGHT lane without --confirm-reset.");
}

try {
  const response = await fetch(THOUGHT_ANVIL_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    signal: AbortSignal.timeout(500),
  });
  if (response.ok) {
    throw new Error(
      `THOUGHT Anvil is still running at ${THOUGHT_ANVIL_RPC_URL}. Stop it before reset.`,
    );
  }
} catch (error) {
  if (error instanceof Error && error.message.includes("is still running")) throw error;
}

await Promise.all([
  fs.rm(THOUGHT_ANVIL_STATE_FILE, { force: true }),
  fs.rm(THOUGHT_ANVIL_CHECKPOINT_FILE, { force: true }),
  fs.rm(THOUGHT_CONTRACT_RUNTIME_FILE, { force: true }),
]);

console.log("THOUGHT Anvil state and generated runtime were reset.");

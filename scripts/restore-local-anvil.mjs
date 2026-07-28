#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rpcUrl =
  process.env.INSHELL_ANVIL_RPC_URL?.trim() || "http://127.0.0.1:8546";
const checkpointFile = path.resolve(
  process.env.INSHELL_ANVIL_CHECKPOINT_FILE?.trim() ||
    path.join(root, ".local", "anvil", "latest-checkpoint.json"),
);
const deploymentFile = path.join(
  root,
  "apps",
  "thought",
  "evm",
  "addresses.anvil.json",
);

const checkpoint = JSON.parse(await fs.readFile(checkpointFile, "utf8"));
if (
  checkpoint.schema !== "inshell.local-anvil-checkpoint.v1" ||
  typeof checkpoint.dumpState !== "string" ||
  !checkpoint.dumpState.startsWith("0x")
) {
  throw new Error(`Invalid Inshell Anvil checkpoint: ${checkpointFile}`);
}

const response = await fetch(rpcUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "anvil_loadState",
    params: [checkpoint.dumpState],
  }),
});
const payload = await response.json();
if (!response.ok || payload.error || payload.result !== true) {
  throw new Error(
    `anvil_loadState failed: ${
      payload.error?.message ?? `HTTP ${response.status}, result ${JSON.stringify(payload.result)}`
    }`,
  );
}

if (checkpoint.deployment && typeof checkpoint.deployment === "object") {
  await fs.writeFile(
    deploymentFile,
    `${JSON.stringify({ ...checkpoint.deployment, rpcUrl }, null, 2)}\n`,
    "utf8",
  );
}

console.log(JSON.stringify({
  restored: true,
  checkpointFile,
  rpcUrl,
  deploymentRestored: Boolean(checkpoint.deployment),
}, null, 2));

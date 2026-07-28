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

const rpc = async (method, params = []) => {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`${method} returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method} failed: ${payload.error.message ?? JSON.stringify(payload.error)}`);
  }
  return payload.result;
};

const readDeployment = async () => {
  try {
    return JSON.parse(await fs.readFile(deploymentFile, "utf8"));
  } catch {
    return null;
  }
};

const dumpState = await rpc("anvil_dumpState");
if (typeof dumpState !== "string" || !dumpState.startsWith("0x")) {
  throw new Error("anvil_dumpState returned an invalid state dump");
}

const [chainId, blockNumber, deployment] = await Promise.all([
  rpc("eth_chainId"),
  rpc("eth_blockNumber"),
  readDeployment(),
]);
const checkpoint = {
  schema: "inshell.local-anvil-checkpoint.v1",
  savedAt: new Date().toISOString(),
  rpcUrl,
  chainId,
  blockNumber,
  deployment,
  dumpState,
};

await fs.mkdir(path.dirname(checkpointFile), { recursive: true });
await fs.writeFile(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  checkpointFile,
  chainId,
  blockNumber,
  stateBytes: Math.ceil((dumpState.length - 2) / 2),
  deploymentSaved: deployment !== null,
}, null, 2));

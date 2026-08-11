#!/usr/bin/env node

import { spawn } from "node:child_process";

import {
  THOUGHT_ANVIL_CHAIN_ID,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_APP_HOST,
  THOUGHT_APP_PORT,
  THOUGHT_APP_URL,
  THOUGHT_CONTRACT_RUNTIME_FILE,
  THOUGHT_HOME_HOST,
  THOUGHT_HOME_PORT,
  THOUGHT_HOME_URL,
  root,
  thoughtLaneEnvironment,
} from "./thought-local-lane.mjs";

const expectedChainIdHex = `0x${BigInt(THOUGHT_ANVIL_CHAIN_ID).toString(16)}`;

const rpcReady = async () => {
  try {
    const response = await fetch(THOUGHT_ANVIL_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: AbortSignal.timeout(500),
    });
    const payload = await response.json();
    return response.ok && !payload.error && payload.result === expectedChainIdHex;
  } catch {
    return false;
  }
};

const waitForRpc = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await rpcReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`THOUGHT Anvil did not become ready at ${THOUGHT_ANVIL_RPC_URL}`);
};

const runToCompletion = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });

const env = thoughtLaneEnvironment();
const ownsNode = !(await rpcReady());
let node = null;
let app = null;
let home = null;
let shuttingDown = false;

const shutdown = (signal = "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (app && app.exitCode === null) app.kill(signal);
  if (home && home.exitCode === null) home.kill(signal);
  if (ownsNode && node && node.exitCode === null) node.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

try {
  if (ownsNode) {
    node = spawn(process.execPath, ["scripts/start-thought-anvil.mjs"], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    node.on("error", (error) => {
      console.error(error);
      shutdown();
    });
  } else {
    console.log(`Using existing THOUGHT Anvil at ${THOUGHT_ANVIL_RPC_URL}`);
  }

  await waitForRpc();
  await runToCompletion(process.execPath, ["scripts/prepare-thought-anvil.mjs"], env);

  console.log(`Starting THOUGHT App at ${THOUGHT_APP_URL}`);
  console.log(`Runtime: ${THOUGHT_CONTRACT_RUNTIME_FILE}`);
  app = spawn("pnpm", [
    "--filter",
    "@inshell/thought",
    "exec",
    "vite",
    "--configLoader",
    "runner",
    "--host",
    THOUGHT_APP_HOST,
    "--port",
    THOUGHT_APP_PORT,
    "--strictPort",
  ], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  app.on("error", (error) => {
    console.error(error);
    shutdown();
  });

  console.log(`Starting canonical Inshell home gallery at ${THOUGHT_HOME_URL}`);
  home = spawn("pnpm", [
    "--filter",
    "@inshell/home",
    "exec",
    "vite",
    "--mode",
    "devnet",
    "--host",
    THOUGHT_HOME_HOST,
    "--port",
    THOUGHT_HOME_PORT,
    "--strictPort",
  ], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  home.on("error", (error) => {
    console.error(error);
    shutdown();
  });

  const watchedProcesses = [
    new Promise((resolve) =>
      app.on("exit", (code, signal) => resolve({ process: "THOUGHT App", code, signal })),
    ),
    new Promise((resolve) =>
      home.on("exit", (code, signal) => resolve({ process: "Inshell home", code, signal })),
    ),
  ];
  if (ownsNode && node) {
    watchedProcesses.push(
      new Promise((resolve) =>
        node.on("exit", (code, signal) => resolve({ process: "THOUGHT Anvil", code, signal })),
      ),
    );
  }
  const firstExit = await Promise.race(watchedProcesses);
  console.error(`${firstExit.process} exited; stopping the THOUGHT local stack.`);
  shutdown(firstExit.signal ?? "SIGTERM");
  process.exitCode = firstExit.code ?? (firstExit.signal ? 1 : 0);
} catch (error) {
  console.error(error);
  shutdown();
  process.exitCode = 1;
}

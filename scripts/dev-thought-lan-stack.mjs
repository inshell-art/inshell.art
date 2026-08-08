#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runDirectory = path.join(root, ".local", "run");
const logDirectory = path.join(root, ".local", "logs");
const statusFile = path.join(runDirectory, "thought-lan-stack.json");
const logFile = path.join(logDirectory, "thought-lan-stack.log");
const appPort = process.env.INSHELL_THOUGHT_APP_PORT?.trim() || "5176";
const homePort = process.env.INSHELL_THOUGHT_HOME_PORT?.trim() || "5177";
const anvilPort = process.env.INSHELL_THOUGHT_ANVIL_PORT?.trim() || "8547";
const expectedChainId = process.env.INSHELL_THOUGHT_ANVIL_CHAIN_ID?.trim() || "31338";
const expectedChainIdHex = `0x${BigInt(expectedChainId).toString(16)}`;
const healthIntervalMs = 15_000;
const startupTimeoutMs = 120_000;
const unhealthyLimit = 3;

await fsPromises.mkdir(runDirectory, { recursive: true });
await fsPromises.mkdir(logDirectory, { recursive: true });
const log = fs.createWriteStream(logFile, { flags: "a" });

const write = (message, stream = process.stdout) => {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  stream.write(line);
  log.write(line);
};

const writeChildOutput = (chunk, stream) => {
  stream.write(chunk);
  log.write(chunk);
};

const isPrivateIpv4 = (address) => {
  const octets = address.split(".").map(Number);
  return octets.length === 4 && (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
};

const detectLanHost = () => {
  const configured = process.env.INSHELL_THOUGHT_PUBLIC_HOST?.trim();
  if (configured) return configured;
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses ?? []).map((address) => ({ name, ...address })),
    )
    .filter((address) =>
      address.family === "IPv4" && !address.internal && isPrivateIpv4(address.address),
    )
    .sort((left, right) => {
      const leftScore = left.name === "en0" ? 0 : left.name.startsWith("en") ? 1 : 2;
      const rightScore = right.name === "en0" ? 0 : right.name.startsWith("en") ? 1 : 2;
      return leftScore - rightScore || left.name.localeCompare(right.name);
    });
  if (!candidates[0]?.address) {
    throw new Error(
      "No private LAN IPv4 address is available. Connect this machine to the LAN and retry.",
    );
  }
  return candidates[0].address;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchOk = async (url) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const fetchStatus = async (url, expectedStatus) => {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });
    return response.status === expectedStatus;
  } catch {
    return false;
  }
};

const rpc = async (url, method, params = []) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(3_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `RPC HTTP ${response.status}`);
  }
  return payload.result;
};

const health = async ({ publicHost, publicRpcUrl }) => {
  const homeUrl = `http://${publicHost}:${homePort}/`;
  const appUrl = `http://${publicHost}:${homePort}/thought/`;
  try {
    const [chainId, homeReady, appReady, agentApiReady] = await Promise.all([
      rpc(publicRpcUrl, "eth_chainId"),
      fetchOk(homeUrl),
      fetchOk(appUrl),
      fetchStatus(`${homeUrl}api/thought-agent/v2/client`, 410),
    ]);
    return {
      ok: chainId === expectedChainIdHex && homeReady && appReady && agentApiReady,
      chainId,
      homeReady,
      appReady,
      agentApiReady,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const writeStatus = async (status) => {
  const temporary = `${statusFile}.tmp`;
  await fsPromises.writeFile(temporary, `${JSON.stringify(status, null, 2)}\n`);
  await fsPromises.rename(temporary, statusFile);
};

let child = null;
let stopping = false;
let restartCount = 0;

const stop = (signal) => {
  if (stopping) return;
  stopping = true;
  write(`Stopping LAN stack from ${signal}.`);
  if (child && child.exitCode === null) child.kill("SIGTERM");
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

const runStack = async () => {
  const publicHost = detectLanHost();
  const publicRpcUrl =
    process.env.INSHELL_THOUGHT_PUBLIC_RPC_URL?.trim() ||
    `http://${publicHost}:${anvilPort}`;
  const homeUrl = `http://${publicHost}:${homePort}/`;
  const appUrl = `${homeUrl}thought/`;
  const env = {
    ...process.env,
    INSHELL_THOUGHT_ANVIL_HOST: "0.0.0.0",
    INSHELL_THOUGHT_APP_HOST: "127.0.0.1",
    INSHELL_THOUGHT_HOME_HOST: "0.0.0.0",
    INSHELL_THOUGHT_PUBLIC_HOST: publicHost,
    INSHELL_THOUGHT_PUBLIC_RPC_URL: publicRpcUrl,
  };

  write(`Starting THOUGHT LAN stack on ${publicHost} (restart ${restartCount}).`);
  child = spawn(process.execPath, ["scripts/dev-thought-local-stack.mjs"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => writeChildOutput(chunk, process.stdout));
  child.stderr.on("data", (chunk) => writeChildOutput(chunk, process.stderr));
  const exited = new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  const startedAt = new Date().toISOString();
  const deadline = Date.now() + startupTimeoutMs;
  let currentHealth = null;
  while (!stopping && Date.now() < deadline) {
    const result = await Promise.race([
      exited.then((exit) => ({ exit })),
      sleep(1_000).then(async () => ({ health: await health({ publicHost, publicRpcUrl }) })),
    ]);
    if (result.exit) return result.exit;
    currentHealth = result.health;
    if (currentHealth.ok) break;
  }

  if (stopping) return await exited;
  if (!currentHealth?.ok) {
    write("LAN stack did not become healthy before the startup deadline.", process.stderr);
    child.kill("SIGTERM");
    return await exited;
  }

  const readyStatus = {
    schema: "inshell.thought.lan-stack.v1",
    status: "ready",
    pid: child.pid,
    startedAt,
    checkedAt: new Date().toISOString(),
    restartCount,
    publicHost,
    homeUrl,
    appUrl,
    rpcUrl: publicRpcUrl,
    chainId: Number(expectedChainId),
    logFile,
  };
  await writeStatus(readyStatus);
  write(`LAN ready: ${homeUrl}`);
  write(`THOUGHT App: ${appUrl}`);
  write(`Disposable THOUGHT RPC: ${publicRpcUrl}`);

  let consecutiveFailures = 0;
  while (!stopping) {
    const result = await Promise.race([
      exited.then((exit) => ({ exit })),
      sleep(healthIntervalMs).then(async () => ({
        health: await health({ publicHost, publicRpcUrl }),
      })),
    ]);
    if (result.exit) return result.exit;
    currentHealth = result.health;
    if (currentHealth.ok) {
      consecutiveFailures = 0;
      await writeStatus({
        ...readyStatus,
        checkedAt: new Date().toISOString(),
      });
      continue;
    }
    consecutiveFailures += 1;
    write(
      `LAN health check failed ${consecutiveFailures}/${unhealthyLimit}: ${JSON.stringify(currentHealth)}`,
      process.stderr,
    );
    if (consecutiveFailures >= unhealthyLimit) {
      write("Restarting the unhealthy THOUGHT LAN stack.", process.stderr);
      child.kill("SIGTERM");
      return await exited;
    }
  }

  return await exited;
};

try {
  while (!stopping) {
    const exit = await runStack();
    child = null;
    if (stopping) break;
    restartCount += 1;
    write(`THOUGHT LAN stack exited (${JSON.stringify(exit)}); restarting in 3 seconds.`, process.stderr);
    await sleep(3_000);
  }
} catch (error) {
  write(error instanceof Error ? error.message : String(error), process.stderr);
  process.exitCode = 1;
} finally {
  await fsPromises.rm(statusFile, { force: true });
  log.end();
}

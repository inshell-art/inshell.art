import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { keccak256 } from "../apps/thought/node_modules/ethers/lib.esm/index.js";
import { requestThoughtAnvilCheckpoint } from "./thought-anvil-checkpoint.mjs";

const launcherFile = fileURLToPath(
  new URL("./start-thought-anvil.mjs", import.meta.url),
);
const source = fs.readFileSync(launcherFile, "utf8");
const checkpointSource = fs.readFileSync(
  new URL("./thought-anvil-checkpoint.mjs", import.meta.url),
  "utf8",
);
const prepareSource = fs.readFileSync(
  new URL("./prepare-thought-anvil.mjs", import.meta.url),
  "utf8",
);
const anvilAvailable =
  spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;

const waitFor = async (description, probe, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : "."}`,
  );
};

const reservePort = async () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const rpc = async (url, method, params = []) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(1_000),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  if (payload.error) throw new Error(`RPC ${method} failed.`);
  return payload.result;
};

const readCheckpoint = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256File = (file) => sha256(fs.readFileSync(file));
const restartedPathDeployment = (checkpoint, key) =>
  checkpoint.runtime.pathDeployment[key];

const childProcessIds = (parentPid) => {
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,comm="], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  return result.stdout
    .trim()
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/))
    .filter(Boolean)
    .filter((match) => Number(match[2]) === parentPid)
    .map((match) => ({ pid: Number(match[1]), command: match[3] }));
};

const waitForExit = (child, timeoutMs = 10_000) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the launcher to exit.")),
      timeoutMs,
    );
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
};

const portIsClosed = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(true);
    });
  });

test("THOUGHT Anvil uses bounded atomic checkpoints and graceful final persistence", () => {
  assert.match(source, /"--load-state", THOUGHT_ANVIL_STATE_FILE/);
  assert.match(source, /anvil_dumpState/);
  assert.match(source, /INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS/);
  assert.match(checkpointSource, /fs\.rename\(temporaryFile, file\)/);
  assert.match(checkpointSource, /await syncDirectory\(path\.dirname\(file\)\)/);
  assert.match(source, /fs\.chmod\(stateDirectory, 0o700\)/);
  assert.match(checkpointSource, /fs\.open\(temporaryFile, "wx", 0o600\)/);
  assert.match(source, /THOUGHT_ANVIL_CHECKPOINT_FILE/);
  assert.match(source, /MAX_CONSECUTIVE_CHECKPOINT_FAILURES = 3/);
  assert.match(source, /stopping for supervisor recovery/);
  assert.match(source, /setTimeout\(\(\) => child\.kill\("SIGKILL"\), SHUTDOWN_TIMEOUT_MS\)/);
  assert.match(source, /THOUGHT_ANVIL_CHECKPOINT_ACK_FILE/);
  assert.match(source, /await fs\.rm\(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, \{ force: true \}\);/);
  assert.match(source, /await fs\.rm\(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE/);
  assert.match(source, /if \(requestOrAckExists\.some\(Boolean\)\) return/);
  assert.match(source, /if \(!runtimeReady\) \{\s*if \(!request\) return null/);
  assert.match(source, /removeStaleProtocolFile\(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE\)/);
  assert.match(
    source,
    /if \(request\.runtimeSha256 !== runtime\.sha256\) \{\s*await fs\.rm\(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE/,
  );
  assert.match(checkpointSource, /finally \{\s*await removeOwnedProtocolFile\(requestFile\)/);
  assert.match(
    checkpointSource,
    /if \(ready\) \{\s*runtime = \{\s*present: true,\s*sha256: sha256\(runtimeBytes\)/,
  );
  assert.match(
    checkpointSource,
    /descriptor\?\.localLane\?\.id === "thought"/,
  );
  assert.doesNotMatch(
    checkpointSource.slice(
      checkpointSource.indexOf("export const migrateLegacyThoughtAnvilState"),
    ),
    /pathDeployment\?\.schema/,
  );
  assert.equal(
    prepareSource.match(/await checkpointPreparedRuntime\(\)/g)?.length,
    2,
    "both the existing and freshly deployed prepare paths must await the checkpoint handshake",
  );
  assert.match(source, /await checkpoint\(\);\s*\n\s*} catch/);
  assert.match(source, /child\.kill\(signal\)/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*dump/i);
  assert.doesNotMatch(source, /"--state"/);
});

test(
  "a mined mutation and paired runtime identity survive an abrupt Anvil SIGKILL",
  { skip: !anvilAvailable, timeout: 30_000 },
  async (t) => {
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "inshell-thought-anvil-persistence-"),
    );
    const stateFile = path.join(temporaryDirectory, "state.json");
    const checkpointFile = path.join(temporaryDirectory, "latest-checkpoint.json");
    const runtimeFile = path.join(temporaryDirectory, "runtime.json");
    const port = await reservePort();
    const chainId = 41_338;
    const rpcUrl = `http://127.0.0.1:${port}`;
    const pathContracts = {
      pathNft: {
        address: `0x${"22".repeat(20)}`,
        code: "0x60016000526001601ff3",
      },
      pathPulseAdapter: {
        address: `0x${"33".repeat(20)}`,
        code: "0x60026000526001601ff3",
      },
      pulseAuction: {
        address: `0x${"44".repeat(20)}`,
        code: "0x60036000526001601ff3",
      },
    };
    const runtime = {
      schema: "inshell.thought.v2.anvil-gallery-runtime.v1",
      status: "ready",
      chainId,
      localLane: {
        id: "thought",
        pathRelease: {
          releaseTag: "v0.5.0",
          manifestSha256: "a".repeat(64),
        },
      },
      thoughtNft: { address: `0x${"11".repeat(20)}` },
      pathNft: { address: pathContracts.pathNft.address },
      pathPulseAdapter: { address: pathContracts.pathPulseAdapter.address },
      pulseAuction: { address: pathContracts.pulseAuction.address },
      pathDeployment: {
        schema: "inshell.path.local-deployment.v1",
        contracts: Object.fromEntries(
          Object.entries(pathContracts).map(([key, contract]) => [
            key,
            {
              address: contract.address,
              deployBlock: 0,
              codeHash: null,
            },
          ]),
        ),
      },
    };
    const environment = {
      ...process.env,
      INSHELL_THOUGHT_ANVIL_HOST: "127.0.0.1",
      INSHELL_THOUGHT_ANVIL_PORT: String(port),
      INSHELL_THOUGHT_ANVIL_CHAIN_ID: String(chainId),
      INSHELL_THOUGHT_ANVIL_RPC_URL: rpcUrl,
      INSHELL_THOUGHT_ANVIL_STATE_FILE: stateFile,
      INSHELL_THOUGHT_ANVIL_CHECKPOINT_FILE: checkpointFile,
      INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE: runtimeFile,
      INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS: "200",
      INSHELL_THOUGHT_ANVIL_PROTOCOL_FILE_MAX_AGE_MS: "200",
    };
    const launchers = new Set();
    const launcherLogs = [];

    const startLauncher = async (environmentOverrides = {}) => {
      const child = spawn(process.execPath, [launcherFile], {
        env: { ...environment, ...environmentOverrides },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      launchers.add(child);
      child.once("exit", () => launchers.delete(child));
      child.stdout.on("data", (chunk) => launcherLogs.push(chunk.toString()));
      child.stderr.on("data", (chunk) => launcherLogs.push(chunk.toString()));
      await waitFor("Anvil RPC readiness", async () => {
        const observed = await rpc(rpcUrl, "eth_chainId");
        return observed === `0x${chainId.toString(16)}`;
      });
      return child;
    };

    t.after(async () => {
      for (const child of launchers) {
        try {
          if (process.platform !== "win32" && child.pid) {
            process.kill(-child.pid, "SIGKILL");
          } else {
            child.kill("SIGKILL");
          }
        } catch {}
        await waitForExit(child, 2_000).catch(() => {});
      }
      await waitFor("the test port to close", () => portIsClosed(port), 3_000).catch(
        () => {},
      );
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    });

    const firstLauncher = await startLauncher();
    for (const contract of Object.values(pathContracts)) {
      await rpc(rpcUrl, "anvil_setCode", [contract.address, contract.code]);
    }
    for (const [key, contract] of Object.entries(pathContracts)) {
      runtime.pathDeployment.contracts[key].codeHash = keccak256(contract.code);
    }
    fs.writeFileSync(runtimeFile, `${JSON.stringify(runtime)}\n`, { mode: 0o600 });
    const runtimeSha256 = sha256File(runtimeFile);
    const accounts = await rpc(rpcUrl, "eth_accounts");
    assert.ok(Array.isArray(accounts) && accounts.length >= 2);
    const recipient = "0x000000000000000000000000000000000000bEEF";
    const transactionHash = await rpc(rpcUrl, "eth_sendTransaction", [
      { from: accounts[0], to: recipient, value: "0x1234" },
    ]);
    const receipt = await waitFor("the mined transaction receipt", () =>
      rpc(rpcUrl, "eth_getTransactionReceipt", [transactionHash]),
    );
    assert.equal(receipt.status, "0x1");

    let firstCheckpoint;
    try {
      firstCheckpoint = await requestThoughtAnvilCheckpoint({
        checkpointFile,
        runtimeFile,
        rpcUrl,
        timeoutMs: 5_000,
      });
    } catch (error) {
      throw new Error(`${error.message}\n${launcherLogs.join("")}`);
    }
    assert.ok(firstCheckpoint.acknowledgedRequestId);
    assert.ok(BigInt(firstCheckpoint.chain.blockNumber) >= BigInt(receipt.blockNumber));
    assert.equal(firstCheckpoint.schema, "inshell.thought.anvil-checkpoint.v1");
    assert.equal(firstCheckpoint.chain.chainId, chainId);
    assert.equal(
      firstCheckpoint.state.sha256,
      sha256(Buffer.from(firstCheckpoint.state.payloadBase64, "base64")),
    );
    assert.match(firstCheckpoint.checkpointId, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(checkpointFile).mode & 0o777, 0o600);
    assert.equal(fs.statSync(temporaryDirectory).mode & 0o777, 0o700);

    const anvilChild = await waitFor("the direct Anvil child", () => {
      const children = childProcessIds(firstLauncher.pid);
      return children.find(({ command }) => /(?:^|\/)anvil$/.test(command)) ?? null;
    });
    process.kill(anvilChild.pid, "SIGKILL");
    const abruptExit = await waitForExit(firstLauncher);
    assert.equal(abruptExit.code, 1);
    assert.equal(abruptExit.signal, null);
    assert.equal(readCheckpoint(checkpointFile).checkpointId, firstCheckpoint.checkpointId);
    await waitFor("the killed Anvil port to close", () => portIsClosed(port));

    fs.writeFileSync(
      runtimeFile,
      `${JSON.stringify({ ...runtime, status: "stale-after-checkpoint" })}\n`,
      { mode: 0o600 },
    );

    const secondLauncher = await startLauncher();
    assert.equal(sha256File(runtimeFile), runtimeSha256);
    assert.deepEqual(JSON.parse(fs.readFileSync(runtimeFile, "utf8")), runtime);
    assert.equal(await rpc(rpcUrl, "eth_getBalance", [recipient, "latest"]), "0x1234");
    const restoredReceipt = await rpc(rpcUrl, "eth_getTransactionReceipt", [
      transactionHash,
    ]);
    assert.equal(restoredReceipt.transactionHash, transactionHash);
    assert.equal(restoredReceipt.blockNumber, receipt.blockNumber);
    for (const [key, contract] of Object.entries(pathContracts)) {
      const restoredCode = await rpc(rpcUrl, "eth_getCode", [
        contract.address,
        "latest",
      ]);
      assert.equal(restoredCode, contract.code.toLowerCase());
      assert.equal(keccak256(restoredCode), runtime.pathDeployment.contracts[key].codeHash);
      assert.equal(
        restartedPathDeployment(firstCheckpoint, key).address,
        contract.address.toLowerCase(),
      );
      assert.equal(
        restartedPathDeployment(firstCheckpoint, key).codeHash,
        keccak256(contract.code),
      );
    }

    const restartedCheckpoint = await waitFor("the restarted paired checkpoint", () => {
      const checkpoint = readCheckpoint(checkpointFile);
      return checkpoint.runtime?.sha256 === runtimeSha256 &&
        checkpoint.state?.sha256 === sha256File(stateFile)
        ? checkpoint
        : null;
    });
    assert.equal(restartedCheckpoint.chain.chainId, chainId);
    assert.ok(
      BigInt(restartedCheckpoint.chain.blockNumber) >= BigInt(receipt.blockNumber),
    );
    assert.equal(restartedCheckpoint.runtime.laneId, "thought");
    assert.equal(restartedCheckpoint.runtime.releaseTag, "v0.5.0");

    const secondTransactionHash = await rpc(rpcUrl, "eth_sendTransaction", [
      { from: accounts[0], to: recipient, value: "0x10" },
    ]);
    const secondReceipt = await waitFor("the second mined transaction receipt", () =>
      rpc(rpcUrl, "eth_getTransactionReceipt", [secondTransactionHash]),
    );
    const periodicCheckpoint = await waitFor("the autonomous periodic checkpoint", () => {
      const checkpoint = readCheckpoint(checkpointFile);
      return checkpoint.checkpointId !== restartedCheckpoint.checkpointId &&
        BigInt(checkpoint.chain.blockNumber) >= BigInt(secondReceipt.blockNumber)
        ? checkpoint
        : null;
    });
    const secondAnvilChild = await waitFor("the second direct Anvil child", () => {
      const children = childProcessIds(secondLauncher.pid);
      return children.find(({ command }) => /(?:^|\/)anvil$/.test(command)) ?? null;
    });
    process.kill(secondAnvilChild.pid, "SIGKILL");
    const secondAbruptExit = await waitForExit(secondLauncher);
    assert.equal(secondAbruptExit.code, 1);
    await waitFor("the second killed Anvil port to close", () => portIsClosed(port));

    const beforeGracefulCheckpoint = readCheckpoint(checkpointFile);
    const thirdLauncher = await startLauncher({
      INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS: "60000",
    });
    assert.equal(await rpc(rpcUrl, "eth_getBalance", [recipient, "latest"]), "0x1244");
    assert.equal(
      (await rpc(rpcUrl, "eth_getTransactionReceipt", [secondTransactionHash])).blockNumber,
      secondReceipt.blockNumber,
    );
    assert.equal(readCheckpoint(checkpointFile).checkpointId, periodicCheckpoint.checkpointId);
    const gracefulTransactionHash = await rpc(rpcUrl, "eth_sendTransaction", [
      { from: accounts[0], to: recipient, value: "0x20" },
    ]);
    const gracefulReceipt = await waitFor("the graceful-shutdown transaction", () =>
      rpc(rpcUrl, "eth_getTransactionReceipt", [gracefulTransactionHash]),
    );
    thirdLauncher.kill("SIGTERM");
    const gracefulExit = await waitForExit(thirdLauncher);
    assert.equal(gracefulExit.code, 0);
    assert.equal(gracefulExit.signal, null);
    await waitFor("the gracefully stopped Anvil port to close", () => portIsClosed(port));
    const finalCheckpoint = readCheckpoint(checkpointFile);
    assert.notEqual(finalCheckpoint.checkpointId, beforeGracefulCheckpoint.checkpointId);
    assert.ok(
      BigInt(finalCheckpoint.chain.blockNumber) >= BigInt(gracefulReceipt.blockNumber),
    );
    assert.equal(finalCheckpoint.runtime.sha256, runtimeSha256);
    assert.equal(
      finalCheckpoint.state.sha256,
      sha256(Buffer.from(finalCheckpoint.state.payloadBase64, "base64")),
    );
    assert.equal(fs.statSync(stateFile).mode & 0o777, 0o600);

    const fourthLauncher = await startLauncher();
    assert.equal(await rpc(rpcUrl, "eth_getBalance", [recipient, "latest"]), "0x1264");
    assert.equal(
      (await rpc(rpcUrl, "eth_getTransactionReceipt", [gracefulTransactionHash])).blockNumber,
      gracefulReceipt.blockNumber,
    );

    const orphanRequestFile = `${checkpointFile}.request`;
    const orphanAckFile = `${checkpointFile}.ack`;
    fs.writeFileSync(
      orphanRequestFile,
      `${JSON.stringify({
        requestId: "orphan-request",
        runtimeSha256,
        minimumBlock: finalCheckpoint.chain.blockNumber,
      })}\n`,
      { mode: 0o600 },
    );
    fs.writeFileSync(
      orphanAckFile,
      `${JSON.stringify({
        requestId: "orphan-ack",
        checkpointId: finalCheckpoint.checkpointId,
      })}\n`,
      { mode: 0o600 },
    );
    const staleTime = new Date(Date.now() - 60_000);
    fs.utimesSync(orphanRequestFile, staleTime, staleTime);
    fs.utimesSync(orphanAckFile, staleTime, staleTime);

    await waitFor("stale checkpoint protocol cleanup", () => {
      const requestRemoved = !fs.existsSync(orphanRequestFile);
      const ackRemoved = !fs.existsSync(orphanAckFile);
      if (requestRemoved && ackRemoved) return true;
      return null;
    }, 10_000).catch((error) => {
      throw new Error(`${error.message}\n${launcherLogs.join("")}`);
    });
    const checkpointAfterOrphanCleanup = await requestThoughtAnvilCheckpoint({
      checkpointFile,
      runtimeFile,
      rpcUrl,
      timeoutMs: 5_000,
    });
    assert.equal(checkpointAfterOrphanCleanup.runtime.sha256, runtimeSha256);
    fourthLauncher.kill("SIGTERM");
    const fourthExit = await waitForExit(fourthLauncher);
    assert.equal(fourthExit.code, 0);
    await waitFor("the final Anvil port to close", () => portIsClosed(port));

    fs.writeFileSync(orphanRequestFile, "{malformed", { mode: 0o600 });
    fs.writeFileSync(
      orphanAckFile,
      `${JSON.stringify({ requestId: "mismatched", checkpointId: "0".repeat(64) })}\n`,
      { mode: 0o600 },
    );
    const fifthLauncher = await startLauncher();
    assert.equal(fs.existsSync(orphanRequestFile), false);
    assert.equal(fs.existsSync(orphanAckFile), false);
    assert.equal(sha256File(runtimeFile), runtimeSha256);
    fifthLauncher.kill("SIGTERM");
    const fifthExit = await waitForExit(fifthLauncher);
    assert.equal(fifthExit.code, 0);
    await waitFor("the marker-clean startup port to close", () => portIsClosed(port));

    const completeGeneration = readCheckpoint(checkpointFile);
    const legacyRuntime = structuredClone(runtime);
    delete legacyRuntime.pathDeployment;
    fs.writeFileSync(
      stateFile,
      Buffer.from(completeGeneration.state.payloadBase64, "base64"),
      { mode: 0o600 },
    );
    fs.writeFileSync(runtimeFile, `${JSON.stringify(legacyRuntime)}\n`, {
      mode: 0o600,
    });
    const legacyRuntimeSha256 = sha256File(runtimeFile);
    fs.rmSync(checkpointFile);

    const sixthLauncher = await startLauncher({
      INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS: "60000",
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(runtimeFile, "utf8")), legacyRuntime);
    const migratedGeneration = readCheckpoint(checkpointFile);
    assert.equal(migratedGeneration.runtime.present, true);
    assert.equal(migratedGeneration.runtime.sha256, legacyRuntimeSha256);
    assert.deepEqual(
      JSON.parse(
        Buffer.from(migratedGeneration.runtime.payloadBase64, "base64").toString(
          "utf8",
        ),
      ),
      legacyRuntime,
    );
    assert.equal(await rpc(rpcUrl, "eth_getBalance", [recipient, "latest"]), "0x1264");
    sixthLauncher.kill("SIGTERM");
    const sixthExit = await waitForExit(sixthLauncher);
    assert.equal(sixthExit.code, 0);
    await waitFor("the legacy-migration port to close", () => portIsClosed(port));
    assert.equal(
      fs.readdirSync(temporaryDirectory).some((file) => file.endsWith(".tmp")),
      false,
    );
  },
);

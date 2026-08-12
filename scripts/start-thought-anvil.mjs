#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { keccak256 } from "../apps/thought/node_modules/ethers/lib.esm/index.js";

import {
  THOUGHT_ANVIL_CHAIN_ID,
  THOUGHT_ANVIL_CHECKPOINT_FILE,
  THOUGHT_ANVIL_HOST,
  THOUGHT_ANVIL_PORT,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_ANVIL_STATE_FILE,
  THOUGHT_CONTRACT_RUNTIME_FILE,
} from "./thought-local-lane.mjs";
import {
  THOUGHT_ANVIL_CHECKPOINT_ACK_FILE,
  THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE,
  THOUGHT_ANVIL_CHECKPOINT_SCHEMA,
  atomicWritePrivateFile,
  materializeCheckpointGeneration,
  migrateLegacyThoughtAnvilState,
  sha256,
} from "./thought-anvil-checkpoint.mjs";

const DEFAULT_CHECKPOINT_INTERVAL_MS = 15_000;
const MINIMUM_CHECKPOINT_INTERVAL_MS = 100;
const REQUEST_POLL_INTERVAL_MS = 100;
const MAX_CONSECUTIVE_CHECKPOINT_FAILURES = 3;
const RPC_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const PROTOCOL_FILE_MAX_AGE_MS = 30_000;
const protocolFileMaxAgeMs = Number(
  process.env.INSHELL_THOUGHT_ANVIL_PROTOCOL_FILE_MAX_AGE_MS?.trim() ||
    PROTOCOL_FILE_MAX_AGE_MS,
);
if (
  !Number.isSafeInteger(protocolFileMaxAgeMs) ||
  protocolFileMaxAgeMs < MINIMUM_CHECKPOINT_INTERVAL_MS
) {
  throw new Error(
    `INSHELL_THOUGHT_ANVIL_PROTOCOL_FILE_MAX_AGE_MS must be an integer of at least ${MINIMUM_CHECKPOINT_INTERVAL_MS}.`,
  );
}

const parseCheckpointInterval = () => {
  const configured = process.env.INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS?.trim();
  if (!configured) return DEFAULT_CHECKPOINT_INTERVAL_MS;
  const milliseconds = Number(configured);
  if (
    !Number.isSafeInteger(milliseconds) ||
    milliseconds < MINIMUM_CHECKPOINT_INTERVAL_MS
  ) {
    throw new Error(
      `INSHELL_THOUGHT_ANVIL_CHECKPOINT_INTERVAL_MS must be an integer of at least ${MINIMUM_CHECKPOINT_INTERVAL_MS}.`,
    );
  }
  return milliseconds;
};

const checkpointIntervalMs = parseCheckpointInterval();
const stateDirectory = path.dirname(THOUGHT_ANVIL_STATE_FILE);
const checkpointDirectory = path.dirname(THOUGHT_ANVIL_CHECKPOINT_FILE);

await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
await fs.chmod(stateDirectory, 0o700);
if (checkpointDirectory !== stateDirectory) {
  await fs.mkdir(checkpointDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(checkpointDirectory, 0o700);
}
await fs.rm(THOUGHT_ANVIL_CHECKPOINT_ACK_FILE, { force: true });
await fs.rm(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, { force: true });

const readRuntimeIdentity = async () => {
  let raw;
  try {
    raw = await fs.readFile(THOUGHT_CONTRACT_RUNTIME_FILE);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return Object.freeze({ present: false, sha256: null });
    }
    throw error;
  }

  const runtime = JSON.parse(raw.toString("utf8"));
  const address = (key) => {
    const value = runtime?.[key]?.address;
    return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
      ? value.toLowerCase()
      : null;
  };
  const deploymentRecord = (key) => {
    const record = runtime?.pathDeployment?.contracts?.[key];
    return Object.freeze({
      address:
        typeof record?.address === "string" ? record.address.toLowerCase() : null,
      codeHash:
        typeof record?.codeHash === "string" ? record.codeHash.toLowerCase() : null,
      deployBlock: Number.isSafeInteger(record?.deployBlock)
        ? record.deployBlock
        : null,
    });
  };
  return Object.freeze({
    present: true,
    sha256: sha256(raw),
    schema: typeof runtime?.schema === "string" ? runtime.schema : null,
    status: typeof runtime?.status === "string" ? runtime.status : null,
    chainId: Number.isSafeInteger(runtime?.chainId) ? runtime.chainId : null,
    laneId:
      typeof runtime?.localLane?.id === "string" ? runtime.localLane.id : null,
    releaseTag:
      typeof runtime?.localLane?.pathRelease?.releaseTag === "string"
        ? runtime.localLane.pathRelease.releaseTag
        : null,
    manifestSha256:
      typeof runtime?.localLane?.pathRelease?.manifestSha256 === "string"
        ? runtime.localLane.pathRelease.manifestSha256
        : null,
    contracts: Object.freeze({
      thoughtNft: address("thoughtNft"),
      pathNft: address("pathNft"),
      pathPulseAdapter: address("pathPulseAdapter"),
      pulseAuction: address("pulseAuction"),
    }),
    pathDeployment: Object.freeze({
      schema:
        typeof runtime?.pathDeployment?.schema === "string"
          ? runtime.pathDeployment.schema
          : null,
      pathNft: deploymentRecord("pathNft"),
      pathPulseAdapter: deploymentRecord("pathPulseAdapter"),
      pulseAuction: deploymentRecord("pulseAuction"),
    }),
    payloadBase64: raw.toString("base64"),
    bytes: raw.byteLength,
  });
};

const rpc = async (method, params = []) => {
  const response = await fetch(THOUGHT_ANVIL_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Anvil RPC returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload?.error || payload?.result === undefined) {
    throw new Error(`Anvil RPC ${method} did not return a result.`);
  }
  return payload.result;
};

const decodeStateDump = (dump) => {
  if (typeof dump !== "string" || !/^0x[0-9a-fA-F]+$/.test(dump)) {
    throw new Error("Anvil returned an invalid state dump.");
  }
  const encoded = Buffer.from(dump.slice(2), "hex");
  const decoded =
    encoded[0] === 0x1f && encoded[1] === 0x8b ? gunzipSync(encoded) : encoded;
  const state = JSON.parse(decoded.toString("utf8"));
  if (!/^0x[0-9a-fA-F]+$/.test(state?.block?.number ?? "")) {
    throw new Error("Anvil state dump is missing its block identity.");
  }
  return Object.freeze({ decoded, state });
};

const assertPathDeploymentIdentity = async (runtime) => {
  if (!runtime.present || runtime.pathDeployment.schema === null) return;
  if (runtime.pathDeployment.schema !== "inshell.path.local-deployment.v1") {
    throw new Error("THOUGHT checkpoint runtime has an invalid PATH deployment schema.");
  }
  for (const key of ["pathNft", "pathPulseAdapter", "pulseAuction"]) {
    const record = runtime.pathDeployment[key];
    if (
      !/^0x[a-f0-9]{40}$/.test(record.address ?? "") ||
      !/^0x[a-f0-9]{64}$/.test(record.codeHash ?? "") ||
      !Number.isSafeInteger(record.deployBlock) ||
      runtime.contracts[key] !== record.address
    ) {
      throw new Error(`THOUGHT checkpoint runtime has an invalid PATH ${key} identity.`);
    }
    const code = await rpc("eth_getCode", [record.address, "latest"]);
    if (
      typeof code !== "string" ||
      /^0x0*$/i.test(code) ||
      keccak256(code).toLowerCase() !== record.codeHash
    ) {
      throw new Error(`THOUGHT checkpoint PATH ${key} code does not match runtime.`);
    }
  }
};

let restoring = false;
try {
  const checkpoint = await materializeCheckpointGeneration();
  if (checkpoint.chain.chainId !== Number(THOUGHT_ANVIL_CHAIN_ID)) {
    throw new Error("THOUGHT checkpoint belongs to another chain.");
  }
  restoring = true;
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  const legacyMigrated = await migrateLegacyThoughtAnvilState({
    chainId: Number(THOUGHT_ANVIL_CHAIN_ID),
  });
  if (legacyMigrated) {
    await materializeCheckpointGeneration();
    restoring = true;
  }
}

const args = [
  "--host",
  THOUGHT_ANVIL_HOST,
  "--port",
  THOUGHT_ANVIL_PORT,
  "--chain-id",
  THOUGHT_ANVIL_CHAIN_ID,
  ...(restoring ? ["--load-state", THOUGHT_ANVIL_STATE_FILE] : []),
  "--silent",
];

console.log(
  `Starting isolated THOUGHT Anvil on ${THOUGHT_ANVIL_HOST}:${THOUGHT_ANVIL_PORT}.`,
);
console.log(`${restoring ? "Restoring" : "Creating"} the THOUGHT lane state.`);
console.log(
  `Atomic THOUGHT lane checkpoints are enabled every ${checkpointIntervalMs} ms.`,
);
console.log("This node contains a pinned PATH dependency and THOUGHT contracts only.");

const child = spawn("anvil", args, { stdio: "inherit" });
let checkpointInFlight = null;
let checkpointQueue = Promise.resolve();
let shuttingDown = false;
let checkpointFailureStop = false;
let periodicCheckpointTimer;
let requestPollTimer;
let shutdownTimer;
let consecutiveCheckpointFailures = 0;
let lastRequestId = null;
let pendingRequestId = null;
let checkpointRequestReserved = false;

const readCheckpointRequest = async () => {
  try {
    const request = JSON.parse(
      await fs.readFile(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, "utf8"),
    );
    await fs.chmod(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, 0o600);
    if (
      typeof request?.requestId !== "string" ||
      typeof request?.runtimeSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(request.runtimeSha256) ||
      !/^0x[0-9a-f]+$/.test(request?.minimumBlock ?? "")
    ) {
      throw new Error("THOUGHT checkpoint request is invalid.");
    }
    return request;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

const checkpointRequestIsFresh = async () => {
  try {
    const stats = await fs.stat(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE);
    return Date.now() - stats.mtimeMs <= protocolFileMaxAgeMs;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const persistCheckpoint = async (request = null) => {
  const runtimeBefore = await readRuntimeIdentity();
  const runtimeReady =
    runtimeBefore.present &&
    runtimeBefore.schema === "inshell.thought.v2.anvil-gallery-runtime.v1" &&
    runtimeBefore.status === "ready" &&
    runtimeBefore.pathDeployment.schema === "inshell.path.local-deployment.v1";
  if (!runtimeReady) {
    if (!request) return null;
    throw new Error("THOUGHT checkpoint request requires a complete ready runtime.");
  }
  if (request && runtimeBefore.sha256 !== request.runtimeSha256) {
    throw new Error("THOUGHT checkpoint request runtime does not match disk.");
  }
  const chainIdHex = await rpc("eth_chainId");
  const { decoded, state } = decodeStateDump(await rpc("anvil_dumpState"));
  const runtimeAfter = await readRuntimeIdentity();
  if (runtimeBefore.sha256 !== runtimeAfter.sha256) {
    throw new Error("THOUGHT runtime changed while its state was checkpointed.");
  }

  const chainId = Number(BigInt(chainIdHex));
  if (chainId !== Number(THOUGHT_ANVIL_CHAIN_ID)) {
    throw new Error("THOUGHT checkpoint observed the wrong chain.");
  }
  if (
    runtimeAfter.present &&
    runtimeAfter.chainId !== null &&
    runtimeAfter.chainId !== chainId
  ) {
    throw new Error("THOUGHT runtime identity does not match its chain.");
  }
  await assertPathDeploymentIdentity(runtimeAfter);

  const stateSha256 = sha256(decoded);
  const blockNumber = state.block.number.toLowerCase();
  if (request && BigInt(blockNumber) < BigInt(request.minimumBlock)) {
    throw new Error("THOUGHT checkpoint predates its requested minimum block.");
  }
  const checkpointId = sha256(
    [
      THOUGHT_ANVIL_CHECKPOINT_SCHEMA,
      chainIdHex.toLowerCase(),
      blockNumber,
      stateSha256,
      runtimeAfter.sha256 ?? "absent",
    ].join(":"),
  );
  const checkpoint = {
    schema: THOUGHT_ANVIL_CHECKPOINT_SCHEMA,
    checkpointId,
    requestId: request?.requestId ?? null,
    createdAt: new Date().toISOString(),
    chain: {
      chainId,
      chainIdHex: chainIdHex.toLowerCase(),
      blockNumber,
    },
    state: {
      bytes: decoded.byteLength,
      sha256: stateSha256,
      payloadBase64: decoded.toString("base64"),
    },
    runtime: runtimeAfter,
  };

  await atomicWritePrivateFile(
    THOUGHT_ANVIL_CHECKPOINT_FILE,
    `${JSON.stringify(checkpoint)}\n`,
  );
  return checkpoint;
};

const checkpoint = async (request = null) => {
  const queued = checkpointQueue.catch(() => {}).then(() => persistCheckpoint(request));
  checkpointQueue = queued;
  checkpointInFlight = queued;
  void queued.then(
    () => {
      if (checkpointInFlight === queued) checkpointInFlight = null;
    },
    () => {
      if (checkpointInFlight === queued) checkpointInFlight = null;
    },
  );
  return queued;
};

const failStop = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  checkpointFailureStop = true;
  clearCheckpointTimers();
  console.error("THOUGHT checkpoint failed repeatedly; stopping for supervisor recovery.");
  child.kill("SIGTERM");
  shutdownTimer = setTimeout(() => child.kill("SIGKILL"), SHUTDOWN_TIMEOUT_MS);
  shutdownTimer.unref();
};

const removeStaleProtocolFile = async (file) => {
  try {
    const stats = await fs.stat(file);
    if (Date.now() - stats.mtimeMs > protocolFileMaxAgeMs) {
      await fs.rm(file, { force: true });
      return true;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return false;
};

const attemptCheckpoint = async (request = null) => {
  try {
    const persisted = await checkpoint(request);
    if (persisted === null) {
      consecutiveCheckpointFailures = 0;
      return;
    }
    if (request) {
      await atomicWritePrivateFile(
        THOUGHT_ANVIL_CHECKPOINT_ACK_FILE,
        `${JSON.stringify({
          requestId: request.requestId,
          checkpointId: persisted.checkpointId,
        })}\n`,
      );
      await fs.rm(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, { force: true });
    }
    consecutiveCheckpointFailures = 0;
    if (request) lastRequestId = persisted.requestId;
  } catch {
    consecutiveCheckpointFailures += 1;
    if (consecutiveCheckpointFailures >= MAX_CONSECUTIVE_CHECKPOINT_FAILURES) {
      failStop();
    } else if (!shuttingDown) {
      console.warn("THOUGHT state checkpoint failed; the next interval will retry.");
    }
  }
};

const checkpointWithoutStateLogging = () => {
  void (async () => {
    await Promise.all([
      removeStaleProtocolFile(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE),
      removeStaleProtocolFile(THOUGHT_ANVIL_CHECKPOINT_ACK_FILE),
    ]);
    if (pendingRequestId || checkpointRequestReserved) return;
    const requestOrAckExists = await Promise.all([
      fs.stat(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE).then(() => true, () => false),
      fs.stat(THOUGHT_ANVIL_CHECKPOINT_ACK_FILE).then(() => true, () => false),
    ]);
    if (requestOrAckExists.some(Boolean)) return;
    await attemptCheckpoint();
  })();
};

const pollCheckpointRequest = () => {
  if (checkpointRequestReserved || pendingRequestId) return;
  checkpointRequestReserved = true;
  void (async () => {
    try {
      const request = await readCheckpointRequest();
      if (request && !(await checkpointRequestIsFresh())) {
        await fs.rm(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, { force: true });
        return;
      }
      if (request) {
        const runtime = await readRuntimeIdentity();
        if (request.runtimeSha256 !== runtime.sha256) {
          await fs.rm(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, { force: true });
          await fs.rm(THOUGHT_ANVIL_CHECKPOINT_ACK_FILE, { force: true });
          return;
        }
      }
      if (
        request &&
        request.requestId !== lastRequestId &&
        request.requestId !== pendingRequestId
      ) {
        pendingRequestId = request.requestId;
        try {
          await attemptCheckpoint(request);
        } finally {
          pendingRequestId = null;
        }
      }
    } catch {
      await fs.rm(THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE, { force: true });
      await fs.rm(THOUGHT_ANVIL_CHECKPOINT_ACK_FILE, { force: true });
    } finally {
      checkpointRequestReserved = false;
    }
  })();
};

periodicCheckpointTimer = setInterval(
  checkpointWithoutStateLogging,
  checkpointIntervalMs,
);
requestPollTimer = setInterval(pollCheckpointRequest, REQUEST_POLL_INTERVAL_MS);

const clearCheckpointTimers = () => {
  clearInterval(periodicCheckpointTimer);
  clearInterval(requestPollTimer);
};

const forwardSignal = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearCheckpointTimers();
  void (async () => {
    await checkpointInFlight?.catch(() => {});
    try {
      await checkpoint();
    } catch {
      console.warn("Final THOUGHT state checkpoint failed; preserving the last atomic checkpoint.");
    }
    child.kill(signal);
    shutdownTimer = setTimeout(() => child.kill("SIGKILL"), SHUTDOWN_TIMEOUT_MS);
    shutdownTimer.unref();
  })();
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("error", (error) => {
  clearCheckpointTimers();
  console.error(`Failed to start THOUGHT Anvil: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  clearCheckpointTimers();
  clearTimeout(shutdownTimer);
  if (signal && !shuttingDown) {
    console.error(`THOUGHT Anvil exited from ${signal}.`);
  }
  process.exit(checkpointFailureStop ? 1 : (code ?? (signal && !shuttingDown ? 1 : 0)));
});

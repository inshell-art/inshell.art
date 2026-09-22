import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  THOUGHT_ANVIL_CHECKPOINT_FILE,
  THOUGHT_ANVIL_STATE_FILE,
  THOUGHT_CONTRACT_RUNTIME_FILE,
} from "./thought-local-lane.mjs";

export const THOUGHT_ANVIL_CHECKPOINT_SCHEMA =
  "inshell.thought.anvil-checkpoint.v1";
export const THOUGHT_ANVIL_CHECKPOINT_REQUEST_FILE =
  `${THOUGHT_ANVIL_CHECKPOINT_FILE}.request`;
export const THOUGHT_ANVIL_CHECKPOINT_ACK_FILE =
  `${THOUGHT_ANVIL_CHECKPOINT_FILE}.ack`;

export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const syncDirectory = async (directory) => {
  let handle;
  try {
    handle = await fs.open(directory, "r");
    await handle.sync();
  } catch (error) {
    if (error?.code !== "EINVAL" && error?.code !== "ENOTSUP") throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
};

export const atomicWritePrivateFile = async (file, value) => {
  const temporaryFile = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(temporaryFile, "wx", 0o600);
    await handle.writeFile(value);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporaryFile, file);
    await fs.chmod(file, 0o600);
    await syncDirectory(path.dirname(file));
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
};

export const parseCheckpointBundle = (raw) => {
  const bundle = JSON.parse(Buffer.isBuffer(raw) ? raw.toString("utf8") : raw);
  if (
    bundle?.schema !== THOUGHT_ANVIL_CHECKPOINT_SCHEMA ||
    typeof bundle?.checkpointId !== "string" ||
    !/^[a-f0-9]{64}$/.test(bundle.checkpointId) ||
    !Number.isSafeInteger(bundle?.chain?.chainId) ||
    !/^0x[0-9a-f]+$/.test(bundle?.chain?.chainIdHex ?? "") ||
    !/^0x[0-9a-f]+$/.test(bundle?.chain?.blockNumber ?? "") ||
    typeof bundle?.state?.payloadBase64 !== "string" ||
    typeof bundle?.state?.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(bundle.state.sha256)
  ) {
    throw new Error("THOUGHT checkpoint bundle is invalid.");
  }
  const state = Buffer.from(bundle.state.payloadBase64, "base64");
  if (
    state.byteLength === 0 ||
    state.byteLength !== bundle.state.bytes ||
    sha256(state) !== bundle.state.sha256
  ) {
    throw new Error("THOUGHT checkpoint state payload failed integrity verification.");
  }
  let runtime = null;
  if (bundle.runtime?.present) {
    if (
      typeof bundle.runtime.payloadBase64 !== "string" ||
      typeof bundle.runtime.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(bundle.runtime.sha256)
    ) {
      throw new Error("THOUGHT checkpoint runtime payload is invalid.");
    }
    runtime = Buffer.from(bundle.runtime.payloadBase64, "base64");
    if (
      runtime.byteLength === 0 ||
      runtime.byteLength !== bundle.runtime.bytes ||
      sha256(runtime) !== bundle.runtime.sha256
    ) {
      throw new Error("THOUGHT checkpoint runtime payload failed integrity verification.");
    }
    JSON.parse(runtime.toString("utf8"));
  } else if (bundle.runtime?.sha256 !== null) {
    throw new Error("THOUGHT checkpoint absent runtime identity is invalid.");
  }
  const expectedCheckpointId = sha256(
    [
      bundle.schema,
      bundle.chain.chainIdHex,
      bundle.chain.blockNumber,
      bundle.state.sha256,
      bundle.runtime?.sha256 ?? "absent",
    ].join(":"),
  );
  if (bundle.checkpointId !== expectedCheckpointId) {
    throw new Error("THOUGHT checkpoint identity failed integrity verification.");
  }
  return Object.freeze({ bundle, runtime, state });
};

export const readCheckpointBundle = async (
  checkpointFile = THOUGHT_ANVIL_CHECKPOINT_FILE,
) => parseCheckpointBundle(await fs.readFile(checkpointFile));

export const materializeCheckpointGeneration = async () => {
  const { bundle, runtime, state } = await readCheckpointBundle();
  await atomicWritePrivateFile(THOUGHT_ANVIL_STATE_FILE, state);
  if (runtime) {
    await atomicWritePrivateFile(THOUGHT_CONTRACT_RUNTIME_FILE, runtime);
  } else {
    await fs.rm(THOUGHT_CONTRACT_RUNTIME_FILE, { force: true });
  }
  return bundle;
};

export const migrateLegacyThoughtAnvilState = async ({ chainId }) => {
  let state;
  try {
    state = await fs.readFile(THOUGHT_ANVIL_STATE_FILE);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  const parsed = JSON.parse(state.toString("utf8"));
  const blockNumber = parsed?.block?.number?.toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(blockNumber ?? "")) {
    throw new Error("Legacy THOUGHT Anvil state is invalid.");
  }
  const chainIdHex = `0x${BigInt(chainId).toString(16)}`;
  const stateSha256 = sha256(state);
  let runtime = { present: false, sha256: null };
  try {
    const runtimeBytes = await fs.readFile(THOUGHT_CONTRACT_RUNTIME_FILE);
    const descriptor = JSON.parse(runtimeBytes.toString("utf8"));
    const ready =
      descriptor?.schema === "inshell.thought.v2.anvil-gallery-runtime.v1" &&
      descriptor?.status === "ready" &&
      descriptor?.chainId === chainId &&
      descriptor?.localLane?.id === "thought";
    if (ready) {
      runtime = {
        present: true,
        sha256: sha256(runtimeBytes),
        bytes: runtimeBytes.byteLength,
        payloadBase64: runtimeBytes.toString("base64"),
      };
    }
  } catch {
    // Prepare will create the first complete authoritative runtime generation.
  }
  const bundle = {
    schema: THOUGHT_ANVIL_CHECKPOINT_SCHEMA,
    checkpointId: sha256(
      [
        THOUGHT_ANVIL_CHECKPOINT_SCHEMA,
        chainIdHex,
        blockNumber,
        stateSha256,
        runtime.sha256 ?? "absent",
      ].join(":"),
    ),
    requestId: null,
    createdAt: new Date().toISOString(),
    chain: { chainId, chainIdHex, blockNumber },
    state: {
      bytes: state.byteLength,
      sha256: stateSha256,
      payloadBase64: state.toString("base64"),
    },
    runtime,
  };
  await atomicWritePrivateFile(
    THOUGHT_ANVIL_CHECKPOINT_FILE,
    `${JSON.stringify(bundle)}\n`,
  );
  return true;
};

const readRuntimeSha256 = async (runtimeFile) =>
  sha256(await fs.readFile(runtimeFile));

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const requestThoughtAnvilCheckpoint = async ({
  checkpointFile = THOUGHT_ANVIL_CHECKPOINT_FILE,
  runtimeFile,
  rpcUrl,
  timeoutMs = 10_000,
}) => {
  const requestFile = `${checkpointFile}.request`;
  const ackFile = `${checkpointFile}.ack`;
  const runtimeSha256 = await readRuntimeSha256(runtimeFile);
  const blockResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
    signal: AbortSignal.timeout(2_000),
  });
  const blockPayload = await blockResponse.json();
  if (
    !blockResponse.ok ||
    blockPayload?.error ||
    !/^0x[0-9a-fA-F]+$/.test(blockPayload?.result ?? "")
  ) {
    throw new Error("THOUGHT checkpoint request could not read the current block.");
  }
  const minimumBlock = blockPayload.result.toLowerCase();
  const requestId = randomUUID();
  await fs.rm(ackFile, { force: true });
  await atomicWritePrivateFile(
    requestFile,
    `${JSON.stringify({ requestId, runtimeSha256, minimumBlock })}\n`,
  );

  const removeOwnedProtocolFile = async (file) => {
    try {
      const record = JSON.parse(await fs.readFile(file, "utf8"));
      if (record?.requestId === requestId) {
        await fs.rm(file, { force: true });
      }
    } catch {
      // Another process may already have consumed the protocol file.
    }
  };

  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const ack = JSON.parse(await fs.readFile(ackFile, "utf8"));
        const { bundle } = await readCheckpointBundle(checkpointFile);
        if (
          ack?.requestId === requestId &&
          ack?.checkpointId === bundle.checkpointId &&
          bundle.runtime?.sha256 === runtimeSha256 &&
          BigInt(bundle.chain.blockNumber) >= BigInt(minimumBlock)
        ) {
          return Object.freeze({ ...bundle, acknowledgedRequestId: requestId });
        }
      } catch {
        // A checkpoint may be in flight; the authoritative bundle is atomically replaced.
      }
      await sleep(50);
    }
    throw new Error("THOUGHT Anvil did not acknowledge the runtime checkpoint request.");
  } finally {
    await removeOwnedProtocolFile(requestFile);
    await removeOwnedProtocolFile(ackFile);
  }
};

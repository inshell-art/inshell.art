#!/usr/bin/env node

import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  Contract,
  JsonRpcProvider,
  encodeBytes32String,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";

import {
  PATH_RELEASE_PIN,
  THOUGHT_ANVIL_CHAIN_ID,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_CONTRACT_RUNTIME_FILE,
  THOUGHT_PATH_FIXTURE_COUNT,
  THOUGHT_PATH_FIXTURE_SIGNER_INDEX,
  resolvePinnedPathRelease,
  root,
  thoughtLaneEnvironment,
} from "./thought-local-lane.mjs";

const rpc = async (method, params = []) => {
  const response = await fetch(THOUGHT_ANVIL_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      `${method} failed: ${payload.error?.message ?? `HTTP ${response.status}`}`,
    );
  }
  return payload.result;
};

const readRuntime = async () => {
  try {
    return JSON.parse(await fs.readFile(THOUGHT_CONTRACT_RUNTIME_FILE, "utf8"));
  } catch {
    return null;
  }
};

const runtimeAddresses = (runtime) => [
  ...Object.values(runtime?.contracts ?? {}),
  runtime?.pathPulseAdapter?.address,
  runtime?.pulseAuction?.address,
].filter((address) => typeof address === "string");

const pathFixtureAbi = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getAuthorizedMinter(bytes32 movement) view returns (address)",
  "function getMovementQuota(bytes32 movement) view returns (uint32)",
  "function isMovementFrozen(bytes32 movement) view returns (bool)",
  "function isSparker(uint256 tokenId) view returns (bool)",
];

const hasReadyPathFixtures = async (runtime) => {
  const fixtures = runtime?.pathFixtures;
  const tokens = Array.isArray(fixtures?.tokens) ? fixtures.tokens : [];
  if (
    fixtures?.schema !== "inshell.thought.local-path-fixtures.v1" ||
    fixtures?.disposableOnly !== true ||
    fixtures?.source !== "reserved-spark-self-claim" ||
    fixtures?.pathReleaseTag !== PATH_RELEASE_PIN.releaseTag ||
    fixtures?.ownerSignerIndex !== THOUGHT_PATH_FIXTURE_SIGNER_INDEX ||
    fixtures?.movement !== "THOUGHT" ||
    fixtures?.movementQuotaPerToken !== 1 ||
    fixtures?.count !== THOUGHT_PATH_FIXTURE_COUNT ||
    tokens.length !== THOUGHT_PATH_FIXTURE_COUNT
  ) {
    return false;
  }

  try {
    const accounts = await rpc("eth_accounts");
    const fixtureOwner = accounts?.[THOUGHT_PATH_FIXTURE_SIGNER_INDEX];
    if (
      typeof fixtureOwner !== "string" ||
      fixtures.initialOwner?.toLowerCase() !== fixtureOwner.toLowerCase()
    ) {
      return false;
    }
    const provider = new JsonRpcProvider(THOUGHT_ANVIL_RPC_URL);
    const pathNft = new Contract(
      runtime.contracts.pathNft,
      pathFixtureAbi,
      provider,
    );
    const movement = encodeBytes32String("THOUGHT");
    const [authorizedMinter, quota, frozen, tokenStates] = await Promise.all([
      pathNft.getAuthorizedMinter(movement),
      pathNft.getMovementQuota(movement),
      pathNft.isMovementFrozen(movement),
      Promise.all(tokens.map(async (token) => ({
        owner: await pathNft.ownerOf(BigInt(token.tokenId)),
        sparker: await pathNft.isSparker(BigInt(token.tokenId)),
      }))),
    ]);
    if (
      authorizedMinter.toLowerCase() !== runtime.contracts.thoughtNft.toLowerCase() ||
      quota !== 1n ||
      frozen !== true
    ) {
      return false;
    }
    return tokenStates.every((state) =>
      state.owner.toLowerCase() === fixtureOwner.toLowerCase() &&
      state.sparker === true
    );
  } catch {
    return false;
  }
};

const isReadyRuntime = async (runtime) => {
  if (
    runtime?.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime?.status !== "ready" ||
    runtime?.chainId !== Number(THOUGHT_ANVIL_CHAIN_ID) ||
    runtime?.rpcUrl !== THOUGHT_ANVIL_RPC_URL ||
    runtime?.localLane?.id !== "thought" ||
    runtime?.localLane?.isolation !== "dedicated-anvil" ||
    runtime?.localLane?.pathRelease?.releaseTag !== PATH_RELEASE_PIN.releaseTag ||
    runtime?.localLane?.pathRelease?.manifestSha256 !== PATH_RELEASE_PIN.manifestSha256
  ) {
    return false;
  }
  const addresses = runtimeAddresses(runtime);
  if (addresses.length < 8) return false;
  const codes = await Promise.all(addresses.map((address) => rpc("eth_getCode", [address, "latest"])));
  return (
    codes.every((code) => typeof code === "string" && !/^0x0*$/i.test(code)) &&
    await hasReadyPathFixtures(runtime)
  );
};

const runDeployment = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/deploy-thought-v2-integration-preview-anvil.mjs"],
      {
        cwd: root,
        env: thoughtLaneEnvironment(),
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`THOUGHT deployment exited with ${signal ?? code}`));
    });
  });

await resolvePinnedPathRelease();
const chainId = Number(BigInt(await rpc("eth_chainId")));
if (chainId !== Number(THOUGHT_ANVIL_CHAIN_ID)) {
  throw new Error(
    `THOUGHT lane chain ID is ${chainId}; expected ${THOUGHT_ANVIL_CHAIN_ID}.`,
  );
}

let runtime = await readRuntime();
if (await isReadyRuntime(runtime)) {
  console.log(`THOUGHT lane already ready at ${THOUGHT_ANVIL_RPC_URL}`);
  console.log(`Runtime: ${THOUGHT_CONTRACT_RUNTIME_FILE}`);
  process.exit(0);
}

const [deployer] = await rpc("eth_accounts");
if (typeof deployer !== "string") {
  throw new Error("THOUGHT Anvil did not expose a local deployer account.");
}
const nonce = Number(BigInt(await rpc("eth_getTransactionCount", [deployer, "latest"])));
if (nonce !== 0) {
  throw new Error(
    "THOUGHT lane has chain activity but no matching runtime descriptor. " +
      "Stop it and run pnpm dev:thought:node:reset before preparing again.",
  );
}

console.log(`Deploying pinned PATH ${PATH_RELEASE_PIN.releaseTag} plus current THOUGHT V2...`);
await runDeployment();
runtime = await readRuntime();
if (!(await isReadyRuntime(runtime))) {
  throw new Error("THOUGHT deployment completed without a valid runtime descriptor.");
}

console.log(`THOUGHT lane prepared at ${THOUGHT_ANVIL_RPC_URL}`);
console.log(`Runtime: ${THOUGHT_CONTRACT_RUNTIME_FILE}`);

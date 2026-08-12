#!/usr/bin/env node

import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  Contract,
  JsonRpcProvider,
  encodeBytes32String,
  keccak256,
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
import { requestThoughtAnvilCheckpoint } from "./thought-anvil-checkpoint.mjs";

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

const writeRuntime = async (runtime) => {
  const temporary = `${THOUGHT_CONTRACT_RUNTIME_FILE}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(runtime, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporary, THOUGHT_CONTRACT_RUNTIME_FILE);
};

const checkpointPreparedRuntime = () =>
  requestThoughtAnvilCheckpoint({
    runtimeFile: THOUGHT_CONTRACT_RUNTIME_FILE,
    rpcUrl: THOUGHT_ANVIL_RPC_URL,
  });

const contractDeploymentBlocks = async (contracts) => {
  const wanted = new Map(
    Object.entries(contracts).map(([key, address]) => [address.toLowerCase(), key]),
  );
  const blocks = {};
  const latest = Number(BigInt(await rpc("eth_blockNumber")));
  for (let blockNumber = 0; blockNumber <= latest && wanted.size > 0; blockNumber += 1) {
    const block = await rpc("eth_getBlockByNumber", [
      `0x${blockNumber.toString(16)}`,
      true,
    ]);
    for (const transaction of block?.transactions ?? []) {
      if (transaction?.to != null || typeof transaction?.hash !== "string") continue;
      const receipt = await rpc("eth_getTransactionReceipt", [transaction.hash]);
      const address = receipt?.contractAddress?.toLowerCase();
      const key = wanted.get(address);
      if (!key) continue;
      blocks[key] = Number(BigInt(receipt.blockNumber));
      wanted.delete(address);
    }
  }
  if (wanted.size > 0) {
    throw new Error(
      `THOUGHT lane is missing PATH deployment receipts for ${[...wanted.values()].join(", ")}.`,
    );
  }
  return blocks;
};

const immutableRanges = (artifact) =>
  Object.values(artifact.immutableReferences ?? {}).flatMap((ranges) => ranges);

const immutableCompatibleCode = (actualCode, artifact) => {
  const actual = actualCode.replace(/^0x/, "").toLowerCase();
  const expected = String(artifact.deployedBytecode ?? "")
    .replace(/^0x/, "")
    .toLowerCase();
  if (!expected || actual.length !== expected.length) return false;
  const masked = new Set();
  for (const range of immutableRanges(artifact)) {
    for (let byte = range.start; byte < range.start + range.length; byte += 1) {
      masked.add(byte);
    }
  }
  for (let byte = 0; byte < actual.length / 2; byte += 1) {
    if (masked.has(byte)) continue;
    const offset = byte * 2;
    if (actual.slice(offset, offset + 2) !== expected.slice(offset, offset + 2)) {
      return false;
    }
  }
  return true;
};

const assertPathWiring = async (runtime, artifacts) => {
  const provider = new JsonRpcProvider(THOUGHT_ANVIL_RPC_URL);
  const pathNftAddress = runtime.pathNft.address;
  const adapterAddress = runtime.pathPulseAdapter.address;
  const auctionAddress = runtime.pulseAuction.address;
  const pathNft = new Contract(
    pathNftAddress,
    JSON.parse(await fs.readFile(artifacts.PathNFT, "utf8")).abi,
    provider,
  );
  const adapter = new Contract(
    adapterAddress,
    JSON.parse(await fs.readFile(artifacts.PathPulseAdapter, "utf8")).abi,
    provider,
  );
  const auction = new Contract(
    auctionAddress,
    JSON.parse(await fs.readFile(artifacts.PulseAuction, "utf8")).abi,
    provider,
  );
  const [
    adapterConfig,
    wiringFrozen,
    tokenBase,
    epochBase,
    publicMinter,
    publicMinterFrozen,
    sparkClaimDuration,
    reservedCap,
    auctionConfig,
    mintAdapter,
    paymentToken,
    treasury,
    auctionDeployer,
  ] =
    await Promise.all([
      adapter.getConfig(),
      adapter.wiringFrozen(),
      adapter.tokenBase(),
      adapter.epochBase(),
      pathNft.publicMinter(),
      pathNft.publicMinterFrozen(),
      pathNft.sparkClaimDuration(),
      pathNft.getReservedCap(),
      auction.getConfig(),
      auction.mintAdapter(),
      auction.paymentToken(),
      auction.treasury(),
      auction.deployer(),
    ]);
  const same = (left, right) => left.toLowerCase() === right.toLowerCase();
  if (
    !same(adapterConfig[0], auctionAddress) ||
    !same(adapterConfig[1], pathNftAddress) ||
    wiringFrozen !== true ||
    tokenBase !== 1n ||
    epochBase !== 1n ||
    !same(publicMinter, adapterAddress) ||
    publicMinterFrozen !== true ||
    sparkClaimDuration !== BigInt(runtime.pathSpark.claimDurationSeconds) ||
    reservedCap !== BigInt(runtime.pathSpark.reservedCap) ||
    !same(mintAdapter, adapterAddress) ||
    !same(paymentToken, runtime.paymentToken.address) ||
    !same(treasury, runtime.pathAuction.treasury) ||
    !same(auctionDeployer, runtime.pathSpark.issuer) ||
    Number(auctionConfig[0]) !== runtime.pathAuction.openTime ||
    String(auctionConfig[1]) !== runtime.pathAuction.genesisPrice ||
    String(auctionConfig[2]) !== runtime.pathAuction.genesisFloor ||
    String(auctionConfig[3]) !== runtime.pathAuction.k ||
    String(auctionConfig[4]) !== runtime.pathAuction.pts
  ) {
    throw new Error("THOUGHT lane PATH wiring/config does not match its runtime descriptor.");
  }
};

const enrichPathDeployment = async (runtime, pathRelease) => {
  const contracts = {
    pathNft: runtime?.pathNft?.address,
    pathPulseAdapter: runtime?.pathPulseAdapter?.address,
    pulseAuction: runtime?.pulseAuction?.address,
  };
  if (
    Object.values(contracts).some(
      (address) => typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address),
    )
  ) {
    throw new Error("THOUGHT runtime is missing PATH deployment addresses.");
  }
  const deploymentBlocks = await contractDeploymentBlocks(contracts);
  const records = {};
  const artifactNames = {
    pathNft: "PathNFT",
    pathPulseAdapter: "PathPulseAdapter",
    pulseAuction: "PulseAuction",
  };
  for (const [key, address] of Object.entries(contracts)) {
    const code = await rpc("eth_getCode", [address, "latest"]);
    if (typeof code !== "string" || /^0x0*$/i.test(code)) {
      throw new Error(`THOUGHT lane has no code for PATH ${key}.`);
    }
    const artifact = JSON.parse(
      await fs.readFile(pathRelease.artifacts[artifactNames[key]], "utf8"),
    );
    if (!immutableCompatibleCode(code, artifact)) {
      throw new Error(`THOUGHT lane PATH ${key} bytecode is not the pinned release.`);
    }
    records[key] = {
      address,
      deployBlock: deploymentBlocks[key],
      codeHash: keccak256(code),
    };
  }
  const next = {
    ...runtime,
    pathDeployment: {
      schema: "inshell.path.local-deployment.v1",
      chainId: Number(THOUGHT_ANVIL_CHAIN_ID),
      releaseTag: PATH_RELEASE_PIN.releaseTag,
      releasePublicationCommit: PATH_RELEASE_PIN.releasePublicationCommit,
      contractSourceCommit: PATH_RELEASE_PIN.contractSourceCommit,
      manifestSha256: PATH_RELEASE_PIN.manifestSha256,
      contracts: records,
      paymentToken: runtime.paymentToken.address,
      auction: runtime.pathAuction,
    },
  };
  await assertPathWiring(runtime, pathRelease.artifacts);
  if (JSON.stringify(next.pathDeployment) !== JSON.stringify(runtime.pathDeployment)) {
    await writeRuntime(next);
  }
  return next;
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
  "function sparkName(uint256 tokenId) view returns (string)",
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
        sparkName: await pathNft.sparkName(BigInt(token.tokenId)),
        expectedSparkName: token.sparkName,
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
      state.sparker === true &&
      state.sparkName === state.expectedSparkName
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
    runtime?.localLane?.pathRelease?.manifestSha256 !== PATH_RELEASE_PIN.manifestSha256 ||
    runtime?.localLane?.pathRelease?.consumeAuthorizationSchema !==
      PATH_RELEASE_PIN.consumeAuthorizationSchema ||
    runtime?.localLane?.pathRelease?.pathNftRedeploymentRequired !== true
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

const pathRelease = await resolvePinnedPathRelease();
const chainId = Number(BigInt(await rpc("eth_chainId")));
if (chainId !== Number(THOUGHT_ANVIL_CHAIN_ID)) {
  throw new Error(
    `THOUGHT lane chain ID is ${chainId}; expected ${THOUGHT_ANVIL_CHAIN_ID}.`,
  );
}

let runtime = await readRuntime();
if (await isReadyRuntime(runtime)) {
  runtime = await enrichPathDeployment(runtime, pathRelease);
  await checkpointPreparedRuntime();
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
runtime = await enrichPathDeployment(runtime, pathRelease);
await checkpointPreparedRuntime();

console.log(`THOUGHT lane prepared at ${THOUGHT_ANVIL_RPC_URL}`);
console.log(`Runtime: ${THOUGHT_CONTRACT_RUNTIME_FILE}`);

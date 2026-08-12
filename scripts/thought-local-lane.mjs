import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const THOUGHT_ANVIL_HOST =
  process.env.INSHELL_THOUGHT_ANVIL_HOST?.trim() || "127.0.0.1";
export const THOUGHT_ANVIL_PORT =
  process.env.INSHELL_THOUGHT_ANVIL_PORT?.trim() || "8547";
export const THOUGHT_ANVIL_CHAIN_ID =
  process.env.INSHELL_THOUGHT_ANVIL_CHAIN_ID?.trim() || "31338";
const reachableHost = (bindHost) =>
  bindHost === "0.0.0.0" || bindHost === "::" ? "127.0.0.1" : bindHost;
export const THOUGHT_ANVIL_RPC_URL =
  process.env.INSHELL_THOUGHT_ANVIL_RPC_URL?.trim() ||
  `http://${reachableHost(THOUGHT_ANVIL_HOST)}:${THOUGHT_ANVIL_PORT}`;
export const THOUGHT_APP_HOST =
  process.env.INSHELL_THOUGHT_APP_HOST?.trim() || "127.0.0.1";
export const THOUGHT_APP_PORT =
  process.env.INSHELL_THOUGHT_APP_PORT?.trim() || "5176";
export const THOUGHT_HOME_HOST =
  process.env.INSHELL_THOUGHT_HOME_HOST?.trim() || "127.0.0.1";
export const THOUGHT_HOME_PORT =
  process.env.INSHELL_THOUGHT_HOME_PORT?.trim() || "5177";
export const THOUGHT_PUBLIC_HOST =
  process.env.INSHELL_THOUGHT_PUBLIC_HOST?.trim() || reachableHost(THOUGHT_HOME_HOST);
export const THOUGHT_PUBLIC_RPC_URL =
  process.env.INSHELL_THOUGHT_PUBLIC_RPC_URL?.trim() ||
  `http://${THOUGHT_PUBLIC_HOST}:${THOUGHT_ANVIL_PORT}`;
export const THOUGHT_APP_ORIGIN =
  `http://${reachableHost(THOUGHT_APP_HOST)}:${THOUGHT_APP_PORT}`;
export const THOUGHT_HOME_ORIGIN =
  `http://${reachableHost(THOUGHT_HOME_HOST)}:${THOUGHT_HOME_PORT}`;
export const THOUGHT_HOME_URL =
  `http://${THOUGHT_PUBLIC_HOST}:${THOUGHT_HOME_PORT}/`;
export const THOUGHT_APP_URL = new URL("thought/", THOUGHT_HOME_URL).toString();
export const THOUGHT_PATH_FIXTURE_SIGNER_INDEX = 1;
export const THOUGHT_PATH_FIXTURE_COUNT = 8;
export const THOUGHT_ANVIL_STATE_FILE = path.resolve(
  process.env.INSHELL_THOUGHT_ANVIL_STATE_FILE?.trim() ||
    path.join(root, ".local", "anvil", "thought", "state.json"),
);
export const THOUGHT_ANVIL_CHECKPOINT_FILE = path.resolve(
  process.env.INSHELL_THOUGHT_ANVIL_CHECKPOINT_FILE?.trim() ||
    path.join(root, ".local", "anvil", "thought", "latest-checkpoint.json"),
);
export const THOUGHT_CONTRACT_RUNTIME_FILE = path.resolve(
  process.env.INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE?.trim() ||
    path.join(
      root,
      "apps",
      "thought",
      "contract-integration",
      "local-runtime.thought-anvil.json",
    ),
);

export const PATH_RELEASE_PIN = Object.freeze({
  releaseTag: "v0.5.0",
  releasePublicationCommit: "085cfc084b0e568740e0da639e968eb535f7e5c8",
  contractSourceCommit: "5a1ab1f137e76c80dc69045dc520454f6e07cbb1",
  manifestSha256: "a81355b459b40faea894cf1dfb7f484765a7ec62672039dd62d58a3a52849921",
  pathNftAbiSha256: "c66d840e88064753923668e6107ab9de8ce62130fa798de6f159540a14e899fe",
  consumeAuthorizationDigest: "eip191-personal-sign-struct-hash",
  consumeAuthorizationSchema: "permission-epoch-v1",
  consumeAuthorizationType:
    "ConsumeAuthorization(address pathNft,uint256 chainId,uint256 pathId,bytes32 movement,address claimer,address executor,uint256 permissionEpoch,uint256 nonce,uint256 deadline)",
  consumeAuthorizationPermissionEpochRead: "getPermissionEpoch(uint256)",
  consumeAuthorizationNonceRead: "getConsumeNonce(address)",
  consumeAuthorizationRequiredMethod:
    "consumeUnit(uint256,bytes32,address,uint256,bytes)",
  consumeAuthorizationRequiredReturnType: "uint32",
  deploymentAddressesIncluded: false,
  deploymentAddressSource: "separately-verified-target-chain-deployment-release",
  pathNftRedeploymentRequired: true,
  artifacts: Object.freeze({
    PathNFT: "c7e136539f94d6b5a4e3068c6afc1eaed26dea6c465d5716e83e2fc101d5583e",
    PathPulseAdapter: "ae0237c5731663e4a61fe1a676cec039665eea4d7fee26ee1a193305e58e1a31",
    PulseAuction: "d6ee3a6460fb02e6e391861ceab73b4fb8ee8cff0f1d514ca8695f717cdab796",
  }),
});

const sha256File = async (file) =>
  createHash("sha256").update(await fs.readFile(file)).digest("hex");

const linkedMainWorktreeRoot = async () => {
  try {
    const gitFile = await fs.readFile(path.join(root, ".git"), "utf8");
    const gitDirectory = gitFile.match(/^gitdir:\s*(.+)\s*$/m)?.[1];
    const worktreeMarker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
    const markerIndex = gitDirectory?.indexOf(worktreeMarker) ?? -1;
    return markerIndex === -1 ? null : gitDirectory.slice(0, markerIndex);
  } catch {
    return null;
  }
};

const pathReleaseCandidates = async () => {
  const configured = process.env.INSHELL_THOUGHT_PATH_RELEASE_DIR?.trim();
  const mainWorktreeRoot = await linkedMainWorktreeRoot();
  return [...new Set([
    configured ? path.resolve(configured) : null,
    path.join(
      root,
      "packages",
      "contracts",
      "src",
      "path-release",
      "releases",
      PATH_RELEASE_PIN.releaseTag,
    ),
    mainWorktreeRoot
      ? path.join(
          mainWorktreeRoot,
          "packages",
          "contracts",
          "src",
          "path-release",
          "releases",
          PATH_RELEASE_PIN.releaseTag,
        )
      : null,
    path.resolve(root, "..", "path", "releases", PATH_RELEASE_PIN.releaseTag),
    mainWorktreeRoot
      ? path.resolve(
          mainWorktreeRoot,
          "..",
          "path",
          "releases",
          PATH_RELEASE_PIN.releaseTag,
        )
      : null,
  ].filter(Boolean))];
};

const existingDirectory = async (candidate) => {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
};

export const resolvePinnedPathRelease = async () => {
  const candidates = await pathReleaseCandidates();
  const releaseDirectory =
    (await Promise.all(candidates.map(existingDirectory))).findIndex(Boolean);
  if (releaseDirectory === -1) {
    throw new Error(
      `Pinned PATH ${PATH_RELEASE_PIN.releaseTag} artifacts are unavailable. ` +
        "Set INSHELL_THOUGHT_PATH_RELEASE_DIR to the published PATH release directory.",
    );
  }

  const directory = candidates[releaseDirectory];
  const manifestFile = path.join(directory, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestFile, "utf8"));
  if (
    manifest.releaseTag !== PATH_RELEASE_PIN.releaseTag ||
    manifest.contractSourceCommit !== PATH_RELEASE_PIN.contractSourceCommit ||
    (await sha256File(manifestFile)) !== PATH_RELEASE_PIN.manifestSha256 ||
    manifest.compatibility?.consumeAuthorizationSchema !==
      PATH_RELEASE_PIN.consumeAuthorizationSchema ||
    manifest.compatibility?.pathNftRedeploymentRequired !==
      PATH_RELEASE_PIN.pathNftRedeploymentRequired
  ) {
    throw new Error(`Pinned PATH release manifest mismatch: ${manifestFile}`);
  }

  const artifacts = {};
  for (const [contract, expectedSha256] of Object.entries(PATH_RELEASE_PIN.artifacts)) {
    const artifactFile = path.join(directory, "hardhat", `${contract}.json`);
    if ((await sha256File(artifactFile)) !== expectedSha256) {
      throw new Error(`Pinned PATH ${contract} artifact mismatch: ${artifactFile}`);
    }
    artifacts[contract] = artifactFile;
  }

  return Object.freeze({
    artifacts: Object.freeze(artifacts),
    directory,
    manifest,
    pin: PATH_RELEASE_PIN,
  });
};

const requiredRuntimeAddress = (runtime, key) => {
  const value = runtime?.[key]?.address;
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`THOUGHT local runtime is missing ${key}.address.`);
  }
  return value;
};

export const pathLaneEnvironmentFromRuntime = (runtime) => {
  const deployment = runtime?.pathDeployment;
  const auction = deployment?.auction;
  if (
    runtime?.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime?.status !== "ready" ||
    runtime?.chainId !== Number(THOUGHT_ANVIL_CHAIN_ID) ||
    runtime?.localLane?.id !== "thought" ||
    runtime?.localLane?.isolation !== "dedicated-anvil" ||
    runtime?.localLane?.pathRelease?.releaseTag !== PATH_RELEASE_PIN.releaseTag ||
    runtime?.localLane?.pathRelease?.manifestSha256 !== PATH_RELEASE_PIN.manifestSha256 ||
    deployment?.schema !== "inshell.path.local-deployment.v1" ||
    deployment?.chainId !== Number(THOUGHT_ANVIL_CHAIN_ID) ||
    deployment?.releaseTag !== PATH_RELEASE_PIN.releaseTag ||
    deployment?.releasePublicationCommit !==
      PATH_RELEASE_PIN.releasePublicationCommit ||
    deployment?.contractSourceCommit !== PATH_RELEASE_PIN.contractSourceCommit ||
    deployment?.manifestSha256 !== PATH_RELEASE_PIN.manifestSha256 ||
    deployment?.paymentToken?.toLowerCase() !==
      requiredRuntimeAddress(runtime, "paymentToken").toLowerCase() ||
    !Number.isSafeInteger(auction?.openTime) ||
    [auction?.k, auction?.genesisPrice, auction?.genesisFloor, auction?.pts].some(
      (value) => typeof value !== "string" || !/^\d+$/.test(value),
    )
  ) {
    throw new Error("THOUGHT local runtime cannot configure the PATH dev surface.");
  }

  const runtimeAddresses = {
    pathNft: requiredRuntimeAddress(runtime, "pathNft"),
    pathPulseAdapter: requiredRuntimeAddress(runtime, "pathPulseAdapter"),
    pulseAuction: requiredRuntimeAddress(runtime, "pulseAuction"),
  };
  for (const [key, address] of Object.entries(runtimeAddresses)) {
    const record = deployment.contracts?.[key];
    if (
      record?.address?.toLowerCase() !== address.toLowerCase() ||
      !Number.isSafeInteger(record?.deployBlock) ||
      record.deployBlock < 0 ||
      typeof record?.codeHash !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/.test(record.codeHash)
    ) {
      throw new Error(`THOUGHT local runtime has an invalid PATH ${key} deployment record.`);
    }
  }

  return Object.freeze({
    VITE_NETWORK: "devnet",
    VITE_EVM_CHAIN_IDS: String(runtime.chainId),
    VITE_EXPECTED_CHAIN_ID: `0x${BigInt(runtime.chainId).toString(16)}`,
    VITE_PATH_NFT: runtimeAddresses.pathNft,
    VITE_PATH_PULSE_ADAPTER: runtimeAddresses.pathPulseAdapter,
    VITE_PULSE_AUCTION: runtimeAddresses.pulseAuction,
    VITE_PAYMENT_TOKEN: requiredRuntimeAddress(runtime, "paymentToken"),
    VITE_PATH_NFT_DEPLOY_BLOCK: String(deployment.contracts.pathNft.deployBlock),
    VITE_PULSE_AUCTION_DEPLOY_BLOCK: String(
      deployment.contracts.pulseAuction.deployBlock,
    ),
    VITE_PATH_ALLOW_DIRECT_AUCTION: "1",
  });
};

export const readThoughtPathLaneEnvironment = async () => {
  const runtime = JSON.parse(await fs.readFile(THOUGHT_CONTRACT_RUNTIME_FILE, "utf8"));
  return pathLaneEnvironmentFromRuntime(runtime);
};

export const thoughtLaneEnvironment = (extra = {}) => ({
  ...process.env,
  INSHELL_THOUGHT_ANVIL_HOST: THOUGHT_ANVIL_HOST,
  INSHELL_THOUGHT_ANVIL_PORT: THOUGHT_ANVIL_PORT,
  INSHELL_THOUGHT_ANVIL_CHAIN_ID: THOUGHT_ANVIL_CHAIN_ID,
  INSHELL_THOUGHT_ANVIL_RPC_URL: THOUGHT_ANVIL_RPC_URL,
  INSHELL_THOUGHT_ANVIL_STATE_FILE: THOUGHT_ANVIL_STATE_FILE,
  INSHELL_THOUGHT_ANVIL_CHECKPOINT_FILE: THOUGHT_ANVIL_CHECKPOINT_FILE,
  INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE: THOUGHT_CONTRACT_RUNTIME_FILE,
  INSHELL_THOUGHT_APP_HOST: THOUGHT_APP_HOST,
  INSHELL_THOUGHT_APP_PORT: THOUGHT_APP_PORT,
  INSHELL_THOUGHT_APP_ORIGIN: THOUGHT_APP_ORIGIN,
  INSHELL_THOUGHT_HOME_HOST: THOUGHT_HOME_HOST,
  INSHELL_THOUGHT_HOME_PORT: THOUGHT_HOME_PORT,
  INSHELL_THOUGHT_PUBLIC_HOST: THOUGHT_PUBLIC_HOST,
  INSHELL_THOUGHT_PUBLIC_RPC_URL: THOUGHT_PUBLIC_RPC_URL,
  VITE_INSHELL_HOME_URL: THOUGHT_HOME_URL,
  VITE_THOUGHT_URL: new URL("thought", THOUGHT_HOME_URL).toString(),
  VITE_GALLERY_URL: new URL("gallery", THOUGHT_HOME_URL).toString(),
  VITE_PATH_MINT_URL: new URL("path", THOUGHT_HOME_URL).toString(),
  VITE_THOUGHT_DETAIL_BASE_URL: new URL("thought", THOUGHT_HOME_URL).toString(),
  VITE_THOUGHT_RPC_URL: THOUGHT_PUBLIC_RPC_URL,
  VITE_PATH_RPC_URL: THOUGHT_PUBLIC_RPC_URL,
  VITE_ETH_RPC: THOUGHT_PUBLIC_RPC_URL,
  VITE_WALLET_CHAIN_RPC_URL: THOUGHT_PUBLIC_RPC_URL,
  VITE_THOUGHT_ROUTE_BASE: "/thought",
  RPC_URL: THOUGHT_ANVIL_RPC_URL,
  ...extra,
});

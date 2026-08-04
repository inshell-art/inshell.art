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
export const THOUGHT_ANVIL_RPC_URL =
  process.env.INSHELL_THOUGHT_ANVIL_RPC_URL?.trim() ||
  `http://${THOUGHT_ANVIL_HOST}:${THOUGHT_ANVIL_PORT}`;
export const THOUGHT_APP_HOST =
  process.env.INSHELL_THOUGHT_APP_HOST?.trim() || "127.0.0.1";
export const THOUGHT_APP_PORT =
  process.env.INSHELL_THOUGHT_APP_PORT?.trim() || "5176";
export const THOUGHT_APP_URL = `http://${THOUGHT_APP_HOST}:${THOUGHT_APP_PORT}/thought/`;
export const THOUGHT_HOME_HOST =
  process.env.INSHELL_THOUGHT_HOME_HOST?.trim() || "127.0.0.1";
export const THOUGHT_HOME_PORT =
  process.env.INSHELL_THOUGHT_HOME_PORT?.trim() || "5177";
export const THOUGHT_HOME_URL = `http://${THOUGHT_HOME_HOST}:${THOUGHT_HOME_PORT}/`;
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
  releaseTag: "v0.4.2",
  releasePublicationCommit: "8a8e4fe91857fdff8c54e9d4cc918b1e1f08cd76",
  contractSourceCommit: "1c846e1cfcd761a8e7b7e908edfa655204b62036",
  manifestSha256: "41cd0bc56398fe6823a3bd40a7497851b8ec132a8002a4f0a15bc5b284a29393",
  artifacts: Object.freeze({
    PathNFT: "d22d1f41f4621b36cabc4768f9139a5a9ed11b935537523b31baee28e61e9d1f",
    PathPulseAdapter: "91d344bb7f38c2e49d457090429a5c1a4c8aa80e147652ad53f082070a179671",
    PulseAuction: "b7ec12760ffbb0c9baa1d6e80d37d26bee599a9d5589cd21be31826366709081",
  }),
});

const sha256File = async (file) =>
  createHash("sha256").update(await fs.readFile(file)).digest("hex");

const pathReleaseCandidates = () => {
  const configured = process.env.INSHELL_THOUGHT_PATH_RELEASE_DIR?.trim();
  return [
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
    path.resolve(root, "..", "path", "releases", PATH_RELEASE_PIN.releaseTag),
  ].filter(Boolean);
};

const existingDirectory = async (candidate) => {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
};

export const resolvePinnedPathRelease = async () => {
  const candidates = pathReleaseCandidates();
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
    (await sha256File(manifestFile)) !== PATH_RELEASE_PIN.manifestSha256
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
  INSHELL_THOUGHT_APP_ORIGIN: `http://${THOUGHT_APP_HOST}:${THOUGHT_APP_PORT}`,
  INSHELL_THOUGHT_HOME_HOST: THOUGHT_HOME_HOST,
  INSHELL_THOUGHT_HOME_PORT: THOUGHT_HOME_PORT,
  VITE_INSHELL_HOME_URL: THOUGHT_HOME_URL,
  VITE_THOUGHT_ROUTE_BASE: "/thought",
  RPC_URL: THOUGHT_ANVIL_RPC_URL,
  ...extra,
});

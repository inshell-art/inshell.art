import { assertDeploymentConfiguration, THOUGHT_ACTIVATION_POLICY, THOUGHT_V2_PRODUCTION_DEPLOYMENT } from "../../../thought/src/thought-v2-production-deployment";
import { maybeResolveAddress, getProtocolReleaseChainId, getProtocolReleaseDeployBlock } from "@inshell/contracts";

if (THOUGHT_V2_PRODUCTION_DEPLOYMENT) {
  const selected = THOUGHT_V2_PRODUCTION_DEPLOYMENT;
  assertDeploymentConfiguration({
    ...selected, chainId: getProtocolReleaseChainId(),
    contracts: { ...selected.contracts, pathNft: maybeResolveAddress("path_nft")?.toLowerCase(),
      pulseAuction: maybeResolveAddress("pulse_auction")?.toLowerCase() },
    deployBlocks: { ...selected.deployBlocks, pathNft: getProtocolReleaseDeployBlock("path_nft"),
      pulseAuction: getProtocolReleaseDeployBlock("pulse_auction") },
  });
}

// The production deployment lock declares pathNft and thoughtNft together and
// refuses a partial record. This identifies the approved deployment, not every
// historical contract, and is not permission to mint. It is the answer to
// "which deployment may the public frontend use",
// and every surface must ask it rather than fall back to the raw address book.
export type PathDeployment = {
  chainId: number;
  pathNft: `0x${string}`;
};

const addressPattern = /^0x[0-9a-fA-F]{40}$/;

type LocalPathRuntime = {
  schema?: unknown;
  status?: unknown;
  chainId?: unknown;
  contracts?: { pathNft?: unknown };
};

declare global {
  var __INSHELL_PATH_CONTRACT_RUNTIME__: LocalPathRuntime | null | undefined;
}

const localRuntime = globalThis.__INSHELL_PATH_CONTRACT_RUNTIME__;
const LOCAL_PATH_DEPLOYMENT: PathDeployment | null =
  localRuntime?.status === "ready" &&
  Number.isSafeInteger(localRuntime.chainId) &&
  typeof localRuntime.contracts?.pathNft === "string" &&
  addressPattern.test(localRuntime.contracts.pathNft)
    ? {
        chainId: Number(localRuntime.chainId),
        pathNft: localRuntime.contracts.pathNft.toLowerCase() as `0x${string}`,
      }
    : null;

export const PATH_DEPLOYMENT: PathDeployment | null =
  THOUGHT_V2_PRODUCTION_DEPLOYMENT
    ? {
        chainId: THOUGHT_V2_PRODUCTION_DEPLOYMENT.chainId,
        pathNft: THOUGHT_V2_PRODUCTION_DEPLOYMENT.contracts.pathNft,
      }
    : LOCAL_PATH_DEPLOYMENT;

export function isPathDeploymentActive() {
  return PATH_DEPLOYMENT !== null;
}

export function isPathMintActivationApproved() {
  return Boolean(LOCAL_PATH_DEPLOYMENT) || Boolean(
    THOUGHT_V2_PRODUCTION_DEPLOYMENT &&
    THOUGHT_ACTIVATION_POLICY.frontendActivationApproved &&
    THOUGHT_ACTIVATION_POLICY.mintActivationApproved
  );
}

// The same three phases the THOUGHT surface walks, once per environment: the
// frontend ships before any contract exists, then contracts land and minting
// stays shut, then minting opens.
export type PathLaunchPhase = "not-deployed" | "countdown" | "open";

export function resolvePathLaunchPhase({
  deploymentActive,
  openTimeSec,
  nowSec,
}: {
  deploymentActive: boolean;
  openTimeSec?: number | null;
  nowSec: number;
}): PathLaunchPhase {
  if (!deploymentActive) return "not-deployed";
  if (typeof openTimeSec !== "number" || !Number.isFinite(openTimeSec)) {
    // A deployed contract with no readable open time stays shut. The clock in
    // the visitor's browser never opens minting on its own.
    return "countdown";
  }
  return nowSec < openTimeSec ? "countdown" : "open";
}

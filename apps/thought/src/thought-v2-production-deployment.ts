import deploymentLockJson from "../production/deployment-lock.json";
import { THOUGHT_V2_CONTRACT_RELEASE } from "./thought-v2-contract-release.generated";

export type ThoughtV2ProductionDeployment = {
  artifactId: string;
  manifestSha256: string;
  chainId: number;
  contracts: {
    pathNft: `0x${string}`;
    thoughtNft: `0x${string}`;
    thoughtRenderer: `0x${string}`;
    thoughtSpecRegistry: `0x${string}`;
    protocolRegistry: `0x${string}`;
    creationAttestationVerifier: `0x${string}`;
  };
  deployBlocks: {
    thoughtNft: number;
  };
  release: {
    protocolReleaseId: `0x${string}`;
    manifestKeccak256: `0x${string}`;
  };
  attestation: {
    authority: `0x${string}`;
    authorityEpoch: number;
  };
};

type DeploymentLock = {
  schema?: unknown;
  status?: unknown;
  enabled?: unknown;
  requiredArtifactId?: unknown;
  artifactId?: unknown;
  manifestSha256?: unknown;
  chainId?: unknown;
  contracts?: unknown;
  deployBlocks?: unknown;
  release?: unknown;
  attestation?: unknown;
  serverBindings?: unknown;
  authorization?: unknown;
};

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const bytes32Pattern = /^0x[0-9a-fA-F]{64}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

const requireAddress = (value: unknown, label: string): `0x${string}` => {
  if (typeof value !== "string" || !addressPattern.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`Production deployment lock has invalid ${label}.`);
  }
  return value.toLowerCase() as `0x${string}`;
};

const requireBytes32 = (value: unknown, label: string): `0x${string}` => {
  if (typeof value !== "string" || !bytes32Pattern.test(value) || /^0x0{64}$/i.test(value)) {
    throw new Error(`Production deployment lock has invalid ${label}.`);
  }
  return value.toLowerCase() as `0x${string}`;
};

export const readThoughtV2ProductionDeployment = (): ThoughtV2ProductionDeployment | null => {
  const lock = deploymentLockJson as DeploymentLock;
  const pinnedArtifactId: string = THOUGHT_V2_CONTRACT_RELEASE.artifactId;
  const pinnedManifestSha256: string = THOUGHT_V2_CONTRACT_RELEASE.manifestSha256;
  if (
    lock.schema !== "inshell.thought.production-deployment-lock.v1" ||
    lock.requiredArtifactId !== "thought-v2-canonical-portable-release-20260807-r2"
  ) {
    throw new Error("Production deployment lock identity drifted.");
  }
  if (lock.enabled !== true) {
    if (
      lock.status !== "not-deployed" ||
      lock.artifactId !== null ||
      lock.manifestSha256 !== null ||
      lock.chainId !== null ||
      lock.contracts !== null ||
      lock.deployBlocks !== null ||
      lock.release !== null ||
      lock.attestation !== null
    ) {
      throw new Error("Disabled production deployment lock contains deployment material.");
    }
    return null;
  }

  const authorization = lock.authorization as Record<string, unknown> | null;
  const bindings = lock.serverBindings as Record<string, unknown> | null;
  if (
    lock.status !== "verified-deployment" ||
    authorization?.deploymentApproved !== true ||
    authorization?.frontendActivationApproved !== true ||
    authorization?.signerActivationApproved !== true ||
    bindings?.rpc !== "THOUGHT_RPC_URL" ||
    bindings?.signer !== "THOUGHT_ATTESTATION_SIGNER"
  ) {
    throw new Error("Production deployment lock is not fully authorized.");
  }
  if (
    lock.artifactId !== lock.requiredArtifactId ||
    lock.artifactId !== pinnedArtifactId ||
    typeof lock.manifestSha256 !== "string" ||
    !sha256Pattern.test(lock.manifestSha256) ||
    lock.manifestSha256 !== pinnedManifestSha256 ||
    !Number.isSafeInteger(lock.chainId) ||
    Number(lock.chainId) < 1
  ) {
    throw new Error("Production deployment lock does not match the pinned Contract release.");
  }

  const contracts = lock.contracts as Record<string, unknown> | null;
  const deployBlocks = lock.deployBlocks as Record<string, unknown> | null;
  const release = lock.release as Record<string, unknown> | null;
  const attestation = lock.attestation as Record<string, unknown> | null;
  if (!contracts || !deployBlocks || !release || !attestation) {
    throw new Error("Production deployment lock is incomplete.");
  }
  const thoughtNftDeployBlock = deployBlocks.thoughtNft;
  if (!Number.isSafeInteger(thoughtNftDeployBlock) || Number(thoughtNftDeployBlock) < 1) {
    throw new Error("Production deployment lock has invalid thoughtNft deploy block.");
  }
  const authorityEpoch = attestation.authorityEpoch;
  if (!Number.isSafeInteger(authorityEpoch) || Number(authorityEpoch) < 1) {
    throw new Error("Production deployment lock has invalid authorityEpoch.");
  }
  return {
    artifactId: String(lock.artifactId),
    manifestSha256: String(lock.manifestSha256),
    chainId: Number(lock.chainId),
    contracts: {
      pathNft: requireAddress(contracts.pathNft, "pathNft"),
      thoughtNft: requireAddress(contracts.thoughtNft, "thoughtNft"),
      thoughtRenderer: requireAddress(contracts.thoughtRenderer, "thoughtRenderer"),
      thoughtSpecRegistry: requireAddress(contracts.thoughtSpecRegistry, "thoughtSpecRegistry"),
      protocolRegistry: requireAddress(contracts.protocolRegistry, "protocolRegistry"),
      creationAttestationVerifier: requireAddress(
        contracts.creationAttestationVerifier,
        "creationAttestationVerifier",
      ),
    },
    deployBlocks: {
      thoughtNft: Number(thoughtNftDeployBlock),
    },
    release: {
      protocolReleaseId: requireBytes32(release.protocolReleaseId, "protocolReleaseId"),
      manifestKeccak256: requireBytes32(release.manifestKeccak256, "manifestKeccak256"),
    },
    attestation: {
      authority: requireAddress(attestation.authority, "attestation authority"),
      authorityEpoch: Number(authorityEpoch),
    },
  };
};

export const THOUGHT_V2_PRODUCTION_DEPLOYMENT = readThoughtV2ProductionDeployment();

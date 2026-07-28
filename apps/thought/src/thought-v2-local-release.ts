import integrationLock from "../contract-integration/current/integration-lock.json";
import creativeSpecLock from "../spec/THOUGHT.v2.lock.json";

export type ThoughtV2LocalRuntimeAddresses = {
  chainId: number;
  pathNft: { address: string };
  thoughtNft: { address: string };
  thoughtSpecRegistry: { address: string };
  protocolRegistry: { address: string };
  protocolRelease: {
    id: string;
    manifestHash: string;
    rendererIdHash: string;
    workProfileIdHash: string;
    contextProfileIdHash: string;
    metadataProfileIdHash: string;
    creationAttestationProfileIdHash: string;
  };
  localContractIntegration?: {
    id?: string;
    productionConsumable?: boolean;
  };
  creationAttestationVerifier?: { address?: string };
  thoughtRenderer?: { address?: string };
  thoughtSpecs?: Array<{
    specName?: string;
    specId?: string;
    specHash?: string;
    ref?: string;
    byteLength?: number;
    sha256?: string;
  }>;
};

const lockedBaselineRuntime: ThoughtV2LocalRuntimeAddresses = {
  chainId: integrationLock.chain.chainId,
  pathNft: { address: "" },
  thoughtNft: { address: "" },
  thoughtSpecRegistry: { address: "" },
  protocolRegistry: { address: "" },
  thoughtRenderer: { address: "" },
  creationAttestationVerifier: { address: "" },
  protocolRelease: {
    id: integrationLock.runtimeBaseline.protocolRelease.id,
    manifestHash: integrationLock.runtimeBaseline.protocolRelease.manifestHash,
    rendererIdHash: integrationLock.runtimeBaseline.protocolRelease.rendererProfileHash,
    workProfileIdHash: integrationLock.runtimeBaseline.protocolRelease.workProfileHash,
    contextProfileIdHash: integrationLock.runtimeBaseline.protocolRelease.contextProfileHash,
    metadataProfileIdHash: integrationLock.runtimeBaseline.protocolRelease.metadataProfileHash,
    creationAttestationProfileIdHash:
      integrationLock.runtimeBaseline.protocolRelease.creationAttestationProfileHash,
  },
  thoughtSpecs: [{
    specName: integrationLock.runtimeBaseline.selectedSpec.name,
    specId: integrationLock.runtimeBaseline.selectedSpec.id,
    specHash: integrationLock.runtimeBaseline.selectedSpec.hash,
    ref: integrationLock.runtimeBaseline.selectedSpec.ref,
    byteLength: integrationLock.runtimeBaseline.selectedSpec.byteLength,
    sha256: integrationLock.runtimeBaseline.selectedSpec.sha256,
  }],
};
const injectedRuntime = (
  globalThis as typeof globalThis & {
    __INSHELL_THOUGHT_EVM_ADDRESSES__?: ThoughtV2LocalRuntimeAddresses | null;
  }
).__INSHELL_THOUGHT_EVM_ADDRESSES__;
const WORK_PROFILE_ID = "inshell.thought.work.v2.terminal-english-64";
const RENDERER_ID = "inshell.thought.svg.v2.terminal-chat-path-glyphs";
const CONTEXT_PROFILE_ID = "inshell.thought.context.v2.visible-utf8-64";
const METADATA_PROFILE_ID = "inshell.thought.metadata.v2.terminal-chat";
const CREATION_ATTESTATION_ID = "inshell.thought.creation-workflow-attestation.v1";

export const buildThoughtV2LocalRelease = (
  runtime: ThoughtV2LocalRuntimeAddresses = injectedRuntime ?? lockedBaselineRuntime,
) => {
  const runtimeSpec = runtime.thoughtSpecs?.[0];
  const isCanonicalAppSpec =
    runtimeSpec?.specName === creativeSpecLock.artifact.name &&
    runtimeSpec.specId?.toLowerCase() === creativeSpecLock.artifact.thoughtSpecId.toLowerCase() &&
    runtimeSpec.specHash?.toLowerCase() === creativeSpecLock.artifact.thoughtSpecHash.toLowerCase() &&
    runtimeSpec.byteLength === creativeSpecLock.artifact.byteLength &&
    runtimeSpec.sha256 === creativeSpecLock.artifact.sha256;
  const isCurrentLocalIntegration =
    runtime.localContractIntegration?.id === integrationLock.id &&
    runtime.localContractIntegration.productionConsumable === false &&
    isCanonicalAppSpec;

  return {
    eligibleForLocalMint: isCurrentLocalIntegration,
    classification: integrationLock.artifact.classification,
    artifact: {
      id: integrationLock.id,
      manifestSha256: integrationLock.artifact.manifestSha256,
      sourceTag: integrationLock.artifact.sourceTag,
      sourceCommit: integrationLock.source.commit,
      productionConsumable: false,
      deploymentAuthorized: false,
      registrationAuthorized: false,
    },
    chainId: runtime.chainId,
    protocol: {
      id: "inshell.thought.protocol.v2",
      protocolReleaseId: runtime.protocolRelease.id as `0x${string}`,
      manifestKeccak256: runtime.protocolRelease.manifestHash as `0x${string}`,
      workProfile: {
        id: WORK_PROFILE_ID,
        keccak256: integrationLock.runtimeBaseline.protocolRelease.workProfileHash,
      },
      rendererProfile: {
        id: RENDERER_ID,
        keccak256: integrationLock.runtimeBaseline.protocolRelease.rendererProfileHash,
        implementation:
          integrationLock.runtimeBaseline.protocolRelease.rendererImplementationId,
      },
      contextProfile: {
        id: CONTEXT_PROFILE_ID,
        keccak256: integrationLock.runtimeBaseline.protocolRelease.contextProfileHash,
      },
      metadataProfile: {
        id: METADATA_PROFILE_ID,
        keccak256: integrationLock.runtimeBaseline.protocolRelease.metadataProfileHash,
      },
      creationAttestation: {
        id: CREATION_ATTESTATION_ID,
        keccak256:
          integrationLock.runtimeBaseline.protocolRelease.creationAttestationProfileHash,
      },
    },
    spec: {
      name: creativeSpecLock.artifact.name,
      ref: `app://thought/creative-spec/${creativeSpecLock.artifactId}/${creativeSpecLock.artifact.name}`,
      evmSpecId: creativeSpecLock.artifact.thoughtSpecId as `0x${string}`,
      evmSpecHash: creativeSpecLock.artifact.thoughtSpecHash as `0x${string}`,
      sha256: creativeSpecLock.artifact.sha256,
      byteLength: creativeSpecLock.artifact.byteLength,
    },
    contracts: {
      pathNft: runtime.pathNft.address,
      thoughtNft: runtime.thoughtNft.address,
      thoughtSpecRegistry: runtime.thoughtSpecRegistry.address,
      thoughtRenderer: runtime.thoughtRenderer?.address ?? "",
      protocolRegistry: runtime.protocolRegistry.address,
      creationAttestationVerifier: runtime.creationAttestationVerifier?.address ?? "",
    },
  } as const;
};

export type ThoughtV2LocalRelease = ReturnType<typeof buildThoughtV2LocalRelease>;

export const THOUGHT_V2_LOCAL_RELEASE = buildThoughtV2LocalRelease();

export type ThoughtV2LocalRuntimeFacts = {
  dev: boolean;
  hostname: string;
  rpcUrl: string;
  pathRpcUrl: string;
  chainId: number;
  contracts: {
    pathNft: string;
    thoughtNft: string;
    thoughtSpecRegistry: string;
    thoughtRenderer: string;
    protocolRegistry: string;
    creationAttestationVerifier: string;
  };
  protocolReleaseId: string;
  manifestHash: string;
  rendererProfileHash: string;
  workProfileHash: string;
  contextProfileHash: string;
  metadataProfileHash: string;
  specId: string;
  specHash: string;
  specByteLength: number;
};

const sameHex = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

const isLoopbackRpc = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
};

export const isThoughtV2LocalMintRuntime = (facts: ThoughtV2LocalRuntimeFacts) => {
  const localHost = facts.hostname === "127.0.0.1" || facts.hostname === "localhost" || facts.hostname === "::1" || facts.hostname === "[::1]";
  const release = THOUGHT_V2_LOCAL_RELEASE;
  return facts.dev &&
    localHost &&
    isLoopbackRpc(facts.rpcUrl) &&
    isLoopbackRpc(facts.pathRpcUrl) &&
    facts.chainId === release.chainId &&
    release.eligibleForLocalMint &&
    release.artifact.productionConsumable === false &&
    sameHex(facts.contracts.pathNft, release.contracts.pathNft) &&
    sameHex(facts.contracts.thoughtNft, release.contracts.thoughtNft) &&
    sameHex(facts.contracts.thoughtSpecRegistry, release.contracts.thoughtSpecRegistry) &&
    sameHex(facts.contracts.thoughtRenderer, release.contracts.thoughtRenderer) &&
    sameHex(facts.contracts.protocolRegistry, release.contracts.protocolRegistry) &&
    sameHex(facts.contracts.creationAttestationVerifier, release.contracts.creationAttestationVerifier) &&
    sameHex(facts.protocolReleaseId, release.protocol.protocolReleaseId) &&
    sameHex(facts.manifestHash, release.protocol.manifestKeccak256) &&
    sameHex(facts.rendererProfileHash, release.protocol.rendererProfile.keccak256) &&
    sameHex(facts.workProfileHash, release.protocol.workProfile.keccak256) &&
    sameHex(facts.contextProfileHash, release.protocol.contextProfile.keccak256) &&
    sameHex(facts.metadataProfileHash, release.protocol.metadataProfile.keccak256) &&
    sameHex(facts.specId, release.spec.evmSpecId) &&
    sameHex(facts.specHash, release.spec.evmSpecHash) &&
    facts.specByteLength === release.spec.byteLength;
};

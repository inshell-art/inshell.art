export type ThoughtV2ArtifactBinding = {
  id: string;
  path: string;
  keccak256: `0x${string}`;
};

export type ThoughtV2ProtocolBinding = {
  protocolReleaseId: `0x${string}`;
  manifestKeccak256: `0x${string}`;
  creativeSpec: ThoughtV2ArtifactBinding;
  agentResultSchema: ThoughtV2ArtifactBinding;
  workProfile: ThoughtV2ArtifactBinding;
  rendererProfile: ThoughtV2ArtifactBinding;
};

export const THOUGHT_V2_LOCAL_RELEASE = {
  eligibleForLocalMint: true,
  source: {
    status: "dirty-local-snapshot",
    producerRepo: "THOUGHT",
    producerBaseCommit: "ec46cbf2f9ed5f7627c374bdf9963a38b5dad4c3",
    snapshotIdentity: "protocol-and-contract-anchors-below",
  },
  chainId: 31337,
  protocol: {
    protocolReleaseId: "0xea4493c669fc366e224e66a43233e1e97efecd18568ef494dfc31b4a3c961b65",
    manifestKeccak256: "0x305f59465c93edf46e5ab0ca372b017f6cba5c98052e695ae6b9ca5778515d4b",
    creativeSpec: {
      id: "inshell.thought.v2",
      path: "THOUGHT.v2.md",
      keccak256: "0xe56691af2ea250f66a09c6766ea90f5180af45f56d129b5cdce1ca42204d7f0a",
    },
    agentResultSchema: {
      id: "inshell.thought.agent-result.v2",
      path: "thought.agent-result.v2.schema.json",
      keccak256: "0x6091b7df2f41de70336f64b4520dacb98a8b7015267e2a51faac1876f36a01b2",
    },
    workProfile: {
      id: "inshell.thought.work.v2",
      path: "thought.work.v2.profile.json",
      keccak256: "0x8b590ab95432b0dd5002a4fb1419475751bdf0210a73338bf633533005d182bb",
    },
    rendererProfile: {
      id: "inshell.thought.svg.v2.binary-weave-32",
      path: "thought.renderer.v2.profile.json",
      keccak256: "0x6c124e260dcbfe801614b89da24bb31d407303e7cd93cc3e6a6ac372c862de88",
    },
  } satisfies ThoughtV2ProtocolBinding,
  spec: {
    name: "THOUGHT.v2.md",
    ref: "THOUGHT.v2.md",
    evmSpecId: "0x0a33583e39050834eb77372ea8b41ceded8fe4bb47c31fe1a72ebb880351b410",
    evmSpecHash: "0xe56691af2ea250f66a09c6766ea90f5180af45f56d129b5cdce1ca42204d7f0a",
    sha256: "7f4716703b3b1ace62f67be83d3754f3a82d5c6a75ad35a92d304253d3095932",
    byteLength: 2811,
  },
  contracts: {
    pathNft: "0x2e8880cAdC08E9B438c6052F5ce3869FBd6cE513",
    thoughtNft: "0xa779C1D17bC5230c07afdC51376CAC1cb3Dd5314",
    thoughtSpecRegistry: "0x4DAf17c8142A483B2E2348f56ae0F2cFDAe22ceE",
    thoughtRenderer: "0x618fB9dbd2BD6eb968B4c1af36af6CB0b45310Ec",
    protocolRegistry: "0x24d41dbc3d60d0784f8a937c59FBDe51440D5140",
  },
} as const;

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
  };
  protocolReleaseId: string;
  manifestHash: string;
  rendererProfileHash: string;
  workProfileHash: string;
  specId: string;
  specHash: string;
  specByteLength: number;
};

const sameHex = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

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
    sameHex(facts.contracts.pathNft, release.contracts.pathNft) &&
    sameHex(facts.contracts.thoughtNft, release.contracts.thoughtNft) &&
    sameHex(facts.contracts.thoughtSpecRegistry, release.contracts.thoughtSpecRegistry) &&
    sameHex(facts.contracts.thoughtRenderer, release.contracts.thoughtRenderer) &&
    sameHex(facts.contracts.protocolRegistry, release.contracts.protocolRegistry) &&
    sameHex(facts.protocolReleaseId, release.protocol.protocolReleaseId) &&
    sameHex(facts.manifestHash, release.protocol.manifestKeccak256) &&
    sameHex(facts.rendererProfileHash, release.protocol.rendererProfile.keccak256) &&
    sameHex(facts.workProfileHash, release.protocol.workProfile.keccak256) &&
    sameHex(facts.specId, release.spec.evmSpecId) &&
    sameHex(facts.specHash, release.spec.evmSpecHash) &&
    facts.specByteLength === release.spec.byteLength;
};

import { keccak256, toUtf8Bytes } from "ethers";

import {
  CREATION_ATTESTATION_TYPES,
  THOUGHT_CREATION_ATTESTATION_PROFILE_ID,
  assertCreationAttestationProof,
  type ThoughtCreationAttestationClaim,
  type ThoughtCreationAttestationProof,
} from "../contract-integration/current/reference/thought-v2-creation-attestation";
import {
  buildVerifiedCanonicalThoughtV2Provenance,
  verifyThoughtV2Provenance,
  type ThoughtV2ProcessEvidence,
  type ThoughtV2ProtocolBinding,
  type ThoughtV2SelectedSpecEvidence,
} from "../contract-integration/current/reference/thought-v2-terminal-provenance";

export { CREATION_ATTESTATION_TYPES };

export const EMPTY_THOUGHT_CREATION_ATTESTATION = Object.freeze({
  runIdHash: `0x${"00".repeat(32)}` as `0x${string}`,
  deadline: 0n,
  authorityEpoch: 0n,
  signature: "0x" as `0x${string}`,
}) satisfies ThoughtCreationAttestationProof;

export type ThoughtV2PathAuthorization = {
  pathId: bigint;
  deadline: bigint;
  pathSignature: `0x${string}`;
};

export type ThoughtV2AppMintFacts = {
  chainId: bigint;
  thoughtNft: `0x${string}`;
  intendedMinter: `0x${string}`;
  promptLine: string;
  agentLine: string;
  process: ThoughtV2ProcessEvidence;
  protocol: ThoughtV2ProtocolBinding;
  selectedSpec: ThoughtV2SelectedSpecEvidence;
  path: ThoughtV2PathAuthorization;
};

export type ThoughtV2MintInput = {
  promptLine: string;
  agentLine: string;
  declaredAgent: string;
  declaredModel: string;
  pathId: bigint;
  thoughtSpecId: `0x${string}`;
  thoughtSpecHash: `0x${string}`;
  provenanceJson: string;
  deadline: bigint;
  pathSignature: `0x${string}`;
  creationAttestation: ThoughtCreationAttestationProof;
};

export type ThoughtV2VerifiedMintFoundation = {
  claimFacts: Omit<ThoughtCreationAttestationClaim, "deadline" | "authorityEpoch">;
  mintInput: Omit<ThoughtV2MintInput, "creationAttestation">;
  provenanceHash: `0x${string}`;
};

export const buildThoughtV2VerifiedMintFoundation = (
  facts: ThoughtV2AppMintFacts,
): ThoughtV2VerifiedMintFoundation => {
  const built = buildVerifiedCanonicalThoughtV2Provenance({
    promptLine: facts.promptLine,
    agentLine: facts.agentLine,
    process: facts.process,
    mintContext: {
      chainId: facts.chainId.toString(),
      thoughtNft: facts.thoughtNft.toLowerCase() as `0x${string}`,
      intendedMinter: facts.intendedMinter.toLowerCase() as `0x${string}`,
    },
    protocol: facts.protocol,
    selectedSpec: facts.selectedSpec,
  });
  const declaredAgent = built.provenance.process.agentDeclaration.label;
  const declaredModel = built.provenance.process.modelDeclaration.label;
  const runIdHash = built.provenance.process.kind === "agent-run"
    ? built.provenance.process.transport.runIdHash
    : EMPTY_THOUGHT_CREATION_ATTESTATION.runIdHash;

  const mintInput = {
    promptLine: facts.promptLine,
    agentLine: facts.agentLine,
    declaredAgent,
    declaredModel,
    pathId: facts.path.pathId,
    thoughtSpecId: facts.protocol.thoughtSpecId,
    thoughtSpecHash: facts.protocol.thoughtSpecHash,
    provenanceJson: built.canonicalJson,
    deadline: facts.path.deadline,
    pathSignature: facts.path.pathSignature,
  };
  const claimFacts = {
    profileId: THOUGHT_CREATION_ATTESTATION_PROFILE_ID as `0x${string}`,
    thoughtNft: facts.thoughtNft,
    protocolReleaseId: facts.protocol.protocolReleaseId,
    thoughtSpecId: facts.protocol.thoughtSpecId,
    thoughtSpecHash: facts.protocol.thoughtSpecHash,
    workHash: built.provenance.work.workHash as `0x${string}`,
    provenanceHash: built.provenanceHash,
    declaredAgentHash: keccak256(toUtf8Bytes(declaredAgent)) as `0x${string}`,
    declaredModelHash: keccak256(toUtf8Bytes(declaredModel)) as `0x${string}`,
    runIdHash,
    intendedMinter: facts.intendedMinter,
  };
  return {
    claimFacts,
    mintInput,
    provenanceHash: built.provenanceHash,
  };
};

export const buildThoughtV2UnattestedMint = (
  facts: ThoughtV2AppMintFacts,
): ThoughtV2MintInput => {
  if (facts.process.kind !== "manual") {
    throw new Error("Unattested App mint builder requires Manual work provenance.");
  }
  const foundation = buildThoughtV2VerifiedMintFoundation(facts);
  return {
    ...foundation.mintInput,
    creationAttestation: EMPTY_THOUGHT_CREATION_ATTESTATION,
  };
};

export type ThoughtV2MockAttestationSigner = (
  claim: ThoughtCreationAttestationClaim,
) => Promise<`0x${string}`>;

export const buildThoughtV2MockOfficialMint = async (
  facts: ThoughtV2AppMintFacts,
  input: {
    authorityEpoch: bigint;
    attestationDeadline: bigint;
    sign: ThoughtV2MockAttestationSigner;
  },
): Promise<ThoughtV2MintInput> => {
  if (facts.process.kind !== "agent-run") {
    throw new Error("Official App attestation requires Agent-run provenance.");
  }
  const foundation = buildThoughtV2VerifiedMintFoundation(facts);
  const claim: ThoughtCreationAttestationClaim = {
    ...foundation.claimFacts,
    deadline: input.attestationDeadline,
    authorityEpoch: input.authorityEpoch,
  };
  const verification = verifyThoughtV2Provenance(
    toUtf8Bytes(foundation.mintInput.provenanceJson),
    {
      agentLine: facts.agentLine,
      attestationClaim: {
        chainId: facts.chainId.toString(),
        declaredAgentHash: claim.declaredAgentHash,
        declaredModelHash: claim.declaredModelHash,
        intendedMinter: claim.intendedMinter,
        protocolReleaseId: claim.protocolReleaseId,
        provenanceHash: claim.provenanceHash,
        runIdHash: claim.runIdHash,
        thoughtNft: claim.thoughtNft,
        thoughtSpecHash: claim.thoughtSpecHash,
        thoughtSpecId: claim.thoughtSpecId,
        workHash: claim.workHash,
      },
      chainId: facts.chainId.toString(),
      declaredAgent: foundation.mintInput.declaredAgent,
      declaredModel: foundation.mintInput.declaredModel,
      intendedMinter: facts.intendedMinter,
      manifestKeccak256: facts.protocol.manifestKeccak256,
      promptLine: facts.promptLine,
      protocolReleaseId: facts.protocol.protocolReleaseId,
      provenanceHash: foundation.provenanceHash,
      thoughtNft: facts.thoughtNft,
      thoughtSpecHash: facts.protocol.thoughtSpecHash,
      thoughtSpecId: facts.protocol.thoughtSpecId,
      workHash: claim.workHash,
    },
    facts.selectedSpec,
  );
  if (!verification.conforming) {
    throw new Error(
      `Mock App signer rejected provenance: ${verification.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const signature = await input.sign(claim);
  const creationAttestation: ThoughtCreationAttestationProof = {
    runIdHash: claim.runIdHash,
    deadline: claim.deadline,
    authorityEpoch: claim.authorityEpoch,
    signature,
  };
  assertCreationAttestationProof(creationAttestation);
  return {
    ...foundation.mintInput,
    creationAttestation,
  };
};

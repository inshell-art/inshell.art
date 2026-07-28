import {
  TypedDataEncoder,
  getAddress,
  id,
  type TypedDataDomain,
  type TypedDataField,
} from "ethers";

export const THOUGHT_CREATION_ATTESTATION_PROFILE =
  "inshell.thought.creation-workflow-attestation.v1" as const;
export const THOUGHT_CREATION_ATTESTATION_PROFILE_ID = id(
  THOUGHT_CREATION_ATTESTATION_PROFILE,
) as `0x${string}`;

export const CREATION_ATTESTATION_DOMAIN_NAME =
  "Inshell THOUGHT Creation Attestation" as const;
export const CREATION_ATTESTATION_DOMAIN_VERSION = "1" as const;
export const CREATION_ATTESTATION_PRIMARY_TYPE = "CreationAttestation" as const;
export const CREATION_ATTESTATION_TYPE_STRING =
  "CreationAttestation(bytes32 profileId,address thoughtNft,bytes32 protocolReleaseId,bytes32 thoughtSpecId,bytes32 thoughtSpecHash,bytes32 workHash,bytes32 provenanceHash,bytes32 declaredAgentHash,bytes32 declaredModelHash,bytes32 runIdHash,address intendedMinter,uint64 deadline,uint32 authorityEpoch)" as const;
export const CREATION_ATTESTATION_TYPEHASH = id(CREATION_ATTESTATION_TYPE_STRING);

export const CREATION_ATTESTATION_TYPES = {
  CreationAttestation: [
    { name: "profileId", type: "bytes32" },
    { name: "thoughtNft", type: "address" },
    { name: "protocolReleaseId", type: "bytes32" },
    { name: "thoughtSpecId", type: "bytes32" },
    { name: "thoughtSpecHash", type: "bytes32" },
    { name: "workHash", type: "bytes32" },
    { name: "provenanceHash", type: "bytes32" },
    { name: "declaredAgentHash", type: "bytes32" },
    { name: "declaredModelHash", type: "bytes32" },
    { name: "runIdHash", type: "bytes32" },
    { name: "intendedMinter", type: "address" },
    { name: "deadline", type: "uint64" },
    { name: "authorityEpoch", type: "uint32" },
  ],
} satisfies Record<string, TypedDataField[]>;

export type ThoughtCreationAttestationClaim = {
  profileId: `0x${string}`;
  thoughtNft: `0x${string}`;
  protocolReleaseId: `0x${string}`;
  thoughtSpecId: `0x${string}`;
  thoughtSpecHash: `0x${string}`;
  workHash: `0x${string}`;
  provenanceHash: `0x${string}`;
  declaredAgentHash: `0x${string}`;
  declaredModelHash: `0x${string}`;
  runIdHash: `0x${string}`;
  intendedMinter: `0x${string}`;
  deadline: bigint;
  authorityEpoch: bigint;
};

export type ThoughtCreationAttestationProof = {
  runIdHash: `0x${string}`;
  deadline: bigint;
  authorityEpoch: bigint;
  signature: `0x${string}`;
};

const bytes32Pattern = /^0x[0-9a-f]{64}$/;
const uint64Max = (1n << 64n) - 1n;
const uint32Max = (1n << 32n) - 1n;
const zeroBytes32 = `0x${"00".repeat(32)}` as const;

export const creationAttestationDomain = (
  chainId: bigint,
  verifier: `0x${string}`,
): TypedDataDomain => ({
  name: CREATION_ATTESTATION_DOMAIN_NAME,
  version: CREATION_ATTESTATION_DOMAIN_VERSION,
  chainId,
  verifyingContract: getAddress(verifier),
});

export const assertCreationAttestationClaim = (
  claim: ThoughtCreationAttestationClaim,
): void => {
  for (const [label, value] of [
    ["profileId", claim.profileId],
    ["protocolReleaseId", claim.protocolReleaseId],
    ["thoughtSpecId", claim.thoughtSpecId],
    ["thoughtSpecHash", claim.thoughtSpecHash],
    ["workHash", claim.workHash],
    ["provenanceHash", claim.provenanceHash],
    ["declaredAgentHash", claim.declaredAgentHash],
    ["declaredModelHash", claim.declaredModelHash],
    ["runIdHash", claim.runIdHash],
  ] as const) {
    if (!bytes32Pattern.test(value)) throw new Error(`${label} must be lowercase bytes32`);
  }
  if (claim.profileId !== THOUGHT_CREATION_ATTESTATION_PROFILE_ID) {
    throw new Error(`profileId must identify ${THOUGHT_CREATION_ATTESTATION_PROFILE}`);
  }
  if (claim.runIdHash === zeroBytes32) throw new Error("runIdHash must be nonzero");
  getAddress(claim.thoughtNft);
  getAddress(claim.intendedMinter);
  if (claim.deadline < 0n || claim.deadline > uint64Max) throw new Error("deadline exceeds uint64");
  if (claim.authorityEpoch < 1n || claim.authorityEpoch > uint32Max) {
    throw new Error("authorityEpoch must be a nonzero uint32");
  }
};

export const hashCreationAttestationStruct = (
  claim: ThoughtCreationAttestationClaim,
): `0x${string}` => {
  assertCreationAttestationClaim(claim);
  return TypedDataEncoder.from(CREATION_ATTESTATION_TYPES).hashStruct(
    CREATION_ATTESTATION_PRIMARY_TYPE,
    claim,
  ) as `0x${string}`;
};

export const hashCreationAttestationClaim = (
  chainId: bigint,
  verifier: `0x${string}`,
  claim: ThoughtCreationAttestationClaim,
): `0x${string}` => {
  assertCreationAttestationClaim(claim);
  return TypedDataEncoder.hash(
    creationAttestationDomain(chainId, verifier),
    CREATION_ATTESTATION_TYPES,
    claim,
  ) as `0x${string}`;
};

export const isEmptyCreationAttestationProof = (
  proof: ThoughtCreationAttestationProof,
): boolean => proof.runIdHash === zeroBytes32 && proof.deadline === 0n &&
  proof.authorityEpoch === 0n && proof.signature === "0x";

export const assertCreationAttestationProof = (
  proof: ThoughtCreationAttestationProof,
): void => {
  if (isEmptyCreationAttestationProof(proof)) return;
  if (proof.runIdHash === zeroBytes32 || proof.deadline === 0n || proof.authorityEpoch === 0n) {
    throw new Error("creation attestation proof is partially empty");
  }
  if (!/^0x[0-9a-f]{130}$/.test(proof.signature)) {
    throw new Error("creation attestation signature must be canonical 65-byte hex");
  }
};

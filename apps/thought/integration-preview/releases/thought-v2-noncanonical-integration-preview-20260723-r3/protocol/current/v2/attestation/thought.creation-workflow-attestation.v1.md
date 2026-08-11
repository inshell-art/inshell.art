# THOUGHT Creation Workflow Attestation v1

## Identity

- Profile name: `inshell.thought.creation-workflow-attestation.v1`
- Profile ID: `keccak256(UTF8(profile name))` =
  `0x0dc216b0e8f18cabaa4afee047e80f349ed3c2de67ace911157300279f74c669`
- Signature scheme: EIP-712 with one canonical 65-byte low-s ECDSA
  signature
- ERC-1271 support: deferred

## EIP-712 domain

- `name`: `Inshell THOUGHT Creation Attestation`
- `version`: `1`
- `chainId`: the current EVM chain ID
- `verifyingContract`: the immutable `CreationAttestationVerifier` used by
  `ThoughtNFTV2`

## Claim

The primary type name is `CreationAttestation`. Its fields, order, and Solidity
types are exactly:

```text
bytes32 profileId
address thoughtNft
bytes32 protocolReleaseId
bytes32 thoughtSpecId
bytes32 thoughtSpecHash
bytes32 workHash
bytes32 provenanceHash
bytes32 declaredAgentHash
bytes32 declaredModelHash
bytes32 runIdHash
address intendedMinter
uint64 deadline
uint32 authorityEpoch
```

The exact type string is:

```text
CreationAttestation(bytes32 profileId,address thoughtNft,bytes32 protocolReleaseId,bytes32 thoughtSpecId,bytes32 thoughtSpecHash,bytes32 workHash,bytes32 provenanceHash,bytes32 declaredAgentHash,bytes32 declaredModelHash,bytes32 runIdHash,address intendedMinter,uint64 deadline,uint32 authorityEpoch)
```

`thoughtSpecId` and `thoughtSpecHash` are the exact registered pair from the
mint input. `workHash` is derived by the current V2 ordered-conversation work
profile. `provenanceHash` is Keccak-256 of the exact stored provenance bytes.
`declaredAgentHash` and `declaredModelHash` are Keccak-256 of the exact UTF-8
typed declaration labels. `runIdHash` is a nonzero public-safe commitment;
raw run identifiers are not stored by the contracts. `intendedMinter` is the
caller of `ThoughtNFTV2.mint`.

The contract constructs `profileId`, `thoughtNft`, `protocolReleaseId`, both
selected-spec fields, all work/provenance/declaration hashes, and
`intendedMinter`; those values are not duplicate trusted proof inputs. PATH
authorization and id, PATH deadline, token and transaction facts,
provenance-conformance status, provider claims, and signature bytes are not
claim fields. The signature is never inserted into the provenance bytes it
commits to.

## Meaning and limits

A valid signature maps to metadata status `Inshell THOUGHT App`: an authorized
Inshell signer bound the exact claim fields under this profile. It does not
prove that a named Agent or model executed, that one inference occurred, or
that the declarations are objectively true. The resulting nonzero digest
gates publication of the exact declaration labels as `Attested Agent` and
`Attested Model` marketplace traits, but the underlying declarations remain
`declared-unverified`. Provenance remains opaque exact bytes to Solidity.

The sole unattested proof encoding is an all-zero `runIdHash`, deadline, and
authority epoch with empty signature bytes. It skips verifier execution,
stores digest zero, maps to `Unattested`, and omits Agent/Model marketplace
traits. The typed declarations and their canonical provenance records remain
present. Partially populated proofs are invalid.

## Verification and replay

The verifier accepts only its profile ID, current nonzero authority and epoch,
nonzero run ID hash, inclusive deadline, calling `ThoughtNFTV2`, and a
canonical valid signature. Authority rotation increments the epoch exactly
once. Pause blocks only future attested mints. The verifier is read-only and
records no nonce or proof use.

Before mint success, the intended minter may retry the same proof before its
deadline. After success, ordered prompt-plus-Agent pair uniqueness prevents a
second token for that conversation. A different caller, collection, chain,
release, selected specification, work, provenance, declaration, run
commitment, deadline, or epoch does not validate. Failed verification consumes
no PATH unit and reserves no conversation or work hash. Rotation and pause do
not alter historical token metadata.

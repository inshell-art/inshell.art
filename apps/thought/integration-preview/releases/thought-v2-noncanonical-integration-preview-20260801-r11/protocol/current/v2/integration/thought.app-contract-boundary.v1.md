# THOUGHT App / Contract boundary v1 — contract-owner draft

Status: contract-owner draft for joint review
Authority: non-authoritative
Production authorization: none
Implementation baseline: the current registry-bound V2 candidate

This document turns the 2026-07-23 architecture discussion into a reviewable
boundary. It does not approve the proposed registry-removal refactor, change
creative-spec ownership, authorize an App rollout, or authorize a deployment.
The adjacent JSON file is the machine-checkable form of this draft.

## The boundary in one sentence

The THOUGHT App assembles the mint request and, for the official path, obtains
an exact Creation Attestation; the THOUGHT Contract independently enforces its
hard rules, verifies the proof, consumes PATH atomically, stores exact state,
and produces token metadata and artwork.

The verifier is a cryptographic bridge, not a general oracle. It proves that
the configured authority signed the exact EIP-712 claim. It does not discover
offchain facts, inspect an Agent provider, or prove semantic compliance with a
creative specification.

## Current executable boundary

This section describes the code that exists now. It is the only baseline the
Anvil conformance gate accepts.

### Contract construction

`ThoughtNFTV2` permanently binds:

- `pathNft`;
- `thoughtSpecRegistry`;
- `thoughtRenderer`;
- `protocolRegistry`;
- one already-registered `protocolReleaseId`;
- `creationAttestationVerifier`.

The renderer and verifier must report the exact metadata, renderer, and
attestation profile identities expected by the NFT. The protocol release must
already exist. These registry dependencies remain active.

### App or manual caller to `mint`

The caller supplies:

- exact `promptLine` and `agentLine`;
- exact `agent` and `model`;
- PATH ID, deadline, and owner authorization;
- exact registered `thoughtSpecId` and `thoughtSpecHash`;
- nonempty exact `provenanceJson`;
- either the canonical empty Creation Attestation proof or a complete signed
  proof.

The current contract validates the Terminal English lines, neutral Agent and Model records,
provenance byte envelope, selected registered spec pair, uniqueness, proof,
and PATH authorization. It stores `provenanceJson` as opaque exact bytes and
derives `keccak256(bytes(provenanceJson))`. Solidity does not parse or certify
the provenance schema.

The official App path is expected to use the shared canonical provenance
builder and verifier before submission. That expectation is an offchain
integration rule; malformed opaque provenance remains possible through direct
Unattested calldata unless another caller policy prevents it.

### Creation Attestation

The current EIP-712 claim binds, in exact order:

1. `profileId`;
2. `thoughtNft`;
3. `protocolReleaseId`;
4. `thoughtSpecId`;
5. `thoughtSpecHash`;
6. `workHash`;
7. `provenanceHash`;
8. `agentHash`;
9. `modelHash`;
10. `runIdHash`;
11. `intendedMinter`;
12. `deadline`;
13. `authorityEpoch`.

An all-zero proof with empty signature is the sole Unattested encoding. A
complete proof must verify through the immutable verifier. The contract
constructs the authoritative claim values from calldata, derived hashes,
immutable state, and `msg.sender`; it does not trust a caller-supplied claim
digest.

A valid proof means:

> The configured Inshell THOUGHT App authority signed this exact claim.

It does not independently prove provider identity or model identity. Agent and
Model are neutral records; the proof only distinguishes the official signed
workflow from an Unattested mint.

### Traits

All tokens expose exactly `Agent`, `Model`, `Creation Attestation`, `Prompt
Bytes`, and `Agent Bytes` in that order. The two byte traits are numeric with
`max_value: 64`. `Pair Bytes`, `Prompt Length`, and `Agent Length` are excluded
as redundant derived traits. Attestation does not gate Agent/Model trait
publication. It changes only the `Creation Attestation` value and digest.

### Contract to readers

The contract exposes:

- typed token state and derived work hashes;
- exact provenance bytes and their hash;
- Creation Attestation digest;
- embedded ERC-721 metadata and SVG;
- exactly one top-level `external_url` as
  `https://inshell.art/thought/<tokenId>`, rendered from the unsigned
  base-10 token ID without leading zeroes;
- selected-spec readback through the spec registry;
- protocol-manifest hash and URI through the protocol registry.

A gallery may parse provenance for presentation, but parsed provenance never
overrides typed contract state or changes the token's attestation status.
The App may link to `external_url`, but it must not synthesize or overwrite the
field as if it were returned by the Contract. The URL is presentation metadata
and is not a work-identity or attestation input.

## Proposed ownership for joint approval

The THOUGHT App owner would own the Creative Work Specification, official
workflow, canonical provenance schema/builder, claim reconstruction/signing
policy, and product mint orchestration.

The THOUGHT Contract owner would own hard validation, identity and uniqueness,
the verifier, PATH consumption and atomicity, typed state, metadata, renderer,
ABI/bytecode, deployment evidence, and contract conformance.

The shared integration surface would be deliberately narrow:

- mint ABI;
- Creation Attestation EIP-712 profile and vectors;
- immutable Contract release lock;
- App integration lock pinning one deployed Contract release;
- cross-repository conformance fixtures.

This allocation conflicts with
`docs/agent/THOUGHT_ARTIFACT_CONSUMPTION_BOOK.md`, which currently assigns
creative-spec and provenance-schema ownership to THOUGHT. Neither document is
silently rewritten here. Joint approval must resolve the conflict first.

## Proposed target that is not authorized

The discussion proposed removing the Creative Spec Registry, selected-spec
fields, protocol registry, and protocol release ID from the active mint path,
with App-owned creative/release facts bound transitively through exact
provenance.

That target is not implemented, not approved, and not the conformance
baseline. No replacement registry is approved either.

## Four integration locks

1. The Contract release lock identifies reviewed ABI, bytecode, verifier,
   renderer, profiles, vectors, addresses, chain, and deployment evidence.
2. The App release lock identifies the App-owned creative specification,
   workflow, provenance implementation, and signer policy.
3. The App integration lock pins one immutable Contract release and its
   verifier/authority expectations.
4. A mint binds one work and provenance payload to one intended minter through
   the signed claim and then records the resulting onchain state.

The first three are release/integration artifacts. The fourth is per-token
evidence. They must not be collapsed into one vague “protocol version”.

## Joint decisions still open

Before a contract refactor or production App integration:

1. Freeze the final Creation Attestation EIP-712 type and profile name.
2. Freeze manual-work UI vocabulary.
3. Freeze the guided Unattested provenance minimum.
4. Decide whether the App exposes raw provenance.
5. Freeze signer authority, rotation, pause, custody, and epoch policy.
6. Accept or change the current uniqueness rule and Unattested ordering race.
7. Decide the historical/publication treatment of existing registry and
   verifier artifacts.
8. Freeze cross-repository handoff and immutable integration-lock formats.

## Review rule

The `inshell.art` owner should answer each open decision with `accept`,
`amend`, or `defer`, and identify any ownership mismatch. Only an approved
replacement document may authorize ABI changes. Until then:

- contract tests and App integration use the current registry-bound ABI;
- registries and selected-spec fields remain required;
- no production authority key is introduced;
- no candidate/stable publication or production deployment is implied.

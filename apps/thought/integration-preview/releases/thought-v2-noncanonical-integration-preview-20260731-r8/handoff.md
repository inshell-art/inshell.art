# THOUGHT V2 neutral Agent/Model integration-preview handoff

Date: 2026-07-31
Owner: THOUGHT contract repository
Consumer: `inshell.art` / THOUGHT App owner
Classification: noncanonical integration preview
Production/registration authorization: none

## Integration pin

Pin the immutable artifact ID
`thought-v2-noncanonical-integration-preview-20260731-r8` and verify its
`manifest.json` SHA-256 against
`artifacts/thought-v2-integration-preview/experimental.json`, then verify every
entry in `SHA256SUMS.txt`. Do not consume
`latest`, infer stability, register this preview, or deploy it to a persistent
network.

The package manifest records its exact implementation base commit and source
branch. The publication tag is
`thought-v2-noncanonical-integration-preview-20260731-r8`.

## Breaking ABI delta

The current V2 contract boundary now treats Agent and Model as neutral typed
records. There are no compatibility aliases.

| Previous preview | r8 preview |
| --- | --- |
| `MintThoughtInput.declaredAgent` | `MintThoughtInput.agent` |
| `MintThoughtInput.declaredModel` | `MintThoughtInput.model` |
| `declaredAgentOf(tokenId)` | `agentOf(tokenId)` |
| `declaredModelOf(tokenId)` | `modelOf(tokenId)` |
| `declaredAgentHashOf(tokenId)` | `agentHashOf(tokenId)` |
| `declaredModelHashOf(tokenId)` | `modelHashOf(tokenId)` |
| `MAX_DECLARED_AGENT_BYTES` | `MAX_AGENT_RECORD_BYTES` |
| `MAX_DECLARED_MODEL_BYTES` | `MAX_MODEL_RECORD_BYTES` |
| `validateDeclarations(...)` | `validateRecords(...)` |

The accepted byte profile remains
`inshell.thought.context.v2.visible-utf8-64`: exact 1–64 UTF-8 bytes, no outer
U+0020, no normalization or repair, and the existing control/invisible
rejections. Agent/Model remain excluded from conversation identity, work hash,
uniqueness, and SVG artwork.

## Creation Attestation delta

Use `CreationAttestationVerifierV2` and
`ICreationAttestationVerifierV2`. Do not deploy or call the archived
`CreationAttestationVerifier` for this preview.

- Profile: `inshell.thought.creation-workflow-attestation.v2`
- EIP-712 domain name: `Inshell THOUGHT Creation Attestation`
- Domain version: `2`
- Primary type: `CreationAttestation`
- Exact renamed claim fields: `agentHash`, `modelHash`
- Exact type string and deterministic vectors:
  `protocol/current/v2/attestation/fixtures/creation-attestation-v2-vectors.json`

The App must hash the exact UTF-8 bytes supplied as `agent` and `model`, then
place those hashes in the claim. Signatures made for the v1 profile/domain/type
are invalid. Preserve the existing empty proof encoding for Unattested mints.

Creation Attestation is not a general oracle. A valid proof means the configured
authority signed the exact claim, including the two record hashes and
provenance hash. It does not independently prove provider or model identity.

## Metadata delta

Both attested and Unattested tokens always expose this exact leading trait
order:

1. `Agent`
2. `Model`
3. `Creation Attestation`

The remaining byte and length traits follow unchanged. Do not gate Agent/Model
traits on attestation status and do not emit `Declared Agent`, `Declared Model`,
`Attested Agent`, or `Attested Model`.

Technical properties are now `agent`, `agentKeccak256`, `model`, and
`modelKeccak256`. The nested metadata object is:

```json
"records": {
  "agent": { "keccak256": "0x...", "label": "..." },
  "model": { "keccak256": "0x...", "label": "..." },
  "workIdentityInput": false
}
```

Do not expect declaration assurance/status fields in contract metadata. The
exact description is:

> THOUGHT V2 preserves a narrow terminal channel between human intention and Agent response, transforming their dialogue into an on-chain artwork.

## Provenance boundary

The App-owned `inshell.thought.provenance.v2` wire schema is intentionally not
renamed by this contract release. Its existing `agentDeclaration` and
`modelDeclaration` objects may remain. Map their exact `label` values to the
neutral `agent` and `model` mint arguments.

Solidity still stores `provenanceJson` as bounded opaque exact bytes and derives
its Keccak-256 hash. It does not parse JSON. The App remains responsible for
canonical construction, JCS serialization, schema verification, typed-state
parity, and selected-spec parity before minting.

## Consumer rollout

1. Verify the r8 manifest SHA-256 and every `SHA256SUMS.txt` entry.
2. Generate bindings from the packaged `ThoughtNFTV2`,
   `ICreationAttestationVerifierV2`, and `CreationAttestationVerifierV2`
   artifacts.
3. Replace old mint/getter/constants usage with the neutral ABI names.
4. Reconstruct and sign only the v2 EIP-712 claim.
5. Render Agent/Model traits for every token; use Creation Attestation as a
   separate status.
6. Keep provenance field parsing behind the App-owned schema and never use it
to override typed contract state.
7. Check the packaged
   `fixtures/neutral-agent-model-token-uri-examples.anvil.json`; it contains
   exact contract outputs for one App-attested and one Unattested token.
8. Deploy only to disposable Anvil, configure PATH `THOUGHT` movement quota,
   freeze that movement configuration, mint both Unattested and mock-attested
   fixtures, then verify metadata and attestation parity.

Contract-repo disposable validation command:

```sh
npm run devnode:v2:start
npm run devnode:v2:gallery
npm run conformance:v2:app-contract
```

The node and gallery commands run in separate terminals. This preview carries
no Sepolia/mainnet addresses, signer custody policy, production key material,
registry authorization, or production deployment approval.

# THOUGHT Metadata Namespace V2

Status: unpublished packaged local release candidate

Owner: THOUGHT Contract for emitted token metadata; THOUGHT App for the opaque
provenance document carried by `thought.provenanceJson`

Namespace: top-level `thought`

Metadata profile: `inshell.thought.metadata.v2.terminal-chat`

## Purpose

The conventional ERC-721 metadata surface remains familiar to marketplaces:

- `name`;
- `description`;
- `image`;
- `external_url`;
- `background_color`;
- `attributes`.

The top-level `thought` object is the structured THOUGHT V2 extension. It lets
wallets, indexers, galleries, and independent verifiers inspect exact work,
protocol, provenance, attestation, renderer, and mint facts without scraping
marketplace traits or parsing display copy.

`external_url` is deliberately outside this namespace because it is a
conventional ERC-721 metadata field. `properties` is a flat compatibility
mirror. New integrations should prefer the structured `thought` object.

The accompanying JSON Schema validates the exact `metadata.thought` object,
not the complete ERC-721 metadata object. Conventional top-level metadata is
validated separately against the selected metadata profile.

## Assurance boundary

The THOUGHT Contract is authoritative for stored typed token facts and for the
exact `tokenURI()` bytes it emits. The Contract verifies a Creation Attestation
over exact hashes when one is supplied. It does not independently prove Agent
identity or model identity.

The neutral `thought.records.agent` and `thought.records.model` objects are
creation records:

- `agent` is the Agent product selected for the run, or the caller-supplied
  record for a manual mint;
- `model` is the model record reported by the Agent runtime, or the
  caller-supplied record for a manual mint;
- `workIdentityInput` is `false`; neither record changes the creative work's
  uniqueness identity.

Assurance appears only in `thought.creationAttestation`. Do not interpret an
Agent or Model label as separately attested, provider-verified, or canonical.

## Encoding conventions

- hashes are lowercase `0x`-prefixed 32-byte hex strings;
- EVM addresses are lowercase `0x`-prefixed 20-byte hex strings;
- unbounded EVM integers are decimal strings to avoid JSON number precision
  loss;
- booleans are JSON booleans;
- text is exact UTF-8;
- absent optional information must not be invented from UI configuration;
- the immutable V2 schema is closed for conformance, so strict verification
  rejects unknown fields;
- tolerant display clients may ignore unknown fields from a newer published
  namespace artifact, but must not claim that newer object conforms to this
  exact V2 artifact.

## Work and identity fields

| Path | Meaning |
| --- | --- |
| `thought.promptLine` | Exact stored human prompt line. |
| `thought.agentLine` | Exact stored Agent response line. |
| `thought.promptLineKeccak256` | Keccak-256 of exact prompt UTF-8 bytes. |
| `thought.agentLineKeccak256` | Keccak-256 of exact Agent-line UTF-8 bytes. |
| `thought.conversationIdentityHash` | Ordered prompt + Agent response identity commitment. |
| `thought.workHash` | Canonical work hash stored by the Contract. |
| `thought.workHashPrecheck` | Renderer recomputation used to expose parity with stored work state. |
| `thought.workProfileId` | Text/work profile used for the two lines. |

## Agent and Model records

| Path | Meaning |
| --- | --- |
| `thought.records.agent.label` | Exact stored Agent record. |
| `thought.records.agent.keccak256` | Hash of the exact Agent record bytes. |
| `thought.records.model.label` | Exact stored Model record. |
| `thought.records.model.keccak256` | Hash of the exact Model record bytes. |
| `thought.records.workIdentityInput` | Always `false` in this V2 profile. |

These records are neutral. Their acquisition detail belongs in the App-owned
provenance document, not in Contract-invented assurance labels.

## Provenance fields

| Path | Meaning |
| --- | --- |
| `thought.provenanceProfileId` | Root schema identifier, currently `inshell.thought.provenance.v2`. |
| `thought.provenanceJson` | Exact App-owned canonical JSON bytes stored as a JSON string. |
| `thought.provenanceHash` | Contract-stored Keccak-256 of exact provenance bytes. |
| `thought.provenanceCommitmentCheck` | Renderer recomputation; must equal `provenanceHash`. |

`provenanceJson` is opaque to Solidity. Consumers parse it only according to
the identified App-owned provenance schema. The Contract guarantees the exact
bytes and commitment relationship, not the truth of every off-chain statement
inside the document.

## Creation Attestation fields

| Path | Meaning |
| --- | --- |
| `thought.creationAttestation.status` | `Inshell THOUGHT App` or `Unattested`. |
| `thought.creationAttestation.digest` | Exact attestation digest; zero for the canonical unattested path. |
| `thought.creationAttestation.profileId` | Creation Attestation claim/profile identifier. |
| `thought.creationAttestation.verifier` | Verifier contract address used by the THOUGHT Contract. |

For `Inshell THOUGHT App`, the configured App authority signed the exact bound
creation claim and the Contract verified it. `Unattested` preserves the
permissionless manual-mint path and makes no App assurance claim.

## Protocol fields

| Path | Meaning |
| --- | --- |
| `thought.protocol.protocolReleaseId` | Registered protocol release identifier. |
| `thought.protocol.manifestKeccak256` | Exact registered manifest commitment. |
| `thought.protocol.releaseStatus` | Contract-readable release status at render time. |
| `thought.protocol.thoughtSpecId` | Selected Creative Work Specification identifier. |
| `thought.protocol.thoughtSpecHash` | Exact selected specification-byte commitment. |

## Renderer and metadata fields

| Path | Meaning |
| --- | --- |
| `thought.rendererId` | Canonical renderer family identifier. |
| `thought.rendererIdHash` | Hash of `rendererId`. |
| `thought.rendererImplementationId` | Packaged renderer implementation identifier. |
| `thought.rendererReleaseReady` | Whether the registered renderer passed its release gate. |
| `thought.metadataProfileId` | Metadata profile identifier. |
| `thought.metadataProfileIdHash` | Hash of `metadataProfileId`. |
| `thought.status` | Token/render state, normally `minted`. |

## Mint fields

| Path | Meaning |
| --- | --- |
| `thought.mint.chainId` | Decimal chain ID string. |
| `thought.mint.contract` | THOUGHT collection address. |
| `thought.mint.tokenId` | Decimal THOUGHT token ID string. |
| `thought.mint.minter` | Mint transaction's minter/caller record. |
| `thought.mint.mintedAt` | Decimal block timestamp string. |
| `thought.mint.pathId` | Decimal `$PATH` token ID consumed for authorization. |
| `thought.mint.pathSerial` | Decimal movement serial returned by canonical `$PATH`, widened without alteration for THOUGHT storage. |
| `thought.mint.status` | Mint lifecycle status represented by the rendered metadata. |

## Schema scope and relational checks

`thought.metadata-namespace.v2.schema.json` validates field presence, JSON
types, closed object shapes, canonical lowercase hash/address encodings,
decimal-string integer encodings, Terminal English lines, neutral record
labels, and Creation Attestation status/digest shape.

JSON Schema alone does not recompute hashes or query chain state. A chain-first
verifier must additionally perform the relational checks listed in the
schema's `x-thought-relational-checks`, including hash parity, typed getter
parity, and selected chain/collection/token identity.

## Consumer verification order

An independent consumer should:

1. fetch `tokenURI(tokenId)` from the selected chain and collection;
2. decode the exact metadata object;
3. verify conventional top-level fields, including `external_url`;
4. compare `thought.mint.chainId`, `contract`, and `tokenId` with the query;
5. compare structured namespace facts with typed Contract getters;
6. verify work and provenance hashes;
7. parse `thought.provenanceJson` using its identified provenance schema;
8. verify Creation Attestation status and digest through Contract state;
9. treat Agent and Model as neutral creation records, not independent identity
   certificates.

The repository verifier implements the chain-first version of this process.
See `docs/THOUGHT_PROVENANCE_VERIFIER.md`.

## Versioning and publication

This packaged local release candidate documents the V2 namespace before
canonical publication. The namespace remains V2 to align with THOUGHT V2;
corrections before publication create a new immutable artifact release, not a
misleading V3 namespace.

After the Contract publishes a release that includes canonical `external_url`
and matching fixtures, the App owner may mark this document published and
serve the immutable release from the canonical `inshell.art` origin.

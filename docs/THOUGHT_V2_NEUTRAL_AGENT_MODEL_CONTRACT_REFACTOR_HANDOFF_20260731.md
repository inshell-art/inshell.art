# THOUGHT V2 Contract Handoff — Neutral Agent and Model Records

Date: 2026-07-31

From: Inshell THOUGHT App owner

To: THOUGHT Contract owner

Status: decisioned App boundary; Contract refactor requested

Target: the next explicitly noncanonical integration-preview release after the
currently imported V2 release

## Executive decision

Refactor the THOUGHT Contract so `Agent` and `Model` are neutral creation
records, not claims that the Agent or model itself was attested.

Only the **Inshell THOUGHT App Creation Attestation** is attested. The Contract
verifies that App-issued attestation and binds it to the exact creation record.
The Contract does not independently prove Agent identity, model identity, or a
provider statement.

The current Contract wording is too strong and semantically inaccurate:

- `Attested Agent`;
- `Attested Model`;
- `declaredAgent`;
- `declaredModel`;
- declaration objects whose status is always `declared-unverified`.

V2 is still noncanonical. Prefer one clean breaking refactor now over carrying
these names into the canonical release.

## Product semantics

For an Inshell THOUGHT App-attested Agent run:

- **Agent** is the Agent product selected in the App to receive the prompt.
- **Model** is the model plus reasoning effort reported by the Agent runtime
  for the returned run.
- **Creation Attestation** means the configured Inshell THOUGHT App authority
  signed the exact bound creation claim and the Contract verified it.

The Creation Attestation binds the exact Agent and Model record hashes. It does
not convert either record into an independently verified identity claim.

For a permissionless manual mint:

- Agent and Model are exact caller-supplied records;
- the canonical empty proof produces `Creation Attestation: Unattested`;
- the Contract still validates and stores the records;
- no Inshell THOUGHT App guarantee is implied.

The App-owned acquisition policy is documented at:

`/Users/bigu/Projects/inshell.art/apps/thought/spec/CREATION_PROVENANCE.md`

## Current Contract state to replace

The current implementation carries declaration semantics through:

- `MintThoughtInput.declaredAgent` and `declaredModel`;
- `ThoughtRecord.declaredAgent` and `declaredModel`;
- `declaredAgentOf`, `declaredModelOf`, and hash getters;
- `declaredAgentHash` and `declaredModelHash` in Creation Attestation EIP-712;
- renderer input fields;
- `properties.declaredAgent` and `properties.declaredModel`;
- `thought.declarations.*` with `status: declared-unverified`;
- marketplace traits `Attested Agent` and `Attested Model`.

Relevant current sources include:

- `evm/src/v2/ThoughtNFTV2.sol`;
- `evm/src/v2/IThoughtRendererV2.sol`;
- `evm/src/v2/ThoughtRendererV2.sol`;
- `evm/src/v2/ThoughtRendererV2Split.sol`;
- the Creation Attestation verifier, claim type, vectors, and profile;
- metadata, context, provenance-boundary, ABI, and release artifacts.

## Required Contract refactor

### 1. Typed mint and storage records

Use neutral typed names:

```solidity
string agent;
string model;
```

Apply them consistently to mint input, token storage, renderer input, local
derived values, validation names, and getters.

Preferred public getters:

```solidity
agentOf(uint256 tokenId)
modelOf(uint256 tokenId)
agentHashOf(uint256 tokenId)
modelHashOf(uint256 tokenId)
```

Use neutral limit names such as `MAX_AGENT_RECORD_BYTES` and
`MAX_MODEL_RECORD_BYTES`; avoid confusion with the creative `agentLine`.

Keep the existing exact-byte constraints unless the Contract owner identifies
a separate reviewed reason to change them. Agent and Model remain context
records and do not affect conversation identity, work identity, uniqueness, or
SVG composition.

Do not retain the old public names as canonical aliases merely for preview
compatibility. Legacy deployed tokens remain readable through their old ABI;
the next preview deployment may use its corrected ABI.

### 2. Creation Attestation claim

Replace:

```text
declaredAgentHash
declaredModelHash
```

with:

```text
agentHash
modelHash
```

The claim must still bind the exact UTF-8 hashes of the typed Agent and Model
records supplied to mint.

This changes the EIP-712 type hash. Publish a new Creation Attestation profile
ID/version, updated verifier artifacts, and fresh positive/negative vectors.
Old signatures must not validate under the new profile.

The semantic statement verified by the Contract is:

> The configured Inshell THOUGHT App authority signed this exact creation
> claim, including the exact Agent and Model record hashes.

It is not:

> The Agent or model provider attested these identities.

### 3. ERC-721 attributes (marketplace traits)

`attributes` is the ERC-721 metadata array; marketplaces commonly present its
entries as traits.

Replace:

```json
{"trait_type":"Attested Agent","value":"..."}
{"trait_type":"Attested Model","value":"..."}
```

with:

```json
{"trait_type":"Agent","value":"..."}
{"trait_type":"Model","value":"..."}
```

Publish these two neutral traits for both App-attested and Unattested tokens.
They report stored records and make no attestation claim. Keep the separate
`Creation Attestation` trait as the visible assurance boundary:

- `Inshell THOUGHT App` for a valid nonzero App attestation;
- `Unattested` for the canonical empty proof.

Remove any metadata-profile rule that gates Agent/Model traits on a nonzero
attestation digest.

Keep the remaining traits unchanged unless a separate delta requires it:

- `Prompt Bytes`;
- `Agent Bytes`;
- `Pair Bytes`;
- `Prompt Length`;
- `Agent Length`.

### 4. ERC-721 description

Set the top-level token metadata `description` to this exact string:

```json
"description": "THOUGHT V2 preserves a narrow terminal channel between human intention and Agent response, transforming their dialogue into an on-chain artwork."
```

Preserve the exact capitalization, punctuation, and UTF-8 bytes. Cover the
value in monolithic/split renderer parity tests and golden tokenURI fixtures.

### 5. Technical metadata

Use neutral technical keys in `properties`:

```text
agent
agentKeccak256
model
modelKeccak256
```

Replace `thought.declarations` with a neutral structure. Preferred shape:

```json
{
  "records": {
    "agent": {
      "label": "Codex",
      "keccak256": "0x..."
    },
    "model": {
      "label": "GPT-5.6 Sol · Ultra",
      "keccak256": "0x..."
    },
    "workIdentityInput": false
  }
}
```

Do not emit `attested`, `verified`, `declared`, `provider-verified`, or another
assurance status on these two records. Assurance is represented only by the
separate `thought.creationAttestation` object and `Creation Attestation` trait.

The Contract must not infer record acquisition sources. Source detail belongs
inside the App-owned opaque `provenanceJson` and is interpreted off-chain.

### 6. Opaque provenance boundary

Keep `provenanceJson` opaque to Solidity. The Contract should continue to:

- require nonempty bounded bytes;
- store the exact bytes;
- derive their exact Keccak-256 hash;
- bind that hash in the Creation Attestation claim.

Do not make the Contract parse or certify App-owned provenance fields.

The App will separately update its canonical provenance schema/builder from
legacy `agentDeclaration`/`modelDeclaration` wire names to the neutral record
policy after receiving the new Contract release. Contract implementation must
not assume the JSON rename has already happened.

## Explicit non-goals

Do not change solely for this delta:

- prompt or Agent-line text rules;
- prompt-top / Agent-bottom artwork placement;
- glyphs, colors, native frame, or SVG layout;
- conversation identity or work hash inputs;
- uniqueness rules;
- `$PATH` authorization, movement consumption, or serial widening;
- manual/permissionless mint availability;
- protocol or creative-spec content;
- provenance JSON parsing in Solidity.

The renderer bytecode and metadata bytes will change. The visible artwork SVG
must not drift.

## Required behavior matrix

| Mint path | Agent source | Model source | Creation Attestation trait | Agent/Model traits |
| --- | --- | --- | --- | --- |
| Inshell App Agent run | App-selected Agent | Agent-runtime-reported model + reasoning effort | `Inshell THOUGHT App` | present |
| Permissionless manual | caller supplied | caller supplied | `Unattested` | present |

The Contract only receives exact strings and proof material. The acquisition
source descriptions above are App/caller responsibilities, not Contract
inferences.

## Acceptance tests

At minimum, add or update tests proving:

1. App-attested mint stores and returns exact `agent` and `model` bytes.
2. Manual Unattested mint stores and returns exact `agent` and `model` bytes.
3. Both paths publish `Agent` and `Model` attributes.
4. No next-release metadata contains `Attested Agent`, `Attested Model`,
   `declaredAgent`, `declaredModel`, or `declared-unverified`.
5. `Creation Attestation` is `Inshell THOUGHT App` only after valid proof
   verification and is `Unattested` only for the canonical empty proof.
6. The new EIP-712 claim binds exact `agentHash` and `modelHash`.
7. Mutating either record invalidates an otherwise valid App signature.
8. Old-profile signatures are rejected by the new verifier/profile.
9. Agent and Model remain excluded from conversation identity and work hash.
10. Artwork SVG output is byte-identical for identical prompt/Agent work lines
    and renderer configuration before and after this semantic refactor.
11. Monolithic and split renderer metadata remain byte-identical.
12. ERC-721 metadata JSON parses and all numeric display types remain numbers.
13. The top-level `description` equals the required sentence byte-for-byte.
14. Existing `$PATH` maximum-serial coverage remains passing.
15. Runtime size remains below EIP-170.
16. Full EVM and frontend renderer suites pass.

Include golden tokenURI examples for both App-attested and Unattested tokens.

## Release and downstream handoff

Publish a fresh noncanonical integration-preview artifact. Do not overwrite or
mutate an existing release directory.

The Contract handoff must include:

- release/artifact ID and explicit noncanonical status;
- manifest SHA-256;
- tag and publication commit;
- changed ABI and bytecode;
- new Creation Attestation profile/type hash;
- updated metadata/context profiles and schemas;
- positive and negative attestation vectors;
- App-attested and Unattested tokenURI fixtures;
- EVM test totals and runtime size;
- exact disposable-Anvil redeploy instructions;
- a downstream delta stating all required App renames and repins.

The Inshell App will then:

1. import and verify the immutable release artifact;
2. update mint input/getter/claim names;
3. update the App-owned provenance schema and builder;
4. retain read compatibility for already deployed legacy metadata;
5. redeploy disposable local fixtures;
6. verify preview, detail, gallery, manual mint, and App-attested mint flows.

Do not claim App integration complete from the Contract repo. The Contract
owner publishes the reviewed release; the App owner performs and verifies the
downstream repin.

## Source-of-truth boundary after the refactor

**THOUGHT Contract owns:**

- mint validation and storage;
- exact typed Agent/Model records and hashes;
- work identity and uniqueness;
- `$PATH` movement enforcement;
- Creation Attestation proof verification;
- ERC-721 metadata and SVG;
- Contract artifacts, vectors, and deployment manifests.

**Inshell THOUGHT App owns:**

- Creative Work Specification;
- Agent selection and run orchestration;
- runtime model-record acquisition;
- canonical provenance schema/builder/verifier;
- claim construction and App signing policy;
- product copy and presentation;
- downstream Contract release integration.

The shared integrity bridge is the exact Creation Attestation claim. It binds
the App-owned creation record to Contract-enforced mint facts without making
the Contract responsible for how the Agent or Model records were acquired.

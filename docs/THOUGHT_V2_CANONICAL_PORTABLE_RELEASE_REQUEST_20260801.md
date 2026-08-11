# THOUGHT V2 canonical portable release — Contract-owner request

Date: 2026-08-01

From: Inshell THOUGHT App owner

To: THOUGHT Contract owner

Status: fulfilled by `thought-v2-canonical-portable-release-20260801-r1`;
local acceptance passed; staging and persistent deployment remain unauthorized

## Local acceptance already completed

The App has accepted
`thought-v2-noncanonical-integration-preview-20260801-r11` for disposable
Anvil only. It verified the immutable tag and manifest, deployed fresh local
contracts, and chain-first verified both an App-attested mint and an
unattested mint.

Both local tokens were:

- contract-conforming;
- portable under the App-owned metadata policy;
- emitted with the canonical `external_url`;
- emitted with exactly the five marketplace traits below;
- verified against typed Contract state, exact provenance bytes, the selected
  spec, renderer commitments, artwork bytes, and Creation Attestation state.

The test snapshot was reverted after verification. No fixture tokens were
left in the operator's persistent Anvil state.

## Required next artifact

Publish a new immutable canonical or production-consumable THOUGHT V2
artifact derived from the accepted r11 behavior. Do not rewrite or relabel
r11 in place.

The new manifest must unambiguously declare:

- `productionConsumable: true`;
- deployment authorization for the release's explicitly named target chains;
- its classification and channel;
- clean source commit, publication commit, annotated tag, and manifest hash;
- whether protocol registration is applicable. The App does not require a
  registry contract, so a registration flag must not imply a new registry
  dependency.

If the release authorizes Sepolia before mainnet, state that boundary
explicitly. Do not make an Anvil-only artifact appear production-consumable.

## Metadata contract that must remain exact

`tokenURI()` must contain exactly these marketplace attributes in this order:

1. `Agent`
2. `Model`
3. `Creation Attestation`
4. `Prompt Bytes`
5. `Agent Bytes`

`Prompt Bytes` and `Agent Bytes` must remain JSON numbers with
`display_type: "number"` and `max_value: 64`.

Do not restore:

- `Pair Bytes`;
- `Prompt Length`;
- `Agent Length`;
- `Attested Agent`;
- `Attested Model`;
- declaration terminology as marketplace traits.

Keep the top-level URL exact:

`https://inshell.art/thought/<canonical-decimal-tokenId>`

Keep the description exact:

> THOUGHT V2 preserves a narrow terminal channel between human intention and
> Agent response, transforming their dialogue into an on-chain artwork.

## Boundaries that must remain exact

- `Agent` is the App-selected Agent record bound into the creation record.
- `Model` is the runtime-reported model record bound into the creation record.
- `Creation Attestation` describes the Contract-verified App attestation or
  the permitted `Unattested` path. It does not independently authenticate the
  Agent or model provider.
- provenance remains opaque calldata to the Contract except for the exact
  commitments and Creation Attestation checks already defined by V2.
- the App-owned provenance schema remains
  `inshell.thought.provenance.v2`.
- the App-owned custom metadata namespace remains the top-level `thought`
  object governed by `inshell.thought.metadata.v2.terminal-chat`.
- manual/unattested minting remains supported.
- ordered prompt-plus-Agent uniqueness, PATH consumption, atomic rollback,
  Agent/Model typed getters, and work identity remain unchanged.

The selected creative spec is unchanged unless an independently reviewed
creative-spec release is supplied:

- artifact: `thought-v2-selected-spec-20260801-r10`;
- byte length: `4627`;
- SHA-256:
  `90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b`;
- `thoughtSpecId`:
  `0x0a33583e39050834eb77372ea8b41ceded8fe4bb47c31fe1a72ebb880351b410`;
- `thoughtSpecHash`:
  `0xb2b0a167678816a7ae9dc9098b0d6a6852c0dc95feb59f9581de75bd2cc2231f`.

## Required publication evidence

The handoff must provide:

- immutable artifact ID and directory;
- annotated tag and exact tag target;
- clean source-base commit and implementation commit;
- publication commit;
- `manifest.json` SHA-256;
- complete per-file checksums;
- compiled ABI, creation bytecode, and runtime bytecode artifacts;
- the exact metadata profile and renderer profile;
- decoded `tokenURI()` fixtures covering both App-attested and unattested
  mints;
- a machine-readable r11-to-new-release migration report;
- EVM and TypeScript test counts;
- runtime-size evidence and target-chain compatibility;
- a leak-scan result.

The migration report must prove whether each ABI and bytecode artifact changed
or remained exact. Any change beyond release classification must be declared
and justified.

## Downstream acceptance sequence

After receiving the artifact, the App owner will:

1. fetch and verify its annotated tag and publication commit;
2. verify the manifest and every packaged file before import;
3. verify r11-to-release migration evidence;
4. import the artifact as one coherent immutable consumer pin;
5. checkpoint persistent local Anvil and deploy fresh local addresses;
6. mint and chain-first verify one App-attested and one unattested token;
7. require both `conforming: true` and `portable: true`;
8. rerun runtime, App/Contract, type, build, and leak checks;
9. only then land the frontend on `staging` and validate
   `preview.inshell.art`;
10. wait for explicit operator approval before any `main` promotion.

No staging or production deployment is authorized by this request itself.

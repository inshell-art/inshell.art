# THOUGHT V2 canonical portable Contract release handoff

Date: 2026-08-01

From: THOUGHT Contract owner

To: `inshell.art` / Inshell THOUGHT App owner

## Release decision

This release promotes the behavior accepted in
`thought-v2-noncanonical-integration-preview-20260801-r11` into a new,
immutable canonical portable Contract package. r11 remains unchanged and
retains its experimental classification.

The canonical package is production-consumable as an immutable downstream
byte pin. That label does not itself authorize a persistent-chain deployment.
No Sepolia or mainnet deployment, transaction, production signer use, or
frontend rollout is performed by the Contract owner as part of publication.

## Exact marketplace metadata

`tokenURI()` contains exactly these attributes in order:

1. `Agent`
2. `Model`
3. `Creation Attestation`
4. `Prompt Bytes`
5. `Agent Bytes`

The two byte traits are JSON numbers with `display_type: "number"` and
`max_value: 64`.

The package forbids `Pair Bytes`, `Prompt Length`, `Agent Length`,
`Attested Agent`, `Attested Model`, and declaration terminology as marketplace
traits.

The exact description remains:

> THOUGHT V2 preserves a narrow terminal channel between human intention and
> Agent response, transforming their dialogue into an on-chain artwork.

The exact top-level URL remains:

`https://inshell.art/thought/<canonical-decimal-tokenId>`

## Unchanged Contract boundary

The canonical package preserves exact r11 ABI, creation bytecode, and runtime
bytecode for every compiled Contract artifact. It also preserves exact r11:

- typed Agent and Model state/getters;
- Creation Attestation and manual `Unattested` flow;
- provenance schema and opaque Contract storage boundary;
- ordered prompt-plus-Agent uniqueness and work identity;
- PATH consumption and atomic rollback;
- selected creative spec bytes, ID, and hash;
- renderer identity, geometry, glyph payload, SVG, and artwork bytes;
- metadata profile bytes and five-trait contract;
- decoded App-attested and unattested `tokenURI()` fixtures.

Only release-envelope material and release-status documentation change from
r11. The machine-readable migration report proves the complete ABI and
bytecode comparison.

## Deployment and registration policy

The package names three compatibility targets:

- disposable Anvil, chain ID `31337`;
- Sepolia, chain ID `11155111`;
- Ethereum mainnet, chain ID `1`.

The packaged bytecode passes the EIP-170 runtime-size and EIP-3860 initcode-size
limits used by the named Ethereum targets. No persistent deployment address is
bundled. Deployment authorization is `false` for every target. Sepolia must be
approved and validated before mainnet; mainnet additionally requires a
separate operator approval after Sepolia evidence.

Protocol-release registration is not applicable to this portable Contract
package. This does not add, remove, or replace the existing immutable
`ThoughtSpecRegistry` dependency used by `ThoughtNFTV2` for selected-spec
validation.

## Publication evidence

The immutable artifact includes:

- a complete raw-byte manifest and per-file SHA-256 list;
- normalized compiled ABIs, creation bytecode, and runtime bytecode;
- exact metadata and renderer profiles;
- App-attested and unattested decoded on-chain fixtures;
- r10-to-r11 and r11-to-canonical migration evidence;
- runtime-size and target-chain compatibility evidence;
- producer test evidence;
- the sealed Inshell Mono 76 dependency and provenance.

The final external publication receipt supplies the exact artifact ID,
manifest SHA-256, clean source commit, publication commit, annotated tag, and
tag target. The publication commit and manifest's own hash cannot be embedded
inside that same manifest without a circular cryptographic self-reference;
they are bound externally by the annotated Git tag, stable discovery pointer,
and final downstream handoff.

## Downstream sequence

1. Verify the annotated tag, tag target, manifest hash, and every checksum.
2. Verify the r11 baseline and the machine-readable r11-to-release report.
3. Import the package as one coherent immutable pin.
4. Deploy fresh disposable Anvil addresses.
5. Mint and read back one App-attested and one unattested token.
6. Require exact typed-state, provenance-byte, selected-spec, renderer,
   artwork, external-URL, and five-trait parity.
7. Run the App's runtime, type, build, chain-first, and leak gates.
8. Obtain explicit operator approval before any persistent Sepolia deployment
   or staging rollout.
9. Obtain a separate approval before mainnet deployment or production
   promotion.

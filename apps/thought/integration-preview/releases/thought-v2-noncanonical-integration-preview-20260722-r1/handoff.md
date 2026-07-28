# THOUGHT V2 noncanonical integration-preview handoff

Artifact ID: `thought-v2-noncanonical-integration-preview-20260722-r1`

Source tag: `thought-v2-noncanonical-integration-preview-20260722-r1`

Classification: `experimental / noncanonical integration preview`

## Read this first

This package exists only so the `inshell.art` agent can integrate and test the
current THOUGHT V2 contract interfaces against disposable Anvil state.

It is not a candidate or stable protocol release. It is not approved for
Sepolia, mainnet, protocol-registry registration, production minting, or a
production frontend lock. It contains no persistent deployment address and no
operator or signing secret.

The canonical native path-glyph renderer is not implemented. The included
`ThoughtRendererV2DevSourceCodePro` is chain-gated to Anvil chain `31337`, uses
an embedded Source Code Pro study font and SVG `foreignObject`, and must not be
shipped or treated as final artwork.

## How to resolve and verify

1. Fetch the THOUGHT repository and the exact source tag above.
2. Read `artifacts/thought-v2-integration-preview/experimental.json` only as a
   discovery pointer.
3. Require the artifact ID above and hash `manifest.json` before trusting its
   contents.
4. Run `npm run integration-preview:v2:check`.
5. Pin the immutable artifact ID, manifest SHA-256 and source tag in the local
   `inshell.art` development lock. Do not create a production lock from it.

## Contract boundary available for integration

`ThoughtNFTV2` is the current contract candidate. Its constructor permanently
binds:

- PATH NFT;
- exact-spec registry;
- renderer;
- protocol-release registry and one already-registered release ID;
- creation-attestation verifier.

`mint(MintThoughtInput)` accepts:

- exact `promptLine` and `agentLine`;
- exact `declaredAgent` and `declaredModel` labels;
- PATH ID, PATH deadline and PATH consume signature;
- selected `thoughtSpecId` and `thoughtSpecHash`;
- exact canonical `provenanceJson` bytes;
- optional creation-attestation proof.

The ordered prompt-plus-Agent pair is globally unique. The contract validates
Terminal English, declarations and selected-spec state before consuming PATH.
Failed minting must not consume PATH, reserve identity or increment supply.

The bundle contains concise compiled artifacts for:

- `ThoughtNFTV2`;
- `IThoughtRendererV2`;
- Anvil-only `ThoughtRendererV2DevSourceCodePro`;
- `CreationAttestationVerifier`;
- `ThoughtSpecRegistry`;
- protocol-release registry `ThoughtSpecRegistryV2`.

PATH is an external dependency owned by the PATH repository and is not
published by this THOUGHT bundle.

## Shared App-side reference code

The `reference/` directory carries the current TypeScript baseline for:

- Terminal English validation and ordered-pair/work hashes;
- declaration-label validation;
- canonical JSON serialization;
- canonical provenance construction and verification;
- EIP-712 creation-attestation claim/proof construction.

The THOUGHT App should use these exact rules or generated equivalents and add
parity tests against the bundled vectors and Anvil contracts. Do not import the
historical binary-weave helpers or maintain independently edited protocol
constants.

The production App remains owned by the `inshell.art` agent. This repository
does not implement its run service, private-key custody, wallet UX, deployment
or production frontend.

## Provenance flow

For every positive mint path, including manual and Agent-run paths:

1. collect exact work, declarations, selected spec, release, mint context and
   public run evidence;
2. build the closed `inshell.thought.provenance.v2` object;
3. serialize it to exact JCS bytes;
4. verify schema, work commitments, declaration parity, selected-spec parity,
   release parity and attestation facts;
5. hash and submit those exact bytes as `provenanceJson`.

Fixture ID, corpus name, source-file path and other harness bookkeeping must
remain outside provenance, metadata and attestation claims.

## Creation attestation

An empty proof means `Unattested`. A nonempty proof must be a valid EIP-712
signature from the verifier's current authority and binds the collection,
release, selected spec, work hash, provenance hash, declaration hashes, run ID,
intended minter, deadline and authority epoch.

The declaration status remains `declared-unverified` even when this creation
attestation is valid. The attestation proves that the authorized THOUGHT App
signer made the exact creation claim; it does not independently prove the
declared Agent or model identity.

Use only disposable mock keys for Anvil. No production authority key or key
custody mechanism is included in this preview.

## Local integration rehearsal

From the THOUGHT repository:

```bash
npm ci
npm run devnode:v2:start
```

In another terminal:

```bash
npm run devnode:v2:gallery
npm run dev:v2-lab
```

The gallery script deploys disposable dependencies, registers a disposable
Anvil manifest, mints the corpus with canonical provenance, and emits generated
runtime state for local reads. Never pin generated Anvil addresses.

## Preview qualification evidence

The exact preview source and generated artifacts passed:

- TypeScript/frontend build;
- 145 TypeScript/frontend tests across 27 files;
- Solidity compilation with Solidity `0.8.28`;
- 177 Solidity tests across 7 suites;
- deterministic preview regeneration and complete manifest/checksum readback;
- one fresh chain-`31337` rehearsal minting 66 tokens from the current corpus;
- 60 conforming unattested records and 6 conforming mock-EIP-712-attested
  records;
- all 66 `ThoughtNFTV2.tokenURI()` results checked against stored work,
  declaration, provenance, selected-spec and attestation state.

The rehearsal's canonical provenance payloads ranged from 1,168 to 1,527
bytes. Its addresses and mock authority were disposable and are intentionally
excluded from this package.

## Final-release gates deliberately left open

- reviewed native SVG path-glyph implementation;
- deterministic glyph metrics, wrapping profile and renderer vectors;
- final renderer and attestation artifacts required by `release-input.json`;
- clean approved exact-byte release manifest;
- production registry records and deployment metadata;
- Sepolia/mainnet deployment review;
- stable consumer lock and production frontend rollout.

When those gates close, `inshell.art` must replace this preview pin with the
future verified candidate/stable artifact. It must not promote these preview
bytes in place.

# THOUGHT V2 portable marketplace traits — Contract handoff

Date: 2026-08-01

Status: decisioned downstream requirement; requires a new nonproduction
integration-preview artifact from the THOUGHT Contract owner

Owner boundary:

- THOUGHT Contract owns exact `tokenURI()` bytes and marketplace attributes.
- THOUGHT App owns the portability policy and rejects releases that do not
  conform.

## Required delta

Keep exactly these five marketplace attributes in this order:

1. `Agent`
2. `Model`
3. `Creation Attestation`
4. `Prompt Bytes`
5. `Agent Bytes`

`Prompt Bytes` and `Agent Bytes` remain numeric traits with
`display_type: "number"` and `max_value: 64`.

Remove these redundant attributes:

- `Pair Bytes`: it is exactly the sum of the two retained byte counts;
- `Prompt Length`: Terminal English is ASCII, so it duplicates Prompt Bytes
  with a less precise categorical value;
- `Agent Length`: Terminal English is ASCII, so it duplicates Agent Bytes with
  a less precise categorical value.

## Must remain unchanged

- top-level `external_url` remains exactly
  `https://inshell.art/thought/<canonical-decimal-tokenId>`;
- `name`, `description`, `image`, `background_color`, and the top-level
  `thought` namespace;
- neutral Agent and Model typed records;
- Creation Attestation semantics and the `Unattested` path;
- provenance bytes, schema identifier, and commitments;
- work identity, uniqueness, renderer identity, SVG bytes, and PATH
  consumption;
- public `ThoughtNFTV2` ABI and typed getters, unless the Contract owner finds
  an independently necessary correction.

This is a metadata renderer change. It necessarily changes renderer/contract
bytecode and the metadata-profile artifact hash. Do not patch the r10 artifact
in place; publish a new immutable integration-preview artifact.

## Required fixtures and checks

The next artifact must include decoded `tokenURI()` examples for both:

- `Creation Attestation = Inshell THOUGHT App`;
- `Creation Attestation = Unattested`.

For every example:

- the complete trait-name array equals the five-name order above;
- there are no duplicate trait names;
- Prompt/Agent byte values equal the exact UTF-8 byte lengths;
- both byte traits retain `display_type: "number"` and `max_value: 64`;
- the neutral Agent/Model values equal typed Contract state;
- Creation Attestation equals typed Contract state;
- canonical `external_url` remains present and exact;
- the structured `metadata.thought` object remains conformant to
  `thought-metadata-namespace-v2-20260731-r1`.

## Downstream acceptance

Inshell will not mark the portable metadata gate complete from this document
alone. Acceptance requires importing the new immutable artifact, validating
its manifest, checking decoded fixtures, deploying it to disposable Anvil,
minting both attested and unattested tokens, and reading each result back from
chain with the chain-first verifier.

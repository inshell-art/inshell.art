# ThoughtNFT V2 Conformance Interface

Public product name: `THOUGHT`

The unversioned `ThoughtNFT` constructor pins PATH, registry, the immutable `ThoughtRenderer`, and `protocolReleaseKeccak256`. Construction verifies that the renderer has code and exposes the expected `RENDERER_ID_HASH`. Mint remains permissionless and consumes exactly one PATH `THOUGHT` unit.

The contract validates exact lines and provenance, derives packed field and all hashes, rejects an existing `agentIdentityHash`, validates the supplied registered spec pair, consumes PATH, stores immutable facts, mints ERC-721, and emits events in that order. The constructor does not pin one spec version; multiple registered `THOUGHT.vN.md` versions may coexist and remain mintable.

Read helpers expose exact packed field, `binaryFieldKeccak256`, `agentIdentityHash`, `workHash`, pinned renderer and protocol release hash, `svgOf`, and marketplace `tokenURI`. The contract computes and passes the authoritative field and validated metrics to the pinned renderer. The contract does not prove Agent authorship, one-round process truth, or opaque provenance semantics.

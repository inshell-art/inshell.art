# THOUGHT Creative Work Specification

`THOUGHT.v2.md` is the App-owned canonical Creative Work Specification. Its
exact bytes are pinned by `THOUGHT.v2.lock.json` and checked by
`scripts/check-thought-creative-spec-lock.mjs`.

The lock is immutable by artifact identity. Any byte change, including spacing,
punctuation, or line endings, requires a new artifact ID and new hashes. Do not
update the hashes in place while retaining the same artifact ID.

`THOUGHT.v2.local.md` is the verified Contract-package compatibility copy. The
canonical portable Contract release pins bytes identical to the App-owned
specification; the generated copy must still never overwrite `THOUGHT.v2.md`.

The App must not claim a Contract release is compatible with the canonical
specification until that release pins the canonical artifact ID, exact bytes,
EVM spec ID, and EVM spec hash. Agent task context, provenance, Creation
Attestation, registry selection, and mint calldata must all identify the same
locked specification.

`CREATION_PROVENANCE.md` defines the App's creation-attestation guarantee
boundary and the acquisition source for every public creation-record field.
The Contract, provenance, metadata, and App surfaces use the neutral product
terms `Agent` and `Model`. A legacy Agent result-envelope declaration may be
accepted only as transport compatibility evidence.

The App-owned provenance schema remains `inshell.thought.provenance.v2`. Its
unpublished release lock lives under `apps/thought/provenance/v2/`. The
repository verifier is documented in `docs/THOUGHT_PROVENANCE_VERIFIER.md`.

The structured token-metadata extension is the top-level `thought` namespace
under `apps/thought/metadata/v2/`. The locked local candidate includes a
machine-readable schema for the exact `metadata.thought` object, an explanatory
specification, and an immutable-file manifest. It is packaged locally at
`/protocol/releases/thought-metadata-namespace-v2-20260731-r1/` but remains
unpublished until the complete portability sequence passes local validation
and the operator approves the staging and production gates.

Conventional ERC-721 fields such as `external_url` remain outside the custom
namespace. `thought-v2-canonical-portable-release-20260801-r1` emits the
canonical value and the exact portable five-trait marketplace profile. The
custom namespace schema is checked separately against all decoded attested and
unattested token metadata examples from that immutable package.

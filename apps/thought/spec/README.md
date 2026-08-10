# THOUGHT Work Specification and Agent Creative Brief

`THOUGHT.v2.md` is the canonical THOUGHT Work Specification selected by the
App and registered and pinned by the Contract release. It is a THOUGHT release
artifact, not an App-owned document that the App may rewrite independently. It
is the complete artwork-facing record: meaning and creative rules, identity,
provenance/attestation boundary, PATH consumption, metadata, and renderer
identity. Its exact bytes are pinned by `THOUGHT.v2.lock.json` and checked by
`scripts/check-thought-creative-spec-lock.mjs`.

The lock is immutable by artifact identity. Any byte change, including spacing,
punctuation, or line endings, requires a new artifact ID and new hashes. Do not
update the hashes in place while retaining the same artifact ID.

`THOUGHT.v2.local.md` is the verified Contract-package compatibility copy. The
canonical portable Contract release pins bytes identical to the canonical Work
Specification; the generated copy must still never overwrite `THOUGHT.v2.md`.

`THOUGHT.agent-creative.v2.md` is the smaller Agent Creative Brief used only
for the one creative turn after bounded control succeeds. It is an operational
projection of the Work Specification and contains only what that turn needs:
meaning, one-result behavior,
Terminal English constraints, exact-byte preservation, and the non-operational
prompt boundary. It deliberately excludes registry, provenance, attestation,
PATH, metadata, hashing, and renderer implementation machinery. The App sends
the selected Work Specification and this brief as separately hashed values;
they are not aliases and their hashes must not be compared for equality.

The brief is pinned by `THOUGHT.agent-creative.v2.lock.json`. A brief byte
change requires a new brief artifact ID, but does not silently mutate the
already-pinned Work Specification or its EVM identity.

The Agent Run Protocol and visible launch handoff are a third layer. They govern
bounded control, transport, recovery, and delivery; they are not creative
specifications. The visible handoff is editable bootstrap text. Canonical
creative authority comes only from the App-issued claim and start responses,
which bind the exact Work Specification, Creative Brief, prompt, release,
output contract, and hashes. Editing chat text cannot change those App records.
The App receipt attests App acceptance and binding, not an untouched chat
transcript or absence of outside influence.

Inshell Mono 76 belongs to the Work Specification as a normative visual
dependency: changing it changes the artwork. The Work Specification binds its
identity and essential visual role; the renderer profile contains geometry,
wrapping, alignment, colors, and stroke mechanics; the sealed Mono 76 package
contains the actual path bytes, mapping, metrics, hashes, provenance, and
distribution notices. The release manifest pins all three layers.

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
namespace. `thought-v2-canonical-portable-release-20260807-r2` emits the
canonical value and the exact portable five-trait marketplace profile. The
custom namespace schema is checked separately against all decoded attested and
unattested token metadata examples from that immutable package.

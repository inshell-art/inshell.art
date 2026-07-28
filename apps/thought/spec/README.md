# THOUGHT Creative Work Specification

`THOUGHT.v2.md` is the App-owned canonical Creative Work Specification. Its
exact bytes are pinned by `THOUGHT.v2.lock.json` and checked by
`scripts/check-thought-creative-spec-lock.mjs`.

The lock is immutable by artifact identity. Any byte change, including spacing,
punctuation, or line endings, requires a new artifact ID and new hashes. Do not
update the hashes in place while retaining the same artifact ID.

`THOUGHT.v2.local.md` is a compatibility copy from the current experimental
THOUGHT Contract handoff. It is not the App-owned canonical specification and
must not overwrite `THOUGHT.v2.md`.

The App must not claim a Contract release is compatible with the canonical
specification until that release pins the canonical artifact ID, exact bytes,
EVM spec ID, and EVM spec hash. Agent task context, provenance, Creation
Attestation, registry selection, and mint calldata must all identify the same
locked specification.

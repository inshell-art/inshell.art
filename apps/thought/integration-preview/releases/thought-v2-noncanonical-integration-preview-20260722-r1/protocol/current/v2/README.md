# THOUGHT Protocol V2 — implementation candidate

V2 replaces the unpublished binary-weave attempt as the current protocol and
contract direction. It is an implementation candidate, not a published or
registered release. No THOUGHT V3 release exists.

The Terminal English work profile and contract-side identity rules are frozen
and under implementation. The native path-glyph renderer, exact renderer
vectors, deployment tooling, release
manifest, registration, and immutable consumer handoff remain release gates.

The declaration carry-forward is now explicit. `declaredAgent` and
`declaredModel` are exact typed mint fields under
`inshell.thought.context.v2.visible-utf8-64`; both appear as marketplace
traits, both are required in canonical provenance, and both exact UTF-8 hashes
are creation-attestation claim inputs. They remain `declared-unverified`, do
not affect conversation/work identity, and do not affect SVG artwork.

Candidate artifacts now present:

- `context/thought.context.v2.profile.json`;
- `agent/thought.agent-declaration.v1.schema.json`;
- `attestation/thought.creation-workflow-attestation.v1.md`;
- `metadata/thought.metadata.v2.profile.json`;
- `provenance/thought.provenance.v2.md` and schema;
- `contract/thought.mint-input.v2.schema.json`;
- `release-input.json`, which lists required final-manifest roles.

`release-input.json` is not a release manifest and is not registrable. Final
artifact hashes, contract/verifier ABIs, current attestation vectors, renderer
profile/vectors, manifest, and registration record remain pending.

No file in this directory is authorized for production registration until the
complete V2 release is reviewed, generated from a clean tree, and represented
by an approved exact-byte manifest.

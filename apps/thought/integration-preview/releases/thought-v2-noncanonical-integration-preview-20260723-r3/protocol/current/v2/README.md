# THOUGHT Protocol V2 — implementation candidate

V2 replaces the unpublished binary-weave attempt as the current protocol and
contract direction. It is an implementation candidate, not a published or
registered release. No THOUGHT V3 release exists.

The Terminal English work profile and contract-side identity rules are frozen
and under implementation. The native path-glyph renderer, exact renderer
vectors, deployment tooling, release
manifest, registration, and immutable consumer handoff remain release gates.

The renderer geometry is fixed for implementation: a 1024x1024 SVG artboard
contains the unchanged 960x960 black work canvas at `(32,32)`, surrounded by
a 32-unit `#006100` artifact-owned frame. The canvas is not scaled. The
disposable Anvil renderer demonstrates this geometry with Source Code Pro and
`foreignObject`; those text dependencies remain noncanonical and must be
replaced by reviewed native path glyphs before release.

The declaration carry-forward is now explicit. `declaredAgent` and
`declaredModel` are exact typed mint fields under
`inshell.thought.context.v2.visible-utf8-64`; both are required in canonical
provenance, and both exact UTF-8 hashes are creation-attestation claim inputs.
A nonzero valid creation-attestation digest publishes them as `Attested Agent`
and `Attested Model` marketplace traits. Unattested tokens omit Agent/Model
traits. The labels remain `declared-unverified`, do
not affect conversation/work identity, and do not affect SVG artwork.

Candidate artifacts now present:

- `context/thought.context.v2.profile.json`;
- `agent/thought.agent-declaration.v1.schema.json`;
- `attestation/thought.creation-workflow-attestation.v1.md`;
- `integration/thought.app-contract-boundary.v1.md` and JSON;
- `metadata/thought.metadata.v2.profile.json`;
- `provenance/thought.provenance.v2.md` and schema;
- `contract/thought.mint-input.v2.schema.json`;
- `release-input.json`, which lists required final-manifest roles.

The App/Contract boundary files describe and machine-pin the current
registry-bound executable interface while separating the proposed,
unapproved registry-removal target. They are contract-owner review drafts,
not protocol authority or implementation authorization. With a disposable
current-V2 Anvil gallery running, verify the live boundary with:

```bash
npm run conformance:v2:app-contract
```

The ownership proposal conflicts with the current
`docs/agent/THOUGHT_ARTIFACT_CONSUMPTION_BOOK.md` assignment for the creative
spec and provenance schemas. Joint App/Contract owner approval is required
before either authority or the Contract ABI changes.

`release-input.json` is not a release manifest and is not registrable. Final
artifact hashes, contract/verifier ABIs, current attestation vectors, renderer
profile/vectors, manifest, and registration record remain pending.

No file in this directory is authorized for production registration until the
complete V2 release is reviewed, generated from a clean tree, and represented
by an approved exact-byte manifest.

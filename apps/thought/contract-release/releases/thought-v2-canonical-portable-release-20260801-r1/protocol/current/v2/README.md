# THOUGHT Protocol V2 — canonical portable release source

V2 replaces the unpublished binary-weave attempt as the current protocol and
contract direction. This directory is the release-qualified source for the
canonical portable Contract package. Publication status, exact source commit,
channel, manifest hash, deployment authorization, and registration
applicability are carried by each immutable release envelope. No THOUGHT V3
release exists.

The Terminal English work profile and contract-side identity rules are frozen.
The native path-glyph renderer is implemented
with the sealed Inshell Mono 76 v1.0.0 family. Production deployment tooling,
operator deployment approval, reviewed per-network addresses, and an immutable
production consumer lock remain separate rollout gates.

The renderer geometry is fixed for implementation: a 1024x1024 SVG artboard
contains the unchanged 960x960 black work canvas at `(32,32)`, surrounded by
a 32-unit `#006100` artifact-owned frame. The canvas is not scaled. The
canonical glyph color is `#00ff00`. `ThoughtRendererV2` uses the reviewed
Inshell Mono 76 centerline paths with no fill, 1.23-unit strokes, round caps
and joins, fixed 10-unit advance, and a global +1 glyph-origin shift. It emits
no SVG `<text>`, `foreignObject`, embedded font, or system-font lookup. Its
equal 844.8-by-256 fields have fixed opposite anchors: the prompt is top
aligned with first glyph-row baseline `171.52`, while the Agent response is
bottom aligned with final glyph-row baseline `811.52`.

The neutral Agent/Model record boundary is explicit. `agent` and `model` are
exact typed mint fields under
`inshell.thought.context.v2.visible-utf8-64`; both are required in canonical
provenance, and both exact UTF-8 hashes are creation-attestation claim inputs.
Every token publishes them as `Agent` and `Model` marketplace traits. Creation
Attestation remains a separate status and digest. The records do not affect
conversation/work identity or SVG artwork.

Canonical minted metadata also publishes exactly one conventional top-level
`external_url` as `https://inshell.art/thought/<tokenId>`. The fixed production
base is Contract-owned and is not configurable by mint calldata. It does not
affect work identity or any mint commitment.

Candidate artifacts now present:

- `context/thought.context.v2.profile.json`;
- `agent/thought.agent-declaration.v1.schema.json`;
- `attestation/thought.creation-workflow-attestation.v2.md`;
- `integration/thought.app-contract-boundary.v1.md` and JSON;
- `metadata/thought.metadata.v2.profile.json`;
- `provenance/thought.provenance.v2.md` and schema;
- `contract/thought.mint-input.v2.schema.json`;
- `renderer/thought.renderer.v2.profile.json` and the exact sealed
  `renderer/mono-76.im76.bin` payload;
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

`release-input.json` is not a release manifest and is not a registration
record. Exact artifact hashes, compiled Contract artifacts, target-chain
policy, and release status are published only in immutable release envelopes.

Protocol registration is not applicable to the portable Contract package.
That classification does not remove or replace the existing selected-spec
registry dependency in `ThoughtNFTV2`. Persistent Sepolia or mainnet deployment
still requires explicit operator approval and reviewed network configuration.

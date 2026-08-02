# THOUGHT V2 r9 external URL — downstream release-integrity rejection handoff

Date: 2026-08-01

From: `inshell.art` / Inshell THOUGHT App owner

To: THOUGHT Contract owner

Status: r9 integrity verified, downstream integration rejected. No App consumer
pin was advanced and no local runtime was redeployed.

## Upstream artifact reviewed

- Artifact ID:
  `thought-v2-noncanonical-integration-preview-20260801-r9`
- Publication commit:
  `4917aa4a081ce92361d300a1ddcdd6260f4c49a7`
- Annotated tag:
  `thought-v2-noncanonical-integration-preview-20260801-r9`
- Manifest SHA-256:
  `fbe34df47f08f52614490dc1f6a14095cddf844d6869b0b09bcaaf07819e5f20`
- Downstream handoff reviewed:
  `THOUGHT_V2_EXTERNAL_URL_INSHELL_ART_DOWNSTREAM_HANDOFF_20260801.md`

The annotated tag, publication commit, manifest digest, and all 69 listed file
checksums were verified successfully. This is not a download, tag, or checksum
failure.

## Rejection reason

The r9 handoff describes an `external_url`-only presentation-metadata delta and
explicitly states that SVG artwork bytes, selected-spec behavior, and protocol
semantics are unchanged.

The published r9 artifact does not satisfy that declaration. Relative to the
App's pinned r8 artifact, r9 also replaces the packaged renderer, changes the
selected spec, changes rendered artwork bytes, changes renderer deployment
inputs, and adds a new sealed Mono 76 dependency bundle.

Those are separate protocol, artwork, and deployment changes. The App will not
silently accept them as part of an `external_url` rollout.

## Exact evidence

### 1. Packaged renderer changed

r8:

```text
inshell.thought.renderer.v2.humanist-smooth-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom
```

r9:

```text
inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom
```

r8's active renderer profile uses two Humanist SVG path-definition payloads
plus an index payload. r9's active profile instead points to one packed IM76
Mono 76 payload and adds the `dependencies/mono-76/` bundle.

### 2. Selected spec changed

| Field | r8 | r9 |
| --- | --- | --- |
| byte length | `3936` | `4627` |
| SHA-256 | `58c353a6283fdd3dbae4a212bb5470ffe3afaca8c592ad9aff2e97b855082e82` | `90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b` |
| `thoughtSpecHash` | `0xc0661f522867afd109cfe28bcd3f28d04a849757de946879e0992718a72e6a61` | `0xb2b0a167678816a7ae9dc9098b0d6a6852c0dc95feb59f9581de75bd2cc2231f` |

The stable `thoughtSpecId` does not make different selected-spec bytes or
hashes equivalent.

### 3. Artwork bytes changed for identical works

The r8 and r9 fixture sets contain the same prompt/Agent pairs. Hashing each
fixture's exact `metadata.image` string produces different results:

| Work | r8 image SHA-256 | r9 image SHA-256 |
| --- | --- | --- |
| `THOUGHT WILL AWA` / `ABCDEFGHIJKLMNOPQRSTUVWXYZ` | `ee150047015acd3316fc44c89e38e87f2104ad423e3153da614a6b81d6409582` | `de87bce087663023390b6938241440234531ea468559b8b93c253eba499194d6` |
| `Can you count from 0 to 9?` / `0123456789.` | `70c82eb738440047593884d06dd755a3400b42b4ec72a1abce63d9544cd53fd1` | `a3be2c4027507967c5c010e66f322852ad25e0db2340f98dac3bffe676944467` |

This directly contradicts the handoff's statement that SVG artwork bytes are
unchanged.

### 4. Renderer deployment contract changed

r8 `ThoughtRendererV2` constructor:

```text
(glyphDefinitionsPointer1_, glyphDefinitionsPointer2_, glyphDefinitionsIndexPointer_)
```

r9 `ThoughtRendererV2` constructor:

```text
(glyphDataPointer)
```

The App's deployment and runtime-integrity tooling is intentionally pinned to
the reviewed r8 renderer payload topology. Adopting r9 requires an explicit
renderer migration, not an incidental metadata-field rollout.

## Downstream state

- The App consumer lock remains on
  `thought-v2-noncanonical-integration-preview-20260731-r8`.
- The App contract-integration lock remains on r8.
- The active persistent Anvil runtime was not redeployed.
- A local Anvil checkpoint was captured before inspection.
- r8 integration-preview verification passes: 48 files verified.
- r8 App-contract verification passes.
- The App's post-r8 metadata portability gate passes its test suite and will
  require canonical `external_url` from the next accepted artifact.

## Requested corrective publication

Publish a new immutable release, recommended as r10. Do not rewrite or move the
published r9 tag.

The recommended r10 must be based on the exact r8 selected spec and renderer
architecture, with only the requested canonical `external_url` metadata delta:

```json
"external_url": "https://inshell.art/thought/<tokenId>"
```

The renderer/tokenURI implementation bytecode may necessarily change to emit
that field. The following must remain byte-for-byte or semantically identical
to r8 as applicable:

- selected `THOUGHT.v2.md` bytes, SHA-256, and `thoughtSpecHash`;
- Humanist Smooth glyph payloads and renderer profile;
- rendered SVG/image bytes for existing fixture works;
- `ThoughtRendererV2` deployment topology and constructor inputs;
- mint ABI, identity, uniqueness, provenance, Creation Attestation, PATH, and
  protocol-registry behavior;
- Agent and Model record behavior and traits.

The r10 handoff and manifest should explicitly identify the r8 artifact as its
baseline and include machine-readable evidence that:

1. every metadata object has exactly one top-level canonical `external_url`;
2. existing fixture SVG/image bytes equal r8 exactly;
3. selected-spec bytes and hashes equal r8 exactly;
4. renderer profile and deployment inputs equal r8 exactly;
5. all other previously declared unchanged surfaces remain unchanged.

## Alternative requiring a separate product decision

If Mono 76 and the revised selected spec are intentional, publish them as a
separate cumulative renderer/spec migration with an accurate handoff. Include
visual diffs, selected-spec rationale, compatibility impact, constructor and
deployment migration instructions, fixture changes, and downstream test
requirements.

That broader migration requires explicit App-owner approval. It must not be
described or consumed as an `external_url`-only release.

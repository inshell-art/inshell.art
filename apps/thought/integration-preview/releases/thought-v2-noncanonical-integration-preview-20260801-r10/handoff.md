# THOUGHT V2 r10 — Mono 76 and external URL cumulative migration handoff

Date: 2026-08-01

From: THOUGHT Contract owner

To: `inshell.art` / Inshell THOUGHT App owner

Target artifact:
`thought-v2-noncanonical-integration-preview-20260801-r10`

Status: downstream integration preview only; noncanonical, non-production,
non-registrable, and not deployment-authorized

## Scope correction

r9 was integrity-valid but its handoff incorrectly described the package as an
`external_url`-only delta from the App's pinned r8 artifact. The App correctly
rejected r9. The r9 artifact and tag remain immutable and must not be moved or
rewritten.

r10 deliberately publishes the current Contract candidate as an explicit
cumulative migration from r8. It includes all of the following changes:

1. Humanist Smooth is replaced by the sealed Inshell Mono 76 v1.0.0 renderer.
2. Renderer glyph storage changes from two SVG-fragment pointers plus one index
   pointer to one packed IM76 data pointer.
3. Renderer geometry baselines and exact artwork bytes change to match Mono 76.
4. The selected `THOUGHT.v2.md` bytes and hash change so the registered spec
   describes the actual Mono renderer and canonical external URL.
5. ERC-721 metadata gains exactly one canonical top-level `external_url`.
6. Split renderer artifacts are added as exact-parity reference/deployment
   alternatives; the default disposable gallery continues to use the
   monolithic renderer.

This is not an `external_url`-only publication.

## Immutable r8 baseline

- Artifact ID:
  `thought-v2-noncanonical-integration-preview-20260731-r8`
- Publication commit:
  `1f281a60f398704560f373085b84671f49ecedc3`
- Source base commit:
  `7000bfd8816011c079eb2494d535e0b443879370`
- Manifest SHA-256:
  `243b2057ac58b62c4a78ced96e5db2e23d7d05e332f60a9f008dbb8dcd84d3df`
- Renderer implementation:
  `inshell.thought.renderer.v2.humanist-smooth-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom`
- Selected spec SHA-256:
  `58c353a6283fdd3dbae4a212bb5470ffe3afaca8c592ad9aff2e97b855082e82`
- Selected `thoughtSpecHash`:
  `0xc0661f522867afd109cfe28bcd3f28d04a849757de946879e0992718a72e6a61`

r10 includes machine-readable baseline and migration evidence at
`validation/r8-to-r10-cumulative-migration.json`.

## Renderer migration

### r8 Humanist Smooth

- two raw SVG path-definition payloads: 15,557 and 12,779 bytes;
- one 375-byte glyph index payload;
- renderer constructor:
  `(address glyphDefinitionsPointer1_, address glyphDefinitionsPointer2_, address glyphDefinitionsIndexPointer_)`;
- filled path geometry with a 5.58 visual baseline;
- first prompt baseline `140.8` and final Agent baseline `780.8`.

### r10 Inshell Mono 76

- sealed package: `@inshell/mono-76` v1.0.0;
- one 4,600-byte IM76 payload containing a 162-byte header and 4,438 path
  bytes;
- packed SHA-256:
  `3acc0a9cf60c00aa2d512356386d1e2a999499896e25661e8e631d53d5e10926`;
- packed Keccak-256:
  `0xba37d00bb395b84f0487791300a29cdd2b1712b078fa218c6ed74fa11d74a081`;
- renderer constructor: `(address glyphDataPointer)`;
- centerline paths with no fill, `1.23` stroke width, round caps/joins,
  fixed 10-unit advance, 2.88 glyph scale, and global +1 origin shift;
- first prompt baseline `171.52` and final Agent baseline `811.52`.

The artboard remains 1024×1024: a 960×960 black canvas at `(32,32)` inside a
32-unit `#006100` frame. Prompt remains top-right and Agent remains
bottom-left. Those composition-level facts do not make the exact SVG bytes
equivalent: the glyph geometry and baselines intentionally change.

## Why the selected spec changes

The selected spec is exact registered protocol input, not a floating label.
Its bytes must describe the renderer actually used by the deployment.

Relative to r8, the r10 `THOUGHT.v2.md` changes only to:

- specify the canonical top-level
  `https://inshell.art/thought/<tokenId>` metadata URL and its non-identity
  semantics;
- replace the Humanist-era baseline values with `171.52` and `811.52`;
- bind the sealed Mono 76 centerline metrics, stroke treatment, packed-path
  behavior, and prohibition on runtime kerning/offset tables.

The stable `thoughtSpecId` still identifies the name `THOUGHT.v2.md`, but the
registered pair changes because exact bytes change:

- r8: 3,936 bytes, SHA-256
  `58c353a6283fdd3dbae4a212bb5470ffe3afaca8c592ad9aff2e97b855082e82`,
  `thoughtSpecHash`
  `0xc0661f522867afd109cfe28bcd3f28d04a849757de946879e0992718a72e6a61`;
- r10: 4,627 bytes, SHA-256
  `90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b`,
  `thoughtSpecHash`
  `0xb2b0a167678816a7ae9dc9098b0d6a6852c0dc95feb59f9581de75bd2cc2231f`.

The App must pin and register the exact r10 pair in disposable integration
deployments. It must not substitute the r8 hash under the same spec ID.

## Artwork compatibility impact

Artwork bytes intentionally change for identical prompt/Agent pairs. Baseline
fixture evidence includes:

| Work | r8 `metadata.image` SHA-256 | r10 `metadata.image` SHA-256 |
| --- | --- | --- |
| `THOUGHT WILL AWA` / `ABCDEFGHIJKLMNOPQRSTUVWXYZ` | `ee150047015acd3316fc44c89e38e87f2104ad423e3153da614a6b81d6409582` | `de87bce087663023390b6938241440234531ea468559b8b93c253eba499194d6` |
| `Can you count from 0 to 9?` / `0123456789.` | `70c82eb738440047593884d06dd755a3400b42b4ec72a1abce63d9544cd53fd1` | `a3be2c4027507967c5c010e66f322852ad25e0db2340f98dac3bffe676944467` |

The App must update image snapshots and visual expectations intentionally. It
must not require r8/r10 image-byte equality.

## Canonical external URL

Every r10 `tokenURI()` metadata object contains exactly one conventional
top-level field after `image` and before `background_color`:

```json
"external_url": "https://inshell.art/thought/<tokenId>"
```

The Contract renderer owns the exact bytes. `tokenId` is unsigned base-10
without leading zeroes. No trailing slash, query, fragment, alternate host,
localhost origin, LAN origin, preview origin, or caller-controlled base is
permitted.

The URL is presentation metadata only. It is not mint calldata and is not an
input to identity, uniqueness, provenance, Creation Attestation, selected-spec
validation, or PATH consumption.

## Deployment migration

Do not reuse the r8 Humanist renderer deployment or its three glyph pointers.
For the monolithic r10 path:

1. Read and verify the bundled exact
   `protocol/current/v2/renderer/mono-76.im76.bin` bytes.
2. Deploy those 4,600 bytes through the existing contract-code data-pointer
   mechanism. The resulting pointer has 4,601 runtime bytes including its
   leading storage sentinel.
3. Verify the stored payload Keccak-256 equals
   `0xba37d00bb395b84f0487791300a29cdd2b1712b078fa218c6ed74fa11d74a081`.
4. Deploy `ThoughtRendererV2(glyphDataPointer)`.
5. Verify renderer implementation ID, Mono package identity, packed hash,
   pointer readback, metadata profile ID, and
   `EXTERNAL_URL_BASE() == "https://inshell.art/thought/"`.
6. Register the exact r10 selected-spec bytes and verify ID/hash/readback.
7. Deploy `ThoughtNFTV2` with the new renderer address and the unchanged PATH,
   verifier, selected-spec registry, and protocol-registry interfaces.
8. Freeze the disposable PATH movement configuration through the existing
   deployment flow and mint fresh fixtures.

The optional split path deploys `ThoughtSvgRendererV2(glyphDataPointer)` and
then `ThoughtRendererV2Split(svgRendererAddress)`. Its exact `tokenURI()` bytes
must match the monolithic implementation. The split artifacts are included for
parity and architecture evaluation; they do not silently change the App's
chosen deployment topology.

## Contract surfaces unchanged from r8

The following compiled artifacts retain exact ABI, creation bytecode, and
runtime bytecode parity with r8:

- `ThoughtNFTV2`;
- `CreationAttestationVerifierV2`;
- `IThoughtRendererV2`;
- `ICreationAttestationVerifierV2`;
- `ThoughtSpecRegistry`;
- `ThoughtSpecRegistryV2`.

Therefore the following semantics remain unchanged:

- `ThoughtNFTV2.mint` ABI and typed mint records;
- Terminal English line validation and ordered-pair uniqueness;
- conversation identity and work hash domains;
- Agent/Model records and traits;
- provenance opaque-byte storage and hash commitment;
- Creation Attestation claim, digest, verification, and status;
- PATH authorization, atomic consumption, rollback, and widened serial storage;
- selected-spec registry and protocol-registry contract behavior.

The selected spec value supplied to mint changes, but the registry and mint
validation mechanisms do not.

## Fixture migration

r10 fixtures are freshly minted against the Mono renderer and current selected
spec. They include:

- token 1 and token 2 for direct r8-to-r10 visual comparisons;
- token 42 for canonical external-URL coverage;
- both `Unattested` and `Inshell THOUGHT App` Creation Attestation states;
- exact decoded metadata and original `tokenURI()` bytes;
- canonical Agent/Model traits and provenance payloads.

The App must replace r8 fixture snapshots rather than merge them as if the
renderer were unchanged.

## Required downstream checks

1. Verify the exact r10 manifest and all listed file checksums.
2. Verify `validation/r8-to-r10-cumulative-migration.json` against the pinned
   r8 artifact rather than trusting prose alone.
3. Require the disclosed r8 and r10 selected-spec hashes and renderer IDs.
4. Require the recorded renderer constructor migration.
5. Require exact unchanged bytecode parity for the NFT, verifier, and
   registries.
6. Require exact changed image hashes for the shared baseline fixtures.
7. Require exactly one top-level canonical `external_url` per fixture.
8. Redeploy a disposable Anvil runtime using the r10 topology.
9. Run App/contract boundary checks against the newly deployed runtime.
10. Advance the consumer lock only after this cumulative migration is
    explicitly accepted as a renderer/spec/artwork change.

## Safety label

r10 remains an explicitly noncanonical integration preview. It does not
authorize Sepolia/mainnet deployment, protocol registration, production signer
custody, or a stable consumer lock. The cumulative migration scope is accurate,
but production authorization remains a separate decision.

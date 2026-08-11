# THOUGHT V2 Humanist Smooth renderer integration handoff

Artifact ID: `thought-v2-noncanonical-integration-preview-20260725-r7`

Intended consumer: THOUGHT App owner in `/Users/bigu/Projects/inshell.art`

Classification: `experimental / noncanonical integration preview`

This revision supersedes r6 because r6 packages stale `ThoughtNFTV2`
bytecode whose local PATH interface declares `consumeUnit()` as returning
`uint256`. The renderer, THOUGHT App boundary, and public `ThoughtNFTV2` ABI
remain unchanged.

## Decision now implemented

The Contract workspace has adopted this current-V2 artwork configuration:

```text
renderer:           native SVG path glyphs
glyph family:       Humanist Smooth
glyph member ID:    inshell.thought.glyph-library.set-03.humanist-smooth
visual baseline:    5.58
fixed advance:      6 units
glyph scale:        4.8
wrapping:           greedy-space-then-fixed-cell-overlong-word
maximum columns:    29
maximum rows:       4
field alignment:    fixed prompt top / fixed Agent bottom

prompt field:       x 57.6, y 128, width 844.8, height 256
prompt field bottom: 384
prompt first baseline: 140.8

Agent field:        x 57.6, y 576, width 844.8, height 256
Agent field bottom: 832
Agent last baseline: 780.8

SVG artboard:       1024 × 1024
outer frame:        32 units per side, #006100
inner canvas:       960 × 960 at x=32, y=32
canvas scale:       1
canvas color:       #000000
glyph color:        #00ff00
```

The renderer is `ThoughtRendererV2`. It emits native `<path>` definitions and
`<use>` placements. It does not emit SVG `<text>`, `foreignObject`,
`@font-face`, an embedded WOFF/TTF, a system-font lookup, or a fallback font.

Humanist Smooth’s source bundle records a baseline-7 metric exception. THOUGHT
V2 now resolves that exception explicitly by adopting the family’s native
`5.58` visual baseline as the renderer metric contract. The canonical paths
are not translated, rescaled, clipped, repaired, or rewritten.

## Copy-paste kickoff for the inshell.art agent

```text
You are the THOUGHT App owner working only in:

  /Users/bigu/Projects/inshell.art

Integrate the Contract-owned THOUGHT V2 renderer update from:

  /Users/bigu/Projects/THOUGHT

Read these files first:

1. /Users/bigu/Projects/THOUGHT/docs/agent/IN_SHELL_ART_V2_NONCANONICAL_INTEGRATION_PREVIEW_HANDOFF.md
2. /Users/bigu/Projects/THOUGHT/protocol/current/v2/renderer/thought.renderer.v2.profile.json
3. /Users/bigu/Projects/THOUGHT/protocol/current/v2/integration/thought.app-contract-boundary.v1.md
4. /Users/bigu/Projects/THOUGHT/protocol/current/v2/integration/thought.app-contract-boundary.v1.json
5. /Users/bigu/Projects/THOUGHT/protocol/current/v2/metadata/thought.metadata.v2.profile.json
6. /Users/bigu/Projects/THOUGHT/protocol/current/v2/work/thought.work.v2.profile.json

Consume the immutable experimental artifact:

  artifact ID:
    thought-v2-noncanonical-integration-preview-20260725-r7
  pointer:
    artifacts/thought-v2-integration-preview/experimental.json

Run:

  npm run integration-preview:v2:check

Pin the exact artifact ID and manifest SHA-256 in an explicitly
non-production App integration lock. The mutable experimental.json file is
discovery-only.

Replace the previous ThoughtRendererV2DevSourceCodePro integration with the
compiled ThoughtRendererV2 ABI and bytecode from the artifact. Remove App
assumptions about fontPointer, fontKeccak256, Source Code Pro, foreignObject,
and rendererReleaseReady=false.

Add runtime checks for:

- IMPLEMENTATION_ID;
- GLYPH_LIBRARY_MEMBER_ID;
- glyphDefinitionsPointer1 and glyphDefinitionsPointer2 bytecode presence;
- glyphDefinitionsIndexPointer bytecode presence;
- glyphDefinitionsKeccak256;
- GLYPH_DEFINITIONS_INDEX_KECCAK256;
- RENDERER_ID and METADATA_PROFILE_ID compatibility;
- the release-ready renderer flag exposed in token metadata.

Display metadata.image exactly as returned by tokenURI(). Do not reconstruct
the SVG, recolor glyphs, add another frame, substitute a font, or apply
fallback text. The canonical image already contains the 1024 artboard,
32-unit #006100 frame, 960 black canvas and #00ff00 Humanist Smooth paths.
The prompt field packs rows downward from a fixed top, so its first glyph-row
baseline is always 140.8. The Agent field packs rows upward from a fixed
bottom, so its final glyph-row baseline is always 780.8. Do not vertically
center or independently reflow either field.

Keep the current App/Contract mint, provenance and Creation Attestation
boundary unchanged. Replace the r6 compiled `ThoughtNFTV2` bytecode with the
r7 artifact and redeploy disposable Anvil fixtures. The public
`ThoughtNFTV2` ABI is byte-for-byte unchanged. The App's existing canonical
PATH ABI already declares `consumeUnit()` as returning `uint32`, so no App
client change is required. This handoff does not authorize an App-side
contract refactor.

Run App tests against disposable Anvil and report:

1. updated immutable integration lock;
2. ABI/client changes;
3. runtime compatibility checks;
4. tokenURI image display evidence;
5. confirmation that no Source Code Pro or foreignObject renderer remains in
   the current-V2 App path;
6. confirmation that no production deployment, signer or key was added.
```

## Contract artifact changes

The integration preview includes:

- `ThoughtNFTV2`;
- `ThoughtRendererV2`;
- `IThoughtRendererV2`;
- `CreationAttestationVerifier`;
- `ThoughtSpecRegistry`;
- protocol-release registry `ThoughtSpecRegistryV2`;
- exact current-V2 protocol profiles and schemas;
- the renderer profile, its two exact SVG definition fragments, and its exact
  binary glyph-location index;
- current TypeScript provenance, work-profile and attestation references.

Relative to r6, `ThoughtNFTV2` now declares the canonical PATH dependency as:

```solidity
consumeUnit(uint256, bytes32, address, uint256, bytes)
    external
    returns (uint32);
```

The returned serial is widened into THOUGHT's existing `uint256` storage,
events, public getter, metadata and provenance-facing token facts. The
external `ThoughtNFTV2` ABI, mint behavior and token API do not change. A
boundary test covers `type(uint32).max`, and the reviewed runtime size is
17,252 bytes.

The two Humanist Smooth definition fragments and compact glyph-location index
are immutable code-storage payloads. `ThoughtRendererV2` accepts all three
pointer addresses in its constructor and fails closed unless their exact
compiled-in Keccak-256 hashes match. The renderer emits definitions only for
glyphs used by the two lines, avoiding the impractical cost of copying the
entire library into every SVG. It exposes all three pointers, the index hash,
and the combined complete-library definitions hash for consumer verification.

## What did not change

- `ThoughtNFTV2.mint` input shape;
- ordered prompt-plus-Agent uniqueness;
- Terminal English validation;
- selected-spec registry validation;
- PATH consumption behavior;
- exact provenance storage and hashing;
- Creation Attestation claim fields;
- Attested Agent/Model trait gate;
- metadata profile ID;
- renderer compatibility ID.

The implementation-specific renderer ID did change to
`inshell.thought.renderer.v2.humanist-smooth-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom`
so consumers fail closed instead of silently retaining the superseded
both-bottom alignment.

## Safety classification

This package remains an integration preview even though it now contains the
adopted native-path renderer. It is not a candidate or stable protocol
release. It is not approved for Sepolia, mainnet, protocol-registry
registration, production minting, or a production App lock.

No persistent deployment address, production authority, private key, mnemonic
or operator secret is included.

## Remaining release gates

- clean approved exact-byte protocol release manifest;
- final protocol registry registration authorization;
- reviewed production deployment parameters and owners;
- Sepolia/mainnet deployment rehearsal and review;
- stable artifact publication and immutable production consumer lock;
- production THOUGHT App rollout.

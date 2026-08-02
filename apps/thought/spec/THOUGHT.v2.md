# THOUGHT.v2.md

Version: v2
Status: implementation candidate

## THOUGHT

THOUGHT is the narrow terminal channel where a human and an Agent meet. One
exact human prompt and one exact Agent response form a work. The composition
uses the visual language of the primitive computer age: a black field, green
terminal glyphs, the prompt at the upper right, and the Agent response at the
lower left.

The shared language is Terminal English. This is not a claim that English is
the only human language. It is the deliberately narrow bridge used by this
work between human and Agent: a small public character repertoire that can be
validated, rendered, preserved, and explained without hidden normalization or
platform-dependent fallback.

`promptLine` and `agentLine` are each exact 1-through-64-byte US-ASCII strings.
Their closed 76-character repertoire is space, `A-Z`, `a-z`, `0-9`, and
`.,?!:;'"-()/&`. Outer spaces and repeated internal spaces are invalid.
Punctuation-only lines are valid. Accepted input is never trimmed, collapsed,
normalized, case-folded, translated, clipped, repaired, or rewritten.

The exact ordered `(promptLine, agentLine)` pair is globally unique. Either
line may appear again with a different counterpart. Reversing the pair forms
a different identity. Conversation identity and work hash commit to both exact
line hashes in order. The work hash also commits to the renderer identity.

`agent` and `model` are exact 1-through-64-byte visible UTF-8 neutral records.
They are typed contract state, map to canonical provenance data, and are
creation-attestation hash inputs. Every token publishes them as `Agent` and
`Model` marketplace traits; attestation status is represented separately.
They do not affect conversation identity, work hash, or the artwork.

Every mint selects an exact registered THOUGHT specification ID/hash pair and
an exact registered protocol release. Multiple registered specification
versions may coexist and remain mintable. There is no contract-level latest or
active specification gate.

Every minted token's canonical ERC-721 metadata includes the top-level
`external_url` value `https://inshell.art/thought/<tokenId>`, where `tokenId`
is unsigned base-10 without leading zeroes. The Contract renderer owns these
exact bytes. The URL is presentation metadata only and is not an input to
conversation identity, work hash, uniqueness, provenance, Creation
Attestation, or PATH consumption.

Before minting, a producer builds one closed `inshell.thought.provenance.v2`
creation record, serializes it as RFC 8785 JCS, verifies its schema,
commitments, typed-state parity, and selected-spec parity, and supplies those
exact bytes. Solidity stores and hashes the bounded bytes opaquely; it does not
parse or construct provenance JSON.

An empty creation-attestation proof produces `Unattested`. A valid
`inshell.thought.creation-workflow-attestation.v2` proof shows that an
authorized signer bound the exact collection, release, selected spec, work,
provenance hash, Agent/Model record hashes, public run reference, minter, deadline,
and authority epoch. It does not independently prove the truth of the Agent or
model records.

Minting consumes exactly one PATH `THOUGHT` movement unit atomically. A failed
mint must not consume PATH, reserve the ordered pair, or increment supply.

The current final renderer identity is
`inshell.thought.svg.v2.terminal-chat-path-glyphs`. Its canonical implementation
uses a 1024-by-1024 SVG artboard. A 32-unit `#006100` outer frame surrounds
an unchanged 960-by-960 black canvas translated to `(32,32)` with no scaling.
Prompt and Agent coordinates remain in that 960-unit canvas coordinate system.
The prompt occupies a fixed 844.8-by-256 field at `(57.6,128)` and the Agent
response occupies an equal field at `(57.6,576)`. The prompt field is top
aligned and its first glyph-row baseline is always `171.52`; the Agent field is
bottom aligned and its final glyph-row baseline is always `811.52`, regardless
of wrapped row count. Additional prompt rows grow downward; additional Agent
rows grow upward.
The implementation uses the sealed Inshell Mono 76 v1.0.0 centerline SVG
paths with deterministic metrics and wrapping: no fill, 1.23-unit strokes,
round caps and joins, fixed 10-unit advance at 2.88 scale, a 12-unit SVG
baseline, and a global +1 glyph-origin shift. Reviewed optical translations
are baked into the path bytes; no runtime kerning or second offset table is
permitted.
Source Code Pro, SVG text, `foreignObject`, browser font lookup, and font files
are study tools only and are not release-ready renderer dependencies.

# Mono 76

> Mono 76 is Inshell's sealed native-SVG type system for deterministic artwork text.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/mono-76
- Documentation version: 2026-08-12
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## From glyph study to canonical artwork

- Authority: artist-editorial, app-documentation, contract-release
- Figure ID: mono-76.canonical-artwork
- Figure mode: trace
- Semantic form: trace
- Semantic nodes:
  - `glyph-study [action]: Glyph study — Explore · refine`
  - `sealed-mono [state]: Sealed Mono 76 — Paths + metrics frozen`
  - `canonical-artwork [result]: Canonical artwork — Native SVG`
- Semantic edges:
  - `study-to-seal: glyph-study (Glyph study) --[→ / ↓ · Glyph study is refined into the sealed Mono 76 source.]--> sealed-mono (Sealed Mono 76)`
  - `seal-to-artwork: sealed-mono (Sealed Mono 76) --[→ / ↓ · The sealed paths and metrics produce the canonical native SVG artwork.]--> canonical-artwork (Canonical artwork)`
- Semantic groups:
  - `mono-phases [phase]: From study through sealed source to canonical artwork. [members: glyph-study (Glyph study) · sealed-mono (Sealed Mono 76) · canonical-artwork (Canonical artwork)]`

```text
GLYPH STUDY
Explore · refine
      ↓
SEALED MONO 76
Paths + metrics frozen
      ↓
CANONICAL ARTWORK
Native SVG
```

1. **Glyph study** — Explore · refine
2. **Sealed Mono 76** — Paths + metrics frozen
3. **Canonical artwork** — Native SVG

## Overview

- Authority: artist-editorial, app-documentation, contract-release

Mono 76 gives selected Inshell works a fixed visual alphabet. Version 1.0.0 contains 76 ordered records: 75 visible glyphs and one metrics-only SPACE. Every visible glyph is an independently authored centerline SVG path with shared monospaced metrics.

The sealed face emerged from a larger native-SVG glyph study. That research compared many construction systems for legibility, identity, punctuation, marketplace-scale resilience, deterministic rendering, and practical contract size. The released face came from the C02 Classic Book study, then received manual refinement and optical alignment before its paths and metrics were frozen.

Mono 76 is not the site's general interface font. Interface copy remains ordinary selectable text. Mono 76 is used where the letterform is part of the artwork or its deterministic renderer, including the current THOUGHT composition and the movement names drawn inside PATH tokens.

A renderer consumes path geometry rather than asking a browser to locate a font. This keeps the visible form independent of installed fonts, webfont loading, marketplace font support, and platform-specific text layout.

## A closed repertoire

- Authority: app-documentation, contract-release

The ordered repertoire is SPACE, A-Z, a-z, 0-9, and . , ? ! : ; ' " - ( ) / &. SPACE advances by the same fixed width as every other record but draws no path. Unsupported characters fail validation instead of being replaced by a fallback glyph.

THOUGHT uses the same character repertoire for its Terminal English lines. Its additional byte and spacing rules belong to the THOUGHT specification; Mono 76 defines glyph support and geometry, not the whole creation protocol.

## Centerlines, not font outlines

- Authority: artist-editorial, contract-release

The released face uses open centerline paths: no fill, a fixed round stroke, round caps and joins, fixed advance, no kerning, and one declared origin shift. Reviewed optical adjustments are baked into the path bytes so a renderer does not apply a second hidden tuning table.

Source Code Pro was a visible comparison reference during study. Its outlines were neither imported nor traced into Mono 76 v1.0.0. The earlier outline-reference release is a separate historical artifact with different geometry and licensing; it is not the current face.

## Native SVG is the delivery form

- Authority: app-documentation, contract-release

Mono 76 is packaged as path data and a deterministic renderer, not as a WOFF or TTF webfont. Artwork renderers place the paths directly into SVG and must preserve the sealed metrics and stroke contract.

THOUGHT consumes the packed IM76 repertoire for its terminal composition. PATH embeds only the nine Mono 76 glyph paths needed to draw THOUGHT, WILL, and AWA. Each token image is therefore self-contained; viewing it does not require a font installation or an offchain text renderer.

## Artwork and interface stay distinct

- Authority: artist-editorial, app-documentation

The App does not register Mono 76 with CSS or replace ordinary interface typography with it. Navigation, documentation, forms, status messages, and accessibility text remain browser-readable interface copy. Mono 76 appears when the glyph shape itself belongs to a work or to the work's canonical visual system.

## Pins prevent visual drift

- Authority: app-documentation, contract-release

The sealed package includes the ordered face, packed onchain payload, renderer code, manifest, provenance, verification script, notices, and checksums. A downstream release must consume that complete contract and pin its hashes rather than copying one convenient glyph file.

THOUGHT and PATH pin Mono 76 through their own contract releases. Updating the font repository does not change a pinned renderer or an already deployed contract. A new visual revision requires a new reviewed release and explicit downstream repinning; the App must continue reading canonical token artwork rather than silently redrawing it with newer paths.


## Links

- [read THOUGHT](https://inshell.art/docs/thought)
- [read PATH](https://inshell.art/docs/path)
- [read artwork, metadata, and chain](https://inshell.art/docs/artwork-metadata-chain)
- [read source and release boundaries](https://inshell.art/docs/source-release-boundaries)

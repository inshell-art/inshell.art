# Inshell Mono 76 provenance

## Released font

Inshell Mono 76 v1.0.0 contains 76 independently authored centerline SVG
records: metrics-only SPACE, 52 letters, ten digits, and 13 punctuation marks.
The paths originated in the C02 Classic Book study and were manually refined,
optically aligned, and sealed as Mono 76.

The authoritative design inputs are:

- `experiments/set5-c02-vs-mono/manual-edits/classic-book-76-v21.json`
- optical alignment revision `c02-stroke-aware-optical-alignment-v20`
- manual tuning revision `c02-manual-control-point-tuning-v21-20260731`
- release builder `src/build-release.mjs`

The release manifest records the source payload hashes and final artifact
hashes.

## Source Code Pro boundary

Source Code Pro Regular was used in the lab as a visible comparison reference
for proportions, rhythm, and optical judgment. No Source Code Pro outline was
imported or traced into the released centerline path data.

The earlier repository tag `v0.1.0` is different: it contains a restricted,
format-converted Source Code Pro outline subset governed by the SIL Open Font
License 1.1. That release is preserved under
`legacy/source-code-pro-outline-v0.1.0/` for reproducibility and comparison;
it is not part of the current font package.

## Ownership

Inshell owns the v1.0.0 SVG centerline paths, repertoire contract, package
code, renderer, IM76 packaging, verification system, and documentation,
subject to any rights that applicable law does not permit a party to claim in
an abstract typeface style or common typographic convention.

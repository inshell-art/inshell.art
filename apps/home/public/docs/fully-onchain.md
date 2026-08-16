# Fully Onchain

> Inshell keeps a work's canonical image and metadata with its onchain record so the work does not depend on a website or media host.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation, contract-release
- Canonical page: https://inshell.art/docs/fully-onchain
- Documentation version: 2026-08-16
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: app-documentation, contract-release

A token should not outlive the artwork it names. If the image lives only on a website, marketplace, or media host, the token can remain while its public form disappears or changes.

For Inshell, the visible form is part of the work. Fully onchain keeps the token record, metadata, and canonical artwork together. A site, wallet, explorer, or marketplace may show the work, but it is a reading surface, not its origin.

Technically, the contract system can return the complete metadata and artwork from code, state, and data on the selected chain without fetching an external content object. ERC-721 alone does not guarantee this: tokenURI may still point elsewhere.

## Why Inshell uses it

- Authority: app-documentation, contract-release

The aim is continuity, not a storage badge. The exact public form should remain available wherever the chain can be read, even when Inshell changes its site or a marketplace changes how it presents the work.

This also lets an onchain work respond to onchain state without replacing its image through a separate media service. Different reading surfaces can render the same canonical result from the same public record.

- The canonical image stays with the record that identifies it.
- No single website or marketplace has custody of the work's continued visibility.
- A changing work can derive its form from public onchain state rather than swapped offchain images.

## Why SVG

- Authority: app-documentation, contract-release

SVG is both an image and a description of an image. Its raw source is human-readable: it names shapes, paths, positions, and fills as text instead of hiding the form inside opaque machine code. A person can inspect the description; a machine can render the same description.

That makes SVG a natural layer between human intention and machine action, an area of interest for Inshell. The human can author and read a structure while the renderer can carry it out without translating the work into a separate, inaccessible format.

SVG is also vector-based: it stays clear at different scales, remains compact, and can be assembled deterministically from onchain state. A contract can embed the completed SVG inside token metadata, so the canonical image needs no image server. When letterforms are included as paths, it needs no webfont either.

## How Inshell does it

- Authority: app-documentation, contract-release

The pinned [$PATH](https://inshell.art/docs/path) v0.5.0 renderer reads movement progress from contract state and draws the nine required Mono 76 glyph paths held in contract code. Its tokenURI returns self-contained JSON with the SVG embedded inside it.

The portable [THOUGHT](https://inshell.art/docs/thought) V2 design stores the work record, binds its renderer and specification, and constructs its SVG from glyph data held in onchain code storage. Its qualified release proves the design and package, not a live deployment. The [release and deployment boundary](https://inshell.art/docs/source-release-boundaries) keeps those claims separate.

### $PATH SVG example

```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600' role='img' aria-label='PATH movement progress' data-renderer='path-text-status' data-rendering='native-svg-paths' data-progress-model='text' data-family='Inshell Mono 76' data-face='Inshell Mono 76 Regular' data-weight='400' data-release-commit='6fefbfaf762dce0148fe275baafb8e7dd2077beb' data-manifest-sha256='14d734495a8bdc99a98fecbc4f9d76d315c9e2b9fc9b032d5a1fda567258ce11' data-glyph-json-sha256='2cf76834f82050853bdcc9d25bc4f040bd7cc2a6a310206e166f6d162e4f0c2e' data-glyph-slice-sha256='8f484b8c50307139630fab8c0289c0a6a642fa1aee5fb31ebd8966f574b02060' data-center-x='300' data-center-y='300'>
<rect width='600' height='600' fill='#000000'/>
<defs>
<path id='g-T' d='M258 0L258 586L42 586L42 656L558 656L558 586L342 586L342 0Z'/>
<path id='g-H' d='M79 0L79 656L163 656L163 381L437 381L437 656L521 656L521 0L437 0L437 309L163 309L163 0Z'/>
<path id='g-O' d='M300 -12Q226 -12 169 29Q112 70 80 146.5Q48 223 48 331Q48 437 80 512.5Q112 588 169 628Q226 668 300 668Q374 668 431 628Q488 588 520 512.5Q552 437 552 331Q552 223 520 146.5Q488 70 431 29Q374 -12 300 -12ZM300 61Q375 61 420.5 133Q466 205 466 331Q466 455 420.5 525Q375 595 300 595Q225 595 179.5 525Q134 455 134 331Q134 205 179.5 133Q225 61 300 61Z'/>
<path id='g-U' d='M301 -12Q237 -12 186.5 14Q136 40 107.5 97Q79 154 79 248L79 656L163 656L163 246Q163 178 181 137.5Q199 97 230.5 79Q262 61 301 61Q341 61 372 79Q403 97 421.5 137.5Q440 178 440 246L440 656L521 656L521 248Q521 154 492.5 97Q464 40 414.5 14Q365 -12 301 -12Z'/>
<path id='g-G' d='M337 -12Q255 -12 190.5 28.5Q126 69 89.5 145Q53 221 53 328Q53 434 90.5 510Q128 586 193.5 627Q259 668 344 668Q409 668 453 642.5Q497 617 525 588L478 535Q454 561 422.5 578Q391 595 344 595Q283 595 237 562.5Q191 530 165.5 471Q140 412 140 330Q140 206 192.5 133.5Q245 61 342 61Q415 61 456 100L456 271L325 271L325 340L533 340L533 64Q502 33 451.5 10.5Q401 -12 337 -12Z'/>
<path id='g-W' d='M110 0L10 657L104 657L152 245Q155 218 157.5 195.5Q160 173 162 149.5Q164 126 165 93L168 93Q174 126 179 149.5Q184 173 189 195Q194 217 200 244L264 488L344 488L406 244Q413 217 418 195Q423 173 427.5 149.5Q432 126 438 93L442 93Q444 126 445.5 149.5Q447 173 449 195Q451 217 454 244L500 657L590 657L494 0L390 0L326 264Q319 294 313 323Q307 352 302 382L299 382Q294 352 289 323Q284 294 276 264L212 0Z'/>
<path id='g-I' d='M95 0L95 71L258 71L258 586L95 586L95 656L505 656L505 586L342 586L342 71L505 71L505 0Z'/>
<path id='g-L' d='M134 0L134 656L216 656L216 71L541 71L541 0Z'/>
<path id='g-A' d='M232 367L201 267L397 267L366 367Q349 422 332.5 476.5Q316 531 301 588L297 588Q281 531 265 476.5Q249 422 232 367ZM32 0L253 656L347 656L568 0L480 0L418 200L180 200L117 0Z'/>
<clipPath id='path-progress' clipPathUnits='userSpaceOnUse'>
<rect id='thought-progress' x='0' y='-240' width='4200' height='1000'/>
<rect id='will-progress' x='4800' y='-240' width='1200' height='1000'/>
<rect id='awa-progress' x='7800' y='-240' width='0' height='1000'/>
</clipPath>
</defs>
<g id='path-title' data-text-layout='centered-group' fill-rule='nonzero' transform='translate(92.64 311.232) scale(0.0432 -0.0432)'>
<g id='remaining' data-status-layer='remaining' fill='#ffffff'>
<use href='#g-T'/>
<use href='#g-H' x='600'/>
<use href='#g-O' x='1200'/>
<use href='#g-U' x='1800'/>
<use href='#g-G' x='2400'/>
<use href='#g-H' x='3000'/>
<use href='#g-T' x='3600'/>
<use href='#g-W' x='4800'/>
<use href='#g-I' x='5400'/>
<use href='#g-L' x='6000'/>
<use href='#g-L' x='6600'/>
<use href='#g-A' x='7800'/>
<use href='#g-W' x='8400'/>
<use href='#g-A' x='9000'/>
</g>
<g id='consumed' data-status-layer='consumed' fill='#006100' clip-path='url(#path-progress)'>
<use href='#g-T'/>
<use href='#g-H' x='600'/>
<use href='#g-O' x='1200'/>
<use href='#g-U' x='1800'/>
<use href='#g-G' x='2400'/>
<use href='#g-H' x='3000'/>
<use href='#g-T' x='3600'/>
<use href='#g-W' x='4800'/>
<use href='#g-I' x='5400'/>
<use href='#g-L' x='6000'/>
<use href='#g-L' x='6600'/>
<use href='#g-A' x='7800'/>
<use href='#g-W' x='8400'/>
<use href='#g-A' x='9000'/>
</g>
</g>
</svg>
```

### THOUGHT SVG example

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" data-renderer="inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom" data-glyph-library-member="inshell.mono-76" data-glyph-format="IM76-v1" data-glyph-release="v1.0.0" data-glyph-svg-baseline="12" data-glyph-scale="2.88" data-glyph-origin-shift-x="1" data-wrap="greedy-space-then-fixed-cell-overlong-word" data-prompt-vertical-align="top" data-agent-vertical-align="bottom" aria-label="Prompt and Agent response in a terminal chat layout">
<rect id="work-frame" width="1024" height="1024" fill="#006100"/>
<g id="work-canvas" transform="translate(32 32)">
<rect id="canvas-bg" width="960" height="960" fill="#000000"/>
<defs>
<path id="g54" d="M.5 9.9L7.5 9.9M4 9.9L4 .6"/>
<path id="g57" d="M0 9.9L2 .6L4 7.2L6 .6L8 9.9"/>
<path id="g61" d="M1.4 6.5Q2.9 7.5 4.45 7.6Q6.75 7.65 7 5.35L7 .3M6.95 4.65L3 4Q1.55 3.65 1.3 2.4Q1.3 .3 3.95 .45Q6 .5 6.95 2.2"/>
<path id="g62" d="M1.3 .6L1.3 10.8M1.3 5.3Q2.3 7.35 4.4 7.4Q7.1 7.4 7.2 4Q7.2 .4 4.15 .4Q2.3 .4 1.3 2.1"/>
<path id="g63" d="M6.9 6.3Q5.9 7.4 4 7.4Q1.2 7.4 1.1 3.9Q1.25 .45 4 .4Q5.8 .6 6.9 1.2"/>
<path id="g64" d="M6.7 .6L6.7 10.8M6.7 5.3Q5.8 7.35 3.7 7.4Q.9 7.4 .8 3.9Q.9 .4 3.8 .4Q5.8 .4 6.7 2.1"/>
<path id="g65" d="M1.2 4L6.9 4Q6.8 7.4 4.1 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q5.75 .45 6.9 1.2"/>
<path id="g66" d="M3.6 .3L3.65 8.45Q3.65 10.95 5.85 10.95Q6.8 10.95 7.8 10.6M1.4 7.25L7.05 7.25"/>
<path id="g68" d="M1.25 .4L1.3 10.8M1.3 5.3Q2.3 7.35 4.3 7.4Q7.1 7.4 7.2 4L7.15 .35"/>
<path id="g69" d="M1.3 7.25L5 7.25M5 7.25L5 .35M5 10.35L5.4 10.75L5 11.15L4.6 10.75Z"/>
<path id="g6b" d="M1.25 .35L1.25 10.8M7 7.7L1.85 3M4.05 4.35L7.25 .4"/>
<path id="g6c" d="M1.1 10.8L3.5 10.8L3.5 2Q3.5 .4 5.5 .4Q6.7 .4 7.5 1.2"/>
<path id="g6e" d="M1.25 .35L1.3 7.4M1.3 5.2Q2.4 7.35 4.4 7.4Q7.3 7.4 7.3 4L7.3 .35"/>
<path id="g6f" d="M4 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q7 .4 7 3.9Q7 7.4 4 7.4Z"/>
<path id="g72" d="M2.05 .25L2.1 7.4M2.1 4.7Q3.7 7.1 5.4 7.35Q6.45 7.5 7.1 7.15"/>
<path id="g73" d="M7 6.3Q5.9 7.4 4 7.4Q1.3 7.4 1.3 5.7Q1.3 4.4 4 3.9Q7 3.4 7 2Q7 .4 4.1 .4Q2.2 .4 1.1 1.4"/>
<path id="g74" d="M3.25 9.65L3.25 2Q3.25 .4 5.25 .4Q6.45 .4 7.25 1.2M.65 7.25L6.75 7.25"/>
<path id="g75" d="M.75 7.2L.75 3Q.75 .4 3.75 .4Q6.75 .4 6.75 3L6.75 7.2M6.75 .6L6.75 2.2"/>
<path id="g76" d="M1 7.2L3.9 .15L7 7.2"/>
<path id="g78" d="M1 7.2L6.8 .1M7 7.2L1 .05"/>
<path id="g79" d="M.8 7.2L3.8 .4M6.8 7.2L2.8 -2.7"/>
<path id="g2e" d="M4 .15L4 1.9"/>
<path id="g3f" d="M1.7 8.8Q2.5 10.3 4 10.3Q6.2 10.3 6.2 8.2Q6.2 6.8 4.1 5.5L4.1 4.3M3.95 .15L4 1.9"/>
</defs>
<g id="prompt-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="What if the future stays unclear?" data-rows="2" data-field-x="57.6" data-field-y="128" data-field-width="844.8" data-field-height="256" data-field-bottom="384" data-horizontal-align="right" data-vertical-align="top">
<g transform="translate(214.08 171.52) scale(2.88 -2.88)">
<use href="#g57"/>
<use href="#g68" x="10"/>
<use href="#g61" x="20"/>
<use href="#g74" x="30"/>
<use href="#g69" x="50"/>
<use href="#g66" x="60"/>
<use href="#g74" x="80"/>
<use href="#g68" x="90"/>
<use href="#g65" x="100"/>
<use href="#g66" x="120"/>
<use href="#g75" x="130"/>
<use href="#g74" x="140"/>
<use href="#g75" x="150"/>
<use href="#g72" x="160"/>
<use href="#g65" x="170"/>
<use href="#g73" x="190"/>
<use href="#g74" x="200"/>
<use href="#g61" x="210"/>
<use href="#g79" x="220"/>
<use href="#g73" x="230"/>
</g>
<g transform="translate(674.88 235.52) scale(2.88 -2.88)">
<use href="#g75"/>
<use href="#g6e" x="10"/>
<use href="#g63" x="20"/>
<use href="#g6c" x="30"/>
<use href="#g65" x="40"/>
<use href="#g61" x="50"/>
<use href="#g72" x="60"/>
<use href="#g3f" x="70"/>
</g>
</g>
<g id="agent-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="Then choose the next visible kindness." data-rows="2" data-field-x="57.6" data-field-y="576" data-field-width="844.8" data-field-height="256" data-field-bottom="832" data-horizontal-align="left" data-vertical-align="bottom">
<g transform="translate(60.48 747.52) scale(2.88 -2.88)">
<use href="#g54"/>
<use href="#g68" x="10"/>
<use href="#g65" x="20"/>
<use href="#g6e" x="30"/>
<use href="#g63" x="50"/>
<use href="#g68" x="60"/>
<use href="#g6f" x="70"/>
<use href="#g6f" x="80"/>
<use href="#g73" x="90"/>
<use href="#g65" x="100"/>
<use href="#g74" x="120"/>
<use href="#g68" x="130"/>
<use href="#g65" x="140"/>
<use href="#g6e" x="160"/>
<use href="#g65" x="170"/>
<use href="#g78" x="180"/>
<use href="#g74" x="190"/>
<use href="#g76" x="210"/>
<use href="#g69" x="220"/>
<use href="#g73" x="230"/>
<use href="#g69" x="240"/>
<use href="#g62" x="250"/>
<use href="#g6c" x="260"/>
<use href="#g65" x="270"/>
</g>
<g transform="translate(60.48 811.52) scale(2.88 -2.88)">
<use href="#g6b"/>
<use href="#g69" x="10"/>
<use href="#g6e" x="20"/>
<use href="#g64" x="30"/>
<use href="#g6e" x="40"/>
<use href="#g65" x="50"/>
<use href="#g73" x="60"/>
<use href="#g73" x="70"/>
<use href="#g2e" x="80"/>
</g>
</g>
</g>
</svg>
```

## What the claim covers

- Authority: app-documentation, contract-release

Fully onchain says where the canonical metadata and artwork come from. It does not replace the identity, provenance, attestation, release, or observation boundaries described in [artwork, metadata, and chain](https://inshell.art/docs/artwork-metadata-chain).

- It does not by itself mean immutable, non-upgradeable, decentralized, verified, attested, or true.
- A repository and release make construction auditable; they are not runtime content hosts.
- No storage method proves authorship, Agent reasoning, artistic meaning, or the inward truth of a work.


## Links

- [read ERC-721 metadata](https://eips.ethereum.org/EIPS/eip-721)
- [read $PATH](https://inshell.art/docs/path)
- [read THOUGHT](https://inshell.art/docs/thought)
- [read source and release boundaries](https://inshell.art/docs/source-release-boundaries)
- [view $PATH source](https://github.com/inshell-art/path)
- [view THOUGHT source](https://github.com/inshell-art/THOUGHT)

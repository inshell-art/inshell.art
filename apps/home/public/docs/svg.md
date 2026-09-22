# SVG

> SVG is a text document that describes shapes, which is why a person, a browser, a contract, and an Agent can all read the same artwork.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/svg
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial

Most image formats are containers of pixels. SVG is a document that describes shapes. Inshell treats that difference as the reason to use it as a material rather than as an export format.

## A public document format

- Authority: artist-editorial

The W3C began work on SVG in 1998. SVG 1.0 became a Recommendation on 4 September 2001 and SVG 1.1 on 14 January 2003; SVG 2 has remained at Candidate Recommendation. The format is XML, which means an SVG file is text and the text is the picture.

Because it is a public standard with several independent implementations, an SVG stays readable without any one vendor's software remaining in business. That property matters more for a work meant to last than any particular rendering feature does.

## Four kinds of reader

- Authority: artist-editorial

A person can read an SVG and follow what it draws. A browser can render it. A contract can assemble it from strings and return it. An Agent can inspect it, locate a specific element, and change that element without disturbing the rest.

Few materials are legible to all four. SVG does not create an Agent's thinking power; it gives that power a literal architecture to interpret and act through. That overlap lets one file carry human intention, [aesthetic architecture](https://inshell.art/docs/glossary#docs-glossary-aesthetic-architecture), Agent interpretation, machine action, and public preservation at once, which is the argument made in full under [Fully Onchain](https://inshell.art/docs/fully-onchain#docs-fully-onchain-agent-art).

## Bytes are the constraint

- Authority: artist-editorial

Onchain, size is not a preference but a price. A vector description of a detailed image can occupy a few kilobytes where a raster of the same image would be far larger, and on [Ethereum](https://inshell.art/docs/ethereum) that difference is paid in gas at mint and stored forever.

SVG is unusual in making the compact option and the readable option the same option. Compression that produced smaller but unreadable bytes would lose the property the material was chosen for.

## How Inshell narrows it

- Authority: artist-editorial

Inshell uses raw, plain, descriptive SVG and carries letterforms as path geometry rather than as webfont references, so a work depends on nothing outside its own bytes. [Mono 76](https://inshell.art/docs/mono-76) is the sealed type system that makes text in artwork behave that way.

This is a material choice inside one practice. SVG is not required for fully onchain work, and it is not required for Agent Art as a field.

## Evidence boundary

- Authority: artist-editorial

Specification names and dates are public W3C facts and are cited as orientation. How Inshell actually builds and pins its SVG is described under Fully Onchain and Mono 76, which carry contract-release authority; this topic carries none.


## Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [read Ethereum](https://inshell.art/docs/ethereum)
- [SVG 1.1 specification](https://www.w3.org/TR/SVG11/)

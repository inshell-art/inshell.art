# Onchain Art

> Onchain is a spectrum, and the useful question is which part of a work the chain actually holds.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/onchain-art
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial

Calling a work onchain says little on its own. A chain can hold the ownership record, the generating rule, the finished image, or only a hash of something kept elsewhere. These are different claims with different consequences.

## Degrees of onchain

- Authority: artist-editorial

Four arrangements are common. The record is onchain and the artwork sits at a web address. The record is onchain and the artwork is content-addressed offchain. The rule is onchain and the image is derived by re-running it. Or the image bytes are assembled onchain and returned directly.

Only the last two survive the disappearance of every host. The first two describe where a work is filed rather than where it lives.

## Public precedents

- Authority: artist-editorial

Autoglyphs, released by Larva Labs in 2019 as a set of 512, embedded its generator in the contract so the network itself ran the code that produced each work, and the generator stopped once the supply was reached.

Art Blocks, from late 2020, keeps the generating script in a contract and takes each token's seed from its mint transaction. Projects including Blitmap, Nouns, and Chain Runners store vector or pixel assets in contract storage and assemble the image when metadata is requested; several released their work under CC0, treating the onchain asset as something others are free to extend.

## Where Inshell sits

- Authority: artist-editorial

Inshell assembles the completed SVG inside the contract and returns it in token metadata, so the canonical image needs no image server and no webfont. The full account, including what the arrangement does not cover, is under [Fully Onchain](https://inshell.art/docs/fully-onchain).

Inshell also keeps the claim narrow. Fully onchain is a statement about chain sufficiency for specific content. It is not a synonym for immutable, non-upgradeable, decentralized, deployed, verified, or good, and each of those would need its own evidence.

## Evidence boundary

- Authority: artist-editorial

Other projects are named as public reference points. Inshell has not audited their contracts, does not verify their present behaviour, and claims no affiliation with them. Descriptions refer to publicly documented designs, and designs change after they are documented.

> Do not read a project's presence in this list as endorsement, comparison of quality, or a claim about its current state.


## Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Generative Art](https://inshell.art/docs/generative-art)
- [read Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts)
- [Autoglyphs](https://www.larvalabs.com/autoglyphs)

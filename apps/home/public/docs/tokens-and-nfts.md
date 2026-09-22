# Tokens and NFTs

> A token is a record that names a work; most tokens only point at one, and pointers decay.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/tokens-and-nfts
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial

ERC-721 gave Ethereum a standard way to say that a particular token is one of a kind and belongs to a particular address. It was proposed by William Entriken, Dieter Shirley, Jacob Evans, and Nastassia Sachs in January 2018, and it is why a token can be transferred, sold, and read consistently across wallets, explorers, and marketplaces.

What the standard does not do is hold the artwork.

## The metadata function is a pointer

- Authority: artist-editorial

The standard's metadata extension returns a URI for each token. In common practice that URI addresses a JSON document on a web server or through an IPFS gateway, and the JSON in turn addresses an image somewhere else again.

Ownership is onchain. The picture usually is not. A token can be perfectly valid, perfectly transferable, and show nothing at all.

## Pointers decay

- Authority: artist-editorial

Published surveys of large NFT samples have repeatedly found substantial fractions with token URIs that no longer resolve, image paths that are broken, or IPFS content unreachable through the gateway named in the record. Reported figures have run to roughly a fifth of the sampled tokens.

Collections have also lost their images when a company changed access rules on the servers holding them, leaving holders with valid tokens and no picture. In most cases this is not fraud. It is ordinary infrastructure entropy applied to a record that was supposed to outlast infrastructure.

## What Inshell takes and refuses

- Authority: artist-editorial

Inshell uses the token standard for what it does well: a public, transferable, consistently readable record of which work is which and which address holds it.

Inshell refuses the pointer. The canonical image and metadata are returned by the contract itself, so no host stands between the record and the work. [Fully Onchain](https://inshell.art/docs/fully-onchain) states that arrangement and its limits precisely.

This is a choice about where a work lives. It is not a claim that pointer-based tokens are not art, and not a claim that Inshell's arrangement is safe from every failure.

## Evidence boundary

- Authority: artist-editorial

Survey percentages come from third-party studies of particular samples at particular times and are cited as orders of magnitude, not current measurements. Inshell has not reproduced them and does not name the collections involved. Claims about Inshell's own tokens belong to [Artwork, Metadata, and Chain](https://inshell.art/docs/artwork-metadata-chain) and [Verification](https://inshell.art/docs/verification).


## Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Artwork, Metadata, and Chain](https://inshell.art/docs/artwork-metadata-chain)
- [read Onchain Art](https://inshell.art/docs/onchain-art)
- [ERC-721 standard](https://eips.ethereum.org/EIPS/eip-721)

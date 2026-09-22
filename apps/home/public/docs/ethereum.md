# Ethereum

> The chain is a deterministic public machine with a price on every byte, and that price is a formal constraint rather than an inconvenience.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/ethereum
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial

Ethereum gives an artwork three unusual properties: a public machine that anyone can re-run and get the same answer, a record no single party can quietly revise, and a price on every byte stored.

The third property is the one that shapes form.

## A deterministic public machine

- Authority: artist-editorial

The Ethereum Virtual Machine executes contract code identically on every node that runs it. A function that assembles an image returns the same bytes to everyone who calls it against the same state, without a server deciding what to send.

That determinism is what allows a contract to act as a renderer rather than only as a ledger. The artwork is not a file the contract points at; it can be a value the contract computes.

## Every byte has a price

- Authority: artist-editorial

Contract storage is charged per 32-byte word, and writing a fresh word costs on the order of twenty thousand gas, which puts a kilobyte of stored data on the order of hundreds of thousands of gas. Practitioners reduce this with techniques such as packing, contract-bytecode storage, and libraries in the SSTORE2 family, but the cost never becomes negligible.

Onchain artwork is therefore written under a budget. Compactness is not a stylistic preference; it is the condition of existing onchain at all.

## The budget is a bound

- Authority: artist-editorial

Inshell already holds that bounds create form, and the price of a byte is one of those bounds. It rules out casual accumulation and rewards descriptions that are exact, which is the same discipline described under [Design Principles](https://inshell.art/docs/design-principles) arriving from the direction of cost rather than from the direction of intent.

A constraint that comes from the material is harder to abandon than one the artist merely declared. This one is enforced by the network on every mint.

## The token can carry the work

- Authority: artist-editorial

A contract can return a data URI from its metadata function, embedding the metadata document and the image itself instead of an address where they might be found. Reading the token then is reading the work, with no host involved. That arrangement is what [Fully Onchain](https://inshell.art/docs/fully-onchain) describes for Inshell, and what [Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts) contrasts with ordinary pointer practice.

## Evidence boundary

- Authority: artist-editorial

Gas figures here describe published EVM pricing at order-of-magnitude precision and change with network upgrades. They are not quoted as current values for any chain, and they are not measurements of any Inshell deployment. Networks, addresses, and deployment facts for Inshell's own contracts belong to [Contracts](https://inshell.art/docs/contracts) and [Verification](https://inshell.art/docs/verification).


## Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Contracts](https://inshell.art/docs/contracts)
- [read Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts)
- [ERC-721 standard](https://eips.ethereum.org/EIPS/eip-721)

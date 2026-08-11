# Contracts

> Contract responsibilities remain separate across auction, issuance, permission, and artwork minting.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/contracts
- Documentation version: 2026-08-11

## Overview

- Authority: artist-editorial, app-documentation, contract-release

The public architecture is PulseAuction → PathPulseAdapter → PathNFT → ThoughtNFT. The arrows describe the issuance and permission path, not contract ownership or a promise that every future movement is deployed.

These contracts specify and enforce bounded actions within the practice. They can validate a permission, mint, or record, but they do not implement the truth named by Inshell or prove a participant's inward understanding.

PulseAuction calculates the live ask, accepts a successful bid, and closes an epoch. PathPulseAdapter translates that settlement into PATH issuance. PathNFT mints and owns PATH state, movement order, and capacity. ThoughtNFT validates THOUGHT mint rules, records the work, and atomically consumes an authorized THOUGHT unit from PATH.

The App orchestrates reads, previews, Agent runs, signatures, and wallet transactions. It does not replace contract validation. A wallet account submits the transaction; deployed contracts decide whether it is valid.

ABIs, bytecode, renderer payloads, schemas, and manifests belong to pinned releases. Contract addresses and deployment blocks belong to a network deployment record. Read both before identifying a live system.

## Separated responsibilities

- Authority: contract-release

### Contract handoffs across issuance and minting

- Authority: contract-release
- Figure mode: lanes

```text
PUBLIC ISSUANCE    [01] → [02] → [03]

PulseAuction      │ [01] Settle
                  │ Calculate the live ask and settle
                  │ one serial epoch.

PathPulseAdapter  │ [02] Issue
                  │ Translate the valid settlement
                  │ into PATH issuance.

PathNFT           │ [03] Record PATH
                  │ Own the issued PATH, its movement
                  │ order, and its capacity.

LATER THOUGHT MINT [04] → [05] → [06]

ThoughtNFT        │ [04] Validate work
                  │ Validate the THOUGHT work and
                  │ request PATH permission use.

PathNFT           │ [05] Consume permission
                  │ Verify configured caller, current-owner
                  │ authorization, active stage, and quota;
                  │ advance one unit.

ThoughtNFT        │ [06] Mint + record
                  │ Mint and record the work; a later revert
                  │ also reverts PATH consumption.
```

1. **PulseAuction · Settle · Public issuance** — Calculate the live ask and settle one serial epoch.
2. **PathPulseAdapter · Issue · Public issuance** — Translate the valid settlement into PATH issuance.
3. **PathNFT · Record PATH · Public issuance** — Own the issued PATH, its movement order, and its capacity.
4. **ThoughtNFT · Validate work · Later THOUGHT mint** — Validate the THOUGHT work and request PATH permission use.
5. **PathNFT · Consume permission · Later THOUGHT mint** — Verify configured caller, current-owner authorization, active stage, and quota; advance one unit.
6. **ThoughtNFT · Mint + record · Later THOUGHT mint** — Mint and record the work; a later revert also reverts PATH consumption.

The architecture separates pricing, issuance, permission, and artwork minting so each boundary can be inspected independently. Public PATH issuance and a later THOUGHT mint are separate phases. Contract calls and state handoffs connect them, but no contract owns all the others.

- PulseAuction owns the auction calculation and settlement rules.
- PathPulseAdapter connects the auction to PATH issuance.
- PathNFT owns PATH identity, issuance state, and movement capacity.
- ThoughtNFT owns THOUGHT validation, uniqueness, rendering references, metadata, and mint records.

## What the App does

- Authority: app-documentation, contract-release

The App reads state, assembles previews and creation records, requests Agent runs, helps the human choose a PATH, prepares signatures, and asks the wallet to submit transactions. It can make the workflow understandable, but it cannot override deployed validation.

A successful UI message is not final authority for a mint. The transaction receipt, emitted events, typed contract reads, and tokenURI supply the contract-controlled result.

## The movement-consumption boundary

- Authority: contract-release

PathNFT does not infer movement consent from PATH selection or ERC-721 approval. It accepts consumeUnit only from the configured movement minter and verifies an EIP-191 authorization signed by the current PATH owner. The signed message binds the PathNFT address, chain ID, PATH ID, movement, owner, executor, permission epoch, owner consume nonce, and deadline.

After checking the active stage and remaining quota, PathNFT returns a zero-based movement serial and updates permission progress. The configured movement contract owns the other half of the boundary: it calls consumeUnit before minting its work inside the same transaction. PathNFT owns permission accounting; the movement contract owns work validation and minting. If either half reverts, the transaction commits neither.

## Release plus deployment

- Authority: app-documentation, contract-release

A release says which ABI, bytecode, renderer data, schemas, and checksums belong together. A deployment record says which addresses and deployment blocks put a release on a particular network. Both are required to identify the live system precisely.

> Repository HEAD is not automatically the code behind an older deployed address. Match the active network, deployment record, pinned release, and deployed bytecode.


## Links

- [open contract verification](https://inshell.art/verify#verify-contracts)
- [read PATH movement consumption](https://inshell.art/docs/path#docs-path-consumption)
- [view PATH source](https://github.com/inshell-art/path)
- [view THOUGHT source](https://github.com/inshell-art/THOUGHT)
- [view Pulse source](https://github.com/inshell-art/pulse)

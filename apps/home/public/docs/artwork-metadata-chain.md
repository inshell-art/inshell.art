# Artwork, Metadata, and Chain

> Artwork and metadata stay legible only when their chain and release context stay attached.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/artwork-metadata-chain
- Documentation version: 2026-08-15
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Evidence becomes interpretation

- Authority: app-documentation, contract-release
- Figure ID: evidence.interpretation
- Figure mode: field
- Semantic form: fork
- Semantic nodes:
  - `evidence [evidence]: EVIDENCE`
  - `identity [evidence]: Identity — Network + contract + token`
  - `contract [evidence]: Contract — State + tokenURI`
  - `release [evidence]: Release — ABI + renderer + schemas`
  - `context [evidence]: Context — Provenance + reading surface`
  - `interpretation [result]: Interpretation — Read together`
- Semantic edges:
  - `evidence-identity: evidence (EVIDENCE) --[├─ · Identity is one evidence record.]--> identity (Identity)`
  - `evidence-contract: evidence (EVIDENCE) --[├─ · Contract state is one evidence record.]--> contract (Contract)`
  - `evidence-release: evidence (EVIDENCE) --[├─ · The pinned release is one evidence record.]--> release (Release)`
  - `evidence-context: evidence (EVIDENCE) --[└─ · Context is one evidence record.]--> context (Context)`
  - `evidence-to-interpretation: evidence (EVIDENCE) --[↓ · The evidence records are read together as interpretation.]--> interpretation (Interpretation)`

```text
EVIDENCE
├─ IDENTITY
│  Network + contract + token
├─ CONTRACT
│  State + tokenURI
├─ RELEASE
│  ABI + renderer + schemas
└─ CONTEXT
   Provenance + reading surface
      ↓
INTERPRETATION
Read together
```

- **Identity** — Network + contract + token
- **Contract** — State + tokenURI
- **Release** — ABI + renderer + schemas
- **Context** — Provenance + reading surface
- **Interpretation** — Read together

## Overview

- Authority: artist-editorial, app-documentation, contract-release

Home lists minted [THOUGHT](https://inshell.art/docs/thought) works from the active chain. The [PATH](https://inshell.art/docs/path) surface lists PATH tokens from that same chain. The full identity of an NFT is its network, contract address, and token ID; the same token number elsewhere is a different record.

THOUGHT and PATH artwork and NFT metadata come from each contract's tokenURI and pinned renderer. The App decodes and displays those canonical bytes; it must not rebuild replacement art or silently substitute a newer renderer.

Token metadata carries the canonical image, description, stable marketplace traits, and—when the release defines it—an external_url to the canonical detail page. A generic marketplace can read that portable layer without understanding Inshell's richer records.

Inshell detail pages add context: THOUGHT exposes its work, evidence levels, and creation provenance; PATH exposes movement state, capacity, linked movement tokens, issuance, and onchain record.

These layers make the public forms and claims of the practice inspectable. They can establish which bytes and records belong to a work; they cannot prove the inward truth of the work or possess its meaning.

These artwork, metadata, provenance, and chain layers describe Inshell's onchain practices. They are not requirements that every Agent Art practice must adopt.

Onchain does not mean context-free. Read network, contract, token ID, deployment, release, tokenURI source, and [attestation status](https://inshell.art/docs/verification) together before deciding what a record proves.

## A token number is not enough

- Authority: contract-release

Token ID 1 can exist on many contracts and networks. Its full identity is the tuple of network, contract address, and token ID. A collection page that omits one of those values may still be convenient, but it is not sufficient for independent verification.

## Canonical artwork bytes

- Authority: app-documentation, contract-release

THOUGHT and PATH tokenURI responses point to the canonical artwork and metadata produced by their pinned contract systems. The App decodes those bytes for display. It should not redraw an approximation, swap in a newer renderer, or treat a cached marketplace thumbnail as the origin.

- A data URI can carry JSON metadata or SVG artwork directly.
- A pinned renderer release makes the visual construction reproducible and reviewable.
- A social image or screenshot is a presentation copy, even when it looks identical.

## Portable metadata

- Authority: app-documentation, contract-release

Token metadata is the compact layer that generic wallets and marketplaces can understand. It includes the canonical image, description, stable traits, and an external URL when the selected release defines one.

Portable metadata deliberately does not carry every creation detail. Inshell detail pages and provenance endpoints can add richer context while keeping their different authority levels explicit.

## Read context with the object

- Authority: app-documentation, contract-release

- Which network and deployment produced the record?
- Which contract and token ID identify it?
- Which release defines its ABI and renderer?
- Which fields are token metadata, contract state, App records, or runtime reports?
- Is a Creation Attestation present, valid, absent, or not applicable?
- At what block or time was live chain state observed?


## Links

- [view minted THOUGHT works](https://inshell.art/)
- [view all $PATH](https://inshell.art/path)

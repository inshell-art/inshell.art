# Verification

> Verification separates records, releases, observations, and claims before drawing conclusions.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/verification
- Documentation version: 2026-08-11

## Overview

- Authority: artist-editorial, app-documentation, contract-release

Verification here concerns bounded public claims. It can test a signature, byte sequence, release, deployment, or chain record. It is not the truth named in Inshell's artistic position: inspect self is a direction of practice, not a proposition these proofs can establish.

Authority is the person or system that originates a claim. Loaded from names the immediate technical source used by the interface. A mirror is an indexed or cached copy, not a new authority. Display material is a presentation of a record, not the record itself.

Provenance describes how a work or record came into being and which commitments connect its parts. Proof is the data evaluated by a specific verification rule. Neither word means that every recorded statement is true.

For a token, start from network, contract address, and token ID. Read contract state and tokenURI, identify the deployment and pinned release, recompute published commitments, validate the selected specification, and verify the Creation Attestation when one is present.

Contract-verified means the contract accepted the defined proof and bound records. Runtime-reported means a connector received the value from an Agent runtime. Selected means the App or human chose it. Artist-editorial means it expresses the practice. These evidence levels must not be collapsed into one claim.

A valid Creation Attestation verifies one THOUGHT creation record under the rules of its contract release. It does not certify that a work is Agent Art or define the wider field.

The Verify page distinguishes the active PATH deployment, the qualified but undeployed THOUGHT R2 release, and historical THOUGHT Sepolia contracts. Explorer links for historical addresses do not make those contracts the current R2 deployment.

## Four terms that should not blur

- Authority: app-documentation

- Authority: the person or system that originates a claim.
- Loaded from: the immediate technical source used by the interface.
- Mirror: a copied or indexed representation of another source.
- Display material: a presentation of a record, not automatically its authority.

> A value can be loaded from a cache that mirrors a contract. The cache is the immediate source; the contract remains the authority for the mirrored fact.

## Provenance and proof

- Authority: app-documentation, contract-release

Provenance explains how parts of a work or record are related across creation, rendering, selection, minting, and later display. Proof is narrower: it is the data accepted by a specific verification rule.

A valid proof can establish that certain bytes, hashes, addresses, or signatures agree. It does not automatically make every surrounding narrative statement true.

## Evidence levels

- Authority: app-documentation

### Evidence levels and their bounded sources

- Authority: app-documentation
- Figure mode: ledger

```text
EVIDENCE          │ BOUNDED SOURCE
──────────────────┼─────────────────────────────────────
CONTRACT-VERIFIED │ Deployed rule accepted defined values.
CONTRACT-RELEASE  │ Pinned expected artifacts.
CHAIN-OBSERVED    │ Named network + observation point.
APP-RECORDED      │ App assembled or signed the record.
RUNTIME-REPORTED  │ Agent runtime or connector supplied it.
ARTIST-EDITORIAL  │ Meaning, practice, or interpretation.
```

- **Contract-verified** — Deployed rule accepted defined values.
- **Contract-release** — Pinned expected artifacts.
- **Chain-observed** — Named network + observation point.
- **App-recorded** — App assembled or signed the record.
- **Runtime-reported** — Agent runtime or connector supplied it.
- **Artist-editorial** — Meaning, practice, or interpretation.

- Contract-verified: deployed code accepted the defined values or proof.
- Contract-release: a pinned artifact set defines expected code, schemas, or renderer material.
- Chain-observed: a public read describes state on one named network at an observation point.
- App-recorded: the App assembled, stored, or signed a record with a declared boundary.
- Runtime-reported: the Agent runtime or connector supplied the value.
- Artist-editorial: the statement describes the practice, meaning, or interpretation.

## Work verification checklist

- Authority: app-documentation, contract-release

### A chain-first verification pass

- Authority: app-documentation, contract-release
- Figure mode: trace

```text
01 Locate
   Record the network, contract address, token ID,
   and transaction.
   │
   ↓
02 Read
   Query typed contract state and tokenURI from the
   identified deployment.
   │
   ↓
03 Pin
   Match the deployment to its release, ABI,
   renderer, schemas, and checksums.
   │
   ↓
04 Recompute
   Validate published hashes, work commitments, and
   specification rules.
   │
   ↓
05 Qualify
   State exactly what each proof establishes and
   what remains reported or editorial.
```

1. **Locate** — Record the network, contract address, token ID, and transaction.
2. **Read** — Query typed contract state and tokenURI from the identified deployment.
3. **Pin** — Match the deployment to its release, ABI, renderer, schemas, and checksums.
4. **Recompute** — Validate published hashes, work commitments, and specification rules.
5. **Qualify** — State exactly what each proof establishes and what remains reported or editorial.

1. Identify the network without inferring it from the website origin.
2. Confirm the deployed contract address and token ID.
3. Read the contract's typed work state and tokenURI.
4. Identify the matching release and deployment record.
5. Validate published hashes, schema constraints, renderer commitments, and the selected specification.
6. Verify a Creation Attestation when present, or report that the work is Unattested.
7. Name mirrors, caches, runtime reports, and editorial claims without promoting them to contract facts.


## Links

- [open verification](https://inshell.art/verify)
- [read the chain-first verifier guide](https://github.com/inshell-art/inshell.art/blob/main/docs/THOUGHT_PROVENANCE_VERIFIER.md)

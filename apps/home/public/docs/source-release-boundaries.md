# Source and Release Boundaries

> Source ownership, release artifacts, deployments, and publication are versioned independently.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation, contract-release
- Canonical page: https://inshell.art/docs/source-release-boundaries
- Documentation version: 2026-08-12
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Four distinct records

- Authority: app-documentation, contract-release
- Figure ID: source-release.records
- Figure mode: field
- Semantic form: axis
- Semantic nodes:
  - `source [record]: Source — Authored code`
  - `release [record]: Release — Pinned artifacts`
  - `deployment [record]: Deployment — Addresses + blocks`
  - `observation [record]: Observation — Point-in-time read`
- Semantic edges:
  - `source-not-release: source (Source) --[≠ · Authored source is not a pinned release.]--> release (Release)`
  - `release-not-deployment: release (Release) --[≠ · A pinned release is not a deployment record.]--> deployment (Deployment)`
  - `deployment-not-observation: deployment (Deployment) --[≠ · A deployment record is not a point-in-time observation.]--> observation (Observation)`
- Semantic groups:
  - `record-distinction [comparison]: Four records that must not be collapsed into one. [members: source (Source) · release (Release) · deployment (Deployment) · observation (Observation)]`

```text
SOURCE  ≠  RELEASE  ≠  DEPLOYMENT  ≠  OBSERVATION
Authored code   Pinned artifacts   Addresses + blocks   Point-in-time read
```

- **Source** — Authored code
- **Release** — Pinned artifacts
- **Deployment** — Addresses + blocks
- **Observation** — Point-in-time read

## Overview

- Authority: app-documentation, contract-release

The Inshell App, PATH contracts, THOUGHT contracts, and Pulse auction have separate repositories and ownership boundaries. The App owns creation flow, integration, and presentation. Each contract repository owns its contract behavior and release artifacts. Deployment operators own network deployment records.

The App consumes pinned ABIs, bytecode, schemas, renderer data, specifications, manifests, and checksums. A repository's latest source is not automatically the deployed release. A newer file is not authority for an older deployment.

Contract releases contain code and integrity material; network addresses and deployment blocks come from a separately verified deployment record. A correct integration matches the App pin, release artifacts, deployed bytecode, renderer commitments, and active network.

Documentation can describe current source, a pinned release, or observed chain state. It must say which. Mirrors and previews are useful distribution surfaces but do not silently become canonical origins.

## Repository ownership

- Authority: app-documentation, contract-release

- The Inshell App repository owns same-origin presentation, orchestration, API behavior, and integration pins.
- The PATH repository owns PATH contracts and their release artifacts.
- The THOUGHT repository owns THOUGHT contracts, specifications, renderer releases, and their integrity material.
- The Pulse repository owns the auction contract and pricing mechanism release.

## Why pins matter

- Authority: app-documentation, contract-release

A repository can continue changing after a contract is deployed. The App therefore consumes selected ABIs, bytecode, schemas, renderer payloads, manifests, and checksums instead of assuming that the newest source describes every historical token.

## Release is not deployment

- Authority: app-documentation, contract-release

A release may be complete without being deployed. A deployment record adds the network, contract addresses, deployment blocks, and integration choices needed to find it onchain. Verification joins both records and checks deployed bytecode where possible.

## Publication boundaries

- Authority: app-documentation

Canonical pages, Markdown documents, JSON indexes, API responses, GitHub mirrors, preview deployments, and third-party explorers serve different readers. Linking or mirroring improves access; it does not silently transfer authority.

> When documentation describes live chain state, name the network and observation point. When it describes a release, name the release rather than relying on the current repository branch.


## Links

- [Inshell App source](https://github.com/inshell-art/inshell.art)
- [PATH source](https://github.com/inshell-art/path)
- [THOUGHT source](https://github.com/inshell-art/THOUGHT)
- [Pulse source](https://github.com/inshell-art/pulse)

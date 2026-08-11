# THOUGHT end-to-end upstream integration handoff

Date: 2026-08-10
Audience: the agent integrating the completed THOUGHT boundary into the broader
`inshell.art` staging branch
Status: integration checkpoint; not a production deployment authorization

## Consume these immutable checkpoints

### Contract and protocol package

- Repository: `inshell-art/THOUGHT`
- Tag: `thought-v2-canonical-portable-release-20260807-r2`
- Tag target: `d29ddbfe76ff94c726b0786e43e61519c4087aab`
- Stable receipt commit: `4fbbd708dce7b35fe6c219cb130be794162980d4`
- Source commit: `a5935d67073d6d6e28a8135b3e0ae0caddf7da4b`
- Manifest SHA-256:
  `7cf7965edb3de6421c79d9c08f0781cabb78ea675bad354847b56ec8f19306cc`

This is the current V2 canonical portable contract package. It updates the
PATH dependency envelope to PATH v0.5.0 while preserving exact THOUGHT ABI and
bytecode parity with r1. It is qualified for downstream consumption, but it
does not authorize a persistent-chain deployment, signer activation, or
protocol registration.

### THOUGHT App integration checkpoint

- Repository: `inshell-art/inshell.art`
- Branch: `codex/thought-public-agent-deploy`
- Tag: `thought-app-e2e-integration-20260810-r1`
- Integration base: `2514426`

The App tag includes the earlier authority-binding commit `6b8b8ed` and the
final end-to-end integration commit. Integrate the commits after `2514426` in
order, or merge the immutable tag into current `staging` with normal conflict
review. Do not promote directly to `main`; staging preview remains the product
gate.

## What the App checkpoint contains

- Exact consumption of contract package r2, including generated ABI,
  bytecode, fixtures, manifest, consumer lock, and App/Contract boundary lock.
- One r2 release snapshot from Agent-run creation through claim, readiness,
  creative start, result return, preview, provenance, attestation, and mint.
- Canonical Codex and Claude Code handoffs with bounded control followed by one
  automatic creative turn, integrity capsules, retries, and deterministic
  handoff labs. Claude Cowork remains legacy-only.
- Durable local Agent-run checkpointing across same-runtime dev reloads. Only
  credential digests are persisted; raw bridge credentials are not written.
- Same-origin `/thought`, `/thought/<tokenId>`, home-gallery, PATH acquisition,
  wallet, signing, and mint integration.
- Transaction recovery keyed by one durable submitted hash, plus clear
  pre-submission failure behavior.
- Release-pinned detail reads, newest-first home-gallery ordering, canonical
  detail alignment, and stylesheet recovery after browser history navigation.
- THOUGHT Anvil persistence without periodic full-state dumps.

## Conflict hotspots in the broader repository

The THOUGHT-owned work is mostly under `apps/thought/`,
`packages/thought-agent-protocol/`, and THOUGHT Agent API files. The checkpoint
also contains required shared-origin seams in these home files:

- `apps/home/src/components/EcosystemHome.tsx`
- `apps/home/src/main.css`
- `apps/home/src/services/thoughtGallery.ts`
- `apps/home/tests/App.test.tsx`
- `apps/home/tests/EcosystemHome.test.tsx`
- `apps/home/vite.config.ts`

Resolve those files semantically against current staging. Preserve concurrent
PATH, docs, shell, analytics, and deployment changes owned by the broader
repository. The required THOUGHT outcomes are:

1. `/thought` is served at the canonical same origin.
2. `/thought/<tokenId>` reads the current release directly and uses the
   canonical record layout.
3. The home gallery reads only a lock-compatible THOUGHT deployment and orders
   token IDs newest to oldest.
4. Browser Back restores the THOUGHT stylesheet without requiring a manual
   refresh.
5. Home and standalone THOUGHT builds use the same r2 contract and Agent-run
   release identity.

Do not copy `dist/`, `.local/`, temporary handoff-lab reports, local run-store
data, or `apps/thought/contract-integration/local-runtime.thought-anvil.json`.
They are generated local state and are intentionally ignored.

## Required integration checks

After resolving staging conflicts, verify:

- contract release sync check;
- App/Contract baseline sync check;
- generated Agent protocol release check;
- THOUGHT production-readiness check remains prepared but not activated;
- THOUGHT runtime and handoff-lab tests;
- THOUGHT type-check;
- focused home App and EcosystemHome tests;
- standalone THOUGHT build;
- canonical same-origin home build;
- PUB path-boundary check;
- staged secret scan and staged-diff review.

The checkpoint passed all of those checks before publication. The deterministic
handoff labs passed 10/10 Codex cases and 10/10 Claude cases. The runtime suite
passed 72 panel/UI regressions in addition to protocol, persistence,
provenance, metadata, mint, and release-parity tests.

## Activation boundary

The current readiness state is deliberately:

- contract artifact synchronized: yes;
- prepared for reviewed production activation: yes;
- production deployment lock enabled: no;
- browser production signing enabled: no;
- production attestation signer enabled: no;
- persistent deployment or registration authorized: no.

The upstream integration may deploy staging preview and run disposable Anvil
acceptance. It must not infer Sepolia/mainnet deployment, registry ownership,
signer material, or production promotion from these tags.

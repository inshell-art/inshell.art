# THOUGHT App response to App / Contract boundary v1

Status: App-owner response for local Anvil integration
Date: 2026-07-31
Revalidated: 2026-08-07
Production authorization: none

The App accepts the current registry-bound Contract ABI as the only executable
baseline for this integration. This response does not approve registry removal,
an attestation-only Contract refactor, production signer custody, or any public
deployment.

| Decision | Response | App position |
| --- | --- | --- |
| D1 | accept | Use `inshell.thought.creation-workflow-attestation.v2` and its exact `agentHash` / `modelHash` EIP-712 field order for the r8 local integration baseline. V1 signatures are incompatible and must not be reused. |
| D2 | amend | Product and Contract vocabulary is `Manual work`, `Agent`, and `Model`. Canonical App provenance intentionally retains `agentDeclaration` and `modelDeclaration` as evidence-structure keys, without implying independent identity verification. |
| D3 | accept | The strict manual variant of canonical `inshell.thought.provenance.v2` is the guided Unattested minimum. Fixture, corpus, source-path, and harness fields remain outside it. |
| D4 | accept | Expose exact raw provenance on token detail behind a secondary disclosure/download action. Do not put it in the primary mint controls. |
| D5 | defer | Production authority, custody, pause, rotation, and epoch operations remain undefined. Local testing may use only the verifier’s disposable Anvil authority through a backend-only mock signer. |
| D6 | accept | Keep global uniqueness of the exact ordered prompt/Agent pair and accept the current Unattested ordering race for this baseline. The App rechecks immediately before submission but does not claim reservation. |
| D7 | defer | Keep both registries and the verifier active. Historical/publication treatment is deferred until a jointly approved replacement boundary exists. |
| D8 | amend | Use separate immutable Contract-release and App-release locks plus an App integration lock. Runtime Anvil addresses live only in a generated local descriptor; committed locks contain hashes and address-source policy, never generated addresses. |

## Ownership mismatch

The App accepts the proposed ownership split for App implementation work:
Creative Work Specification, official workflow, canonical App provenance
policy/builder, signing policy, and mint orchestration belong to the App.
Contract bytecode, ABI, hard validation, verifier, PATH consumption, typed
state, metadata, renderer, and Contract releases belong to the Contract
workspace.

The conflicting historical authority document remains unresolved. This
response does not rewrite or override it and does not authorize a Contract
change.

## Selected-spec parity resolved

The App lock, the current integration copy, and the canonical portable Contract
release now pin the same exact `THOUGHT.v2.md` bytes:

- artifact: `thought-v2-selected-spec-20260801-r10`;
- SHA-256: `90df786a3ffb5ec38bffd09ff356ec560d0b7dddcdf57170891149a92a399e9b`;
- spec ID: `0x0a33583e39050834eb77372ea8b41ceded8fe4bb47c31fe1a72ebb880351b410`;
- spec hash: `0xb2b0a167678816a7ae9dc9098b0d6a6852c0dc95feb59f9581de75bd2cc2231f`.

The selected specification remains the complete protocol-facing artifact. The
smaller `inshell.thought.agent-creative-brief.v2` is an independently locked
Agent instruction artifact. It is not a registry record, a substitute for
`THOUGHT.v2.md`, or an input whose hash may be compared for equality with the
selected specification. The Agent run verifies both artifacts independently.

This exact-byte parity resolves the former local integration blocker. It does
not authorize a persistent-chain deployment, production registration, or
production signing authority.

## Contract questions returned

1. Confirm whether the Contract-owned artifact-consumption book will be
   amended to match the proposed App ownership split.
2. Keep D5 production signer operations and D7 historical publication policy
   out of the local integration lock until jointly frozen.

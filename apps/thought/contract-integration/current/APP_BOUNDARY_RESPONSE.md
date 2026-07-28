# THOUGHT App response to App / Contract boundary v1

Status: App-owner response for local Anvil integration
Date: 2026-07-23
Production authorization: none

The App accepts the current registry-bound Contract ABI as the only executable
baseline for this integration. This response does not approve registry removal,
an attestation-only Contract refactor, production signer custody, or any public
deployment.

| Decision | Response | App position |
| --- | --- | --- |
| D1 | accept | Keep `inshell.thought.creation-workflow-attestation.v1` and its current exact EIP-712 field order as the local integration baseline. A future incompatible claim requires a new profile. |
| D2 | amend | Product vocabulary is `Manual work`, `Declared Agent`, and `Declared Model`. Do not reintroduce `My Brain` as protocol vocabulary. The first local slice may expose the builder before exposing a primary manual-work UI. |
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

## Current selected-spec incompatibility

The App-owned locked `apps/thought/spec/THOUGHT.v2.md` and the Contract
workspace’s currently registered `THOUGHT.v2.md` have the same spec ID but
different exact bytes and hashes. The current registry permits one record per
spec ID. Therefore:

- App generation may use the App-owned latest spec for corpus testing;
- the current disposable Contract baseline can only mint work anchored to its
  actually registered bytes;
- the App must not relabel either artifact as the other; and
- an end-to-end mint under the App-owned spec requires a fresh disposable
  Contract deployment or a later jointly approved Contract release.

## Contract questions returned

1. Publish a fresh noncanonical Contract release that registers the exact
   App-owned creative-spec bytes when end-to-end mint testing under that spec
   is approved.
2. Confirm whether the Contract-owned artifact-consumption book will be
   amended to match the proposed App ownership split.
3. Keep D5 production signer operations and D7 historical publication policy
   out of the local integration lock until jointly frozen.

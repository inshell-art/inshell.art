# Studio Preview release and deployment integrity runbook

## Scope and review record — 2026-08-26

The operator requested deployment-lock v2: an always-enforced, versioned integrity
reference, not an access restriction or feature toggle. This migration records
`no-approved-deployment`, revision 1. It does not approve any contract deployment,
frontend onchain activation, signer activation, or mint opening. Those approvals
remain false in the separate activation policy.

This document records the requested semantic migration, not proof of a chain
deployment or approval to promote this branch. The implementation PR/diff and test
evidence must be reviewed before staging integration. Production needs a separate
operator approval after preview validation.

Docs impact: **docs-required**. The human source and generated Agent-readable docs
must describe the same boundary.

## Three independent decisions

1. **Integrity reference:** no approved deployment, or one exact approved deployment.
   Both are valid locked states. Schema version describes the format; revision
   identifies an intentional reference change. Missing fields, extra switches,
   wrong release pins, and mismatched configuration are drift.
2. **Activation policy:** separately approved frontend, backend signer, and mint
   activation, bound to the reviewed deployment revision. Recording a deployment
   does not grant these approvals.
3. **Mint opening:** a fresh read model matching the exact release, chain, and
   auction must establish the opening. A local clock or the activation policy
   alone cannot open minting. The backend remains the final authorization boundary.

Studio Preview is an internal label. Visitors can create and save THOUGHT work.
Mint and wallet controls remain guidance, without signing, network-switching,
contract reads for a supposed current deployment, or mint transactions.

Historical Sepolia read APIs can remain operational for historical inspection.
OPS status labels their configuration as historical; their addresses are not the
approved public deployment. Before any future onchain activation, those readers
must be reconciled with the exact approved reference. A mismatch is drift, not a
fallback.

The existing explicitly configured local Anvil integration harness is not a
published deployment and is preserved separately. Its test runtime is not
deployment approval and cannot be promoted as Studio Preview evidence. Ordinary
local Studio Preview uses the same reference validation as published builds;
development mode alone does not exempt its configuration from drift checks.

## Ownership

| Owner | Responsibility |
| --- | --- |
| FE | Schema, validation, frontend/API consumers, build identity, automated checks, reviewed candidate and staging integration |
| OPS | Cloudflare environments/bindings, Agent API reachability, D1/KV, deployment supervision, smoke checks, alerts and rollback verification |
| SIGNING_OS | Explicitly approved contract deployment/signing operations only; not involved in deploying this Studio Preview release |
| Operator | Review intentional reference changes, inspect preview, approve production promotion |

## 1. Freeze the candidate — FE

- Work from latest staging in an isolated clean worktree. Preserve other sessions'
  dirty worktrees. Integrate reviewed FE and Docs commits; include the complete Docs
  v2 reconciliation. Record source SHA, branch, lock revision, policy revision,
  release pins, and build configuration.
- Do not copy a working directory or deploy an old artifact under a new branch name.
- Review all changes, including generated artifacts and snapshot deltas. Snapshot
  updates must represent the reviewed source change, not suppress integrity errors.
- Do not edit the deployment reference to make an unexpected config pass. Investigate
  whether the config is wrong or an intentional deployment change needs approval.
- For a reference change: increment revision, add a new review record, and bind
  activation policy to the new revision with fresh approvals (default false).
- An approved-deployment reference also needs a committed evidence JSON report:
  schema `inshell.deployment-evidence.v1`, exact `deployment` object, and `contracts`
  entries for every locked contract containing address, blockNumber,
  transactionHash, runtimeBytecodeSha256. Record report path and byte SHA-256 in
  the lock. OPS must verify receipts, runtime code, immutable release getters,
  registry/spec bindings, verifier authority and epoch. Hash agreement alone is
  not proof of an authentic deployment.
- With no approved deployment, keep deployment/evidence null. This is not a check
  bypass and does not require deploying contracts.

## 2. Validate — FE

Run from the candidate worktree:

```sh
pnpm install --frozen-lockfile
pnpm docs:generate
pnpm docs:check
pnpm check:thought-production-readiness
pnpm check:production
pnpm pub-boundary:check
git diff --check
gitleaks detect --no-git --redact --no-banner
```

Before a commit, stage only intended source/generated files, inspect
`git diff --staged`, then scan again. Exclude reports, test-results, tokens,
local notes, runtime state, and private environment files.

The readiness check validates lock/evidence without writing them. It also checks
this release's **separate Studio Preview policy**. Passing means the frontend is
eligible for review, not that onchain activation is ready.
`--require-activation-ready` must fail for this release.

In CI compare the reference to the PR base SHA (or prior pushed SHA) using
`DEPLOYMENT_LOCK_BASE_REF`; a change must not compare only to itself.
Invalid references must fail before deployment, including a quick-path deployment.

Regression evidence must cover both valid lock states, malformed/partial records,
wrong pins, config drift, revision/review/evidence requirements, independent
activation, fresh/stale/mismatched opening evidence, and unchanged Studio Preview.

## 3. Preflight the environment — OPS, before deploying

- Confirm `preview.inshell.art` binds to `staging.inshell-art.pages.dev`.
  Confirm production remains the home project's `main` deployment.
- Inventory public configuration and backend bindings without sharing secret
  values. Remove unintended deployment overrides; do not add arbitrary addresses
  merely because they appear in a historical file. RPC presence is not approval.
- Verify Agent endpoints support the intended run-scoped credentials. A browser
  Access cookie must not be the only way an external Agent can reach claim, ready,
  start, and result routes. Any Access adjustment needs OPS review; no blanket
  disabling of authentication.
- Confirm D1 run-store and cleanup, KV/read-model ownership, secret boundaries,
  error monitoring, and retention. No signer activation is needed here.
- Record the last verified staging and production deployment IDs and source SHAs
  for rollback. Ensure OPS can read the version-2 status response.
- No known required environment value may be deferred until runtime failure.

## 4. Land and deploy staging — FE + OPS

Open a PR to staging. Keep the full PR gate; quick feedback is additive. After
review and green checks, merge to staging, capture the actual staging SHA, then:

```sh
gh workflow run deploy-pages.yml --ref staging -f branch=staging
```

Both the workflow ref and selected source branch must be staging. Watch that
specific run and its Pages deployment. Do not deploy a feature branch under the
staging label, and do not treat a green build as proof the canonical host is updated.

OPS/FE verify the immutable artifact and canonical
`https://preview.inshell.art` serve the expected SHA. Retain evidence for both
home and THOUGHT artifacts/API deployments where the workflow uses both.

## 5. Validate the live candidate — FE + OPS + operator

- Top-left preview watermark is present. Navigation remains same-origin:
  /, /path, /thought, /gallery, /docs, /verify. PUB-reserved paths still reach PUB.
- /api/ops/status: contract version 2; deploymentLock.enforcement = always;
  state = no-approved-deployment; integrity = valid; differences = [];
  approved network/contracts empty; activation approvals false.
- Attestation GET reports the same lock and separate policy. Attestation POST
  remains unavailable (503); do not send a real signing request.
- Gallery absence is intentional and not an RPC outage. THOUGHT browser rendering
  and local saving work without contract deployment.
- Mint and Connect wallet show the approved guidance. No accidental wallet prompt,
  signing request, auction-open claim, or fallback to an old collection.
- Check desktop/mobile presentation and Docs navigation against existing policies.
- Run the agreed four real Agent cells on the same candidate:
  Mac A × Codex/Claude; Mac B × Codex/Claude. Capture model/app versions, protocol
  and release identity, accepted return, preview result, and report status.
  Reuse evidence only after an explicit impact review shows those inputs and
  behavior are unchanged; never label a new candidate passed by assumption.
- Manual deep-link launch/consent is separate browser evidence; an automated CLI
  cell does not prove the OS launch prompt. The operator approves native app
  opening/submission when required.
- FE hands OPS source SHA, deployment IDs, lock/policy revisions, checks, cell
  reports, browser evidence, known limitations, and rollback target.

A build is ready for operator testing only after these automated/live checks.
If notifications are requested, use an actual monitor/ntfy workflow; a closed
conversation is not a running monitor. Notify once with the verified URL/SHA.

## 6. Production approval — operator

Open the staging → main PR. Required production checks are build and gitleaks.
Summarize exact changes, reference/policy state, staging evidence, all four cell
results (or explicit approved reuse), operational checks, and rollback target.

Send the required readiness notice, then **wait for explicit operator approval**.
No main merge, direct push, or production deployment because tests alone passed.

## 7. Promote the reviewed frontend — only after approval

Merge the approved staging → main PR. Record its resulting main SHA; if merge
resolution or build inputs differ from the reviewed candidate, revalidate them.
Deploy the actual main branch using the configured production workflow:

```sh
gh workflow run deploy-pages.yml --ref main -f branch=main
```

This promotes the Studio Preview website, not contracts or minting. The lock still
records no approved deployment; activation remains false. Production has no preview
watermark and all canonical product links stay under `https://inshell.art`.

OPS verifies exact live build identity, Agent API reachability, status/reference,
browser preview, save/load, guidance-only wallet/mint behavior, and incident signals.
Keep test creation bounded and operator-approved; never mint just to smoke-test.

## 8. Rollback and handback — OPS + FE

If live checks fail, stop promotion/activation. OPS rolls back to the recorded,
verified artifact/configuration pair using the existing rollback workflow and
rechecks canonical hosts. Do not “repair” a mismatch by changing the lock.

Record the failed SHA, deployed artifact, drift fields (no secret values), actions,
and post-rollback verification. Reconcile the source fix through staging again.
Do not claim an incident resolved before OPS live verification.

## Future onchain launch — separate change and approval

OPS and SIGNING_OS execute an explicitly approved deployment; FE does not.
OPS supplies verified deployment evidence. FE proposes the exact reference change,
with all activation approvals initially false. Review API/read-model addresses,
cache namespaces, bytecode/getters, signer integration, and network behavior.
Only subsequent explicit activation approvals and fresh matching opening evidence
may permit minting. Nothing in this runbook authorizes that future launch.

# Deployment integrity and activation

`deployment-lock.json` is an always-enforced, versioned integrity reference.
Its schema is `deployment-lock.schema.json`; the shared parser additionally checks
the pinned Contract release. There is no lock switch.

Two states are valid:

- `no-approved-deployment`: deployment and deployment evidence are explicitly
  null. Historical addresses and portable artifacts are not approved deployments.
- `approved-deployment`: one complete, exact deployment identity, with a reviewed,
  checksummed evidence report. Partial identities and unrecognized fields fail.

The reference records facts. It neither grants access nor activates a feature.
`activation-policy.json` separately records frontend, backend signer, and mint
activation approvals, bound to one lock revision. All remain false in this release.
A fresh, identity-matched chain read model must additionally establish mint opening.
A browser clock, release flag, wallet connection, or lock update alone cannot do so.

The frontend and API share the parser. Deployment-dependent gallery data is keyed
by chain, address, artifact, and manifest; unapproved historical collections must
not substitute for current data. Development-only Anvil fixtures remain a separate
test lane and cannot change the public deployment reference.

Unexpected schema, pin, environment override, or selected API configuration
differences are drift. Report field names, never secrets. Do not overwrite the lock
with observed values. An intentional change needs a higher revision, a new review
record, and deployment evidence for an approved deployment. Checks only read these
files. Git review is the approval record; a JSON field does not prove approval.

See [the complete staging/production runbook](../../../docs/DEPLOYMENT_LOCK_RUNBOOK.md).

## Signer boundary

The production attestation endpoint still returns 503 for POST. An approved
deployment does not change this. Before a separately authorized signer integration:

1. Authenticate the browser-scoped credential for a returned Agent run.
2. Read canonical prompt, result envelope, and model evidence from the run store.
3. Build and validate provenance server-side.
4. Verify chain, bytecode, immutable dependencies, protocol release, authority,
   epoch, and pause state against the approved reference.
5. Send only the exact EIP-712 digest through a backend signing binding.
6. Recover the authority and verify the claim before returning a mint package.
7. Keep keys outside browser code, repository files, public configuration, and logs.

OPS owns deployment infrastructure; SIGNING_OS owns signing execution.
FE must not infer their authorization from a successful build.

# DEV Quality Loop

This directory is the DEV-owned GitHub quality status surface for OPS.

Run once locally:

```bash
pnpm run quality:github
```

The command writes:

- `.ops/dev-quality/status.json`
- `.ops/dev-quality/runs/<timestamp>.md`

Those generated files are ignored locally. In GitHub Actions, the scheduled
`dev-github-quality-loop` workflow uploads them as the `dev-github-quality-status`
artifact for OPS to read.

The loop checks:

- default-branch GitHub Actions failures
- Dependabot alerts, when readable
- code-scanning alerts, when readable
- secret-scanning alerts, when readable

Status values:

- `ok`: no open quality issue and no read error
- `blocked`: an open issue exists or GitHub would not let the loop read a required surface

OPS contract fields:

- `contract`: `dev-github-quality-loop-contract`
- `ops.staleAfterSeconds`: freshness window OPS should enforce
- `ops.activeAlerts`: current OPS-facing alert keys
- `ops.alertMapping.blocked`: `dev.github_quality.blocked`
- `ops.alertMapping.stale`: `dev.github_quality.stale`
- `ops.alertMapping.securityCritical`: `dev.github_quality.security_critical`

Boundary:

- DEV fixes repo-local issues on `staging` from this report.
- The loop does not mutate provider accounts, secrets, billing, Cloudflare state, or OPS config.
- Routine `github.repo_quality.actions` should be tracked through this loop, not one-off OPS repair requests.
- DEV must not auto-merge to `main`; the operator approves production merges.

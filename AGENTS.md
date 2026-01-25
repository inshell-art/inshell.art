# AGENTS

## Curve Rendering (Half-Lives)
- X-axis uses half-lives: `u = (t - last_bid_time) / t_half`.
- Draw a fixed window in half-lives with a **fixed count**, using the smallest multiple of 10 that covers “now” (min 10).
- Tooltip timing converts back with `tau = u * t_half`, then uses `(now - last_bid_time) - tau` for ago.

## Dev Server Rules
- Always run Vite with `--host 127.0.0.1` and `--strictPort`.
- Never run two servers on the same port (including IPv4/IPv6 split).
- If a port is occupied, stop the existing process before starting a new one.

## Security and Leak-Prevention Rules
- Never introduce secrets into the repo.
- Do not add or modify code that includes any:
  - private keys, seed phrases, mnemonics
  - service account JSON
  - API keys or tokens (RPC keys included)
  - .env files or .pem/.key files
- Treat any `VITE_*` env vars as public (baked into client JS). Never store secrets in them.
- Always run a leak scan before committing.
- Before proposing a commit/PR, run:
  - `git diff --staged` and manually inspect for secrets
  - `gitleaks detect --no-git --redact` (or repo’s chosen scanner)
- If any potential secret is detected, stop and remove it; do not “mask” it.
- Do not print sensitive values in CI logs.
- Avoid adding workflow steps like `echo $TOKEN`, `printenv`, verbose debug logs that may include headers/keys.
- Avoid logging full RPC URLs if they include keys.
- No new third-party telemetry by default.
- Do not add analytics, session replay, fingerprinting, or new error trackers unless explicitly requested.
- If error tracking exists, ensure it:
  - does not capture wallet addresses or RPC payloads
  - does not capture user identifiers
- Protect deployment and workflow integrity.
- Do not weaken branch protections in documentation or instructions.
- Pin GitHub Action versions where possible.
- Prefer least-privilege tokens and avoid long-lived credentials.
- Remove debug artifacts.
- Before committing, ensure no debug-only endpoints, “test wallets”, or local RPC defaults ship to production configs.
- Ensure production defaults do not point to localhost RPC.
- Security PR checklist (must pass):
  - No secrets in diff
  - No new telemetry
  - No new external endpoints without clear reason
  - Build succeeds with clean env
  - Any new config is documented and safe to be public

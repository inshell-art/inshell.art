# AGENTS

## Response Style
- Speak bluntly and answer the direct question first.
- If work needs an external value, secret, account action, deployment setting, product decision, or operator confirmation, ask for it directly and early.
- Do not hide required follow-up actions in docs, caveats, or final summaries. State the blocker as a concrete ask.
- Do not wait for the operator to discover a missing requirement from a failed deploy or runtime error when the need is already known.

## Terminology
- In product discussions, do not call the repo owner/operator "user". Use "dev", "operator", or "project owner" for the person building/running Inshell.
- Reserve "user" for actual product end users such as wallet holders, visitors, minters, or CLI operators inside the app.
- Prefer product wording like "operator-configured RPC" or "dev-configured RPC" instead of "user-configured RPC" when discussing implementation choices with the repo owner.

## Curve Rendering (Half-Lives)
- X-axis uses half-lives: `u = (t - last_bid_time) / t_half`.
- Draw a fixed window in half-lives with a **fixed count**, using the smallest multiple of 10 that covers “now” (min 10).
- Tooltip timing converts back with `tau = u * t_half`, then uses `(now - last_bid_time) - tau` for ago.

## Dev Server Rules
- Always run Vite with `--host 127.0.0.1` and `--strictPort`.
- Never run two servers on the same port (including IPv4/IPv6 split).
- If a port is occupied, stop the existing process before starting a new one.

## Preview/Staging Deployment Discipline
- Treat `staging` as the frontend preview gate and `main` as production.
- Night-note frontend work lands on `staging`/preview first unless the operator explicitly says otherwise.
- Normal frontend flow: land code on `staging`, deploy the Cloudflare Pages `staging` branch, validate preview, then wait for the operator to say to merge/promote before updating `main`.
- Do not merge frontend changes from `staging` to `main` just because automated checks pass. Manual preview validation is the production gate.
- Do not deploy frontend changes straight to `main` unless the operator explicitly asks for an emergency production hotfix.
- If a production hotfix bypasses `staging`, say so plainly in the final response and reconcile `staging` with `main` immediately after.
- This applies to all frontend surfaces in this repo: home/PATH, THOUGHT, gallery/detail pages, primitive pages, report-bug links, and cross-links.
- Preview builds must show the top-left `preview` watermark. Production builds must not show it.
- `preview.inshell.art` should point at the Cloudflare Pages branch alias for `staging` on the home project: `staging.inshell-art.pages.dev`.
- `thought.preview.inshell.art` should point at the Cloudflare Pages branch alias for `staging` on the THOUGHT project: `staging.thought-inshell-art.pages.dev`.
- `gallery.preview.inshell.art` should point at the Cloudflare Pages branch alias for `staging` on the THOUGHT project: `staging.thought-inshell-art.pages.dev`.
- Treat these as one preview umbrella: `preview.inshell.art` mirrors `inshell.art`, `thought.preview.inshell.art` mirrors `thought.inshell.art`, and `gallery.preview.inshell.art` mirrors `gallery.inshell.art`.
- Staging builds must cross-link within the preview umbrella. Home staging links to `https://thought.preview.inshell.art/` and `https://gallery.preview.inshell.art/`; THOUGHT staging links back to `https://preview.inshell.art`.
- The Cloudflare custom-domain bindings are account-side. If any preview binding is missing, ask the operator to bind `preview.inshell.art`, `thought.preview.inshell.art`, and `gallery.preview.inshell.art` to their `staging` branches before claiming preview is ready.
- In `.github/workflows/deploy-pages.yml`, the selected deploy `branch` must match the checked-out source branch. Never deploy `main` code under a `staging` label or `staging` code under a `main` label.

## Hot Fix Agent Only
- This section applies only when explicitly acting as the emergency hot-fix agent.
- For emergency production fixes, create a dedicated hotfix branch from the correct production base, normally latest `main`, unless the operator specifies otherwise.
- Keep the hotfix narrow: only change what is needed for the emergency fix plus directly required tests/docs.
- Validate the hotfix branch, then push the branch for operator review.
- Do not merge, fast-forward, cherry-pick, or otherwise promote the hotfix into `main` without explicit manual approval from the operator.
- After the operator approves and the hotfix is merged/promoted to `main`, reconcile the same fix back to `staging` promptly.
- Prefer merging or cherry-picking the exact production hotfix into `staging` so preview and production do not drift.
- If reconciling back to `staging` conflicts or would pull unrelated production changes, stop and ask the operator directly before continuing.
- State plainly in the final response which branch was hotfixed, whether `main` was updated, and whether `staging` was reconciled.

## Visual Verification
- For UI visualization bugs, especially charts/SVG/canvas/responsive layout, verify with `visual-dom-cdp` or the same headless Chrome/CDP workflow: DOM counts, geometry thresholds, network status, and a screenshot.
- Do not call a visualization fix done from code inspection alone. Use a browser-rendered screenshot plus concrete DOM/geometry signals.
- For PATH auction curve work, check sale count, curve/context-curve count, pump visibility, off-canvas SVG coordinates, and failed `/api/path-rpc` calls.

## Task Notes
- Use `LOCAL_TASKS.md` as the local task memo when it exists. It is local-only and should not be committed unless the user explicitly asks.
- Keep two GTD-style boxes:
  - `Inbox`: what the operator wants daily attention on and may ask to implement next.
  - `Someday`: useful but not urgent work; do not implement unless the operator explicitly moves it into `Inbox` or asks for that specific someday item.
- Command conventions:
  - `add to inbox: <task>` adds the task under `Inbox`.
  - `add to someday: <task>` adds the task under `Someday`.
  - `add to tasks: <task>` and `add to night-note: <task>` are legacy aliases for `add to inbox: <task>` unless the operator explicitly says `someday`.
  - `inbox`, `tasks`, or `night-note` lists/reviews `Inbox`.
  - `someday` lists/reviews `Someday`.
  - `resolve tasks`, `empty the tasks`, `clean inbox`, or similar starts implementing `Inbox` in order, then clears completed entries after confirming what changed.
- If any GitHub, Dependabot, security, CI, deployment, or repo alert appears during work or push output, record it under `Inbox` unless the user asks to fix it immediately.

## OPS Repair Requests
- This repo is the DEV side for OPS repair handoffs from `/Users/bigu/Projects/inshell-feed-ops`.
- The OPS request queue lives at:
  `.ops/repair-requests/`
- Casual operator phrases map as follows:
  - `ops request`, `check ops`, `check repair requests`, or `repair request` means inspect `.ops/repair-requests/pending/`.
  - `claim ops request` means move the selected request from `pending/` to `claimed/` before editing.
  - `repairs are done to OPS` means produce a concise OPS handback with the incident id, files changed, checks run, and whether verification should run now.
- Request states:
  - `pending/`: OPS created it; DEV has not started.
  - `claimed/`: DEV is working on it.
  - `done/`: DEV patched it and recorded notes/checks.
  - `blocked/`: DEV cannot finish without operator input or external state.
- When handling a request:
  - Read the request file first.
  - Move it to `claimed/` when starting.
  - Patch only this target repo unless the request explicitly says otherwise.
  - Do not edit secrets, deploy production, merge to `main`, or weaken security gates.
  - Run the repo checks that prove the fix.
  - Append a short result note to the request file, then move it to `done/` or `blocked/`.
- Handback to OPS should include the exact incident id and a summary suitable for:
  `pnpm ops-orchestrator repair-result --incident <incidentId> --status patch_ready --summary "..."`
- OPS owns final verification. DEV should not claim the incident is resolved until OPS verification clears the alert.

## Security and Quality Routine
- GitHub security/quality alerts are handled on `staging` first, then promoted to `main` only after operator review.
- The midnight routine means: inspect GitHub Dependabot alerts, code scanning alerts, secret scanning alerts, Dependabot PRs, and failed quality workflows; patch on `staging`; run CI/leak checks; push preview; notify the operator.
- Do not auto-merge Dependabot, CodeQL, secret-scanning, or security fixes into `main`.
- Dependabot version-update PRs should target `staging` so dependency changes go through preview validation.
- GitHub Dependabot security updates may still target the default branch; if that happens, recreate or cherry-pick the fix onto `staging` first unless the operator explicitly requests an emergency production hotfix.
- Nightly alert workflows are allowed to fail when open alerts exist. A failed nightly security-quality run is an action signal, not a production deploy blocker by itself.

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

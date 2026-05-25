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
- Normal frontend flow: land code on `staging`, deploy the Cloudflare Pages `staging` branch, validate preview, then wait for the operator to say to merge/promote before updating `main`.
- Do not merge frontend changes from `staging` to `main` just because automated checks pass. Manual preview validation is the production gate.
- Do not deploy frontend changes straight to `main` unless the operator explicitly asks for an emergency production hotfix.
- If a production hotfix bypasses `staging`, say so plainly in the final response and reconcile `staging` with `main` immediately after.
- This applies to all frontend surfaces in this repo: home/PATH, THOUGHT, gallery/detail pages, primitive pages, report-bug links, and cross-links.
- Preview builds must show the top-left `preview` watermark. Production builds must not show it.
- `preview.inshell.art` should point at the Cloudflare Pages branch alias for `staging` on the home project: `staging.inshell-art.pages.dev`.
- `thought.preview.inshell.art` should point at the Cloudflare Pages branch alias for `staging` on the THOUGHT project: `staging.thought-inshell-art.pages.dev`.
- Treat these as one preview umbrella: `preview.inshell.art` mirrors `inshell.art`, and `thought.preview.inshell.art` mirrors `thought.inshell.art`.
- Staging builds must cross-link within the preview umbrella. Home staging links to `https://thought.preview.inshell.art/`; THOUGHT staging links back to `https://preview.inshell.art`.
- The Cloudflare custom-domain bindings are account-side. If either is missing, ask the operator to bind `preview.inshell.art` and `thought.preview.inshell.art` to their `staging` branches before claiming preview is ready.
- In `.github/workflows/deploy-pages.yml`, the selected deploy `branch` must match the checked-out source branch. Never deploy `main` code under a `staging` label or `staging` code under a `main` label.

## Visual Verification
- For UI visualization bugs, especially charts/SVG/canvas/responsive layout, verify with `visual-dom-cdp` or the same headless Chrome/CDP workflow: DOM counts, geometry thresholds, network status, and a screenshot.
- Do not call a visualization fix done from code inspection alone. Use a browser-rendered screenshot plus concrete DOM/geometry signals.
- For PATH auction curve work, check sale count, curve/context-curve count, pump visibility, off-canvas SVG coordinates, and failed `/api/path-rpc` calls.

## Task Notes
- Use `LOCAL_TASKS.md` as the local task memo when it exists. It is local-only and should not be committed unless the user explicitly asks.
- Keep two separate queues:
  - `Regular Tasks`: daytime work that can be implemented when the user says `resolve tasks`, `empty the tasks`, or similar.
  - `Night Notes`: low-urgency night work that should only be implemented when the user says `dev night-note`, `clean the tasks in night-note`, or similar.
- Command conventions:
  - `add to tasks: <task>` adds the task under `Regular Tasks`.
  - `add to night-note: <task>` or `night-note: <task>` adds the task under `Night Notes`.
  - `tasks` lists/reviews `Regular Tasks`.
  - `night-note` lists/reviews `Night Notes`.
  - `resolve tasks` or `empty the tasks` starts implementing regular tasks in order, then clears completed entries after confirming what changed.
  - `dev night-note` starts implementing night-note tasks in order, clears completed entries after confirming what changed, then pushes the finished code.
- If any GitHub, Dependabot, security, CI, deployment, or repo alert appears during work or push output, record it under `Night Notes` unless the user asks to fix it immediately.

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

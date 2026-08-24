# Studio Preview Launch — Handoff

Date: 2026-08-24
Branch state: `staging` @ `856f1df`, full production gate green
Scope: THOUGHT and PATH visitor copy, the studio-preview phase, dependency security

## Open issues

### 1. Promotion to `main` is not opened

`staging` carries everything below and is green, but the promotion pull request
has not been raised. `main` is protected and refuses direct pushes, so the only
path is a pull request from `staging` to `main`, merged after its checks pass.

Once promoted, cut the release tag on the resulting commit on `main` — tags mark
the promoted commit, never a feature branch tip. An earlier tag was cut on a
branch tip by mistake and has been deleted.

Promotion also clears the Dependabot alerts. All five vulnerabilities are fixed
on `staging` by #162 (nanoid 3.3.18, postcss 8.5.23, js-yaml 4.3.1, extract-zip
removed), but GitHub computes alerts against the default branch, so they remain
visible until `main` catches up. #138, a Dependabot pull request against `main`
for js-yaml, is superseded by that promotion.

### 2. `/verify` and THOUGHT detail still describe absence

Both surfaces still render "not deployed". The operator's rule is that **any
page a visitor can reach is visitor-facing**, so the copy principles in
`AGENTS.md` apply to them exactly as they apply to home and the creation panels.

The work is to give each the same treatment home received: name the state
rather than the absence, spend the one available message on what the visitor can
do, and keep contract mechanism out of ambient copy. Note that on `/verify` the
deployment status is also a factual readout, so decide per string whether it is
reporting a verified fact to someone who asked or labelling the product with an
absence.

Neither surface has been started.

## Also open

**#163, the Dependabot dev-dependency bump, is a migration rather than a bump.**
Partial work sits on the local branch `codex/wip-dev-deps-migration` (`b86b73c`),
which is deliberately unpushed because it does not pass lint.

Resolved in that branch: js-yaml 5 lost its default export, so two scripts use
the named `load`; eslint 10 no longer ships
`@eslint/js/src/configs/eslint-recommended.js`, so `@eslint/js` became a direct
devDependency using its public API; the eslint plugins ship as ESM, so `require`
returns the namespace and needs a `.default` unwrap.

Still blocking: typescript-eslint 8.67 refuses TypeScript 7.0 outright, so the
TypeScript major cannot land until typescript-eslint supports it — the branch
holds TypeScript at 5.8.3. Separately, eslint 10 and the react-hooks update
flag 79 existing findings (33 `react-hooks/set-state-in-effect`, 19
`no-useless-assignment`, 15 `preserve-caught-error`, 8 other react-hooks) which
need real fixes rather than suppression.

## What landed

The launch phase no longer narrates itself. The mint CTA is present in every
phase, matching PATH, and explains at the moment a visitor reaches for it that
minting is not open — fail-closed rules unchanged. Console copy follows one
shape, and capitalisation is normal sentence case throughout.

`/path` reads the deployment lock rather than the raw Sepolia address book, so
it presents the three phases like the other surfaces instead of showing a live
auction against superseded contracts.

Home invites the visit: `try it now` on the movement, and `Create the first
THOUGHT.` linking to `/thought`. Pre-launch stopped being modelled as an error
state, because it is the expected first state of production.

The copy rules themselves are in `AGENTS.md` under "Guidance and Copy
Principles", and guard tests in `scripts/thought-panel-ui.test.mjs` enforce two
of them.

## Running the site locally

Home serves everything and proxies `/thought`:

```
pnpm run dev:home      # 127.0.0.1:5173
pnpm run dev:thought   # 127.0.0.1:5174
```

THOUGHT launch phases are reachable as fixtures on the creation surface:

```
/thought/?surface=agent&launch=studio-preview
/thought/?surface=agent&launch=onchain-countdown
/thought/?surface=agent&launch=onchain-open
```

`/path` phases come from the deployment lock; `VITE_PULSE_STATUS=no_release`
forces the undeployed presentation without touching the lock.

## Constraints worth knowing

Every pull request targets `staging` first; `main` is promoted from `staging`.

The dev THOUGHT surface serves a byte-verified tagged snapshot, so a change to
`apps/thought/index.html` must be both reversed on restore and layered back
after verification, or the file and the served page disagree.

Snapshot deltas for `apps/thought/src/main.ts` map the tagged snapshot to
current. Regenerate them against the tagged snapshot, not against `HEAD`, and
verify `restore` then `layer` round-trips byte-identically.

A rendered page proves copy and layout only. Confirm which contract release and
addresses are behind it before treating it as evidence; `check:deployment` skips
all on-chain reads unless run with `--live`.

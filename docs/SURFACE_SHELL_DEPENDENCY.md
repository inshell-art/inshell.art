# surface-shell dependency maintenance

## Approved one-package maintenance policy

`apps/thought` consumes `surface-shell` from its Git repository, not npm. The
explicit Git URL preserves the reviewed `0.1.0` source; it does not establish
that Dependabot's pnpm resolver is fixed. The observed updater failure drops
the Git source and asks npm for `surface-shell@<commit>`, which returns 404.
Successful repository access followed by that 404 is not evidence of a bad
credential.

The operator approved manual Git-tag maintenance for **only `surface-shell`**
on 2026-10-03. OPS owns native GitHub Releases-only notifications and the
one-package Dependabot ignore. Application reviews each proposed tag update
using the procedure below. All other dependencies retain automatic upkeep on
their existing schedules and staging PR targets. This policy does not repair
the hosted Git resolver, dismiss security findings, select a newer release, or
authorize publication. PR #230 remains superseded; do not merge it wholesale.

Releases-only notifications cover published GitHub releases, not every tag or
commit. They prompt review, not automatic adoption. The exact-pin guard below
does not discover newer tags, and the existing upstream-release check covers
PATH and THOUGHT, not `surface-shell`. OPS reported saving and reopening the
Releases-only watch for `inshell-art/surface-shell`; Application's local checks
cannot verify that account setting. Upstream `0.2.0` has been noticed but is
not selected. The reviewed source remains `0.1.0`.

## Policy activation and verification

Dependabot reads its configuration from the default branch; `target-branch`
selects the manifests and version-update PR destination. A staging-only change
cannot activate a new default-branch updater policy. The relevant official
references are [configuration location](https://docs.github.com/en/code-security/concepts/supply-chain-security/about-the-dependabot-yml-file#where-to-store-the-dependabotyml-file)
and [target-branch behavior](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch).

The default-branch configuration has **not** been changed. OPS submitted the
native grouped-update command `@dependabot ignore surface-shell` on
[PR #228](https://github.com/inshell-art/inshell.art/pull/228#issuecomment-5965835727).
OPS subsequently reported the bot's
[show-conditions response](https://github.com/inshell-art/inshell.art/pull/228#issuecomment-5965870226)
at 2026-10-03 05:16:14 UTC: no ignore conditions were found for `surface-shell`.
PR #228 remained open. Native activation is therefore **not verified**; a
submitted comment is not a stored ignore. A new hosted check is pending, and
OPS is checking whether an existing Shell update PR supports the native rule.
OPS owns activation and verification; do not duplicate its commands.

[GitHub's native commands](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-pull-request-comment-commands)
provide per-dependency ignore and `@dependabot show surface-shell ignore
conditions`. OPS must retain the bot's actual response/conditions and the
subsequent hosted job result, checking that only this dependency is excluded
and other dependencies remain covered. The ignore command can close a grouped
PR; do not mistake closure for successful policy activation. Because Surface
Shell was skipped by the failed resolver and was absent from that PR's update
table, support for this invocation needs its actual bot response, not inference
from the documented command alone. Any service-side condition is separate from
the repository YAML and must be recorded that way. Recheck it after manually
upgrading the dependency or changing grouped-PR state; it is not a permanent
configuration guarantee.

Keep the hosted source-loss failure recorded even if the approved manual policy
is successfully activated. Excluding the package is deliberate mitigation, not
proof of resolver repair. Local checks and a frozen install establish neither
native policy activation nor hosted updater success.

The config-only main candidate is on hold: the required production
`check:release-evidence` gate includes `.github/dependabot.yml` in its source
identity. Do not weaken that check, rebind historical canaries, or publish main
to activate this policy. A provider-only deployment skip cannot waive required
GitHub checks or qualification. Production remains outside this change.

## Reviewed source identity

- Declaration: `git+https://github.com/inshell-art/surface-shell.git#0.1.0`.
- Annotated tag object: `fbb3039416b3e01a24545aa4e9dada3399762550`.
- Peeled source commit: `7dd91907089a73631d1794465c9e4be03967c475`.
- The pnpm codeload locator uses the annotated tag object above. It must not be
  described as the source commit.

`pnpm run check:dependency-security` checks the parsed active Dependabot npm
entry and the manifest → `apps/thought` lock importer → package tarball →
snapshot binding. Comments, unrelated importers and orphaned expected package
entries cannot satisfy that binding. The local npm policy may have no YAML
ignore (native service-side state is outside this file), or the exact single
unconditional `surface-shell` ignore. Other package exclusions, wildcards,
partial ignores and coverage-reducing allow rules are rejected. Passing this
guard is not evidence that the native ignore or release watch is active. It is
an exact-pin and local-policy check, not a freshness check or complete security
audit. No dependency version or resolution changes are part of this policy
alignment.

## Declared-source-first update procedure

Each manual source update still needs individual review. Use an isolated
staging-based candidate, with the repo's pinned pnpm version. A release alert
does not select a tag or authorize advancing staging or production.

1. Select and review the upstream tag and source diff. Read its exact tag object
   and peeled commit with `git ls-remote --tags https://github.com/inshell-art/surface-shell.git`.
   For annotated tags, distinguish the `refs/tags/<tag>` object from the
   `refs/tags/<tag>^{}` source commit. A lightweight tag points directly at its
   commit. A moved existing tag is a separate review finding, not an automatic
   repin.
2. Edit `apps/thought/package.json` first: set its `surface-shell` dependency to
   `git+https://github.com/inshell-art/surface-shell.git#<reviewed-tag>`.
   Run `pnpm install --lockfile-only` from the repository root. Do not use
   `pnpm update ... --lockfile-only --no-save`: that command can change the
   resolved source while leaving the old tag in both declarations, and even a
   frozen install can accept the mismatch.
3. Inspect the manifest and parsed `apps/thought` importer. Their specifiers
   must name the selected tag; the importer version and its connected package
   `resolution.tarball` and snapshot must identify the reviewed source object.
   Reject unexpected manifest or lock changes. Do not infer tag authenticity
   merely from a successful package-manager exit or a changed tarball URL.
4. After verifying those identities, update the reviewed specifier and codeload
   constants in `scripts/check-surface-shell-dependency.mjs` and the source
   identity above. Do not update guard expectations simply to clear a failure.
5. Run `pnpm install --frozen-lockfile`, `pnpm run test:surface-shell-dependency`,
   `pnpm run check:dependency-security`, the relevant runtime tests, type checks
   and builds. Review the documentation impact, regenerate owned outputs, run
   `pnpm docs:check`, and follow the normal leak/PUB checks before a commit.
   Inspect the final source diff: frozen install alone proves neither an honest
   declared tag nor updater success. A later updater or live Agent claim needs
   its own authorized evidence for that exact candidate.

## Documentation impact

This alignment changes internal maintenance policy documentation and semantic
guards, not dependency declarations, resolved source content or public App
behavior. Public documentation needs fingerprint regeneration only; no article
text, capability or release claim changes. This candidate does not activate the
native ignore, modify default-branch config, deploy, use provider credentials,
or run real Agent trials. OPS retains native-policy verification ownership.

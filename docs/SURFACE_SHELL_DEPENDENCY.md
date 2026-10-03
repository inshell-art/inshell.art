# surface-shell dependency maintenance

## Scope and remaining updater failure

`apps/thought` consumes `surface-shell` from its Git repository, not npm. The
explicit Git URL preserves the reviewed `0.1.0` source; it does not establish
that Dependabot's pnpm resolver is fixed. The observed updater failure drops
the Git source and asks npm for `surface-shell@<commit>`, which returns 404.
Successful repository access followed by that 404 is not evidence of a bad
credential.

Dependabot remains enabled with its existing daily root npm policy and
`staging` PR target. No package exclusion or manual-only maintenance policy is
approved. PR #230's exclusion is not part of this candidate. Choosing that
exclusion would give up automatic version-update attempts for this package;
the exact-pin check below does not supply newer-tag visibility. That tradeoff
requires an explicit operator decision. The existing upstream-release check
covers PATH and THOUGHT, not surface-shell.

Dependabot reads its configuration from the default branch; `target-branch`
selects the manifests and version-update PR destination. A staging-only change
cannot activate a new default-branch updater policy. The relevant official
references are [configuration location](https://docs.github.com/en/code-security/concepts/supply-chain-security/about-the-dependabot-yml-file#where-to-store-the-dependabotyml-file)
and [target-branch behavior](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch).
Keep the updater incident open until an authorized real updater run demonstrates
the intended Git resolution; local tests and a frozen install are not that proof.

## Reviewed source identity

- Declaration: `git+https://github.com/inshell-art/surface-shell.git#0.1.0`.
- Annotated tag object: `fbb3039416b3e01a24545aa4e9dada3399762550`.
- Peeled source commit: `7dd91907089a73631d1794465c9e4be03967c475`.
- The pnpm codeload locator uses the annotated tag object above. It must not be
  described as the source commit.

`pnpm run check:dependency-security` checks the parsed active Dependabot npm
entry and the manifest → `apps/thought` lock importer → package tarball →
snapshot binding. Comments, unrelated importers and orphaned expected package
entries cannot satisfy that binding. This is a reviewed exact-pin guard, not a
freshness check or a complete security audit. `js-yaml` remains at 4.3.2.

## Declared-source-first update procedure

This is the procedure for an individually approved source update, not adoption
of manual-only upkeep. Use an isolated staging-based candidate, with the repo's
pinned pnpm version. Do not advance staging or production without approval.

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

This correction changes internal dependency checks and the source spelling,
not shipped source content or public App behavior. Public documentation needs
fingerprint regeneration only; no new public capability or release claim is
made. No deployment, credentials, provider policy or real Agent trial is part
of this correction.

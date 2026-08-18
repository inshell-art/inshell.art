# THOUGHT Agent compatibility canaries

THOUGHT treats Codex and Claude Code as external runtimes. Unit tests prove the
protocol contract; live canaries prove that a specific installed Agent version,
host OS, and qualified THOUGHT deployment still complete a real sealed run.

## Commands

Codex against an explicitly selected qualified preview:

```sh
THOUGHT_LIVE_ORIGIN=https://staging.thought-inshell-art.pages.dev \
THOUGHT_LIVE_COMMIT_SHA=<exact-staging-commit> \
pnpm test:thought-agent-codex:live
```

Claude Code against an explicitly selected qualified preview:

```sh
THOUGHT_LIVE_ORIGIN=https://staging.thought-inshell-art.pages.dev \
  THOUGHT_LIVE_COMMIT_SHA=<exact-staging-commit> \
  pnpm test:thought-agent-claude:live
```

Claude Code must already be installed and authenticated. The canary resolves an
explicit `THOUGHT_CLAUDE_BIN`, a `claude` executable on `PATH`, or the newest
native Claude Code installation managed by Claude Desktop on macOS. It does not
mistake Claude Desktop's Linux VM executable for a host CLI. Claude Desktop being
installed or signed in does not replace the CLI's own `claude auth status`
requirement.

For an interactive Claude compatibility check, prepare a short-lived run and
copy its handoff to the macOS clipboard:

```sh
THOUGHT_LIVE_ORIGIN=https://staging.thought-inshell-art.pages.dev \
THOUGHT_LIVE_COMMIT_SHA=<exact-staging-commit> \
THOUGHT_CANARY_RUNNER_ID=mac-b \
THOUGHT_CLAUDE_MANUAL_STATE_FILE=/private/tmp/thought-claude-manual.json \
pnpm test:thought-agent-claude:manual prepare
```

Open interactive Claude Code, paste the handoff, approve only the exact staging
App connection, and wait for a returned receipt. Then collect the redacted cell
with the same environment and `collect` instead of `prepare`. Use `cancel` to
close an abandoned run. The state file is mode 0600, expires after 30 minutes,
contains no creative input or launch credential, and is deleted after collection
or cancellation. The clipboard is cleared only when it still contains the exact
handoff.

The canary uses print mode, disables session persistence, limits the tool
surface to Bash, strips unrelated host environment variables, and requires
Claude Code's native sandbox to start. The manually confirmed workflow dispatch
is stated as the current operator approval for the exact staging exchange; no
permission bypass is used. The sandbox denies reads from the host
home directory, permits writes only in the empty canary directory, forbids
unsandboxed fallback, and restricts network access to the exact qualified
preview host. The canary caps turns and spend and creates no mint transaction.
It must not default to production; `THOUGHT_LIVE_ORIGIN` is required.

Both live canaries fail closed unless `/api/ops/status` proves that the target is
the qualified `staging` preview, exposes the V2 Agent route, and serves the exact
40-character `THOUGHT_LIVE_COMMIT_SHA`. The local checkout must be clean and its
HEAD must equal that same SHA; an older staging deployment cannot be qualified
from a newer or dirty development checkout. Production, LAN, local, a moving branch
name, and a mismatched preview deployment are rejected. Each canary writes its
validated report to `THOUGHT_COMPATIBILITY_REPORT_FILE` when that variable is
present.

## Two-Mac release workflow

`.github/workflows/thought-agent-canaries.yml` is a manually dispatched release
qualification workflow. It is intentionally separate from preview deployment
and production promotion. Its inputs are the exact staging candidate commit,
qualified preview origin, Claude spend ceiling, and explicit confirmation that
four paid Agent calls may run.

The workflow:

1. checks that the candidate is an exact commit reachable from `staging`;
2. checks that qualified preview serves that exact commit and V2 Agent route;
3. runs Codex then Claude Code on each of two trusted macOS runners;
4. uploads one redacted report per Agent and host;
5. rejects missing, duplicated, failed, stale, mixed-commit, or mixed-protocol
cells; and
6. publishes a four-cell matrix artifact and workflow summary.

The required self-hosted runner labels are:

- Mac A: `self-hosted`, `macOS`, `inshell-agent-canary`, `mac-a`
- Mac B: `self-hosted`, `macOS`, `inshell-agent-canary`, `mac-b`

Run each runner under the macOS account that owns the authenticated Codex and
Claude Code sessions. Use a dedicated account with no unrelated source repos,
cloud credentials, wallets, or operator secrets. Keep the runner current enough for the Node 24 GitHub
actions used by checkout, setup-node, and artifact upload/download. Do not make
these runners available to pull-request workflows or forks. The workflow accepts
only an exact trusted staging ancestor, and Agent credentials remain in the
host account rather than GitHub secrets.

The default machine endpoint is the public staging THOUGHT Pages alias rather
than `preview.inshell.art`, because the canonical preview domain is protected by
Cloudflare Access while external Agent curl calls carry only their run-scoped
THOUGHT credentials. The branch alias serves the same staging commit; the
canary verifies that exact commit before creating a run.

Before the first dispatch on each Mac:

```sh
codex login status
claude auth status
```

Claude Desktop-managed installations are discovered automatically on macOS even
when `claude` is absent from `PATH`. Authentication is still specific to the CLI
session used by the runner.

GitHub only exposes a manually dispatched workflow after its workflow file is
present on the repository's default branch. Until this infrastructure has passed
staging review and receives operator approval for production promotion, run the
same canary commands locally on both Macs. After promotion, use **Actions →
THOUGHT Agent compatibility canaries → Run workflow** and supply the exact
deployed staging commit. Register both self-hosted runners before that first
dispatch; the workflow will otherwise remain queued rather than silently using a
GitHub-hosted substitute.

## Report contract

Both canaries emit
`inshell.thought.agent-compatibility-report.v1`. The report is intentionally
allow-list-only. It may contain:

- Agent adapter, CLI surface, version, model, and optional reasoning effort;
- host OS, architecture, and Node version;
- target class and protocol version;
- pass/fail stage, run state, duration, receipt hash, and bounded error code.

It must not contain an origin URL, run ID, bearer credential, launch or browser
token, prompt, Agent output, or artwork bytes. The parser rejects extra fields
and secret-like text in allow-listed fields.

## Release use

Run the four-cell matrix before production promotion. Keep external canaries
outside the ordinary pull-request gate: they consume paid Agent service, depend
on operator authentication, and can fail because of provider availability
rather than repository code. A green matrix qualifies the Agent integration; it
does not merge staging, deploy production, or replace operator preview approval.

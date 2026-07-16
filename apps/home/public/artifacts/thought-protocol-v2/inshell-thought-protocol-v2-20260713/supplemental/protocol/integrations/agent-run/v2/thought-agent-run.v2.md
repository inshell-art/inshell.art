# THOUGHT Agent Run V2

Identifier: `inshell.thought.agent-run.v2`

The sealed task contains one immutable `promptLine`, exact V2 spec bytes/anchor, and strict Agent-result schema. It contains no divergent `rawPrompt`.

Lifecycle: `created`, `claimed`, `running`, `returned`, `failed`, `cancelled`, `expired`.

The first valid result wins. An identical byte-for-byte retry is idempotent success; a different later result conflicts and never overwrites. Transport retries resend captured bytes and never invoke a second creative act.

Browser/view credentials cannot submit results. Agent/write credentials cannot expose unrelated runs and never appear in user-visible URLs, logs, provenance, or fixtures.

Public same-origin routes are `https://inshell.art/thought` and `https://inshell.art/thought/runs/:runId`.

# THOUGHT Agent Run V2

Identifier: `inshell.thought.agent-run.v2`

The sealed task contains one immutable `promptLine`, exact V2 spec bytes/anchor, and strict Agent-result schema. It contains no divergent `rawPrompt`.

Claim returns the exact spec instructions, the exact prompt, and a structured output contract naming `inshell.thought.work.v2`. That contract declares a 1-through-64-byte shortest-form UTF-8 `agentLine`, no normalization, and that display units are not acceptance limits. Agent adapters must wait for Claim success before generating output.

Before Result, the adapter must validate the exact candidate bytes against the claimed work profile. An invalid candidate must transition the run to `failed` through the failure endpoint; it must not be submitted to Result, clipped, normalized, repaired, or regenerated inside the same run. Result repeats the same validation as the authoritative boundary.

Lifecycle: `created`, `claimed`, `running`, `returned`, `failed`, `cancelled`, `expired`.

The first valid result wins. An identical byte-for-byte retry is idempotent success; a different later result conflicts and never overwrites. Transport retries resend captured bytes and never invoke a second creative act.

Browser/view credentials cannot submit results. Agent/write credentials cannot expose unrelated runs and never appear in user-visible URLs, logs, provenance, or fixtures.

Public same-origin routes are `https://inshell.art/thought` and `https://inshell.art/thought/runs/:runId`.

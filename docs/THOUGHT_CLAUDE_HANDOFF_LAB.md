# THOUGHT Claude Handoff Lab

## Purpose

This lab qualifies the Claude-specific THOUGHT handoff before the App treats a revision as usable. It tests the handoff text and run protocol; it does not test Claude's creative quality.

The Claude handoff follows the same product principles as Codex:

- descriptive constraints instead of pasted shell programs;
- bounded preflight first, then exactly one creative turn;
- no creator confirmation after a successful preflight;
- extra chat turns only for evidenced control recovery;
- exact run values grouped in a compact angle-bracket capsule;
- no installation or configuration request to the creator;
- sealed creative input until control succeeds;
- release, selected-spec, creative-brief, prompt, result, and runtime-evidence parity;
- one adapter-bound claim and at most one creative result.

Cowork adds two non-negotiable constraints:

- the handoff states plainly that the creator selected Claude, can read the
  handoff, and can inspect the App run;
- the App endpoint must be publicly reachable HTTPS. Cowork is hosted and
  cannot reach localhost or a private LAN address.

The handoff protects one-run bearer values from accidental disclosure, but it
must never tell Claude to hide the prompt, result, or transport from the
creator. It also must not prescribe a fabricated success line. Success means
the App returned a real receipt.

## Deterministic matrix

Run:

```text
pnpm handoff:lab:claude deterministic
```

The ten cases cover the happy path, retained bridge credentials, maximum output, quoted values, malformed claim, unavailable runtime identity, malformed readiness, absent optional effort, release drift, and rejected result delivery.

Every case runs against a disposable loopback fixture server and writes a redacted JSON and Markdown report. A candidate fails qualification if any case fails.

## Claude surfaces

The App presents one creator-facing Agent choice: **Claude**. Cowork is the
target surface because THOUGHT is a bounded creative task, not a coding
project. It is used only with the private run service at a publicly reachable
HTTPS origin and only after the current handoff revision has passed a real
Cowork canary.

Claude Code remains an explicit developer compatibility surface. The App does
not silently move a failed or expired Cowork run into Code: that would change
the execution surface after the creator made a choice and could duplicate one
run. Recovery returns to Agent selection and always creates a new run ID.

Both surfaces retain the same `claude` adapter and `Claude` Agent identity. Their bridge platform and adapter-version fields distinguish how the run was transported.

## Real Claude Cowork canary

Deploy the candidate THOUGHT App and Agent API at a publicly reachable HTTPS
origin, then prepare and open one canary:

```text
pnpm handoff:lab:claude real-prepare --origin https://candidate.example --surface cowork --open
```

Claude Desktop opens a new Cowork task using `claude://cowork/new?q=...`. The creator clicks Submit once. The handoff itself must continue automatically after a successful preflight; `RETRY` is reserved for an observed recoverable blocker.

The lab rejects `localhost`, loopback, and private-LAN origins before it creates
a Cowork run. This is a structural reachability check, not a warning that may
be ignored.

To exercise the local compatibility surface explicitly, use `--surface code`.
That canary may use localhost or LAN and opens `claude://code/new?q=...`; it
does not qualify Cowork.

## Local App with the public run service

The local THOUGHT browser and Anvil lane may keep running on localhost while
Claude talks only to the public HTTPS run service. Start the complete local
stack with:

```text
pnpm dev:thought:stack:public-agent
```

The browser sends same-origin `/api/thought-agent/v2` requests through the Vite
proxy. The sealed Claude handoff receives the exact public run URL instead of
the localhost proxy URL. Codex uses the same run service and protocol. No
one-run folder, LAN permission, or local-file permission is part of this flow.

Public reachability does not make runs public. Browser and Agent access remain
separated by short-lived run-scoped bearer values, responses are `no-store`,
and the D1 run row is eligible for deletion after 24 hours.

Before asking a creator to submit in Cowork, verify the public transport
without Claude:

```text
pnpm test:thought-agent-claude:public
```

That command exercises create, claim, ready, start, result, and browser readback
against the public service using Claude's exact adapter profile. It qualifies
transport only; it cannot substitute for the final real Cowork canary.

Observe the returned run using the exact command printed by `real-prepare`. Private task, link, and session files are removed when the run reaches a terminal state; the redacted report remains.

## Qualification rule

A Claude handoff revision is eligible for App rollout only when:

1. the complete deterministic matrix passes;
2. the Claude deep link preserves the exact sealed task within the supported URL limit;
3. a real Claude Cowork canary returns a valid App receipt;
4. no test or report exposes credentials or creative input before `/start`;
5. Codex regression tests continue to pass.

The checked-in Cowork qualification record remains `qualified: false` until a
reviewed real-canary report satisfies all five conditions. Deterministic tests
alone can never flip it.

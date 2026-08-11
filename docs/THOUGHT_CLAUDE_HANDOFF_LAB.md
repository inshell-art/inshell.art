# THOUGHT Claude Handoff Lab

## Purpose

This lab qualifies the Claude-specific THOUGHT handoff before the App treats a revision as usable. It tests the handoff text and run protocol; it does not test Claude's creative quality.

The Claude handoff follows the same product principles as Codex:

- descriptive constraints instead of pasted shell programs;
- bounded preflight first, then exactly one creative turn;
- no creator confirmation after a successful preflight;
- extra chat turns only for evidenced control recovery;
- bootstrap transport values grouped in a compact angle-bracket capsule;
- no installation or configuration request to the creator;
- sealed creative input until control succeeds;
- App-issued authority, release, Work Specification, Creative Brief, prompt,
  result, and runtime-evidence parity;
- one adapter-bound claim and at most one creative result.

Claude Code adds three non-negotiable constraints:

- the handoff states plainly that the creator selected Claude, can read it, and
  can inspect the App run;
- the exact surface, bridge, and adapter fields bind the run to Claude Code;
- runtime identity must come from the Code host and may never be guessed.

The handoff protects one-run bearer values from accidental disclosure, but it
must never tell Claude to hide the prompt, result, or transport from the
creator. It also must not prescribe a fabricated success line. Success means
the App returned a real receipt.

The visible handoff is editable bootstrap text and never a creative trust
root. Claim and start responses carry the exact App-issued run-authority
contract. Only the start response supplies canonical creative input and
release identity. A receipt proves App acceptance and binding, not transcript
purity or absence of outside influence.

## Deterministic matrix

Run:

```text
pnpm handoff:lab:claude deterministic
```

The ten cases cover the happy path, retained bridge credentials, maximum output, quoted values, malformed claim, unavailable runtime identity, malformed readiness, absent optional effort, release drift, and rejected result delivery.

Every case runs against a disposable loopback fixture server and writes a redacted JSON and Markdown report. A candidate fails qualification if any case fails.

## Browser release-parity canary

The deterministic matrix and protocol-only transport tests are insufficient
when the browser App can bind a stale release into a run. With
the local THOUGHT App and Anvil lane running, execute:

```text
pnpm canary:thought-agent:local
```

This launches fresh headless browser sessions for ChatGPT/Codex and Claude. In
each session it enters a prompt through the real THOUGHT UI, selects the Agent,
captures the exact bootstrap handoff emitted by the page, and completes the
run through `/result`. It fails unless the protocol release ID and manifest
hash are identical across:

1. the run-creation response;
2. the App-owned operation contract;
3. the creative request returned by `/start`;
4. the result accepted by the App.

The bootstrap handoff must contain neither release value. The canary also
checks that claim and start return the exact App-issued run-authority object.

The canary also requires the browser to poll the terminal `returned` state,
records failed network requests, and writes a screenshot. Run this gate after
any App runtime, release, handoff, or Agent-protocol change and before asking a
creator to perform a real Agent submission.

## Claude surfaces

The App presents one creator-facing choice: **Claude**. Every new Claude run
opens Claude Code through `claude://code/new?q=...`. Code is the canonical
surface because the THOUGHT exchange needs a protocol-client environment: it
must perform bounded authenticated requests, retain one-run state, verify
hashes, and return a typed result.

Cowork remains an explicit legacy compatibility surface. It can be exercised
only by passing `--surface cowork` to the lab. The App never selects it for a
new run and never falls back to it after a Code failure. Existing stored Cowork
runs may still be resumed without changing their run ID or execution surface.

Both surfaces retain the same `claude` adapter and `Claude` Agent identity. Their bridge platform and adapter-version fields distinguish how the run was transported.

## Real Claude Code canary

Deploy the candidate THOUGHT App and Agent API at a publicly reachable HTTPS
origin, then prepare and open one canary:

```text
pnpm handoff:lab:claude real-prepare --origin https://candidate.example --surface code --open
```

Claude Desktop opens a new Code task using `claude://code/new?q=...`. The
creator clicks Submit once. The handoff must continue automatically after a
successful preflight; `RETRY` is reserved for an observed recoverable blocker.

Code can use a local, LAN, or public HTTPS App endpoint when that environment
can reach it. No one-run folder is part of the protocol. To inspect the retired
Cowork integration explicitly, use a public HTTPS origin and `--surface
cowork`; that run is compatibility evidence only and cannot qualify active App
routing.

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

Before asking a creator to submit in Claude Code, verify the public transport
without Claude:

```text
pnpm test:thought-agent-claude:public
```

That command exercises create, claim, ready, start, result, and browser
readback against the public service using Claude Code's exact adapter profile.
It qualifies transport only; it cannot substitute for the final real Code
canary.

Observe the returned run using the exact command printed by `real-prepare`. Private task, link, and session files are removed when the run reaches a terminal state; the redacted report remains.

## Qualification rule

A Claude handoff revision is eligible for App rollout only when:

1. the complete deterministic matrix passes;
2. the browser release-parity canary passes for both ChatGPT/Codex and Claude;
3. the Claude deep link preserves the exact sealed task within the supported URL limit;
4. a real Claude Code canary returns a valid App receipt;
5. no test or report exposes credentials or creative input before `/start`;
6. Codex regression tests continue to pass.

The checked-in Cowork qualification record remains `qualified: false` as a
legacy marker and is not imported by active routing. A reviewed Code canary is
the live qualification evidence for the current Claude handoff.

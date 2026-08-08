# THOUGHT Codex Handoff Lab

## Purpose

This lab develops and release-checks the sealed THOUGHT handoff for Codex only. It does not test other Agents, alter the THOUGHT creative specification, or replace the App/backend integration tests.

The lab has two lanes:

1. **Deterministic lane:** exercises the handoff's four declarative operations against an isolated fixture backend. It is fast, repeatable, and required after every handoff change.
2. **Real Codex canary:** creates one local THOUGHT run and opens the actual sealed handoff in Codex Desktop. It captures environment-dependent behavior that a fixture cannot simulate, including permission flow and active-turn runtime evidence.

The deterministic report contains hashes, operation names, validation states, and assertions. It never contains launch credentials, bridge credentials, the returned Agent line, or the creative prompt.

The run is deliberately split into three independently checked layers:

- a short creator-facing explanation of what will happen and when interaction is justified;
- a constrained declarative contract naming four ordered operations, exact evidence, accepted states, and stop conditions.
- two sealed creative inputs opened only after preflight: the complete selected
  protocol specification and the smaller Agent creative brief. They have
  separate identities and hashes and must never be treated as aliases.

Concrete private values are defined once using conventional placeholders such as `<run_id>` and `<app_endpoint>`. The successful claim defines `<bridge_credential>` from the exact top-level `bridgeToken` response field. The complete claim response and credential must be retained together before secondary validation, reused through the remaining operations, and never reacquired with a second claim. Every operation refers back to placeholders instead of repeating raw identifiers, URLs, or credentials. Payload requirements use exact dotted field paths such as `bridge.bridgeId`, which preserve nesting without exposing raw JSON programs.

Codex chooses the available mechanics for those operations. It may not change endpoints, reorder operations, invent runtime identity, open creative input before readiness, or claim success without a receipt. The exact host-issued model is required; host-issued reasoning effort is retained when present but is not required. Runtime metadata is resolved once before readiness and reused without inference. The handoff contains no generated shell, JavaScript, raw JSON program, or temporary-file program.

The selected specification is `THOUGHT.v2.md`, pinned by the canonical portable
Contract release. It remains the protocol-facing source for work identity,
provenance/attestation boundaries, PATH consumption, metadata, and renderer
identity. `THOUGHT.agent-creative.v2.md` contains only the rules needed to
produce one response. This removes protocol machinery from the creative
instruction surface without weakening release or selected-spec binding.

Failure requests deliberately omit `failedAt`. The App records the canonical UTC failure time, avoiding Agent-generated timestamp drift.

## Trust boundary

The visible Agent handoff is editable orchestration and creator-facing UX. It is never a trust root. The App stores a SHA-256 digest beside the exact generated handoff and verifies that digest before reopening a saved launch. This detects accidental browser-storage or implementation drift, but it is not proof that a creator did not edit text after the deep link opened.

Enforceable rules remain on the THOUGHT backend: run-state transitions, bearer authorization, prompt/spec hashes, bounded-control evidence, release binding, output schema, byte limits, declaration status, result hashes, and one accepted result. Receipts state `appAcceptedAndBound: true` and `providerAttested: false`. Agent declarations remain `declared-unverified`.

Creation Attestation therefore means that the official THOUGHT App accepted the result through this run protocol and bound it into the mint facts. It does not mean that Codex or its provider cryptographically signed the output, nor does it independently prove authorship, model identity, or the truth of an Agent declaration.

Local App authorization is treated as Codex-turn scoped. The initial turn and every later `RETRY` turn must acquire the same narrow App permission before making an exchange. A loopback connection refusal without active permission is not accepted as evidence that the App itself stopped.

## What is tested

The V1 matrix covers:

- automatic control-to-creative success without a `CREATE` gate;
- exact extraction and full-run retention of the one-time top-level `bridgeToken`;
- the exact 64-byte Agent-line boundary;
- quoted values in declarative transport data;
- malformed claim, readiness, and creative-release responses;
- unavailable required runtime model and unavailable optional reasoning effort;
- rejected result submission;
- prompt sealing until readiness;
- at most one result submission;
- fail-closed behavior and redacted reports;
- independent selected-spec and creative-brief hash checks;
- no embedded shell/JavaScript/raw-JSON programs, defined angle-bracket placeholders, one occurrence of each private literal, four-operation structure, and a 7 KB visible-handoff ceiling.

## Deterministic workflow

List the matrix:

```sh
pnpm handoff:lab:codex list
```

Run every case:

```sh
pnpm handoff:lab:codex deterministic
```

Run one case while developing:

```sh
pnpm handoff:lab:codex deterministic --case runtime-capability-unavailable
```

Reports are written under `tmp/thought-handoff-lab/<batch-id>/` as `report.json` and `report.md`. A failed assertion exits nonzero. `pnpm test:thought-handoff-lab` is the release-gate form.

## Real Codex canary

The local THOUGHT stack must already be running. No Agent, browser extension, package, or tool installation is part of this workflow.

1. Create a canary and open its sealed task in Codex Desktop:

   ```sh
   pnpm handoff:lab:codex real-prepare --origin http://127.0.0.1:5177 --open
   ```

2. Codex opens a new disposable task with the sealed handoff prefilled. Click **Submit** once to start that task. This launch click is required; the deep link does not submit the task automatically.

3. After submission, approve the narrow App connection only if Codex requests it. If Codex shows the exact plain `RETRY` recovery message, resolve that one permission and reply `RETRY`. Do not reply `CREATE`; successful control must continue automatically.

4. Copy the `sessionPath` printed by step 1 and observe the run:

   ```sh
   pnpm handoff:lab:codex real-observe --session '<sessionPath>' --control-actions none
   ```

   If a permission or `RETRY` was needed, replace `none` with a short factual value such as `approved App connection` or `one RETRY`. Do not count the required initial Submit click as a control action; it is recorded separately.

The observer writes `real-canary-report.json` in the canary directory. The report records terminal state, receipt hash, model, reasoning effort, Agent-line hash, the required launch submission, and any later control intervention. It omits all transport credentials and creative text. Once the run reaches a terminal state, the observer deletes the private session, sealed-task, and deep-link files automatically.

## Reading failures

- **Deterministic failure:** first treat it as a handoff or fixture-harness regression. Inspect the failed assertion and operation marker in `report.md`.
- **Real canary failure with deterministic PASS:** treat it as Codex-environment evidence. Preserve the redacted report and the exact plain creator-facing message, then add the smallest reproducible matrix case before changing the handoff.
- **Both lanes fail:** fix the deterministic defect first, rerun the complete matrix, then repeat one real canary.

Do not patch the handoff from a single anecdotal failure. Promote a change only after the failure is represented by a named case, the full deterministic matrix passes, and one real Codex canary returns successfully without unnecessary creator interaction.

# THOUGHT Codex Handoff Lab

## Purpose

This lab develops and release-checks the sealed THOUGHT handoff for Codex only. It does not test other Agents, alter the THOUGHT creative specification, or replace the App/backend integration tests.

The lab has two lanes:

1. **Deterministic lane:** exercises the handoff's four declarative operations against an isolated fixture backend. It is fast, repeatable, and required after every handoff change.
2. **Real Codex canary:** creates one local THOUGHT run and opens the actual sealed handoff in Codex Desktop. It captures environment-dependent behavior that a fixture cannot simulate, including permission flow and active-turn runtime evidence.

The deterministic report contains hashes, operation names, validation states, and assertions. It never contains launch credentials, bridge credentials, the returned Agent line, or the creative prompt.

The visible handoff is deliberately split into two layers:

- a short creator-facing explanation of what will happen and when interaction is justified;
- a constrained declarative contract naming four ordered operations, exact evidence, accepted states, and stop conditions.

Concrete private values are defined once in the Run Capsule using conventional placeholders such as `<run_id>` and `<app_endpoint>`. Every operation refers back to those placeholders instead of repeating raw identifiers, URLs, or credentials. Payload requirements use exact dotted field paths such as `bridge.bridgeId`, which preserve nesting without exposing raw JSON programs.

Codex chooses the available mechanics for those operations. It may not change endpoints, reorder operations, invent runtime identity, open creative input before readiness, or claim success without a receipt. The handoff contains no generated shell, JavaScript, raw JSON program, or temporary-file program.

Local App authorization is treated as Codex-turn scoped. The initial turn and every later `RETRY` turn must acquire the same narrow App permission before making an exchange. A loopback connection refusal without active permission is not accepted as evidence that the App itself stopped.

## What is tested

The V1 matrix covers:

- automatic control-to-creative success without a `CREATE` gate;
- the exact 64-byte Agent-line boundary;
- quoted values in declarative transport data;
- malformed claim, readiness, and creative-release responses;
- unavailable runtime capability and active-turn runtime metadata;
- rejected result submission;
- prompt sealing until readiness;
- at most one result submission;
- fail-closed behavior and redacted reports;
- no embedded shell/JavaScript/raw-JSON programs, exact nested request field paths, defined angle-bracket placeholders, one occurrence of each private literal, four-operation structure, and an 8 KB visible-handoff ceiling.

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

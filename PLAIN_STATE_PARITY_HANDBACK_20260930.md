# Plain-return UI correction — local review candidate

## Status and scope

Local changes only, based on `6ac267c3cffa1e80ed6474e5df33b7da72ec4a02`
(tree `63660fbb118fcf5640d2a095c8b3f3486dd08818`). No commit, push, PR,
deployment, provider changes, live Agent run, signing or chain operation.
Checkout: `/Users/bigu/.codex/worktrees/thought-option2-release/inshell.art`.
The isolated dev listener is localhost:5190, not the operator's 5177 session.

Baseline: approved production `024ba2ab218b5ad3e535c495cf0f85996871d387`.
Staging `f77b09874d4584e3831e3025962de19acf2acc9f` has the same relevant formal
rail and cancel/reset/resume behavior. Neither deployed reference was changed.

The earlier formal-parity handback was too broad: its direct formal/plain
comparison chiefly proved idle geometry and actions. Subsequent plain states
asserted their own expected behavior. Live desktop inspection proved saved Load,
not full state parity. Those results and handbacks remain valid within those
limits; they are not replaced or erased by this correction.

## Reproduced cause

With a fake intercepted create/read/cancel endpoint, in both light and dark:

1. Enter `Hello?`, Send: chooser guidance lacked the shared warning class and
   showed a running ellipsis while waiting for a choice.
2. Refresh pending: the client retained the validated prompt, but the presenter
   restored only returned-work prompts. The input therefore became empty/read-only.
3. Cancel: generic terminal rendering retained the empty/read-only input and
   supplied Load/Reset instead of restoring editable prompt/Send/Load.

This is a reproducible path, not a claim about the operator's exact click sequence.
`before-complete/report.json` records 36 failed comparisons across both themes.

## Source/state matrix

Paths below are relative to this checkout. Reference line numbers are for the
current unchanged formal `apps/thought/src/main.ts`; the pinned production source
is read directly by the regression script, not from current presenter expectations.

| State/transition | Confirmed reference | Actual plain presentation / correction |
|---|---|---|
| Empty | `getThoughtDockRailView` 5166; input-lock predicate 3638 | Editable empty input; disabled Send, Load. Neutral Start with a prompt. |
| Ready | rail 5182; input-lock predicate | Exact entered bytes, editable; enabled Send, Load. Validation focuses input and now uses warning tone, not error. |
| Draft refresh/clear | `readSessionState` / `writeSessionState` 7325–7355 | Unsent line survives same-tab refresh via a separate session-only draft key. Empty input/Reset persists an explicit empty value, distinct from an absent draft; confirmed Cancel → clear → refresh cannot restore the cancelled prompt. Pending validated line takes precedence over stale draft while active. No localStorage draft fallback. |
| Up/Down history | prompt-history helpers and editor 3970–4045, 23484 | Reuse `thought-prompt-history.ts`, limit 50; explicit native launch records prompt, not mere prepare/cancel. Up recalls older lines, Down returns to the captured current draft. Typing resets cursor. Browser-local history has separate plain key and session fallback; Reset keeps history. |
| Cmd/Ctrl+Enter | editor keydown 23484–23500 | Same Send button/validation and synchronous disabled latch; repeat and IME composition ignored. No submission on mobile, empty or noneditable state; no double create. |
| Preparing | rail 5219; progress kinds 4750 | Locked original prompt, no actions; neutral Preparing task; one active ellipsis. No reset/retry while create acknowledgement is unknown. |
| Choosing | rail 5194; console transition 3775 | Original locked prompt; ChatGPT, Claude, Cancel. Amber Task ready and No-folder guidance. No progress ellipsis. |
| Explicit native link | launch detail 3087; warning guard in `scripts/thought-panel-ui.test.mjs:1675` | One explicit link action only. Then Check return, Cancel; amber waiting/permission guidance. Browser tests suppress OS dispatch while exercising the real click handler. |
| Pending refresh | `resumeThoughtDockPendingRun` 6513 | Restore validated pending prompt before check/render. Locked line remains visible. Launch packet deliberately remains transient; Check return/Cancel, never auto-relaunch. |
| Confirmed Cancel | chooser cancel 5114; cancel/reset 6449 | Preserve line; editable Send/Load; focus prompt; Task cancelled body explains new-task choice. A new create occurs only after a fresh explicit Send. Confirmed cancelled state remains terminal in the client. |
| Cancel not confirmed | deliberate new-transport boundary | Do not unlock/reset. Amber Delivery uncertain; Check return, Cancel; sanitized report and next step. |
| Return wins Cancel | deliberate new-transport boundary | Keep and render returned work for review; never discard it or turn it into editable input. |
| Waiting progress | progress predicate 4763 | Only active preparing/waiting gets ellipsis; choosing, errors, uncertainty and terminal work do not. Plain status cannot assert legacy claim/ready/start phases. |
| Rejected | failed rail 5375 | Preserve locked prompt; Reset only, not generic Load/Reset. Error Return rejected, no resend, actionable next step/report. |
| Expired | expired rail 5369 | Preserve locked prompt; Reset only. Plain exchange TTL warning is deliberately not the legacy Agent-link error claim. |
| Lost create acknowledgement | new-transport boundary | Preparation uncertain, warning/report; only Return to THOUGHT. No invented Check/Cancel/Reset access and no automatic retry. |
| Returned | formal returned/preview/work-ready rail 5255–5335 | Exact rendered work, locked prompt; Review complete, Check return when capability valid, Load, Reset. Success Return received; unknown provider/model and mint-ineligible facts remain explicit. |
| Reviewed | explicit experimental review requirement | Save replaces Review complete. No Mint. No claim that an external model or creative-start protocol was verified. |
| Saved | formal work-ready save mapping 5300 | Disabled Saved, then available Check return, Load, Reset. No stale Save next step. Browser-local record bytes unchanged. |
| Load panel | load action 5130–5150 | Load ↓ toggle; shared browser-local guidance; focus saved-work selector; empty selector disabled. No new API/create. |
| Loaded | formal work-loaded event 23512 | Exact validated saved work/prompt, locked; Saved disabled, Load, Reset. No Check return after detached local load. |
| Reset | reset action 5106; reset body 6473 | Clear work/prompt and close panel; focus editable input; empty Send disabled, Load retained. History keeps Work reset. |
| Mobile empty/ready | mobile query 5544; mobile rail 5159 | Load only, Continue on desktop guidance; no native-creation CTA. Query matches baseline including short coarse landscape. Saved work remains viewable/loadable. |
| History/report | console renderer 4815 | Timestamps, shared tone tokens, newest append first, historical report retained, obsolete next steps removed. No prompt/response/credential in sanitized report. |

Implementation anchors: `plain-return/view.ts` `canEditPrompt`, `readDraft`,
`writeDraft`, `recordPrompt`, input/keydown listeners, `renderHistory`, `message`,
`render`, `cancelTask`, `start`; `plain-return/client.ts` prompt-only accessor
95, check/cancel guard 103/117. No default runtime import or shared-store mutation.

## Intentional differences and limits

- The formal legacy controller cancels optimistically. It is NOT imported.
  Plain cancellation still requires the server's confirmed terminal response.
  In-flight duplicate cancellation and polling are suppressed; an older read
  cannot overwrite cancellation, and a returned response wins over cancellation.
- One plain return, explicit review, unknown provenance, no start-only assertion,
  mint-ineligible records, opt-in/server gate and isolated saved store remain.
  Legacy claim/ready/start, wallet/Mint, and retry/replay transport are not added.
- Check return/Cancel replace the legacy waiting Reset because a local reset
  cannot prove remote cancellation. After refresh the private launch packet is
  not recoverable; cancel then explicitly start a new task if needed.
- Plain history remains chronological append order, not legacy guidance-bucket
  sorting. This avoids old warnings outranking a new successful return.
- Editor parity is included: draft refresh, Up/Down history/current-draft return,
  Cmd/Ctrl+Enter, IME/repeat guards, reset/clear, and pending precedence. Active,
  uncertain and returned work cannot be mutated or resubmitted by these keys.
  Prompt history contains only launched artistic lines; draft/history keys remain
  separate from legacy stores, capabilities, URL fields, logs and Console history.
- Browser evidence is synthetic API interception, not a real desktop Agent
  canary or live staging verification. No new live acceptance is asserted.

## Verification and evidence

Evidence root: `tmp/plain-state-parity-20260930/` (local, not a source commit).

- `before-complete/report.json`: 36 failed baseline-derived comparisons, 46
  screenshots plus per-theme network summaries. Earlier `before/` contains the
  interrupted harness run; it is retained, not passed off as a completed check.
- `after-final/report.json`: earlier pre-editor 48-screenshot pass retained.
- `editor-r1/report.json`: earlier 60-screenshot pass retained. OPS independently
  passed that same 60-state scope, then found an additional failing case:
  confirmed Cancel → clear → refresh restored the old cancelled prompt and
  enabled Send. Failed evidence remains at
  `/private/tmp/thought-ui-final-review-mZ8rZQ/cancel-clear.json` and its adjacent
  `cancel-clear.mjs` reproduction. Neither the earlier pass nor this failure is erased.
- `editor-r2/report.json`: final 62 screenshots (31 states/viewports per theme),
  zero failed comparisons; exact shared warning color `rgb(181, 122, 0)`;
  zero horizontal overflow, visible mint panels, external requests, actual API
  calls or native launches. All API traffic intercepted. Prompt value/read-only,
  action order/disabled controls, focus and progress are asserted on actual DOM.
- The new cancelled-clear-refresh case asserts an editable empty field, disabled
  Send, explicit empty sessionStorage value, no localStorage draft and no extra
  create after either keyboard shortcut. Reset refresh, pending-over-draft while
  active, uncertainty and returned-work behavior remain covered.
- `editor-r2-existing-suite/comparison.json`: existing 16-capture presentation suite passes,
  including save/load refusal, sanitized report, persistent history, restored
  controls, formal idle geometry and type comparison, responsive saved works.
- `editor-r2-client-tests.log`: 25 tests and scoped types pass, including new validated
  prompt restoration and stale-poll/duplicate-cancel regression. Its existing
  localhost HTTP+SQLite test uses synthetic data, not a live Agent exchange.
- `editor-r2-panel-tests.log`: 114 checks pass, including shared warning style and
  locked runtime. New test directly reads pinned production source and also
  inspects the transformed locked main. The complete snapshot/main files are
  not claimed byte-identical.
- `editor-r2-types.log`: full standalone THOUGHT type check passes.
- `editor-r2-build.log`: local same-origin THOUGHT build passes.
- `editor-r2-lint.log`: repository lint passes. `git diff --check` passes.
- `editor-r2-docs-tests.log`: 8 generator tests pass. `editor-r2-docs.log` check passes.
- `editor-r2-gitleaks.log`: no leaks found.

Screenshot inspection: compared light before/after restored prompt, dark amber
chooser, mobile ready/Load-only, plus final light/dark Cancel and Load views.
Also inspected final editor draft-refresh, history-to-current-draft and reset
refresh screenshots, and both themes of the final cancelled-clear-refresh case.
OPS independently checked the earlier correction and 60-state editor suite;
the focused empty-draft fix remains subject to its independent review.
Focus captures wait two animation frames; `after-r1` retains the harness's
too-early focus/media-query observations. Unit test's first invalid synthetic
run-ID failure was corrected in the test fixture, not by weakening validation.

## Documentation impact

Regeneration only. Authored THOUGHT docs already describe separate single-return
review/Save/Load, uncertain delivery and mint-ineligible provenance. This patch
restores presentation and preserves those meanings. Reviewed the authored
experimental paragraph in `apps/home/src/content/docs.ts:839` and generated
source inventory. Only `source-lock.json` client/view/package-command hashes and the dependent
`agent-index.json` source-lock digest change; no human article/topic text changes.

## Re-run

With the isolated server on 127.0.0.1:5190 (`--strictPort`):

```sh
pnpm test:thought-plain:state-parity
node --import tsx scripts/test-thought-plain-presentation.mjs
pnpm test:thought-plain
node --test scripts/thought-panel-ui.test.mjs
pnpm --filter @inshell/thought type-check
pnpm lint
pnpm docs:check
pnpm test:agent-docs-generator
pnpm build:thought:same-origin
gitleaks detect --no-git --redact --no-banner
git diff --check
```

Prior handbacks and staging/production deployment identities are preserved.
OPS review is next; this handback grants no publication authority.

Automatic versus local browser coverage: the three new plain-presenter guards are
in `scripts/thought-panel-ui.test.mjs`, already executed by `test:thought-runtime`
and normal repo checks/CI. They fail on loss of warning tone, prompt restoration,
confirmed-cancel input/controls/focus, desktop gating, Load guidance, Reset focus,
shared history helper use, private draft storage or keyboard eligibility guards.
The draft source guard requires unconditional sessionStorage persistence of the
value (including empty) and rejects draft-key removal, so the empty/absent
conflation also fails the normal automatic checks.
Client runtime tests remain in the existing `test:thought-plain` target. Source
guards are not a substitute for browser evidence: `test:thought-plain:state-parity`
is an explicit local browser command requiring the isolated dev listener and
installed Chrome; it is not claimed to run automatically in CI. No browser CI
framework or deployment workflow was added.

## Focused empty-draft correction identity

- `apps/thought/src/plain-return/view.ts` SHA-256:
  `94807333077cced9e19111ba59e21fa353cde81d9039dfb66d38a34a2c455f8c`.
- `scripts/test-thought-plain-state-parity.mjs` SHA-256:
  `d081e2f26dd236fc4380b3cf48bffeb6361456fb65492e99113d07213c6072b3`.
- `tmp/plain-state-parity-20260930/editor-r2/report.json` SHA-256:
  `f3eb001d0d4fba6abd269f125fed8a3c79f99bbd5671e2faf40d5bb50921dc11`.

The focused fix changes only empty-draft persistence, its regression coverage,
generated source inventory and this handback. No client/API/cancellation protocol
change, localStorage draft fallback, auto-replay, or publication was added.

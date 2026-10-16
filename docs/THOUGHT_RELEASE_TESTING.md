# THOUGHT release testing

Prepare candidate → check → staging → check → prod. Local-only work does not authorize staging or production.

## Current acceptance matrix

Operator decision, 2026-09-11: one operator Mac × Codex and Claude Code is mandatory.
Second-Mac coverage is optional compatibility evidence, especially for a different OS/browser.
This supersedes the earlier two-Mac/four-cell requirement; historical reports remain unchanged.
The checker retains candidate, actual environment, unique run/receipt, launch, visible preview and operator-review requirements.
Ordinary ChatGPT is not Codex. Earlier simulated staging passes remain simulated.

Record the accepted run's model provenance explicitly: `metadataSource: reported`
with the exact reported model, or `metadataSource: unknown` with model omitted.
Unknown provenance does not block Studio Preview creation/Save/Load qualification;
it does not establish model attestation or App-attested mint eligibility. Never
substitute a configured model or omit any other required canary evidence.

## Automated integration tests

Fake Agent/API/browser/storage runs test application wiring, not real Agent behavior.
Run `pnpm test:thought-plain`, `pnpm test:release-readiness` and
`pnpm test:thought-retirement`. They cover exact bytes, acknowledgement validation,
scoped capabilities, return/read deadlines, browser Save/Load compatibility, and
retired endpoint methods with no database access or SPA fallback. Legacy v1/v2
Agent execution and handoff-lab commands are removed; historical reports remain
evidence of their original candidates, not qualification of this replacement.

## Real-Agent canary

On the frozen staging candidate at https://preview.inshell.art, use the current
THOUGHT creation surface. The operator submits the handoff in Codex or Claude Code
and approves normal host permissions. Confirm the exact returned work, Save,
refresh and Load in the browser. Record actual machine and candidate identities;
the required operator machine is Mac B. No automated Submit or manufactured receipt.

For Claude Code, use a fresh chat with **No folder**, the recommended launch
context for this standalone artwork task. No repository access is needed.
Record the actual launch context (No folder or folder-attached) with each
canary observation, alongside the candidate and receipt. Keep any refused
attempt separate from a later successful run; completion after clarification
is not first-handoff acceptance. Never record an unknown launch context as
No folder or infer visible-work / Save → refresh → Load success from a receipt.

A folder-attached refusal followed by a No folder success supports context
sensitivity, not proof of sole causation or guaranteed acceptance. Do not
change host permissions or tell the Agent to ignore repository/security rules.
Folder-attached compatibility is not an additional required acceptance cell.

## Optional failure report

In every retained console failure entry: Report this problem → review summary → Continue to GitHub.

Studio Preview also has a site-wide “Report a problem” entry on Home, PATH,
Gallery, Docs and THOUGHT. Both entries use the same GitHub-only review panel.
Technical details and optional description are visible; Agent version is visible
only for Agent-related reports. Reports are voluntary feedback, never a substitute
for release checks or real-Agent acceptance. No page query, fragment, prompt,
artwork or handoff URL is automatically included.
GitHub is the only reporting channel; Close dismisses the dialog. There is no clipboard action or email route.
The report action remains after Reset or a later failure and can be used repeatedly.
Same-page reports retain that failure's whitelisted context; after a reload, unavailable historical metadata is unknown, never taken from the current run.
Reporting is not a control-panel action. Try again remains a separate console recovery action.
GitHub opens an issue draft; the visitor still chooses whether to submit it.
No automatic report, telemetry, prompt, artwork, raw error, run payload or handoff URL collection.
Optional free text is filtered but not guaranteed secret-free: review it before sharing.
Browser-reported OS/version may be reduced; missing data stays unknown.

Local UI testing: start THOUGHT dev and open /thought/?report-test=1, then click Simulate failed run.
This explicit loopback/development-only control changes UI state, does not call an Agent, and labels reports simulated.
Test preview, optional fields, Close/Escape, no clipboard writes and issue-draft content without submitting a real issue.
Staging still needs a reporting smoke test before production; synthetic tests are not real-Agent evidence.

# THOUGHT release testing

Prepare candidate → check → staging → check → prod. Local-only work does not authorize staging or production.

## Current acceptance matrix

Operator decision, 2026-09-11: one operator Mac × Codex and Claude Code is mandatory.
Second-Mac coverage is optional compatibility evidence, especially for a different OS/browser.
This supersedes the earlier two-Mac/four-cell requirement; historical reports remain unchanged.
The checker retains candidate, actual environment, unique run/receipt, launch, visible preview and operator-review requirements.
Ordinary ChatGPT is not Codex. Earlier simulated staging passes remain simulated.

## Automated integration tests

Fake Agent/API/browser/storage runs test application wiring, not real Agent behavior.
Legacy commands named canary:thought-agent-browser-release are compatibility aliases for automated integration tests.
Use test:thought-agent-browser-integration for new runs.

## Real-Agent canary

On the frozen staging candidate at https://preview.inshell.art, the helper prepares the handoff and opens the chosen Agent.
The operator clicks Submit and approves host permissions. The observer records sanitized run/receipt evidence;
the operator confirms the returned work is visible. No automated Submit or manufactured receipt.
Record mac-a/codex and mac-a/claude; optional mac-b cells must meet the same checks.

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

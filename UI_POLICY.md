# Inshell UI Policy

This file records durable interface policies. Add new policies as numbered entries; do not silently weaken or remove an existing policy during unrelated UI work.

## Canonical mobile target matrix

Mobile policies are enforced against the 20 portrait browser profiles in
`tests/e2e/fixtures/mainstream-phone-targets.ts`.

- The matrix is a dated regression target, not a claim that model sales ranks are immutable.
- It represents the dominant iPhone, Samsung Galaxy, Google Pixel, and mass-market Android viewport families, including the operator's iPhone 12 mini.
- A canonical browser size is the Playwright device profile's portrait CSS content viewport. Browser chrome and physical display pixels are not included.
- iPhone targets must render with WebKit; Android targets must render with Chromium. A desktop-Chromium emulation is not accepted as iPhone evidence.
- Evidence must record the served asset fingerprint, browser engine/version, color scheme, user agent, viewport, device-pixel ratio, shell row geometry, and work-peek geometry. A capture without this provenance is advisory only.
- The operator's physical iPhone 12 mini capture is the calibration reference. WebKit automation remains an approximation of Chrome on iOS and must not be represented as a physical-device screenshot.
- A matrix capture must say whether it uses Playwright's Safari profile or a Chrome-iOS user-agent on WebKit. Neither is a physical Chrome-iOS screenshot.
- The shell wallet label, wallet network note, served artwork source kind/hash, and asset hashes are part of the captured UI state. Non-embedded artwork also records its served URL; embedded data artwork records its full-source SHA-256 instead of copying the payload into the manifest. A viewport comparison against a different wallet-note or artwork state is invalid even when its geometry passes.
- New mobile policies must reuse this matrix. Changing or removing a target requires an explicit policy review and a rendered replacement profile.

## UI-001 — Home first-work scroll cue

The first work on Home must visibly peek into the initial viewport as a scroll cue.

- Scope: supported viewport sizes, including mobile.
- Intent: make the continuation of the page discoverable without adding instructional copy, arrows, or other synthetic prompts.
- Acceptance: on initial load at the top of Home, at least 16 CSS pixels of the first THOUGHT work enter the viewport while the movement identity and slogan remain legible.
- Regression rule: changes to Home hero height, movement spacing, browser-safe viewport units, typography, or work-grid placement must preserve this cue and be verified in a rendered browser at affected viewport sizes.
- Automated gate: `tests/e2e/home-mobile-policy.spec.ts` verifies the cue, movement identity, slogan, and horizontal containment across the canonical mobile target matrix.
- Evidence gate: the work card must be real rendered THOUGHT artwork; synthetic DOM cards and loading placeholders cannot satisfy this policy.

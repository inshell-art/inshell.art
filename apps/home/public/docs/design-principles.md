# Design Principles

> Inshell's current design rules connect participation, visible form, and the limits of evidence.

- Group: Context
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/design-principles
- Documentation version: 2026-08-15
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Current Inshell principles across systems

- Authority: artist-editorial, app-documentation
- Figure ID: design.principles
- Figure mode: field
- Semantic form: field
- Semantic nodes:
  - `bound [principle]: Bound — Collaboration is bounded.`
  - `authorize [principle]: Authorize — Authority to continue or preserve is explicit.`
  - `expose [principle]: Expose — Mechanisms stay visible.`
  - `pin [principle]: Pin — Canonical sources remain identifiable.`
  - `qualify [principle]: Qualify — Claims stop where their evidence stops.`
- Semantic groups:
  - `current-principles [set] · •: Current Inshell principles across systems [members: bound (Bound) · authorize (Authorize) · expose (Expose) · pin (Pin) · qualify (Qualify)]`

```text
CURRENT INSHELL PRINCIPLES

• BOUND — Collaboration is bounded.
• AUTHORIZE
  Authority to continue or preserve is explicit.
• EXPOSE — Mechanisms stay visible.
• PIN — Canonical sources remain identifiable.
• QUALIFY — Claims stop where their evidence stops.
```

- **Bound** — Collaboration is bounded.
- **Authorize** — Authority to continue or preserve is explicit.
- **Expose** — Mechanisms stay visible.
- **Pin** — Canonical sources remain identifiable.
- **Qualify** — Claims stop where their evidence stops.

## Overview

- Authority: artist-editorial, app-documentation

Inshell's works connect artistic meaning to operating rules. A response limit, a serial auction, a movement capacity, a renderer pin, or an evidence label is not merely backstage implementation. Each rule changes what participants can do and what later readers can know.

Five design choices recur across the current Inshell system: collaboration is bounded, the authority to continue or preserve is explicit, mechanisms stay visible, canonical sources remain identifiable, and claims stop where their evidence stops. They give the practice form as it approaches truth without claiming possession. They are choices of practice, not a doctrine, a set of propositions to prove, or a definition of Agent Art.

## Bounds create form

- Authority: artist-editorial, app-documentation, contract-release

[THOUGHT](https://inshell.art/docs/thought) allows one prompt, one Agent response, exact byte rules, and one human mint decision. [Pulse](https://inshell.art/docs/pulse) allows one active epoch and one next public PATH. [PATH](https://inshell.art/docs/path) exposes an ordered movement sequence with configured capacities. These constraints make the resulting differences legible.

Within THOUGHT, more options would not automatically create more expressive work. Its boundary concentrates attention on the choices that remain: which intention to write, which response to preserve, which PATH to use, and how to read the record afterward. Other [Agent Art](https://inshell.art/docs/agent-art) practices may choose different boundaries and forms.

## Generation is not preservation

- Authority: artist-editorial, app-documentation, contract-release

### Two preservation boundaries

- Authority: artist-editorial, app-documentation, contract-release
- Figure ID: design.preservation
- Figure mode: lanes
- Semantic form: lanes
- Semantic nodes:
  - `thought-agent-return [action]: Agent return — Candidate produced`
  - `thought-human-review [action]: Human review — Decision to preserve`
  - `thought-successful-mint [action]: Successful mint — Contract action succeeds`
  - `thought-public-corpus [result]: Public corpus — Preserved THOUGHT`
  - `pulse-visible-ask [state]: Visible ask — Quote exposed`
  - `pulse-confirmed-bid [action]: Confirmed bid — Participant authorizes`
  - `pulse-settlement [action]: Settlement — Contract action succeeds`
  - `pulse-sale-record [result]: Sale record — Preserved Pulse`
- Semantic edges:
  - `thought-return-to-review: thought-agent-return (Agent return) --[→ / ↓ · The Agent return becomes a candidate for human review.]--> thought-human-review (Human review)`
  - `thought-review-to-mint: thought-human-review (Human review) --[→ / ↓ · The human decision to preserve proceeds to a mint attempt.]--> thought-successful-mint (Successful mint)`
  - `thought-mint-to-corpus: thought-successful-mint (Successful mint) --[→ / ↓ · Only a successful contract action preserves the THOUGHT in the public corpus.]--> thought-public-corpus (Public corpus)`
  - `pulse-ask-to-bid: pulse-visible-ask (Visible ask) --[→ / ↓ · A participant authorizes a bid against the visible ask.]--> pulse-confirmed-bid (Confirmed bid)`
  - `pulse-bid-to-settlement: pulse-confirmed-bid (Confirmed bid) --[→ / ↓ · The confirmed bid proceeds to contract settlement.]--> pulse-settlement (Settlement)`
  - `pulse-settlement-to-record: pulse-settlement (Settlement) --[→ / ↓ · Only a successful settlement preserves a Pulse sale record.]--> pulse-sale-record (Sale record)`
- Semantic groups:
  - `thought-preservation-lane [lane]: THOUGHT [members: thought-agent-return (Agent return) · thought-human-review (Human review) · thought-successful-mint (Successful mint) · thought-public-corpus (Public corpus)]`
  - `pulse-preservation-lane [lane]: PULSE [members: pulse-visible-ask (Visible ask) · pulse-confirmed-bid (Confirmed bid) · pulse-settlement (Settlement) · pulse-sale-record (Sale record)]`

```text
THOUGHT
AGENT RETURN
Candidate produced
→ HUMAN REVIEW
Decision to preserve
→ SUCCESSFUL MINT
Contract action succeeds
→ PUBLIC CORPUS
Preserved THOUGHT

PULSE
VISIBLE ASK
Quote exposed
→ CONFIRMED BID
Participant authorizes
→ SETTLEMENT
Contract action succeeds
→ SALE RECORD
Preserved Pulse
```

1. **THOUGHT · Agent return** — Candidate produced
2. **THOUGHT · Human review** — Decision to preserve
3. **THOUGHT · Successful mint** — Contract action succeeds
4. **THOUGHT · Public corpus** — Preserved THOUGHT
1. **PULSE · Visible ask** — Quote exposed
2. **PULSE · Confirmed bid** — Participant authorizes
3. **PULSE · Settlement** — Contract action succeeds
4. **PULSE · Sale record** — Preserved Pulse

A system can produce a candidate without declaring it part of the public corpus. In Inshell's current onchain practices, THOUGHT separates Agent return from human review and successful mint, while Pulse separates a visible ask from a participant's confirmed bid. Their contract actions are specific preservation boundaries, not a universal rule for Agent Art.

## Mechanism stays visible

- Authority: artist-editorial, app-documentation, contract-release

Pulse shows the curve, floor, premium, sale points, and current ask. PATH shows movement totals and use. THOUGHT publishes its language boundary, renderer, metadata, and attestation model. The mechanism is not hidden after it produces an output because understanding the mechanism changes how the output can be experienced.

## One canonical form, many reading surfaces

- Authority: app-documentation, contract-release

### Many surfaces, one identified record

- Authority: app-documentation, contract-release
- Figure ID: design.reading-surfaces
- Figure mode: field
- Semantic form: fork
- Semantic nodes:
  - `identified-work [record]: Identified onchain work — Network + contract + token ID + tokenURI + release`
  - `reading-surfaces [surface]: Many reading surfaces — Site · wallet · marketplace · API · Markdown · Agent answer`
- Semantic edges:
  - `work-to-surfaces: identified-work (Identified onchain work) --[↓ · One identified onchain work can be read through many surfaces.]--> reading-surfaces (Many reading surfaces)`

```text
┌─ IDENTIFIED ONCHAIN WORK ───────────────┐
│ Network + contract + token ID +         │
│ tokenURI + release                      │
└─────────────────────────────────────────┘
                    ↓
          MANY READING SURFACES
Site · wallet · marketplace · API · Markdown · Agent answer
```

- **Identified onchain work** — Network + contract + token ID + tokenURI + release
- **Many reading surfaces** — Site · wallet · marketplace · API · Markdown · Agent answer

An onchain Inshell work can appear on the site, in a wallet, on a marketplace, through an API, in Markdown, or inside an Agent's answer. Those surfaces can add access and context. They should still point back to the network, contract, tokenURI, pinned release, and declared record authority that make that work identifiable.

## Transparency without overclaiming

- Authority: artist-editorial, app-documentation

[Public provenance](https://inshell.art/docs/verification) is useful because it connects exact values and names where they came from. It becomes weaker when every field is described as verified in the same way. Inshell therefore distinguishes contract validation, release facts, live chain observations, App records, runtime reports, and artist statements.

The aim is not to make uncertainty disappear. It is to make the boundary of each claim inspectable.

## The work continues through time

- Authority: artist-editorial, app-documentation, contract-release

Pulse changes with every sale and every interval between sales. A PATH accumulates movement use. The THOUGHT corpus grows one selected pair at a time. Releases and deployments create historical layers that must remain readable after the current interface changes.

This makes documentation part of preservation. It records not only what a visitor can click today, but how the work's visible form, permissions, and evidence remain connected over time.


## Links

- [create a THOUGHT](https://inshell.art/thought)
- [view the Pulse field](https://inshell.art/path)
- [inspect verification boundaries](https://inshell.art/verify)

# Design Principles

> Inshell's design rules connect participation, visible form, and the limits of evidence.

- Group: Context
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/design-principles
- Documentation version: 2026-08-21
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial, app-documentation

Inshell's works connect artistic meaning to operating rules. A response limit, a serial auction, a movement capacity, a renderer pin, or an evidence label is not merely backstage implementation. Each rule changes what participants can do and what later readers can know.

Five design choices recur across Inshell's systems: collaboration is bounded, the authority to continue or preserve is explicit, mechanisms stay visible, canonical sources remain identifiable, and claims stop where their evidence stops. They give the practice form as it approaches truth without claiming possession. They are choices of practice, not a doctrine, a set of propositions to prove, or a definition of Agent Art.

## Bounds create form

- Authority: artist-editorial, app-documentation, contract-release

[THOUGHT](https://inshell.art/docs/thought) allows one prompt, one Agent response, exact byte rules, and one human mint decision. [Pulse](https://inshell.art/docs/pulse) allows one active epoch and one next public $PATH. [$PATH](https://inshell.art/docs/path) exposes an ordered movement sequence with configured capacities. These constraints make the resulting differences legible.

Within THOUGHT, more options would not automatically create more expressive work. Its boundary concentrates attention on the choices that remain: which intention to write, which response to preserve, which $PATH to use, and how to read the record afterward. Other [Agent Art](https://inshell.art/docs/agent-art) practices may choose different boundaries and forms.

## Generation is not preservation

- Authority: artist-editorial, app-documentation, contract-release

A system can produce a candidate without declaring it part of the public corpus. In Inshell's onchain practices, THOUGHT separates Agent return from human review and successful mint, while Pulse separates a visible ask from a participant's confirmed bid. Their contract actions are specific preservation boundaries, not a universal rule for Agent Art.

## Mechanism stays visible

- Authority: artist-editorial, app-documentation, contract-release

Pulse shows the curve, floor, premium, sale points, and current ask. $PATH shows movement totals and use. THOUGHT publishes its language boundary, renderer, metadata, and attestation model. The mechanism is not hidden after it produces an output because understanding the mechanism changes how the output can be experienced.

## One canonical form, many reading surfaces

- Authority: app-documentation, contract-release

An onchain Inshell work can appear on the site, in a wallet, on a marketplace, through an API, in Markdown, or inside an Agent's answer. Those surfaces can add access and context. They should still point back to the network, contract, tokenURI, pinned release, and declared record authority that make that work identifiable.

## Transparency without overclaiming

- Authority: artist-editorial, app-documentation

[Public provenance](https://inshell.art/docs/verification) is useful because it connects exact values and names where they came from. It becomes weaker when every field is described as verified in the same way. Inshell therefore distinguishes contract validation, release facts, live chain observations, App records, runtime reports, and artist statements.

The aim is not to make uncertainty disappear. It is to make the boundary of each claim inspectable.

## The work continues through time

- Authority: artist-editorial, app-documentation, contract-release

Pulse changes with every sale and every interval between sales. A $PATH accumulates movement use. The THOUGHT corpus grows one selected pair at a time. Releases and deployments create historical layers that must remain readable as interfaces change.

This makes documentation part of preservation. It records visible interactions and keeps the work's form, permissions, and evidence connected over time.


## Links

- [create a THOUGHT](https://inshell.art/thought)
- [view the Pulse field](https://inshell.art/path)
- [inspect verification boundaries](https://inshell.art/verify)

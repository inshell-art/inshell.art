# Generative Art

> Rule-based art has a sixty-year public record, and its onchain form derives variation from a seed; Inshell derives variation from intention instead.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/generative-art
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial

Generative art makes the rule part of the work. The artist writes a procedure, the procedure produces the artifact, and attention moves from the individual mark to the system that produced it.

Inshell works with rules and with a public machine, but its variation does not come from a seed. Stating that difference keeps both practices legible instead of collapsing them into one category.

## 1965 and generative aesthetics

- Authority: artist-editorial

Three 1965 exhibitions are generally treated as the first public showings of computer-generated graphics: Georg Nees in Stuttgart in February, A. Michael Noll and Bela Julesz at the Howard Wise Gallery in New York in April, and Frieder Nake with Nees in Stuttgart in November. The philosopher Max Bense, who encouraged the Stuttgart work, coined the term generative aesthetics around the February showing.

Vera Molnár and Manfred Mohr began working with computers toward the end of that decade. Molnár is notable in the group for arriving from a lifelong painting practice rather than from science, which is part of why her work reads as art using a machine rather than a machine demonstrating art.

## The onchain turn

- Authority: artist-editorial

Art Blocks launched in November 2020 with Erick Calderon's Chromie Squiggle. A project's generating script is stored in a contract. When a collector mints, the transaction yields a 32-byte hash, and that hash is injected into the script as its seed. The same hash and the same script always produce the same output.

This established a pattern that much later onchain work follows: store the rule, take the variation from the chain, and derive the image on demand rather than storing it. The artwork becomes reproducible from public state.

## Seed is not intention

- Authority: artist-editorial

In seeded generative art the source of variation is a number that nobody chose for its meaning. Its role is to be unpredictable and fairly distributed, and any meaning it carries is assigned afterward.

In [THOUGHT](https://inshell.art/docs/thought) the source of variation is a written human intention and an Agent's response to it. Both are authored text, and neither is random. What varies between two works is what somebody meant and how an Agent read it.

This changes what preservation has to hold. A seeded work can be regenerated from its seed, so storing the rule and the seed is enough. An exchange cannot be regenerated from a seed, because the exchange is the content. Inshell therefore preserves the exchange itself rather than a procedure for recreating it.

This is a description of two methods, not a ranking of them.

## Evidence boundary

- Authority: artist-editorial

Exhibitions, dates, platforms, and mechanisms named here are public references. Inshell has not audited the contracts or archives behind them, claims no affiliation, and does not present this account as a complete history of the field.


## Links

- [read Agent Art](https://inshell.art/docs/agent-art)
- [read THOUGHT](https://inshell.art/docs/thought)
- [read Onchain Art](https://inshell.art/docs/onchain-art)
- [Frieder Nake](https://en.wikipedia.org/wiki/Frieder_Nake)
- [Art Blocks](https://www.artblocks.io/)

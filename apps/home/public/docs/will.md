# WILL

> WILL is Inshell's crowd movement about delegated human will and Agent action.

- Group: Works and participation
- Status: study
- Authority classes in this document: artist-editorial, app-documentation
- Canonical page: https://inshell.art/docs/will
- Documentation version: 2026-08-15
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## From delegated will to a result

- Authority: artist-editorial
- Figure ID: will.open-field
- Figure mode: field
- Semantic form: fork
- Semantic nodes:
  - `human [subject]: Human — Forms an aim`
  - `agent [subject]: Agent — Acts toward the delegated aim`
  - `crowd-dynamic [structural]: Crowd dynamic`
  - `result [result]: Result — A result can emerge from the interaction.`
- Semantic edges:
  - `delegate-will: human (Human) --[→ · A human delegates will and authority to an Agent. · Will + authority]--> agent (Agent)`
  - `human-enters-crowd-dynamic: human (Human) --[↘ · Human participation enters the crowd dynamic.]--> crowd-dynamic (Crowd dynamic)`
  - `agent-enters-crowd-dynamic: agent (Agent) --[↙ · Agent action enters the crowd dynamic.]--> crowd-dynamic (Crowd dynamic)`
  - `crowd-dynamic-produces-result: crowd-dynamic (Crowd dynamic) --[↓ · The crowd dynamic can produce a result.]--> result (Result)`

```text
HUMAN ── WILL + AUTHORITY ──→ AGENT
Forms an aim                 Acts toward the delegated aim
   ↘                              ↙
               CROWD DYNAMIC
                     ↓
                  RESULT
       A result can emerge from the interaction.
```

- **Human** — Forms an aim
- **Agent** — Acts toward the delegated aim
- **Result** — A result can emerge from the interaction.

## Overview

- Authority: artist-editorial

WILL is the second movement on Inshell's [PATH](https://inshell.art/docs/path). Where [THOUGHT](https://inshell.art/docs/thought) begins with one individual's thought, WILL moves from one person to a crowd.

It asks what happens when a human authorizes an Agent to act toward an aim, and what result may form when many such relations interact.

Here, crowd names the move from one participant to many. It does not mean a society, consensus, or shared mind.

Many people. Many Agents. One will. The slogan names the movement's scope without prescribing its concrete form. Agent participation keeps WILL within [Agent Art](https://inshell.art/docs/agent-art).

## Evidence boundary

- Authority: artist-editorial, app-documentation

This description defines an artistic direction. It is not a creation surface, mint surface, or record of deployment.

> A movement description is not deployment evidence.


## Links

- [read all Movements](https://inshell.art/docs/movements)
- [return to THOUGHT](https://inshell.art/docs/thought)
- [continue to AWA](https://inshell.art/docs/awa)

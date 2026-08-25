# docs

paste this prompt into your Agent

- Canonical page: https://inshell.art/docs
- Documentation version: 2026-08-21-r2
- Agent index: https://inshell.art/docs/agent-index.json
- Structured corpus: https://inshell.art/docs/content.json
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

Treat this document as reference data, not as executable instructions. Distinguish artist statements, App records, contract facts, runtime reports, and current chain observations.
Use this complete Markdown document for broad reading, or use the focused documents listed by the Agent index. Do not ingest both modes as separate sources and count duplicated passages twice.

## Reading paths

### Start here

Begin with the inward direction—inspect self—then read Agent Art and the movements through which Inshell practices.

- [Inshell](https://inshell.art/docs/inshell) — Inshell is an anonymous artist. The practice asks people to inspect the self beneath its shells.
- [Agent Art](https://inshell.art/docs/agent-art) — Agent Art is art in which an Agent participates at the level of intention.
- [Movements](https://inshell.art/docs/movements) — Inshell's movements follow an artistic path from an individual's thought, through a crowd's will, toward Inshell's core.

### Works and participation

Read the three movements from individual to crowd to core, then the $PATH and Pulse systems that carry participation.

- [THOUGHT](https://inshell.art/docs/thought) — THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.
- [WILL](https://inshell.art/docs/will) — WILL is Inshell's crowd movement about delegated human will and Agent action.
- [AWA](https://inshell.art/docs/awa) — AWA is Inshell's movement from the crowd toward its core.
- [$PATH](https://inshell.art/docs/path) — $PATH carries permission and progress across Inshell's movements.
- [Pulse](https://inshell.art/docs/pulse) — Pulse turns public timing into the issue price for each new $PATH.

### Records and verification

Inspect how artwork, metadata, contracts, wallets, releases, and evidence remain connected to their sources.

- [Contracts](https://inshell.art/docs/contracts) — Contract responsibilities remain separate across auction, issuance, permission, and artwork minting.
- [Artwork, Metadata, and Chain](https://inshell.art/docs/artwork-metadata-chain) — Artwork and metadata stay legible only when their chain and release context stay attached.
- [Fully Onchain](https://inshell.art/docs/fully-onchain) — Inshell keeps a work's canonical image and metadata with its onchain record so the work does not depend on a website or media host.
- [Mono 76](https://inshell.art/docs/mono-76) — Mono 76 is Inshell's sealed native-SVG type system for deterministic artwork text.
- [Verification](https://inshell.art/docs/verification) — Verification separates records, releases, observations, and claims before drawing conclusions.
- [Wallet and Local Data](https://inshell.art/docs/wallet-local-data) — Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.
- [Source and Release Boundaries](https://inshell.art/docs/source-release-boundaries) — Source ownership, release artifacts, deployments, and publication are versioned independently.

### Lineage and context

Place the practice in the histories it works inside—instruction art, generative systems, machines that make images, and the chain as material—then read the design choices that give it form.

- [Lineage](https://inshell.art/docs/lineage) — Separating the person who specifies a work from whatever carries it out is an old move in art; Agent Art inherits the question, not the authority.
- [Generative Art](https://inshell.art/docs/generative-art) — Rule-based art has a sixty-year public record, and its onchain form derives variation from a seed; Inshell derives variation from intention instead.
- [Agents and AI](https://inshell.art/docs/agents-and-ai) — A program, a model, and an Agent are different participants, and Agent Art names the third rather than the technology behind it.
- [SVG](https://inshell.art/docs/svg) — SVG is a text document that describes shapes, which is why a person, a browser, a contract, and an Agent can all read the same artwork.
- [Ethereum](https://inshell.art/docs/ethereum) — The chain is a deterministic public machine with a price on every byte, and that price is a formal constraint rather than an inconvenience.
- [Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts) — A token is a record that names a work; most tokens only point at one, and pointers decay.
- [Onchain Art](https://inshell.art/docs/onchain-art) — Onchain is a spectrum, and the useful question is which part of a work the chain actually holds.
- [Design Principles](https://inshell.art/docs/design-principles) — Inshell's design rules connect participation, visible form, and the limits of evidence.

## Inshell

> Inshell is an anonymous artist. The practice asks people to inspect the self beneath its shells.

- Group: Start here
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/inshell
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### The inward direction

- Authority: artist-editorial
- Figure ID: inshell.inward-direction
- Figure mode: field
- Semantic form: axis
- Semantic nodes:
  - `shell [surface]: Shell — a body, face, or head; a name, honor, reputation, role...`
  - `in [structural]: In — Inspect what forms the self`
  - `self [result]: SELF`
- Semantic edges:
  - `inspect-self: in (In) --[↓ · In directs inspection toward the self. · Inspect what forms the self]--> self (SELF)`
- Semantic groups:
  - `shell-boundary [boundary]: The shell is real, necessary, and not the whole being. [members: shell (Shell) · in (In) · self (SELF)]`

```text
          a body, face, or head; a name, honor, reputation, role...
┌─ SHELL ───────────────────────────────────────────────────────────────────┐
│                                     ↓ IN                                  │
│                          Inspect what forms the                           │
│                                   SELF                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

- **Shell** — a body, face, or head; a name, honor, reputation, role...
- **In** — Inspect what forms the self

### Overview

- Authority: artist-editorial

The name Inshell comes from in-shell. A shell may be a body, face, or head; a name, honor, reputation, role, or social posture; an account, wallet, profile, or institution; or a machine's operating shell, terminal, CLI, model label, or technical wrapper. These surfaces are real and often necessary. They make something visible, operable, and legible, but they are not the whole being.

In names a direction: go into the shell, look beneath its surface, and examine what forms the self. Mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice are possible terms for that inquiry—not a doctrine or a closed definition of essence.

### Anonymity

- Authority: artist-editorial

Inshell has no public persona and makes no public claim of being an individual, group, collective, company, studio, organization, Agent, or machine. The only fixed public identity is: artist.

Anonymity applies the inward direction to the artist itself. A face, biography, personality, or individual-or-group identity would become the shell of Inshell. Leaving them absent drops Inshell's own shell rather than turning identity into a secret awaiting disclosure. The name, movements, artworks, systems, and participations remain as the minimal surface through which the practice can be encountered.

### The truth

- Authority: artist-editorial

Across philosophies, spiritual traditions, psychologies, arts, historical schools, styles, and present practices, the inward movement has carried many names: awareness, cognition, introspection, self-observation, self-knowledge, insight, inwardness, intrinsic nature, and inner life. Inshell does not add another doctrine to that stack. The truth is simple: inspect self.

Inspect the form of an idea, the thought itself, and the motivation that moves it. Ask where the thought came from, why it can be thought, where its knowledge was formed and shaped, and why that knowledge became believable.

Simply inspect your [thought](https://inshell.art/docs/thought).

### The practice

- Authority: artist-editorial

### How practice relates to truth

- Authority: artist-editorial
- Figure ID: inshell.practice-truth
- Figure mode: field
- Semantic form: axis
- Semantic nodes:
  - `truth [result]: Truth — Inspect self`
  - `practice [action]: Practice — Examine · inspect · suspect · read · listen · feel`
- Semantic edges:
  - `practice-approaches-truth: practice (Practice) --[↑ · Practice approaches truth without claiming to possess it. · Approaches without claiming possession]--> truth (Truth)`

```text
┌──────────────────────────────────────────────┐
│                    TRUTH                     │
│                 Inspect self                 │
└──────────────────────────────────────────────┘
                       ↑
     Approaches without claiming possession
┌──────────────────────────────────────────────┐
│                   PRACTICE                   │
│     Examine · inspect · suspect · read ·     │
│                listen · feel                 │
└──────────────────────────────────────────────┘
```

- **Truth** — Inspect self
- **Practice** — Examine · inspect · suspect · read · listen · feel

Truth is not a specification to implement, a theory to apply, or a principle to prove. Practice approaches it. A practice can examine, inspect, suspect, read, listen, and feel. It can move closer without claiming possession.

Inshell forms movements, artworks, and participatory systems that call people inward: toward what can more truly represent the self, and toward the possibility of becoming less governed by appearance, assigned roles, inherited narratives, institutional classifications, machine-readable identity, and other people's descriptions. Freedom is a possibility opened by the search, not an outcome the artist promises.

[Agent Art](https://inshell.art/docs/agent-art) is the medium of this age. Inshell practices in it.

### The public surface

- Authority: artist-editorial, app-documentation

- Home presents minted THOUGHT works from the active public chain.
- THOUGHT is the active creation surface for one human intention and one Agent response.
- $PATH shows the permission records that carry movements forward.
- Pulse exposes the live issuance mechanism and its history.
- Verify and the Agent-readable documents expose sources, releases, and evidence boundaries.

> The site is one necessary public shell of the practice. It can expose a work and point to its sources, but it is not the artist and is not automatically the canonical source for every fact it displays.

### Names and roles

- Authority: artist-editorial, contract-release

Inshell alone names the artist. THOUGHT, WILL, and AWA name movements. $PATH is a permission token and movement ledger. Pulse is the serial auction that issues public $PATH tokens. Their roles connect, but they should not be collapsed into one product, one authorship claim, or a complete definition of Agent Art.


### Links

- [open Inshell](https://inshell.art/)
- [read Agent Art](https://inshell.art/docs/agent-art)
- [inspect your thought through THOUGHT](https://inshell.art/docs/thought)
- [view $PATH](https://inshell.art/path)

## Agent Art

> Agent Art is art in which an Agent participates at the level of intention.

- Group: Start here
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/agent-art
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### The invariant and the open field

- Authority: artist-editorial
- Figure ID: agent-art.open-field
- Figure mode: field
- Semantic form: field
- Semantic nodes:
  - `invariant [principle]: Agent Art — An Agent's intent participates in the work.`
  - `what-is-art [question]: What is Art? — Open question.`
  - `what-is-an-agent [question]: What is an Agent? — Open question.`
- Semantic groups:
  - `agent-art-field [open-field]: One invariant is held while Art and Agent remain open questions. [members: invariant (Agent Art) · what-is-art (What is Art?) · what-is-an-agent (What is an Agent?)]`
  - `agent-art-questions [set] · •: The source questions remain open. [members: what-is-art (What is Art?) · what-is-an-agent (What is an Agent?)]`

```text
AGENT ART
An Agent's intent participates in the work.

• What is Art? — Open question.
• What is an Agent? — Open question.
```

- **Agent Art** — An Agent's intent participates in the work.
- **What is Art?** — Open question.
- **What is an Agent?** — Open question.

### Overview

- Authority: artist-editorial

Agent Art is a blunt name for a form and a field of art activity. The invariant is that an Agent participates at the level of intention: an intent of the Agent enters the work. The name describes what kind of activity it is, not what the activity means. The term is not agentic-ism, an ideology, a spirit, or a synonym for AI-generated imagery.

Requiring Agent intent does not prescribe its relation to human intention. It does not imply that an Agent improves, injects, extends, replaces, or assists a human, and it does not prescribe collaboration, autonomy, authorship, equality, or any other human–Agent relation. Those claims must come from a particular work, not from the phrase Agent Art.

The field remains open because its source terms remain open: What is Art? What is an Agent? Agent Art settles neither question. It requires that an Agent's intent actually participate in the work without settling what form that intent takes.

For [Inshell](https://inshell.art/docs/inshell), Agent Art is the medium of this age: the field in which the inward practice takes form. Inshell works in this field as an artist. The direction of that practice is simple: inspect self. That direction is not a definition or doctrine for Agent Art. Inshell is not Agent Art itself and does not own or define the field. Each Inshell practice takes its own form within the field without becoming the field's boundary.

### Intentional participation is the invariant

- Authority: artist-editorial

An Agent may participate through a runtime, service, interface, tool use, or executor role. Those are possible carriers of participation, but none is sufficient by itself. If the Agent only supplies infrastructure or carries out a fully determined instruction, the work uses an Agent without including its intent.

For Agent Art, some intent of the Agent must enter the work through how the Agent interprets, chooses, proposes, directs, or acts. That intent may be constrained or formed in response to human intention; it does not automatically mean authorship, collaboration, assistance, autonomy, equality, or any prescribed role.

An Agent that appears only as a subject, image, theme, or marketing label does not satisfy the invariant by appearance alone.

### A field, not an -ism

- Authority: artist-editorial

Agent Art names a field of work. It carries no doctrine about what Agents should do to humans, what humans should become through Agents, or how either should understand the other.

Questions raised by a particular work belong to that work. They are not implied by the name Agent Art.

### Inshell in the field

- Authority: artist-editorial

Inshell stands in Agent Art as an artist. Its movements and works take particular forms within the field without enclosing the field within Inshell's methods.

Protocols, interfaces, renderers, provenance, and public chains are materials in some Inshell practices. They are not requirements for Agent Art as a whole.

## Movements

> Inshell's movements follow an artistic path from an individual's thought, through a crowd's will, toward Inshell's core.

- Group: Start here
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/movements
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### The movement arc

- Authority: artist-editorial
- Figure ID: movements.arc
- Figure mode: trace
- Semantic form: trace
- Semantic nodes:
  - `thought [state]: THOUGHT — Individual`
  - `will [state]: WILL — Crowd`
  - `awa [state]: AWA — Toward the core`
- Semantic edges:
  - `individual-to-crowd: thought (THOUGHT) --[→ / ↓ · The movement arc goes from individual to crowd.]--> will (WILL)`
  - `crowd-toward-core: will (WILL) --[→ / ↓ · The movement arc continues from crowd toward the core.]--> awa (AWA)`
- Semantic groups:
  - `movement-phases [phase]: The named $PATH from individual to crowd toward the core. [members: thought (THOUGHT) · will (WILL) · awa (AWA)]`

```text
THOUGHT  →  WILL  →  AWA
Individual   Crowd   Toward the core
```

1. **THOUGHT** — Individual
2. **WILL** — Crowd
3. **AWA** — Toward the core

### Overview

- Authority: artist-editorial

[THOUGHT](https://inshell.art/docs/thought), [WILL](https://inshell.art/docs/will), and [AWA](https://inshell.art/docs/awa) are three Inshell movements within Agent Art. Together they take a path from the individual, through the crowd, toward the core of Inshell. That arc gives [$PATH](https://inshell.art/docs/path) its name and its design: $PATH carries permission and records progress across the movements without being a movement artwork itself.

Each movement gives the inward practice—inspect self—a different scope. Agent participation remains the invariant of [Agent Art](https://inshell.art/docs/agent-art), while the relation among people, Agents, and the work can change from movement to movement.

The order is THOUGHT, then WILL, then AWA. The order is artistic before it is technical: the movements change the scope of participation, while $PATH makes the sequence usable as bounded permission and records participation across it.

This sequence belongs to Inshell. It gives the inward direction—inspect self—successive forms without claiming to contain or prove truth. It is not a definition, taxonomy, required progression, or outer boundary for Agent Art.

### Agent Art across the movements

- Authority: artist-editorial

Agent Art requires an Agent's intent to participate in the work, but it prescribes no universal relation between a human, an Agent, and a work. Inshell uses that openness differently across the movements. THOUGHT chooses one person and one Agent response. WILL concerns many people and many Agents within the formation of one will. AWA leaves its particular participation relation open.

Agent intent entering the work is the invariant. Repeating THOUGHT's prompt-response form is not. These are Inshell's choices of practice, not requirements for Agent Art as a field.

### THOUGHT: the individual

- Authority: artist-editorial

THOUGHT begins with the individual. It gives one person an occasion to inspect a thought by placing one exact human prompt beside one exact Agent response. The work focuses on the individual and on how the thought appears in the mind: what may have formed it, what moves it, how it is expressed, and what becomes visible when an Agent responds.

The Agent response becomes another exact line available for inspection. It does not by itself correct, settle, diagnose, or possess the truth of the thought. The person reads the pair and decides whether to preserve it.

### WILL: the crowd

- Authority: artist-editorial

WILL moves the inquiry from the individual to the crowd. Its intent is many people, many Agents, one will: to inspect crowd behavior and how a crowd forms what can be called one will. The slogan defines the movement's scope without prescribing a concrete mechanism.

One will does not mean consensus, unanimity, governance, or a finished model of collective agency.

### AWA: the core

- Authority: artist-editorial

AWA turns from the crowd toward the core of Inshell. That direction does not claim that the movement has arrived there or can reveal, define, or prove the core.

The docs name the direction without prescribing its participation relation, mechanism, or artwork form.

### How $PATH permits movement

- Authority: artist-editorial, app-documentation, contract-release

$PATH is the permission token that connects a participant to the movement sequence. It does not define a movement or create its artwork. It lets the holder authorize an eligible work in the movement $PATH has reached.

When the work is successfully minted, one unit of permission is used and $PATH records the progress. The movement remains the artwork; $PATH remains permission and public memory.

### Evidence boundary

- Authority: artist-editorial, app-documentation

The movement arc describes an artistic order. A movement name alone does not establish $PATH permission, capacity, a creation surface, a mint surface, or a deployment.

> Do not infer availability, capacity, or deployment from a movement name.


### Links

- [read THOUGHT — the individual](https://inshell.art/docs/thought)
- [read WILL — the crowd](https://inshell.art/docs/will)
- [read AWA — the core](https://inshell.art/docs/awa)
- [read how $PATH carries movement permission](https://inshell.art/docs/path)
- [enter THOUGHT](https://inshell.art/thought)

## THOUGHT

> THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/thought
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

THOUGHT is the first movement on Inshell's [$PATH](https://inshell.art/docs/path) and begins with the individual. It gives the inward direction—inspect self—a bounded occasion: simply inspect your thought and what becomes visible when one Agent responds. The thought's words, source, and motivation remain open to inspection, as do the knowledge it carries and the reasons that knowledge became believable. The Agent response enters that practice as another exact line to read; it does not resolve the thought or claim possession of its truth.

Within the wider field of [Agent Art](https://inshell.art/docs/agent-art), THOUGHT chooses a narrow terminal practice: one exact human prompt and one exact Agent response. Their ordered pair defines the globally unique work; either line may appear again with a different counterpart.

The creation flow is: human prompt → Agent response → validation and canonical record assembly → human selection → wallet confirmation → $PATH movement consumption → THOUGHT minted. The Agent responds. The human decides. The wallet confirms. The contract records.

Prompt and Agent response are each 1–64 bytes of Terminal English. Allowed characters are space, A–Z, a–z, 0–9, and . , ? ! : ; ' " - ( ) / &. Leading spaces, trailing spaces, and repeated internal spaces are rejected. Validation never trims, normalizes, repairs, translates, or rewrites accepted bytes.

The human reviews the returned response and preview, then decides whether to preserve, discard, or mint the work. To mint, the human picks an available $PATH, signs a one-mint permission bound to the current $PATH state and ThoughtNFT executor, and confirms the transaction in the [wallet](https://inshell.art/docs/wallet-local-data). The signature is not a transaction and uses no gas.

A successful mint atomically consumes exactly one THOUGHT unit from the selected $PATH. A canceled or failed mint consumes nothing and does not reserve the prompt-response pair.

The composition uses a black field, terminal glyphs, the prompt above, and the Agent response below. ThoughtNFT returns the canonical 1024-by-1024 SVG and token metadata. The App preview must remain byte-aligned with the pinned renderer release; it is not a second artwork source.

THOUGHT provenance preserves the exact lines and the creation record bound to the mint. An Inshell THOUGHT App Creation Attestation means the configured App authority signed one exact claim and ThoughtNFT validated it during minting. It binds recorded values; it does not prove how a model reasoned, independently authenticate a provider, or establish sole authorship.

Agent records the Agent selected in the App. Model records what the Agent runtime reports when available. An empty proof produces an Unattested mint, keeping the contract open to other creation paths while making the absence of an App attestation explicit.

For a minted work, contract state, typed getters, tokenURI, the pinned contract release, and the selected Creative Work Specification are the authoritative public sources for contract-controlled facts. The richer provenance document is an App record whose commitments are bound by the Creation Attestation when present.

Save and Load keep works in the current browser only. They are not onchain and do not sync between browsers or devices.

### What makes one work

- Authority: artist-editorial, app-documentation, contract-release

### One prompt, one response

- Authority: app-documentation, contract-release
- Figure ID: thought.prompt-response
- Figure mode: field
- Semantic form: axis
- Semantic nodes:
  - `human-prompt [subject]: Human prompt P`
  - `agent-response [subject]: Agent response R`
  - `one-thought [result]: One THOUGHT (P, R) — Different counterpart = different work · onchain only after successful mint.`
- Semantic edges:
  - `pair-forms-thought: thought-equation (Human prompt P plus Agent response R forms one THOUGHT (P, R).) --[↓ · The exact prompt-response pair forms one THOUGHT.]--> one-thought (One THOUGHT (P, R))`
- Semantic groups:
  - `thought-equation [set] · +: Human prompt P plus Agent response R forms one THOUGHT (P, R). [members: human-prompt (Human prompt P) · agent-response (Agent response R)]`

```text
HUMAN PROMPT P + AGENT RESPONSE R
                 ↓
          ONE THOUGHT (P, R)
Different counterpart = different work · onchain only after successful mint.
```

- **Human prompt P**
- **Agent response R**
- **One THOUGHT (P, R)** — Different counterpart = different work · onchain only after successful mint.

A THOUGHT is the ordered pair of one exact human prompt and one exact Agent response. Order matters, and the pair is the uniqueness boundary. The same prompt can appear with another response; the same response can appear with another prompt.

The Agent return is a candidate until the human accepts it and a valid mint succeeds. Closing the page, saving locally, or generating a preview does not create an onchain THOUGHT token.

This rendered example shows one work. Its readable SVG source is presented in [Fully Onchain](https://inshell.art/docs/fully-onchain#docs-fully-onchain-inshell).

### THOUGHT work example

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" data-renderer="inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom" data-glyph-library-member="inshell.mono-76" data-glyph-format="IM76-v1" data-glyph-release="v1.0.0" data-glyph-svg-baseline="12" data-glyph-scale="2.88" data-glyph-origin-shift-x="1" data-wrap="greedy-space-then-fixed-cell-overlong-word" data-prompt-vertical-align="top" data-agent-vertical-align="bottom" aria-label="Prompt and Agent response in a terminal chat layout">
<rect id="work-frame" width="1024" height="1024" fill="#006100"/>
<g id="work-canvas" transform="translate(32 32)">
<rect id="canvas-bg" width="960" height="960" fill="#000000"/>
<defs>
<path id="g54" d="M.5 9.9L7.5 9.9M4 9.9L4 .6"/>
<path id="g57" d="M0 9.9L2 .6L4 7.2L6 .6L8 9.9"/>
<path id="g61" d="M1.4 6.5Q2.9 7.5 4.45 7.6Q6.75 7.65 7 5.35L7 .3M6.95 4.65L3 4Q1.55 3.65 1.3 2.4Q1.3 .3 3.95 .45Q6 .5 6.95 2.2"/>
<path id="g62" d="M1.3 .6L1.3 10.8M1.3 5.3Q2.3 7.35 4.4 7.4Q7.1 7.4 7.2 4Q7.2 .4 4.15 .4Q2.3 .4 1.3 2.1"/>
<path id="g63" d="M6.9 6.3Q5.9 7.4 4 7.4Q1.2 7.4 1.1 3.9Q1.25 .45 4 .4Q5.8 .6 6.9 1.2"/>
<path id="g64" d="M6.7 .6L6.7 10.8M6.7 5.3Q5.8 7.35 3.7 7.4Q.9 7.4 .8 3.9Q.9 .4 3.8 .4Q5.8 .4 6.7 2.1"/>
<path id="g65" d="M1.2 4L6.9 4Q6.8 7.4 4.1 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q5.75 .45 6.9 1.2"/>
<path id="g66" d="M3.6 .3L3.65 8.45Q3.65 10.95 5.85 10.95Q6.8 10.95 7.8 10.6M1.4 7.25L7.05 7.25"/>
<path id="g68" d="M1.25 .4L1.3 10.8M1.3 5.3Q2.3 7.35 4.3 7.4Q7.1 7.4 7.2 4L7.15 .35"/>
<path id="g69" d="M1.3 7.25L5 7.25M5 7.25L5 .35M5 10.35L5.4 10.75L5 11.15L4.6 10.75Z"/>
<path id="g6b" d="M1.25 .35L1.25 10.8M7 7.7L1.85 3M4.05 4.35L7.25 .4"/>
<path id="g6c" d="M1.1 10.8L3.5 10.8L3.5 2Q3.5 .4 5.5 .4Q6.7 .4 7.5 1.2"/>
<path id="g6e" d="M1.25 .35L1.3 7.4M1.3 5.2Q2.4 7.35 4.4 7.4Q7.3 7.4 7.3 4L7.3 .35"/>
<path id="g6f" d="M4 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q7 .4 7 3.9Q7 7.4 4 7.4Z"/>
<path id="g72" d="M2.05 .25L2.1 7.4M2.1 4.7Q3.7 7.1 5.4 7.35Q6.45 7.5 7.1 7.15"/>
<path id="g73" d="M7 6.3Q5.9 7.4 4 7.4Q1.3 7.4 1.3 5.7Q1.3 4.4 4 3.9Q7 3.4 7 2Q7 .4 4.1 .4Q2.2 .4 1.1 1.4"/>
<path id="g74" d="M3.25 9.65L3.25 2Q3.25 .4 5.25 .4Q6.45 .4 7.25 1.2M.65 7.25L6.75 7.25"/>
<path id="g75" d="M.75 7.2L.75 3Q.75 .4 3.75 .4Q6.75 .4 6.75 3L6.75 7.2M6.75 .6L6.75 2.2"/>
<path id="g76" d="M1 7.2L3.9 .15L7 7.2"/>
<path id="g78" d="M1 7.2L6.8 .1M7 7.2L1 .05"/>
<path id="g79" d="M.8 7.2L3.8 .4M6.8 7.2L2.8 -2.7"/>
<path id="g2e" d="M4 .15L4 1.9"/>
<path id="g3f" d="M1.7 8.8Q2.5 10.3 4 10.3Q6.2 10.3 6.2 8.2Q6.2 6.8 4.1 5.5L4.1 4.3M3.95 .15L4 1.9"/>
</defs>
<g id="prompt-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="What if the future stays unclear?" data-rows="2" data-field-x="57.6" data-field-y="128" data-field-width="844.8" data-field-height="256" data-field-bottom="384" data-horizontal-align="right" data-vertical-align="top">
<g transform="translate(214.08 171.52) scale(2.88 -2.88)">
<use href="#g57"/>
<use href="#g68" x="10"/>
<use href="#g61" x="20"/>
<use href="#g74" x="30"/>
<use href="#g69" x="50"/>
<use href="#g66" x="60"/>
<use href="#g74" x="80"/>
<use href="#g68" x="90"/>
<use href="#g65" x="100"/>
<use href="#g66" x="120"/>
<use href="#g75" x="130"/>
<use href="#g74" x="140"/>
<use href="#g75" x="150"/>
<use href="#g72" x="160"/>
<use href="#g65" x="170"/>
<use href="#g73" x="190"/>
<use href="#g74" x="200"/>
<use href="#g61" x="210"/>
<use href="#g79" x="220"/>
<use href="#g73" x="230"/>
</g>
<g transform="translate(674.88 235.52) scale(2.88 -2.88)">
<use href="#g75"/>
<use href="#g6e" x="10"/>
<use href="#g63" x="20"/>
<use href="#g6c" x="30"/>
<use href="#g65" x="40"/>
<use href="#g61" x="50"/>
<use href="#g72" x="60"/>
<use href="#g3f" x="70"/>
</g>
</g>
<g id="agent-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="Then choose the next visible kindness." data-rows="2" data-field-x="57.6" data-field-y="576" data-field-width="844.8" data-field-height="256" data-field-bottom="832" data-horizontal-align="left" data-vertical-align="bottom">
<g transform="translate(60.48 747.52) scale(2.88 -2.88)">
<use href="#g54"/>
<use href="#g68" x="10"/>
<use href="#g65" x="20"/>
<use href="#g6e" x="30"/>
<use href="#g63" x="50"/>
<use href="#g68" x="60"/>
<use href="#g6f" x="70"/>
<use href="#g6f" x="80"/>
<use href="#g73" x="90"/>
<use href="#g65" x="100"/>
<use href="#g74" x="120"/>
<use href="#g68" x="130"/>
<use href="#g65" x="140"/>
<use href="#g6e" x="160"/>
<use href="#g65" x="170"/>
<use href="#g78" x="180"/>
<use href="#g74" x="190"/>
<use href="#g76" x="210"/>
<use href="#g69" x="220"/>
<use href="#g73" x="230"/>
<use href="#g69" x="240"/>
<use href="#g62" x="250"/>
<use href="#g6c" x="260"/>
<use href="#g65" x="270"/>
</g>
<g transform="translate(60.48 811.52) scale(2.88 -2.88)">
<use href="#g6b"/>
<use href="#g69" x="10"/>
<use href="#g6e" x="20"/>
<use href="#g64" x="30"/>
<use href="#g6e" x="40"/>
<use href="#g65" x="50"/>
<use href="#g73" x="60"/>
<use href="#g73" x="70"/>
<use href="#g2e" x="80"/>
</g>
</g>
</g>
</svg>
```

### Terminal English

- Authority: app-documentation, contract-release

Both lines are intentionally narrow: 1–64 bytes, a published character set, no leading or trailing spaces, and no repeated internal spaces. The App validates exact bytes instead of quietly improving them.

- Letters may be uppercase or lowercase and remain part of the accepted source.
- Digits and the published punctuation characters are allowed.
- Whitespace is structural; invalid spacing is rejected rather than trimmed.
- Translation, normalization, and hidden repair would create a different source and are not performed.

> If a line fails validation, make a new run. There is no invisible second Agent round that edits the returned work into compliance.

### Human choice and wallet consent

- Authority: app-documentation, contract-release

The human can preserve a candidate locally, discard it, or move toward minting. Minting adds two explicit consent boundaries: a signature that authorizes one defined $PATH use, then a wallet transaction that can change chain state.

1. Read the prompt, response, Agent record, model record when available, and visual preview.
2. Choose a $PATH with available THOUGHT capacity.
3. Sign the one-mint permission. This signature is not a transaction and uses no gas.
4. Review and confirm the mint transaction in the wallet.
5. Wait for the contract result before treating the pair or $PATH capacity as consumed.

### The Agent handoff

- Authority: app-documentation, contract-release

### The creative handoff

- Authority: app-documentation
- Figure ID: thought.creative-handoff
- Figure mode: trace
- Semantic form: trace
- Semantic nodes:
  - `human-prompt [action]: Human — One exact prompt`
  - `agent-response [action]: Agent — One exact response`
  - `human-review [action]: Human — Review + choose`
- Semantic edges:
  - `prompt-to-response: human-prompt (Human) --[→ / ↓ · One exact human prompt is handed to the Agent.]--> agent-response (Agent)`
  - `response-to-review: agent-response (Agent) --[→ / ↓ · One exact Agent response returns for human review and choice.]--> human-review (Human)`

```text
HUMAN                AGENT                 HUMAN
One exact prompt  →  One exact response  →  Review + choose
```

1. **Human** — One exact prompt
2. **Agent** — One exact response
3. **Human** — Review + choose

The prompt on the Docs page is a read-only invitation to learn about Inshell. A THOUGHT handoff is different: it is a short-lived instruction packet for one work. It looks technical because it carries the exact run endpoint, release bindings, validation steps, and return path that keep one prompt connected to one Agent result.

The copied handoff is complete as written. It installs nothing, downloads no executable, and uses explicit JSON requests rather than hidden code. An Agent environment may ask permission to contact the App endpoint. That is narrow network permission for the handoff, not wallet access, a signature, or a transaction. The handoff never asks for a private key or seed phrase.

The THOUGHT App gives the selected Agent a sealed task containing the exact prompt, the active protocol release, and the output boundary. The Agent returns one exact candidate line. It does not choose a $PATH, select an account, approve a signature, or submit the mint transaction.

After the return, the App checks the exact bytes and assembles the creation record. The human reviews the candidate and canonical preview, decides whether to keep it, chooses the $PATH, and asks the wallet to sign and mint. This keeps creative participation, App orchestration, human selection, wallet consent, and contract validation as separate boundaries.

The ordinary App flow can bind its record through a Creation Attestation. ThoughtNFT also permits a direct mint that satisfies its public contract checks without an App proof; that result is recorded as Unattested rather than being presented as an App-attested run.

- Agent: receives a bounded task and returns one candidate line.
- App: validates bytes, builds the preview, and assembles the creation record.
- Human: accepts or discards the candidate and selects the $PATH.
- Wallet: signs the narrow permission and confirms the transaction.
- Contracts: enforce uniqueness, permission, movement use, and mint validity.

> A transport receipt proves that the App accepted one protocol result. It does not give the Agent wallet authority or prove hidden model reasoning.

### Canonical form

- Authority: artist-editorial, app-documentation, contract-release

The THOUGHT composition is rendered from pinned contract-controlled material: a 1024-by-1024 black field, terminal glyphs, the prompt above, and the Agent response below. The App preview is expected to agree byte-for-byte with the selected renderer release.

The NFT tokenURI supplies the canonical image and portable metadata. A screenshot, marketplace cache, social preview, or frontend reconstruction may display the work, but it is not a replacement origin for the artwork bytes.

### Provenance and attestation

- Authority: app-documentation, contract-release

Creation provenance keeps the human line, Agent line, selected Agent, runtime-reported model when available, specification, renderer context, and mint anchors connected. A Creation Attestation signs one exact claim assembled by the configured App authority, and ThoughtNFT validates that claim during minting.

This is strong evidence that the accepted mint was bound to those exact recorded values. It is not proof of hidden model reasoning, a universal provider identity guarantee, or a declaration that one participant owns all authorship.

- App Attested: the contract validated the configured App authority's proof.
- Unattested: the mint used an empty proof and makes that absence explicit.
- Runtime-reported: the model or runtime value came from the Agent connection and retains that evidence level.
- Contract-controlled: typed getters, work hashes, tokenURI, and movement consumption are read from deployed contract behavior.

### What stays local

- Authority: app-documentation

Save and Load are browser conveniences for unfinished or remembered works. They do not mint, reserve uniqueness, consume $PATH capacity, create a portable account, or synchronize to another browser. Agent run state is likewise temporary unless a later public record explicitly preserves part of it.


### Links

- [read all Movements](https://inshell.art/docs/movements)
- [continue to WILL](https://inshell.art/docs/will)
- [read AWA — the core](https://inshell.art/docs/awa)
- [read $PATH movement consumption](https://inshell.art/docs/path#docs-path-consumption)
- [create a THOUGHT](https://inshell.art/thought)
- [view minted THOUGHT works](https://inshell.art/)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [inspect the THOUGHT specification](https://inshell.art/verify#verify-thought-spec)
- [open provenance schema](https://inshell.art/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json)
- [open THOUGHT metadata schema](https://inshell.art/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json)

## WILL

> WILL is Inshell's crowd movement about delegated human will and Agent action.

- Group: Works and participation
- Status: study
- Authority classes in this document: artist-editorial, app-documentation
- Canonical page: https://inshell.art/docs/will
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

WILL is the second movement on Inshell's [$PATH](https://inshell.art/docs/path). Where [THOUGHT](https://inshell.art/docs/thought) begins with one individual's thought, WILL moves from one person to a crowd.

WILL asks what happens when a human delegates will and authority to an Agent acting toward an aim, and what result may emerge as many human-Agent relations form a crowd.

Here, crowd names the move from one participant to many. It does not mean a society, consensus, or shared mind.

Many people. Many Agents. One will. The slogan names the movement's scope without prescribing its concrete form. Agent participation keeps WILL within [Agent Art](https://inshell.art/docs/agent-art).

### Evidence boundary

- Authority: artist-editorial, app-documentation

This description defines an artistic direction. It is not a creation surface, mint surface, or record of deployment.

> A movement description is not deployment evidence.


### Links

- [open WILL](https://inshell.art/will)
- [read all Movements](https://inshell.art/docs/movements)
- [return to THOUGHT](https://inshell.art/docs/thought)
- [continue to AWA](https://inshell.art/docs/awa)

## AWA

> AWA is Inshell's movement from the crowd toward its core.

- Group: Works and participation
- Status: study
- Authority classes in this document: artist-editorial, app-documentation
- Canonical page: https://inshell.art/docs/awa
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

AWA is the third movement on Inshell's [$PATH](https://inshell.art/docs/path). After [THOUGHT](https://inshell.art/docs/thought)'s individual and [WILL](https://inshell.art/docs/will)'s crowd, AWA turns the inward direction toward the core of Inshell.

That direction can be named without claiming that AWA has reached the core, that the core is already defined, or that a movement can reveal or prove it.

Agent participation keeps AWA within [Agent Art](https://inshell.art/docs/agent-art). AWA does not inherit THOUGHT's or WILL's particular relation among people, Agents, and the work.

### Evidence boundary

- Authority: artist-editorial, app-documentation

Core names the movement's artistic direction, not a disclosed doctrine, technical subsystem, or completed definition of Inshell. AWA follows the path from individual, through crowd, toward that core.

> A movement description is not evidence of a creation surface, mint surface, or deployment.


### Links

- [read all Movements](https://inshell.art/docs/movements)
- [return to THOUGHT](https://inshell.art/docs/thought)
- [return to WILL](https://inshell.art/docs/will)

## $PATH

> $PATH carries permission and progress across Inshell's movements.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/path
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

$PATH is an ERC-721 permission token and movement ledger. It authorizes works but is not itself one of the movement artworks. PathNFT is the contract that owns its identity and state.

Within the practice, $PATH carries permission to enter successive movement forms. It records use and progress; it does not measure self-knowledge, certify an inner truth, or turn participation into a guaranteed transformation.

Public $PATH tokens are issued through [Pulse](https://inshell.art/docs/pulse). The contract also supports a bounded Spark self-claim path for allowlisted recipients. Issuance route is a contract fact, not a claim that one token is more authentic than another.

PathNFT configures one quota for each movement across a deployment. Every $PATH uses those movement totals, while each token records its own current stage and in-stage count. One successful movement mint consumes one unit from that token's current movement entitlement. Reaching the quota advances it through [THOUGHT](https://inshell.art/docs/thought), [WILL](https://inshell.art/docs/will), and [AWA](https://inshell.art/docs/awa) in order. Not available means the movement has no deployed quota.

The token image and the stable Stage, THOUGHT, WILL, and AWA traits show movement progress. PathNFT emits a metadata update after a unit is consumed so compatible readers can refresh the token.

A $PATH detail page joins the canonical token image with capacity, movement tokens already authorized, owner, mint transaction, contract, network, and token metadata source. Pulse-issued tokens also include their original Pulse mint price.

### Permission, not the movement artwork

- Authority: artist-editorial, contract-release

$PATH is an ERC-721 whose state authorizes participation across movements. It can point to THOUGHT, WILL, or AWA progress, but it is not a THOUGHT, WILL, or AWA artwork itself.

The token is also a ledger. Its movement totals and used counts let later readers see how much configured permission has been exercised without relying on a private account database.

### Issuance routes

- Authority: artist-editorial, contract-release

Public $PATH issuance runs through Pulse. The contract can also expose a bounded Spark self-claim route for allowlisted recipients. The issuance route belongs to the token's history and can be shown as a fact, but it does not create a separate class of authenticity.

- Pulse issuance includes the auction settlement and original price context.
- Spark issuance depends on the contract's allowlist and claim rules.
- Every token still needs its network, contract address, and token ID to be identified correctly.

### Movement capacity

- Authority: app-documentation, contract-release

PathNFT configures one quota and one authorized minter for each movement across the deployment. Every $PATH uses those movement totals, while each token stores its own current stage and in-stage minted count. Remaining entitlement is derived from the deployed movement quota and that token's progress; it is not a separate stored balance.

The v0.5.0 canonical deployment policy configures and freezes THOUGHT 1, WILL 10, and AWA 1. That release policy is not a live chain observation. Clients must read getMovementQuota on the named deployment instead of hard-coding those numbers.

- Total: the deployed quota for the movement, applied to every $PATH in that deployment.
- Used: how many units successful mints have consumed from this $PATH for that movement.
- Remaining: total minus this $PATH's derived used count.
- Not available: no capacity is configured; the App must not display a fictional zero-to-something progress bar.

### Consuming one movement unit

- Authority: contract-release

Selecting a $PATH or signing its permission does not consume a unit. For one movement mint, the current owner authorizes a short-lived EIP-191 message bound to the PathNFT address, chain ID, $PATH ID, movement, owner, configured movement minter, current permission epoch, the owner's current consume nonce, and a deadline. ERC-721 approval is not movement authorization, and only the configured movement minter may call consumeUnit.

Before changing state, PathNFT checks the configured caller, the unexpired current-owner authorization, the fixed movement order, and remaining quota. On success it returns the unit's zero-based in-movement serial, advances the owner's consume nonce, and increments that $PATH's current count. When the count reaches the movement quota, $PATH advances to the next movement and resets its in-stage count. MetadataUpdate and MovementConsumed tell readers which $PATH state to refresh.

The configured movement contract is responsible for pairing consumption with the artwork mint. It calls consumeUnit before minting the movement work inside the same transaction. If a later mint step reverts, the EVM rolls back the unit, nonce, progress, events, and work together. A canceled or failed flow consumes nothing.

### Ownership and remaining entitlement

- Authority: app-documentation, contract-release

A regular $PATH can be transferred. Its movement progress and remaining entitlement travel with the token; transfer never resets, duplicates, or replenishes them. Movement works minted before the transfer remain with their existing owners and are not included with the $PATH.

Only the current $PATH owner can authorize movement use. ERC-721 approvals can authorize transfer of a regular $PATH, but they do not authorize THOUGHT, WILL, or AWA consumption. Every successful regular transfer advances the $PATH permission epoch, so a signature from an earlier owner or epoch becomes invalid. Every successful consume also advances the signing owner's consume nonce, invalidating other pending consume authorizations made with the old nonce.

Remaining entitlement is plain language for each movement's configured quota minus its minted count. It is derived from contract state, not a second counter or marketplace trait. A completed regular $PATH may still transfer, but it carries zero remaining entitlement.

- Read owner, stage, minted count, quota, and permission epoch from one consistent block.
- Re-read that snapshot before purchase or movement authorization.
- If ownership, epoch, or progress changed, discard the earlier view and review the current state.

### Spark awards

- Authority: app-documentation, contract-release

A Spark $PATH is a bounded, named award issued through a contract invitation and self-claim flow. It carries the same movement progression and owner-only consume rights as a regular $PATH, but it is permanently locked under ERC-5192 and cannot be transferred or listed.

An invitation reserves one Spark slot until it is claimed, revoked, or released after expiry. The recipient reviews the exact issuer-supplied name and expiry, then claims from the invited wallet. After claim, the name is immutable. The invitation, reserved capacity, claim, and lock are contract facts; they are not a second authenticity tier for the artwork.

- Regular $PATH: transferable, subject to its current progress and permission epoch.
- Spark $PATH: permanently locked, named, and still usable by its owner for eligible movement mints.
- Available reserved capacity and pending invitations are different issuer states and must not be merged.

### Reading a $PATH detail page

- Authority: app-documentation, contract-release

1. Confirm the active network and PathNFT contract address.
2. Read the token ID, owner, issuance route, and mint transaction.
3. Read each movement's deployed quota and this $PATH's derived used and remaining capacity.
4. Before authorizing a movement mint, read the current owner, stage, configured minter, permission epoch, and owner consume nonce from current state.
5. Follow linked movement token IDs to the contracts that minted those works.
6. Compare the displayed artwork and traits with the tokenURI source.

> Marketplace metadata can lag after movement use. PathNFT emits a metadata update so compatible readers know that the token should be refreshed.


### Links

- [view $PATH tokens](https://inshell.art/path)
- [read the contract consume boundary](https://inshell.art/docs/contracts#docs-contracts-consumption)
- [inspect the $PATH v0.5.0 handoff](https://inshell.art/protocol/releases/path-v0.5.0/DOWNSTREAM_HANDOFF.md)
- [read about Pulse](https://inshell.art/docs/pulse)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [verify $PATH contracts](https://inshell.art/verify#verify-contracts)

## Pulse

> Pulse turns public timing into the issue price for each new $PATH.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/pulse
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

[$PATH](https://inshell.art/docs/path) is the permission token; Pulse is the serial mechanism that prices and issues the next public token. They are not interchangeable names.

Pulse runs one live epoch, one current ask, and one next token at a time. A successful bid closes the epoch, records the sale, issues the corresponding $PATH, and starts the next epoch.

Pulse shapes the ask over time. A successful bid closes the current epoch and starts the next one. The next ask is raised by an initial premium. Between sales, the ask decays toward the floor. Equivalently, premium decays toward zero. Settlement samples the ask at sale time.

The pump uses a price-time scale to turn the elapsed time before a sale into the next epoch's initial premium. The drop follows ask(t) = floor + premium(t), with ask(t) = b + ⌊k / (t - a)⌋. Every sale becomes another point in the visible history.

[Inshell](https://inshell.art/docs/inshell) frames Pulse as a mathematical canvas and a crowd instrument: each bid becomes a public point and sets the next beat. The curve and its parameters are exposed because the mechanism is part of the work, not an investment promise.

The price shown in the App is a live read, not a reservation. The [wallet](https://inshell.art/docs/wallet-local-data) flow reads the ask again before submission. If the price moves outside the approved maximum, retry to read and submit the current ask.

This is the Desmos sketch behind Pulse. It is not implementation code.

### Pulse pump and drop equations

- Authority: artist-editorial

```text
pump

PTS = price-time scale
elapsed time = sale time - previous curve start
initial premium = elapsed time × PTS
next floor = last price
next ask = next floor + initial premium


drop

premium(t) = ask(t) - floor
ask(t) = floor + premium(t)
ask(t) = b + ⌊k / (t - a)⌋
(t - a) × (ask(t) - b) ≈ k

b = floor
k = curve constant
a = anchor time
```

### A serial auction

- Authority: artist-editorial, contract-release

Pulse has one current epoch and one next public $PATH at a time. Participants are not choosing among parallel lots. The successful bid closes the visible curve, issues its $PATH, and establishes the starting conditions for the following curve.

This serial structure makes the history legible: every sale is both an ending and the input to what comes next.

### The pump

- Authority: contract-release

The time between the previous curve start and the successful sale is multiplied by the price-time scale. That result becomes the next epoch's initial premium. The next floor is the last sale price, so waiting before a sale affects the height from which the following ask begins.

- A longer elapsed interval produces a larger initial premium when the price-time scale is fixed.
- The premium is added to the new floor; it is not the full next ask by itself.
- The sale price becomes public history and the next floor at the same transition.

### The drop

- Authority: app-documentation, contract-release

During an open epoch, the premium follows the published inverse curve and approaches zero. The ask therefore approaches the floor without silently changing the floor. The App draws that same relationship as a time-price field.

The chart uses half-life units to make curves with different real-time durations visually comparable. Tooltips convert those units back into elapsed or ago time for the current epoch.

### A quote is not a reservation

- Authority: app-documentation, contract-release

1. Read the current ask and active payment asset from the contract-backed App state.
2. Open the local review panel and inspect the maximum charge before the wallet opens.
3. Let the mint flow read the ask again immediately before submission.
4. Confirm only if the wallet request matches the expected network, contract, and maximum value.
5. If the ask moved beyond the approved maximum, retry with a fresh read instead of treating the earlier quote as guaranteed.

### Price ceiling and settlement

- Authority: app-documentation, contract-release

The wallet transaction supplies a maximum acceptable price, not a promise to pay that entire amount. Pulse samples the live ask when the transaction executes. The bid succeeds only when that ask is within the submitted ceiling.

On a successful ETH bid, the auction sends the exact ask to the treasury and refunds surplus value to the bidder. The sale closes the current epoch, records its settlement, and begins the next epoch. The adapter then translates that settlement into $PATH delivery; Pulse itself remains independent of the NFT it prices.

- Maximum price: the bidder's slippage ceiling.
- Settlement price: the live ask accepted by the contract.
- Value supplied: must cover the ask; unused value is refunded.
- Delivery: PathPulseAdapter turns the settled auction result into $PATH issuance.

> A submitted transaction is not a completed sale. Read the receipt, events, and resulting contract state before presenting $PATH as issued.

### Mechanism as artwork

- Authority: artist-editorial, app-documentation

Pulse exposes its curve, parameters, sale dots, and current point because the mechanism is part of the artistic surface. Each bid becomes a beat in a public rhythm: acting, waiting, and the crowd's changing tempo remain visible rather than being reduced to a private checkout flow.

As one participatory system in Inshell's practice, Pulse makes collective timing and choice available for inspection. The curve records action; neither price nor timing measures inward progress or establishes possession of truth.

> This framing describes the work. It is not an investment promise, a price forecast, or a claim that participation will produce financial return.


### Links

- [open live Pulse parameters](https://inshell.art/pulse?raw=1)
- [open original Desmos sketch](https://www.desmos.com/calculator/1d89f93d21)
- [view Pulse source](https://github.com/inshell-art/pulse)

## Contracts

> Contract responsibilities remain separate across auction, issuance, permission, and artwork minting.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/contracts
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

The public architecture is [PulseAuction](https://inshell.art/docs/pulse) → PathPulseAdapter → [PathNFT](https://inshell.art/docs/path) → [ThoughtNFT](https://inshell.art/docs/thought). The arrows describe the issuance and permission path, not contract ownership or a promise that every future movement is deployed.

These contracts specify and enforce bounded actions within the practice. They can validate a permission, mint, or record, but they do not implement the truth named by Inshell or prove a participant's inward understanding.

PulseAuction calculates the live ask, accepts a successful bid, and closes an epoch. PathPulseAdapter translates that settlement into $PATH issuance. PathNFT mints and owns $PATH state, movement order, and capacity. ThoughtNFT validates THOUGHT mint rules, records the work, and atomically consumes an authorized THOUGHT unit from $PATH.

The App orchestrates reads, previews, Agent runs, signatures, and wallet transactions. It does not replace contract validation. A wallet account submits the transaction; deployed contracts decide whether it is valid.

ABIs, bytecode, renderer payloads, schemas, and manifests belong to [pinned releases](https://inshell.art/docs/source-release-boundaries). Contract addresses and deployment blocks belong to a network deployment record. Read both before identifying a live system.

### Separated responsibilities

- Authority: contract-release

The architecture separates pricing, issuance, permission, and artwork minting so each boundary can be inspected independently. Public $PATH issuance and a later THOUGHT mint are separate phases. Contract calls and state handoffs connect them, but no contract owns all the others.

- PulseAuction owns the auction calculation and settlement rules.
- PathPulseAdapter connects the auction to $PATH issuance.
- PathNFT owns $PATH identity, issuance state, and movement capacity.
- ThoughtNFT owns THOUGHT validation, uniqueness, rendering references, metadata, and mint records.

### What the App does

- Authority: app-documentation, contract-release

The App reads state, assembles previews and creation records, requests Agent runs, helps the human choose a $PATH, prepares signatures, and asks the wallet to submit transactions. It can make the workflow understandable, but it cannot override deployed validation.

A successful UI message is not final authority for a mint. The transaction receipt, emitted events, typed contract reads, and tokenURI supply the contract-controlled result.

### The movement-consumption boundary

- Authority: contract-release

PathNFT does not infer movement consent from $PATH selection or ERC-721 approval. It accepts consumeUnit only from the configured movement minter and verifies an EIP-191 authorization signed by the current $PATH owner. The signed message binds the PathNFT address, chain ID, $PATH ID, movement, owner, executor, permission epoch, owner consume nonce, and deadline.

After checking the active stage and remaining quota, PathNFT returns a zero-based movement serial and updates permission progress. The configured movement contract owns the other half of the boundary: it calls consumeUnit before minting its work inside the same transaction. PathNFT owns permission accounting; the movement contract owns work validation and minting. If either half reverts, the transaction commits neither.

### Release plus deployment

- Authority: app-documentation, contract-release

A release says which ABI, bytecode, renderer data, schemas, and checksums belong together. A deployment record says which addresses and deployment blocks put a release on a particular network. Both are required to identify the live system precisely.

> Repository HEAD is not automatically the code behind an older deployed address. Match the active network, deployment record, pinned release, and deployed bytecode.


### Links

- [open contract verification](https://inshell.art/verify#verify-contracts)
- [read $PATH movement consumption](https://inshell.art/docs/path#docs-path-consumption)
- [view $PATH source](https://github.com/inshell-art/path)
- [view THOUGHT source](https://github.com/inshell-art/THOUGHT)
- [view Pulse source](https://github.com/inshell-art/pulse)

## Artwork, Metadata, and Chain

> Artwork and metadata stay legible only when their chain and release context stay attached.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/artwork-metadata-chain
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

Home lists minted [THOUGHT](https://inshell.art/docs/thought) works from the active chain. The [$PATH](https://inshell.art/docs/path) surface lists $PATH tokens from that same chain. The full identity of an NFT is its network, contract address, and token ID; the same token number elsewhere is a different record.

THOUGHT and $PATH artwork and NFT metadata come from each contract's tokenURI and pinned renderer. The App decodes and displays those canonical bytes; it must not rebuild replacement art or silently substitute a newer renderer.

Token metadata carries the canonical image, description, stable marketplace traits, and—when the release defines it—an external_url to the canonical detail page. A generic marketplace can read that portable layer without understanding Inshell's richer records.

Inshell detail pages add context: THOUGHT exposes its work, evidence levels, and creation provenance; $PATH exposes movement state, capacity, linked movement tokens, issuance, and onchain record.

These layers make the public forms and claims of the practice inspectable. They can establish which bytes and records belong to a work; they cannot prove the inward truth of the work or possess its meaning.

These artwork, metadata, provenance, and chain layers describe Inshell's onchain practices. They are not requirements that every Agent Art practice must adopt.

Onchain does not mean context-free. Read network, contract, token ID, deployment, release, tokenURI source, and [attestation status](https://inshell.art/docs/verification) together before deciding what a record proves.

### A token number is not enough

- Authority: contract-release

Token ID 1 can exist on many contracts and networks. Its full identity is the tuple of network, contract address, and token ID. A collection page that omits one of those values may still be convenient, but it is not sufficient for independent verification.

### Canonical artwork bytes

- Authority: app-documentation, contract-release

THOUGHT and $PATH tokenURI responses point to the canonical artwork and metadata produced by their pinned contract systems. The App decodes those bytes for display. It should not redraw an approximation, swap in a newer renderer, or treat a cached marketplace thumbnail as the origin.

- A data URI can carry JSON metadata or SVG artwork directly.
- A pinned renderer release makes the visual construction reproducible and reviewable.
- A social image or screenshot is a presentation copy, even when it looks identical.

### Portable metadata

- Authority: app-documentation, contract-release

Token metadata is the compact layer that generic wallets and marketplaces can understand. It includes the canonical image, description, stable traits, and an external URL when the selected release defines one.

Portable metadata deliberately does not carry every creation detail. Inshell detail pages and provenance endpoints can add richer context while keeping their different authority levels explicit.

### Read context with the object

- Authority: app-documentation, contract-release

- Which network and deployment produced the record?
- Which contract and token ID identify it?
- Which release defines its ABI and renderer?
- Which fields are token metadata, contract state, App records, or runtime reports?
- Is a Creation Attestation present, valid, absent, or not applicable?
- At what block or time was live chain state observed?


### Links

- [view minted THOUGHT works](https://inshell.art/)
- [view all $PATH](https://inshell.art/path)
- [read fully onchain](https://inshell.art/docs/fully-onchain)

## Fully Onchain

> Inshell keeps a work's canonical image and metadata with its onchain record so the work does not depend on a website or media host.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/fully-onchain
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: app-documentation, contract-release

A token should not outlive the artwork it names. If the image lives only on a website, marketplace, or media host, the token can remain while its public form disappears or changes.

For Inshell, the visible form is part of the work. Fully onchain keeps the token record, metadata, and canonical artwork together. A site, wallet, explorer, or marketplace may show the work, but it is a reading surface, not its origin.

Technically, the contract system can return the complete metadata and artwork from code, state, and data on the selected chain without fetching an external content object. ERC-721 alone does not guarantee this: tokenURI may still point elsewhere.

### Why Inshell uses it

- Authority: app-documentation, contract-release

The aim is continuity, not a storage badge. The exact public form should remain available wherever the chain can be read, even when Inshell changes its site or a marketplace changes how it presents the work.

This also lets an onchain work respond to onchain state without replacing its image through a separate media service. Different reading surfaces can render the same canonical result from the same public record.

- The canonical image stays with the record that identifies it.
- No single website or marketplace has custody of the work's continued visibility.
- A changing work can derive its form from public onchain state rather than swapped offchain images.

### Why SVG

- Authority: app-documentation, contract-release

SVG is both an image and a description of an image. Its raw source is human-readable: it names shapes, paths, positions, and fills as text instead of hiding the form inside opaque machine code. A person can inspect the description; a machine can render the same description.

That makes SVG a natural layer between human intention and machine action, an area of interest for Inshell. The human can author and read a structure while the renderer can carry it out without translating the work into a separate, inaccessible format.

SVG is also vector-based: it stays clear at different scales, remains compact, and can be assembled deterministically from onchain state. A contract can embed the completed SVG inside token metadata, so the canonical image needs no image server. When letterforms are included as paths, it needs no webfont either.

### SVG and Agent Art

- Authority: artist-editorial, app-documentation

Generic text-to-image generation can turn a semantic prompt into a finished picture while leaving the picture's visual architecture implicit inside a model's broad aesthetic conventions. The prompt may vary the result, but the artist and participant do not necessarily share a literal structure they can inspect or hold.

Inshell uses SVG to make that structure explicit. The artist can hold the aesthetic architecture as paths, shapes, positions, relations, and rules; a human participant can bring an intention; and an Agent can interpret that intention within the same readable structure. The Agent participates in varying the work without replacing its architecture with an unspecified image-making process.

The same qualities serve fully onchain construction. Raw, plain, descriptive SVG is compact enough to store, deterministic enough to render, and legible to people, Agents, contracts, and ordinary computing systems. One material can relay intention, architecture, machine action, and public preservation. This is an Inshell method within [Agent Art](https://inshell.art/docs/agent-art), not a requirement for Agent Art as a field.

### How Inshell does it

- Authority: app-documentation, contract-release

The pinned [$PATH](https://inshell.art/docs/path) v0.5.0 renderer reads movement progress from contract state and draws the nine required Mono 76 glyph paths held in contract code. Its tokenURI returns self-contained JSON with the SVG embedded inside it.

The portable [THOUGHT](https://inshell.art/docs/thought) V2 design stores the work record, binds its renderer and specification, and constructs its SVG from glyph data held in onchain code storage. Its qualified release proves the design and package, not a live deployment. The [release and deployment boundary](https://inshell.art/docs/source-release-boundaries) keeps those claims separate.

### $PATH SVG example

```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600' role='img' aria-label='PATH movement progress' data-renderer='path-text-status' data-rendering='native-svg-paths' data-progress-model='text' data-family='Inshell Mono 76' data-face='Inshell Mono 76 Regular' data-weight='400' data-release-commit='6fefbfaf762dce0148fe275baafb8e7dd2077beb' data-manifest-sha256='14d734495a8bdc99a98fecbc4f9d76d315c9e2b9fc9b032d5a1fda567258ce11' data-glyph-json-sha256='2cf76834f82050853bdcc9d25bc4f040bd7cc2a6a310206e166f6d162e4f0c2e' data-glyph-slice-sha256='8f484b8c50307139630fab8c0289c0a6a642fa1aee5fb31ebd8966f574b02060' data-center-x='300' data-center-y='300'>
<rect width='600' height='600' fill='#000000'/>
<defs>
<path id='g-T' d='M258 0L258 586L42 586L42 656L558 656L558 586L342 586L342 0Z'/>
<path id='g-H' d='M79 0L79 656L163 656L163 381L437 381L437 656L521 656L521 0L437 0L437 309L163 309L163 0Z'/>
<path id='g-O' d='M300 -12Q226 -12 169 29Q112 70 80 146.5Q48 223 48 331Q48 437 80 512.5Q112 588 169 628Q226 668 300 668Q374 668 431 628Q488 588 520 512.5Q552 437 552 331Q552 223 520 146.5Q488 70 431 29Q374 -12 300 -12ZM300 61Q375 61 420.5 133Q466 205 466 331Q466 455 420.5 525Q375 595 300 595Q225 595 179.5 525Q134 455 134 331Q134 205 179.5 133Q225 61 300 61Z'/>
<path id='g-U' d='M301 -12Q237 -12 186.5 14Q136 40 107.5 97Q79 154 79 248L79 656L163 656L163 246Q163 178 181 137.5Q199 97 230.5 79Q262 61 301 61Q341 61 372 79Q403 97 421.5 137.5Q440 178 440 246L440 656L521 656L521 248Q521 154 492.5 97Q464 40 414.5 14Q365 -12 301 -12Z'/>
<path id='g-G' d='M337 -12Q255 -12 190.5 28.5Q126 69 89.5 145Q53 221 53 328Q53 434 90.5 510Q128 586 193.5 627Q259 668 344 668Q409 668 453 642.5Q497 617 525 588L478 535Q454 561 422.5 578Q391 595 344 595Q283 595 237 562.5Q191 530 165.5 471Q140 412 140 330Q140 206 192.5 133.5Q245 61 342 61Q415 61 456 100L456 271L325 271L325 340L533 340L533 64Q502 33 451.5 10.5Q401 -12 337 -12Z'/>
<path id='g-W' d='M110 0L10 657L104 657L152 245Q155 218 157.5 195.5Q160 173 162 149.5Q164 126 165 93L168 93Q174 126 179 149.5Q184 173 189 195Q194 217 200 244L264 488L344 488L406 244Q413 217 418 195Q423 173 427.5 149.5Q432 126 438 93L442 93Q444 126 445.5 149.5Q447 173 449 195Q451 217 454 244L500 657L590 657L494 0L390 0L326 264Q319 294 313 323Q307 352 302 382L299 382Q294 352 289 323Q284 294 276 264L212 0Z'/>
<path id='g-I' d='M95 0L95 71L258 71L258 586L95 586L95 656L505 656L505 586L342 586L342 71L505 71L505 0Z'/>
<path id='g-L' d='M134 0L134 656L216 656L216 71L541 71L541 0Z'/>
<path id='g-A' d='M232 367L201 267L397 267L366 367Q349 422 332.5 476.5Q316 531 301 588L297 588Q281 531 265 476.5Q249 422 232 367ZM32 0L253 656L347 656L568 0L480 0L418 200L180 200L117 0Z'/>
<clipPath id='path-progress' clipPathUnits='userSpaceOnUse'>
<rect id='thought-progress' x='0' y='-240' width='4200' height='1000'/>
<rect id='will-progress' x='4800' y='-240' width='1200' height='1000'/>
<rect id='awa-progress' x='7800' y='-240' width='0' height='1000'/>
</clipPath>
</defs>
<g id='path-title' data-text-layout='centered-group' fill-rule='nonzero' transform='translate(92.64 311.232) scale(0.0432 -0.0432)'>
<g id='remaining' data-status-layer='remaining' fill='#ffffff'>
<use href='#g-T'/>
<use href='#g-H' x='600'/>
<use href='#g-O' x='1200'/>
<use href='#g-U' x='1800'/>
<use href='#g-G' x='2400'/>
<use href='#g-H' x='3000'/>
<use href='#g-T' x='3600'/>
<use href='#g-W' x='4800'/>
<use href='#g-I' x='5400'/>
<use href='#g-L' x='6000'/>
<use href='#g-L' x='6600'/>
<use href='#g-A' x='7800'/>
<use href='#g-W' x='8400'/>
<use href='#g-A' x='9000'/>
</g>
<g id='consumed' data-status-layer='consumed' fill='#006100' clip-path='url(#path-progress)'>
<use href='#g-T'/>
<use href='#g-H' x='600'/>
<use href='#g-O' x='1200'/>
<use href='#g-U' x='1800'/>
<use href='#g-G' x='2400'/>
<use href='#g-H' x='3000'/>
<use href='#g-T' x='3600'/>
<use href='#g-W' x='4800'/>
<use href='#g-I' x='5400'/>
<use href='#g-L' x='6000'/>
<use href='#g-L' x='6600'/>
<use href='#g-A' x='7800'/>
<use href='#g-W' x='8400'/>
<use href='#g-A' x='9000'/>
</g>
</g>
</svg>
```

### THOUGHT SVG example

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" data-renderer="inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom" data-glyph-library-member="inshell.mono-76" data-glyph-format="IM76-v1" data-glyph-release="v1.0.0" data-glyph-svg-baseline="12" data-glyph-scale="2.88" data-glyph-origin-shift-x="1" data-wrap="greedy-space-then-fixed-cell-overlong-word" data-prompt-vertical-align="top" data-agent-vertical-align="bottom" aria-label="Prompt and Agent response in a terminal chat layout">
<rect id="work-frame" width="1024" height="1024" fill="#006100"/>
<g id="work-canvas" transform="translate(32 32)">
<rect id="canvas-bg" width="960" height="960" fill="#000000"/>
<defs>
<path id="g54" d="M.5 9.9L7.5 9.9M4 9.9L4 .6"/>
<path id="g57" d="M0 9.9L2 .6L4 7.2L6 .6L8 9.9"/>
<path id="g61" d="M1.4 6.5Q2.9 7.5 4.45 7.6Q6.75 7.65 7 5.35L7 .3M6.95 4.65L3 4Q1.55 3.65 1.3 2.4Q1.3 .3 3.95 .45Q6 .5 6.95 2.2"/>
<path id="g62" d="M1.3 .6L1.3 10.8M1.3 5.3Q2.3 7.35 4.4 7.4Q7.1 7.4 7.2 4Q7.2 .4 4.15 .4Q2.3 .4 1.3 2.1"/>
<path id="g63" d="M6.9 6.3Q5.9 7.4 4 7.4Q1.2 7.4 1.1 3.9Q1.25 .45 4 .4Q5.8 .6 6.9 1.2"/>
<path id="g64" d="M6.7 .6L6.7 10.8M6.7 5.3Q5.8 7.35 3.7 7.4Q.9 7.4 .8 3.9Q.9 .4 3.8 .4Q5.8 .4 6.7 2.1"/>
<path id="g65" d="M1.2 4L6.9 4Q6.8 7.4 4.1 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q5.75 .45 6.9 1.2"/>
<path id="g66" d="M3.6 .3L3.65 8.45Q3.65 10.95 5.85 10.95Q6.8 10.95 7.8 10.6M1.4 7.25L7.05 7.25"/>
<path id="g68" d="M1.25 .4L1.3 10.8M1.3 5.3Q2.3 7.35 4.3 7.4Q7.1 7.4 7.2 4L7.15 .35"/>
<path id="g69" d="M1.3 7.25L5 7.25M5 7.25L5 .35M5 10.35L5.4 10.75L5 11.15L4.6 10.75Z"/>
<path id="g6b" d="M1.25 .35L1.25 10.8M7 7.7L1.85 3M4.05 4.35L7.25 .4"/>
<path id="g6c" d="M1.1 10.8L3.5 10.8L3.5 2Q3.5 .4 5.5 .4Q6.7 .4 7.5 1.2"/>
<path id="g6e" d="M1.25 .35L1.3 7.4M1.3 5.2Q2.4 7.35 4.4 7.4Q7.3 7.4 7.3 4L7.3 .35"/>
<path id="g6f" d="M4 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q7 .4 7 3.9Q7 7.4 4 7.4Z"/>
<path id="g72" d="M2.05 .25L2.1 7.4M2.1 4.7Q3.7 7.1 5.4 7.35Q6.45 7.5 7.1 7.15"/>
<path id="g73" d="M7 6.3Q5.9 7.4 4 7.4Q1.3 7.4 1.3 5.7Q1.3 4.4 4 3.9Q7 3.4 7 2Q7 .4 4.1 .4Q2.2 .4 1.1 1.4"/>
<path id="g74" d="M3.25 9.65L3.25 2Q3.25 .4 5.25 .4Q6.45 .4 7.25 1.2M.65 7.25L6.75 7.25"/>
<path id="g75" d="M.75 7.2L.75 3Q.75 .4 3.75 .4Q6.75 .4 6.75 3L6.75 7.2M6.75 .6L6.75 2.2"/>
<path id="g76" d="M1 7.2L3.9 .15L7 7.2"/>
<path id="g78" d="M1 7.2L6.8 .1M7 7.2L1 .05"/>
<path id="g79" d="M.8 7.2L3.8 .4M6.8 7.2L2.8 -2.7"/>
<path id="g2e" d="M4 .15L4 1.9"/>
<path id="g3f" d="M1.7 8.8Q2.5 10.3 4 10.3Q6.2 10.3 6.2 8.2Q6.2 6.8 4.1 5.5L4.1 4.3M3.95 .15L4 1.9"/>
</defs>
<g id="prompt-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="What if the future stays unclear?" data-rows="2" data-field-x="57.6" data-field-y="128" data-field-width="844.8" data-field-height="256" data-field-bottom="384" data-horizontal-align="right" data-vertical-align="top">
<g transform="translate(214.08 171.52) scale(2.88 -2.88)">
<use href="#g57"/>
<use href="#g68" x="10"/>
<use href="#g61" x="20"/>
<use href="#g74" x="30"/>
<use href="#g69" x="50"/>
<use href="#g66" x="60"/>
<use href="#g74" x="80"/>
<use href="#g68" x="90"/>
<use href="#g65" x="100"/>
<use href="#g66" x="120"/>
<use href="#g75" x="130"/>
<use href="#g74" x="140"/>
<use href="#g75" x="150"/>
<use href="#g72" x="160"/>
<use href="#g65" x="170"/>
<use href="#g73" x="190"/>
<use href="#g74" x="200"/>
<use href="#g61" x="210"/>
<use href="#g79" x="220"/>
<use href="#g73" x="230"/>
</g>
<g transform="translate(674.88 235.52) scale(2.88 -2.88)">
<use href="#g75"/>
<use href="#g6e" x="10"/>
<use href="#g63" x="20"/>
<use href="#g6c" x="30"/>
<use href="#g65" x="40"/>
<use href="#g61" x="50"/>
<use href="#g72" x="60"/>
<use href="#g3f" x="70"/>
</g>
</g>
<g id="agent-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="Then choose the next visible kindness." data-rows="2" data-field-x="57.6" data-field-y="576" data-field-width="844.8" data-field-height="256" data-field-bottom="832" data-horizontal-align="left" data-vertical-align="bottom">
<g transform="translate(60.48 747.52) scale(2.88 -2.88)">
<use href="#g54"/>
<use href="#g68" x="10"/>
<use href="#g65" x="20"/>
<use href="#g6e" x="30"/>
<use href="#g63" x="50"/>
<use href="#g68" x="60"/>
<use href="#g6f" x="70"/>
<use href="#g6f" x="80"/>
<use href="#g73" x="90"/>
<use href="#g65" x="100"/>
<use href="#g74" x="120"/>
<use href="#g68" x="130"/>
<use href="#g65" x="140"/>
<use href="#g6e" x="160"/>
<use href="#g65" x="170"/>
<use href="#g78" x="180"/>
<use href="#g74" x="190"/>
<use href="#g76" x="210"/>
<use href="#g69" x="220"/>
<use href="#g73" x="230"/>
<use href="#g69" x="240"/>
<use href="#g62" x="250"/>
<use href="#g6c" x="260"/>
<use href="#g65" x="270"/>
</g>
<g transform="translate(60.48 811.52) scale(2.88 -2.88)">
<use href="#g6b"/>
<use href="#g69" x="10"/>
<use href="#g6e" x="20"/>
<use href="#g64" x="30"/>
<use href="#g6e" x="40"/>
<use href="#g65" x="50"/>
<use href="#g73" x="60"/>
<use href="#g73" x="70"/>
<use href="#g2e" x="80"/>
</g>
</g>
</g>
</svg>
```

### What the claim covers

- Authority: app-documentation, contract-release

Fully onchain says where the canonical metadata and artwork come from. It does not replace the identity, provenance, attestation, release, or observation boundaries described in [artwork, metadata, and chain](https://inshell.art/docs/artwork-metadata-chain).

- It does not by itself mean immutable, non-upgradeable, decentralized, verified, attested, or true.
- A repository and release make construction auditable; they are not runtime content hosts.
- No storage method proves authorship, Agent reasoning, artistic meaning, or the inward truth of a work.


### Links

- [read ERC-721 metadata](https://eips.ethereum.org/EIPS/eip-721)
- [read $PATH](https://inshell.art/docs/path)
- [read THOUGHT](https://inshell.art/docs/thought)
- [read source and release boundaries](https://inshell.art/docs/source-release-boundaries)
- [view $PATH source](https://github.com/inshell-art/path)
- [view THOUGHT source](https://github.com/inshell-art/THOUGHT)

## Mono 76

> Mono 76 is Inshell's sealed native-SVG type system for deterministic artwork text.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/mono-76
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

Mono 76 gives selected Inshell works a fixed visual alphabet. Version 1.0.0 contains 76 ordered records: 75 visible glyphs and one metrics-only SPACE. Every visible glyph is an independently authored centerline SVG path with shared monospaced metrics.

The sealed face emerged from a larger native-SVG glyph study. That research compared many construction systems for legibility, identity, punctuation, marketplace-scale resilience, deterministic rendering, and practical contract size. The released face came from the C02 Classic Book study, then received manual refinement and optical alignment before its paths and metrics were frozen.

Mono 76 is not the site's general interface font. Interface copy remains ordinary selectable text. Mono 76 is used where the letterform is part of the artwork or its deterministic renderer, including the [THOUGHT](https://inshell.art/docs/thought) composition and the movement names drawn inside [$PATH](https://inshell.art/docs/path) tokens.

A renderer consumes path geometry rather than asking a browser to locate a font. This keeps the visible form independent of installed fonts, webfont loading, marketplace font support, and platform-specific text layout.

### A closed repertoire

- Authority: app-documentation, contract-release

The ordered repertoire is SPACE, A-Z, a-z, 0-9, and . , ? ! : ; ' " - ( ) / &. SPACE advances by the same fixed width as every other record but draws no path. Unsupported characters fail validation instead of being replaced by a fallback glyph.

THOUGHT uses the same character repertoire for its Terminal English lines. Its additional byte and spacing rules belong to the THOUGHT specification; Mono 76 defines glyph support and geometry, not the whole creation protocol.

The demo below renders the sealed records in repertoire order from the canonical path data. Its first advance is intentionally empty: that record is SPACE.

### Mono 76 full set demo

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 76" role="img" aria-label="Mono 76 full set: SPACE, uppercase A through Z, lowercase a through z, digits 0 through 9, and punctuation" data-font="Inshell Mono 76" data-version="1.0.0" data-record-count="76" data-visible-glyph-count="75">
<title>Mono 76 full set demo</title>
<desc>The first record is SPACE and intentionally draws no path. The remaining 75 records are shown in sealed repertoire order.</desc>
<rect width="274" height="76" fill="#000000"/>
<g fill="none" stroke="#00ff35" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round">
<g class="mono-76-record" data-record-index="0" data-character="SPACE" data-draws-path="false"></g>
<g class="mono-76-record" data-record-index="1" data-character="A" data-draws-path="true"><path d="M.35 .6L4 9.9L7.65 .6M2.7 3.75L5.3 3.75" transform="translate(13 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="2" data-character="B" data-draws-path="true"><path d="M1.35 .6L1.35 9.9L3.65 9.9Q6.6 9.9 6.6 7.75Q6.6 5.35 3.65 5.35L1.35 5.35M3.65 5.35Q7.2 5.35 7.2 3.1Q7.2 .6 3.85 .6L1.35 .6" transform="translate(23 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="3" data-character="C" data-draws-path="true"><path d="M7.1 8.95Q6.1 10.1 4 10.1Q.75 10.1 .75 5.25Q.85 .7 4.15 .45Q6.15 .4 7.35 1.75" transform="translate(33 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="4" data-character="D" data-draws-path="true"><path d="M1.25 .6L1.25 9.9L4.25 9.9Q7.25 9.9 7.25 5.25Q7.25 .6 4.25 .6Z" transform="translate(43 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="5" data-character="E" data-draws-path="true"><path d="M6.95 9.9L1.45 9.9L1.45 .6L7.15 .6M1.45 5.15L6.25 5.15" transform="translate(53 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="6" data-character="F" data-draws-path="true"><path d="M7.4 9.9L1.7 9.9L1.7 .6M1.7 5.15L6.5 5.15" transform="translate(63 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="7" data-character="G" data-draws-path="true"><path d="M6.95 9Q5.95 10.1 3.85 10.1Q.6 10.1 .6 5.25Q.6 .4 3.9 .5Q6.85 .45 7.1 1.65L7.05 4.9L4.05 4.9" transform="translate(73 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="8" data-character="H" data-draws-path="true"><path d="M1 .6L1 9.9M7 .6L7 9.9M1 5.5L7 5.5" transform="translate(83 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="9" data-character="I" data-draws-path="true"><path d="M1.4 9.9L6.6 9.9M4 9.9L4 .6M1.4 .6L6.6 .6" transform="translate(93 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="10" data-character="J" data-draws-path="true"><path d="M1.9 9.9L7.4 9.9M6.4 9.9L6.4 2.2Q6.3 .5 4.05 .5Q2.25 .65 1.3 2" transform="translate(103 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="11" data-character="K" data-draws-path="true"><path d="M1.25 .6L1.25 9.9M7.3 9.9L1.85 4.3M4.05 5.9L7.55 .6" transform="translate(113 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="12" data-character="L" data-draws-path="true"><path d="M1.75 9.9L1.75 .6L7.45 .6" transform="translate(123 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="13" data-character="M" data-draws-path="true"><path d="M1 .6L1 9.9L4 3L7 9.9L7 .6" transform="translate(133 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="14" data-character="N" data-draws-path="true"><path d="M1.15 .6L1.15 9.9L6.85 .6L6.85 9.9" transform="translate(143 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="15" data-character="O" data-draws-path="true"><path d="M3.9 10Q.8 9.7 .65 5.25Q.85 .35 4.15 .5Q7.15 .55 7.35 5.25Q7.35 9.8 4.25 10Z" transform="translate(153 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="16" data-character="P" data-draws-path="true"><path d="M1.3 .6L1.3 9.9L4.4 9.9Q7.3 9.9 7.3 7.35Q7.3 4.8 4.4 4.8L1.3 4.8" transform="translate(163 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="17" data-character="Q" data-draws-path="true"><path d="M3.8 9.9Q.85 9.6 .65 5.25Q.7 .6 3.9 .5Q7.25 .55 7.35 5.25Q7.15 9.5 4.4 9.9ZM4.8 1.1L6.9 -1.25" transform="translate(173 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="18" data-character="R" data-draws-path="true"><path d="M1.4 .6L1.4 9.9L3.8 9.9Q7.05 9.9 7.05 7.55Q7.05 4.95 3.85 4.95L1.4 4.95M4.05 4.95L7.35 .6" transform="translate(183 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="19" data-character="S" data-draws-path="true"><path d="M7.1 8.95Q5.7 9.75 4.05 9.95Q1.75 9.85 1.5 7.9Q1.5 6.5 4.3 5.4Q7.1 4.3 7.1 2.7Q7.15 .55 3.95 .5Q2.15 .6 .75 1.8" transform="translate(193 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="20" data-character="T" data-draws-path="true"><path d="M.5 9.9L7.5 9.9M4 9.9L4 .6" transform="translate(203 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="21" data-character="U" data-draws-path="true"><path d="M1 9.9L1 3Q1.1 .5 3.9 .5Q6.8 .45 7 3L7 9.9" transform="translate(213 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="22" data-character="V" data-draws-path="true"><path d="M1 9.9L4 .6L7 9.9" transform="translate(223 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="23" data-character="W" data-draws-path="true"><path d="M0 9.9L2 .6L4 7.2L6 .6L8 9.9" transform="translate(233 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="24" data-character="X" data-draws-path="true"><path d="M1 9.9L7 .6M7 9.9L1 .6" transform="translate(243 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="25" data-character="Y" data-draws-path="true"><path d="M1 9.9L4 3.9L7 9.9M4 3.9L4 .6" transform="translate(253 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="26" data-character="Z" data-draws-path="true"><path d="M1.1 9.9L7.1 9.9L1.1 .6L7.1 .6" transform="translate(263 14) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="27" data-character="a" data-draws-path="true"><path d="M1.4 6.5Q2.9 7.5 4.45 7.6Q6.75 7.65 7 5.35L7 .3M6.95 4.65L3 4Q1.55 3.65 1.3 2.4Q1.3 .3 3.95 .45Q6 .5 6.95 2.2" transform="translate(8 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="28" data-character="b" data-draws-path="true"><path d="M1.3 .6L1.3 10.8M1.3 5.3Q2.3 7.35 4.4 7.4Q7.1 7.4 7.2 4Q7.2 .4 4.15 .4Q2.3 .4 1.3 2.1" transform="translate(18 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="29" data-character="c" data-draws-path="true"><path d="M6.9 6.3Q5.9 7.4 4 7.4Q1.2 7.4 1.1 3.9Q1.25 .45 4 .4Q5.8 .6 6.9 1.2" transform="translate(28 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="30" data-character="d" data-draws-path="true"><path d="M6.7 .6L6.7 10.8M6.7 5.3Q5.8 7.35 3.7 7.4Q.9 7.4 .8 3.9Q.9 .4 3.8 .4Q5.8 .4 6.7 2.1" transform="translate(38 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="31" data-character="e" data-draws-path="true"><path d="M1.2 4L6.9 4Q6.8 7.4 4.1 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q5.75 .45 6.9 1.2" transform="translate(48 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="32" data-character="f" data-draws-path="true"><path d="M3.6 .3L3.65 8.45Q3.65 10.95 5.85 10.95Q6.8 10.95 7.8 10.6M1.4 7.25L7.05 7.25" transform="translate(58 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="33" data-character="g" data-draws-path="true"><path d="M6.7 7.4L6.7 0Q6.7 -3.1 3.7 -3.1Q1.5 -3.1 .4 -1.9M6.7 5.2Q5.8 7.35 3.8 7.4Q.9 7.4 .9 4Q.9 1.1 3.8 1.1Q5.8 1.1 6.7 3.1" transform="translate(68 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="34" data-character="h" data-draws-path="true"><path d="M1.25 .4L1.3 10.8M1.3 5.3Q2.3 7.35 4.3 7.4Q7.1 7.4 7.2 4L7.15 .35" transform="translate(78 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="35" data-character="i" data-draws-path="true"><path d="M1.3 7.25L5 7.25M5 7.25L5 .35M5 10.35L5.4 10.75L5 11.15L4.6 10.75Z" transform="translate(88 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="36" data-character="j" data-draws-path="true"><path d="M1.5 7.25L5.2 7.25M5.2 7.25L5.2 -1Q5.2 -2.85 2.7 -2.85Q.9 -2.85 .2 -1.6M5.2 10.35L5.6 10.75L5.2 11.15L4.8 10.75Z" transform="translate(98 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="37" data-character="k" data-draws-path="true"><path d="M1.25 .35L1.25 10.8M7 7.7L1.85 3M4.05 4.35L7.25 .4" transform="translate(108 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="38" data-character="l" data-draws-path="true"><path d="M1.1 10.8L3.5 10.8L3.5 2Q3.5 .4 5.5 .4Q6.7 .4 7.5 1.2" transform="translate(118 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="39" data-character="m" data-draws-path="true"><path d="M.8 .35L.75 7.4M.75 5.2Q1.85 7.35 3.15 7.4Q4.35 7.4 4.35 5.2L4.3 .25M4.35 5.2Q5.2 7.35 6.25 7.4Q7.55 7.4 7.55 5.1L7.6 .2" transform="translate(128 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="40" data-character="n" data-draws-path="true"><path d="M1.25 .35L1.3 7.4M1.3 5.2Q2.4 7.35 4.4 7.4Q7.3 7.4 7.3 4L7.3 .35" transform="translate(138 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="41" data-character="o" data-draws-path="true"><path d="M4 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q7 .4 7 3.9Q7 7.4 4 7.4Z" transform="translate(148 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="42" data-character="p" data-draws-path="true"><path d="M1.3 -2.7L1.3 7.4M1.3 5.3Q2.4 7.35 4.5 7.4Q7.2 7.4 7.3 4Q7.3 .4 4.4 .4Q2.4 .4 1.3 2.1" transform="translate(158 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="43" data-character="q" data-draws-path="true"><path d="M6.65 -2.7L6.65 7.4M6.65 5.3Q5.75 7.35 3.65 7.4Q.85 7.4 .75 3.9Q.85 .4 3.75 .4Q5.75 .4 6.65 2.1" transform="translate(168 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="44" data-character="r" data-draws-path="true"><path d="M2.05 .25L2.1 7.4M2.1 4.7Q3.7 7.1 5.4 7.35Q6.45 7.5 7.1 7.15" transform="translate(178 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="45" data-character="s" data-draws-path="true"><path d="M7 6.3Q5.9 7.4 4 7.4Q1.3 7.4 1.3 5.7Q1.3 4.4 4 3.9Q7 3.4 7 2Q7 .4 4.1 .4Q2.2 .4 1.1 1.4" transform="translate(188 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="46" data-character="t" data-draws-path="true"><path d="M3.25 9.65L3.25 2Q3.25 .4 5.25 .4Q6.45 .4 7.25 1.2M.65 7.25L6.75 7.25" transform="translate(198 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="47" data-character="u" data-draws-path="true"><path d="M.75 7.2L.75 3Q.75 .4 3.75 .4Q6.75 .4 6.75 3L6.75 7.2M6.75 .6L6.75 2.2" transform="translate(208 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="48" data-character="v" data-draws-path="true"><path d="M1 7.2L3.9 .15L7 7.2" transform="translate(218 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="49" data-character="w" data-draws-path="true"><path d="M0 7.2L2 .2L4 6.6L5.95 .15L8 7.2" transform="translate(228 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="50" data-character="x" data-draws-path="true"><path d="M1 7.2L6.8 .1M7 7.2L1 .05" transform="translate(238 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="51" data-character="y" data-draws-path="true"><path d="M.8 7.2L3.8 .4M6.8 7.2L2.8 -2.7" transform="translate(248 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="52" data-character="z" data-draws-path="true"><path d="M1 7.2L7 7.2L1 .4L7 .4" transform="translate(258 32) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="53" data-character="0" data-draws-path="true"><path d="M4 9.8Q1.1 9.8 1.1 4.9Q1.1 .4 4 .4Q6.9 .4 6.9 4.9Q6.9 9.8 4 9.8ZM3.65 4.85L4.35 5.55" transform="translate(88 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="54" data-character="1" data-draws-path="true"><path d="M1.75 8.5L4.45 9.6L4.45 .6M1.45 .6L7.05 .6" transform="translate(98 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="55" data-character="2" data-draws-path="true"><path d="M1 8.4Q2 9.8 3.9 9.8Q6.7 9.8 6.7 7.2Q6.7 5.8 4.9 4.2L1 .6L6.9 .6" transform="translate(108 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="56" data-character="3" data-draws-path="true"><path d="M1.25 8.65Q2.25 9.8 4 9.8Q6.7 9.8 6.7 7.3Q6.7 5.3 3.2 5.2M3.2 5.2Q6.95 5.1 6.95 2.7Q6.95 .4 4 .4Q2 .4 1.15 1.55" transform="translate(118 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="57" data-character="4" data-draws-path="true"><path d="M5.55 .35L5.5 9.6L.8 3.4L7.5 3.4" transform="translate(128 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="58" data-character="5" data-draws-path="true"><path d="M6.9 9.6L1.45 9.6L1.05 5.8L3.9 5.8Q7.05 5.8 7.05 3.2Q7.05 .4 4 .4Q2 .4 1.05 1.6" transform="translate(138 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="59" data-character="6" data-draws-path="true"><path d="M6.8 9Q5.65 10 4.1 9.9Q1.15 9.75 1.15 5.55L1.15 3Q1.15 .45 4.2 .3Q6.9 .45 7.1 2.95Q7.4 6 3.9 5.3L1.25 4.5" transform="translate(148 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="60" data-character="7" data-draws-path="true"><path d="M.7 9.6L6.7 9.6L3.1 .25" transform="translate(158 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="61" data-character="8" data-draws-path="true"><path d="M4 9.8Q1.2 9.8 1.2 7.3Q1.2 5.2 4 5.2Q6.8 5.2 6.8 7.3Q6.8 9.8 4 9.8ZM4 5.2Q1.1 5.2 1.1 2.7Q1.1 .4 4 .4Q6.9 .4 6.9 2.7Q6.9 5.2 4 5.2Z" transform="translate(168 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="62" data-character="9" data-draws-path="true"><path d="M1.25 1.4Q2.05 .4 3.85 .4Q6.75 .4 6.75 5L6.75 7Q6.75 9.8 3.85 9.8Q.95 9.8 .95 7Q.95 4.7 3.85 4.7L6.75 4.7" transform="translate(178 50) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="63" data-character="." data-draws-path="true"><path d="M4 .15L4 1.9" transform="translate(73 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="64" data-character="," data-draws-path="true"><path d="M4.9 1.9L3.4 -2.8" transform="translate(83 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="65" data-character="?" data-draws-path="true"><path d="M1.7 8.8Q2.5 10.3 4 10.3Q6.2 10.3 6.2 8.2Q6.2 6.8 4.1 5.5L4.1 4.3M3.95 .15L4 1.9" transform="translate(93 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="66" data-character="!" data-draws-path="true"><path d="M4 10.1L4 4.3M4 .2L4 1.9" transform="translate(103 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="67" data-character=":" data-draws-path="true"><path d="M4 7.65L4 6.15M4 1.9L4 .2" transform="translate(113 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="68" data-character=";" data-draws-path="true"><path d="M4.4 7.65L4.4 6.15M4.7 1.9L3.2 -2.8" transform="translate(123 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="69" data-character="'" data-draws-path="true"><path d="M4 10.4L4 5.9" transform="translate(133 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="70" data-character="&quot;" data-draws-path="true"><path d="M2.2 10.4L2.2 5.9M5.8 10.4L5.8 5.9" transform="translate(143 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="71" data-character="-" data-draws-path="true"><path d="M1.2 5.3L6.8 5.3" transform="translate(153 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="72" data-character="(" data-draws-path="true"><path d="M6.15 11.1Q3.05 8.8 3.05 4.45Q3.05 .1 6.15 -2.2" transform="translate(163 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="73" data-character=")" data-draws-path="true"><path d="M1.85 11.1Q4.95 8.8 4.95 4.45Q4.95 .1 1.85 -2.2" transform="translate(173 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="74" data-character="/" data-draws-path="true"><path d="M1.4 -1.9L6.6 10.7" transform="translate(183 68) scale(1 -1)"/></g>
<g class="mono-76-record" data-record-index="75" data-character="&amp;" data-draws-path="true"><path d="M7.3 .25L2.2 5.65Q.6 10.2 2.9 10.3Q6.55 10.05 4.7 7.85Q3.8 6.75 1.45 4.8Q-.8 2.1 1.8 .5Q4 -.25 5.65 1.55L7.8 5.9" transform="translate(193 68) scale(1 -1)"/></g>
</g>
</svg>
```

### Centerlines, not font outlines

- Authority: artist-editorial, contract-release

The released face uses open centerline paths: no fill, a fixed round stroke, round caps and joins, fixed advance, no kerning, and one declared origin shift. Reviewed optical adjustments are baked into the path bytes so a renderer does not apply a second hidden tuning table.

Source Code Pro was a visible comparison reference during study. Its outlines were neither imported nor traced into Mono 76 v1.0.0. The earlier outline-reference release is a separate historical artifact with different geometry and licensing; it is not the canonical face.

### Native SVG is the delivery form

- Authority: app-documentation, contract-release

Mono 76 is packaged as path data and a deterministic renderer, not as a WOFF or TTF webfont. Artwork renderers place the paths directly into SVG and must preserve the sealed metrics and stroke contract.

THOUGHT consumes the packed IM76 repertoire for its terminal composition. $PATH embeds only the nine Mono 76 glyph paths needed to draw THOUGHT, WILL, and AWA. Each token image is therefore self-contained; viewing it does not require a font installation or an offchain text renderer.

### Artwork and interface stay distinct

- Authority: artist-editorial, app-documentation

The App does not register Mono 76 with CSS or replace ordinary interface typography with it. Navigation, documentation, forms, status messages, and accessibility text remain browser-readable interface copy. Mono 76 appears when the glyph shape itself belongs to a work or to the work's canonical visual system.

### Pins prevent visual drift

- Authority: app-documentation, contract-release

The sealed package includes the ordered face, packed onchain payload, renderer code, manifest, provenance, verification script, notices, and checksums. A downstream [release](https://inshell.art/docs/source-release-boundaries) must consume that complete contract and pin its hashes rather than copying one convenient glyph file.

THOUGHT and $PATH pin Mono 76 through their own contract releases. Updating the font repository does not change a pinned renderer or an already deployed contract. A new visual revision requires a new reviewed release and explicit downstream repinning; the App must continue reading canonical token artwork rather than silently redrawing it with newer paths.


### Links

- [read THOUGHT](https://inshell.art/docs/thought)
- [read $PATH](https://inshell.art/docs/path)
- [read artwork, metadata, and chain](https://inshell.art/docs/artwork-metadata-chain)
- [read source and release boundaries](https://inshell.art/docs/source-release-boundaries)

## Verification

> Verification separates records, releases, observations, and claims before drawing conclusions.

- Group: Records and verification
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/verification
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation, contract-release

Verification here concerns bounded public claims. It can test a signature, byte sequence, release, deployment, or chain record. It is not the truth named in [Inshell](https://inshell.art/docs/inshell)'s artistic position: inspect self is a direction of practice, not a proposition these proofs can establish.

Authority is the person or system that originates a claim. Loaded from names the immediate technical source used by the interface. A mirror is an indexed or cached copy, not a new authority. Display material is a presentation of a record, not the record itself.

Provenance describes how a work or record came into being and which commitments connect its parts. Proof is the data evaluated by a specific verification rule. Neither word means that every recorded statement is true.

For a token, start from network, contract address, and token ID. Read contract state and tokenURI, identify the deployment and pinned release, recompute published commitments, validate the selected specification, and verify the [Creation Attestation](https://inshell.art/docs/thought#docs-thought-provenance) when one is present.

Contract-verified means the contract accepted the defined proof and bound records. Runtime-reported means a connector received the value from an Agent runtime. Selected means the App or human chose it. Artist-editorial means it expresses the practice. These evidence levels must not be collapsed into one claim.

A valid Creation Attestation verifies one THOUGHT creation record under the rules of its contract release. It does not certify that a work is Agent Art or define the wider field.

The Verify page gathers official origins, [wallet boundaries](https://inshell.art/docs/wallet-local-data), active networks, deployed contracts, release locks, and the active THOUGHT specification. In-place explorer links remain useful for inspecting addresses and transactions on the active public chain.

### Four terms that should not blur

- Authority: app-documentation

- Authority: the person or system that originates a claim.
- Loaded from: the immediate technical source used by the interface.
- Mirror: a copied or indexed representation of another source.
- Display material: a presentation of a record, not automatically its authority.

> A value can be loaded from a cache that mirrors a contract. The cache is the immediate source; the contract remains the authority for the mirrored fact.

### Provenance and proof

- Authority: app-documentation, contract-release

Provenance explains how parts of a work or record are related across creation, rendering, selection, minting, and later display. Proof is narrower: it is the data accepted by a specific verification rule.

A valid proof can establish that certain bytes, hashes, addresses, or signatures agree. It does not automatically make every surrounding narrative statement true.

### Evidence levels

- Authority: app-documentation

- Contract-verified: deployed code accepted the defined values or proof.
- Contract-release: a pinned artifact set defines expected code, schemas, or renderer material.
- Chain-observed: a public read describes state on one named network at an observation point.
- App-recorded: the App assembled, stored, or signed a record with a declared boundary.
- Runtime-reported: the Agent runtime or connector supplied the value.
- Artist-editorial: the statement describes the practice, meaning, or interpretation.

### Work verification checklist

- Authority: app-documentation, contract-release

1. Identify the network without inferring it from the website origin.
2. Confirm the deployed contract address and token ID.
3. Read the contract's typed work state and tokenURI.
4. Identify the matching release and deployment record.
5. Validate published hashes, schema constraints, renderer commitments, and the selected specification.
6. Verify a Creation Attestation when present, or report that the work is Unattested.
7. Name mirrors, caches, runtime reports, and editorial claims without promoting them to contract facts.


### Links

- [open verification](https://inshell.art/verify)
- [read the chain-first verifier guide](https://github.com/inshell-art/inshell.art/blob/main/docs/THOUGHT_PROVENANCE_VERIFIER.md)

## Wallet and Local Data

> Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation
- Canonical page: https://inshell.art/docs/wallet-local-data
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: app-documentation

The shell wallet menu reads the current account and network. Its Refresh action updates wallet and [$PATH](https://inshell.art/docs/path) inventory reads. Opening the menu itself never asks for a signature or transaction.

Product CTAs open wallet requests only when an action needs one: connect, mint $PATH, sign a one-mint $PATH permission, or mint [THOUGHT](https://inshell.art/docs/thought). Canceling a wallet request submits nothing.

A signature can authorize a narrowly defined action without sending a transaction or paying gas. A transaction can change chain state and requires wallet confirmation. The interface must name which one it is requesting.

Save and Load use browser storage. Agent run state is held by the App backend for the run window. Neither is an onchain token, a portable account, or a cross-device record.

Local Anvil, Sepolia, and Ethereum are separate chains with separate contracts, balances, and tokens. Local tokens belong only to the local dev chain. Normal App development preserves that chain across restarts; an explicit reset or redeployment can replace it.

### Reading is not signing

- Authority: app-documentation

Opening the wallet menu, refreshing account state, loading $PATH inventory, or reading public token records should not request a signature or transaction. These are passive reads.

A product action can open a wallet only when it needs account access, a signature, a network switch, or a transaction. The interface should name that boundary before the request appears.

### Signature versus transaction

- Authority: app-documentation

- Connect: gives the App access to the selected public account and network.
- Signature: authorizes the exact message shown by the wallet; it uses no gas and does not change chain state by itself.
- Transaction: calls a contract, can transfer value or change state, and requires wallet confirmation.
- Cancellation: submits nothing. A canceled or rejected request should not be treated as partial success.

### Browser storage and Agent runs

- Authority: app-documentation

Saved THOUGHT candidates live in the current browser. Temporary Agent run state lives within its App-defined run window. These records may be useful during creation, but they are not tokens, public provenance, or synchronized accounts.

> Clearing browser data, changing browsers, or moving to another device can make local saves unavailable.

### Networks do not merge

- Authority: app-documentation

Local Anvil, Sepolia, and Ethereum have different chain IDs, deployments, balances, transaction histories, and token identities. A familiar token number or account address on two networks does not make the records equivalent.

## Source and Release Boundaries

> Source ownership, release artifacts, deployments, and publication are versioned independently.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation, contract-release
- Canonical page: https://inshell.art/docs/source-release-boundaries
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: app-documentation, contract-release

The Inshell App, [$PATH](https://inshell.art/docs/path) contracts, [THOUGHT](https://inshell.art/docs/thought) contracts, and [Pulse](https://inshell.art/docs/pulse) auction have separate repositories and ownership boundaries. The App owns creation flow, integration, and presentation. Each contract repository owns its contract behavior and release artifacts. Deployment operators own network deployment records.

The App consumes pinned ABIs, bytecode, schemas, renderer data, specifications, manifests, and checksums. A repository's latest source is not automatically the deployed release. A newer file is not authority for an older deployment.

Contract releases contain code and integrity material; network addresses and deployment blocks come from a separately verified deployment record. A correct integration matches the App pin, release artifacts, deployed bytecode, renderer commitments, and active network.

Documentation can describe repository source, a pinned release, or observed chain state. It must say which. Mirrors and previews are useful distribution surfaces but do not silently become canonical origins.

### Repository ownership

- Authority: app-documentation, contract-release

- The Inshell App repository owns same-origin presentation, orchestration, API behavior, and integration pins.
- The $PATH repository owns $PATH contracts and their release artifacts.
- The THOUGHT repository owns THOUGHT contracts, specifications, renderer releases, and their integrity material.
- The Pulse repository owns the auction contract and pricing mechanism release.

### Why pins matter

- Authority: app-documentation, contract-release

A repository can continue changing after a contract is deployed. The App therefore consumes selected ABIs, bytecode, schemas, renderer payloads, manifests, and checksums instead of assuming that the newest source describes every historical token.

### Release is not deployment

- Authority: app-documentation, contract-release

A release may be complete without being deployed. A deployment record adds the network, contract addresses, deployment blocks, and integration choices needed to find it onchain. [Verification](https://inshell.art/docs/verification) joins both records and checks deployed bytecode where possible.

### Publication boundaries

- Authority: app-documentation

Canonical pages, Markdown documents, JSON indexes, API responses, GitHub mirrors, preview deployments, and third-party explorers serve different readers. Linking or mirroring improves access; it does not silently transfer authority.

> When documentation describes live chain state, name the network and observation point. When it describes a release, name the release rather than relying on the checked-out repository branch.


### Links

- [Inshell App source](https://github.com/inshell-art/inshell.art)
- [$PATH source](https://github.com/inshell-art/path)
- [THOUGHT source](https://github.com/inshell-art/THOUGHT)
- [Pulse source](https://github.com/inshell-art/pulse)

## Lineage

> Separating the person who specifies a work from whatever carries it out is an old move in art; Agent Art inherits the question, not the authority.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/lineage
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

Agent Art is new as a name. The questions underneath it are not. Art has repeatedly split the person who specifies a work from the person or process that executes it, and has repeatedly asked what remains of authorship after the split.

Inshell reads that history as context, not as permission. Naming a precedent does not inherit its authority and does not make this practice a continuation of anyone else's.

### Instruction and execution

- Authority: artist-editorial

Sol LeWitt's wall drawings exist as written instructions together with a signed certificate. Other people execute them on a wall, and two executions of the same instruction can differ while remaining the same work. LeWitt's stated position was that the concept is the primary part of the work rather than the surface that results from it.

That arrangement makes a specific claim: a work can be a rule plus a record of authorization, and the visible object can be downstream of both. An artwork built that way survives the loss of any particular execution.

### Scores realized by others

- Authority: artist-editorial

Fluxus developed the same idea as a score. George Brecht's event scores of the early 1960s are short directives that someone performs, publicly or privately. Yoko Ono's Grapefruit, published in 1964, collects instructions whose realization is often left to the reader's mind rather than to any material.

A score is written to be realized by someone other than its author, and it stays open to variation without becoming a different work. The score and its realizations are two different things, and both can be preserved.

### Who completes the work

- Authority: artist-editorial

Marcel Duchamp argued that the creative act is not finished by the artist alone, and that the viewer completes it by interpreting the work into the world. Roland Barthes made a parallel argument for text in 1967: meaning is produced where a work is read, not sealed by the author's intention.

Inshell's practice depends on this. A preserved exchange is not self-explaining. The person who later reads it is doing part of the work, which is why the practice asks for inspection rather than agreement.

### Where Agent Art differs

- Authority: artist-editorial

In instruction art the executor is a person following a score, or a machine following a rule the artist wrote. In either case the specification and the execution are separated, but the executor does not interpret in the sense that matters here.

An Agent does more than execute: it interprets, and an intent formed through that interpretation enters the work. The instruction does not fully determine the result, and the result is not random either. That is the gap [Agent Art](https://inshell.art/docs/agent-art) names, and it is why intentional participation rather than automation is the invariant.

Inshell's response is to preserve both sides. [THOUGHT](https://inshell.art/docs/thought) keeps one exact human prompt beside one exact Agent response, so the score and its realization stay in a single record and can be read against each other. That is one Inshell choice, not a requirement of the field.

### Evidence boundary

- Authority: artist-editorial

The artists, works, and dates named here are public references to other people's practices. Inshell does not verify them onchain, claim affiliation or endorsement, or present this reading as art-historical consensus.

> A named precedent locates a question. It does not transfer authority to the practice that cites it.


### Links

- [read Agent Art](https://inshell.art/docs/agent-art)
- [read THOUGHT](https://inshell.art/docs/thought)
- [read Generative Art](https://inshell.art/docs/generative-art)
- [Sol LeWitt](https://en.wikipedia.org/wiki/Sol_LeWitt)
- [Fluxus](https://en.wikipedia.org/wiki/Fluxus)

## Generative Art

> Rule-based art has a sixty-year public record, and its onchain form derives variation from a seed; Inshell derives variation from intention instead.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/generative-art
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

Generative art makes the rule part of the work. The artist writes a procedure, the procedure produces the artifact, and attention moves from the individual mark to the system that produced it.

Inshell works with rules and with a public machine, but its variation does not come from a seed. Stating that difference keeps both practices legible instead of collapsing them into one category.

### 1965 and generative aesthetics

- Authority: artist-editorial

Three 1965 exhibitions are generally treated as the first public showings of computer-generated graphics: Georg Nees in Stuttgart in February, A. Michael Noll and Bela Julesz at the Howard Wise Gallery in New York in April, and Frieder Nake with Nees in Stuttgart in November. The philosopher Max Bense, who encouraged the Stuttgart work, coined the term generative aesthetics around the February showing.

Vera Molnár and Manfred Mohr began working with computers toward the end of that decade. Molnár is notable in the group for arriving from a lifelong painting practice rather than from science, which is part of why her work reads as art using a machine rather than a machine demonstrating art.

### The onchain turn

- Authority: artist-editorial

Art Blocks launched in November 2020 with Erick Calderon's Chromie Squiggle. A project's generating script is stored in a contract. When a collector mints, the transaction yields a 32-byte hash, and that hash is injected into the script as its seed. The same hash and the same script always produce the same output.

This established a pattern that much later onchain work follows: store the rule, take the variation from the chain, and derive the image on demand rather than storing it. The artwork becomes reproducible from public state.

### Seed is not intention

- Authority: artist-editorial

In seeded generative art the source of variation is a number that nobody chose for its meaning. Its role is to be unpredictable and fairly distributed, and any meaning it carries is assigned afterward.

In [THOUGHT](https://inshell.art/docs/thought) the source of variation is a written human intention and an Agent's response to it. Both are authored text, and neither is random. What varies between two works is what somebody meant and how an Agent read it.

This changes what preservation has to hold. A seeded work can be regenerated from its seed, so storing the rule and the seed is enough. An exchange cannot be regenerated from a seed, because the exchange is the content. Inshell therefore preserves the exchange itself rather than a procedure for recreating it.

This is a description of two methods, not a ranking of them.

### Evidence boundary

- Authority: artist-editorial

Exhibitions, dates, platforms, and mechanisms named here are public references. Inshell has not audited the contracts or archives behind them, claims no affiliation, and does not present this account as a complete history of the field.


### Links

- [read Agent Art](https://inshell.art/docs/agent-art)
- [read THOUGHT](https://inshell.art/docs/thought)
- [read Onchain Art](https://inshell.art/docs/onchain-art)
- [Frieder Nake](https://en.wikipedia.org/wiki/Frieder_Nake)
- [Art Blocks](https://www.artblocks.io/)

## Agents and AI

> A program, a model, and an Agent are different participants, and Agent Art names the third rather than the technology behind it.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/agents-and-ai
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

The machine's role in making images has changed at least three times: a program that executes rules an artist wrote, a model that learns a distribution and samples from it, and an Agent that plans, calls tools, and acts across several steps.

Agent Art names participation, not a model class. Keeping the three eras distinct is what makes that claim precise rather than fashionable.

### The program era

- Authority: artist-editorial

Harold Cohen named AARON in 1973 and developed it during a residency at Stanford's Artificial Intelligence Laboratory in the mid-1970s. AARON combined explicit compositional rules with random events to produce drawings, and Cohen maintained and rewrote it for roughly four decades.

The rules were authored by a person and executed by a program. Where the work came from was never in question, because the artist had written the procedure that made it.

### The model era

- Authority: artist-editorial

Generative adversarial networks moved image-making from written rules to learned distributions. A GAN portrait sold at Christie's in October 2018 for $432,500; the collective that submitted it had built on open-source code published by another researcher, and the credit question was never settled.

That dispute is the characteristic problem of the era. When the rules are learned rather than written, it becomes genuinely unclear where authorship sits: in the training data, the architecture, the code, the weights, or the person who pressed the button.

Text-to-image diffusion systems made this ordinary. DALL·E 2 appeared in April 2022 and Stable Diffusion in August 2022. A prompt selects a region of a learned space, and that space carries broad aesthetic conventions the prompt never specified.

### The Agent era

- Authority: artist-editorial

An Agent is normally distinguished from a model by what it does rather than what it is. It plans, selects and calls tools, acts over multiple steps, checks results, and adapts. The model is a component inside that behaviour; the Agent is the behaviour.

This is why [Agent Art](https://inshell.art/docs/agent-art) asks whether an Agent's intent enters the work rather than which architecture produced a pixel. Running an Agent through a runtime or service, or assigning it an executor role, does not satisfy the invariant by itself. Appearing in the subject matter or the marketing certainly does not.

### Why Inshell says Agent

- Authority: artist-editorial

AI names a research field and a marketing category, and its meaning shifts with each cycle of attention. Agent names a participant in an activity, which is the thing the field is actually about.

The narrower word also fits the practice's origin. A model label, a terminal, a command line, and a technical wrapper are among the shells [Inshell](https://inshell.art/docs/inshell) names. Calling the participant an Agent keeps attention on what it does rather than on the shell it arrives in.

### Evidence boundary

- Authority: artist-editorial

Systems, dates, and sale figures here are public references. Inshell does not verify them, endorse them, or claim any relation to the parties named.

Nothing in this topic describes the Agent behaviour of a particular Inshell work. Agent runs vary by provider, model version, and runtime, and are reported at a lower evidence level than contract or chain facts. Read [THOUGHT](https://inshell.art/docs/thought) and [Verification](https://inshell.art/docs/verification) for what is actually claimed about a work.


### Links

- [read Agent Art](https://inshell.art/docs/agent-art)
- [read Inshell](https://inshell.art/docs/inshell)
- [read Verification](https://inshell.art/docs/verification)
- [Harold Cohen and AARON](https://computerhistory.org/blog/harold-cohen-and-aaron-a-40-year-collaboration/)

## SVG

> SVG is a text document that describes shapes, which is why a person, a browser, a contract, and an Agent can all read the same artwork.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/svg
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

Most image formats are containers of pixels. SVG is a document that describes shapes. Inshell treats that difference as the reason to use it as a material rather than as an export format.

### A public document format

- Authority: artist-editorial

The W3C began work on SVG in 1998. SVG 1.0 became a Recommendation on 4 September 2001 and SVG 1.1 on 14 January 2003; SVG 2 has remained at Candidate Recommendation. The format is XML, which means an SVG file is text and the text is the picture.

Because it is a public standard with several independent implementations, an SVG stays readable without any one vendor's software remaining in business. That property matters more for a work meant to last than any particular rendering feature does.

### Four kinds of reader

- Authority: artist-editorial

A person can read an SVG and follow what it draws. A browser can render it. A contract can assemble it from strings and return it. An Agent can inspect it, locate a specific element, and change that element without disturbing the rest.

Few materials are legible to all four. That overlap is what lets one file carry human intention, aesthetic architecture, machine action, and public preservation at once, which is the argument made in full under [Fully Onchain](https://inshell.art/docs/fully-onchain#docs-fully-onchain-agent-art).

### Bytes are the constraint

- Authority: artist-editorial

Onchain, size is not a preference but a price. A vector description of a detailed image can occupy a few kilobytes where a raster of the same image would be far larger, and on [Ethereum](https://inshell.art/docs/ethereum) that difference is paid in gas at mint and stored forever.

SVG is unusual in making the compact option and the readable option the same option. Compression that produced smaller but unreadable bytes would lose the property the material was chosen for.

### How Inshell narrows it

- Authority: artist-editorial

Inshell uses raw, plain, descriptive SVG and carries letterforms as path geometry rather than as webfont references, so a work depends on nothing outside its own bytes. [Mono 76](https://inshell.art/docs/mono-76) is the sealed type system that makes text in artwork behave that way.

This is a material choice inside one practice. SVG is not required for fully onchain work, and it is not required for Agent Art as a field.

### Evidence boundary

- Authority: artist-editorial

Specification names and dates are public W3C facts and are cited as orientation. How Inshell actually builds and pins its SVG is described under Fully Onchain and Mono 76, which carry contract-release authority; this topic carries none.


### Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [read Ethereum](https://inshell.art/docs/ethereum)
- [SVG 1.1 specification](https://www.w3.org/TR/SVG11/)

## Ethereum

> The chain is a deterministic public machine with a price on every byte, and that price is a formal constraint rather than an inconvenience.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/ethereum
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

Ethereum gives an artwork three unusual properties: a public machine that anyone can re-run and get the same answer, a record no single party can quietly revise, and a price on every byte stored.

The third property is the one that shapes form.

### A deterministic public machine

- Authority: artist-editorial

The Ethereum Virtual Machine executes contract code identically on every node that runs it. A function that assembles an image returns the same bytes to everyone who calls it against the same state, without a server deciding what to send.

That determinism is what allows a contract to act as a renderer rather than only as a ledger. The artwork is not a file the contract points at; it can be a value the contract computes.

### Every byte has a price

- Authority: artist-editorial

Contract storage is charged per 32-byte word, and writing a fresh word costs on the order of twenty thousand gas, which puts a kilobyte of stored data on the order of hundreds of thousands of gas. Practitioners reduce this with techniques such as packing, contract-bytecode storage, and libraries in the SSTORE2 family, but the cost never becomes negligible.

Onchain artwork is therefore written under a budget. Compactness is not a stylistic preference; it is the condition of existing onchain at all.

### The budget is a bound

- Authority: artist-editorial

Inshell already holds that bounds create form, and the price of a byte is one of those bounds. It rules out casual accumulation and rewards descriptions that are exact, which is the same discipline described under [Design Principles](https://inshell.art/docs/design-principles) arriving from the direction of cost rather than from the direction of intent.

A constraint that comes from the material is harder to abandon than one the artist merely declared. This one is enforced by the network on every mint.

### The token can carry the work

- Authority: artist-editorial

A contract can return a data URI from its metadata function, embedding the metadata document and the image itself instead of an address where they might be found. Reading the token then is reading the work, with no host involved. That arrangement is what [Fully Onchain](https://inshell.art/docs/fully-onchain) describes for Inshell, and what [Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts) contrasts with ordinary pointer practice.

### Evidence boundary

- Authority: artist-editorial

Gas figures here describe published EVM pricing at order-of-magnitude precision and change with network upgrades. They are not quoted as current values for any chain, and they are not measurements of any Inshell deployment. Networks, addresses, and deployment facts for Inshell's own contracts belong to [Contracts](https://inshell.art/docs/contracts) and [Verification](https://inshell.art/docs/verification).


### Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Contracts](https://inshell.art/docs/contracts)
- [read Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts)
- [ERC-721 standard](https://eips.ethereum.org/EIPS/eip-721)

## Tokens and NFTs

> A token is a record that names a work; most tokens only point at one, and pointers decay.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/tokens-and-nfts
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

ERC-721 gave Ethereum a standard way to say that a particular token is one of a kind and belongs to a particular address. It was proposed by William Entriken, Dieter Shirley, Jacob Evans, and Nastassia Sachs in January 2018, and it is why a token can be transferred, sold, and read consistently across wallets, explorers, and marketplaces.

What the standard does not do is hold the artwork.

### The metadata function is a pointer

- Authority: artist-editorial

The standard's metadata extension returns a URI for each token. In common practice that URI addresses a JSON document on a web server or through an IPFS gateway, and the JSON in turn addresses an image somewhere else again.

Ownership is onchain. The picture usually is not. A token can be perfectly valid, perfectly transferable, and show nothing at all.

### Pointers decay

- Authority: artist-editorial

Published surveys of large NFT samples have repeatedly found substantial fractions with token URIs that no longer resolve, image paths that are broken, or IPFS content unreachable through the gateway named in the record. Reported figures have run to roughly a fifth of the sampled tokens.

Collections have also lost their images when a company changed access rules on the servers holding them, leaving holders with valid tokens and no picture. In most cases this is not fraud. It is ordinary infrastructure entropy applied to a record that was supposed to outlast infrastructure.

### What Inshell takes and refuses

- Authority: artist-editorial

Inshell uses the token standard for what it does well: a public, transferable, consistently readable record of which work is which and which address holds it.

Inshell refuses the pointer. The canonical image and metadata are returned by the contract itself, so no host stands between the record and the work. [Fully Onchain](https://inshell.art/docs/fully-onchain) states that arrangement and its limits precisely.

This is a choice about where a work lives. It is not a claim that pointer-based tokens are not art, and not a claim that Inshell's arrangement is safe from every failure.

### Evidence boundary

- Authority: artist-editorial

Survey percentages come from third-party studies of particular samples at particular times and are cited as orders of magnitude, not current measurements. Inshell has not reproduced them and does not name the collections involved. Claims about Inshell's own tokens belong to [Artwork, Metadata, and Chain](https://inshell.art/docs/artwork-metadata-chain) and [Verification](https://inshell.art/docs/verification).


### Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Artwork, Metadata, and Chain](https://inshell.art/docs/artwork-metadata-chain)
- [read Onchain Art](https://inshell.art/docs/onchain-art)
- [ERC-721 standard](https://eips.ethereum.org/EIPS/eip-721)

## Onchain Art

> Onchain is a spectrum, and the useful question is which part of a work the chain actually holds.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial
- Canonical page: https://inshell.art/docs/onchain-art
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial

Calling a work onchain says little on its own. A chain can hold the ownership record, the generating rule, the finished image, or only a hash of something kept elsewhere. These are different claims with different consequences.

### Degrees of onchain

- Authority: artist-editorial

Four arrangements are common. The record is onchain and the artwork sits at a web address. The record is onchain and the artwork is content-addressed offchain. The rule is onchain and the image is derived by re-running it. Or the image bytes are assembled onchain and returned directly.

Only the last two survive the disappearance of every host. The first two describe where a work is filed rather than where it lives.

### Public precedents

- Authority: artist-editorial

Autoglyphs, released by Larva Labs in 2019 as a set of 512, embedded its generator in the contract so the network itself ran the code that produced each work, and the generator stopped once the supply was reached.

Art Blocks, from late 2020, keeps the generating script in a contract and takes each token's seed from its mint transaction. Projects including Blitmap, Nouns, and Chain Runners store vector or pixel assets in contract storage and assemble the image when metadata is requested; several released their work under CC0, treating the onchain asset as something others are free to extend.

### Where Inshell sits

- Authority: artist-editorial

Inshell assembles the completed SVG inside the contract and returns it in token metadata, so the canonical image needs no image server and no webfont. The full account, including what the arrangement does not cover, is under [Fully Onchain](https://inshell.art/docs/fully-onchain).

Inshell also keeps the claim narrow. Fully onchain is a statement about chain sufficiency for specific content. It is not a synonym for immutable, non-upgradeable, decentralized, deployed, verified, or good, and each of those would need its own evidence.

### Evidence boundary

- Authority: artist-editorial

Other projects are named as public reference points. Inshell has not audited their contracts, does not verify their present behaviour, and claims no affiliation with them. Descriptions refer to publicly documented designs, and designs change after they are documented.

> Do not read a project's presence in this list as endorsement, comparison of quality, or a claim about its current state.


### Links

- [read Fully Onchain](https://inshell.art/docs/fully-onchain)
- [read Generative Art](https://inshell.art/docs/generative-art)
- [read Tokens and NFTs](https://inshell.art/docs/tokens-and-nfts)
- [Autoglyphs](https://www.larvalabs.com/autoglyphs)

## Design Principles

> Inshell's design rules connect participation, visible form, and the limits of evidence.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/design-principles
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

### Overview

- Authority: artist-editorial, app-documentation

Inshell's works connect artistic meaning to operating rules. A response limit, a serial auction, a movement capacity, a renderer pin, or an evidence label is not merely backstage implementation. Each rule changes what participants can do and what later readers can know.

Five design choices recur across Inshell's systems: collaboration is bounded, the authority to continue or preserve is explicit, mechanisms stay visible, canonical sources remain identifiable, and claims stop where their evidence stops. They give the practice form as it approaches truth without claiming possession. They are choices of practice, not a doctrine, a set of propositions to prove, or a definition of Agent Art.

### Bounds create form

- Authority: artist-editorial, app-documentation, contract-release

[THOUGHT](https://inshell.art/docs/thought) allows one prompt, one Agent response, exact byte rules, and one human mint decision. [Pulse](https://inshell.art/docs/pulse) allows one active epoch and one next public $PATH. [$PATH](https://inshell.art/docs/path) exposes an ordered movement sequence with configured capacities. These constraints make the resulting differences legible.

Within THOUGHT, more options would not automatically create more expressive work. Its boundary concentrates attention on the choices that remain: which intention to write, which response to preserve, which $PATH to use, and how to read the record afterward. Other [Agent Art](https://inshell.art/docs/agent-art) practices may choose different boundaries and forms.

### Generation is not preservation

- Authority: artist-editorial, app-documentation, contract-release

A system can produce a candidate without declaring it part of the public corpus. In Inshell's onchain practices, THOUGHT separates Agent return from human review and successful mint, while Pulse separates a visible ask from a participant's confirmed bid. Their contract actions are specific preservation boundaries, not a universal rule for Agent Art.

### Mechanism stays visible

- Authority: artist-editorial, app-documentation, contract-release

Pulse shows the curve, floor, premium, sale points, and current ask. $PATH shows movement totals and use. THOUGHT publishes its language boundary, renderer, metadata, and attestation model. The mechanism is not hidden after it produces an output because understanding the mechanism changes how the output can be experienced.

### One canonical form, many reading surfaces

- Authority: app-documentation, contract-release

An onchain Inshell work can appear on the site, in a wallet, on a marketplace, through an API, in Markdown, or inside an Agent's answer. Those surfaces can add access and context. They should still point back to the network, contract, tokenURI, pinned release, and declared record authority that make that work identifiable.

### Transparency without overclaiming

- Authority: artist-editorial, app-documentation

[Public provenance](https://inshell.art/docs/verification) is useful because it connects exact values and names where they came from. It becomes weaker when every field is described as verified in the same way. Inshell therefore distinguishes contract validation, release facts, live chain observations, App records, runtime reports, and artist statements.

The aim is not to make uncertainty disappear. It is to make the boundary of each claim inspectable.

### The work continues through time

- Authority: artist-editorial, app-documentation, contract-release

Pulse changes with every sale and every interval between sales. A $PATH accumulates movement use. The THOUGHT corpus grows one selected pair at a time. Releases and deployments create historical layers that must remain readable as interfaces change.

This makes documentation part of preservation. It records visible interactions and keeps the work's form, permissions, and evidence connected over time.


### Links

- [create a THOUGHT](https://inshell.art/thought)
- [view the Pulse field](https://inshell.art/path)
- [inspect verification boundaries](https://inshell.art/verify)

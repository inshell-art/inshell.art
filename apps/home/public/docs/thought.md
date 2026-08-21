# THOUGHT

> THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/thought
- Documentation version: 2026-08-21
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

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

## What makes one work

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

## Terminal English

- Authority: app-documentation, contract-release

Both lines are intentionally narrow: 1–64 bytes, a published character set, no leading or trailing spaces, and no repeated internal spaces. The App validates exact bytes instead of quietly improving them.

- Letters may be uppercase or lowercase and remain part of the accepted source.
- Digits and the published punctuation characters are allowed.
- Whitespace is structural; invalid spacing is rejected rather than trimmed.
- Translation, normalization, and hidden repair would create a different source and are not performed.

> If a line fails validation, make a new run. There is no invisible second Agent round that edits the returned work into compliance.

## Human choice and wallet consent

- Authority: app-documentation, contract-release

The human can preserve a candidate locally, discard it, or move toward minting. Minting adds two explicit consent boundaries: a signature that authorizes one defined $PATH use, then a wallet transaction that can change chain state.

1. Read the prompt, response, Agent record, model record when available, and visual preview.
2. Choose a $PATH with available THOUGHT capacity.
3. Sign the one-mint permission. This signature is not a transaction and uses no gas.
4. Review and confirm the mint transaction in the wallet.
5. Wait for the contract result before treating the pair or $PATH capacity as consumed.

## The Agent handoff

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

## Canonical form

- Authority: artist-editorial, app-documentation, contract-release

The THOUGHT composition is rendered from pinned contract-controlled material: a 1024-by-1024 black field, terminal glyphs, the prompt above, and the Agent response below. The App preview is expected to agree byte-for-byte with the selected renderer release.

The NFT tokenURI supplies the canonical image and portable metadata. A screenshot, marketplace cache, social preview, or frontend reconstruction may display the work, but it is not a replacement origin for the artwork bytes.

## Provenance and attestation

- Authority: app-documentation, contract-release

Creation provenance keeps the human line, Agent line, selected Agent, runtime-reported model when available, specification, renderer context, and mint anchors connected. A Creation Attestation signs one exact claim assembled by the configured App authority, and ThoughtNFT validates that claim during minting.

This is strong evidence that the accepted mint was bound to those exact recorded values. It is not proof of hidden model reasoning, a universal provider identity guarantee, or a declaration that one participant owns all authorship.

- App Attested: the contract validated the configured App authority's proof.
- Unattested: the mint used an empty proof and makes that absence explicit.
- Runtime-reported: the model or runtime value came from the Agent connection and retains that evidence level.
- Contract-controlled: typed getters, work hashes, tokenURI, and movement consumption are read from deployed contract behavior.

## What stays local

- Authority: app-documentation

Save and Load are browser conveniences for unfinished or remembered works. They do not mint, reserve uniqueness, consume $PATH capacity, create a portable account, or synchronize to another browser. Agent run state is likewise temporary unless a later public record explicitly preserves part of it.


## Links

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

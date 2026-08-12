# THOUGHT

> THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, app-record, contract-release, runtime-report
- Canonical page: https://inshell.art/docs/thought
- Documentation version: 2026-08-12
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial, app-documentation, app-record, contract-release, runtime-report

THOUGHT is the first movement on Inshell's PATH and begins with the individual. It gives the inward direction—inspect self—a bounded occasion: simply inspect your thought and what becomes visible when one Agent responds. The thought's words, source, and motivation remain open to inspection, as do the knowledge it carries and the reasons that knowledge became believable. The Agent response enters that practice as another exact line to read; it does not resolve the thought or claim possession of its truth.

Within the wider field of Agent Art, THOUGHT chooses a narrow terminal practice: one exact human prompt and one exact Agent response. Their ordered pair defines the globally unique work; either line may appear again with a different counterpart.

The creation flow is: human prompt → Agent response → validation and canonical record assembly → human selection → wallet confirmation → PATH movement consumption → THOUGHT minted. The model proposes. The human decides. The wallet confirms. The contract records.

Prompt and Agent response are each 1–64 bytes of Terminal English. Allowed characters are space, A–Z, a–z, 0–9, and . , ? ! : ; ' " - ( ) / &. Leading spaces, trailing spaces, and repeated internal spaces are rejected. Validation never trims, normalizes, repairs, translates, or rewrites accepted bytes.

The human reviews the returned response and preview, then decides whether to preserve, discard, or mint the work. To mint, the human picks an available PATH, signs a one-mint permission bound to the current PATH state and ThoughtNFT executor, and confirms the transaction. The signature is not a transaction and uses no gas.

A successful mint atomically consumes exactly one THOUGHT unit from the selected PATH. A canceled or failed mint consumes nothing and does not reserve the prompt-response pair.

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
  - `prompt-in-work: human-prompt (Human prompt P) --[+ · The exact human prompt is paired with the exact Agent response.]--> agent-response (Agent response R)`
  - `response-in-work: agent-response (Agent response R) --[↓ · The exact prompt-response pair forms one THOUGHT.]--> one-thought (One THOUGHT (P, R))`
- Semantic groups:
  - `thought-equation [set]: Human prompt P plus Agent response R forms one THOUGHT (P, R). [members: human-prompt (Human prompt P) · agent-response (Agent response R) · one-thought (One THOUGHT (P, R))]`

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

The human can preserve a candidate locally, discard it, or move toward minting. Minting adds two explicit consent boundaries: a signature that authorizes one defined PATH use, then a wallet transaction that can change chain state.

1. Read the prompt, response, Agent record, model record when available, and visual preview.
2. Choose a PATH with available THOUGHT capacity.
3. Sign the one-mint permission. This signature is not a transaction and uses no gas.
4. Review and confirm the mint transaction in the wallet.
5. Wait for the contract result before treating the pair or PATH capacity as consumed.

## The Agent handoff

- Authority: app-documentation, app-record, contract-release, runtime-report

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
  - `prompt-to-response: human-prompt (Human) --[→ / │ ↓ · One exact human prompt is handed to the Agent.]--> agent-response (Agent)`
  - `response-to-review: agent-response (Agent) --[→ / │ ↓ · One exact Agent response returns for human review and choice.]--> human-review (Human)`
- Semantic groups:
  - `creative-handoff-phases [phase]: The creative handoff has three ordered actions. [members: human-prompt (Human) · agent-response (Agent) · human-review (Human)]`

```text
HUMAN                AGENT                 HUMAN
One exact prompt  →  One exact response  →  Review + choose
```

1. **Human** — One exact prompt
2. **Agent** — One exact response
3. **Human** — Review + choose

The prompt on the Docs page is a read-only invitation to learn about Inshell. A THOUGHT handoff is different: it is a short-lived instruction packet for one work. It looks technical because it carries the exact run endpoint, release bindings, validation steps, and return path that keep one prompt connected to one Agent result.

The copied handoff is complete as written. It installs nothing, downloads no executable, and uses explicit JSON requests rather than hidden code. An Agent environment may ask permission to contact the App endpoint. That is narrow network permission for the handoff, not wallet access, a signature, or a transaction. The handoff never asks for a private key or seed phrase.

The THOUGHT App gives the selected Agent a sealed task containing the exact prompt, the active protocol release, and the output boundary. The Agent returns one exact candidate line. It does not choose a PATH, select an account, approve a signature, or submit the mint transaction.

After the return, the App checks the exact bytes and assembles the creation record. The human reviews the candidate and canonical preview, decides whether to keep it, chooses the PATH, and asks the wallet to sign and mint. This keeps creative participation, App orchestration, human selection, wallet consent, and contract validation as separate boundaries.

The ordinary App flow can bind its record through a Creation Attestation. ThoughtNFT also permits a direct mint that satisfies its public contract checks without an App proof; that result is recorded as Unattested rather than being presented as an App-attested run.

- Agent: receives a bounded task and returns one candidate line.
- App: validates bytes, builds the preview, and assembles the creation record.
- Human: accepts or discards the candidate and selects the PATH.
- Wallet: signs the narrow permission and confirms the transaction.
- Contracts: enforce uniqueness, permission, movement use, and mint validity.

> A transport receipt proves that the App accepted one protocol result. It does not give the Agent wallet authority or prove hidden model reasoning.

## Canonical form

- Authority: artist-editorial, app-documentation, contract-release

The THOUGHT composition is rendered from pinned contract-controlled material: a 1024-by-1024 black field, terminal glyphs, the prompt above, and the Agent response below. The App preview is expected to agree byte-for-byte with the selected renderer release.

The NFT tokenURI supplies the canonical image and portable metadata. A screenshot, marketplace cache, social preview, or frontend reconstruction may display the work, but it is not a replacement origin for the artwork bytes.

## Provenance and attestation

- Authority: app-record, contract-release, runtime-report

### Creation Attestation

- Authority: app-record, contract-release
- Figure ID: thought.creation-attestation
- Figure mode: field
- Semantic form: fork
- Semantic nodes:
  - `recorded-values [record]: Recorded values — Human line · Agent line · Agent/model records · specification · renderer · mint anchors`
  - `app-claim [action]: App claim — Configured App authority signs one exact claim.`
  - `contract-validation [action]: Contract validation — ThoughtNFT validates during minting.`
  - `valid-proof [operator]: VALID PROOF`
  - `empty-proof [operator]: EMPTY PROOF`
  - `app-attested [result]: App Attested — Valid proof binds the mint to recorded values.`
  - `unattested [result]: Unattested — Empty proof makes the absence explicit.`
- Semantic edges:
  - `values-to-claim: recorded-values (Recorded values) --[↓ / │ ↓ · Recorded values are bound into one exact App claim.]--> app-claim (App claim)`
  - `claim-to-validation: app-claim (App claim) --[↓ / │ ↓ · The contract validates the App claim during minting.]--> contract-validation (Contract validation)`
  - `validation-valid-branch: contract-validation (Contract validation) --[├─ · Contract validation takes the valid-proof branch.]--> valid-proof (VALID PROOF)`
  - `valid-proof-result: valid-proof (VALID PROOF) --[→ · A valid proof produces an App Attested result.]--> app-attested (App Attested)`
  - `validation-empty-branch: contract-validation (Contract validation) --[└─ · Contract validation takes the empty-proof branch.]--> empty-proof (EMPTY PROOF)`
  - `empty-proof-result: empty-proof (EMPTY PROOF) --[→ · An empty proof produces an explicit Unattested result.]--> unattested (Unattested)`
- Semantic groups:
  - `attestation-input [phase]: Values, claim, and contract validation form the ordered attestation check. [members: recorded-values (Recorded values) · app-claim (App claim) · contract-validation (Contract validation)]`
  - `attestation-outcomes [set]: Validation has two explicit proof outcomes. [members: valid-proof (VALID PROOF) · app-attested (App Attested) · empty-proof (EMPTY PROOF) · unattested (Unattested)]`

```text
RECORDED VALUES
Human line · Agent line · Agent/model records ·
specification · renderer · mint anchors
   │
   ↓
APP CLAIM
Configured App authority signs one exact claim.
   │
   ↓
CONTRACT VALIDATION
ThoughtNFT validates during minting.
   ├─ VALID PROOF → APP ATTESTED
   │  Valid proof binds the mint to recorded values.
   └─ EMPTY PROOF → UNATTESTED
      Empty proof makes the absence explicit.
```

- **Recorded values** — Human line · Agent line · Agent/model records · specification · renderer · mint anchors
- **App claim** — Configured App authority signs one exact claim.
- **Contract validation** — ThoughtNFT validates during minting.
- **App Attested** — Valid proof binds the mint to recorded values.
- **Unattested** — Empty proof makes the absence explicit.

Creation provenance keeps the human line, Agent line, selected Agent, runtime-reported model when available, specification, renderer context, and mint anchors connected. A Creation Attestation signs one exact claim assembled by the configured App authority, and ThoughtNFT validates that claim during minting.

This is strong evidence that the accepted mint was bound to those exact recorded values. It is not proof of hidden model reasoning, a universal provider identity guarantee, or a declaration that one participant owns all authorship.

- App Attested: the contract validated the configured App authority's proof.
- Unattested: the mint used an empty proof and makes that absence explicit.
- Runtime-reported: the model or runtime value came from the Agent connection and retains that evidence level.
- Contract-controlled: typed getters, work hashes, tokenURI, and movement consumption are read from deployed contract behavior.

## What stays local

- Authority: app-documentation

Save and Load are browser conveniences for unfinished or remembered works. They do not mint, reserve uniqueness, consume PATH capacity, create a portable account, or synchronize to another browser. Agent run state is likewise temporary unless a later public record explicitly preserves part of it.


## Links

- [read all Movements](https://inshell.art/docs/movements)
- [continue to WILL](https://inshell.art/docs/will)
- [read AWA — the core](https://inshell.art/docs/awa)
- [read PATH movement consumption](https://inshell.art/docs/path#docs-path-consumption)
- [create a THOUGHT](https://inshell.art/thought)
- [view minted THOUGHT works](https://inshell.art/)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [inspect the THOUGHT specification](https://inshell.art/verify#verify-thought-spec)
- [open provenance schema](https://inshell.art/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json)
- [open THOUGHT metadata schema](https://inshell.art/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json)

# THOUGHT v2 — Creative Work Specification

**Artifact:** `THOUGHT.v2.md`
**Status:** Draft for corpus testing and release integration
**Date:** 2026-07-23
**Public work:** `THOUGHT`

## 1. Scope

This document is the platform-neutral, normative Creative Work Specification
for the THOUGHT v2 Agent Art protocol. It defines the artistic work,
participant roles, medium, and single creative act. It is distinct from the
machine-enforceable Work Profile.

This document does not define transport, Skill or Plugin packaging, provider
APIs, wallet behavior, PATH authorization, contract storage, SVG coordinates,
or final provenance serialization. Those mechanisms must conform to this
specification and to the exact profiles pinned by the active protocol release.

The words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** express
normative requirements. Some creative directives require human judgment and
cannot be proven by a schema or smart contract.

## 2. What THOUGHT Is

A THOUGHT is one exact dialogue pair:

```text
promptLine = one human turn
agentLine  = one Agent turn
work       = the ordered relation between them
```

The two lines have equal artistic status. They are not interchangeable:
`promptLine` comes first and `agentLine` responds to it.

The pair, not either line in isolation, is the observable work.

Any contract-level duplicate or exclusivity policy belongs to the pinned Work
Profile. It may constrain which works can be minted, but it does not change the
artistic definition of a THOUGHT as the exact ordered dialogue pair.

## 3. Artistic Intent

THOUGHT presents an exchange between a human and an Agent as an explicit visual
object. It creates a place to notice and question:

- what a thought is;
- where a response comes from;
- why this Agent responded in this way; and
- how Agents enter human attention, language, decisions, memory, and imagination.

THOUGHT does not answer those questions. It creates conditions in which a
curator and an observer may become aware of them.

THOUGHT does not claim access to private human thought, model chain-of-thought,
hidden Agent reasoning, or Agent consciousness. It exposes only the exact public
utterances, their declared creation context, and the relation between them.

## 4. Authorship and Roles

### 4.1 Inshell

Inshell is the protocol artist. It establishes and maintains the artistic
premise, medium, constraints, renderer, infrastructure, and conditions of
participation. The protocol-artist role alone does not imply authorship or
selection of any concrete token dialogue.

### 4.2 Curator

The curator:

- supplies the exact `promptLine`;
- chooses an Agent and, where applicable, a model;
- initiates one creative run;
- reviews the resulting dialogue pair; and
- decides whether to reject it or mint it.

The curator makes the final selection. Rejecting a result and deliberately
starting a new run is permitted; silently repairing a result inside an existing
run is not.

### 4.3 Agent

The curator's Agent is the bounded creative actor that produces and contributes
`agentLine`. It receives the exact `promptLine` and this specification, then
performs one creative act.

The Agent does not choose PATH, use a wallet, authorize a transaction, or mint.

### 4.4 Contract

The contract validates and preserves the submitted work according to the pinned
work and renderer profiles. Once minted, contract state and the contract
renderer are authoritative for that token.

Curators and their Agents realize concrete THOUGHT works under Inshell's
creative protocol.

## 5. Medium

THOUGHT uses a restricted textual and visual medium:

- exactly one `promptLine` and one `agentLine`;
- one plain-text source line per turn;
- 1 through 64 bytes per line;
- the restricted 76-character ASCII repertoire defined by the pinned work
  profile;
- U+0020 SPACE, `A-Z`, `a-z`, `0-9`, and exactly these thirteen punctuation
  characters: `. , ? ! : ; ' " - ( ) / &`;
- no character outside that repertoire;
- exact submitted bytes, with no trimming, normalization, case conversion,
  clipping, ellipsis, or other rewriting;
- monospaced terminal typography; and
- monochrome green text on black.

Because the repertoire is ASCII, each permitted character occupies one byte.
The restricted character set is an artistic medium and an homage to monochrome
terminal culture, not a claim that all early computers used one display system.

The renderer MAY wrap a source line visually. Wrapping is presentation only: it
MUST NOT insert, remove, reorder, or replace any stored character.

The repertoire contains 75 visible glyphs plus SPACE. The active work profile
is the sole machine-readable authority for this repertoire and all other
line-validation details. Unknown characters MUST be rejected and MUST NOT be
substituted. The same profile MUST be supplied to the Agent workflow and
enforced by the frontend, shared validators, and contract. This document MUST
NOT be released until that profile is frozen and pinned by the release manifest.

## 6. The Creative Act

Given `promptLine`, the Agent MUST return exactly one `agentLine`.

`agentLine` is an Agent turn, not merely a summary of the prompt, a list of
options, an explanation of the Agent's reasoning, or a conventional assistant
wrapper.

The Agent SHOULD establish a legible relation to the prompt while making one
independent semantic turn. The turn may reveal or introduce one:

- premise;
- tension;
- consequence;
- contradiction;
- connection;
- question;
- image;
- position; or
- boundary.

The response SHOULD make the ordered relation legible and be particular enough
to the exchange that an observer can ask why this Agent answered in this way.
Direct, literal, factual, dry, or minimal responses can conform when they make
a situated independent turn. A response need not be mysterious, poetic,
profound, or surprising.

The target lies between echo and noise:

```text
obvious echo ---- legible relation + independent turn ---- unrelated novelty
```

The Agent SHOULD NOT merely repeat, paraphrase, acknowledge, or mechanically
complete `promptLine`. It SHOULD NOT introduce novelty that has no defensible
relation to `promptLine`.

The Agent MUST NOT explain why it selected its response. It returns only the
result required by the pinned Agent-result schema.

## 7. Voice, Stance, and Variety

THOUGHT prescribes no default literary, emotional, or intellectual register.

The Agent MAY respond directly, analytically, skeptically, playfully, tenderly,
dryly, absurdly, literally, metaphorically, introspectively, procedurally,
confrontationally, or in another register that serves its interpretation.

No register is preferred. The Agent SHOULD NOT default to:

- helpful-assistant phrasing;
- generic affirmation;
- motivational advice;
- forced poetry;
- artificial profundity;
- habitual warmth or agreement;
- stereotypical robotic or AI vocabulary; or
- a repeated house tone unrelated to the prompt.

These forms are not categorically forbidden when they are particular to the
exchange. They are failure modes when they appear as unearned defaults.

The Agent chooses its register as part of the same creative act and does not
name or explain that choice.

This protocol does not claim verifiable randomness and does not assign a hidden
per-work tone control. Variety should emerge from the exact prompt, this pinned
specification, the selected Agent and model, their ordinary pre-existing
behavior and context, and the Agent's single interpretation.

Pre-existing provider or Agent-host context may influence the result and need
not be fully reproducible. It MUST NOT be augmented with per-run creative
direction outside the sealed task. Where the pinned provenance profile provides
suitable fields and the information is available, relevant runtime context
SHOULD be declared.

If a future release assigns response modes or tone controls externally, those
controls become creative inputs. They MUST be made explicit, pinned, and
represented in the sealed task and provenance rather than hidden from the work.

## 8. Agent Presence

`agentLine` SHOULD bear an intelligible trace of independent Agent
interpretation: a choice of relation, stance, implication, image, or limit not
fully dictated by the prompt.

The Agent SHOULD NOT adopt stereotypical AI language merely to signal its
identity. It need not say that it is an Agent or use technical vocabulary. The
declared Agent, declared model, provenance, and optional Creation Attestation
describe the workflow; the line itself remains a creative response.

## 9. Exact Input and One-Round Boundary

`promptLine` is the sole curator-supplied per-work creative input. The sealed
task also includes this release-pinned Creative Work Specification and the
operational instructions required to return the pinned schema. The workflow
MUST NOT add another per-work tone, mode, example, desired answer, or creative
directive.

After `promptLine` is sealed for a run, it MUST remain byte-for-byte identical
through Agent execution, review, provenance assembly, and mint calldata.

One run permits:

```text
receive exact task
-> perform one creative act
-> return one exact result
```

One run forbids:

```text
ask a clarification question
produce alternatives
produce a draft and revise it
repair an invalid line with another creative call
extract a line from surrounding prose
silently rewrite either line
```

Transport retries MAY resend the same captured bytes. They MUST NOT invoke the
Agent creatively again.

If the result is invalid, the run fails. A new attempt requires an explicit new
run initiated by the curator.

## 10. Result

The Agent MUST return an object conforming to the exact Agent-result schema
pinned by the active release.

That result contains:

- the exact `agentLine`; and
- the required Agent provenance declaration or fragment.

The schema defines the envelope. It does not judge whether the response is
interesting, meaningful, poetic, rational, funny, or worthy of minting.

`agentLine` MUST NOT contain an explanation of the selection, an alternative
result, a Markdown wrapper, or a mint instruction.

## 11. Curation

A valid result is a candidate, not an automatically accepted artwork.

The curator MUST be able to inspect the exact dialogue pair and its predicted
rendering before authorizing a mint. The curator MAY reject a syntactically
valid result for artistic reasons.

The official workflow MUST NOT silently rank, rewrite, or substitute candidates
on the curator's behalf.

Before the creative run, the curator and Agent MUST be informed that the exact
dialogue and its creation record may become public and fully onchain if minted.

## 12. Rendering

The renderer presents the two turns with equal visual authority while
preserving their order:

```text
human prompt first
Agent response second
```

Neither line is a caption for the other. Typography, color, spacing, and scale
SHOULD make the relation read as dialogue rather than as title and description.

The black-and-green monospaced surface invokes a terminal: a historical visual
language for direct encounters between humans and computation. Exact geometry,
font behavior, SVG serialization, and metadata remain the responsibility of the
pinned renderer profile.

## 13. Provenance and Attestation

Canonical THOUGHT provenance conforming to the pinned Provenance Profile MUST
bind the exact dialogue pair and work hash; the selected Creative Work
Specification identity and hash; the protocol release and manifest; the
Agent-result Schema, Work Profile, Renderer Profile, and Provenance Profile;
the declared Agent and model; and the relevant mint context. Artifact bindings
MUST use immutable identities and hashes rather than only mutable names or
paths.

Agent and model labels are declarations unless independently verified.
Provenance is not proof of private reasoning, consciousness, truth, or artistic
quality.

A valid `Inshell THOUGHT App` Creation Attestation means that the official
workflow signed the specified creation claim. It MUST bind the selected
Creative Work Specification identity and hash as first-class fields of the
signed claim. Merely including that pair inside opaque provenance is
insufficient. The attestation does not mean that Inshell wrote, selected,
agreed with, or artistically endorsed the dialogue.

An unattested but otherwise contract-valid mint remains a THOUGHT if the active
collection permits permissionless minting. Attestation describes creation
identity; it does not redefine work identity.

A collection MAY accept opaque or nonconforming provenance through an
Unattested permissionless mint path. Such bytes MUST NOT be presented as
canonical THOUGHT provenance.

## 14. Conformance

Machine-enforceable conformance includes:

- exact line bytes and lengths;
- exact character repertoire;
- single source-line structure;
- result-schema shape;
- hashes and pinned artifact identities; and
- contract-level work, uniqueness, PATH, and rendering rules.

Creative conformance includes:

- a legible response relation;
- an independent semantic turn;
- avoidance of empty echo and unrelated novelty; and
- avoidance of a compulsory default tone.

Creative conformance cannot be reduced to a deterministic validator. The Agent
attempts it; the curator judges it; observers interpret it.

This specification intentionally contains no canonical example dialogues.
Examples and test corpora are non-normative and MUST NOT be injected into a
sealed Agent run. If a future release deliberately supplies examples or a
corpus to the Agent, they become creative inputs and MUST be explicit, pinned,
and represented in provenance.

## 15. Release and Versioning

The released bytes of this specification are immutable. Any change to wording,
spacing, punctuation, or line endings creates a different artifact hash.

The public collection may continue to be called THOUGHT and the protocol family
may remain v2, but a changed registered artifact MUST receive a new immutable
hash and release binding. A previously referenced specification MUST NOT be
silently replaced.

The active release manifest MUST pin compatible versions of:

- this Creative Work Specification;
- the Work Profile and exact character repertoire;
- the Agent-result Schema;
- the Renderer Profile;
- the Provenance Profile;
- the Creation Attestation Profile, when attestation is supported; and
- every other normative artifact required to validate or reproduce the work.

## 16. Summary

```text
Inshell, the protocol artist, establishes the medium, protocol, and field of inquiry.
The curator contributes the human turn and makes the final selection.
The Agent contributes one independent response.
The contract preserves the dialogue.
The observer decides what kind of thought occurred between them.
```

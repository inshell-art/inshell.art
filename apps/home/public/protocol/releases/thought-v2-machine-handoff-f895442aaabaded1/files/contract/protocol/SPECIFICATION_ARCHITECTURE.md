# THOUGHT V2 specification architecture

THOUGHT V2 has several specifications because they govern different things.
They are related, but they are not interchangeable.

## 1. THOUGHT Work Specification

`THOUGHT.v2.md` is the canonical Work Specification for the artwork and mintable
collection. It defines what one THOUGHT is: the ordered human/Agent exchange,
Terminal English, identity and uniqueness, PATH consumption, provenance and
attestation boundaries, metadata identity, and the canonical visual form.

The Work Specification is a THOUGHT release artifact. The THOUGHT App consumes
its exact pinned bytes; it does not independently author or rewrite them. The
Contract registry anchors the selected specification ID, hash, reference, and
exact bytes onchain, but the registry does not author the specification.

The current locked Work Specification already binds the renderer identity and
Inshell Mono 76 v1.0.0. Changing that visual identity requires a new Work
Specification artifact and release. It must not be made by editing the locked
V2 bytes or replacing a dependency behind an unchanged identity.

## 2. Agent Creative Brief

`THOUGHT.agent-creative.v2.md` is the one-creative-turn brief used by the
THOUGHT App after bounded control succeeds. It is a deliberately small
operational projection of the Work Specification: meaning, one-result behavior,
Terminal English constraints, exact-byte preservation, and the prompt boundary.

The Creative Brief does not replace the Work Specification. It omits Contract,
registry, PATH, provenance, attestation, metadata, hashing, and renderer
implementation details that the Agent does not need to compose one line.

The App sends the selected Work Specification and Agent Creative Brief as
distinct, independently hashed artifacts. Their identities and hashes must not
be treated as aliases.

## 3. Agent Run Protocol and handoff

`inshell.thought.agent-run.v2` governs the two-phase exchange between the App
and an Agent surface:

1. bounded control claims the run and proves runtime readiness without creative
   input;
2. one creative turn receives canonical App-issued input and returns one
   candidate;
3. the App verifies and binds the accepted result.

The visible text placed in an Agent chat is an editable bootstrap. It locates
and claims a run, but it is not creative authority. A creator may edit that
text because the Agent UI is editable. Such edits must not change the canonical
prompt, Work Specification, Agent Creative Brief, release binding, output
contract, or accepted result.

Canonical authority begins with the App-issued claim and start responses. They
carry an explicit run-authority contract and the exact bound objects. The Agent
must use creative input and release identity only from the successful start
response. The App then validates the exact run, prompt, selected specification,
creative brief, output profile, release, result bytes, and hashes before
accepting the return.

Creation Attestation therefore means that the authorized THOUGHT App accepted
and bound the canonical run. It does **not** prove that the visible Agent-chat
handoff was untouched, that the chat transcript contained no additional human
text, or that no influence existed outside the App-issued creative input.
Manual or custom creation paths that cannot satisfy the official App boundary
remain `Unattested`.

## 4. Work, renderer, and Mono 76 profiles

The Work Specification fixes the essential visual identity. Supporting
artifacts make that identity executable without bloating the prose spec:

- `work/thought.work.v2.md` and its profile define line validation, work
  commitments, canonical composition, and renderer identity;
- `renderer/thought.renderer.v2.profile.json` defines exact artboard, fields,
  wrapping, alignment, colors, stroke behavior, and glyph-source identity;
- the sealed Mono 76 package supplies the actual ordered path bytes, mapping,
  metrics, hashes, provenance, and distribution notices.

This layering is intentional. Mono 76 belongs to the Work Specification as a
normative dependency because changing it changes the artwork. Its large path
payload and mechanical details remain in the renderer and font artifacts,
which the release manifest pins immutably.

## 5. App and Contract responsibilities

The THOUGHT App selects pinned release artifacts, runs bounded control, supplies
the canonical creative request, builds and verifies provenance, and submits
mint calldata and optional Creation Attestation proof.

The Contracts enforce the boundaries they can verify deterministically: exact
line rules, ordered-pair uniqueness, selected-spec registration, release and
attestation bindings, PATH consumption, typed state, provenance hashing, and
canonical metadata/rendering. Solidity does not parse provenance JSON or infer
what happened in an editable Agent chat.

## Change matrix

| Change | Required new artifact |
| --- | --- |
| Meaning, accepted language, identity, mint semantics, or essential visual form | Work Specification and protocol release |
| One-turn Agent wording that preserves the same Work Specification | Agent Creative Brief revision and compatible App release |
| Control/transport or App-Agent exchange rules | Agent Run Protocol / handoff revision |
| Geometry, wrapping, stroke, alignment, or renderer mechanics | Renderer profile and compatible Work Specification/release |
| Glyph paths, mapping, metrics, or font identity | Mono 76 package and compatible renderer/Work Specification/release |

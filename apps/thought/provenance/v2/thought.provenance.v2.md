# THOUGHT Provenance V2

Identifier: `inshell.thought.provenance.v2`

Immutable schema release:
`thought-provenance-v2-20260731-r1`

## Purpose

THOUGHT provenance is the portable pre-mint record for how one prompt and one
Agent response became a THOUGHT work. It records the work, the process facts
available to the producer, the selected protocol release, and the intended
mint context.

It does not claim that an Agent provider or model provider independently
authenticated a label. Process `source` values describe how a record was
obtained. Creation Attestation separately identifies the producer that bound
the exact provenance bytes to the mint.

## Authority and opaque-byte boundary

Solidity stores and hashes provenance as opaque bounded bytes. It does not
parse this JSON. Typed contract state remains authoritative for the exact
prompt, Agent response, neutral Agent record, neutral Model record, selected
specification, PATH result, minter, and minted facts.

Positive records use RFC 8785 JCS serialized as exact UTF-8 without a BOM,
outer whitespace, or final newline. `provenanceHash` is Keccak-256 of those
exact bytes. The maximum record size is 20,000 bytes.

## Closed root

Every record contains exactly:

```text
mintContext
  chainId
  intendedMinter
  thoughtNft

process
  strict manual variant OR strict agent-run variant

protocol
  manifestKeccak256
  protocolReleaseId
  thoughtSpecHash
  thoughtSpecId

schema
  inshell.thought.provenance.v2

work
  agentLine
  agentLineKeccak256
  conversationIdentityHash
  promptLine
  promptLineKeccak256
  workHash
```

PATH authorization, PATH id/serial, token id, transaction, block, mint-success
claims, attestation signature/digest/status, marketplace traits, `external_url`,
fixture paths, and private execution material remain outside provenance.

## Agent-run process

An Agent-run record contains:

- `agent`: the Agent selected by the producer, with
  `source: producer-selected`;
- `model`: the exact model label reported by the Agent runtime, with
  `source: runtime-reported`;
- `run`: public-safe commitments to the run reference and submitted result
  envelope, plus optional adapter and route identifiers.

Agent and Model objects contain `label`, `source`, and an optional stable
machine-readable `identifier`. They are records, not declarations, and carry
no `declared-unverified` status.

## Manual process

A manual record contains `agent` and `model` with
`source: minter-supplied`, and has no `run`. The guided App uses `Human` and
`None` as the canonical labels. Manual provenance cannot receive an Inshell
THOUGHT App Agent-run Creation Attestation.

## Validation

- Agent and Model labels follow
  `inshell.thought.context.v2.visible-utf8-64`.
- Optional identifiers are 1–128 UTF-8 bytes and use the public identifier
  character profile.
- Prompt and Agent lines follow
  `inshell.thought.work.v2.terminal-english-64` exactly.
- Objects are closed; unknown fields are rejected.
- All line, conversation, work, run-reference, result-envelope, protocol,
  and specification commitments are recomputed before a record conforms.

The producer and verifier must share the same implementation and fixtures.
The Agent result envelope may retain its separate Agent protocol declaration;
that transport object is hashed as evidence but is not copied into the
provenance vocabulary.

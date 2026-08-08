# THOUGHT Provenance V2

Identifier: `inshell.thought.provenance.v2`

## Authority and opaque-byte boundary

Typed contract state is authoritative for the exact prompt, Agent response,
neutral Agent record, neutral Model record, hashes, selected specification, collection
release, PATH result, minter, and minted facts. Provenance is the canonical
pre-mint creation record checked against those facts. Solidity stores and
hashes the exact bounded bytes opaquely; it does not parse JSON.

Positive production records are RFC 8785 JCS serialized as exact UTF-8 without
BOM, outer whitespace, or a final newline. `provenanceHash` is Keccak-256 of
those exact bytes. The maximum is 20,000 bytes.

## Closed root

Every production record has exactly these root fields:

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
claims, creation-attestation signature/digest/status, marketplace traits,
fixture/corpus/source paths, and private execution material are outside
production provenance. This prevents circular attestation commitments and
keeps local harness data out of the canonical creation record.

The separate `inshell.thought.provenance.v2.study-candidate.v1` records used by
the local gallery may carry explicit unavailable/null status for inspection.
They are not positive production provenance and must never be minted.

## Declarations

Both process variants require exact `agentDeclaration` and `modelDeclaration`
objects with `label`, `source`, and `status: declared-unverified`.

Manual provenance uses `source: manual` for both declarations and forbids
`transport`. Agent-run provenance permits exactly `agent_declared`,
`connector_observed`, `runtime_configured`, or `unknown`, and requires
`transport.resultEnvelopeKeccak256` plus `transport.runIdHash`.

Declaration labels use `inshell.thought.context.v2.visible-utf8-64`, not the
Terminal English artwork profile. At the contract boundary, their labels map
to the neutral `agent` and `model` mint records and must equal
`ThoughtNFTV2.agentOf` and `modelOf`. Their exact UTF-8 hashes are bound into
an official creation-attestation claim as `agentHash` and `modelHash`.

The provenance wire schema deliberately retains its App-owned declaration
objects and statuses. Solidity does not parse or reinterpret those fields. A
valid Inshell THOUGHT App creation attestation proves that the authorized
signer bound the mapped exact labels to the other claim facts. The neutral
contract records do not affect conversation identity, work hash, or SVG.

## Builder and verifier requirements

The shared producer builder must validate all four exact public strings,
construct one closed object, recompute line/conversation/work commitments,
serialize once with JCS, enforce the byte cap, and hash the exact output. The
shared verifier must reject non-JCS bytes, schema drift, commitment drift,
release/spec mismatch, declaration mismatch, and attestation-claim mismatch.
Every positive fixture, mock-attested fixture, manual builder, disposable mint,
and production App path must use those shared components.

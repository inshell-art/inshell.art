# THOUGHT Provenance V2

Identifier: `inshell.thought.provenance.v2`

Provenance separates typed contract facts, run/transport facts, and declared process facts. Declarations are informative and are not cryptographic proof.

The pre-mint document records exact protocol/spec/work/renderer anchors, both visible lines and algorithm-labelled hashes, `agentIdentityHash`, `workHash`, the exact 128-byte `binaryFieldPacked`, its Keccak-256 hash, an optional Agent declaration, a manual or run transport record, and known pre-mint chain/contract/minter/PATH context.

Do not include unknown post-mint token ID, transaction, block, timestamp, successful status, or returned PATH serial. Those facts come from contract state and receipt/event data.

The contract stores and hashes exact submitted provenance JSON bytes. The reference builder recursively sorts object keys, emits compact UTF-8 JSON without a final newline, and rejects non-JSON values. Semantically equivalent non-canonical JSON does not share a provenance hash.

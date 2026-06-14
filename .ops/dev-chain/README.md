# DEV/OPS Chain Read-Model Contract

DEV and OPS share RPC, cache, and indexer infrastructure. Do not pass that state
through the operator by chat.

DEV publishes the current contract at:

- production home: `https://inshell.art/api/ops/status`
- production THOUGHT/gallery: `https://thought.inshell.art/api/ops/status`
- preview home, when Access allows OPS: `https://preview.inshell.art/api/ops/status`
- preview THOUGHT/gallery, when Access allows OPS: `https://thought.preview.inshell.art/api/ops/status`

The endpoint is intentionally safe to expose. It includes route names, logical
RPC role names, contract addresses, deploy blocks, binding presence, diagnostics
header names, and ownership boundaries. It must not include raw RPC URLs,
tokens, keys, or other secret values.

OPS should use this endpoint with route diagnostics such as
`x-chain-cache-source`, `x-live-rpc-calls`, and `x-cache-snapshot-block` to
separate DEV code/config issues from OPS resource/provider issues.

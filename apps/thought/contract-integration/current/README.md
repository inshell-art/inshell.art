# Current THOUGHT V2 Contract integration

This directory is an App-owned, non-production vendor projection of the
immutable Contract integration preview
`thought-v2-noncanonical-integration-preview-20260723-r3`. It is generated
from the vendored preview release by:

```sh
node scripts/sync-thought-v2-app-contract-baseline.mjs
```

The committed integration lock pins the exact artifact ID, source tag, source
commit, manifest SHA-256, ABI, bytecode, boundary, schema, and reference
hashes. `pnpm run check:thought-app-contract` fails if this projection drifts.
It intentionally contains no generated Anvil addresses, private keys, or
production signer policy.

Runtime addresses come from the external generated descriptor
`THOUGHT/public/thought-v2-gallery.anvil.json` while the Vite development
server is running. That descriptor is local state, not a consumer release, and
must pass the vendored profile, selected-spec, and renderer-implementation
checks before minting is enabled.

# THOUGHT production activation boundary

`deployment-lock.json` is the only committed activation input for the
production THOUGHT App. The default lock is deliberately disabled and contains
no addresses. A portable Contract package, environment variable, preview
deployment, or browser value cannot enable production minting.

Activation requires one reviewed lock update that binds all of the following:

- canonical r2 artifact ID and manifest SHA-256;
- target chain and exact PATH, THOUGHT, renderer, registry, and verifier
  addresses;
- the exact THOUGHT deployment block used to initialize the release-bound
  gallery read model;
- protocol release ID and manifest Keccak-256 read from the deployed THOUGHT;
- verifier authority public address and authority epoch;
- separate deployment, frontend, and signer approvals.

The App must then verify the lock against deployed bytecode and immutable
Contract getters before offering mint. The browser must never receive an
attestation private key or construct an official signature.

The same lock is also the only activation input for the canonical gallery.
While it is disabled, gallery APIs and persistent-chain gallery/detail
surfaces fail closed and must not fall back to an older THOUGHT deployment.
Gallery caches are namespaced by chain ID, THOUGHT address, artifact ID, and
manifest SHA-256 so a later deployment cannot inherit an earlier corpus.

## Signer boundary still requiring explicit approval

The production attestation endpoint is fail-closed until its backend signer
integration is separately reviewed and authorized. That integration must:

1. authenticate a browser-scoped credential for one returned Agent run;
2. read the authoritative prompt, Agent result, model evidence, and exact
   result envelope from the backend run store;
3. build and verify canonical provenance server-side;
4. verify chain ID, deployed bytecode, THOUGHT immutable dependencies,
   protocol release, verifier authority, authority epoch, and pause state;
5. send only the exact EIP-712 claim digest through a backend service binding;
6. recover the configured authority and call the verifier Contract before
   returning the mint package;
7. keep all keys and signer credentials outside browser code, repository
   files, public environment variables, logs, and response bodies.

Until that implementation and its threat review are approved,
`POST /api/thought-contract/v2/attestation` always returns 503.

# Legacy Migration Archive

This repo is now the Ethereum-only frontend monorepo for:

- `apps/home` -> `inshell.art`
- `apps/thought` -> `thought.inshell.art`

Archived legacy assumptions:

- Starknet-era frontend assumptions are deprecated and must not be reintroduced.
- PATH spark/reserved mint assumptions are deprecated and rejected by artifact validation.
- Local/devnet addresses are for development only; production builds must use imported FE release artifacts.

Active source of truth:

- PATH/Pulse/THOUGHT contracts live in their protocol repos.
- FE release artifacts are imported into `packages/contracts/src`.
- Cloudflare Pages deploys prebuilt `dist/home` and `dist/thought` from this repo.

Do not revive archived behavior without a new protocol spec and matching FE release bundle.

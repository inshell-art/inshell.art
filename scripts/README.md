# scripts/

Task scripts for syncing **addresses**, writing **env**, and validating imported PATH artifacts.

## Scripts overview

| Script | Purpose |
| --- | --- |
| `sync-addresses.ts` | Normalize and write `packages/contracts/src/addresses/addresses.<net>.json` from a file or URL. |
| `sync-env.ts` | Generate `.env.<net>.local` for apps from RPC + addresses (supports deploy block). |
| `validate-path-artifacts.ts` | Reject stale PATH ABI/release JSON that still exposes deprecated spark/reserved mint surface. |
| `abi-json-to-ts.ts` | Convert ABI JSON into a typed TS export for runtime/typing. |
| `loadEnv.ts` | Load the best matching `.env.*` file for scripts/builds. |
| `utils.ts` | Shared helpers for CLI flags, fetch/JSON, and address normalization. |
| `kill_all_descendants.sh` | Kill a process tree by PID (cleanup for stuck dev servers). |

## What lives here

- `utils.ts` — shared CLI + I/O helpers (flags, fetch, JSON, address normalization).
- `sync-addresses.ts` — writes `packages/contracts/src/addresses/addresses.<net>.json` from a local file or URL.
- `sync-env.ts` — writes `apps/home/.env.<net>.local` and `apps/thought/.env.<net>.local` from RPC + addresses.
- `validate-path-artifacts.ts` — scans imported PATH JSON artifacts for deleted spark/reserved surface before syncing.

## PATH artifact policy

- `inshell.art` does not currently have a `sync-abi.ts` pipeline.
- Treat imported PATH ABI/release bundles as untrusted until validated.
- After `path/` spark-drop commit `070ee8342833a4249027146d3ed61cf555e4762f`, reject any imported artifact containing:
  - `RESERVED_ROLE`
  - `SPARK_BASE`
  - `mintSparker`
  - `getReservedCap`
  - `getReservedRemaining`
  - `reserved_cap`
- Canonical `PathMinter` surface is now:
  - `nextId`
  - `freezeSalesCaller`
  - `mintPublic`

## Requirements

- Node 18+ (for `fetch`)
- pnpm
- TypeScript / tsx: `pnpm add -D typescript tsx @types/node`

## Config precedence

**CLI flags > environment variables > `.env*` files > sane defaults**  
Use flags for one-offs; use env for secrets / CI.

## Address files policy

- **Commit:** `packages/contracts/src/addresses/addresses.sepolia.json`, `packages/contracts/src/addresses/addresses.mainnet.json` (public, stable).
- **Ignore:** `packages/contracts/src/addresses/addresses.devnet.json` (ephemeral).

Example `.gitignore`:

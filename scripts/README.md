# scripts/

Task scripts for syncing **addresses**, **ABIs**, and **env** across Devnet / Sepolia / Mainnet.

## Scripts overview

| Script | Purpose |
| --- | --- |
| `sync-addresses.ts` | Normalize and write `packages/contracts/src/addresses/addresses.<net>.json` from a file or URL. |
| `sync-abi.ts` | Fetch on-chain ABIs by address and write per-network ABI files plus class-hash cache. |
| `sync-env.ts` | Generate `.env.<net>.local` for apps from RPC + addresses (supports deploy block). |
| `abi-json-to-ts.ts` | Convert ABI JSON into a typed TS export for runtime/typing. |
| `loadEnv.ts` | Load the best matching `.env.*` file for scripts/builds. |
| `utils.ts` | Shared helpers for CLI flags, fetch/JSON, and address normalization. |
| `kill_all_descendants.sh` | Kill a process tree by PID (cleanup for stuck dev servers). |

## What lives here

- `utils.ts` — shared CLI + I/O helpers (flags, fetch, JSON, address normalization).
- `sync-addresses.ts` — writes `packages/contracts/src/addresses/addresses.<net>.json` from a local file or URL.
- `sync-env.ts` — writes `apps/home/.env.<net>.local` and `apps/thought/.env.<net>.local` from RPC + addresses.
- `sync-abi.ts` — pulls on-chain ABIs by address via RPC and writes:
  - `packages/contracts/src/abi/<net>/<NAME>.json` (per-network fallback)
  - `packages/contracts/src/abi/by-class/<CLASS_HASH>.abi.json` (canonical, deduped)
  - `packages/contracts/src/abi/<net>/manifest.json`

## Requirements

- Node 18+ (for `fetch`)
- pnpm
- TypeScript / tsx: `pnpm add -D typescript tsx @types/node`
- starknet.js: `pnpm add starknet`

## Config precedence

**CLI flags > environment variables > `.env*` files > sane defaults**  
Use flags for one-offs; use env for secrets / CI.

## Address files policy

- **Commit:** `packages/contracts/src/addresses/addresses.sepolia.json`, `packages/contracts/src/addresses/addresses.mainnet.json` (public, stable).
- **Ignore:** `packages/contracts/src/addresses/addresses.devnet.json` (ephemeral).

Example `.gitignore`:

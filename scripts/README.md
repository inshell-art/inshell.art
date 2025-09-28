# scripts/

Task scripts for syncing **addresses**, **ABIs**, and **env** across Devnet / Sepolia / Mainnet.

## What lives here

- `utils.ts` — shared CLI + I/O helpers (flags, fetch, JSON, address normalization).
- `sync-addresses.ts` — writes `addresses/addresses.<net>.json` from a local file or URL.
- `sync-env.ts` — writes `.env.<net>.local` for Vite/FE from RPC + addresses.
- `sync-abi.ts` — pulls on-chain ABIs by address via RPC and writes:
  - `src/abi/<net>/<NAME>.json` (per-network fallback)
  - `src/abi/by-class/<CLASS_HASH>.abi.json` (canonical, deduped)
  - `src/abi/<net>/manifest.json`

## Requirements

- Node 18+ (for `fetch`)
- pnpm
- TypeScript / tsx: `pnpm add -D typescript tsx @types/node`
- starknet.js: `pnpm add starknet`

## Config precedence

**CLI flags > environment variables > `.env*` files > sane defaults**  
Use flags for one-offs; use env for secrets / CI.

## Address files policy

- **Commit:** `addresses/addresses.sepolia.json`, `addresses/addresses.mainnet.json` (public, stable).
- **Ignore:** `addresses/addresses.devnet.json` (ephemeral).

Example `.gitignore`:

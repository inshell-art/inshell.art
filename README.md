# inshell.art – Dev Runbook

A minimal runbook to bring up **devnet + protocol + FE** in the right order, with ABI-typed contracts and a resilient config pipeline.

---

## 0) Prereqs

- **Node 18+** and **pnpm** (`corepack enable`)
- **starknet-devnet** (Rust) in `$PATH`
- **`../path` cloned next to this repo.** All devnet/protocol scripts run there; this repo consumes their outputs.

> Optional (recommended):
>
> - `direnv` for auto-loading `.env.*`
> - `jq` for script utilities

> **Protocol + devnet**  
> Kick off devnet and deploy contracts via `path/README.md` from inside `../path`,
> then return here to sync the FE.

---

## 1) Sync into FE (this repo)

From the `inshell.art` repo:

````bash
# Copy addresses into FE
pnpm tsx scripts/sync-addresses.ts --net devnet --from ../path/output/addresses.devnet.json
# -> writes addresses/addresses.devnet.json

# Write Vite env (convenience; JSON fallback exists)
pnpm tsx scripts/sync-env.ts --net devnet --rpc http://127.0.0.1:5050/rpc --addr addresses/addresses.devnet.json
# -> writes .env.devnet.local with VITE_* entries

# Pull ABIs from the node (runtime artifacts)
pnpm tsx scripts/sync-abi.ts --net devnet --rpc http://127.0.0.1:5050/rpc --addr addresses/addresses.devnet.json
# -> writes src/abi/devnet/*.json

## Generate TypeScript const-typed ABIs (from runtime JSON)

We convert JSON ABIs (in `src/abi/<net>/*.json`) into TS const-literals (`src/abi/typed/*.abi.ts`)
so `TypedContractV2<typeof ABI>` gets exact types.

### One-off (per contract)
```bash
pnpm tsx scripts/abi-json-to-ts.ts src/abi/devnet/PulseAuction.json      src/abi/typed/PulseAuction.abi.ts      AUCTION_ABI
pnpm tsx scripts/abi-json-to-ts.ts src/abi/devnet/PathMinter.json        src/abi/typed/PathMinter.abi.ts        MINTER_ABI
pnpm tsx scripts/abi-json-to-ts.ts src/abi/devnet/PathMinterAdapter.json src/abi/typed/PathMinterAdapter.abi.ts ADAPTER_ABI
pnpm tsx scripts/abi-json-to-ts.ts src/abi/devnet/PathNFT.json           src/abi/typed/PathNFT.abi.ts           NFT_ABI

````

## 2) Run the FE

```bash
# Minimum FE env
export VITE_STARKNET_RPC="http://127.0.0.1:5050/rpc"
export VITE_NETWORK="devnet"                 # optional; default is devnet

pnpm dev
```

> **Address resolution policy (FE)**  
> The FE resolves contract addresses in this order:
>
> 1. **Explicit prop** passed to a factory/hook/component
> 2. `import.meta.env.**VITE_***` (e.g., `VITE_PULSE_AUCTION`)
> 3. `addresses/addresses.<net>.json` (e.g., key `pulse_auction`)
> 4. Throw a clear error
>
> Keep `addresses.*.json` keys in **snake_case**, Vite env overrides in **`VITE_*` UPPER_SNAKE**.

## 3) FE data flow (one screen)

```
protocol/
  contracts.ts        # provider + ABI source policy + typed factory helpers
  auction.ts          # createAuctionContract (TypedContractV2 from ABI literal)
services/
  auctionService.ts   # get_config/get_current_price/curve_active + u256 normalize + blockTag
hooks/
  useAuction.ts       # lifecycle + polling + error/loading state
components/
  AuctionRaw.tsx      # renders a raw snapshot (no chart libs)
```

- **ABI typing**: use `src/abi/typed/PulseAuction.abi.ts` (const literal) for TypeScript types.
- **Runtime ABI**: can still be fetched from node; a compatibility guard checks required entrypoints.

## 4) Example: render raw auction data

```tsx
// src/components/AuctionRaw.tsx
import React from "react";
import { useAuction } from "@/hooks/useAuction";

export default function AuctionRaw() {
  const { data, loading, error, refresh } = useAuction({ refreshMs: 4000 });
  if (loading) return <div>loading…</div>;
  if (error)
    return (
      <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
        {String(error)}
      </div>
    );
  if (!data) return <div>no data</div>;

  const { active, price, config } = data;
  return (
    <div>
      <div>
        <b>curve_active:</b> {String(active)}
      </div>
      <div>
        <b>current_price:</b> {price.asDec}
      </div>
      <div>
        <b>open_time:</b> {config.openTimeSec} (
        {new Date(config.openTimeSec * 1000).toISOString()})
      </div>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

Mount it in a page (e.g., `src/pages/dev/AuctionPage.tsx`) and run `pnpm dev`.

---

## 7) Block tag policy

- Default: `getDefaultBlockTag()` → **`latest`** (set by `VITE_STARKNET_BLOCK_TAG` or fallback).
- Service passes the tag to every view call (low-level `Contract.call(..., { blockIdentifier })`).
- Devnet usually rejects `"pending"`; use `"latest"` or `"pre_confirmed"`.

---

## 8) Troubleshooting

- **`Missing address in env: VITE_PULSE_AUCTION`**  
  The resolver didn’t find an explicit address or env var, and your `addresses.<net>.json` isn’t in place.  
  → Run `sync-addresses.ts` and/or set `VITE_NETWORK` and ensure the JSON exists.

- **`Invalid block ID. Expected ... ('pre_confirmed' | 'latest' | 'l1_accepted')`**  
  Your node rejects `"pending"`.  
  → `export VITE_STARKNET_BLOCK_TAG=latest` (and restart FE).

- **`Unexpected u256 shape`**  
  Different starknet.js decode paths.  
  → Use the tolerant `readU256` (accepts `{low,high}`, `[low,high]`, bigNumberish, or nested fields).

- **No data appears**  
  Make sure you seeded at least one bid or your `curve_active` is true; otherwise current price may render but bids/views may look “empty”.

---

## 9) Conventions

- **ABIs**

  - Raw runtime JSONs live in `src/abi/devnet/` (and friends).
  - Typed ABIs live in `src/abi/typed/` as `*.abi.ts` (`export const ... as const`).

- **Addresses**

  - Keep network JSONs under `addresses/addresses.<net>.json` with **snake_case** keys.
  - Vite overrides use **`VITE_*`** UPPER_SNAKE; the resolver bridges both.

- **Docs vs Source**
  - Command order, environment, and architecture live in **README/docs**.
  - API shapes and param/return docs live **inline** as TSDoc over services/hooks.

---

## 10) Appendix – common env

```bash
# Required for FE
export VITE_STARKNET_RPC="http://127.0.0.1:5050/rpc"

# Optional quality-of-life
export VITE_NETWORK="devnet"            # selects addresses/addresses.devnet.json
export VITE_STARKNET_BLOCK_TAG="latest" # service default for views
# export VITE_PULSE_AUCTION="0x..."     # override JSON via Vite env if needed
```

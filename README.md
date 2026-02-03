# inshell.art – FE Runbook

A minimal runbook to bring up **FE** with the right config, with ABI-typed contracts and a resilient pipeline.

---

## 0) Prereqs

- **Node 22+** and **pnpm** (`corepack enable`)
- A published **addresses JSON** for the target network (from protocol deploy outputs).

> Optional (recommended):
>
> - `direnv` for auto-loading `.env.*`
> - `jq` for script utilities

> **Protocol**  
> Deploy contracts in the protocol repo, then publish the network addresses JSON.

## 0.5) Cloudflare Pages build (production)

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:home`
- Output dir: `dist/home`
- Build-time env vars: `VITE_*` (e.g., `VITE_STARKNET_RPC`, `VITE_NETWORK`)
- Node version: 22 (set `NODE_VERSION=22` in Pages)

## 0.6) Local env (out of repo)

Keep local env values outside the repo and auto-load them with direnv:

```bash
mkdir -p ~/.config/inshell.art
cat > ~/.config/inshell.art/home.sepolia.env <<'EOF'
VITE_NETWORK=sepolia
VITE_STARKNET_RPC=https://your-sepolia-rpc
VITE_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/inshell_art
VITE_PULSE_AUCTION_DEPLOY_BLOCK=123456
EOF

ln -sf ~/.config/inshell.art/home.sepolia.env ~/.config/inshell.art/home.env
```

Manual (without direnv):

```bash
set -a
source ~/.config/inshell.art/home.env
set +a
```

---

## 1) Sync into FE (this repo)

From the `inshell.art` repo:

````bash
# Copy addresses into FE
pnpm tsx scripts/sync-addresses.ts --net sepolia --url https://example.com/addresses.sepolia.json
# -> writes packages/contracts/src/addresses/addresses.sepolia.json

# Write Vite env (convenience; JSON fallback exists)
pnpm tsx scripts/sync-env.ts --net sepolia --rpc https://your-sepolia-rpc --addr packages/contracts/src/addresses/addresses.sepolia.json --deploy-block 123456
# -> writes apps/home/.env.sepolia.local and apps/thought/.env.sepolia.local

# Pull ABIs from the node (runtime artifacts)
pnpm tsx scripts/sync-abi.ts --net sepolia --rpc https://your-sepolia-rpc --addr packages/contracts/src/addresses/addresses.sepolia.json
# -> writes packages/contracts/src/abi/sepolia/*.json

## Generate TypeScript const-typed ABIs (from runtime JSON)

We convert JSON ABIs (in `packages/contracts/src/abi/<net>/*.json`) into TS const-literals (`packages/contracts/src/abi/typed/*.abi.ts`)
so `TypedContractV2<typeof ABI>` gets exact types.

### One-off (per contract)
```bash
pnpm tsx scripts/abi-json-to-ts.ts packages/contracts/src/abi/sepolia/PulseAuction.json      packages/contracts/src/abi/typed/PulseAuction.abi.ts      AUCTION_ABI
pnpm tsx scripts/abi-json-to-ts.ts packages/contracts/src/abi/sepolia/PathMinter.json        packages/contracts/src/abi/typed/PathMinter.abi.ts        MINTER_ABI
pnpm tsx scripts/abi-json-to-ts.ts packages/contracts/src/abi/sepolia/PathMinterAdapter.json packages/contracts/src/abi/typed/PathMinterAdapter.abi.ts ADAPTER_ABI
pnpm tsx scripts/abi-json-to-ts.ts packages/contracts/src/abi/sepolia/PathNFT.json           packages/contracts/src/abi/typed/PathNFT.abi.ts           NFT_ABI

````

## 2) Run the FE

```bash
# Minimum FE env
export VITE_STARKNET_RPC="https://your-sepolia-rpc"
export VITE_NETWORK="sepolia"
export VITE_PULSE_AUCTION_DEPLOY_BLOCK="123456"

pnpm dev:home
pnpm dev:thought
```

> **Address resolution policy (FE)**  
> The FE resolves contract addresses in this order:
>
> 1. **Explicit prop** passed to a factory/hook/component
> 2. `import.meta.env.**VITE_***` (e.g., `VITE_PULSE_AUCTION`)
> 3. `packages/contracts/src/addresses/addresses.<net>.json` (e.g., key `pulse_auction`)
> 4. Throw a clear error
>
> Keep `addresses.*.json` keys in **snake_case**, Vite env overrides in **`VITE_*` UPPER_SNAKE**.

## 3) FE data flow (one screen)

```
packages/contracts/src/
  contracts.ts        # provider + ABI source policy + typed factory helpers
  auction.ts          # createAuctionContract (TypedContractV2 from ABI literal)
apps/home/src/services/auction/
  coreService.ts      # get_config/get_current_price/curve_active + u256 normalize + blockTag
apps/home/src/hooks/
  useAuctionCore.ts   # lifecycle + polling + error/loading state
apps/home/src/components/
  AuctionCanvas.tsx   # renders home views
```

- **ABI typing**: use `packages/contracts/src/abi/typed/PulseAuction.abi.ts` (const literal) for TypeScript types.
- **Runtime ABI**: can still be fetched from node; a compatibility guard checks required entrypoints.

### Curve rendering (half-lives)

- X-axis uses half-lives: `u = (t - last_bid_time) / t_half`.
- The FE draws a fixed window of half-lives (smallest multiple of 10 that covers “now”) to keep the curve smooth across parameter ranges.
- Tooltip timing converts back via `tau = u * t_half`, then uses `(now - last_bid_time) - tau` for "ago".

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
  If bids never show up on Sepolia, set `VITE_PULSE_AUCTION_DEPLOY_BLOCK` so the FE backfills from the deployment block.

---

## Local devnet (optional)

If you need a local devnet, keep it isolated from the production FE config:

```bash
cat > ~/.config/inshell.art/home.devnet.env <<'EOF'
VITE_NETWORK=devnet
VITE_STARKNET_RPC=http://127.0.0.1:5050/rpc
VITE_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/inshell_art
EOF

ln -sf ~/.config/inshell.art/home.devnet.env ~/.config/inshell.art/home.env
```

---

## 9) Conventions

- **ABIs**

  - Raw runtime JSONs live in `packages/contracts/src/abi/devnet/` (and friends).
  - Typed ABIs live in `packages/contracts/src/abi/typed/` as `*.abi.ts` (`export const ... as const`).

- **Addresses**

  - Keep network JSONs under `packages/contracts/src/addresses/addresses.<net>.json` with **snake_case** keys.
  - Vite overrides use **`VITE_*`** UPPER_SNAKE; the resolver bridges both.

- **Docs vs Source**
  - Command order, environment, and architecture live in **README/docs**.
  - API shapes and param/return docs live **inline** as TSDoc over services/hooks.

---

## 10) Appendix – common env

```bash
# Required for FE
export VITE_STARKNET_RPC="https://your-sepolia-rpc"
export VITE_PULSE_AUCTION_DEPLOY_BLOCK="123456"

# Optional quality-of-life
export VITE_NETWORK="sepolia"           # selects packages/contracts/src/addresses/addresses.sepolia.json
export VITE_STARKNET_BLOCK_TAG="latest" # service default for views
# export VITE_PULSE_AUCTION="0x..."     # override JSON via Vite env if needed
```

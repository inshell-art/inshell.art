# inshell.art – FE Runbook

A minimal runbook to bring up **FE** with the right config, with ABI-typed contracts and a resilient pipeline.

This dApp supports EIP-1193 injected wallets (with EIP-6963 multi-provider discovery) and WalletConnect v2.

Current migration status
- Product direction is **Ethereum-only**.
- Legacy/deprecated contract and FE assumptions are archived in `docs/archive/legacy-migration.md`.
- Active FE contract bindings are Ethereum-only and live under `packages/contracts/src`.

---

## 0.1) FE Architecture

`inshell.art` is the single frontend monorepo.

- `apps/home` builds the main site deployed at `inshell.art`.
- `apps/thought` builds the THOUGHT surface deployed at `thought.inshell.art`.
- `packages/*` holds shared frontend contract bindings, wallet code, Ethereum client utilities, and common helpers.
- Protocol contracts remain in separate repos (`pulse/`, `path/`, `THOUGHT/`) and export FE release artifacts into this repo.

Local dev ports are fixed:

- Home: `http://127.0.0.1:5173`
- THOUGHT: `http://127.0.0.1:5174`

Run Vite only with `127.0.0.1` and `--strictPort`; stop the existing process before reusing a port.

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

Cloudflare Pages targets:
- Home: `inshell.art` -> `apps/home` -> `dist/home`
- THOUGHT: `thought.inshell.art` -> `apps/thought` -> `dist/thought`
- Sepolia public-link bridge: `sepolia.inshell.art` -> Home Pages project, then `functions/_middleware.ts` redirects every path to the same path on `https://inshell.art`. Keep this temporary bridge while Sepolia is the active public rehearsal. Remove it after the Sepolia artifacts are migrated to a real `sepolia.inshell.art` archive so old public posts keep resolving there.

Recommended path: deploy prebuilt assets from GitHub Actions with Wrangler direct upload.
Cloudflare documents this as `wrangler pages deploy <DIRECTORY> --project-name=<PROJECT_NAME>`.

Local build commands:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build:home
pnpm run build:thought
```

Cloudflare Pages settings:
- Home build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:home`
- Home output dir: `dist/home`
- THOUGHT build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:thought`
- THOUGHT output dir: `dist/thought`
- Node version: 22

GitHub Actions deployment:
- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: manual `workflow_dispatch`
- Targets: `home`, `thought`, or `all`
- Production branch input: `main`

GitHub Secrets required:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

GitHub Variables required:
- `CLOUDFLARE_PAGES_PROJECT_HOME`
- `CLOUDFLARE_PAGES_PROJECT_THOUGHT`

GitHub Variables recommended:
- `VITE_NETWORK=sepolia`
- `VITE_ETH_RPC=/api/path-rpc`
- `VITE_THOUGHT_RPC_URL=/api/thought-rpc`
- `VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED=true`
- `VITE_THOUGHT_PREVIEW_ENDPOINT_URL=/api/thought-preview`
- `VITE_WALLET_CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`
- `VITE_WALLETCONNECT_PROJECT_ID=<public WalletConnect project id>`
- `VITE_PUBLIC_LAUNCH_MODE=sepolia_invite`
- `VITE_DEBUG_PANEL=off`
- `VITE_GITHUB_URL=https://github.com/inshell-art/`
- `VITE_REPORT_BUG_URL=https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md` (optional override; this is the default launch report URL)
- `VITE_THOUGHT_URL=https://thought.inshell.art/`
- `VITE_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/inshell_art`

RPC policy:
- Treat `VITE_ETH_RPC` as public. It is baked into the client bundle.
- Do not use a high-value unrestricted RPC key directly in `VITE_ETH_RPC`.
- Treat `/api/path-rpc`, `/api/thought-rpc`, `/api/eth-rpc`, and `VITE_THOUGHT_RPC_URL` as read-only dapp RPCs. Do not register them as wallet chain RPC URLs.
- Store `PATH_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>` and `THOUGHT_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>` as Cloudflare Pages secrets. Keep `ETH_RPC_UPSTREAM` only as the legacy fallback; `/api/eth-rpc` does not allow `eth_getLogs`.
- Configure `MSG_HUB_RPC_USAGE_ENDPOINT` and `MSG_HUB_RPC_USAGE_TOKEN` if the operator wants RPC CU estimate events and warning notices before provider limits are hit.
- Treat `/api/thought-preview` as the dedicated THOUGHT preview gate. It hides the raw Sepolia RPC upstream in Cloudflare, validates input before RPC, rate-limits, applies timeouts, coalesces in-flight previews, and caches repeated previews.
- Store `THOUGHT_PREVIEW_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>` as a Cloudflare Pages secret for the THOUGHT project. If omitted, `/api/thought-preview` falls back to `THOUGHT_RPC_UPSTREAM`, then `ETH_RPC_UPSTREAM`.
- Optional THOUGHT preview runtime vars: `THOUGHT_PREVIEW_NFT_ADDRESS=<ThoughtNFT address>`, `THOUGHT_PREVIEW_CHAIN_ID=11155111`.
- `VITE_WALLET_CHAIN_RPC_URL` must be a public Sepolia RPC that wallets can use for transaction broadcast.
- Launch recommendation: use Alchemy Sepolia with origin allowlists for `https://inshell.art` and `https://thought.inshell.art`.
- Better long-term setup: put an RPC proxy in a Cloudflare Worker, store the upstream RPC key as a Worker Secret, and point `VITE_ETH_RPC` at the Worker URL.
- If using Alchemy directly in the browser, enable domain allowlists; Alchemy documents domain allowlists as the control that limits which web origins can use an API key.

## 0.6) Local env (out of repo)

Keep local env values outside the repo and auto-load them with direnv:

```bash
mkdir -p ~/.config/inshell.art
cat > ~/.config/inshell.art/home.sepolia.env <<'EOF'
VITE_NETWORK=sepolia
VITE_ETH_RPC=https://your-sepolia-rpc
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
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

Operator Cloudflare/RPC/Etherscan secrets live outside the repo. Preferred path:

```bash
~/.inshell-secrets/inshell-sepolia.env
```

Keep this file private. The old local path `~/.inshell-secrets/cloudflare-sepolia.env`
may remain as a symlink for compatibility with older shell snippets, but new notes and
commands should use `inshell-sepolia.env` because it contains more than Cloudflare keys.

---

## 1) Sync into FE (this repo)

From the `inshell.art` repo:

````bash
# Preferred: import the complete PATH FE release bundle from path/
pnpm sync:path-release -- --net sepolia --from ../path/artifacts/sepolia/current/fe-release
# -> writes addresses, protocol-release, and ABI snapshots under packages/contracts/src/

# Legacy fallback: copy addresses only
pnpm tsx scripts/sync-addresses.ts --net sepolia --url https://example.com/addresses.sepolia.json
# -> writes packages/contracts/src/addresses/addresses.sepolia.json only

# Write Vite env (convenience; JSON fallback exists)
pnpm tsx scripts/sync-env.ts --net sepolia --rpc https://your-sepolia-rpc --addr packages/contracts/src/addresses/addresses.sepolia.json --deploy-block 123456
# -> writes apps/home/.env.sepolia.local and apps/thought/.env.sepolia.local

# Validate imported PATH release artifacts before using them here
pnpm tsx scripts/validate-path-artifacts.ts /path/to/fe-release
# -> rejects stale spark/reserved PATH ABI or manifest surface

## Optional ABI typing helper

`inshell.art` does not currently vendor a PATH ABI sync pipeline. If ABI snapshots are reintroduced,
generate them from current `path/` source-of-truth contracts or fresh non-stale release artifacts,
then use `scripts/abi-json-to-ts.ts` as a helper to emit const-typed TS ABI literals.

### One-off (per contract)
```bash
pnpm tsx scripts/abi-json-to-ts.ts /absolute/path/to/PulseAuction.json      packages/contracts/src/abi/typed/PulseAuction.abi.ts      AUCTION_ABI
pnpm tsx scripts/abi-json-to-ts.ts /absolute/path/to/PathPulseAdapter.json  packages/contracts/src/abi/typed/PathPulseAdapter.abi.ts  ADAPTER_ABI
pnpm tsx scripts/abi-json-to-ts.ts /absolute/path/to/PathNFT.json           packages/contracts/src/abi/typed/PathNFT.abi.ts           NFT_ABI

````

PATH note:
- after `path` removal commit `070ee8342833a4249027146d3ed61cf555e4762f`, do not import artifacts
  that still expose `RESERVED_ROLE`, `SPARK_BASE`, `mintSparker`, `getReservedCap`,
  `getReservedRemaining`, or `reserved_cap`
- current canonical PATH issuance surface is `PathPulseAdapter` settling `PulseAuction` epochs directly into `PathNFT`

## 2) Run the FE

```bash
# Minimum FE env
export VITE_ETH_RPC="https://your-sepolia-rpc"
export VITE_NETWORK="sepolia"
export VITE_PULSE_AUCTION_DEPLOY_BLOCK="123456"
export VITE_WALLETCONNECT_PROJECT_ID="your_walletconnect_project_id"
export VITE_PUBLIC_LAUNCH_MODE="sepolia_invite"
export VITE_REPORT_BUG_URL="https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md" # optional override
export VITE_GITHUB_URL="https://github.com/inshell-art/"
export VITE_DEBUG_PANEL="off"

pnpm dev:home
pnpm dev:thought
```

`VITE_ETH_RPC` is the RPC env var used by the frontend.

> **Address resolution policy (FE)**  
> The FE resolves contract addresses in this order:
>
> 1. **Explicit prop** passed to a factory/hook/component
> 2. `import.meta.env.**VITE_***` (e.g., `VITE_PULSE_AUCTION`)
> 3. `packages/contracts/src/addresses/addresses.<net>.json` (e.g., key `pulse_auction`)
> 4. `packages/contracts/src/releases/release.<net>.json` contract addresses
> 5. Throw a clear error
>
> Keep `addresses.*.json` keys in **snake_case**, Vite env overrides in **`VITE_*` UPPER_SNAKE**.
>
> Prefer `sync:path-release` over address-only sync. The protocol release also supplies chain id,
> deploy blocks, code hashes, and constructor config for runtime validation.
>
> Without a protocol release, the home canvas intentionally shows `No PATH deployment loaded`
> and does not call auction contracts. A direct auction address is only accepted when
> `VITE_PATH_ALLOW_DIRECT_AUCTION=1` or `?direct_auction=1` is set for local debugging.

## 1.5) Local PATH Rehearsal Flow

Run this after starting a clean PATH local node and deploying local contracts from `path/`:

```bash
# In path/
npm run ops:export:local-fe-release -- --rpc-url http://127.0.0.1:8546 --force

# In inshell.art/
pnpm sync:path-release -- --net devnet --from ../path/artifacts/devnet/current/fe-release
VITE_NETWORK=devnet \
VITE_ETH_RPC=http://127.0.0.1:8546 \
pnpm --filter @inshell/home exec vite --host 127.0.0.1 --strictPort
```

Expected canvas states:
- No release imported: `No PATH deployment loaded.`
- Release imported, before `openTime`: countdown from on-chain `getConfig()`.
- Release imported, after `openTime`, no bids: waiting for first bid/current ask.
- After first bid: concatenated curves.

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

- Default: `getDefaultBlockTag()` → **`latest`** (set by `VITE_ETH_BLOCK_TAG` or fallback).
- Service passes the tag to every view call (low-level `Contract.call(..., { blockIdentifier })`).
- Devnet usually rejects `"pending"`; use `"latest"` or `"pre_confirmed"`.

---

## 8) Troubleshooting

- **`Missing address in env: VITE_PULSE_AUCTION`**  
  The resolver didn’t find an explicit address or env var, and your `addresses.<net>.json` isn’t in place.  
  → Run `sync-addresses.ts` and/or set `VITE_NETWORK` and ensure the JSON exists.

- **`Invalid block ID. Expected ... ('pre_confirmed' | 'latest' | 'l1_accepted')`**  
  Your node rejects `"pending"`.  
  → `export VITE_ETH_BLOCK_TAG=latest` (and restart FE).

- **`Unexpected u256 shape`**
  Different SDK decode paths.
  → Use the tolerant `readU256` (accepts `{low,high}`, `[low,high]`, bigNumberish, or nested fields).

- **No data appears**  
  If bids never show up on Sepolia, set `VITE_PULSE_AUCTION_DEPLOY_BLOCK` so the FE backfills from the deployment block.

- **`No PulseAuction code at ...` or `No return data from get_config ...`**
  The selected RPC network does not have code at the imported auction address.
  → Check `VITE_ETH_RPC`, `VITE_NETWORK`, and import the latest PATH FE release with `pnpm sync:path-release`.

---

## Local devnet (optional)

If you need a local devnet, keep it isolated from the production FE config:

```bash
cat > ~/.config/inshell.art/home.devnet.env <<'EOF'
VITE_NETWORK=devnet
VITE_ETH_RPC=http://127.0.0.1:5050/rpc
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
export VITE_ETH_RPC="https://your-sepolia-rpc"
export VITE_PULSE_AUCTION_DEPLOY_BLOCK="123456"

# Optional quality-of-life
export VITE_NETWORK="sepolia"           # selects packages/contracts/src/addresses/addresses.sepolia.json
export VITE_ETH_BLOCK_TAG="latest" # service default for views
# export VITE_PULSE_AUCTION="0x..."     # override JSON via Vite env if needed
```

# Cloudflare Pages Launch

Last updated: 2026-07-15

## Decision

Use Cloudflare built-in Pages deployment as the normal production deploy path.

The canonical product is one origin. The home project serves `/`, `/path`, `/thought`, and `/gallery` from `inshell.art`; its `staging` branch serves the same paths from `preview.inshell.art`. `build:home` embeds the THOUGHT bundle at `dist/home/thought`.

Keep `.github/workflows/deploy-pages.yml` as a manual fallback. Do not enable a second automatic deploy path unless Cloudflare built-in deploys become insufficient.

## Account

- Cloudflare account id: `7fc68967a9445609a0788d8c94e45de0`
- Existing home Pages project: `inshell-art`
- Existing home Pages hostname: `inshell-art.pages.dev`

## Home Project

Cloudflare Pages project:

- project: `inshell-art`
- repo: `inshell-art/inshell.art`
- production branch: `main`
- build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:home`
- build output: `dist/home`
- root directory: `/`

Production environment variables:

```text
VITE_NETWORK=sepolia
VITE_PUBLIC_LAUNCH_MODE=sepolia_invite
VITE_ETH_RPC=/api/path-rpc
VITE_DEBUG_PANEL=off
VITE_GITHUB_URL=https://github.com/inshell-art/
VITE_THOUGHT_URL=/thought
VITE_GALLERY_URL=/gallery
VITE_THOUGHT_GALLERY_URL=/gallery
VITE_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/inshell_art
```

Optional production environment variables:

```text
VITE_REPORT_BUG_URL=<public issue/report URL>
VITE_WALLETCONNECT_PROJECT_ID=<public WalletConnect project id>
```

Production secret:

```text
PATH_PRIMARY_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for PATH/Pulse reads>
PRIVATE_FALLBACK_RPC_UPSTREAM=<private Sepolia RPC fallback endpoint>
PUBLIC_FALLBACK_RPC_UPSTREAM=<last-resort public Sepolia RPC endpoint>
MSG_HUB_RPC_USAGE_ENDPOINT=<optional private usage monitor ingest URL>
MSG_HUB_RPC_USAGE_TOKEN=<optional private usage monitor bearer token>
```

`PATH_PRIMARY_RPC_UPSTREAM` is consumed only by Cloudflare Pages Functions such as `/api/path-rpc`, `/api/path-tokens`, and `/api/pulse-auction`. Do not expose it as a `VITE_*` variable. Compatibility aliases are still read during migration: `PATH_RPC_UPSTREAM` for PATH primary, `ETH_RPC_UPSTREAM` for private fallback, and `RPC_UPSTREAM_FALLBACK` for public fallback. Target names win when both are set. `/api/eth-rpc` remains a legacy private fallback only and does not allow `eth_getLogs`.

Remove old Starknet variables from the Cloudflare dashboard:

```text
VITE_STARKNET_BLOCK...
VITE_STARKNET_RPC
```

## Standalone THOUGHT Compatibility Project

The separate THOUGHT Pages project may remain available for compatibility and direct bundle checks, but it is not the canonical product origin. Canonical navigation and links must use `inshell.art/thought` and `inshell.art/gallery`.

Recommended project:

- project: `thought-inshell-art`
- repo: `inshell-art/inshell.art`
- production branch: `main`
- build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:thought`
- build output: `dist/thought`
- root directory: `/`

Production environment variables:

```text
VITE_NETWORK=sepolia
VITE_ETH_RPC=/api/path-rpc
VITE_THOUGHT_RPC_URL=/api/thought-rpc
VITE_THOUGHT_PREVIEW_ENDPOINT_ENABLED=true
VITE_THOUGHT_PREVIEW_ENDPOINT_URL=/api/thought-preview
VITE_WALLET_CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
VITE_PATH_MINT_URL=https://inshell.art/path
VITE_THOUGHT_DETAIL_BASE_URL=https://inshell.art/thought
VITE_GALLERY_URL=https://inshell.art/gallery
VITE_THOUGHT_GALLERY_URL=https://inshell.art/gallery
```

`VITE_ETH_RPC` and `VITE_THOUGHT_RPC_URL` are read-only dapp RPCs. Wallet chain registration must use `VITE_WALLET_CHAIN_RPC_URL`, because wallets need an RPC that accepts transaction broadcast.

`/api/thought-preview` is the public THOUGHT preview gate. The frontend sends only candidate text to this endpoint; the raw Sepolia RPC upstream stays in Cloudflare and is never baked into client JavaScript. The endpoint validates candidate shape before RPC, checks Sepolia chain id, calls `ThoughtNFT.previewWork`, rate-limits by client, coalesces in-flight repeats, caches repeated previews, and times out upstream work.

Production secret:

```text
PATH_PRIMARY_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for PATH/Pulse reads>
THOUGHT_PRIMARY_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for THOUGHT reads>
THOUGHT_PREVIEW_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for public THOUGHT preview>
PRIVATE_FALLBACK_RPC_UPSTREAM=<private Sepolia RPC fallback endpoint>
PUBLIC_FALLBACK_RPC_UPSTREAM=<last-resort public Sepolia RPC endpoint>
MSG_HUB_RPC_USAGE_ENDPOINT=<optional private usage monitor ingest URL>
MSG_HUB_RPC_USAGE_TOKEN=<optional private usage monitor bearer token>
```

`THOUGHT_PREVIEW_RPC_UPSTREAM` can use a dedicated preview RPC key. If it is not set or fails, `/api/thought-preview` falls back to `THOUGHT_PRIMARY_RPC_UPSTREAM`, then `PRIVATE_FALLBACK_RPC_UPSTREAM`, then `PUBLIC_FALLBACK_RPC_UPSTREAM`. Compatibility aliases are still read during migration: `THOUGHT_RPC_UPSTREAM`, `ETH_RPC_UPSTREAM`, and `RPC_UPSTREAM_FALLBACK`. Target names win when both are set.

Optional THOUGHT preview runtime vars:

```text
THOUGHT_PREVIEW_NFT_ADDRESS=<ThoughtNFT address>
THOUGHT_PREVIEW_CHAIN_ID=11155111
```

## Custom Domains

Attach the canonical production domains to the home project:

```text
inshell.art
www.inshell.art
```

Attach the canonical preview domain to the home project's `staging` branch:

```text
preview.inshell.art -> staging.inshell-art.pages.dev
```

The canonical route map is:

```text
https://inshell.art/
https://inshell.art/path
https://inshell.art/thought
https://inshell.art/gallery

https://preview.inshell.art/
https://preview.inshell.art/path
https://preview.inshell.art/thought
https://preview.inshell.art/gallery
```

`preview.inshell.art` must show the latest successful home deployment from the `staging` branch before frontend changes are merged to `main`. Cloudflare supports branch aliases for preview deployments; the preview custom domain should point at `staging.inshell-art.pages.dev`. This setup requires a proxied Cloudflare DNS record because an external DNS provider or unproxied record can route a custom domain to the production branch instead of the preview branch.

Cloudflare Pages custom apex domains are simplest when the domain uses Cloudflare nameservers. If DNS remains at GoDaddy, `www.inshell.art` can use a CNAME record, but the apex `inshell.art` depends on GoDaddy support for apex CNAME/ALIAS/ANAME behavior.

Recommended DNS move:

1. Add `inshell.art` as a Cloudflare zone.
2. Update GoDaddy nameservers to Cloudflare nameservers.
3. Add Pages custom domains in Cloudflare.
4. Let Cloudflare create/proxy the DNS records.
5. Add `preview.inshell.art` to the `inshell-art` Pages project after a successful `staging` deployment.
6. In Cloudflare DNS, set the `preview` CNAME target to `staging.inshell-art.pages.dev` and keep it proxied.

If DNS stays at GoDaddy:

1. Add `www.inshell.art` to the `inshell-art` Pages project.
2. Add GoDaddy CNAME `www -> inshell-art.pages.dev`.
3. For apex `inshell.art`, either use GoDaddy forwarding to `www.inshell.art`, or use GoDaddy apex ALIAS/ANAME/CNAME flattening if available.

Do not use GoDaddy or an unproxied DNS record for `preview.inshell.art` if the intent is to pin it to the `staging` branch. Cloudflare's custom branch alias flow depends on proxied Cloudflare DNS.

## Staging Discipline

Use this frontend release path:

1. Develop and commit on a feature branch or directly on `staging` when the operator asks for a fast path.
2. Push or merge to `staging`.
3. Deploy Cloudflare Pages with `.github/workflows/deploy-pages.yml`, `branch=staging`, and the needed `target`.
4. Validate `https://preview.inshell.art`, `/path`, `/thought`, and `/gallery` on that origin.
5. Merge `staging` into `main`.
6. Deploy Cloudflare Pages with `branch=main` for production.

Do not deploy `main` before `preview.inshell.art` has been validated, unless the operator explicitly asks for an emergency hotfix. If a hotfix bypasses staging, merge `main` back into `staging` immediately after production is stable.

Staging builds must cross-link inside the shared preview origin:

```text
VITE_THOUGHT_URL=https://preview.inshell.art/thought
VITE_GALLERY_URL=https://preview.inshell.art/gallery
VITE_THOUGHT_GALLERY_URL=https://preview.inshell.art/gallery
VITE_PATH_MINT_URL=https://preview.inshell.art/path
VITE_THOUGHT_DETAIL_BASE_URL=https://preview.inshell.art/thought
```

Production builds must keep the same-origin public routes:

```text
VITE_THOUGHT_URL=https://inshell.art/thought
VITE_GALLERY_URL=https://inshell.art/gallery
VITE_THOUGHT_GALLERY_URL=https://inshell.art/gallery
VITE_PATH_MINT_URL=https://inshell.art/path
VITE_THOUGHT_DETAIL_BASE_URL=https://inshell.art/thought
```

## RPC Proxy

The repo contains a Cloudflare Pages Function:

```text
functions/api/eth-rpc.ts
functions/api/path-rpc.ts
functions/api/thought-rpc.ts
```

`/api/path-rpc` forwards constrained PATH/Pulse reads to `PATH_PRIMARY_RPC_UPSTREAM`, then private fallback, then public fallback.
`/api/thought-rpc` forwards constrained THOUGHT reads to `THOUGHT_PRIMARY_RPC_UPSTREAM`, then private fallback, then public fallback.
`/api/eth-rpc` is a legacy read fallback to `PRIVATE_FALLBACK_RPC_UPSTREAM`; it does not allow `eth_getLogs` and does not use the public fallback.

Allowed methods are read-oriented Ethereum JSON-RPC calls such as:

```text
eth_call
eth_chainId
eth_blockNumber
eth_getCode
eth_getLogs
eth_getTransactionReceipt
```

The functions do not allow arbitrary write/broadcast RPC methods. `eth_getLogs` is only accepted on the PATH and THOUGHT gates for known deployed contract addresses and known event topics, with range limits, chunking, cache, per-client rate limits, and optional msg-hub usage warnings.

## Manual Fallback Deploy

If Cloudflare built-in deploys fail, use the GitHub Actions workflow:

```text
.github/workflows/deploy-pages.yml
```

Required GitHub Actions variables:

```text
CLOUDFLARE_PAGES_PROJECT_HOME=inshell-art
CLOUDFLARE_PAGES_PROJECT_THOUGHT=thought-inshell-art
VITE_NETWORK=sepolia
VITE_PUBLIC_LAUNCH_MODE=sepolia_invite
VITE_ETH_RPC=/api/path-rpc
VITE_THOUGHT_RPC_URL=/api/thought-rpc
VITE_DEBUG_PANEL=off
VITE_THOUGHT_URL=https://inshell.art/thought
VITE_GALLERY_URL=https://inshell.art/gallery
VITE_THOUGHT_GALLERY_URL=https://inshell.art/gallery
```

Required GitHub Actions secrets:

```text
CLOUDFLARE_ACCOUNT_ID=7fc68967a9445609a0788d8c94e45de0
CLOUDFLARE_API_TOKEN=<Cloudflare Pages edit token>
```

The manual fallback deploy does not need private RPC URLs because the deployed Pages Functions read `PATH_PRIMARY_RPC_UPSTREAM`, `THOUGHT_PRIMARY_RPC_UPSTREAM`, `PRIVATE_FALLBACK_RPC_UPSTREAM`, and `PUBLIC_FALLBACK_RPC_UPSTREAM` from Cloudflare Pages project secrets. Legacy aliases remain supported during migration.

The workflow's `branch` input is restricted to `staging` or `main`. It checks out the same branch it deploys, so a preview deploy cannot accidentally build production code under a staging label.

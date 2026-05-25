# Cloudflare Pages Launch

Last updated: 2026-05-25

## Decision

Use Cloudflare built-in Pages deployment as the normal production deploy path.

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
VITE_THOUGHT_URL=https://thought.inshell.art/
VITE_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/inshell_art
```

Optional production environment variables:

```text
VITE_REPORT_BUG_URL=<public issue/report URL>
VITE_WALLETCONNECT_PROJECT_ID=<public WalletConnect project id>
```

Production secret:

```text
PATH_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for PATH reads>
ETH_RPC_UPSTREAM=<legacy private Sepolia RPC fallback endpoint>
MSG_HUB_RPC_USAGE_ENDPOINT=<optional private usage monitor ingest URL>
MSG_HUB_RPC_USAGE_TOKEN=<optional private usage monitor bearer token>
```

`PATH_RPC_UPSTREAM` is consumed only by the Cloudflare Pages Function at `/api/path-rpc`. Do not expose it as a `VITE_*` variable. `ETH_RPC_UPSTREAM` is a legacy fallback only; `/api/eth-rpc` does not allow `eth_getLogs`.

Remove old Starknet variables from the Cloudflare dashboard:

```text
VITE_STARKNET_BLOCK...
VITE_STARKNET_RPC
```

## THOUGHT Project

Create a second Cloudflare Pages project for `thought.inshell.art`.

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
```

`VITE_ETH_RPC` and `VITE_THOUGHT_RPC_URL` are read-only dapp RPCs. Wallet chain registration must use `VITE_WALLET_CHAIN_RPC_URL`, because wallets need an RPC that accepts transaction broadcast.

`/api/thought-preview` is the public THOUGHT preview gate. The frontend sends only candidate text to this endpoint; the raw Sepolia RPC upstream stays in Cloudflare and is never baked into client JavaScript. The endpoint validates candidate shape before RPC, checks Sepolia chain id, calls `ThoughtNFT.previewWork`, rate-limits by client, coalesces in-flight repeats, caches repeated previews, and times out upstream work.

Production secret:

```text
PATH_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for PATH reads>
THOUGHT_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint for THOUGHT reads and preview fallback>
ETH_RPC_UPSTREAM=<legacy private Sepolia RPC fallback endpoint>
THOUGHT_PREVIEW_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>
MSG_HUB_RPC_USAGE_ENDPOINT=<optional private usage monitor ingest URL>
MSG_HUB_RPC_USAGE_TOKEN=<optional private usage monitor bearer token>
```

`THOUGHT_PREVIEW_RPC_UPSTREAM` can use a dedicated preview RPC key. If it is not set, `/api/thought-preview` falls back to `THOUGHT_RPC_UPSTREAM`, then `ETH_RPC_UPSTREAM`.

Optional THOUGHT preview runtime vars:

```text
THOUGHT_PREVIEW_NFT_ADDRESS=<ThoughtNFT address>
THOUGHT_PREVIEW_CHAIN_ID=11155111
```

## Custom Domains

Attach these custom domains:

```text
inshell.art
www.inshell.art
thought.inshell.art
```

Preview domain:

```text
preview.inshell.art -> staging.inshell-art.pages.dev
thought.preview.inshell.art -> staging.thought-inshell-art.pages.dev
```

`preview.inshell.art` is the staging gate for the home Pages project. `thought.preview.inshell.art` is the staging gate for the THOUGHT Pages project. Together they are the preview umbrella: `preview.inshell.art` mirrors `inshell.art`, and `thought.preview.inshell.art` mirrors `thought.inshell.art`.

Both preview domains must show the latest successful deployment from the `staging` branch before frontend changes are merged to `main`.

Cloudflare supports branch aliases for preview deployments. A `staging` branch deployment creates or updates `staging.inshell-art.pages.dev` and `staging.thought-inshell-art.pages.dev`, and the preview custom domains should point at those branch aliases. This setup requires proxied Cloudflare DNS records; an external DNS provider or unproxied record can route a custom domain to the production branch instead of the preview branch.

Cloudflare Pages custom apex domains are simplest when the domain uses Cloudflare nameservers. If DNS remains at GoDaddy, `www.inshell.art` and `thought.inshell.art` can use CNAME records, but the apex `inshell.art` depends on GoDaddy support for apex CNAME/ALIAS/ANAME behavior.

Recommended DNS move:

1. Add `inshell.art` as a Cloudflare zone.
2. Update GoDaddy nameservers to Cloudflare nameservers.
3. Add Pages custom domains in Cloudflare.
4. Let Cloudflare create/proxy the DNS records.
5. Add `preview.inshell.art` to the `inshell-art` Pages project after a successful `staging` deployment.
6. In Cloudflare DNS, set the `preview` CNAME target to `staging.inshell-art.pages.dev` and keep it proxied.
7. Add `thought.preview.inshell.art` to the `thought-inshell-art` Pages project after a successful `staging` deployment.
8. In Cloudflare DNS, set the `thought.preview` CNAME target to `staging.thought-inshell-art.pages.dev` and keep it proxied.

If DNS stays at GoDaddy:

1. Add `www.inshell.art` to the `inshell-art` Pages project.
2. Add GoDaddy CNAME `www -> inshell-art.pages.dev`.
3. Add `thought.inshell.art` to the `thought-inshell-art` Pages project.
4. Add GoDaddy CNAME `thought -> thought-inshell-art.pages.dev`.
5. For apex `inshell.art`, either use GoDaddy forwarding to `www.inshell.art`, or use GoDaddy apex ALIAS/ANAME/CNAME flattening if available.

Do not use GoDaddy or unproxied DNS records for preview domains if the intent is to pin them to the `staging` branch. Cloudflare's custom branch alias flow depends on proxied Cloudflare DNS.

## Staging Discipline

Use this frontend release path:

1. Develop and commit on a feature branch or directly on `staging` when the operator asks for a fast path.
2. Push or merge to `staging`.
3. Deploy Cloudflare Pages with `.github/workflows/deploy-pages.yml`, `branch=staging`, and the needed `target`.
4. Validate `https://preview.inshell.art` and `https://thought.preview.inshell.art`.
5. Merge `staging` into `main`.
6. Deploy Cloudflare Pages with `branch=main` for production.

Do not deploy `main` before `preview.inshell.art` has been validated, unless the operator explicitly asks for an emergency hotfix. If a hotfix bypasses staging, merge `main` back into `staging` immediately after production is stable.

Staging builds must cross-link inside the preview umbrella:

```text
VITE_THOUGHT_URL=https://thought.preview.inshell.art/
VITE_PATH_MINT_URL=https://preview.inshell.art
```

Production builds must keep the public domains:

```text
VITE_THOUGHT_URL=https://thought.inshell.art/
VITE_PATH_MINT_URL=https://inshell.art
```

## RPC Proxy

The repo contains a Cloudflare Pages Function:

```text
functions/api/eth-rpc.ts
functions/api/path-rpc.ts
functions/api/thought-rpc.ts
```

`/api/path-rpc` forwards constrained PATH reads to `PATH_RPC_UPSTREAM`.
`/api/thought-rpc` forwards constrained THOUGHT reads to `THOUGHT_RPC_UPSTREAM`.
`/api/eth-rpc` is a legacy read fallback to `ETH_RPC_UPSTREAM`; it does not allow `eth_getLogs`.

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
VITE_THOUGHT_URL=https://thought.inshell.art/
```

Required GitHub Actions secrets:

```text
CLOUDFLARE_ACCOUNT_ID=7fc68967a9445609a0788d8c94e45de0
CLOUDFLARE_API_TOKEN=<Cloudflare Pages edit token>
```

The manual fallback deploy does not need private RPC URLs because the deployed Pages Functions read `PATH_RPC_UPSTREAM`, `THOUGHT_RPC_UPSTREAM`, and the legacy `ETH_RPC_UPSTREAM` fallback from Cloudflare Pages project secrets.

The workflow's `branch` input is restricted to `staging` or `main`. It checks out the same branch it deploys, so a preview deploy cannot accidentally build production code under a staging label.

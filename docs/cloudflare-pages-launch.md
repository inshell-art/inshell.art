# Cloudflare Pages Launch

Last updated: 2026-05-16

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
VITE_ETH_RPC=/api/eth-rpc
VITE_DEBUG_PANEL=off
VITE_GITHUB_URL=https://github.com/inshell-art/inshell.art
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
ETH_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>
```

`ETH_RPC_UPSTREAM` is consumed only by the Cloudflare Pages Function at `/api/eth-rpc`. Do not expose it as a `VITE_*` variable.

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
VITE_ETH_RPC=/api/eth-rpc
VITE_THOUGHT_RPC_URL=https://thought.inshell.art/api/eth-rpc
```

Production secret:

```text
ETH_RPC_UPSTREAM=<private Sepolia RPC HTTPS endpoint>
```

## Custom Domains

Attach these custom domains:

```text
inshell.art
www.inshell.art
thought.inshell.art
```

Cloudflare Pages custom apex domains are simplest when the domain uses Cloudflare nameservers. If DNS remains at GoDaddy, `www.inshell.art` and `thought.inshell.art` can use CNAME records, but the apex `inshell.art` depends on GoDaddy support for apex CNAME/ALIAS/ANAME behavior.

Recommended DNS move:

1. Add `inshell.art` as a Cloudflare zone.
2. Update GoDaddy nameservers to Cloudflare nameservers.
3. Add Pages custom domains in Cloudflare.
4. Let Cloudflare create/proxy the DNS records.

If DNS stays at GoDaddy:

1. Add `www.inshell.art` to the `inshell-art` Pages project.
2. Add GoDaddy CNAME `www -> inshell-art.pages.dev`.
3. Add `thought.inshell.art` to the `thought-inshell-art` Pages project.
4. Add GoDaddy CNAME `thought -> thought-inshell-art.pages.dev`.
5. For apex `inshell.art`, either use GoDaddy forwarding to `www.inshell.art`, or use GoDaddy apex ALIAS/ANAME/CNAME flattening if available.

## RPC Proxy

The repo contains a Cloudflare Pages Function:

```text
functions/api/eth-rpc.ts
```

It forwards same-origin frontend JSON-RPC reads to `ETH_RPC_UPSTREAM`.

Allowed methods are read-oriented Ethereum JSON-RPC calls such as:

```text
eth_call
eth_chainId
eth_blockNumber
eth_getCode
eth_getLogs
eth_getTransactionReceipt
eth_estimateGas
```

The function does not allow arbitrary write/broadcast RPC methods. Wallet transactions should still go through the user wallet.

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
VITE_ETH_RPC=/api/eth-rpc
VITE_DEBUG_PANEL=off
VITE_THOUGHT_URL=https://thought.inshell.art/
```

Required GitHub Actions secrets:

```text
CLOUDFLARE_ACCOUNT_ID=7fc68967a9445609a0788d8c94e45de0
CLOUDFLARE_API_TOKEN=<Cloudflare Pages edit token>
```

The manual fallback deploy does not need the private RPC URL because the deployed Pages Function reads `ETH_RPC_UPSTREAM` from Cloudflare Pages project secrets.

# Wallet Issues Summary (inshell.art Home)

Context
- App: `apps/home` (localhost:5174)
- Network: Starknet Sepolia
- Wallet: Ready Wallet (formerly Argent)
- Auction contract: `0x0762aac9638bdcf6559524a0d5f677147dbf6b6acfb8651a6613423f6b51d45f`
- Payment token (STRK Sepolia): `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`

Symptoms observed
- CTA loop: `connect -> unlock wallet -> connect` and no mint.
- `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` from wallet account creation.
- RPC error: `Invalid block id` when reading token balance/allowance.
- Mint tx revert: `argent/multicall-failed` and `u256_sub Overflow`.
- Mint validation error: `argent invalid signature length`.

Root causes
- `useAccount` in `@starknet-react/core` can return `isConnected=true` with no signer account when the wallet is locked or silent account checks fail. The UI showed "unlock wallet" and clicking didn't trigger a prompt reliably.
- Ready/Argent sometimes fails the `silent_mode` request and doesn't supply an account; `connector.account()` throws.
- Read calls defaulted to block tag `pending`, which Alchemy Sepolia RPC rejects.
- `u256_sub Overflow` indicates insufficient STRK balance or missing approval.
- `invalid signature length` indicates the account contract (Ready/Argent) is outdated or incompatible with the wallet's signing format.

Fixes applied in app
- CTA flow:
  - "unlock wallet" now forces a direct `wallet_requestAccounts` prompt and avoids reconnect loops.
  - Fallback injected wallet detection: checks `starknet_ready`, `starknet`, and `starknet_*`.
- Account creation:
  - Build fallback `WalletAccount(provider, wallet, address)` when the core hook doesn't provide a signer.
  - Patch `connector.account()` to retry with a real account address if the first attempt fails.
- RPC safety:
  - Read calls (price/balance/allowance) use `callContract` which normalizes block tag to `latest`.
- Mint flow:
  - Preflight STRK `balance_of` + `allowance`.
  - If allowance is low, call `approve(auction, price)` then `bid(price)`.
  - Two wallet prompts are expected: approve then bid.

Expected wallet prompts/warnings
- Approval warnings (e.g. "Dangerous transaction") are standard for ERC-20 approvals.
- Users only see the warning when allowance is insufficient; exact-amount approval is used.

Still failing (current)
- `Account validation failed: argent invalid signature length`.
  - Likely caused by an outdated or unactivated Ready/Argent account contract.
  - Fix: upgrade/activate the account in Ready Wallet, then reconnect the dapp.
  - If still failing, test with Argent X or Braavos to isolate wallet/account issues.

Checklist for successful mint
- Wallet unlocked and activated on Sepolia.
- STRK balance >= current ask.
- Allowance >= current ask (or approve prompt accepted).
- Auction contract + RPC on Sepolia configured.

Error message index
- `No provider found for chain ...`: missing RPC or chain setup.
- `Invalid block id`: RPC rejects `pending` tag.
- `u256_sub Overflow`: insufficient STRK balance for the bid.
- `argent invalid signature length`: account contract needs upgrade/activation.

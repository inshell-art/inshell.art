# Pulse Current Ask Timing Note

## Issue

The current ask tooltip can look fixed on local Anvil even though the auction curve should decay over time.

## Cause

The current code reads the current ask from the contract via `get_current_price()` and follows latest block time. That is the transaction-safe source of truth.

The earlier smooth drop on local Anvil came from browser-time projection: the UI used `Date.now()` on a one-second interval for live "now" data. That looked smooth even when no new block was mined.

## Local Anvil Behavior

Anvil only advances `block.timestamp` when it mines a block, unless it is started with interval mining. If no block is mined, `get_current_price()` returns the same value.

For local `devnet`, the UI intentionally uses browser-time projection for the live curve/current ask display. This mimics time passing and keeps curve development practical on idle Anvil nodes.

## Sepolia/Mainnet Behavior

On Sepolia and mainnet, blocks arrive continuously, so contract-sourced current ask should update per block. It will step by block, not animate every second.

## Decision For Now

Keep mint/preflight contract-sourced so wallet values match the contract path. Let `devnet` display use browser-time projection for local rehearsal. Public networks should keep contract/block-time behavior.

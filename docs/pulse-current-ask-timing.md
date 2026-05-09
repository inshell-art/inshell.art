# Pulse Current Ask Timing Note

## Issue

The current ask tooltip can look fixed on local Anvil even though the auction curve should decay over time.

## Cause

The current code reads the current ask from the contract via `get_current_price()` and follows latest block time. That is the transaction-safe source of truth.

The earlier smooth drop on local Anvil came from browser-time projection: the UI used `Date.now()` on a one-second interval for live "now" data. That looked smooth even when no new block was mined.

## Local Anvil Behavior

Anvil only advances `block.timestamp` when it mines a block, unless it is started with interval mining. If no block is mined, `get_current_price()` returns the same value and the tooltip stays fixed.

## Sepolia/Mainnet Behavior

On Sepolia and mainnet, blocks arrive continuously, so contract-sourced current ask should update per block. It will step by block, not animate every second.

## Decision For Now

Do not patch this yet. Keep mint/preflight/current ask contract-sourced so wallet values match the contract. If smoother local rehearsal is needed later, use interval mining or add a clearly labeled projected ask separate from current ask.

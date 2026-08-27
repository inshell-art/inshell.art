# Wallet and Local Data

> Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation
- Canonical page: https://inshell.art/docs/wallet-local-data
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: app-documentation

Loading a page or opening the shell wallet menu does not initialize WalletConnect or query an account or network. Account access begins only after a visitor selects Connect and chooses a wallet. After connection, the explicit Refresh action can update the cached account, network, and [$PATH](https://inshell.art/docs/path) inventory.

Product CTAs open wallet requests only when an action needs one: connect, mint $PATH, sign a one-mint $PATH permission, or mint [THOUGHT](https://inshell.art/docs/thought). Canceling a wallet request submits nothing.

Without an approved deployment, Connect wallet opens guidance toward THOUGHT creation rather than initializing WalletConnect or requesting account access. Mint on an accepted THOUGHT work explains that minting is not open. No account access, signature, transaction, network switch, contract read, or mint can occur through these controls.

A signature can authorize a narrowly defined action without sending a transaction or paying gas. A transaction can change chain state and requires wallet confirmation. The interface must name which one it is requesting.

Save and Load use browser storage. Agent run state is held by the App backend for the run window. Neither is an onchain token, a portable account, or a cross-device record.

Local Anvil, Sepolia, and Ethereum are separate chains with separate contracts, balances, and tokens. Local tokens belong only to the local dev chain. Normal App development preserves that chain across restarts; an explicit reset or redeployment can replace it.

## Reading is not signing

- Authority: app-documentation

Page load, opening the wallet menu, and reading public token records do not initialize WalletConnect or access an account. After a visitor explicitly connects, Refresh may read the connected account and network and update cached wallet and $PATH inventory state. None of these reads requests a signature or transaction.

Account access begins with an explicit Connect selection. A later product action can open the connected wallet when it needs a signature, a network switch, or a transaction. The interface should name that boundary before the request appears.

## Signature versus transaction

- Authority: app-documentation

- Connect: gives the App access to the selected public account and network.
- Signature: authorizes the exact message shown by the wallet; it uses no gas and does not change chain state by itself.
- Transaction: calls a contract, can transfer value or change state, and requires wallet confirmation.
- Cancellation: submits nothing. A canceled or rejected request should not be treated as partial success.

## Browser storage and Agent runs

- Authority: app-documentation

Saved THOUGHT candidates live in the current browser. Temporary Agent run state lives within its App-defined run window. These records may be useful during creation, but they are not tokens, public provenance, or synchronized accounts.

> Clearing browser data, changing browsers, or moving to another device can make local saves unavailable.

## Networks do not merge

- Authority: app-documentation

Local Anvil, Sepolia, and Ethereum have different chain IDs, deployments, balances, transaction histories, and token identities. A familiar token number or account address on two networks does not make the records equivalent.

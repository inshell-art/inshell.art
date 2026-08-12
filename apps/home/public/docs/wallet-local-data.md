# Wallet and Local Data

> Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.

- Group: Records and verification
- Status: current
- Authority classes in this document: app-documentation
- Canonical page: https://inshell.art/docs/wallet-local-data
- Documentation version: 2026-08-12
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Two distinctions

- Authority: app-documentation
- Figure ID: wallet.distinctions
- Figure mode: field
- Semantic form: ledger
- Semantic nodes:
  - `read [action]: Read — Public state`
  - `sign [action]: Sign — Authorization`
  - `transact [action]: Transact — Chain change`
  - `local [record]: Local — Browser record`
  - `onchain [record]: Onchain — Public record`
- Semantic edges:
  - `read-not-sign: read (Read) --[≠ · Reading public state is not signing an authorization.]--> sign (Sign)`
  - `sign-not-transact: sign (Sign) --[≠ · Signing an authorization is not a chain transaction.]--> transact (Transact)`
  - `local-not-onchain: local (Local) --[≠ · A local browser record is not an onchain public record.]--> onchain (Onchain)`
- Semantic groups:
  - `wallet-action-distinction [comparison]: Read, sign, and transact are distinct wallet actions. [members: read (Read) · sign (Sign) · transact (Transact)]`
  - `record-location-distinction [comparison]: Local browser data is distinct from an onchain public record. [members: local (Local) · onchain (Onchain)]`

```text
READ  ≠  SIGN  ≠  TRANSACT
Public state   Authorization   Chain change

LOCAL  ≠  ONCHAIN
Browser record   Public record
```

- **Read** — Public state
- **Sign** — Authorization
- **Transact** — Chain change
- **Local** — Browser record
- **Onchain** — Public record

## Overview

- Authority: app-documentation

The shell wallet menu reads the current account and network. Its Refresh action updates wallet and PATH inventory reads. Opening the menu itself never asks for a signature or transaction.

Product CTAs open wallet requests only when an action needs one: connect, mint PATH, sign a one-mint PATH permission, or mint THOUGHT. Canceling a wallet request submits nothing.

A signature can authorize a narrowly defined action without sending a transaction or paying gas. A transaction can change chain state and requires wallet confirmation. The interface must name which one it is requesting.

Save and Load use browser storage. Agent run state is held by the App backend for the run window. Neither is an onchain token, a portable account, or a cross-device record.

Local Anvil, Sepolia, and Ethereum are separate chains with separate contracts, balances, and tokens. Local tokens belong only to the local dev chain. Normal App development preserves that chain across restarts; an explicit reset or redeployment can replace it.

## Reading is not signing

- Authority: app-documentation

Opening the wallet menu, refreshing account state, loading PATH inventory, or reading public token records should not request a signature or transaction. These are passive reads.

A product action can open a wallet only when it needs account access, a signature, a network switch, or a transaction. The interface should name that boundary before the request appears.

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

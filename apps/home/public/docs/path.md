# $PATH

> $PATH carries permission and progress across Inshell's movements.

- Group: Works and participation
- Status: current
- Authority classes in this document: artist-editorial, app-documentation, contract-release
- Canonical page: https://inshell.art/docs/path
- Documentation version: 2026-08-16
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial, app-documentation, contract-release

$PATH is an ERC-721 permission token and movement ledger. It authorizes works but is not itself one of the movement artworks. PathNFT is the contract that owns its identity and state.

Within the practice, $PATH carries permission to enter successive movement forms. It records use and progress; it does not measure self-knowledge, certify an inner truth, or turn participation into a guaranteed transformation.

Public $PATH tokens are issued through [Pulse](https://inshell.art/docs/pulse). The contract also supports a bounded Spark self-claim path for allowlisted recipients. Issuance route is a contract fact, not a claim that one token is more authentic than another.

PathNFT configures one quota for each movement across a deployment. Every $PATH uses those movement totals, while each token records its own current stage and in-stage count. One successful movement mint consumes one unit from that token's current movement entitlement. Reaching the quota advances it through [THOUGHT](https://inshell.art/docs/thought), [WILL](https://inshell.art/docs/will), and [AWA](https://inshell.art/docs/awa) in order. Not available means the movement has no deployed quota.

The token image and the stable Stage, THOUGHT, WILL, and AWA traits show movement progress. PathNFT emits a metadata update after a unit is consumed so compatible readers can refresh the token.

A $PATH detail page joins the canonical token image with capacity, movement tokens already authorized, owner, mint transaction, contract, network, and token metadata source. Pulse-issued tokens also include their original Pulse mint price.

## Permission, not the movement artwork

- Authority: artist-editorial, contract-release

$PATH is an ERC-721 whose state authorizes participation across movements. It can point to THOUGHT, WILL, or AWA progress, but it is not a THOUGHT, WILL, or AWA artwork itself.

The token is also a ledger. Its movement totals and used counts let later readers see how much configured permission has been exercised without relying on a private account database.

## Issuance routes

- Authority: artist-editorial, contract-release

Public $PATH issuance runs through Pulse. The contract can also expose a bounded Spark self-claim route for allowlisted recipients. The issuance route belongs to the token's history and can be shown as a fact, but it does not create a separate class of authenticity.

- Pulse issuance includes the auction settlement and original price context.
- Spark issuance depends on the contract's allowlist and claim rules.
- Every token still needs its network, contract address, and token ID to be identified correctly.

## Movement capacity

- Authority: app-documentation, contract-release

PathNFT configures one quota and one authorized minter for each movement across the deployment. Every $PATH uses those movement totals, while each token stores its own current stage and in-stage minted count. Remaining entitlement is derived from the deployed movement quota and that token's progress; it is not a separate stored balance.

The v0.5.0 canonical deployment policy configures and freezes THOUGHT 1, WILL 10, and AWA 1. That release policy is not a live chain observation. Clients must read getMovementQuota on the named deployment instead of hard-coding those numbers.

- Total: the deployed quota for the movement, applied to every $PATH in that deployment.
- Used: how many units successful mints have consumed from this $PATH for that movement.
- Remaining: total minus this $PATH's derived used count.
- Not available: no capacity is configured; the App must not display a fictional zero-to-something progress bar.

## Consuming one movement unit

- Authority: contract-release

Selecting a $PATH or signing its permission does not consume a unit. For one movement mint, the current owner authorizes a short-lived EIP-191 message bound to the PathNFT address, chain ID, $PATH ID, movement, owner, configured movement minter, current permission epoch, the owner's current consume nonce, and a deadline. ERC-721 approval is not movement authorization, and only the configured movement minter may call consumeUnit.

Before changing state, PathNFT checks the configured caller, the unexpired current-owner authorization, the fixed movement order, and remaining quota. On success it returns the unit's zero-based in-movement serial, advances the owner's consume nonce, and increments that $PATH's current count. When the count reaches the movement quota, $PATH advances to the next movement and resets its in-stage count. MetadataUpdate and MovementConsumed tell readers which $PATH state to refresh.

The configured movement contract is responsible for pairing consumption with the artwork mint. It calls consumeUnit before minting the movement work inside the same transaction. If a later mint step reverts, the EVM rolls back the unit, nonce, progress, events, and work together. A canceled or failed flow consumes nothing.

## Ownership and remaining entitlement

- Authority: app-documentation, contract-release

A regular $PATH can be transferred. Its movement progress and remaining entitlement travel with the token; transfer never resets, duplicates, or replenishes them. Movement works minted before the transfer remain with their existing owners and are not included with the $PATH.

Only the current $PATH owner can authorize movement use. ERC-721 approvals can authorize transfer of a regular $PATH, but they do not authorize THOUGHT, WILL, or AWA consumption. Every successful regular transfer advances the $PATH permission epoch, so a signature from an earlier owner or epoch becomes invalid. Every successful consume also advances the signing owner's consume nonce, invalidating other pending consume authorizations made with the old nonce.

Remaining entitlement is plain language for each movement's configured quota minus its minted count. It is derived from contract state, not a second counter or marketplace trait. A completed regular $PATH may still transfer, but it carries zero remaining entitlement.

- Read owner, stage, minted count, quota, and permission epoch from one consistent block.
- Re-read that snapshot before purchase or movement authorization.
- If ownership, epoch, or progress changed, discard the earlier view and review the current state.

## Spark awards

- Authority: app-documentation, contract-release

A Spark $PATH is a bounded, named award issued through a contract invitation and self-claim flow. It carries the same movement progression and owner-only consume rights as a regular $PATH, but it is permanently locked under ERC-5192 and cannot be transferred or listed.

An invitation reserves one Spark slot until it is claimed, revoked, or released after expiry. The recipient reviews the exact issuer-supplied name and expiry, then claims from the invited wallet. After claim, the name is immutable. The invitation, reserved capacity, claim, and lock are contract facts; they are not a second authenticity tier for the artwork.

- Regular $PATH: transferable, subject to its current progress and permission epoch.
- Spark $PATH: permanently locked, named, and still usable by its owner for eligible movement mints.
- Available reserved capacity and pending invitations are different issuer states and must not be merged.

## Reading a $PATH detail page

- Authority: app-documentation, contract-release

1. Confirm the active network and PathNFT contract address.
2. Read the token ID, owner, issuance route, and mint transaction.
3. Read each movement's deployed quota and this $PATH's derived used and remaining capacity.
4. Before authorizing a movement mint, read the current owner, stage, configured minter, permission epoch, and owner consume nonce from current state.
5. Follow linked movement token IDs to the contracts that minted those works.
6. Compare the displayed artwork and traits with the tokenURI source.

> Marketplace metadata can lag after movement use. PathNFT emits a metadata update so compatible readers know that the token should be refreshed.


## Links

- [view $PATH tokens](https://inshell.art/path)
- [read the contract consume boundary](https://inshell.art/docs/contracts#docs-contracts-consumption)
- [inspect the $PATH v0.5.0 handoff](https://inshell.art/protocol/releases/path-v0.5.0/DOWNSTREAM_HANDOFF.md)
- [read about Pulse](https://inshell.art/docs/pulse)
- [read Mono 76](https://inshell.art/docs/mono-76)
- [verify $PATH contracts](https://inshell.art/verify#verify-contracts)

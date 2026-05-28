# Pulse Wallet Signing QA

Date: 2026-05-28

Scope: Pulse bid wallet-signing UX for Sepolia PATH minting.

## Current Result

- Dapp pre-wallet panel: verified on `preview.inshell.art`.
- It shows `PulseAuction.bid(uint256 maxPrice)`, Sepolia `11155111`, the PulseAuction address, current ask, ETH sent, max price, wallet gas note, refund rule, revert rule, and a raw-wallet-data warning.
- Rabby popup screenshot: pending. The Chrome automation extension is not available in the active Chrome profile, and no wallet transaction was signed.
- MetaMask popup screenshot: pending. MetaMask was not the active wallet in the inspected session.

## Sepolia Contracts

| Contract | Address | Etherscan status checked 2026-05-28 |
| --- | --- | --- |
| PulseAuction | `0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39` | Unverified |
| PathPulseAdapter | `0x8Cd52b431F4e932c5fDd8E49073c2c5bc1bfabF2` | Unverified |
| PathNFT | `0x84915746a1f06850CF41a3E90C60c2DcA3fa116D` | Unverified |
| ThoughtNFT | `0x413efb5C95Bf3158F0E563FB9E19CB650Fc3760a` | Unverified |
| ThoughtSpecRegistry | `0xBB8FD738b01b4a14F5E9bCFE408239a05d84621D` | Unverified |
| ColorFont | `0xC223507ab7801Fdf234766fa1A87F09eae3494af` | Unverified |

## Pulse Bid ABI

```solidity
function bid(uint256 maxPrice) external payable
```

Selector:

```text
0x454a2ab3
```

Transaction shape:

```text
chainId: 11155111
to:      0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39
data:    0x454a2ab3 + ABI-encoded uint256 maxPrice
value:   ETH sent for the bid
```

The shared frontend ABI is aligned to `bid(uint256 maxPrice) payable`; selector stays `0x454a2ab3`.

## Wallet QA Matrix

| Surface | Status | Notes |
| --- | --- | --- |
| Inshell pre-wallet panel | Pass | The dapp decodes and explains the bid before opening the wallet. |
| Rabby popup | Pending | Need a safe wallet-prompt capture after source verification. Do not sign during QA. |
| MetaMask popup | Pending | Need the same capture with MetaMask selected as the active wallet. Do not sign during QA. |
| Explorer decode | Blocked | Contracts are not verified on Sepolia Etherscan yet. |

## Rabby Support Draft

Subject:

```text
Sepolia PulseAuction bid shows Unknown Signature Type / raw transaction
```

Body:

```text
We are testing the Inshell PATH Pulse auction on Sepolia.

Chain:
- Sepolia
- chainId: 11155111

Contract:
- PulseAuction: 0x1071e99928Bdf020794a5E3e5B9c920450Ac9b39

Function:
- bid(uint256 maxPrice) payable
- selector: 0x454a2ab3

Transaction shape:
- to: PulseAuction
- value: ETH bid amount
- data: bid(maxPrice)

Expected wallet display:
- Contract: PulseAuction
- Function: bid(uint256 maxPrice)
- Value: ETH sent
- Network: Sepolia

Observed display:
- Simulation Not Supported / Unknown Signature Type / View Raw

The dapp now shows a pre-wallet confirmation panel that decodes the call before opening the wallet. We are verifying contracts on public explorers and want Rabby to decode this call more clearly if possible.
```

Do not submit this support message without operator approval.

## Next Gate

Verify at least `PulseAuction`, `PathPulseAdapter`, and `PathNFT` on Etherscan or Sourcify, then rerun Rabby and MetaMask popup QA and attach screenshots.

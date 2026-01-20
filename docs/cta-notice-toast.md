# CTA, Notice, Toast Summary

This covers the CTA state logic, notice text logic, toast behavior, and the dot colors.

## CTA States

CTA is rendered by `HeaderWalletCTA` and driven by `ctaState` in
`apps/home/src/components/AuctionCanvas.tsx`.

Default CTA mapping (derived from effective wallet/chain/preflight/tx state):
- `pending`: when `effectiveTxState === "submitted"`.
- `sign`: when `effectiveTxState === "awaiting_signature"`.
- `retry`: when `effectiveTxState === "failed"`.
- `switch`: when wallet is unlocked + chain is known but wrong.
- `unlock`: when wallet is detected but locked (or account missing after unlock).
- `connect`: when wallet is detected but no address, or no wallet detected.
- `mint` (enabled): when wallet is unlocked, chain ok, preflight ok, balance ok.
- `mint` (disabled): default fallback when not ready.

Debug override (`debug -> override -> cta`) can force:
`connect`, `unlock`, `switch`, `mint`, `mint-disabled`, `sign`, `pending`, `retry`.
When CTA override is active, it drives the underlying wallet/chain/preflight/tx
state; notice and other selectors are locked to keep the state consistent.

CTA text color:
- Enabled: `var(--accent)` (see `.dotfield__mint`).
- Disabled: `var(--muted)` (see `.dotfield__mint[disabled]`).

## Notice Logic

Notice line uses `.dotfield__mint-notice` and `displayNotice` in
`apps/home/src/components/AuctionCanvas.tsx`.

Priority:
1) `toastNotice` (shows for 3s, then clears)
2) debug notice override (if set)
3) persistent notice (derived from wallet/chain/preflight/tx state)

Notice colors:
- Info: `var(--muted)` via `.dotfield__mint-notice.is-info`
- Warn: `#b57a00` via `.dotfield__mint-notice.is-warn`
- Error: `#a84242` via `.dotfield__mint-notice.is-error`

Persistent notice text (default mapping):
- Tx signing: `Wallet open: Approve in wallet (1/2)...` or `Sign mint (2/2)...`
- Tx pending: `Submitted: Approval pending (1/2)...` or `Minting (2/2) pending...`
- Tx failed:
  - invalid signature length → `Account needs upgrade/activation.`
  - user refused → `Signature cancelled.`
  - failed to fetch / network error → `RPC busy. Retry.`
  - invalid block id / RPC error → `RPC read failed.`
  - overflow → `Insufficient STRK at execution.`
  - fallback → `Mint failed.`
- No wallet: `No Starknet wallet found.`
- Wrong network: `Sepolia only.`
- Preflight loading: `Loading...`
- Preflight error: `RPC read failed.`
- Insufficient balance: `Need X, have Y.`
- Needs approval: `Approve STRK (1/2)`

Debug notice override (`debug -> override -> notice`) forces a notice by
driving wallet/chain/preflight/tx state. It only applies when CTA override is
`auto` and locks other selectors while active.

Debug panel now exposes only `cta` and `notice` selectors, plus toast buttons.
Lower-level wallet/chain/tx selectors were removed to keep the control surface
logical.

## Toast Behavior

Toasts are controlled by `showToast()` in `AuctionCanvas`.
- `toastNotice` shows immediately and clears after 3 seconds.
- While visible, toasts override the persistent/debug notice text.
- Debug panel buttons (`copied`, `submitted`, `confirmed`, `disconnected`)
  call `showToast()` directly for quick testing.

## CTA Dot (right of CTA)

Dot state is set in `AuctionCanvas` and mapped in
`apps/home/src/components/HeaderWalletCTA.tsx`.

Dot state mapping:
- `on` => `.dotfield__cta-dot.is-on`
- `amber` => `.dotfield__cta-dot.is-pending`
- `error` => `.dotfield__cta-dot.is-error`
- `off` => `.dotfield__cta-dot.is-off`

Dot colors:
- `on`: `var(--accent)` with glow `rgba(0, 97, 0, 0.6)`
- `pending`: `#d59a00` with glow `rgba(213, 154, 0, 0.6)`
- `error`: `#b04646` with glow `rgba(176, 70, 70, 0.6)`
- `off`: transparent fill, `1px` border `var(--muted)`

# Recent Spec Implementation Memo

Last updated: 2026-05-16

## Counted Specs

The recent implementation set includes four spec files:

- `inshell-path-pulse-copy-reconciliation-spec.md`
- `inshell-path-pulse-mutual-messaging-spec.md`
- `inshell-sepolia-invite-ux-spec.md`
- `inshell-path-pulse-layout-width-spec.md`

## Implementation Results

### Path/Pulse Copy Reconciliation

- Aligned `$PATH` and Pulse vocabulary across home, `/path`, and `/pulse`.
- Reconciled auction language around current ask, start ask, sale, movement quota, and movement mint.
- Removed stale or conflicting naming such as older "next ask" wording where the context is a displayed curve start.

Primary areas:

- `apps/home/src/components/AuctionCanvas.tsx`
- `apps/home/src/components/PathPage.tsx`
- `apps/home/src/components/PulsePage.tsx`
- `apps/home/src/content/pulse.ts`

### Path/Pulse Mutual Messaging

- `/path` now describes `$PATH` as the permission token minted by the public Pulse auction.
- `/pulse` now describes Pulse as the pricing rule behind the current public `$PATH` auction.
- Added bridge links:
  - `/path` -> `View Pulse pricing`
  - `/pulse` -> `View $PATH tokens`

Primary areas:

- `apps/home/src/components/PathPage.tsx`
- `apps/home/src/components/PulsePage.tsx`
- `apps/home/src/content/pulse.ts`

### Sepolia Invite UX

- Added public launch modes: `local`, `sepolia_invite`, and `production`.
- In Sepolia invite mode, debug UI is hidden by default.
- Debug remains privately available through `?debug=1` or `localStorage.inshellDebug = "1"`.
- Sepolia-only wallet/network copy is explicit.
- Contextual report-bug links are available for relevant failure states when configured.

Primary areas:

- `apps/home/src/config/publicLaunch.ts`
- `apps/home/src/components/AuctionCanvas.tsx`
- `apps/home/src/components/Footer/Footer.tsx`
- `apps/home/tests/AuctionCanvas.test.tsx`

### Path/Pulse Layout Width

- `/pulse` keeps a narrow reading/source-note layout.
- `/path` keeps intro/source metadata narrow while letting the token gallery use a wider layout.
- Shared primitive page width variables were added for consistency.

Primary areas:

- `apps/home/src/main.css`
- `apps/home/src/components/PathPage.tsx`
- `apps/home/src/components/PulsePage.tsx`

## Test Coverage Added Or Updated

- `apps/home/tests/App.test.tsx`
- `apps/home/tests/AuctionCanvas.test.tsx`
- `apps/home/tests/ethereumClient.test.ts`

## Validation Surface

- `pnpm run check:production`
- Home unit tests covering PATH/Pulse links, Sepolia invite UI, and production RPC safety.

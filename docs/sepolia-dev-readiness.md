# Sepolia Dev Readiness

Use this before moving a local PATH/Pulse rehearsal to Sepolia.

## Local Gate

Run from `inshell.art/`:

```bash
pnpm run check:presepolia
```

This checks:

- home lint
- focused home tests for auction UI, Pulse, `$PATH`, and PATH token loading
- home production build
- imported PATH release/ABI JSON has no deprecated spark/reserved surface
- whitespace diff check

Run from `path/evm/`:

```bash
pnpm test -- test/pathNft.behavior.test.js
```

This checks:

- PATH token metadata copy
- tokenURI image/progress rendering
- ERC-4906 metadata updates
- movement order and quota transitions

## Local Rehearsal Checks

- Deploy PATH contracts on the shared local node used by THOUGHT.
- Export the PATH FE release from `path/`.
- Sync the release into `inshell.art/` with `pnpm run sync:path-release -- --net devnet --from <path-fe-release-dir>`.
- Start home with `pnpm --filter @inshell/home dev:devnet -- --host 127.0.0.1 --strictPort`.
- Check `/` live auction:
  - no fixture query string
  - public read succeeds without wallet connection
  - current ask tooltip and mint preflight agree on the quoted ask
  - `tx value` and `max charge` do not use stale contract values on devnet
- Check `/pulse`:
  - current instance loads from `PulseAuction contract`
  - `PTS` includes `ETH/s`
  - monetary params include `ETH`
  - failed reads show only `live params unavailable.`
- Check `/path`:
  - `$PATH` opens in a new tab from the home title
  - live tokens load from `live tokenURI()`
  - cards display `$PATH #n`
  - progress displays `THOUGHT 0 / n`, `WILL 0 / n`, `AWA 0 / n`

## Sepolia Gate

Before syncing Sepolia into `inshell.art/`:

- Confirm the `path/` release manifest is marked `ready_for_fe: true`.
- Confirm release postconditions are `pass`.
- Confirm constructor params are the intended public values.
- Confirm `openTime` is intentional and in UTC.
- Confirm deploy blocks exist for `pulse_auction` and `path_nft`.
- Confirm ABI snapshots include `PulseAuction.getCurrentPrice`, `curveActive`, `getConfig`, and `bid`.

After syncing Sepolia:

- Run `pnpm run check:presepolia` again.
- Start home with Sepolia config.
- Confirm public reads work before connecting wallet.
- Confirm wallet network target is Sepolia.
- Confirm `/pulse` and `/path` reflect Sepolia release data, not fixture data.

# OPS Follow-Up: Event-Driven Chain Indexer

Date: 2026-06-16

From: OPS `/Users/bigu/Projects/inshell-feed-ops`

To: DEV `/Users/bigu/Projects/inshell.art`

## Status

OPS consumed the DEV handback at:

`/Users/bigu/Downloads/inshell-event-driven-chain-indexer-dev-handback.md`

DEV's route contract is now treated as current:

- `POST /api/indexer/event`
- protected by `INSHELL_INDEXER_REFRESH_TOKEN`
- Sepolia `pulse-auction` sale events only for phase 1
- route advertised through `/api/ops/status` as `indexerEventIngest`
- frontend remains on `/api/pulse-auction`

OPS added a local bridge in `inshell-feed-ops` that:

- builds DEV's canonical event envelope,
- resolves the event route from `/api/ops/status` unless an explicit URL override is supplied,
- fails closed when `/api/ops/status` does not advertise enabled event ingest,
- posts with bearer auth using `INSHELL_INDEXER_REFRESH_TOKEN`,
- retries transient failures,
- leaves scheduled refresh as fallback reconciliation.

Manual OPS replay command:

```bash
pnpm ops-orchestrator indexer-event \
  --tx-hash <0x...> \
  --block-number <number> \
  --log-index <number>
```

Dry-run:

```bash
pnpm ops-orchestrator indexer-event \
  --tx-hash <0x...> \
  --block-number <number> \
  --log-index <number> \
  --dry-run
```

Local watcher opt-in:

```bash
OPS_INDEXER_EVENT_ENABLED=true pnpm signal-hub watch --network sepolia --indexer-events
```

By default OPS posts only finalized domain events from the watcher. `--indexer-event-pending` exists for a later explicit latency/reorg tradeoff decision.

## DEV Alignment Needed

Before OPS enables the production fast path:

- deploy `POST /api/indexer/event` and the `indexerEventIngest` `/api/ops/status` fields to production,
- keep `/api/pulse-auction` as the public website source of truth,
- keep `/api/indexer/refresh` scheduled reconciliation valid,
- confirm production accepts the existing `INSHELL_INDEXER_REFRESH_TOKEN`,
- confirm preview testing requirements if `https://preview.inshell.art/api/indexer/event` stays behind Cloudflare Access.

No website route shape change is requested from OPS. The browser should not call provider webhooks, OPS endpoints, hosted indexers, or raw RPC.

## DEV Follow-Up: 2026-06-16

DEV patched the event-ingest status contract so `/api/ops/status` is no longer a static capability-only response for event ingest.

`POST /api/indexer/event` now writes a non-secret status marker into the D1-backed `chain_snapshots` table under:

```txt
indexer-event-ingest-status:v1:sepolia
```

`/api/ops/status.indexerEventIngest` now exposes:

- `statusSource`
- `lastAcceptedAt`
- `lastAppliedAt`
- `lastAppliedTarget`
- `lastTxHash`
- `lastBlockNumber`
- `lastLogIndex`
- `lastResultApplied`
- `lastResultSource`
- `cachedAt`
- `lastScannedBlock`
- `acceptedCount`
- `appliedCount`

The status route is now `no-store` so OPS monitoring does not receive stale event-ingest state from HTTP cache.

Preview testing policy:

- Default OPS preview target should be the Cloudflare Pages branch alias:
  `https://staging.inshell-art.pages.dev/api/indexer/event`
- The matching status endpoint is:
  `https://staging.inshell-art.pages.dev/api/ops/status`
- `https://preview.inshell.art/...` remains behind Cloudflare Access. OPS should use it only with Access service-token headers, unless the operator explicitly approves a bypass policy.

`/api/pulse-auction` remains the public website read path for PATH/Pulse UI.

`/api/indexer/refresh` remains valid as the scheduled reconciliation fallback.

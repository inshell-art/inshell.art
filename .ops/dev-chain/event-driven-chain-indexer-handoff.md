# Handoff: Event-Driven Chain Read Model

Date: 2026-06-16

From: OPS `/Users/bigu/Projects/inshell-feed-ops`

To: DEV `/Users/bigu/Projects/inshell.art`

## Goal

Align the public website read path with the next OPS chain-indexer infrastructure.

OPS is moving the fresh chain read-model path toward provider webhooks or a hosted indexer, with low-frequency pull reconciliation retained as a safety net.

DEV should keep the website reading through local API routes, especially `/api/pulse-auction`. Do not move browser code to provider APIs, OPS endpoints, raw RPC, or webhook URLs.

## Target Architecture

```text
provider webhook / hosted indexer
  -> OPS chain event ingress
  -> DEV protected indexer refresh/event route
  -> INSHELL_CHAIN_DATA_DB chain_snapshots
  -> /api/pulse-auction
  -> website UI
```

Backup path:

```text
low-frequency OPS scheduled refresh
  -> DEV /api/indexer/refresh
  -> INSHELL_CHAIN_DATA_DB chain_snapshots
```

## DEV-Owned Work

Please add or confirm a protected route that can accept a canonical OPS event envelope and update the existing D1 read model.

Preferred route:

```http
POST /api/indexer/event
Authorization: Bearer $INSHELL_INDEXER_REFRESH_TOKEN
Content-Type: application/json
```

Request shape:

```json
{
  "version": 1,
  "source": "ops-chain-event-ingress",
  "network": "sepolia",
  "target": "pulse-auction",
  "txHash": "0x...",
  "blockNumber": 11000000,
  "logIndex": 0,
  "contractAddress": "0x...",
  "topic0": "0x..."
}
```

For phase 1, it is acceptable for this route to call the existing pulse-auction targeted refresh-by-transaction path internally.

Expected success response:

```json
{
  "ok": true,
  "target": "pulse-auction",
  "applied": true,
  "cachedAt": 1780000000000,
  "lastScannedBlock": 11000000,
  "source": "d1"
}
```

## Route Contract

Keep `/api/pulse-auction` as the website source of truth for the Home/PATH UI.

Expected behavior:

- Prefer memory/edge/D1 read-model snapshots as today.
- Fall back to live RPC only according to existing DEV policy.
- Preserve diagnostic headers such as cache source and snapshot block.
- Do not require the browser to know whether the snapshot was updated by webhook or reconciliation.

## OPS-Owned Work

OPS will own:

- provider webhook or hosted-indexer setup,
- event ingress worker/resource,
- provider signature validation,
- event dedupe and audit state,
- low-frequency pull reconciliation,
- monitors for webhook health, reconciliation lag, `/api/pulse-auction` freshness, and D1 quota.

OPS will start with `pulse-auction` only. Later targets can be `path-tokens`, `thought-gallery`, and Public Feed artifacts.

## Status Endpoint Request

Please extend `/api/ops/status` when the route exists so OPS can monitor the contract without reading secrets.

Suggested public fields:

```json
{
  "indexerEventIngest": {
    "enabled": true,
    "route": "/api/indexer/event",
    "targets": ["pulse-auction"],
    "auth": "bearer-token-required",
    "lastAcceptedAt": null,
    "lastAppliedTarget": null
  }
}
```

Do not expose provider secret names, raw provider URLs, bearer tokens, webhook signing secrets, or RPC URLs.

## Acceptance

- `/api/pulse-auction` remains stable for the frontend.
- A protected event ingest or refresh route can update `pulse-auction` read-model state from a tx/event envelope.
- The route is idempotent for duplicate events.
- OPS can monitor route availability and last accepted/applied event via `/api/ops/status`.
- Low-frequency pull reconciliation remains valid and does not conflict with webhook-triggered updates.

# Isolated THOUGHT Anvil lane

Use this lane while PATH and THOUGHT are being developed in parallel. It does
not share chain state with the PATH developer lane.

## Defaults

- Canonical Inshell home/gallery: `http://127.0.0.1:5177/`
- Same-origin THOUGHT App route: `http://127.0.0.1:5177/thought`
- THOUGHT App backing dev server: `http://127.0.0.1:5176/thought/`
- THOUGHT Anvil RPC: `http://127.0.0.1:8547`
- Chain ID: `31338`
- State: `.local/anvil/thought/state.json`
- Generated runtime: `apps/thought/contract-integration/local-runtime.thought-anvil.json`
- PATH dependency: published `v0.4.2` artifacts, verified by release and artifact hashes

The generated runtime and Anvil state are local-only and ignored by Git.

## Run the full THOUGHT stack

```sh
pnpm dev:thought:stack
```

The command:

1. starts or reuses the dedicated THOUGHT Anvil node;
2. verifies the pinned PATH release input;
3. deploys the PATH dependency and current THOUGHT contracts when the lane is fresh;
4. seeds eight canonical Spark PATH tokens to deterministic Anvil account #1
   through PATH's real `allowSparker` / `mintSparker` flow;
5. verifies or reuses the exact generated runtime when the lane was restored; and
6. starts the THOUGHT App against that runtime; and
7. starts a dedicated Inshell home on port `5177`, configured to read the same
   THOUGHT runtime and proxy `/thought` to the App backing server on `5176`.

The Inshell home is the canonical gallery. It lists minted THOUGHT works beside
the other Inshell work types as they launch. The old THOUGHT-only `/gallery`
surface is retired: `/gallery` resolves back to the home, and post-mint
`View THOUGHT` opens `/#thought-<tokenId>` before the user chooses a work detail.

The seeded PATH tokens remove the PATH auction from the routine THOUGHT App
development loop. They are not mocks: they are ERC-721 tokens minted by the
pinned PATH v0.4.2 contract and each carries one real `THOUGHT` movement unit.
The App discovers them from canonical `Transfer` logs and contract reads. The
runtime records their IDs and origin under `pathFixtures`.

The dedicated chain ID is intentional. The PATH developer lane uses chain
`31337`; giving THOUGHT chain `31338` prevents an injected wallet from treating
the two local RPC endpoints as the same network and submitting to the wrong
Anvil process.

This fixture set is disposable local state only. It is not a production
allocation, deployment artifact, or substitute for the separate auction
integration test. Reset the lane to restore all eight unconsumed fixtures.

In a nonstandard checkout, point to the published PATH release explicitly:

```sh
INSHELL_THOUGHT_PATH_RELEASE_DIR=/absolute/path/to/path/releases/v0.4.2 \
  pnpm dev:thought:stack
```

## Run the pieces separately

```sh
pnpm dev:thought:node
pnpm dev:thought:node:prepare
pnpm dev:thought
```

When starting the frontend separately, pass the generated runtime:

```sh
INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE=apps/thought/contract-integration/local-runtime.thought-anvil.json \
VITE_WALLET_CHAIN_RPC_URL=http://127.0.0.1:8547 \
  pnpm dev:thought
```

The standalone frontend command still uses its shared default port. The full
THOUGHT stack command uses port `5176` so it can run beside the shared App lane.

## Reset

Stop the THOUGHT stack first, then run:

```sh
pnpm dev:thought:node:reset
```

Reset removes only the THOUGHT lane state, checkpoint, and generated runtime.
It does not touch the PATH developer lane. Starting or preparing the reset lane
recreates the eight PATH fixtures for Anvil account #1.

## Validate

With the lane running:

```sh
INSHELL_THOUGHT_CONTRACT_RUNTIME_FILE=apps/thought/contract-integration/local-runtime.thought-anvil.json \
  pnpm test:thought-app-contract
```

Use a shared integration node only when testing a specific PATH candidate with
a specific THOUGHT candidate. The isolated THOUGHT lane intentionally consumes
the pinned PATH release instead of the PATH agent's live working tree.

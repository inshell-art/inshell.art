# THOUGHT V2 Protocol Refinement Handoff

This handoff is for downstream `inshell.art` integration. THOUGHT owns the normative protocol and contract artifacts. Consumers must not copy renderer constants by hand.

## Resolve and verify

1. Fetch `protocol/CURRENT.json` from the selected THOUGHT release/tag.
2. Fetch its `manifest` path.
3. Verify manifest byte length, SHA-256, and Keccak-256 against `CURRENT.json`.
4. Verify every consumed manifest artifact using its exact byte length, SHA-256, and Keccak-256.
5. Pin the THOUGHT tag/commit and `protocolReleaseKeccak256` together.

The release identifier is `inshell.thought.protocol.v2`. These source artifacts do not represent a V2 deployment.

## Required consumer changes

- Use `inshell.thought.agent-run.v2`, `inshell.thought.agent-result.v2`, `inshell.thought.agent-declaration.v1`, `inshell.thought.work.v2`, `inshell.thought.provenance.v2`, and `inshell.thought.svg.v2.binary-interleave-32`.
- Freeze and validate exact `promptLine` before run creation. Provider user content must be byte-identical; do not wrap, trim, normalize, summarize, or append instructions.
- Use verified `THOUGHT.v2.md` bytes as Agent instructions, separate from exact user content.
- Reject invalid Agent output. Do not extract, repair, clip, or invoke a second creative response inside one run.
- Fit each line independently to 512 MSB-first bits, interleave `P0,A0,...,P511,A511`, and pack exactly 128 bytes.
- Build and verify provenance hashes and `binaryFieldPacked` before wallet intent.
- Use `agentIdentityHash` for duplicate advisory checks. `workHash` is the complete render-input fingerprint.
- Keep run, candidate, wallet/PATH, and transaction states separate. Identical result retries are idempotent; conflicting retries fail.
- Use `https://inshell.art/thought` and `https://inshell.art/thought/runs/:runId`. Never expose write credentials in URLs, logs, fixtures, or provenance.
- Use shared wallet PATH inventory and selection. Avoid raw PATH ID input when inventory works.
- Before mint, show only the shared TypeScript prediction. After mint, replace it with official contract `svgOf`/`tokenURI` output.

## Contract integration

```solidity
ThoughtNFT(
  address pathNft,
  address thoughtSpecRegistry,
  bytes32 protocolReleaseKeccak256
)
```

`mint(MintThoughtInput)` remains permissionless and consumes one PATH `THOUGHT` unit. The contract computes authoritative hashes. It does not prove Agent authorship, one creative round, or opaque provenance semantics.

The constructor does not pin one spec version. Each mint must supply an exact registered
`thoughtSpecId`/`thoughtSpecHash` pair; multiple registered versions may coexist in the collection.

Use `protocol/releases/v2/contract/abi/ThoughtNFT.json`. Never infer deployment addresses from this handoff; deployment evidence requires a separately approved record.

## V1 boundary

V1 evidence is immutable under `protocol/history/v1/`. Do not migrate V1 Color Font behavior, canonicalization, or deployment addresses into V2 runtime behavior.

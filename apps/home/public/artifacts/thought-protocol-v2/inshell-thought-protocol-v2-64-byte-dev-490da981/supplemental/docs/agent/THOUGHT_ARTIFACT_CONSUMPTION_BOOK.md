# THOUGHT Artifact Consumption Book

This document is the authority for publishing THOUGHT artifacts and consuming them in `inshell.art`. It supersedes artifact publication and consumer-sync instructions in older handoffs when they conflict. Contract behavior remains governed by the active THOUGHT spec and contract tests.

## Boundary

THOUGHT is the producer. It owns and versions:

- exact `specs/THOUGHT.v2.md` bytes;
- Agent input, result, and provenance schemas;
- renderer source, geometry, limits, fixtures, and expected SVGs;
- contract ABIs and reviewed deployment metadata;
- immutable component releases, umbrella releases, checksums, channels, and release tags.

`inshell.art` is the consumer. It owns:

- fetching and verifying a published release;
- pinning immutable artifact IDs and manifest hashes;
- vendoring exact files without normalization;
- the generated consumer lock and frontend metadata;
- same-origin serving, integration tests, staging, and production rollout.

OPS observes deployment state and release freshness. OPS must not author artifacts or repair drift by editing vendored files.

The operator approves candidate-to-stable promotion and production rollout.

## Identity Rules

`THOUGHT.v2.md` is contract registration material, exact Agent context, and a provenance identity anchor. The frontend must not maintain an independently edited copy.

Every release and run must distinguish:

- transport hash: SHA-256 of the raw artifact bytes;
- EVM spec ID: the registry identity derived by the contract convention;
- EVM spec hash: Keccak-256 of the exact registered bytes.

Do not label SHA-256 as an onchain hash or Keccak-256 as a transport checksum.

Provenance must bind the run to the exact spec name, version, reference, byte length, SHA-256, EVM spec ID, and EVM spec hash.

## Artifact Model

Publish separate immutable components and one umbrella frontend release that pins them atomically.

### Protocol and spec component

Required files:

```text
protocol/spec/THOUGHT.v2.md
protocol/spec/spec-identity.json
protocol/schemas/thought.agent-input.v2.schema.json
protocol/schemas/thought.agent-result.v2.schema.json
protocol/schemas/thought.provenance.v2.schema.json
```

`spec-identity.json` must contain at least:

```json
{
  "spec_name": "THOUGHT.v2.md",
  "spec_version": 2,
  "spec_ref": "specs/THOUGHT.v2.md",
  "byte_length": 0,
  "sha256": "<64 lowercase hex>",
  "evm_spec_id": "0x<64 lowercase hex>",
  "evm_spec_hash": "0x<64 lowercase hex>",
  "encoding": "utf-8",
  "line_endings": "lf"
}
```

The producer fills actual values from raw bytes. A BOM, CRLF, malformed UTF-8, wrong heading, wrong filename, or version mismatch is a release failure.

### Render component

Required files:

```text
render/render-contract.json
render/fixtures.json
render/reference/thought-v2-renderer.ts
render/reference/thought-v2-fixtures.ts
render/samples/default.svg
render/samples/index.json
render/samples/works/*.svg
```

The renderer ID, line limits, geometry, binary field, clipping, carousel behavior, and sample SVGs must agree with `ThoughtNFT.tokenURI()` and the active renderer tests.

### Contract frontend component

Required files or immutable references:

```text
contract/abi/ThoughtNFT.json
contract/abi/ThoughtRenderer.json
contract/abi/ThoughtSpecRegistry.json
contract/release/<network>.json
```

Each network release must identify chain ID, `ThoughtNFT`, `ThoughtRenderer`, and registry addresses, deployment blocks, source commit, deployment evidence, the renderer ID/hash pin, and recommended spec identity. Never include private RPC URLs, keys, mnemonics, or operator secrets.

### Umbrella frontend release

Canonical layout:

```text
artifacts/thought-fe/
  experimental.json
  candidate.json
  stable.json
  latest.json
  releases/<release-id>/
    manifest.json
    SHA256SUMS.txt
    protocol/...
    render/...
    contract/...
    handoff.md
```

The umbrella manifest pins each component artifact ID and manifest SHA-256. It must not resolve component channel pointers at consumer runtime. References are allowed instead of duplicated bytes only when every reference is immutable, content-addressed, and independently verifiable.

## Manifest Contract

An immutable manifest must include:

- schema version and artifact kind;
- artifact ID, component kind, and compatibility version;
- source remote, branch, commit, clean/dirty state, and changed paths;
- creation time and release tag when applicable;
- every file path, byte length, media type, and SHA-256;
- component artifact IDs and manifest hashes for umbrella releases;
- renderer, protocol, schema, ABI, network, and spec compatibility declarations.

Manifest paths must be relative, normalized POSIX paths. Reject absolute paths, `..`, empty segments, duplicate paths, missing files, undeclared files, and checksum disagreement.

Hash raw bytes before parsing. Verification must not execute producer-supplied renderer or scripts merely to discover metadata.

## Channels

### `experimental`

- May be built from a dirty worktree.
- Must record `source.dirty=true` and changed paths.
- Is limited to local labs and design review.
- Must never be consumed by production.

### `candidate`

- Must be built from a clean commit.
- Must have an immutable artifact ID and source commit.
- Must pass producer tests, parity gates, and complete checksum verification.
- May be pinned by DEV staging.
- Publication must fail closed when the source is dirty.

### `stable`

- Must be promoted from verified candidate bytes; do not rebuild different bytes.
- Must identify a clean, signed or annotated release tag.
- Must pin all component artifacts and pass cross-component parity gates.
- Is eligible for production only after operator review.

### `latest`

- Is a discovery convenience pointer only.
- Is never a production lock.
- Consumers record the resolved immutable artifact ID and manifest SHA-256.

A dirty `latest.json` or `experimental.json` is not production-consumable even when its files verify correctly.

## Producer Procedure

Run from the intended THOUGHT source commit.

1. Inspect source and channel policy:

   ```bash
   git status --short --branch
   git rev-parse HEAD
   git describe --tags --exact-match HEAD
   ```

2. For candidate or stable, stop unless the worktree is clean. Stable also requires the intended release tag.
3. Validate raw `specs/THOUGHT.v2.md`: UTF-8, no BOM, LF-only, correct filename, first heading, and version.
4. Compute the raw-byte SHA-256 and EVM identity independently. Compare EVM identity with registry/deploy tooling.
5. Run producer gates:

   ```bash
   npm test
   npm run build
   npm run build:evm
   npm run test:evm
   git diff --check
   ```

6. Run schema validation and renderer/contract parity tests.
7. Build immutable protocol, render, and contract components. Never reuse an artifact ID.
8. Generate each `manifest.json` and `SHA256SUMS.txt` from files on disk.
9. Verify every checksum and manifest/file-list agreement from disk.
10. Build the umbrella release with immutable component IDs and manifest hashes.
11. Verify umbrella checksums and component compatibility.
12. Update only the requested channel pointer.
13. Promote candidate bytes to stable without rebuilding them.
14. Tag the stable source/release commit.
15. Give DEV the umbrella artifact ID, manifest SHA-256, source commit, tag, compatibility notes, and rollback pin.

The existing command builds the render component only:

```bash
npm run artifact:build -- --channel experimental
npm run artifact:build -- --channel candidate
npm run artifact:build -- --channel stable
```

Until the builder enforces clean candidate/stable policy and publishes the protocol, schema, ABI, and umbrella lanes, only `experimental` use is allowed without manual release qualification.

## Consumer Procedure

`inshell.art` must perform this sequence in tooling, not in browser runtime:

1. Fetch THOUGHT remote refs and tags.
2. Resolve the requested channel for discovery only.
3. Read the immutable manifest path and expected manifest SHA-256.
4. Hash the manifest before trusting paths inside it.
5. Reject malformed, duplicate, absolute, or parent-relative file paths.
6. Verify `SHA256SUMS.txt`, every manifest file, and exact file-list agreement.
7. Reject dirty-source candidate or stable releases.
8. Require the declared stable tag when consuming stable.
9. Verify exact spec bytes, UTF-8/BOM/LF rules, SHA-256, EVM ID, and EVM hash.
10. Verify protocol/schema IDs, renderer compatibility, fixture parity, ABI compatibility, and network metadata.
11. Write one consumer lock with umbrella/component IDs, manifest hashes, source commit, tag, and compatibility versions.
12. Vendor exact bytes without formatting, rewriting, newline conversion, or independent edits.
13. Generate frontend metadata only from verified inputs.
14. Run sync tooling in check mode and fail on vendored or generated drift.
15. Build and test the same-origin THOUGHT app.
16. Deploy to staging and verify runtime release identity and routes.
17. Promote the identical lock to production after operator review.

Production JavaScript must never fetch `latest.json` dynamically.

The consumer lock should be reviewable JSON, for example:

```json
{
  "umbrella_artifact_id": "<id>",
  "umbrella_manifest_sha256": "<hex>",
  "source_commit": "<40 hex>",
  "release_tag": "<tag>",
  "components": {
    "protocol": { "artifact_id": "<id>", "manifest_sha256": "<hex>" },
    "render": { "artifact_id": "<id>", "manifest_sha256": "<hex>" },
    "contract": { "artifact_id": "<id>", "manifest_sha256": "<hex>" }
  }
}
```

## CI Gates

Producer and consumer CI must fail on:

- manifest SHA-256 mismatch;
- bad or incomplete `SHA256SUMS.txt`;
- manifest/file-list disagreement or unsafe paths;
- dirty candidate/stable source;
- missing stable tag;
- changed `THOUGHT.v2.md` bytes;
- spec SHA-256 or EVM identity mismatch;
- schema ID/version mismatch;
- renderer/render-contract or fixture/sample mismatch;
- contract ABI/network-release incompatibility;
- stale consumer lock or manually edited vendored files;
- missing same-origin runtime routes;
- sealed Agent task missing the pinned V2 spec identity or exact spec context;
- provenance identifying a different V2 spec;
- reachable production V1 fallback unless explicitly approved as a historical archive.

## Runtime and Agent Requirements

The same umbrella lock must identify the assets used by the frontend preview, the sealed Agent task, provenance assembly, and contract calls.

The FE must serve the exact pinned spec from a stable same-origin route or include its exact bytes in the sealed task. A deep link may identify the task but must not become an independently edited spec transport.

The sealed task and provenance must agree on protocol version, spec name/version/ref, byte length, SHA-256, EVM spec ID/hash, renderer ID, and line limits. The contract remains authoritative for mint validation and Agent-line uniqueness.

## Rollout

1. Qualify a clean producer candidate.
2. Pin it in DEV staging with a generated consumer lock.
3. Verify detail, gallery, create, Agent-run, provenance, wallet, and mint flows.
4. Compare runtime release metadata with the lock.
5. Promote the exact candidate bytes to stable.
6. Tag the stable release commit.
7. Promote the identical consumer lock to production.
8. Have OPS monitor release identity, route availability, and freshness.

## Rollback

Rollback changes pins; it never changes immutable artifact bytes.

- Never edit an existing release directory.
- Never reuse an artifact ID for different bytes.
- Keep the previous verified consumer lock and deployment record.
- Restore the previous compatible umbrella pin in DEV, then production after review.
- Channel pointers may move independently; production remains locked.
- Do not roll the FE to a spec incompatible with registered onchain state.
- Record contract/spec compatibility and required network state in every umbrella manifest.

## Security

- Do not publish secrets, private RPC URLs, keys, mnemonics, signatures, or operator material.
- Hash raw bytes before parsing.
- Reject path traversal and unexpected files.
- Do not execute artifact code during integrity verification.
- Treat reference renderer source as reviewed code, not trusted metadata.
- Keep browser-consumed release metadata public and non-secret.
- Run `gitleaks detect --no-git --redact` when available before release commit.

## Current Migration

The current producer publishes only the render lane, and its builder records but does not reject dirty source. The current `inshell.art` sync pins only that visual artifact and the FE still contains an independently maintained `apps/thought/THOUGHT.md` / `THOUGHT_V1` path.

Migration order:

1. Add exact `specs/THOUGHT.v2.md` and `spec-identity.json` to a protocol artifact.
2. Publish the Agent input/result/provenance schemas with it.
3. Make candidate/stable producer builds reject dirty source.
4. Publish reviewed ABI and per-network release metadata.
5. Add an umbrella FE release that pins all components.
6. Extend `inshell.art` sync to verify the umbrella release and write one consumer lock.
7. Vendor and serve exact V2 spec bytes from the THOUGHT app.
8. Replace `THOUGHT_V1` Agent task identity with the pinned V2 identity.
9. Remove production use of independently maintained `apps/thought/THOUGHT.md`; retain V1 only as an unreachable historical archive when required.
10. Add CI proving the producer artifact, FE bundle, sealed task, provenance, and onchain registry identify the same V2 spec.

## Existing Documents

- This book is authoritative for publication, channels, integrity, pinning, consumption, rollout, and rollback.
- `THOUGHT_V2_FE_TIGHTENING_ARTIFACT.md` describes the visual renderer contract.
- `docs/agent/THOUGHT_AGENT_FLOW_V2.md` describes the Agent task/result flow.
- `docs/agent/IN_SHELL_ART_HANDOFF.md` describes current frontend integration requirements.
- `docs/ops/thought-signing-os-pack-book.md` describes signing and operator packaging.
- `scripts/build-thought-v2-artifacts.mjs` is the current render-only producer and must be hardened before candidate/stable use.

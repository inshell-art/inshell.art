# THOUGHT V2 64-Byte Binary Weave Implementation Report

Date: 2026-07-14

## Status

The local implementation of
`THOUGHT_V2_CONTRACT_64_BYTE_BINARY_WEAVE_REFACTOR_SPEC.md` is complete through
the required parity, security, build, size, gas, and measurement gates.

The EIP-170 blocker is resolved. After reviewing the exact measurements, the
operator approved the current mint-gas envelope on 2026-07-14. The enforced
complete-mint test ceiling is 825,000 gas, including the mock PATH call. The
measured excluding-PATH ceiling is 712,918 gas for worst-case valid Unicode.

No deployment, verification, registration, signature, PATH consumption, mint,
commit, push, tag, or candidate/stable artifact publication was performed.

## Discovery and Authority

- The active local V2 source had no verified V2 deployment record. Existing
  deployment evidence in this repository is the immutable V1 Sepolia archive.
- The previous V2 source artifact was not deployable under EIP-170: its clean
  `ThoughtNFT` runtime was 25,692 bytes.
- The approved architecture keeps validation, identity, PATH consumption, mint
  state, and binary-field derivation in `ThoughtNFT`, and moves pure SVG
  serialization into immutable `ThoughtRenderer`.
- `ThoughtNFT` verifies the renderer ID hash in its constructor. The renderer
  receives already-validated exact line bytes and the authoritative packed
  field and cannot alter mint identity or state.
- The only V2 mint entry point is `mint(MintThoughtInput)`. Tests verify that
  malformed input, invalid spec pairs, duplicate Agent identity, failed PATH
  authorization, and reentrancy all fail without reserving identity or supply.

## Authorities Replaced

- Both visible lines use the same strict 1..64 UTF-8 byte profile in Solidity
  and TypeScript.
- UTF-8 is shortest-form RFC 3629 scalar encoding. XML-invalid characters,
  controls, prohibited whitespace, frozen Unicode 17 default-ignorables, and
  noncharacters are rejected.
- Exact accepted bytes are preserved. Internal repeated U+0020 spaces are
  valid; outer spaces and all-space lines are invalid.
- Exact Agent line bytes define globally unique Agent identity. Prompt reuse is
  allowed; changing case or Unicode bytes produces a distinct Agent identity.
- The renderer ID is `inshell.thought.svg.v2.binary-weave-32`.
- Prompt and Agent streams cycle independently to 64 bytes, expand to 512 bits,
  and interleave into the deterministic 32x32 field.

## Exact Constants

```text
protocol:            inshell.thought.protocol.v2
work profile:        inshell.thought.work.v2
renderer:            inshell.thought.svg.v2.binary-weave-32
generation spec:     THOUGHT.v2.md
prompt range:        1..64 exact UTF-8 bytes
Agent range:         1..64 exact UTF-8 bytes
binary field:        32 x 32 bits, packed MSB-first into 128 bytes
prompt allocation:   even checkerboard cells, horizontal source indexing
Agent allocation:    odd checkerboard cells, vertical source indexing
```

The normative `A` / `B` packed field is:

```text
200220021001100175577557baabbaab200220021001100120022002100110012002200210011001200220021001100175577557baabbaab2002200210011001200220021001100175577557baabbaab200220021001100120022002100110012002200210011001200220021001100175577557baabbaab2002200210011001
```

## Changed Surfaces

- Contracts: `evm/src/ThoughtNFT.sol`, new `evm/src/ThoughtRenderer.sol`, deploy
  and signing-pack constructor wiring.
- Contract tests: V2 validator, identity, loom, renderer, rollback, differential,
  fuzz, size, and gas coverage in `evm/test/ThoughtNFT.t.sol`.
- TypeScript reference: validator, raw-byte validator, hashing, exact weave,
  renderer, fixtures, and parity tests under `src/thought-v2-*`.
- Protocol: V2 work/renderer authority, ABI, vectors, fixtures, manifest, and
  local current-release pointer under `protocol/`.
- Integration docs: README, EVM README, artifact-consumption book, and signing
  pack instructions.

The pre-existing dirty render-artifact pointer/builder changes were preserved
and were not rebuilt by this work.

## Compiler and Code Size

```text
solc:            0.8.28
optimizer:       enabled
optimizer runs:  200
viaIR:           enabled
EVM version:     prague
bytecode hash:   none
CBOR metadata:   disabled
```

| Contract/state | Runtime | Initcode | EIP-170 headroom | Deployment gas |
| --- | ---: | ---: | ---: | ---: |
| Regular ERC-721 baseline | 1,167 B | 2,069 B | 23,409 B | 312,278 |
| Clean pre-refactor `ThoughtNFT` | 25,692 B | 26,026 B | -1,116 B | 5,618,243 |
| Refactored `ThoughtNFT` | 18,214 B | 18,869 B | 6,362 B | 3,695,144 |
| New `ThoughtRenderer` | 8,462 B | 8,488 B | 16,114 B | 1,728,394 |
| Refactored V2 combined | - | - | - | 5,423,538 |

Both runtime contracts are below the approximate 22 KiB review target and the
24,576-byte EIP-170 limit. Combined deployment remains below 8,000,000 gas.

## Mint Gas

Measurements use fresh test state and `gasleft()` around the external
`ThoughtNFT.mint` call. The representative nested PATH `consumeUnit` trace is
73,878 gas. The isolated mock PATH call is 76,791 gas.

| Exact bytes per line | Complete mint, including PATH | Excluding traced PATH |
| ---: | ---: | ---: |
| 1 | 537,063 | 463,185 |
| 31 | 547,203 | 473,325 |
| 32 | 592,018 | 518,140 |
| 33 | 636,740 | 562,862 |
| 63 | 646,880 | 573,002 |
| 64 | 647,262 | 573,384 |
| 64-byte valid four-byte Unicode | 786,796 | 712,918 |

Additional measurements:

| Case | Gas | Response bytes |
| --- | ---: | ---: |
| Reject malformed raw UTF-8 | 3,505 | 0 |
| Build packed field, 1-byte lines | 111,224 | 128 B |
| Build packed field, 64-byte lines | 193,516 | 128 B |
| `svgOf`, short lines | 7,300,730 | 17,207 B |
| `tokenURI`, short lines | 11,189,621 | 33,005 B |

The view calls remain under their explicit 10M and 18M test budgets.

### Approved Gas Envelope

The 1-byte and 31-byte ASCII cases meet the original approximate 500,000-gas
planning target after excluding PATH. The 32-byte boundary and larger cases do
not. The dominant contributor is exact dynamic-string storage: crossing 31
bytes moves each line from Solidity short-string storage to separate data
slots. Worst-case Unicode adds the bounded scalar decoder and frozen-range
checks.

The measured envelope is accepted without changing line storage, provenance,
validation, SVG bytes, or artwork. Tests now enforce these approved ceilings:

```text
complete mint including mock PATH: <= 825,000 gas
combined ThoughtNFT + ThoughtRenderer deployment: <= 8,000,000 gas
```

The current maximum complete mint is 786,796 gas and the current combined
deployment is 5,423,538 gas.

## Conformance and Security Evidence

- Raw malformed ABI string bytes are rejected onchain before PATH.
- Accepted multilingual cases cover Arabic, Arabic vowel marks, Thai combining
  marks, CJK, flags, precomposed and decomposed forms, and four-byte emoji.
- Frozen default-ignorable and noncharacter range boundaries are exhaustively
  covered; deterministic raw-byte fuzzing cannot panic either implementation.
- Solidity matches an independent loom reference over 256 fuzz runs.
- TypeScript tests cover cell ownership, horizontal and vertical source
  indexing, MSB-first packing, round trips, field collisions, exact fixture
  hashes, SVG bytes, and raw UTF-8 rejection.
- Exact Agent duplicates fail before PATH. Prompt duplicates remain valid.
- PATH failure and reentrancy preserve supply, records, identity availability,
  and PATH state atomically.
- SVG/XML and metadata/JSON escaping change serialization only, never identity
  bytes.
- V1 source and fixtures were not edited. All 51 `ThoughtNFTV1` tests and all
  five `ThoughtPreviewerV1` tests pass.

## Generated Protocol State

The local protocol build verifies 38 normative artifacts:

```text
protocolReleaseKeccak256:
0x75568828198b0c34b4af4d4c1d37afb14aae631394eb983667bc323ed4a1f753
```

This is local build evidence only. It is not an approved immutable release hash
and was not published as a candidate or stable release.

## Verification Results

```text
npm test                 47 passed
npm run build            passed
npm run build:evm        passed
npm run test:evm         109 passed
  active V2              53 passed
  archived V1            56 passed
npm run protocol:build   38 artifacts generated
npm run protocol:check   38 artifacts verified
```

Final hygiene commands:

```bash
cd evm && forge fmt --check src/ThoughtNFT.sol src/ThoughtRenderer.sol test/ThoughtNFT.t.sol
git diff --check
```

## Completion State

The local semantic implementation, parity work, evidence, and approved gas
gates are complete. No external action is authorized by the source
specification.

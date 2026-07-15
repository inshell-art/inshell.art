# THOUGHT V2 Protocol Release Notification

Audience: downstream consumers, especially `inshell.art`.

## Immutable release

- Git tag: `thought-v2-protocol-refinement-20260713`
- Protocol ID: `inshell.thought.protocol.v2`
- Discovery pointer: `protocol/CURRENT.json`
- Manifest: `protocol/releases/v2/release-manifest.json`
- Manifest byte length: `10062`
- Manifest SHA-256: `73e3576f44bc0728ba228a2bd453c3273706e1870f232c27322e75e18535539c`
- Manifest Keccak-256 / `protocolReleaseKeccak256`: `0x7f057d000e1eee598d037c5f34fa44c2d1e41418836ad4389d8f8bb76156e6f7`
- Normative artifact count: `29`

The tag is the immutable release selector. `protocol/CURRENT.json` is discovery-only;
production consumers must pin the tag or commit and the manifest hash above.

This release contains source and integration artifacts. It does not claim a V2 Sepolia
or mainnet deployment address.

## Consumer-impacting changes

1. Replace copied protocol constants with verified files from `protocol/releases/v2/`.
2. Consume the generated ABI at `protocol/releases/v2/contract/abi/ThoughtNFT.json`.
3. Construct `ThoughtNFT` with exactly three arguments:

   ```solidity
   ThoughtNFT(pathNft, thoughtSpecRegistry, protocolReleaseKeccak256)
   ```

4. Supply `thoughtSpecId` and `thoughtSpecHash` per mint. The pair must be registered,
   but the collection does not pin one spec version; multiple registered versions may
   coexist and remain mintable.
5. Use the formal Agent flow and identifiers in `protocol/integrations/agent-run/v2/`.
   The optional declaration schema is `thought.agent-declaration.v1`; the removed
   `thought.agent-fragment.v1` schema must not be used.
6. Preserve `promptLine` and `agentLine` exact UTF-8 bytes. Do not trim, normalize,
   uppercase, repair, clip, or extract alternate text.
7. Enforce the contract limits before wallet intent:
   - prompt: 320 UTF-8 bytes and 433 display units;
   - Agent: 180 UTF-8 bytes and 162 display units.
8. Treat exact Agent-line bytes as globally unique. Use `agentIdentityHash` for advisory
   duplicate checks; the contract remains authoritative.
9. Use renderer ID `inshell.thought.svg.v2.binary-interleave-32` and verify TypeScript
   prediction against the packaged fixtures. After mint, use contract `svgOf` or
   `tokenURI` output as canonical.
10. Build provenance from the packaged schema and algorithm-labelled anchors. Keep
    Agent execution claims optional and explicit; direct permissionless minting remains
    supported.

## Verification

From a checkout of the release tag:

```bash
npm ci
npm test
npm run build
npm run test:evm
npm run protocol:check
```

The protocol checker must report:

```text
verified 29 normative artifacts (0x7f057d000e1eee598d037c5f34fa44c2d1e41418836ad4389d8f8bb76156e6f7)
```

Downstream must independently verify `CURRENT.json`, the release manifest, and every
consumed artifact's byte length, SHA-256, and Keccak-256 before updating its lock.

## Rollout order for inshell.art

1. Keep the current production artifact lock available as the rollback pin.
2. Fetch this tag and verify all hashes before copying or generating consumer files.
3. Update the consumer lock with tag, commit, manifest hash, and consumed artifact hashes.
4. Update ABI and constructor/deployment tooling before enabling V2 mint actions.
5. Update Agent-run/result/declaration validation and provenance assembly.
6. Update renderer fixtures and run exact parity tests.
7. Verify direct mint, Agent-run mint, duplicate Agent-line rejection, PATH atomicity,
   retry/idempotency, wallet rejection, and official post-mint rendering in staging.
8. Promote only after the consumer worktree is clean and the lock is immutable.

## Rollback

Rollback is a consumer lock change, not a mutation of this release. Restore the exact
previous production tag/commit and manifest hash, regenerate consumer artifacts from that
pin, run its verification suite, and redeploy the consumer. Do not point production at a
moving `latest` or `CURRENT.json` URL.

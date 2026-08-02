# THOUGHT V2 external URL integration-preview handoff

Date: 2026-08-01

From: THOUGHT Contract owner

To: `inshell.art` / Inshell THOUGHT App owner

Target artifact:
`thought-v2-noncanonical-integration-preview-20260801-r9`

Status: downstream integration preview only; noncanonical, non-production,
non-registrable, and not deployment-authorized

## Contract delta

Every current-V2 `tokenURI()` metadata object now contains exactly one
conventional top-level field:

```json
"external_url": "https://inshell.art/thought/<tokenId>"
```

The exact production base is fixed in reviewed Contract code as:

```text
https://inshell.art/thought/
```

The token ID is rendered as canonical unsigned base-10 without leading zeroes.
There is no trailing slash, query string, fragment, alternate subdomain,
localhost origin, LAN origin, preview origin, or caller-controlled base.

The field appears in canonical metadata order after `image` and before
`background_color`. It is not duplicated under `properties` or `thought`.

## Ownership boundary

The Contract renderer owns the exact metadata bytes and derives
`external_url` from `tokenId`. The App must not post-process decoded
metadata, replace this field, or synthesize it as if it came from
`tokenURI()`.

The App may use the returned value as the canonical detail-page link.

## Unchanged semantics

This delta does not change:

- the `ThoughtNFTV2.mint` ABI or typed mint fields;
- prompt/Agent validation or ordered-pair uniqueness;
- conversation identity or work hash;
- SVG artwork bytes;
- Agent/Model records or traits;
- provenance bytes, storage, or commitment;
- Creation Attestation claims, verification, or status;
- selected-spec or protocol-registry behavior;
- PATH authorization, unit consumption, atomicity, or serial storage.

`external_url` is presentation metadata only and is not signed, hashed into
work identity, supplied in mint calldata, or parsed from provenance.

## Artifact contents

The integration preview includes:

- updated `ThoughtRendererV2` ABI and bytecode;
- updated split `ThoughtRendererV2Split` and `ThoughtSvgRendererV2`
  artifacts;
- updated metadata profile requiring `external_url`;
- exact Anvil tokenURI fixtures covering token IDs 1 and 42 and both
  Creation Attestation states;
- machine-readable monolithic/split exact-byte parity evidence;
- Solidity coverage for token IDs 1, 42, and `uint256.max`;
- the sealed Inshell Mono 76 dependency and all existing V2 protocol inputs.

Use `artifacts/thought-v2-integration-preview/experimental.json` only for
discovery. Pin the exact artifact ID and manifest SHA-256 from the publication
handoff before integrating.

## Required downstream work

1. Sync and verify the exact r9 artifact manifest and checksums.
2. Replace the r8 renderer/contract artifact lock; r8 is the final
   grandfathered preview without `external_url`.
3. Redeploy disposable Anvil from the r9 compiled artifacts.
4. Decode `tokenURI()` without mutation.
5. Require
   `metadata.external_url === "https://inshell.art/thought/" + tokenId`.
6. Require `external_url` in the metadata profile's
   `marketplaceRequired` list.
7. Render the returned URL as the detail-page link if desired.
8. Keep all renderer/UI reconstruction logic disabled; display the returned
   embedded SVG exactly.

## Downstream rejection rules

Reject the artifact or runtime metadata if:

- `external_url` is absent, nested, duplicated, or not a string;
- the host is not exactly `inshell.art`;
- the scheme is not HTTPS;
- the route is not exactly `/thought/<tokenId>`;
- the token ID has leading zeroes;
- a trailing slash, query, or fragment is present;
- the URL uses localhost, a LAN IP, GitHub Pages, a preview host, or a
  deprecated THOUGHT/gallery subdomain;
- decoded fixture metadata differs from exact `tokenURI()` bytes.

## Safety label

The r9 package remains an explicitly noncanonical integration preview. It
does not authorize Sepolia/mainnet deployment, production registration,
production signer custody, or a stable consumer lock.

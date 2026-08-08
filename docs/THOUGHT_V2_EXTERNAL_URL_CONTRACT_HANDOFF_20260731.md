# THOUGHT V2 Contract Handoff — Canonical `external_url`

Date: 2026-07-31

From: Inshell THOUGHT App owner

To: THOUGHT Contract owner

Status: decisioned portability requirement; next Contract integration-preview
release requested

## Decision

Every THOUGHT V2 `tokenURI()` metadata object must include the conventional
top-level ERC-721 metadata field:

```json
"external_url": "https://inshell.art/thought/<tokenId>"
```

For token `42`, the exact value is:

```text
https://inshell.art/thought/42
```

This field gives marketplaces, wallets, indexers, and independent metadata
consumers a stable route to the canonical THOUGHT detail surface, where the
creation provenance and verification material can be inspected.

## Exact production rules

- key: `external_url` in lowercase with the underscore;
- scheme and host: `https://inshell.art`;
- route: `/thought/<tokenId>`;
- token ID: canonical unsigned base-10 with no leading zeroes, except token
  zero if a future collection permits it;
- no trailing slash after the token ID;
- no query string or fragment;
- no alternate THOUGHT, gallery, preview, Pages, localhost, or LAN origin in a
  production artifact;
- the value is metadata presentation only and is not a work-identity input.

The App's canonical product origin is same-origin. Do not emit
`thought.inshell.art`, `gallery.inshell.art`, or another compatibility host.

## Contract ownership

The Contract/renderer owns canonical `tokenURI()` bytes. The App must not
post-process the decoded metadata or synthesize `external_url` as if it were
part of the token metadata.

Preferred implementation:

1. render `external_url` from the token ID inside both metadata renderer
   implementations;
2. keep the production base immutable in the reviewed Contract release;
3. include the exact field in monolithic/split parity vectors and decoded
   tokenURI fixtures.

If the Contract owner makes the base deployment-configurable, it must be an
immutable constructor/deployment value included in the release and deployment
records. It must never be caller-controlled mint calldata. Production
deployment checks must reject every base other than
`https://inshell.art/thought/`.

Disposable Anvil fixtures may still emit the production canonical URL. Their
release remains explicitly noncanonical and non-production; a local token is
not thereby represented as a production token.

## Metadata profile delta

Keep the V2 metadata family and add `external_url` to
`marketplaceRequired`:

```json
{
  "id": "inshell.thought.metadata.v2.terminal-chat",
  "marketplaceRequired": [
    "name",
    "description",
    "image",
    "external_url",
    "background_color",
    "attributes"
  ]
}
```

Do not put `external_url` under `properties` or `thought`. Those are custom
technical surfaces; `external_url` is a conventional top-level metadata field.

## Required validation

The next Contract integration-preview release must cover:

- exact decoded value for token IDs `1`, `42`, and a large `uint256` value;
- exact monolithic/split tokenURI parity;
- valid JSON escaping and ordering in both renderer paths;
- presence in the metadata profile's `marketplaceRequired` list;
- no localhost, LAN IP, Pages host, preview host, or deprecated subdomain in
  production-ready artifacts;
- unchanged artwork, work identity, uniqueness, provenance commitment,
  Creation Attestation, and `$PATH` behavior.

## App integration gate

The App vendors the current r8 release as the last explicitly grandfathered
artifact without `external_url`. The App sync check rejects every later
artifact unless:

1. its V2 metadata profile requires `external_url`; and
2. every supplied tokenURI fixture emits the exact canonical URL for its token
   ID.

## Delivery request

Publish the next explicitly noncanonical integration-preview artifact with:

- updated renderer bytecode;
- updated metadata profile;
- updated decoded tokenURI fixtures;
- monolithic/split parity results;
- new immutable manifest SHA-256, tag, and publication commit;
- a concise downstream delta confirming that no unrelated semantics changed.

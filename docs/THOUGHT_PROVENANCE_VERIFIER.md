# THOUGHT chain-first verifier

The verifier reads one token directly from an EVM RPC. It takes an expected
chain ID, a THOUGHT contract address, and a token ID. It does not use the
Inshell gallery or detail-page API as evidence.

```sh
pnpm verify:thought -- \
  --rpc-url http://127.0.0.1:8546 \
  --chain-id 31337 \
  --contract 0x... \
  --token-id 1
```

`THOUGHT_RPC_URL` may replace `--rpc-url`. The verifier never writes or prints
the RPC URL.

## What it verifies

- the RPC reports the requested chain ID;
- contract bytecode exists at the requested address;
- `tokenURI()` is decoded directly from the Contract;
- `metadata.thought` conforms to the locked local V2 namespace schema;
- namespace work, record, mint, protocol, renderer, provenance, and Creation
  Attestation fields match typed Contract getters;
- `external_url` is the canonical `https://inshell.art/thought/<tokenId>` URL;
- exact provenance bytes hash to `provenanceHashOf(tokenId)`;
- the record is canonical RFC 8785 JCS and conforms to the locked
  `inshell.thought.provenance.v2` profile;
- prompt, Agent response, Agent, Model, minter, work, protocol release,
  manifest, selected specification, chain, and collection match typed
  on-chain state;
- the selected specification bytes are fetched from the on-chain THOUGHT spec
  registry and match the provenance commitment.

The report separates two results:

- `conforming`: chain state, metadata namespace, provenance, renderer binding,
  selected spec, and attestation state agree;
- `portable`: `conforming` is true and the conventional metadata also uses the
  exact portable `external_url` and five-trait marketplace profile.

This separation is deliberate. The historical r10 integration preview is
conforming but not portable because its metadata still includes the redundant
`Pair Bytes`, `Prompt Length`, and `Agent Length` traits. The canonical portable
Contract release emits exactly `Agent`, `Model`, `Creation Attestation`,
`Prompt Bytes`, and `Agent Bytes`, so both attested and unattested mints pass
the local portability gate.

The report also distinguishes `contract-verified` Creation Attestation from
the permitted `unattested` mint path. `contract-verified` means the THOUGHT
Contract accepted a valid proof when it minted the token. It does not mean the
Agent or model provider independently authenticated the recorded labels.

## Current release status

The verifier is pinned to `thought-provenance-v2-20260731-r1` and
`thought-metadata-namespace-v2-20260731-r1`. Their exact schema and
specification bytes are packaged at the immutable same-origin release paths:

```text
/protocol/releases/thought-provenance-v2-20260731-r1/
/protocol/releases/thought-metadata-namespace-v2-20260731-r1/
```

The Contract consumer pin is the immutable production-consumable artifact
`thought-v2-canonical-portable-release-20260801-r1`. The App-owned provenance
and metadata-namespace packages remain unpublished until their exact release
paths are deployed and verified on preview, then production. The verifier is
therefore locally complete but is not yet a stable hosted public verifier.

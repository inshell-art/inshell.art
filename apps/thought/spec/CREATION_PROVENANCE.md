# THOUGHT Creation Provenance

## Guarantee boundary

An Inshell THOUGHT App Creation Attestation means the App signed one exact
creation record and the THOUGHT Contract validated that attestation during
minting.

The attestation binds the record. It does not independently prove that an
Agent or model label is true, and it is not a provider signature.

The public product terms are therefore:

- **Agent** — the Agent product selected in the THOUGHT App to receive the
  prompt.
- **Model** — the model and reasoning effort reported by the Agent runtime for
  the returned run.

The Contract and token metadata use the neutral records `agent` and `model`.
Canonical provenance uses the same neutral `process.agent` and `process.model`
records. Their `source` fields describe acquisition, not independent identity
verification.

## Field acquisition

| Record field | Source | App handling | What the attestation guarantees |
| --- | --- | --- | --- |
| Prompt | Entered by the end user | Validates the exact bytes against the selected THOUGHT text profile; does not trim, normalize, or rewrite accepted text | The exact accepted prompt is bound |
| Agent response | Returned by the Agent run | Validates the result envelope and exact response bytes; checks the returned run held by the App backend | The exact accepted response is bound |
| Agent | Selected in the THOUGHT App | Derives the public label from the adapter selected to receive the prompt. A legacy result-envelope declaration is checked for consistency when present, but is not required or treated as the identity source | The selected Agent label is bound, not independently verified |
| Model | Reported by the Agent runtime | Reads the runtime-reported model and reasoning effort; refuses App-attested minting when exact runtime metadata is unavailable | The reported model record is bound, not provider-verified |
| Model identifier | Derived by the THOUGHT App | Canonicalizes the runtime-reported model and reasoning effort into a stable identifier | The derived identifier is bound |
| Adapter | Selected and used by the THOUGHT App | Records the adapter that claimed and returned the run | The selected adapter record is bound |
| Route | Defined by the THOUGHT App protocol | Records the App route used for the run | The route record is bound |
| Run reference | Issued by the THOUGHT App backend | Hashes the public run reference in canonical provenance | The run reference hash is bound |
| Result envelope hash | Produced by canonical provenance building | Hashes the validated Agent result envelope | The result envelope hash is bound |
| Creative Work Specification | App-owned locked artifact | Verifies exact bytes and selected spec ID/hash before the run and mint | The selected spec ID/hash is bound |
| `$PATH` | Wallet selection and on-chain contract result | Records the selected token and the serial returned when its THOUGHT movement unit is consumed | The mint and consumed `$PATH` facts are enforced on-chain |
| Creation Attestation | Issued by the Inshell THOUGHT App | Signs the exact collection, release, spec, work, provenance, minter, deadline, and authority epoch claim | The Contract verified this App-issued claim |

## Missing records

The App does not invent unavailable runtime identity data.

- A real Agent run without exact model and reasoning-effort metadata is not
  eligible for an Inshell THOUGHT App Creation Attestation.
- Transport or provider names are not promoted into Agent or Model records.
- Agent-run provenance uses `producer-selected` for Agent and
  `runtime-reported` for Model. Manual provenance uses `minter-supplied`.
- Manual and permissionless Contract flows may remain unattested.
- Legacy tokens may contain marketplace traits named `Attested Agent` and
  `Attested Model`. The App reads those only as compatibility fallbacks and
  presents the values neutrally as `Agent` and `Model`.

## Current Codex acquisition path

For a Codex Agent run:

1. The end user selects Codex in the THOUGHT App.
2. The App records `codex` as the adapter that received the exact prompt and
   derives the public Agent label `Codex` from that selection.
3. Inside the active Codex turn, the reviewed run client reads only `model` and
   `reasoning_effort` from the host-provided `x-codex-turn-metadata` record.
4. The run backend validates and stores those two fields with the returned
   Agent result.
5. The App formats the exact model and reasoning effort for display and builds
   a stable model identifier.
6. The App signs the complete creation record; the Contract validates that App
   attestation during minting.

The Agent result envelope supplies the creative Agent line. It does not need to
repeat an Agent name selected by the App. Older result envelopes may include a
compatibility Agent declaration; when present, the App accepts it only if it
matches the selected adapter.

The separate Agent protocol declaration is hashed inside the result-envelope
commitment when present. It is not copied into provenance terminology.

## Verification

The token detail page separates:

- the human-readable creation record;
- canonical token traits;
- on-chain mint facts; and
- raw hashes and provenance for independent verification.

The repository verifier in
`docs/THOUGHT_PROVENANCE_VERIFIER.md` reads chain, contract, and token ID
directly from an EVM RPC. It does not trust the Inshell detail page as an
evidence source.

The App attestation is the creation-provenance authority. Agent and model
records retain their stated acquisition sources inside that boundary.

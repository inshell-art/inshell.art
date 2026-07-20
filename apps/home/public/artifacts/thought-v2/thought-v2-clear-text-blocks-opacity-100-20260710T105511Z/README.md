# THOUGHT V2 Artifact Bundle

Artifact ID: `thought-v2-clear-text-blocks-opacity-100-20260710T105511Z`
Channel: `experimental`
Source branch: `codex/thought-v2-clear-text-blocks`

This bundle is a repo-published bridge artifact for FE and downstream agents.

## Files

- `manifest.json`: authoritative machine-readable manifest.
- `handoff.md`: human handoff for FE agents.
- `render-contract.json`: machine-readable geometry, font, and carousel contract.
- `fixtures.json`: default text and prepared prompt/agent corpuses.
- `reference/`: exact TypeScript renderer and fixture source.
- `samples/default.svg`: default generated artifact.
- `samples/works/*.svg`: generated fixture SVGs.
- `samples/index.json`: sample SVG index.
- `SHA256SUMS.txt`: sha256 for every bundle file except itself.

Consumers should resolve a channel file such as `artifacts/thought-v2/latest.json`, read `manifest_path`, fetch that manifest, and verify hashes before use.

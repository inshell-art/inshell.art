# Public docs source

Before editing any file in this directory for the public documentation system, read and follow `docs/AGENTS.md` from the repository root in full.

In particular:

- `docs.ts` is the canonical structured source for human and Agent-readable public articles.
- `DOCS_AUTHORITY_MAP` must remain aligned with every authored block.
- `docs-source-registry.ts` must include every knowledge-bearing input.
- generated files under `apps/home/public/docs/` must never be hand-edited.
- every registered code, release, deployment, or publication change requires a docs-impact decision; do not clear drift by regenerating blindly.
- run `pnpm docs:generate`, review the generated output, then run `pnpm docs:check`.

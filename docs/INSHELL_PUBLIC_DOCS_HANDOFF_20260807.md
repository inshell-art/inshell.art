# Inshell public docs handoff — 2026-08-07

## Objective

Improve the public Inshell `/docs` experience after studying the full QQL documentation site at <https://qql.art/docs>. Keep the work confined to Inshell's public documentation surface and its directly required content, generator, styles, and tests. Do not change PATH, THOUGHT, Pulse, contracts, deployment, or another repository as part of this handoff.

## Current branch and worktree warning

- Current branch: `codex/inshell-docs-richness`
- Nothing from this docs effort has been committed, pushed, or deployed.
- The branch was created **after** the docs work had started and from an already-dirty worktree based on `codex/path-local-gallery`.
- Many unrelated modified and untracked files are present. They belong to other work. Do not run broad staging, reset, checkout, cleanup, or revert commands.
- Inspect and stage only explicitly reviewed docs-related hunks. In particular, `apps/home/src/main.css`, `apps/home/tests/App.test.tsx`, `package.json`, and `apps/home/package.json` may contain unrelated changes alongside docs work.

## Directory distinction

The root `docs/` directory contains internal notes and handoffs. It is **not** currently the source directory for the public `/docs` website.

The public docs system currently lives in:

- `apps/home/src/content/docs.ts` — canonical structured public-docs content
- `apps/home/src/components/DocsPage.tsx` — human-readable `/docs` renderer
- `apps/home/src/main.css` — docs layout and visual rules mixed into the Home stylesheet
- `scripts/generate-agent-docs.ts` — Markdown and JSON generator
- `apps/home/public/docs/` — generated public Markdown and agent-readable output
- `apps/home/tests/App.test.tsx` — `/docs` route assertions
- root and Home `package.json` files — `docs:generate`, `docs:check`, and build integration

Do not hand-edit files under `apps/home/public/docs/`. Edit `apps/home/src/content/docs.ts`, then regenerate.

## QQL research summary

The complete QQL docs crawl covered 19 pages:

- 29,455 words
- 549 images
- 188 headings
- 178 links
- 11 pages with at least 1,000 words

The useful patterns adopted were layered entry points, beginner-to-advanced grouping, persistent navigation, article-level tables of contents, visual process explanations, and long-form context. QQL's image density, repetition, and occasional copy issues were deliberately not copied.

## Public docs content now present

The structured corpus currently contains:

- 4 navigation groups
- 12 topics
- 48 article subsections
- 10 process figures
- 6 declared authority types
- approximately 7,065 generated words

Current topic set:

1. Inshell
2. Agent Art
3. Movements
4. THOUGHT
5. PATH
6. Pulse
7. Contracts
8. Artwork, Metadata, and Chain
9. Verification
10. Wallet and Local Data
11. Source and Release Boundaries
12. Design Principles

Generated public output currently contains 15 files, including per-topic Markdown, `index.md`, `agent-index.json`, and `agent-index.schema.json`.

## UI and interaction decisions

### Removed

- Removed the entire “four ways in” guide/card section.
- Removed the thin `1px` frame around the Agent prompt field.
- Removed framed cards, panel backgrounds, padding, and fixed minimum heights from process figures.

### Left documentation menu

The four group labels (`start here`, `works and participation`, `records and verification`, and `context`) now:

- match menu-link size: `14px`
- match menu-link weight: `400`
- use the existing `--canonical-green` token, which resolves to `#006100`

### Process figures

All ten figures now use an open typographic flow:

- primary titles: `24–30px`
- step markers: `10px`, canonical green
- descriptions: `11px`
- desktop connectors: green `→`
- mobile connectors: green `↓`
- four- and five-step flows remain horizontal on desktop
- the six-step flow renders as balanced `3 + 3` desktop rows
- mobile flows become one vertical sequence
- camel-case contract names receive safe `<wbr>` opportunities, e.g. `PathPulseAdapter`

The current five-step “From token identity to interpretation” figure has a measured minimum `18px` title gap at 1440px. A collision audit across all ten figures reports zero title collisions and no horizontal document overflow.

### Navigation and reading behavior

- Persistent grouped sidebar on desktop; two-column grouped menu on mobile.
- Hash navigation tracks the active topic.
- Each article can expose an “in this article” table of contents.
- Structured subsections support paragraphs, points, ordered steps, notes, links, and process sequences.
- The Agent prompt remains copyable and points at `/docs/agent-index.json` on the current origin.

## Files in the docs working set

Review these files/hunks as one public-docs change set:

- `apps/home/src/content/docs.ts`
- `apps/home/src/components/DocsPage.tsx`
- docs-specific rules and tokens in `apps/home/src/main.css`
- docs-route assertions in `apps/home/tests/App.test.tsx`
- `scripts/generate-agent-docs.ts`
- `apps/home/public/docs/**`
- docs-related script/build hooks in `package.json` and `apps/home/package.json`

Do not assume other dirty files are part of this work.

## Verification already completed

The following passed during this work:

- `pnpm docs:check`
- focused ESLint for `DocsPage.tsx`
- `pnpm --filter @inshell/home test -- --runTestsByPath tests/App.test.tsx`
  - 49 tests passed
  - existing React `act(...)` console warnings remain in unrelated Home-gallery behavior
- `pnpm --filter @inshell/home build`
- `pnpm pub-boundary:check`
  - owner `PUB`
  - 2 exact reserved paths
  - 1 reserved prefix
  - 1,090 checked paths
- `git diff --check` for the docs files

Browser-rendered desktop and mobile checks covered:

- guide section count: `0`
- 4 menu groups
- 12 topics
- 10 process figures
- prompt border widths: `0px` on all sides
- no horizontal overflow
- six-step figure: desktop rows `[3, 3]`, mobile rows `[1, 1, 1, 1, 1, 1]`
- all figure title collisions: `0`

A broad TypeScript no-emit run was attempted earlier and failed on pre-existing cross-package `TS6307`/project-file issues and other unrelated errors. None of the reported errors referenced the docs files. Do not claim the repository-wide type check passes without rerunning and resolving that separate baseline.

## Local inspection

The Home Vite server has been used at:

<http://127.0.0.1:5173/docs>

Required server command:

```sh
pnpm dev:home
```

It binds to `127.0.0.1:5173` with `--strictPort`. Follow the repository rule: if port 5173 is occupied, identify and stop the existing process before starting another server.

## Recommended next-agent sequence

1. Read this handoff and `AGENTS.md` before touching files.
2. Confirm the branch is `codex/inshell-docs-richness` and inspect the dirty worktree.
3. Review the live `/docs` page at desktop and mobile widths, including long contract-name figures.
4. Make content or visual tweaks only within the public-docs working set above.
5. Run `pnpm docs:generate` after any content/schema/generator change.
6. Run `pnpm docs:check`, focused ESLint, the 49-test App suite, Home build, PUB boundary check, and browser-rendered QA.
7. Manually inspect exact diffs before staging. Never use broad staging in this worktree.
8. If preparing preview, follow the repository staging-first deployment discipline. Do not promote or merge to `main` without operator approval.

## Open architectural decision

The public documentation system is not self-contained in the root `docs/` directory. The project owner may want a later reorganization that makes the public docs source and generator ownership more obvious. Do not perform that move implicitly: it would affect build paths, imports, output generation, and ownership boundaries, so obtain a direct decision first.

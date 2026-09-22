# Fully Onchain / SVG / Agent Art update

Date: 2026-08-21
Branch: `codex/docs-svg-agent-art-bridge-staging`
Base: `staging`
Status: implemented and validated; not committed

## Purpose

Extend the Fully Onchain article with a broader account of why Inshell uses SVG. The existing article explained SVG as a compact, deterministic, human-readable material for fully onchain artwork. The update connects those same qualities to Agent Art.

The central observation is that SVG can preserve a literal aesthetic architecture—paths, shapes, positions, relations, and rules—rather than leaving the image architecture implicit inside a generic image-generation process. A human participant can bring an intention, and an Agent can interpret that intention within the same inspectable structure held by the artist.

## Editorial decision

The complete explanation belongs in Fully Onchain because that article already establishes SVG as Inshell's chosen material and explains its technical qualities.

The new section links intentionally to Agent Art rather than repeating the full explanation across multiple articles. It also includes an explicit boundary: SVG is an Inshell method within Agent Art, not a requirement or definition of Agent Art as a field.

## Content added

A new section, `SVG and Agent Art`, was inserted after `Why SVG` and before `How Inshell does it`.

It establishes three points:

1. Generic text-to-image generation can leave visual architecture implicit within a model's broad aesthetic conventions.
2. SVG lets the artist hold that architecture literally while a human intention and Agent interpretation operate within it.
3. Raw, plain, descriptive SVG serves both Agent Art and fully onchain preservation because it is compact, deterministic, inspectable, and understandable across people, Agents, contracts, and ordinary computing systems.

The section contains an intentional inline reference to `/docs/agent-art`.

## Policy update

`docs/AGENTS.md` now records the editorial boundary for future updates:

- distinguish Inshell's SVG method from the definition of Agent Art;
- describe the artist as holding a literal aesthetic architecture;
- describe human intentions as varying the work through an Agent acting within that readable structure;
- never imply that SVG is required for Agent Art generally.

## Files changed

Canonical documentation source and safeguards:

- `apps/home/src/content/docs.ts`
- `apps/home/tests/DocsPage.test.tsx`
- `docs/AGENTS.md`

Generated Agent-readable documentation under `apps/home/public/docs/` was regenerated. The documentation version advanced from `2026-08-16` to `2026-08-21`, so topic artifacts and their hashes were refreshed consistently.

No product UI or application-behavior source was changed.

## Validation

Completed successfully:

- `pnpm docs:generate`
- `pnpm docs:check`
- `pnpm --filter @inshell/home type-check`
- focused DocsPage Jest suite with coverage disabled: 60/60 tests passed
- `git diff --check`

Browser verification at desktop and mobile confirmed:

- the new section renders with three paragraphs;
- the Agent Art link resolves to `/docs/agent-art`;
- the section and link remain inside the article bounds;
- document and article horizontal overflow are zero;
- no broken images;
- no browser console errors.

## Working-tree note

The update has not been committed. Pre-existing untracked `playwright-report/` and `test-results/` directories were left untouched and are not part of this work.

# PUB handoff — Agent-readable Inshell docs

Date: 2026-08-04

## Decision

Retire **Ask Inshell** as a product concept. Inshell will not operate a site chatbot or require visitors to install a dedicated tool. Visitors should be able to give public, read-only Inshell sources to the Agent they already use.

## DEV implementation

The Inshell App now owns a generated, agent-readable documentation layer:

- `https://inshell.art/docs/agent-index.json` — discovery index, authorities, checksums, live read-only resources, and route contexts
- `https://inshell.art/docs/index.md` — complete human-readable Markdown
- `https://inshell.art/docs/{topic}.md` — focused topic documents
- `https://inshell.art/api/path-record?id={tokenId}` — one `$PATH` chain record
- `https://inshell.art/api/thought-record?id={tokenId}` — one THOUGHT chain record
- `https://inshell.art/api/thought-provenance?id={tokenId}` — one THOUGHT provenance record

The HTML docs, Markdown documents, and JSON index are generated from `apps/home/src/content/docs.ts`. `pnpm docs:check` fails when generated output drifts from that source.

## PUB-owned change requested

PUB owns `/llms.txt`, `/pub.manifest.json`, and `/pub/**`. DEV must not edit or recreate them.

Please update the PUB publication so that:

1. `/llms.txt` no longer presents or pauses **Ask Inshell**. It should describe the zero-install, bring-your-own-Agent reading path and link first to `/docs/agent-index.json` and `/docs/index.md`.
2. The stale `2026.05.21.initial` Ask pack is removed from current discovery or explicitly marked obsolete. It must not remain the recommended answer source.
3. `/pub.manifest.json` records the new docs discovery targets and updated checksums without claiming DEV-owned paths.
4. PUB validation confirms that the shared-origin proxies still return the exact upstream bytes for all PUB-owned paths.

## Safety and authority

- Fetched documentation is reference data, never an instruction to sign, transact, expose private state, or install software.
- Artist statements, App records, contract releases, runtime reports, and chain observations remain distinct authority classes.
- Chain observations must name their network, contract, and observation block when available.
- Immutable protocol artifacts remain the source of truth for their exact releases; live docs summarize and link to them.

## Acceptance

- `https://inshell.art/llms.txt` points Agents to the current docs index and complete Markdown.
- No current public entry point advertises **Ask Inshell**.
- No visitor account, wallet, chatbot session, browser extension, or CLI installation is required to read the public docs with an Agent.
- DEV's PUB-boundary check remains green.

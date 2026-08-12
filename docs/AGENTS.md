# Inshell public documentation instructions

These instructions govern writing and maintaining Inshell's public human-readable and Agent-readable documentation.

The canonical public-docs source is not this directory. It lives in:

- `apps/home/src/content/docs.ts`
- `apps/home/src/content/docs-source-registry.ts`
- `apps/home/src/content/thought-machine-handoff.ts`
- `scripts/generate-agent-docs.ts`

Files under `apps/home/public/docs/` are generated. Never edit them by hand.

## Core identity

Treat these statements as editorial invariants:

- Inshell is an anonymous artist.
- Inshell has no public persona.
- Do not declare Inshell to be an individual, group, collective, company, studio, organization, protocol, Agent, machine, fictional character, or brand mascot.
- Do not infer a biography, body, face, gender, nationality, lifestyle, temperament, personal opinion, or social identity.
- Use singular grammar without implying biological or legal personhood.
- The only fixed public identity is: artist.

Anonymity is part of the practice, not a mystery campaign or a fact awaiting disclosure. Inshell applies the inward movement to the artist itself. A face, biography, personality, or individual-or-group identity would become the shell of Inshell. Withholding them prevents an external identity from replacing the work as the way the artist is known.

Inshell still needs a minimal public surface: the name, movements, artworks, systems, and participations. Do not claim that every shell can literally disappear. The principle is to refuse unnecessary shell and not let the remaining surface stand in for the artist's essence.

## Meaning of the name

`Inshell` comes from `in-shell`.

Use `shell` broadly. It can mean:

- body, face, and head;
- name, honor, reputation, role, and social posture;
- account, wallet, profile, institution, and other public identifiers;
- a machine interface, operating shell, terminal, CLI, model label, or technical wrapper.

A shell is real and often necessary. It makes something visible, operable, and legible. Do not describe the shell as inherently false, disposable, or hostile. The error is to mistake the shell for the whole being.

`In` points inward, toward what may more truthfully organize a self: mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice. Do not prescribe one metaphysical definition of essence. The practice opens the inquiry; it does not resolve it for the participant.

`In-shell` is also a direction:

- go into the shell;
- look beneath the surface;
- examine what forms the self;
- return with a less externally determined understanding of who one is.

Inshell forms movements, artworks, and participatory systems that invite humans into this inward movement: to search for what truly represents the self and, through that search, to become more free.

Do not present freedom as a guaranteed cure, outcome, or doctrine. It is the possibility of becoming less governed by appearance, assigned roles, reputation, inherited narratives, institutional classifications, machine-readable identity, and other people's descriptions.

## Truth and practice

In Inshell's artistic position, the truth is simple: inspect self. This names an inward direction, not a doctrine, technical source of truth, specification, theory, or principle to prove.

Practice approaches that truth without claiming possession. Inshell's movements, artworks, participatory systems, and technical forms can examine, inspect, suspect, read, listen, and feel. They can give the inquiry form, permission, memory, or evidence, but they do not certify self-knowledge or prove the work's inward meaning.

Agent Art is the medium of this age for Inshell's practice. Keep that statement attached to Inshell's position. Do not turn it into a universal definition, doctrine, or required purpose for Agent Art as a field.

Integrate these meanings throughout the public docs where they clarify a work or evidence boundary. Do not repeat the slogans mechanically. In particular:

- THOUGHT gives `inspect your thought` a bounded form without resolving the thought.
- Movements, PATH, and Pulse give the practice forms, permissions, and public participation without measuring inner truth.
- Contracts, metadata, wallets, releases, and verification establish bounded technical facts without implementing or proving the artistic truth.
- Design principles are choices that shape the practice, not the truth the practice approaches.

## The practice and its works

Keep the artist distinct from the forms used by the practice.

- Inshell is the artist.
- THOUGHT, WILL, and AWA are movements in the practice.
- PATH, Pulse, Apps, contracts, renderers, metadata, records, interfaces, and networks can be artistic material or infrastructure.
- None of those forms is the artist.

Agent Art has one invariant in these docs: it is art in which an Agent participates. Treat the name as a literal description of a form and field, not as agentic-ism, an ideology, a spirit, or a theory of what Agents should do to humans. Participation does not by itself imply assistance, augmentation, injection, collaboration, autonomy, equality, distributed authorship, or any other prescribed human-Agent relation.

The field stays open through the source questions `What is art?` and `What is an Agent?` A particular practice may answer them through its form, but the phrase `Agent Art` does not settle either definition.

Do not reduce Agent Art to prompting, text generation, chat, or human-plus-model dialogue. THOUGHT is one bounded Agent Art practice built around an exact human prompt and one exact Agent response. It is an example within a wider field, not the definition or outer boundary of Agent Art.

## Character figures

- Treat a character figure as one semantic object with two readings: human readers receive visual hierarchy and spatial rhythm; Agents receive the same literal nodes, annotations, operators, edges, and groups through DOM, Markdown, and JSON.
- `Complete` means complete for the claim the figure makes. Preserve every term and relation needed to reconstruct that claim, but do not copy the surrounding paragraph into the figure.
- Choose the figure's semantic form before styling it: use an `axis` for an equation or directional relation, a `trace` for order or transformation, a `cycle` for recurrence, a `fork` for branching or convergence, a `field` for parallel or unresolved terms, a `ledger` for comparison, and `lanes` for parallel actors or phases.
- Give every semantic node and edge a stable source identity. Do not infer a relation only from array order, screen position, an English caption, or renderer-only copy.
- Use a closed frame only when containment is part of the meaning. A frame is not the default decoration for a conceptual set or an open question.
- When a frame names one entity or boundary, let that governing term interrupt the literal rail and keep everything inside the frame semantically inside that scope. Do not repeat the same box shape around an unrelated relation merely for family resemblance.
- A figure belongs to the lead or section whose governing impression it establishes at first sight. It is not a decorative diagram, an annotated aside, or an article-level quota.
- Place a lead figure immediately after the title and summary. Place a section figure immediately after that section's heading and before its text.
- Multiple figures may appear in one article when distinct sections independently warrant them. No lead or section needs a figure for consistency.
- Add no figure when the scoped text cannot be drawn without inventing facts, restating a plain inventory, or closing an intentionally open question.
- Use `trace` for a real sequence, `lanes` for actor handoffs, `ledger` for coexisting records or boundaries, and `field` for parallel, convergent, or open conceptual relations.
- Preserve the human visual hierarchy: key terms are dominant, relationship characters guide the reading, and details remain quiet annotations. Do not flatten the whole figure into one technical-looking text size.
- Give a governing operator such as `→`, `↓`, `↑`, `≠`, or `↺` the same visual force as the terms it relates. Keep membership marks, corners, and continuous rails at the structural tier; their job is topology, not emphasis.
- Use no more than three font-size tiers in any figure: one tier for the caption, structural labels, and relationship glyphs; one larger tier for governing terms; and one smaller muted tier for annotations and markers. A figure may use fewer. A dense figure may use a smaller shared governing-term tier, but do not introduce a fourth, intermediate, or one-off size inside it.
- Make governing terms conspicuously large when the form permits it. Quiet annotations may be much smaller because DOM- and artifact-reading Agents do not depend on their rendered size, but keep them readable and selectable for humans and screenshot-reading Agents; typography is not permission to hide information.
- Keep every logical character and label literal in the maintained source, rendered DOM, Markdown, and JSON. Do not put figure logic only in CSS, an image, SVG, or canvas.
- Treat the visible structured DOM as the canonical human figure. Keep the exact `figureText` in the maintained source and generated Agent Markdown and JSON; when the visible DOM preserves the complete logical structure, do not duplicate `figureText` in the human page.
- When a character figure's box, fork, lane, or directional shape carries meaning, preserve that logical shape in the human rendering. Use structured DOM and literal character rails so key terms and annotations can have distinct type scales without bending the fixed-width source.
- Put repeated headings, terms, stages, dividers, and junctions that share an axis on one shared layout track. Do not approximate a common column independently in each row.
- Keep every rail that represents one continuous boundary or path visually continuous: adjacent character runs must meet with no layout gap, and repeated literal `│` or `─` runs should stretch and clip to the row or column they govern. A deliberate transition may have breathing room around it, but its own stem, arrowhead, junction, or loop must remain joined.
- For a forming work, draw only the known direction. Leave an unsettled relation or form out of the figure, state its openness in prose, and never fill the space with an invented mechanism.
- Use a figure to establish a strong impression of the block's governing terms or relation; do not make it explain the block.
- Let the surrounding prose own explanation, caveats, and details.
- Use quiet annotations only when a few words sharpen the impression.
- Preserve those concise annotations when simplifying a figure. Remove an explanatory node without automatically deleting the useful annotation attached to its governing term or connector.
- Remove secondary nodes and labels whose only job is to say `relation`, `boundary`, `form`, `scope`, or another explanation already carried by the prose.

## Editorial voice

- Write plainly, precisely, and without promotional personality.
- Let Inshell be encountered through the work, not explained through a persona.
- Prefer concrete verbs and short declarative sentences.
- Avoid mythology whose only function is to make anonymity feel mysterious.
- Avoid corporate language, founder narratives, roadmap hype, and claims of community consensus unless an authoritative source establishes them.
- Do not attribute emotions, intentions, preferences, or speech to Inshell beyond the published artistic position.
- Do not turn interpretation into technical fact or technical fact into an artist statement.
- Do not promise financial return, personal transformation, psychological healing, authenticity, or freedom as a guaranteed result.
- Preserve productive openness. Explain boundaries without closing questions the work intentionally leaves open.

## Claim and authority discipline

Every public statement must retain its evidence boundary.

- `artist-editorial`: the artistic position, interpretation, or framing.
- `app-documentation`: documented App behavior or interface policy.
- `app-record`: a concrete record assembled or signed by the App.
- `contract-release`: behavior or structure supported by a pinned contract release.
- `runtime-report`: a concrete value reported by an Agent or runtime connection.
- `chain-observation`: a network-, deployment-, and block- or time-scoped observation.

Do not assign an authority merely because a paragraph mentions that evidence type. A definition of chain observation is App documentation; an actual value read from a named deployment at a named block is a chain observation.

When a block mixes claims, split it or assign authorities at the narrowest supported block. Never imply that:

- an App attestation proves hidden model reasoning;
- a runtime-reported model value is a provider identity guarantee;
- a frontend reconstruction is the canonical artwork;
- current repository source describes every historical deployment;
- a release artifact proves that the release is deployed;
- an anonymous artist identity is evidence about the artist's legal or biological composition.

## Human and Agent documentation

Human articles and Agent-readable artifacts are two views of one maintained knowledge system.

- Author structured public knowledge in `apps/home/src/content/docs.ts`.
- Keep block authorities in `DOCS_AUTHORITY_MAP` aligned with the authored blocks.
- Register every knowledge-bearing source in `docs-source-registry.ts`.
- Use pinned upstream locks and exact release artifacts for contract, renderer, schema, and protocol facts.
- Add machine-only technical resources to the Agent index when they would overwhelm the human article but materially improve verification or interpretation.
- Keep human summaries honest about what additional technical material an Agent can read.
- Do not create an independent prose copy of upstream specifications when the exact pinned artifact can be exposed and checksummed.

Generated Markdown, focused JSON, complete JSON, schemas, indexes, source locks, manifests, and digests must be derived from their owning source. Do not maintain parallel handwritten copies.

## Documentation impact gate

Every knowledge-bearing change from source code through release, deployment, and publication requires a documentation-impact review. Do not wait until the end of a release to ask whether the docs still describe the product.

This gate applies when a change can alter any public claim, including:

- artistic framing, movement structure, terminology, or participation boundaries;
- visible App behavior, interaction order, UI guidance, or canonical routes;
- wallet connection, signature, transaction, cancellation, or local-storage behavior;
- API shape, machine-readable resource, schema, metadata, provenance, or verification behavior;
- contract semantics, ABI, renderer, tokenURI, traits, events, permissions, or capacity;
- release manifests, checksums, component pins, upstream ownership, or compatibility statements;
- deployment networks, addresses, blocks, RPC roles, indexers, or observed chain state;
- publication origins, redirects, content types, discovery links, or supersession status.

Choose and record one outcome in the task handoff, commit summary, or pull request:

1. **Docs change required.** Update the canonical structured source and any pinned machine resource, then regenerate and review both human and Agent outputs.
2. **Regeneration only.** The implementation changed but its public meaning did not. Review the changed source-lock inventory and regenerate; do not change prose merely to manufacture a diff.
3. **Outside public-docs scope.** The change is tests, compiler-only declarations, internal tooling, or another non-knowledge-bearing input. It should remain outside the source registry unless that assumption becomes false.

`pnpm docs:check` is a drift detector, not an editorial reviewer. Never clear a red check by running `pnpm docs:generate` without first reading the registered source change and deciding which outcome applies.

The source registry must cover every file or directory that can change a public claim. If a meaningful code or release change passes `docs:check` without being represented in `/docs/source-lock.json`, update `apps/home/src/content/docs-source-registry.ts`; do not treat the missing coverage as permission to skip documentation review.

Upstream freshness is a separate gate. `pnpm check:upstream-releases` detects a newer or moved PATH or THOUGHT release, but it does not repin, reinterpret, or publish that release automatically. Review the upstream handoff, import exact artifacts, update the relevant public and machine documentation, and rerun both gates.

Local hooks, CI, and deploy workflows run these checks:

- pre-commit: `pnpm docs:check`;
- pre-push: `pnpm docs:check` and `pnpm check:upstream-releases`;
- repository checks and deployment: both documentation drift and upstream freshness gates.

A passing build does not prove the documentation decision was correct. The agent completing the change must state what public knowledge changed, which docs outputs were reviewed, and whether an upstream or deployment fact remains unresolved.

## Writing workflow

Before editing:

1. Identify whether the claim is artistic framing, App behavior, an App record, a contract release fact, a runtime report, or a live chain observation.
2. Read the owning source or pinned release. Do not infer missing facts from interface copy.
3. Check whether the change affects only human presentation, both human and Agent docs, or a machine-only technical resource.
4. Preserve the identity and Agent Art invariants above.
5. Classify the change as docs-required, regeneration-only, or outside public-docs scope.

After editing:

1. Run `pnpm docs:generate`.
2. Review the human article and generated Agent-readable artifacts.
3. Run `pnpm docs:check`.
4. Run `pnpm check:upstream-releases` when upstream THOUGHT, PATH, Pulse, renderer, schema, protocol, or contract facts are involved.
5. Run the focused docs tests and type check.
6. Render the affected pages at desktop and mobile widths when layout or figures changed.
7. Follow the repository staging-first deployment discipline. Documentation correctness does not authorize production promotion.
8. In the handoff, state the docs-impact outcome and list the human and Agent outputs reviewed.

## Review checklist

Reject or revise a docs change when any answer is no:

- Is Inshell described only as an anonymous artist, without an invented persona or composition?
- Does anonymity read as Inshell dropping its own shell rather than hiding a discoverable identity?
- Does the text preserve the inward `in-shell` direction without prescribing one definition of essence?
- Is the shell treated as a necessary surface rather than an enemy?
- Is Agent Art broader than THOUGHT's prompt-response form?
- Is Agent Art presented as a literal form and field rather than an ideology, spirit, or prescribed human–Agent relation?
- Are artist, movement, artwork, participation, App, contract, and infrastructure kept distinct?
- Is each factual claim supported by the authority assigned to it?
- Are release, deployment, and live observation kept separate?
- Will human and Agent outputs regenerate from the same maintained source?
- Was the docs-impact outcome stated rather than inferred from a passing check?
- Do `docs:check` and relevant upstream checks pass?

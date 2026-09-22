# Agent-native character figure experiment

This branch tests a figure as one literal semantic object with two readings:

- a human sees scale, rhythm, grouping, and direction;
- an Agent reads the same nodes, annotations, operators, edges, and groups in the DOM, Markdown, and JSON.

The experiment does not treat typography as knowledge. A large term and a tiny annotation remain ordinary selectable text. Typography only changes which part a human sees first.

## Contract

1. Every figure has a stable ID independent of its caption.
2. Every governing term and useful annotation remains literal.
3. Every directed relation has explicit source and target node or semantic-group IDs, a literal glyph, and an accessible label.
4. Meaningful containment, open fields, phases, lanes, sets, and comparisons are explicit groups.
5. Human DOM, fixed-width `figureText`, generated Markdown, and generated JSON describe the same graph.
6. CSS supplies hierarchy only. It may not generate, hide, reorder, or replace logic.
7. A figure uses at most three type tiers: dominant term, structural syntax, and quiet annotation.

Because stable figure IDs and required semantic graphs change the public JSON contract, the experiment emits Agent topic and complete-corpus documents as v2. Those documents reference `/docs/content.v2.schema.json`; the established `/docs/content.schema.json` URI and its v1 bytes remain unchanged.

## Semantic forms

- `axis`: equation, distinction, or directed relation. Terms can be monumental.
- `trace`: ordered transformation. The relation path is the reading spine.
- `cycle`: a trace with an explicit return edge and condition.
- `fork`: branching or aggregation. Branch conditions stay literal.
- `field`: parallel or unresolved terms without invented order or causality.
- `ledger`: two or more records compared on shared tracks.
- `lanes`: actors or phases whose handoffs remain distinct.

A closed frame is a semantic modifier, not a house style. It remains only when containment or a bounded record is part of the claim.

## Learned visual grammar

- Let the shape follow the relation. A trace, comparison, open field, fork, lane, and bounded entity should not inherit one another's decoration.
- Let a term interrupt a literal frame rail only when that term names the framed entity or scope. The rail and corners stay structural; the named entity stays dominant.
- Give a governing operator the same first-glance force as the terms it relates. A large `→`, `↓`, `↑`, `≠`, or `↺` can carry the figure's image without adding an explanatory node.
- Keep annotations complete but quiet. They sharpen the governing impression without becoming extra entities or an alternate prose paragraph.
- Remove a rail or stem when it carries no additional relation. Literal completeness means preserving the logic, not preserving decorative character count.

## Evaluation

The experiment passes only when:

- a two-second human glance reveals its governing terms and direction;
- a text-only Agent can reconstruct the same relation without interpreting size or position;
- every semantic graph validates its node and group references;
- every public JSON figure includes the graph and its stable ID;
- Markdown retains both the fixed-width source and explicit relation syntax;
- mobile and desktop preserve reading order, rails, annotations, and zero horizontal overflow;
- screenshot inspection finds the tiny annotations readable rather than merely present.

The annotation tier currently bottoms out at 10px for open forms and 11px for dense ledgers and lanes. DOM-reading Agents do not depend on that size, but screenshot-reading Agents and humans still do, so the experiment does not go below it.

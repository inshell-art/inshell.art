import type { DocsFigure, DocsFigureItem } from "./docs";

export const DOCS_FIGURE_FORMS = [
  "axis",
  "trace",
  "cycle",
  "fork",
  "field",
  "ledger",
  "lanes",
] as const;

export type DocsFigureForm = (typeof DOCS_FIGURE_FORMS)[number];

export type DocsFigureNodeRole =
  | "structural"
  | "subject"
  | "operator"
  | "state"
  | "result"
  | "question"
  | "evidence"
  | "action"
  | "record"
  | "surface"
  | "principle";

export type DocsFigureNode = {
  /** Stable inside one figure. */
  id: string;
  /** Zero-based index into the source figure's items. */
  sourceItem?: number;
  /** Which source field this node preserves; item means title plus annotation. */
  sourcePart?: "item" | "title" | "detail";
  term: string;
  annotation?: string;
  role: DocsFigureNodeRole;
};

export type DocsFigureEdge = {
  /** Stable inside one figure. */
  id: string;
  /** Stable node or semantic group id. */
  from: string;
  /** Stable node or semantic group id. */
  to: string;
  /** The literal character operator carried by the figure. */
  glyph: string;
  /** Literal narrow-screen form when topology changes orientation. */
  stackedGlyph?: string;
  /** Accessible prose for the relation; never inferred from position. */
  label: string;
  annotation?: string;
};

export type DocsFigureGroupKind =
  | "boundary"
  | "open-field"
  | "phase"
  | "lane"
  | "set"
  | "comparison";

export type DocsFigureGroup = {
  /** Stable inside one figure. */
  id: string;
  kind: DocsFigureGroupKind;
  label: string;
  /** Literal grouping marks when the group is visibly drawn. */
  glyph?: string;
  members: readonly string[];
};

export type DocsFigureLogic = {
  id: string;
  label: string;
  form: DocsFigureForm;
  nodes: readonly DocsFigureNode[];
  edges: readonly DocsFigureEdge[];
  groups: readonly DocsFigureGroup[];
};

export type DocsFigureLogicValidation = {
  valid: boolean;
  errors: readonly string[];
};

type DocsFigureLogicBuilder = (figure: DocsFigure) => DocsFigureLogic;

function sourceItem(figure: DocsFigure, index: number): DocsFigureItem {
  const item = figure.items[index];
  if (!item) {
    throw new Error(
      `Figure "${figure.label}" has no source item at index ${index}.`,
    );
  }
  return item;
}

function sourceNode(
  figure: DocsFigure,
  sourceItemIndex: number,
  id: string,
  role: DocsFigureNodeRole,
): DocsFigureNode {
  const item = sourceItem(figure, sourceItemIndex);
  return {
    id,
    sourceItem: sourceItemIndex,
    sourcePart: "item",
    term: item.title,
    ...(item.detail ? { annotation: item.detail } : {}),
    role,
  };
}

function logic(
  figure: DocsFigure,
  form: DocsFigureForm,
  nodes: readonly DocsFigureNode[],
  edges: readonly DocsFigureEdge[],
  groups: readonly DocsFigureGroup[] = [],
): DocsFigureLogic {
  return { id: figure.id, label: figure.label, form, nodes, edges, groups };
}

const FIGURE_LOGIC_BUILDERS = {
  "inshell.inward-direction": (figure) =>
    logic(
      figure,
      "axis",
      [
        sourceNode(figure, 0, "shell", "surface"),
        sourceNode(figure, 1, "in", "structural"),
        { id: "self", term: "SELF", role: "result" },
      ],
      [
        {
          id: "inspect-self",
          from: "in",
          to: "self",
          glyph: "↓",
          label: "In directs inspection toward the self.",
          annotation: sourceItem(figure, 1).detail,
        },
      ],
      [
        {
          id: "shell-boundary",
          kind: "boundary",
          label: "The shell is real, necessary, and not the whole being.",
          members: ["shell", "in", "self"],
        },
      ],
    ),

  "inshell.practice-truth": (figure) =>
    logic(
      figure,
      "axis",
      [
        sourceNode(figure, 0, "truth", "result"),
        sourceNode(figure, 1, "practice", "action"),
      ],
      [
        {
          id: "practice-approaches-truth",
          from: "practice",
          to: "truth",
          glyph: "↑",
          label: "Practice approaches truth without claiming to possess it.",
          annotation: "Approaches without claiming possession",
        },
      ],
      [],
    ),

  "agent-art.open-field": (figure) =>
    logic(
      figure,
      "field",
      [
        sourceNode(figure, 0, "invariant", "principle"),
        sourceNode(figure, 1, "what-is-art", "question"),
        sourceNode(figure, 2, "what-is-an-agent", "question"),
      ],
      [],
      [
        {
          id: "agent-art-field",
          kind: "open-field",
          label: "One invariant is held while Art and Agent remain open questions.",
          members: ["invariant", "what-is-art", "what-is-an-agent"],
        },
        {
          id: "agent-art-questions",
          kind: "set",
          label: "The source questions remain open.",
          glyph: "•",
          members: ["what-is-art", "what-is-an-agent"],
        },
      ],
    ),

  "movements.arc": (figure) =>
    logic(
      figure,
      "trace",
      [
        sourceNode(figure, 0, "thought", "state"),
        sourceNode(figure, 1, "will", "state"),
        sourceNode(figure, 2, "awa", "state"),
      ],
      [
        {
          id: "individual-to-crowd",
          from: "thought",
          to: "will",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The movement arc goes from individual to crowd.",
        },
        {
          id: "crowd-toward-core",
          from: "will",
          to: "awa",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The movement arc continues from crowd toward the core.",
        },
      ],
      [
        {
          id: "movement-phases",
          kind: "phase",
          label: "The named $PATH from individual to crowd toward the core.",
          members: ["thought", "will", "awa"],
        },
      ],
    ),

  "thought.prompt-response": (figure) =>
    logic(
      figure,
      "axis",
      [
        sourceNode(figure, 0, "human-prompt", "subject"),
        sourceNode(figure, 1, "agent-response", "subject"),
        sourceNode(figure, 2, "one-thought", "result"),
      ],
      [
        {
          id: "pair-forms-thought",
          from: "thought-equation",
          to: "one-thought",
          glyph: "↓",
          label: "The exact prompt-response pair forms one THOUGHT.",
        },
      ],
      [
        {
          id: "thought-equation",
          kind: "set",
          label: "Human prompt P plus Agent response R forms one THOUGHT (P, R).",
          glyph: "+",
          members: ["human-prompt", "agent-response"],
        },
      ],
    ),

  "thought.creative-handoff": (figure) =>
    logic(
      figure,
      "trace",
      [
        sourceNode(figure, 0, "human-prompt", "action"),
        sourceNode(figure, 1, "agent-response", "action"),
        sourceNode(figure, 2, "human-review", "action"),
      ],
      [
        {
          id: "prompt-to-response",
          from: "human-prompt",
          to: "agent-response",
          glyph: "→",
          stackedGlyph: "↓",
          label: "One exact human prompt is handed to the Agent.",
        },
        {
          id: "response-to-review",
          from: "agent-response",
          to: "human-review",
          glyph: "→",
          stackedGlyph: "↓",
          label: "One exact Agent response returns for human review and choice.",
        },
      ],
      [],
    ),

} satisfies Readonly<Record<string, DocsFigureLogicBuilder>>;

export const DOCS_FIGURE_LOGIC_IDS = Object.freeze(
  Object.keys(FIGURE_LOGIC_BUILDERS),
);

export function validateDocsFigureLogic(
  figure: DocsFigure,
  figureLogic: DocsFigureLogic,
): DocsFigureLogicValidation {
  const errors: string[] = [];

  if (figureLogic.label !== figure.label) {
    errors.push(
      `Logic label "${figureLogic.label}" does not match figure label "${figure.label}".`,
    );
  }
  if (figureLogic.id !== figure.id) {
    errors.push(
      `Logic id "${figureLogic.id}" does not match source id "${figure.id}".`,
    );
  }

  const nodeIds = new Set<string>();
  const coveredSourceParts = new Set<string>();
  for (const node of figureLogic.nodes) {
    if (!node.id.trim()) errors.push("A figure node has an empty id.");
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node id "${node.id}".`);
    }
    nodeIds.add(node.id);

    if (!node.term.trim()) {
      errors.push(`Node "${node.id}" has an empty term.`);
    }

    if (node.sourceItem !== undefined) {
      if (
        !Number.isInteger(node.sourceItem) ||
        node.sourceItem < 0 ||
        node.sourceItem >= figure.items.length
      ) {
        errors.push(
          `Node "${node.id}" has invalid source item index ${node.sourceItem}.`,
        );
      } else {
        const item = figure.items[node.sourceItem];
        const sourcePart = node.sourcePart ?? "item";
        if (sourcePart === "item") {
          coveredSourceParts.add(`${node.sourceItem}:title`);
          if (item.detail) coveredSourceParts.add(`${node.sourceItem}:detail`);
          if (node.term !== item.title) {
            errors.push(
              `Node "${node.id}" must preserve source term "${item.title}" exactly.`,
            );
          }
          if (item.detail && node.annotation !== item.detail) {
            errors.push(
              `Node "${node.id}" must preserve source annotation "${item.detail}" exactly.`,
            );
          }
        } else {
          const expected = sourcePart === "title" ? item.title : item.detail;
          coveredSourceParts.add(`${node.sourceItem}:${sourcePart}`);
          if (node.term !== expected) {
            errors.push(
              `Node "${node.id}" must preserve source ${sourcePart} "${expected}" exactly.`,
            );
          }
        }
      }
    }
  }

  for (let index = 0; index < figure.items.length; index += 1) {
    if (!coveredSourceParts.has(`${index}:title`))
      errors.push(`Source item ${index} title is not represented by a node.`);
    if (
      figure.items[index]?.detail &&
      !coveredSourceParts.has(`${index}:detail`)
    )
      errors.push(`Source item ${index} detail is not represented by a node.`);
  }

  const declaredGroupIds = new Set(figureLogic.groups.map(({ id }) => id));
  const edgeIds = new Set<string>();
  for (const edge of figureLogic.edges) {
    if (!edge.id.trim()) errors.push("A figure edge has an empty id.");
    if (edgeIds.has(edge.id)) {
      errors.push(`Duplicate edge id "${edge.id}".`);
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from) && !declaredGroupIds.has(edge.from)) {
      errors.push(`Edge "${edge.id}" has unknown source endpoint "${edge.from}".`);
    }
    if (!nodeIds.has(edge.to) && !declaredGroupIds.has(edge.to)) {
      errors.push(`Edge "${edge.id}" has unknown target endpoint "${edge.to}".`);
    }
    if (!edge.glyph.trim()) {
      errors.push(`Edge "${edge.id}" has an empty literal glyph.`);
    }
    if (!edge.label.trim()) {
      errors.push(`Edge "${edge.id}" has an empty accessible label.`);
    }
  }

  const groupIds = new Set<string>();
  for (const group of figureLogic.groups) {
    if (!group.id.trim()) errors.push("A figure group has an empty id.");
    if (groupIds.has(group.id)) {
      errors.push(`Duplicate group id "${group.id}".`);
    }
    groupIds.add(group.id);
    if (!group.label.trim()) {
      errors.push(`Group "${group.id}" has an empty semantic label.`);
    }
    if (group.members.length === 0) {
      errors.push(`Group "${group.id}" has no members.`);
    }
    for (const member of group.members) {
      if (!nodeIds.has(member)) {
        errors.push(`Group "${group.id}" has unknown member "${member}".`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function docsFigureLogic(figure: DocsFigure): DocsFigureLogic {
  const builders: Readonly<Record<string, DocsFigureLogicBuilder>> =
    FIGURE_LOGIC_BUILDERS;
  const builder = builders[figure.id];
  if (!builder) {
    throw new Error(
      `No semantic figure logic is registered for "${figure.id}" (${figure.label}).`,
    );
  }

  const figureLogic = builder(figure);
  const validation = validateDocsFigureLogic(figure, figureLogic);
  if (!validation.valid) {
    throw new Error(
      `Invalid semantic figure logic for "${figure.label}":\n${validation.errors.join("\n")}`,
    );
  }
  return figureLogic;
}

export const resolveDocsFigureLogic = docsFigureLogic;

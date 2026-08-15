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

function sourcePartNode(
  figure: DocsFigure,
  sourceItemIndex: number,
  sourcePart: "title" | "detail",
  id: string,
  role: DocsFigureNodeRole,
): DocsFigureNode {
  const item = sourceItem(figure, sourceItemIndex);
  const term = sourcePart === "title" ? item.title : item.detail;
  if (!term) {
    throw new Error(
      `Figure "${figure.id}" has no ${sourcePart} at source item ${sourceItemIndex}.`,
    );
  }
  return { id, sourceItem: sourceItemIndex, sourcePart, term, role };
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
          label: "The named PATH from individual to crowd toward the core.",
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

  "thought.creation-attestation": (figure) =>
    logic(
      figure,
      "fork",
      [
        sourceNode(figure, 0, "recorded-values", "record"),
        sourceNode(figure, 1, "creation-attestation", "action"),
        { id: "valid-proof", term: "valid proof", role: "operator" },
        { id: "empty-proof", term: "empty proof", role: "operator" },
        sourceNode(figure, 2, "app-attested", "result"),
        sourceNode(figure, 3, "unattested", "result"),
      ],
      [
        {
          id: "values-to-attestation",
          from: "recorded-values",
          to: "creation-attestation",
          glyph: "↓",
          label: "Recorded values are bound into one Creation Attestation claim that the contract validates during minting.",
        },
        {
          id: "attestation-valid-branch",
          from: "creation-attestation",
          to: "valid-proof",
          glyph: "├─",
          label: "Creation Attestation takes the valid-proof branch.",
        },
        {
          id: "valid-proof-result",
          from: "valid-proof",
          to: "app-attested",
          glyph: "→",
          label: "A valid proof produces an App Attested result.",
        },
        {
          id: "attestation-empty-branch",
          from: "creation-attestation",
          to: "empty-proof",
          glyph: "└─",
          label: "Creation Attestation takes the empty-proof branch.",
        },
        {
          id: "empty-proof-result",
          from: "empty-proof",
          to: "unattested",
          glyph: "→",
          label: "An empty proof produces an explicit Unattested result.",
        },
      ],
      [],
    ),

  "will.open-field": (figure) =>
    logic(
      figure,
      "fork",
      [
        sourceNode(figure, 0, "human", "subject"),
        sourceNode(figure, 1, "agent", "subject"),
        {
          id: "crowd-dynamic",
          term: "Crowd dynamic",
          role: "structural",
        },
        sourceNode(figure, 2, "result", "result"),
      ],
      [
        {
          id: "delegate-will",
          from: "human",
          to: "agent",
          glyph: "→",
          label: "A human delegates will and authority to an Agent.",
          annotation: "Will + authority",
        },
        {
          id: "human-enters-crowd-dynamic",
          from: "human",
          to: "crowd-dynamic",
          glyph: "↘",
          label: "Human participation enters the crowd dynamic.",
        },
        {
          id: "agent-enters-crowd-dynamic",
          from: "agent",
          to: "crowd-dynamic",
          glyph: "↙",
          label: "Agent action enters the crowd dynamic.",
        },
        {
          id: "crowd-dynamic-produces-result",
          from: "crowd-dynamic",
          to: "result",
          glyph: "↓",
          label: "The crowd dynamic can produce a result.",
        },
      ],
      [],
    ),

  "awa.open-horizon": (figure) =>
    logic(
      figure,
      "trace",
      [
        sourceNode(figure, 0, "thought", "state"),
        sourceNode(figure, 1, "will", "state"),
        sourceNode(figure, 2, "awa", "state"),
        { id: "open-horizon", term: "…", role: "state" },
      ],
      [
        {
          id: "thought-to-will",
          from: "thought",
          to: "will",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The path moves from individual THOUGHT to crowd WILL.",
        },
        {
          id: "will-toward-awa",
          from: "will",
          to: "awa",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The path points from crowd WILL toward AWA and the core; arrival is not claimed.",
        },
        {
          id: "awa-toward-open-horizon",
          from: "awa",
          to: "open-horizon",
          glyph: "→",
          stackedGlyph: "↓",
          label: "AWA remains open toward a core that is not claimed as reached.",
        },
      ],
      [],
    ),

  "path.capacity-progress": (figure) =>
    logic(
      figure,
      "ledger",
      [
        sourcePartNode(figure, 0, "title", "capacity", "state"),
        sourcePartNode(figure, 0, "detail", "progress", "state"),
      ],
      [
        {
          id: "quota-equals-progress-total",
          from: "capacity",
          to: "progress",
          glyph: "=",
          label: "For each PATH, the deployed movement quota equals used plus remaining entitlement.",
        },
      ],
      [
        {
          id: "capacity-column",
          kind: "lane",
          label: "Deployment",
          members: ["capacity"],
        },
        {
          id: "progress-column",
          kind: "lane",
          label: "Each PATH",
          members: ["progress"],
        },
        {
          id: "quota-progress-equality",
          kind: "comparison",
          label: "For each PATH, used plus remaining entitlement equals the deployed movement quota.",
          members: ["capacity", "progress"],
        },
      ],
    ),

  "pulse.epoch": (figure) =>
    logic(
      figure,
      "cycle",
      [
        sourceNode(figure, 0, "ask", "state"),
        sourceNode(figure, 1, "bid", "action"),
        sourceNode(figure, 2, "next-ask", "result"),
      ],
      [
        {
          id: "ask-decays-to-bid",
          from: "ask",
          to: "bid",
          glyph: "↓",
          label: "The current ask decays until a bid succeeds.",
          annotation: sourceItem(figure, 0).detail,
        },
        {
          id: "bid-pumps-next-ask",
          from: "bid",
          to: "next-ask",
          glyph: "↓",
          label: "The successful bid pumps the next ask.",
          annotation: sourceItem(figure, 1).detail,
        },
        {
          id: "next-epoch-loop",
          from: "next-ask",
          to: "ask",
          glyph: "↺",
          label: "The next ask becomes the current ask in the next epoch.",
          annotation:
            figure.mode === "trace" ? figure.loop?.condition : undefined,
        },
      ],
      [],
    ),

  "contracts.handoffs": (figure) =>
    logic(
      figure,
      "lanes",
      [
        sourceNode(figure, 0, "pulse-settle", "action"),
        sourceNode(figure, 1, "adapter-issue", "action"),
        sourceNode(figure, 2, "path-record", "record"),
        sourceNode(figure, 3, "thought-validate", "action"),
        sourceNode(figure, 4, "path-consume", "action"),
        sourceNode(figure, 5, "thought-mint", "result"),
      ],
      [
        {
          id: "settle-to-issue",
          from: "pulse-settle",
          to: "adapter-issue",
          glyph: "→",
          stackedGlyph: "↓",
          label: "A valid Pulse settlement is handed to PathPulseAdapter for PATH issuance.",
        },
        {
          id: "issue-to-record",
          from: "adapter-issue",
          to: "path-record",
          glyph: "→",
          stackedGlyph: "↓",
          label: "PATH issuance is recorded by PathNFT.",
        },
        {
          id: "validate-to-consume",
          from: "thought-validate",
          to: "path-consume",
          glyph: "→",
          stackedGlyph: "↓",
          label: "ThoughtNFT calls PathNFT to consume one authorized movement unit.",
        },
        {
          id: "consume-to-mint",
          from: "path-consume",
          to: "thought-mint",
          glyph: "→",
          stackedGlyph: "↓",
          label: "ThoughtNFT mints and records the work atomically with PATH consumption.",
        },
      ],
      [
        {
          id: "public-issuance-phase",
          kind: "phase",
          label: "Public issuance",
          members: ["pulse-settle", "adapter-issue", "path-record"],
        },
        {
          id: "later-thought-mint-phase",
          kind: "phase",
          label: "Later THOUGHT mint",
          members: ["thought-validate", "path-consume", "thought-mint"],
        },
        {
          id: "pulse-auction-lane",
          kind: "lane",
          label: "PulseAuction",
          members: ["pulse-settle"],
        },
        {
          id: "path-pulse-adapter-lane",
          kind: "lane",
          label: "PathPulseAdapter",
          members: ["adapter-issue"],
        },
        {
          id: "path-nft-lane",
          kind: "lane",
          label: "PathNFT",
          members: ["path-record", "path-consume"],
        },
        {
          id: "thought-nft-lane",
          kind: "lane",
          label: "ThoughtNFT",
          members: ["thought-validate", "thought-mint"],
        },
      ],
    ),

  "evidence.interpretation": (figure) =>
    logic(
      figure,
      "fork",
      [
        { id: "evidence", term: "EVIDENCE", role: "evidence" },
        sourceNode(figure, 0, "identity", "evidence"),
        sourceNode(figure, 1, "contract", "evidence"),
        sourceNode(figure, 2, "release", "evidence"),
        sourceNode(figure, 3, "context", "evidence"),
        sourceNode(figure, 4, "interpretation", "result"),
      ],
      [
        {
          id: "evidence-identity",
          from: "evidence",
          to: "identity",
          glyph: "├─",
          label: "Identity is one evidence record.",
        },
        {
          id: "evidence-contract",
          from: "evidence",
          to: "contract",
          glyph: "├─",
          label: "Contract state is one evidence record.",
        },
        {
          id: "evidence-release",
          from: "evidence",
          to: "release",
          glyph: "├─",
          label: "The pinned release is one evidence record.",
        },
        {
          id: "evidence-context",
          from: "evidence",
          to: "context",
          glyph: "└─",
          label: "Context is one evidence record.",
        },
        {
          id: "evidence-to-interpretation",
          from: "evidence",
          to: "interpretation",
          glyph: "↓",
          label: "The evidence records are read together as interpretation.",
        },
      ],
      [],
    ),

  "mono-76.canonical-artwork": (figure) =>
    logic(
      figure,
      "trace",
      [
        sourceNode(figure, 0, "glyph-study", "action"),
        sourceNode(figure, 1, "sealed-mono", "state"),
        sourceNode(figure, 2, "canonical-artwork", "result"),
      ],
      [
        {
          id: "study-to-seal",
          from: "glyph-study",
          to: "sealed-mono",
          glyph: "↓",
          label: "Glyph study is refined into the sealed Mono 76 source.",
        },
        {
          id: "seal-to-artwork",
          from: "sealed-mono",
          to: "canonical-artwork",
          glyph: "↓",
          label: "The sealed paths and metrics produce the canonical native SVG artwork.",
        },
      ],
      [],
    ),

  "wallet.distinctions": (figure) =>
    logic(
      figure,
      "ledger",
      [
        sourceNode(figure, 0, "read", "action"),
        sourceNode(figure, 1, "sign", "action"),
        sourceNode(figure, 2, "transact", "action"),
        sourceNode(figure, 3, "local", "record"),
        sourceNode(figure, 4, "onchain", "record"),
      ],
      [
        {
          id: "read-not-sign",
          from: "read",
          to: "sign",
          glyph: "≠",
          label: "Reading public state is not signing an authorization.",
        },
        {
          id: "sign-not-transact",
          from: "sign",
          to: "transact",
          glyph: "≠",
          label: "Signing an authorization is not a chain transaction.",
        },
        {
          id: "local-not-onchain",
          from: "local",
          to: "onchain",
          glyph: "≠",
          label: "A local browser record is not an onchain public record.",
        },
      ],
      [
        {
          id: "wallet-action-distinction",
          kind: "comparison",
          label: "Read, sign, and transact are distinct wallet actions.",
          members: ["read", "sign", "transact"],
        },
        {
          id: "record-location-distinction",
          kind: "comparison",
          label: "Local browser data is distinct from an onchain public record.",
          members: ["local", "onchain"],
        },
      ],
    ),

  "source-release.records": (figure) =>
    logic(
      figure,
      "axis",
      [
        sourceNode(figure, 0, "source", "record"),
        sourceNode(figure, 1, "release", "record"),
        sourceNode(figure, 2, "deployment", "record"),
        sourceNode(figure, 3, "observation", "record"),
      ],
      [
        {
          id: "source-not-release",
          from: "source",
          to: "release",
          glyph: "≠",
          label: "Authored source is not a pinned release.",
        },
        {
          id: "release-not-deployment",
          from: "release",
          to: "deployment",
          glyph: "≠",
          label: "A pinned release is not a deployment record.",
        },
        {
          id: "deployment-not-observation",
          from: "deployment",
          to: "observation",
          glyph: "≠",
          label: "A deployment record is not a point-in-time observation.",
        },
      ],
      [
        {
          id: "record-distinction",
          kind: "comparison",
          label: "Four records that must not be collapsed into one.",
          members: ["source", "release", "deployment", "observation"],
        },
      ],
    ),

  "design.principles": (figure) =>
    logic(
      figure,
      "field",
      [
        sourceNode(figure, 0, "bound", "principle"),
        sourceNode(figure, 1, "authorize", "principle"),
        sourceNode(figure, 2, "expose", "principle"),
        sourceNode(figure, 3, "pin", "principle"),
        sourceNode(figure, 4, "qualify", "principle"),
      ],
      [],
      [
        {
          id: "inshell-principles",
          kind: "set",
          label: "Inshell principles across systems",
          glyph: "•",
          members: ["bound", "authorize", "expose", "pin", "qualify"],
        },
      ],
    ),

  "design.preservation": (figure) =>
    logic(
      figure,
      "lanes",
      [
        sourceNode(figure, 0, "thought-agent-return", "action"),
        sourceNode(figure, 1, "thought-human-review", "action"),
        sourceNode(figure, 2, "thought-successful-mint", "action"),
        sourceNode(figure, 3, "thought-public-corpus", "result"),
        sourceNode(figure, 4, "pulse-visible-ask", "state"),
        sourceNode(figure, 5, "pulse-confirmed-bid", "action"),
        sourceNode(figure, 6, "pulse-settlement", "action"),
        sourceNode(figure, 7, "pulse-sale-record", "result"),
      ],
      [
        {
          id: "thought-return-to-review",
          from: "thought-agent-return",
          to: "thought-human-review",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The Agent return becomes a candidate for human review.",
        },
        {
          id: "thought-review-to-mint",
          from: "thought-human-review",
          to: "thought-successful-mint",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The human decision to preserve proceeds to a mint attempt.",
        },
        {
          id: "thought-mint-to-corpus",
          from: "thought-successful-mint",
          to: "thought-public-corpus",
          glyph: "→",
          stackedGlyph: "↓",
          label: "Only a successful contract action preserves the THOUGHT in the public corpus.",
        },
        {
          id: "pulse-ask-to-bid",
          from: "pulse-visible-ask",
          to: "pulse-confirmed-bid",
          glyph: "→",
          stackedGlyph: "↓",
          label: "A participant authorizes a bid against the visible ask.",
        },
        {
          id: "pulse-bid-to-settlement",
          from: "pulse-confirmed-bid",
          to: "pulse-settlement",
          glyph: "→",
          stackedGlyph: "↓",
          label: "The confirmed bid proceeds to contract settlement.",
        },
        {
          id: "pulse-settlement-to-record",
          from: "pulse-settlement",
          to: "pulse-sale-record",
          glyph: "→",
          stackedGlyph: "↓",
          label: "Only a successful settlement preserves a Pulse sale record.",
        },
      ],
      [
        {
          id: "thought-preservation-lane",
          kind: "lane",
          label: "THOUGHT",
          members: [
            "thought-agent-return",
            "thought-human-review",
            "thought-successful-mint",
            "thought-public-corpus",
          ],
        },
        {
          id: "pulse-preservation-lane",
          kind: "lane",
          label: "PULSE",
          members: [
            "pulse-visible-ask",
            "pulse-confirmed-bid",
            "pulse-settlement",
            "pulse-sale-record",
          ],
        },
      ],
    ),

  "design.reading-surfaces": (figure) =>
    logic(
      figure,
      "fork",
      [
        sourceNode(figure, 0, "identified-work", "record"),
        sourceNode(figure, 1, "reading-surfaces", "surface"),
      ],
      [
        {
          id: "work-to-surfaces",
          from: "identified-work",
          to: "reading-surfaces",
          glyph: "↓",
          label: "One identified onchain work can be read through many surfaces.",
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

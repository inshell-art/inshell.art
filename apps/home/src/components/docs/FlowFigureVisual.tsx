import type { DocsFigure } from "@/content/docs";
import {
  docsFigureLogic,
  type DocsFigureEdge,
  type DocsFigureLogic,
  type DocsFigureNode,
} from "@/content/docs-figure-logic";
import { resolveSourceNode } from "@/components/docs/figureLogicResolvers";

type TraceFigure = Extract<
  DocsFigure,
  { mode: "axis" | "cycle" | "trace" }
>;
type LedgerFigure = Extract<DocsFigure, { mode: "ledger" }>;

type TraceLayout = "axis" | "cycle" | "sequence" | "stack";

type TraceTopology = {
  nodes: DocsFigureNode[];
  edges: DocsFigureEdge[];
  returnEdge?: DocsFigureEdge;
};

function TraceConnector({
  edge,
  layout,
}: {
  edge: DocsFigureEdge;
  layout: TraceLayout;
}) {
  return (
    <span
      className={`docs-figure__shape-trace-connector docs-figure__shape-trace-edge docs-figure__shape-trace-edge--${layout}`}
      data-figure-edge-id={edge.id}
      aria-label={edge.label}
      role="img"
    >
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-inline docs-figure__shape-trace-edge-glyph docs-figure__shape-trace-edge-glyph--inline"
        aria-hidden="true"
      >
        {edge.glyph}
      </span>
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-stacked docs-figure__shape-trace-edge-glyph docs-figure__shape-trace-edge-glyph--stacked"
        aria-hidden="true"
      >
        {edge.stackedGlyph ?? edge.glyph}
      </span>
      {edge.annotation !== undefined ? (
        <small className="docs-figure__annotation docs-figure__shape-trace-relation docs-figure__shape-trace-edge-annotation">
          {edge.annotation}
        </small>
      ) : null}
    </span>
  );
}

function figureLoop(figure: TraceFigure) {
  return "loop" in figure ? figure.loop : undefined;
}

function resolveTraceTopology(
  figure: TraceFigure,
  logic: DocsFigureLogic,
): TraceTopology {
  const sourceNodes = figure.items.map((_, sourceItem) =>
    resolveSourceNode(logic, sourceItem),
  );
  const nodeById = new Map(logic.nodes.map((node) => [node.id, node]));
  const loop = figureLoop(figure);
  const loopTarget = loop ? sourceNodes[loop.to - 1] : undefined;

  if (logic.form === "cycle" && !loopTarget) {
    throw new Error(
      `Figure "${figure.id}" must identify the source node where its cycle restarts.`,
    );
  }

  const returnCandidates = loopTarget
    ? logic.edges.filter(({ to }) => to === loopTarget.id)
    : [];
  if (loopTarget && returnCandidates.length !== 1) {
    throw new Error(
      `Figure "${figure.id}" must have one semantic return edge to "${loopTarget.id}"; found ${returnCandidates.length}.`,
    );
  }

  const returnEdge = returnCandidates[0];
  const forwardEdges = returnEdge
    ? logic.edges.filter(({ id }) => id !== returnEdge.id)
    : [...logic.edges];
  const participatingIds = new Set([
    ...sourceNodes.map(({ id }) => id),
    ...forwardEdges.flatMap(({ from, to }) => [from, to]),
  ]);
  const startCandidates = loopTarget
    ? [loopTarget]
    : [...participatingIds]
        .filter(
          (nodeId) => !forwardEdges.some(({ to }) => to === nodeId),
        )
        .map((nodeId) => nodeById.get(nodeId))
        .filter((node): node is DocsFigureNode => node !== undefined);

  if (startCandidates.length !== 1) {
    throw new Error(
      `Figure "${figure.id}" must have one semantic flow origin; found ${startCandidates.length}.`,
    );
  }

  const nodes: DocsFigureNode[] = [];
  const edges: DocsFigureEdge[] = [];
  const visited = new Set<string>();
  let current: DocsFigureNode | undefined = startCandidates[0];

  while (current) {
    if (visited.has(current.id)) {
      throw new Error(
        `Figure "${figure.id}" revisits "${current.id}" before its explicit return edge.`,
      );
    }
    visited.add(current.id);
    nodes.push(current);

    const outgoing = forwardEdges.filter(({ from }) => from === current?.id);
    if (outgoing.length > 1) {
      throw new Error(
        `Figure "${figure.id}" is not a single native flow at "${current.id}"; found ${outgoing.length} outgoing edges.`,
      );
    }
    const nextEdge = outgoing[0];
    if (!nextEdge) break;
    const nextNode = nodeById.get(nextEdge.to);
    if (!nextNode) {
      throw new Error(
        `Figure "${figure.id}" edge "${nextEdge.id}" targets unknown node "${nextEdge.to}".`,
      );
    }
    edges.push(nextEdge);
    current = nextNode;
  }

  const omitted = [...participatingIds].filter((nodeId) => !visited.has(nodeId));
  if (omitted.length > 0) {
    throw new Error(
      `Figure "${figure.id}" native flow omits semantic nodes: ${omitted.join(", ")}.`,
    );
  }

  if (returnEdge && returnEdge.from !== nodes.at(-1)?.id) {
    throw new Error(
      `Figure "${figure.id}" return edge must leave its final semantic node.`,
    );
  }

  return { nodes, edges, ...(returnEdge ? { returnEdge } : {}) };
}

function traceLayout(
  logic: DocsFigureLogic,
  topology: TraceTopology,
): TraceLayout {
  if (logic.form === "cycle") return "cycle";
  if (logic.form === "axis") return "axis";

  const usesVerticalOperators =
    topology.edges.length > 0 &&
    topology.edges.every(({ glyph }) => /[↑↓]/u.test(glyph));
  const isTransformation =
    topology.nodes[0]?.role === "action" &&
    topology.nodes.slice(1, -1).some(({ role }) => role === "state") &&
    topology.nodes.at(-1)?.role === "result";

  return usesVerticalOperators || isTransformation ? "stack" : "sequence";
}

function nodeAnnotation(
  node: DocsFigureNode,
  outgoingEdge: DocsFigureEdge | undefined,
) {
  if (
    node.annotation !== undefined &&
    outgoingEdge?.annotation === node.annotation
  ) {
    return undefined;
  }
  return node.annotation;
}

function TraceReturn({ edge }: { edge: DocsFigureEdge }) {
  return (
    <span
      className="docs-figure__shape-loop-return docs-figure__shape-trace-return"
      data-figure-edge-id={edge.id}
      data-return-to={edge.to}
      aria-label={edge.label}
      role="img"
    >
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-return-glyph"
        aria-hidden="true"
      >
        {edge.stackedGlyph ?? edge.glyph}
      </span>
      {edge.annotation !== undefined ? (
        <small className="docs-figure__annotation docs-figure__shape-trace-return-annotation">
          {edge.annotation}
        </small>
      ) : null}
    </span>
  );
}

export function TraceFigureVisual({ figure }: { figure: TraceFigure }) {
  const logic = docsFigureLogic(figure);
  const topology = resolveTraceTopology(figure, logic);
  const layout = traceLayout(logic, topology);

  return (
    <div
      className={`docs-figure__shape-trace docs-figure__shape-trace--${layout} docs-figure__shape-flow docs-figure__shape-flow--${logic.form}`}
      data-figure-form={logic.form}
      data-trace-layout={layout}
    >
      <ol className="docs-figure__shape-trace-list">
        {topology.nodes.map((node, index) => {
          const nextEdge = topology.edges[index];
          const annotation = nodeAnnotation(node, nextEdge);

          return (
            <li
              className="docs-figure__shape-trace-item docs-figure__shape-trace-node"
              data-figure-node-id={node.id}
              data-figure-node-role={node.role}
              key={node.id}
            >
              <span className="docs-figure__copy docs-figure__shape-trace-copy">
                <strong className="docs-figure__term docs-figure__shape-trace-term">
                  {node.term}
                </strong>
                {annotation !== undefined ? (
                  <small className="docs-figure__annotation docs-figure__shape-trace-node-annotation">
                    {annotation}
                  </small>
                ) : null}
              </span>
              {nextEdge ? (
                <TraceConnector
                  edge={nextEdge}
                  layout={layout}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {topology.returnEdge ? <TraceReturn edge={topology.returnEdge} /> : null}
    </div>
  );
}

export function LedgerFigureVisual({ figure }: { figure: LedgerFigure }) {
  const logic = docsFigureLogic(figure);
  const capacity = logic.nodes.find(({ id }) => id === "capacity");
  const progress = logic.nodes.find(({ id }) => id === "progress");
  const capacityGroup = logic.groups.find(({ id }) => id === "capacity-column");
  const progressGroup = logic.groups.find(({ id }) => id === "progress-column");
  const distinction = logic.edges.find(
    ({ id }) => id === "quota-equals-progress-total",
  );

  if (
    !capacity ||
    !progress ||
    !capacityGroup ||
    !progressGroup ||
    !distinction
  ) {
    throw new Error(
      `Figure "${figure.id}" is missing its capacity/progress comparison logic.`,
    );
  }

  return (
    <div
      className="docs-figure__shape-ledger docs-figure__shape-ledger--comparison"
      data-figure-shape="capacity-comparison"
    >
      <div className="docs-figure__shape-ledger-member" data-figure-node-id={capacity.id}>
        <span className="docs-figure__shape-ledger-header">
          {capacityGroup.label}
        </span>
        <strong className="docs-figure__term">{capacity.term}</strong>
      </div>
      <span
        className="docs-figure__shape-ledger-relation docs-figure__shape-ledger-relation--governing"
        data-figure-edge-id={distinction.id}
        aria-label={distinction.label}
        role="img"
      >
        {distinction.glyph}
      </span>
      <div className="docs-figure__shape-ledger-member" data-figure-node-id={progress.id}>
        <span className="docs-figure__shape-ledger-header">
          {progressGroup.label}
        </span>
        <strong className="docs-figure__term">{progress.term}</strong>
      </div>
    </div>
  );
}

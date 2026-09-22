import type {
  DocsFigureEdge,
  DocsFigureLogic,
  DocsFigureNode,
} from "@/content/docs-figure-logic";

type DocsFigureSourcePart = NonNullable<DocsFigureNode["sourcePart"]>;

function nodeSourcePart(node: DocsFigureNode): DocsFigureSourcePart {
  return node.sourcePart ?? "item";
}

export function resolveSourceNode(
  logic: DocsFigureLogic,
  sourceItem: number,
  sourcePart: DocsFigureSourcePart = "item",
): DocsFigureNode {
  const sourceNodes = logic.nodes.filter((node) => node.sourceItem === sourceItem);
  const matches = sourceNodes.filter(
    (node) => nodeSourcePart(node) === sourcePart,
  );

  if (matches.length === 1) return matches[0];

  const available = sourceNodes.length
    ? sourceNodes
        .map((node) => `${node.id}:${nodeSourcePart(node)}`)
        .join(", ")
    : "none";
  if (matches.length === 0) {
    throw new Error(
      `Figure "${logic.id}" has no semantic node for source item ${sourceItem} part "${sourcePart}"; available source nodes: ${available}.`,
    );
  }

  throw new Error(
    `Figure "${logic.id}" has ambiguous semantic nodes for source item ${sourceItem} part "${sourcePart}": ${matches.map(({ id }) => id).join(", ")}.`,
  );
}

export function resolveEdgeByEndpoints(
  logic: DocsFigureLogic,
  from: string,
  to: string,
): DocsFigureEdge {
  const matches = logic.edges.filter(
    (edge) => edge.from === from && edge.to === to,
  );

  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    const available = logic.edges.length
      ? logic.edges.map((edge) => `${edge.from}->${edge.to}`).join(", ")
      : "none";
    throw new Error(
      `Figure "${logic.id}" has no semantic edge from "${from}" to "${to}"; available endpoints: ${available}.`,
    );
  }

  throw new Error(
    `Figure "${logic.id}" has ambiguous semantic edges from "${from}" to "${to}": ${matches.map(({ id }) => id).join(", ")}.`,
  );
}

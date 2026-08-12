import { Fragment } from "react";

import type { DocsFigure } from "@/content/docs";
import {
  docsFigureLogic,
  type DocsFigureEdge,
  type DocsFigureGroup,
  type DocsFigureLogic,
  type DocsFigureNode,
} from "@/content/docs-figure-logic";
import { resolveEdgeByEndpoints } from "@/components/docs/figureLogicResolvers";

type LaneFigure = Extract<DocsFigure, { mode: "lanes" }>;
type LaneLayout = "phase" | "parallel" | "handoff";

function renderFigureTitle(title: string) {
  return title.split(/(?<=[a-z])(?=[A-Z])/).map((part, index) => (
    <Fragment key={`${part}:${index}`}>
      {index > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

function laneChainGroups(logic: DocsFigureLogic): {
  groups: DocsFigureGroup[];
  layout: LaneLayout;
} {
  const phaseGroups = logic.groups.filter(({ kind }) => kind === "phase");
  if (phaseGroups.length > 0) {
    return { groups: phaseGroups, layout: "phase" };
  }

  const laneGroups = logic.groups.filter(({ kind }) => kind === "lane");
  if (laneGroups.length > 0) {
    return {
      groups: laneGroups,
      layout: laneGroups.length > 1 ? "parallel" : "handoff",
    };
  }

  throw new Error(
    `Figure "${logic.id}" has no semantic phase or lane groups to render.`,
  );
}

function groupNodes(
  logic: DocsFigureLogic,
  group: DocsFigureGroup,
): DocsFigureNode[] {
  const nodesById = new Map(logic.nodes.map((node) => [node.id, node]));
  return group.members.map((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) {
      throw new Error(
        `Figure "${logic.id}" group "${group.id}" references unknown node "${nodeId}".`,
      );
    }
    return node;
  });
}

function actorGroupForNode(
  logic: DocsFigureLogic,
  chainGroup: DocsFigureGroup,
  nodeId: string,
): DocsFigureGroup | undefined {
  if (chainGroup.kind !== "phase") return undefined;

  const matches = logic.groups.filter(
    ({ kind, members }) => kind === "lane" && members.includes(nodeId),
  );
  if (matches.length === 1) return matches[0];

  throw new Error(
    `Figure "${logic.id}" node "${nodeId}" belongs to ${matches.length} semantic actor lanes; expected exactly one.`,
  );
}

function LaneRelation({ edge }: { edge: DocsFigureEdge }) {
  return (
    <span
      className="docs-figure__lane-relation docs-figure__lane-relation--governing"
      aria-label={edge.label}
      data-figure-edge-id={edge.id}
      role="img"
    >
      <span className="docs-figure__lane-relation-inline" aria-hidden="true">
        {edge.glyph}
      </span>
      <span className="docs-figure__lane-relation-stacked" aria-hidden="true">
        {edge.stackedGlyph ?? "↓"}
      </span>
    </span>
  );
}

function LaneEvent({
  actorGroup,
  node,
  relation,
}: {
  actorGroup?: DocsFigureGroup;
  node: DocsFigureNode;
  relation?: DocsFigureEdge;
}) {
  return (
    <li
      className={`docs-figure__lane-event${
        relation ? "" : " docs-figure__lane-event--terminal"
      }${actorGroup ? " docs-figure__lane-event--labeled" : ""}`}
      data-figure-node-id={node.id}
      data-source-item={node.sourceItem}
    >
      <span className="docs-figure__copy">
        {actorGroup ? (
          <span
            className="docs-figure__lane-event-label"
            data-figure-group-id={actorGroup.id}
          >
            {renderFigureTitle(actorGroup.label)}
          </span>
        ) : null}
        <strong className="docs-figure__term">
          {renderFigureTitle(node.term)}
        </strong>
        {node.annotation ? (
          <small className="docs-figure__annotation">{node.annotation}</small>
        ) : null}
        {relation ? <LaneRelation edge={relation} /> : null}
      </span>
    </li>
  );
}

/**
 * Renders lanes from their semantic groups and explicit edges. DOM order is the
 * narrow-screen reading order; no source stage or decorative rail is required.
 */
export function LaneFigureVisual({ figure }: { figure: LaneFigure }) {
  const logic = docsFigureLogic(figure);
  const { groups, layout } = laneChainGroups(logic);

  return (
    <div
      className="docs-figure__lanes docs-figure__lanes--open"
      data-lane-grouping={layout === "phase" ? "phase" : "lane"}
      data-lane-layout={layout}
    >
      {groups.map((group) => {
        const nodes = groupNodes(logic, group);
        const headingId = `${logic.id}-${group.id}-heading`;

        return (
          <section
            className="docs-figure__lane-group docs-figure__lane-chain"
            data-figure-group-id={group.id}
            key={group.id}
          >
            <h4 className="docs-figure__lane-heading" id={headingId}>
              {group.label}
            </h4>
            <ol
              aria-labelledby={headingId}
              className="docs-figure__lane-events"
              data-count={nodes.length}
            >
              {nodes.map((node, index) => {
                const nextNode = nodes[index + 1];
                const relation = nextNode
                  ? resolveEdgeByEndpoints(logic, node.id, nextNode.id)
                  : undefined;

                return (
                  <LaneEvent
                    actorGroup={actorGroupForNode(logic, group, node.id)}
                    key={node.id}
                    node={node}
                    relation={relation}
                  />
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export default LaneFigureVisual;

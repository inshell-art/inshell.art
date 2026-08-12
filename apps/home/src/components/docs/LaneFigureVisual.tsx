import { Fragment, type CSSProperties } from "react";

import type { DocsFigure } from "@/content/docs";

type LaneFigure = Extract<DocsFigure, { mode: "lanes" }>;
type LaneFigureItem = LaneFigure["items"][number];

type LaneGroup = {
  key: string;
  label?: string;
  items: LaneFigureItem[];
  showItemLane: boolean;
};

type LaneLayout = "phase" | "parallel" | "handoff";

type LaneFigureStyle = CSSProperties & {
  "--docs-figure-lane-stage-count": number;
};

const LANE_VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

function renderFigureTitle(title: string) {
  return title.split(/(?<=[a-z])(?=[A-Z])/).map((part, index) => (
    <Fragment key={`${part}:${index}`}>
      {index > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

function groupLaneItems(
  figure: LaneFigure,
): { layout: LaneLayout; groups: LaneGroup[] } {
  const groupByPhase = figure.items.some((item) => Boolean(item.phase));
  const layout: LaneLayout = groupByPhase
    ? "phase"
    : figure.label === "Two preservation boundaries"
      ? "parallel"
      : "handoff";

  if (layout === "handoff") {
    return {
      layout,
      groups: [
        {
          key: "handoff",
          items: [...figure.items].sort(
            (left, right) => left.stage - right.stage,
          ),
          showItemLane: true,
        },
      ],
    };
  }

  const groups = new Map<string, LaneGroup>();

  for (const item of figure.items) {
    const label = groupByPhase ? item.phase ?? item.lane : item.lane;
    const key = `${groupByPhase ? "phase" : "lane"}:${label}`;
    const group = groups.get(key) ?? {
      key,
      label,
      items: [],
      showItemLane: groupByPhase,
    };
    group.items.push(item);
    groups.set(key, group);
  }

  return {
    layout,
    groups: [...groups.values()].map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => left.stage - right.stage),
    })),
  };
}

function LaneRelation() {
  return (
    <span
      className="docs-figure__lane-relation"
      aria-label="then"
      role="img"
    >
      <span className="docs-figure__lane-relation-inline" aria-hidden="true">
        →
      </span>
      <span className="docs-figure__lane-relation-stacked" aria-hidden="true">
        ↓
      </span>
    </span>
  );
}

function LaneEvent({
  item,
  nextStage,
  showLane,
  stageColumn,
  stageSpan,
}: {
  item: LaneFigureItem;
  nextStage?: number;
  showLane: boolean;
  stageColumn: number;
  stageSpan: number;
}) {
  return (
    <li
      className={`docs-figure__lane-event${
        nextStage === undefined ? " docs-figure__lane-event--terminal" : ""
      }${showLane ? " docs-figure__lane-event--labeled" : ""}`}
      style={{ gridColumn: `${stageColumn} / span ${stageSpan}` }}
    >
      <span className="docs-figure__copy">
        {showLane ? (
          <span className="docs-figure__lane-event-label">
            {renderFigureTitle(item.lane)}
          </span>
        ) : null}
        <strong className="docs-figure__term">
          {renderFigureTitle(item.title)}
        </strong>
        {item.detail ? (
          <small className="docs-figure__annotation">{item.detail}</small>
        ) : null}
        {nextStage !== undefined ? <LaneRelation /> : null}
      </span>
    </li>
  );
}

/**
 * Renders a lanes-mode docs figure as literal, selectable character topology.
 * The DOM order is also the narrow-screen reading order; layout must not reorder it.
 */
export function LaneFigureVisual({ figure }: { figure: LaneFigure }) {
  const { layout, groups } = groupLaneItems(figure);
  const groupByPhase = layout === "phase";
  const stages = [...new Set(figure.items.map((item) => item.stage))].sort(
    (left, right) => left - right,
  );
  const stageColumns = new Map(
    stages.map((stage, index) => [stage, index + 1]),
  );
  const figureStyle: LaneFigureStyle = {
    "--docs-figure-lane-stage-count": stages.length,
  };

  return (
    <div
      className="docs-figure__lanes"
      data-lane-grouping={groupByPhase ? "phase" : "lane"}
      data-lane-layout={layout}
      style={figureStyle}
    >
      {groups.map((group) => {
        const groupStages = group.items.map((item) => item.stage);
        const activeStageColumns = groupByPhase
          ? new Map(groupStages.map((stage, index) => [stage, index + 1]))
          : stageColumns;
        const groupEndColumn = groupByPhase
          ? groupStages.length
          : stages.length;
        const groupStyle: LaneFigureStyle | undefined = groupByPhase
          ? { "--docs-figure-lane-stage-count": groupStages.length }
          : undefined;

        return (
          <div
            className={`docs-figure__lane-row docs-figure__lane-group${
              group.label ? "" : " docs-figure__lane-row--unlabeled"
            }`}
            key={group.key}
            style={groupStyle}
          >
            {group.label ? (
              <p className="docs-figure__lane-heading">{group.label}</p>
            ) : null}
            <span className="docs-figure__lane-separator" aria-hidden="true">
              <span className="docs-figure__lane-rail">{LANE_VERTICAL_RAIL}</span>
            </span>
            <ol
              className="docs-figure__lane-events"
              data-count={group.items.length}
            >
              {group.items.map((item, index) => {
                const nextStage = group.items[index + 1]?.stage;
                const stageColumn = activeStageColumns.get(item.stage) ?? 1;
                const nextColumn = nextStage === undefined
                  ? groupEndColumn + 1
                  : activeStageColumns.get(nextStage) ?? stageColumn + 1;

                return (
                  <LaneEvent
                    key={`${item.stage}:${item.lane}:${item.title}`}
                    item={item}
                    nextStage={nextStage}
                    showLane={group.showItemLane}
                    stageColumn={stageColumn}
                    stageSpan={Math.max(1, nextColumn - stageColumn)}
                  />
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

export default LaneFigureVisual;

import { Fragment, type CSSProperties } from "react";

import type { DocsFigure } from "@/content/docs";

type LaneFigure = Extract<DocsFigure, { mode: "lanes" }>;
type LaneFigureItem = LaneFigure["items"][number];

type LaneGroup = {
  key: string;
  label: string;
  items: LaneFigureItem[];
};

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

function groupLaneItems(figure: LaneFigure) {
  const groupByPhase = figure.items.some((item) => Boolean(item.phase));
  const groups = new Map<string, LaneGroup>();

  for (const item of figure.items) {
    const label = groupByPhase ? item.phase ?? item.lane : item.lane;
    const key = `${groupByPhase ? "phase" : "lane"}:${label}`;
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return {
    groupByPhase,
    groups: [...groups.values()].map((group) => ({
      ...group,
      items: [...group.items].sort((left, right) => left.stage - right.stage),
    })),
  };
}

function StageMarker({ stage }: { stage: number }) {
  return (
    <span className="docs-figure__marker" aria-label={`stage ${stage}`}>
      [{String(stage).padStart(2, "0")}]
    </span>
  );
}

function LaneRelation({
  from,
  to,
  laterPhase,
}: {
  from: number;
  to: number;
  laterPhase?: string;
}) {
  const isPhaseBoundary = laterPhase !== undefined;
  const isAdjacent = to === from + 1 && !isPhaseBoundary;
  const label = isPhaseBoundary
    ? `later phase begins at stage ${to}: ${laterPhase}`
    : isAdjacent
      ? "then"
      : `continues at stage ${to}`;

  return (
    <span
      className={`docs-figure__lane-relation${
        isAdjacent ? "" : " docs-figure__lane-relation--gap"
      }`}
      aria-label={label}
      role="img"
    >
      <span className="docs-figure__lane-relation-inline" aria-hidden="true">
        {isAdjacent ? "→" : "···"}
      </span>
      <span className="docs-figure__lane-relation-stacked" aria-hidden="true">
        {isAdjacent ? "↓" : "···"}
      </span>
    </span>
  );
}

function TimeAxis({ figure, stages }: { figure: LaneFigure; stages: number[] }) {
  const phaseByStage = new Map(
    figure.items.map((item) => [item.stage, item.phase]),
  );

  return (
    <div className="docs-figure__lane-row docs-figure__lane-axis">
      <p className="docs-figure__lane-heading">Time</p>
      <span className="docs-figure__lane-separator" aria-hidden="true">
        <span className="docs-figure__lane-rail">{LANE_VERTICAL_RAIL}</span>
      </span>
      <ol className="docs-figure__lane-time" aria-label="Figure stages">
        {stages.map((stage, index) => (
          <li key={stage}>
            <StageMarker stage={stage} />
            {index < stages.length - 1 ? (
              <LaneRelation
                from={stage}
                to={stages[index + 1] ?? stage}
                laterPhase={
                  phaseByStage.get(stage) !==
                  phaseByStage.get(stages[index + 1] ?? stage)
                    ? phaseByStage.get(stages[index + 1] ?? stage)
                    : undefined
                }
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function LaneEvent({
  item,
  nextStage,
  showLane,
  stageColumn,
  stageSpan,
  offsetTerminalMarker = false,
}: {
  item: LaneFigureItem;
  nextStage?: number;
  showLane: boolean;
  stageColumn: number;
  stageSpan: number;
  offsetTerminalMarker?: boolean;
}) {
  return (
    <li
      className={`docs-figure__lane-event${
        nextStage === undefined ? " docs-figure__lane-event--terminal" : ""
      }${
        offsetTerminalMarker
          ? " docs-figure__lane-event--offset-terminal"
          : ""
      }`}
      style={{ gridColumn: `${stageColumn} / span ${stageSpan}` }}
    >
      <StageMarker stage={item.stage} />
      <span className="docs-figure__copy">
        {showLane ? (
          <span className="docs-figure__lane-event-label">
            {renderFigureTitle(item.lane)}
          </span>
        ) : null}
        <strong className="docs-figure__term">
          {renderFigureTitle(item.title)}
        </strong>
        <small className="docs-figure__annotation">{item.detail}</small>
      </span>
      {nextStage !== undefined ? (
        <LaneRelation from={item.stage} to={nextStage} />
      ) : null}
    </li>
  );
}

/**
 * Renders a lanes-mode docs figure as literal, selectable character topology.
 * The DOM order is also the narrow-screen reading order; layout must not reorder it.
 */
export function LaneFigureVisual({ figure }: { figure: LaneFigure }) {
  const { groupByPhase, groups } = groupLaneItems(figure);
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
      data-lane-layout={
        figure.label === "Two preservation boundaries" ? "parallel" : "handoff"
      }
      style={figureStyle}
    >
      {groupByPhase ? null : <TimeAxis figure={figure} stages={stages} />}
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
            className="docs-figure__lane-row docs-figure__lane-group"
            key={group.key}
            style={groupStyle}
          >
            <p className="docs-figure__lane-heading">{group.label}</p>
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
                const offsetTerminalMarker =
                  !groupByPhase &&
                  group.items.length === 1 &&
                  nextStage === undefined &&
                  stageColumn === stages.length &&
                  stageColumn > 1;

                return (
                  <LaneEvent
                    key={`${item.stage}:${item.lane}:${item.title}`}
                    item={item}
                    nextStage={nextStage}
                    showLane={groupByPhase}
                    stageColumn={
                      offsetTerminalMarker ? stageColumn - 1 : stageColumn
                    }
                    stageSpan={
                      offsetTerminalMarker
                        ? 2
                        : Math.max(1, nextColumn - stageColumn)
                    }
                    offsetTerminalMarker={offsetTerminalMarker}
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

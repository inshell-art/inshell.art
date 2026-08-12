import type { DocsFigure } from "@/content/docs";
import {
  docsFigureLogic,
  type DocsFigureEdge,
} from "@/content/docs-figure-logic";
import {
  resolveEdgeByEndpoints,
  resolveSourceNode,
} from "@/components/docs/figureLogicResolvers";

type TraceFigure = Extract<DocsFigure, { mode: "trace" }>;
type LedgerFigure = Extract<DocsFigure, { mode: "ledger" }>;

const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

function TraceConnector({
  alignWithDetail = false,
  edge,
  stacked = false,
}: {
  alignWithDetail?: boolean;
  edge: DocsFigureEdge;
  stacked?: boolean;
}) {
  return (
    <span
      className={`docs-figure__shape-trace-connector${
        stacked ? " docs-figure__shape-trace-connector--stacked" : ""
      }${
        alignWithDetail
          ? " docs-figure__shape-trace-connector--detail"
          : ""
      }`}
      aria-label={edge.label}
      role="img"
    >
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-inline"
        aria-hidden="true"
      >
        {edge.glyph}
      </span>
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-stacked"
        aria-hidden="true"
      >
        {edge.stackedGlyph ?? "│\n↓"}
      </span>
      {edge.annotation !== undefined ? (
        <small className="docs-figure__annotation docs-figure__shape-trace-relation">
          {edge.annotation}
        </small>
      ) : null}
    </span>
  );
}

export function TraceFigureVisual({ figure }: { figure: TraceFigure }) {
  const logic = docsFigureLogic(figure);
  const sourceNodes = figure.items.map((_, sourceItem) =>
    resolveSourceNode(logic, sourceItem),
  );
  const isCycle = figure.loop !== undefined;
  const isStackedTrace =
    !isCycle &&
    !logic.edges.some((edge) => figure.figureText.includes(edge.glyph));
  const traceLayout = isCycle
    ? "cycle"
    : isStackedTrace
      ? "stack"
      : "sequence";
  const loopTargetIndex = figure.loop ? figure.loop.to - 1 : undefined;
  const loopTargetNode =
    loopTargetIndex !== undefined
      ? sourceNodes[loopTargetIndex]
      : undefined;
  if (figure.loop && !loopTargetNode) {
    throw new Error(
      `Figure "${figure.id}" loop target ${figure.loop.to} does not identify a source item.`,
    );
  }
  const loopSourceNode = figure.loop
    ? sourceNodes[sourceNodes.length - 1]
    : undefined;
  if (figure.loop && !loopSourceNode) {
    throw new Error(
      `Figure "${figure.id}" cannot resolve a loop edge without a final source item.`,
    );
  }
  const loopEdge =
    figure.loop && loopSourceNode && loopTargetNode
      ? resolveEdgeByEndpoints(logic, loopSourceNode.id, loopTargetNode.id)
      : undefined;

  return (
    <div
      className={`docs-figure__shape-trace docs-figure__shape-trace--${traceLayout}`}
      data-trace-layout={traceLayout}
    >
      <ol className="docs-figure__shape-trace-list">
        {figure.items.map((item, index) => {
          const isLast = index === figure.items.length - 1;
          const currentNode = sourceNodes[index];
          const nextNode = sourceNodes[index + 1];
          if (!isLast && (!currentNode || !nextNode)) {
            throw new Error(
              `Figure "${figure.id}" cannot resolve consecutive source items ${index} and ${index + 1}.`,
            );
          }
          const nextEdge =
            !isLast && currentNode && nextNode
              ? resolveEdgeByEndpoints(logic, currentNode.id, nextNode.id)
              : undefined;

          return (
            <li
              className="docs-figure__shape-trace-item"
              key={`${index}:${item.title}`}
            >
              <span className="docs-figure__copy docs-figure__shape-trace-copy">
                <strong className="docs-figure__term">{item.title}</strong>
                {!isCycle && item.detail !== undefined ? (
                  <>
                    <span
                      className="docs-figure__shape-character docs-figure__shape-trace-item-rail"
                      aria-hidden="true"
                    >
                      │
                    </span>
                    <small className="docs-figure__annotation">{item.detail}</small>
                  </>
                ) : null}
              </span>
              {!isLast && nextEdge ? (
                <TraceConnector
                  alignWithDetail={!isCycle && item.detail !== undefined}
                  edge={nextEdge}
                  stacked={isCycle || isStackedTrace}
                />
              ) : null}
              {isLast && figure.loop && loopEdge ? (
                <span
                  className="docs-figure__shape-loop-return"
                  aria-label={loopEdge.label}
                  role="img"
                >
                  <span className="docs-figure__shape-character" aria-hidden="true">
                    {loopEdge.stackedGlyph ?? loopEdge.glyph}
                  </span>
                  <small className="docs-figure__annotation">
                    {loopEdge.annotation ?? figure.loop.condition}
                  </small>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ledgerShape(figureText: string) {
  const [headerLine = ""] = figureText.split("\n");
  const headerDivider = headerLine.indexOf("│");

  return {
    leftHeader:
      headerDivider === -1
        ? headerLine.trim()
        : headerLine.slice(0, headerDivider).trim(),
    rightHeader:
      headerDivider === -1 ? "" : headerLine.slice(headerDivider + 1).trim(),
  };
}

function LedgerRail() {
  return (
    <span className="docs-figure__shape-ledger-divider" aria-hidden="true">
      <span className="docs-figure__shape-character docs-figure__shape-ledger-rail">
        {VERTICAL_RAIL}
      </span>
    </span>
  );
}

function LedgerRule() {
  return (
    <div className="docs-figure__shape-ledger-rule" aria-hidden="true">
      <span className="docs-figure__shape-ledger-rule-run">
        {HORIZONTAL_RAIL}
      </span>
      <span className="docs-figure__shape-character">┼</span>
      <span className="docs-figure__shape-ledger-rule-run">
        {HORIZONTAL_RAIL}
      </span>
    </div>
  );
}

export function LedgerFigureVisual({ figure }: { figure: LedgerFigure }) {
  const { leftHeader, rightHeader } = ledgerShape(figure.figureText);

  return (
    <div className="docs-figure__shape-ledger" role="table">
      <div
        className="docs-figure__shape-ledger-row docs-figure__shape-ledger-header"
        role="row"
      >
        <span
          className="docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--left"
          role="columnheader"
        >
          {leftHeader}
        </span>
        <LedgerRail />
        {rightHeader ? (
          <span
            className="docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--right"
            role="columnheader"
          >
            {rightHeader}
          </span>
        ) : null}
      </div>
      <LedgerRule />
      {figure.items.map((item, index) => (
        <div
          className="docs-figure__shape-ledger-entry"
          key={`${index}:${item.title}`}
        >
          <div className="docs-figure__shape-ledger-row" role="row">
            <strong
              className="docs-figure__term docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--left"
              role="cell"
            >
              {item.title}
            </strong>
            <LedgerRail />
            {item.detail !== undefined ? (
              <strong
                className="docs-figure__term docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--right"
                role="cell"
              >
                {item.detail}
              </strong>
            ) : null}
          </div>
          {index < figure.items.length - 1 ? <LedgerRule /> : null}
        </div>
      ))}
    </div>
  );
}
